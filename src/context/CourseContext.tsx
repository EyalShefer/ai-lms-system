import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, LearningUnit } from '../courseTypes';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const initialEmptyCourse: Course = {
    id: 'loading',
    teacherId: '',
    title: 'טוען...',
    targetAudience: '',
    syllabus: []
};

interface CourseContextType {
    course: Course;
    fullBookContent: string;
    pdfSource: string | null;
    currentCourseId: string | null;
    loadCourse: (id: string) => void;
    setCourse: (course: Course) => void;
    setFullBookContent: (text: string) => void;
    setPdfSource: (data: string) => void;
    updateCourseTitle: (newTitle: string) => void;
    updateLearningUnit: (moduleId: string, updatedUnit: LearningUnit) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [course, setCourseState] = useState<Course>(initialEmptyCourse);
    const [fullBookContent, setFullBookContentState] = useState<string>("");
    const [pdfSource, setPdfSourceState] = useState<string | null>(null);
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);

    const loadCourse = (id: string) => {
        setCurrentCourseId(id);
    };

    // האזנה וקריאה חכמה של הנתונים
    useEffect(() => {
        if (!currentCourseId) return;

        const courseRef = doc(db, "courses", currentCourseId);
        const unsubscribe = onSnapshot(courseRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                // --- התיקון הקריטי כאן ---
                // בודקים: האם המידע שמור בתוך אובייקט 'course' (ישן) או שטוח (חדש)?
                const courseData = data.course ? data.course : data;

                // מוודאים שיש סילבוס כדי למנוע קריסה
                if (!courseData.syllabus) courseData.syllabus = [];

                setCourseState({ ...courseData, id: docSnap.id } as Course);
                setFullBookContentState(data.fullBookContent || "");
                setPdfSourceState(data.pdfSource || null);
            }
        });

        return () => unsubscribe();
    }, [currentCourseId]);

    // שמירה בפורמט שטוח (Flat) כדי למנוע בלבול בעתיד
    const saveToCloud = async (newCourse: Course, newBookContent: string, newPdf: string | null) => {
        if (!currentCourseId) return;
        try {
            // מפרקים את האובייקט ושומרים את השדות ישירות במסמך
            const { id, ...courseFields } = newCourse;

            await setDoc(doc(db, "courses", currentCourseId), {
                ...courseFields, // שומרים את title, syllabus, teacherId בשורש המסמך
                fullBookContent: newBookContent,
                pdfSource: newPdf,
                lastUpdated: new Date()
            }, { merge: true });
        } catch (e) {
            console.error("Error saving:", e);
        }
    };

    const setCourse = (newCourse: Course) => {
        setCourseState(newCourse);
        saveToCloud(newCourse, fullBookContent, pdfSource);
    };

    const setFullBookContent = (text: string) => {
        setFullBookContentState(text);
        saveToCloud(course, text, pdfSource);
    };

    const setPdfSource = (data: string) => {
        setPdfSourceState(data);
        saveToCloud(course, fullBookContent, data);
    };

    const updateCourseTitle = (newTitle: string) => {
        const updated = { ...course, title: newTitle };
        setCourseState(updated);
        saveToCloud(updated, fullBookContent, pdfSource);
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
        saveToCloud(updatedCourse, fullBookContent, pdfSource);
    };

    return (
        <CourseContext.Provider value={{
            course,
            fullBookContent,
            pdfSource,
            currentCourseId,
            loadCourse,
            setCourse,
            setFullBookContent,
            setPdfSource,
            updateCourseTitle,
            updateLearningUnit
        }}>
            {children}
        </CourseContext.Provider>
    );
};

export const useCourseStore = () => {
    const context = useContext(CourseContext);
    if (!context) throw new Error('useCourseStore must be used within a CourseProvider');
    return context;
};