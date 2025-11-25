import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, LearningUnit } from '../types';

// קורס ריק כברירת מחדל
const initialEmptyCourse: Course = {
    id: 'new-course',
    title: 'קורס חדש (ללא תוכן)',
    targetAudience: 'כללי',
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

// שימוש ב-React.ReactNode פותר את בעיית הטיפוסים
export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [course, setCourseState] = useState<Course>(() => {
        try {
            const savedCourse = localStorage.getItem('my-ai-course');
            return savedCourse ? JSON.parse(savedCourse) : initialEmptyCourse;
        } catch (e) {
            return initialEmptyCourse;
        }
    });

    const [fullBookContent, setFullBookContentState] = useState<string>(() => {
        return localStorage.getItem('my-book-content') || "";
    });

    useEffect(() => {
        localStorage.setItem('my-ai-course', JSON.stringify(course));
    }, [course]);

    useEffect(() => {
        localStorage.setItem('my-book-content', fullBookContent);
    }, [fullBookContent]);

    const setCourse = (newCourse: Course) => {
        setCourseState(newCourse);
    };

    const setFullBookContent = (text: string) => {
        setFullBookContentState(text);
    };

    const updateCourseTitle = (newTitle: string) => {
        setCourseState(prev => ({ ...prev, title: newTitle }));
    };

    const updateLearningUnit = (moduleId: string, updatedUnit: LearningUnit) => {
        setCourseState(prevCourse => {
            const newSyllabus = prevCourse.syllabus.map(module => {
                if (module.id !== moduleId) return module;
                return {
                    ...module,
                    learningUnits: module.learningUnits.map(unit =>
                        unit.id === updatedUnit.id ? updatedUnit : unit
                    )
                };
            });
            return { ...prevCourse, syllabus: newSyllabus };
        });
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