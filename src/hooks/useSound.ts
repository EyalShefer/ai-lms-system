import { useCallback } from 'react';
import { useCourseStore } from '../context/CourseContext';

export const useSound = () => {
    const { course } = useCourseStore();
    const isExamMode = course?.mode === 'exam';

    const playSound = useCallback((type: 'success' | 'failure' | 'complete') => {
        if (isExamMode) return;

        // In a real app, these would be actual MP3 paths. 
        // For now, we'll try to use standard path or just log if files missing is expected behavior per prompt "I will provide MP3s".
        // We will assume they exist in /sounds/ folder.

        const audio = new Audio(`/sounds/${type}.mp3`);
        audio.play().catch(e => {
            // Ignore auto-play errors or missing files
            // console.warn("Sound play failed:", e);
        });
    }, [isExamMode]);

    return playSound;
};
