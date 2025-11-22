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
                        },
                        {
                            id: 'ab2',
                            type: 'video',
                            content: 'https://example.com/intro-video.mp4',
                            metadata: { duration: 300 }
                        }
                    ]
                },
                {
                    id: 'lu2',
                    title: 'קומפוננטות ו-Props',
                    type: 'practice',
                    baseContent: 'קומפוננטות הן אבני הבניין של אפליקציות React.',
                    activityBlocks: [
                        {
                            id: 'ab3',
                            type: 'multiple-choice',
                            content: {
                                question: 'מהי קומפוננטה?',
                                options: ['פונקציה', 'משתנה', 'מסד נתונים'],
                                correctAnswer: 'פונקציה'
                            },
                            metadata: { difficultyLevel: 2 }
                        }
                    ]
                }
            ]
        }
    ]
};
