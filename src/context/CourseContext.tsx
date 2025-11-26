import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Course, LearningUnit } from '../types';
import { db } from '../firebase'; // הייבוא של הקובץ שיצרת
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// קורס ריק כברירת מחדל (עד שהמידע יגיע מהענן)
const initialEmptyCourse: Course = {
    id: 'new-course',
    title: 'טוען קורס מהענן...',
    targetAudience: '...',
    syllabus: []
};

interface CourseContextType {
    course: Course;
    fullBookContent: string;
    setCourse: (course: Course) => void;
    setFullBookContent: (text: string) => void;
    updateCourseTitle: (newTitle: string) => void;
    updateLearningUnit: (moduleId: string, updatedUnit: LearningUnit) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [course, setCourseState] = useState<Course>(initialEmptyCourse);
    const [fullBookContent, setFullBookContentState] = useState<string>("");

    // מזהה הקורס הקבוע שלנו (בשלב הבא נעשה את זה דינמי לכל מורה)
    const COURSE_ID = "my-first-course";

    // 1. האזנה לשינויים בענן (Real-time Listener)
    // ברגע שמשהו משתנה ב-Firebase, זה מתעדכן אצלך אוטומטית
    useEffect(() => {
        const courseRef = doc(db, "courses", COURSE_ID);

        const unsubscribe = onSnapshot(courseRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // עדכון הנתונים באפליקציה
                if (data.course) setCourseState(data.course);
                if (data.fullBookContent) setFullBookContentState(data.fullBookContent);
            } else {
                console.log("No course found in cloud, creating new...");
                // אם אין קורס, ניצור אחד ריק בענן
                saveToCloud(initialEmptyCourse, "");
            }
        }, (error) => {
            console.error("Firebase Read Error:", error);
        });

        return () => unsubscribe();
    }, []);

    // פונקציית עזר לשמירה בענן (Debounced - כדי לא לשגע את השרת)
    const saveToCloud = async (newCourse: Course, newBookContent: string) => {
        try {
            await setDoc(doc(db, "courses", COURSE_ID), {
                course: newCourse,
                fullBookContent: newBookContent
            });
        } catch (e) {
            console.error("Error saving to cloud:", e);
        }
    };

    // --- הפונקציות שחושפות את המידע לאפליקציה ---

    const setCourse = (newCourse: Course) => {
        setCourseState(newCourse);
        saveToCloud(newCourse, fullBookContent); // שמירה לענן
    };

    const setFullBookContent = (text: string) => {
        setFullBookContentState(text);
        saveToCloud(course, text); // שמירה לענן
    };

    const updateCourseTitle = (newTitle: string) => {
        const updated = { ...course, title: newTitle };
        setCourseState(updated);
        saveToCloud(updated, fullBookContent);
    };

    const updateLearningUnit = (moduleId: string, updatedUnit: LearningUnit) => {
        const updatedCourse = { ...course };
        updatedCourse.syllabus = updatedCourse.syllabus.map(module => {
            if (module.id !== moduleId) return module;
            return {
                ...module,
                learningUnits: module.learningUnits.map(unit =>
                    unit.id === updatedUnit.id ? updatedUnit : unit
                )
            };
        });

        setCourseState(updatedCourse);
        saveToCloud(updatedCourse, fullBookContent);
    };

    return (
        <CourseContext.Provider value={{
            course,
            setCourse,
            fullBookContent,
            setFullBookContent,
            updateCourseTitle,
            updateLearningUnit
        }}>
            {children}
        </CourseContext.Provider>
    );
};

export const useCourseStore = () => {
    const context = useContext(CourseContext);
    if (!context) {
        throw new Error('useCourseStore must be used within a CourseProvider');
    }
    return context;
};