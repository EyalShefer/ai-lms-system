import type { Course } from './shared/types/courseTypes';

export const mockCourse: Course = {
    id: 'c1',
    teacherId: 't1',
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
        },
        {
            id: 'm2',
            title: 'פרק 2: תרגול אינטראקטיבי',
            learningUnits: [
                {
                    id: 'lu2',
                    title: 'הדגמת רכיבים חדשים',
                    type: 'practice',
                    baseContent: 'בוא נתרגל את מה שלמדנו עם הרכיבים החדשים.',
                    activityBlocks: [
                        {
                            id: 'ab_cloze',
                            type: 'fill_in_blanks',
                            content: {
                                sentence: 'React היא ספרייה של _____ לבניית ממשקי _____.',
                                hidden_words: ['JavaScript', 'משתמש'],
                                distractors: ['Java', 'שרת', 'פייתון']
                            },
                            metadata: { score: 10 }
                        },
                        {
                            id: 'ab_order',
                            type: 'ordering',
                            content: {
                                instruction: 'סדר את השלבים ביצירת קומפוננטה:',
                                correct_order: [
                                    'ייבוא React',
                                    'הגדרת הפונקציה',
                                    'החזרת JSX',
                                    'ייצוא הקומפוננטה'
                                ]
                            },
                            metadata: { score: 10 }
                        },
                        {
                            id: 'ab_cat',
                            type: 'categorization',
                            content: {
                                question: 'מיין את הפריטים הבאים:',
                                categories: ['Frontend', 'Backend'],
                                items: [
                                    { text: 'React', category: 'Frontend' },
                                    { text: 'CSS', category: 'Frontend' },
                                    { text: 'Node.js', category: 'Backend' },
                                    { text: 'Express', category: 'Backend' },
                                    { text: 'HTML', category: 'Frontend' },
                                    { text: 'MongoDB', category: 'Backend' }
                                ]
                            },
                            metadata: { score: 10 }
                        },
                        {
                            id: 'ab_memory',
                            type: 'memory_game',
                            content: {
                                pairs: [
                                    { card_a: 'Component', card_b: 'רכיב' },
                                    { card_a: 'State', card_b: 'מצב' },
                                    { card_a: 'Props', card_b: 'מאפיינים' },
                                    { card_a: 'Hook', card_b: 'וו' }
                                ]
                            },
                            metadata: { score: 10 }
                        },

                    ]
                }
            ]
        }
    ]
};