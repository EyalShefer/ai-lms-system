import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { Course } from '../types';
import { mockCourse } from '../mockData';

interface CourseContextType {
    course: Course;
    updateCourseTitle: (title: string) => void;
    updateLearningUnit: (moduleId: string, unitId: string, updates: Partial<import('../types').LearningUnit>) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [course, setCourse] = useState<Course>(mockCourse);

    const updateCourseTitle = (title: string) => {
        setCourse(prev => ({ ...prev, title }));
    };

    const updateLearningUnit = (moduleId: string, unitId: string, updates: Partial<import('../types').LearningUnit>) => {
        setCourse(prev => ({
            ...prev,
            syllabus: prev.syllabus.map(module =>
                module.id === moduleId
                    ? {
                        ...module,
                        learningUnits: module.learningUnits.map(unit =>
                            unit.id === unitId ? { ...unit, ...updates } : unit
                        )
                    }
                    : module
            )
        }));
    };

    return (
        <CourseContext.Provider value={{ course, updateCourseTitle, updateLearningUnit }}>
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
