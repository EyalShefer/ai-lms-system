import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, LearningUnit } from '../courseTypes';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';

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

// פונקציית ניקוי וסניטציה לנתונים שמגיעים מ-Firebase
const sanitizeCourseData = (data: any, docId: string): Course => {
    const course = data.course ? data.course : data;

    const syllabus = Array.isArray(course.syllabus) ? course.syllabus : [];

    const cleanSyllabus = syllabus.map((mod: any) => {
        const modId = mod.id || uuidv4();
        const learningUnits = Array.isArray(mod.learningUnits) ? mod.learningUnits : [];
        const cleanUnits = learningUnits.map((unit: any) => {
            const unitId = unit.id || uuidv4();
            const activityBlocks = Array.isArray(unit.activityBlocks) ? unit.activityBlocks : [];
            const cleanBlocks = activityBlocks.map((block: any) => ({
                ...block,
                id: block.id || uuidv4()
            }));
            return { ...unit, id: unitId, activityBlocks: cleanBlocks };
        });
        return { ...mod, id: modId, learningUnits: cleanUnits };
    });

    return {
        ...course,
        id: docId,
        syllabus: cleanSyllabus
    } as Course;
};

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [course, setCourseState] = useState<Course>(initialEmptyCourse);
    const [fullBookContent, setFullBookContentState] = useState<string>("");
    const [pdfSource, setPdfSourceState] = useState<string | null>(null);
    const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);

    const loadCourse = (id: string) => {
        setCurrentCourseId(id);
    };

    useEffect(() => {
        if (!currentCourseId) return;

        const courseRef = doc(db, "courses", currentCourseId);
        const unsubscribe = onSnapshot(courseRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const cleanCourse = sanitizeCourseData(data, docSnap.id);

                setCourseState(cleanCourse);
                setFullBookContentState(data.fullBookContent || "");
                setPdfSourceState(data.pdfSource || null);
            }
        });

        return () => unsubscribe();
    }, [currentCourseId]);

    const saveToCloud = async (newCourse: Course, newBookContent: string, newPdf: string | null) => {
        if (!currentCourseId) return;
        try {
            const { id, ...courseFields } = newCourse;
            // הסרת שדות undefined לפני השמירה (Firestore לא תומך ב-undefined)
            const cleanFields = JSON.parse(JSON.stringify(courseFields));

            await setDoc(doc(db, "courses", currentCourseId), {
                ...cleanFields,
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
            course, fullBookContent, pdfSource, currentCourseId, loadCourse, setCourse, setFullBookContent, setPdfSource, updateCourseTitle, updateLearningUnit
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