import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Course, LearningUnit } from '../types';
import { mockCourse } from '../mockData';

interface CourseContextType {
    course: Course;
    setCourse: (course: Course) => void; // <--- היכולת החדשה להחליף קורס!
    updateCourseTitle: (newTitle: string) => void;
    updateLearningUnit: (moduleId: string, updatedUnit: LearningUnit) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [course, setCourse] = useState<Course>(mockCourse);

    const updateCourseTitle = (newTitle: string) => {
        setCourse(prev => ({ ...prev, title: newTitle }));
    };

    const updateLearningUnit = (moduleId: string, updatedUnit: LearningUnit) => {
        setCourse(prevCourse => {
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
        <CourseContext.Provider value={{ course, setCourse, updateCourseTitle, updateLearningUnit }}>
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