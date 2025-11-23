import type { Course } from './types';

export const mockCourse: Course = {
    id: 'c1',
    title: 'מבוא ל-React',
    targetAudience: 'מפתחים מתחילים',
    syllabus: [
        {
            id: 'm1',
            title: 'פרק 1: יסודות',
            learningUnits: [
                {
                    id: 'lu1',
                    title: 'מה זה React?',
                    type: 'acquisition',
                    baseContent: 'React היא ספריית JavaScript לבניית ממשקי משתמש.',
                    activityBlocks: [
                        {
                            id: 'ab1',
                            type: 'text',
                            content: 'קרא את המבוא בתיעוד הרשמי.',
                            metadata: { difficultyLevel: 1 }
                        }
                    ]
                }
            ]
        }
    ]
};