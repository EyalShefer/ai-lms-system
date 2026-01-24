/**
 * Bagrut Exam Structures - מבני בחינות בגרות
 *
 * הגדרת מבנה הבחינה האמיתי לכל מקצוע:
 * - סוגי שאלות
 * - ניקוד
 * - סוגי מקורות
 * - חלוקה לפי פרקים
 */

import type { BagrutSubject, BagrutQuestionType } from '../../../src/shared/types/bagrutTypes';

// ============================================
// TYPES
// ============================================

export interface ExamStructure {
    subject: BagrutSubject;
    hebrewName: string;
    totalPoints: number;
    parts: ExamPart[];
    sourceTypes: SourceType[];
    questionDistribution: QuestionDistribution;
    targetQuestionsPerChapter: number;
    notes: string[];
}

export interface ExamPart {
    name: string;
    hebrewName: string;
    points: number;
    description: string;
    questionTypes: BagrutQuestionType[];
    isMandatory: boolean;
    numQuestions: number;
    chooseFrom?: number; // אם צריך לבחור X מתוך Y
}

export interface SourceType {
    type: string;
    hebrewName: string;
    examples: string[];
    frequency: number; // 0-1, כמה נפוץ
}

export interface QuestionDistribution {
    'source-analysis': number;  // אחוז שאלות ניתוח מקור
    'open': number;             // אחוז שאלות פתוחות
    'multiple-choice': number;  // אחוז רב-ברירה
    'essay': number;            // אחוז חיבור
    'comparison': number;       // אחוז שאלות השוואה
}

export interface PointDistribution {
    points: number;
    percentage: number;
}

// ============================================
// CIVICS - אזרחות
// ============================================

export const CIVICS_STRUCTURE: ExamStructure = {
    subject: 'civics',
    hebrewName: 'אזרחות',
    totalPoints: 100,
    parts: [
        {
            name: 'source-analysis',
            hebrewName: 'חלק א - ניתוח מקורות',
            points: 30,
            description: 'ניתוח 2-3 מקורות (חוקים, פסקי דין, מאמרים)',
            questionTypes: ['source-analysis'],
            isMandatory: true,
            numQuestions: 3
        },
        {
            name: 'open-questions',
            hebrewName: 'חלק ב - שאלות פתוחות',
            points: 70,
            description: 'שאלות פתוחות על פרקי הלימוד',
            questionTypes: ['open', 'essay'],
            isMandatory: true,
            numQuestions: 4,
            chooseFrom: 8 // לבחור 4 מתוך 8
        }
    ],
    sourceTypes: [
        {
            type: 'basic-law',
            hebrewName: 'חוק יסוד',
            examples: [
                'חוק יסוד: כבוד האדם וחירותו',
                'חוק יסוד: חופש העיסוק',
                'חוק יסוד: הכנסת',
                'חוק יסוד: הממשלה',
                'חוק יסוד: השפיטה'
            ],
            frequency: 0.3
        },
        {
            type: 'court-ruling',
            hebrewName: 'פסק דין בג"ץ',
            examples: [
                'בג"ץ קול העם',
                'בג"ץ מיעארי',
                'בג"ץ קעדאן',
                'בג"ץ שטנגר',
                'בג"ץ התנועה לאיכות השלטון'
            ],
            frequency: 0.25
        },
        {
            type: 'declaration',
            hebrewName: 'מגילת העצמאות',
            examples: [
                'הכרזת העצמאות - פסקת הזכויות',
                'הכרזת העצמאות - אופי המדינה',
                'הכרזת העצמאות - קריאה לשלום'
            ],
            frequency: 0.15
        },
        {
            type: 'opinion-article',
            hebrewName: 'מאמר דעה',
            examples: [
                'מאמר על יחסי דת ומדינה',
                'מאמר על זכויות מיעוטים',
                'מאמר על מתח בין ערכים'
            ],
            frequency: 0.15
        },
        {
            type: 'statistics',
            hebrewName: 'נתונים סטטיסטיים',
            examples: [
                'תוצאות בחירות',
                'סקרי דעת קהל',
                'נתונים דמוגרפיים'
            ],
            frequency: 0.1
        },
        {
            type: 'political-cartoon',
            hebrewName: 'קריקטורה פוליטית',
            examples: [
                'קריקטורה על הפרדת רשויות',
                'קריקטורה על בחירות',
                'קריקטורה על זכויות'
            ],
            frequency: 0.05
        }
    ],
    questionDistribution: {
        'source-analysis': 0.40,
        'open': 0.35,
        'multiple-choice': 0.15,
        'essay': 0.05,
        'comparison': 0.05
    },
    targetQuestionsPerChapter: 30,
    notes: [
        'דגש על הבנת מושגים וקישור למציאות',
        'שאלות על מתחים בין ערכים',
        'יישום עקרונות על מקרים אקטואליים'
    ]
};

// ============================================
// LITERATURE - ספרות
// ============================================

export const LITERATURE_STRUCTURE: ExamStructure = {
    subject: 'literature',
    hebrewName: 'ספרות',
    totalPoints: 100,
    parts: [
        {
            name: 'poetry',
            hebrewName: 'חלק א - שירה',
            points: 30,
            description: 'ניתוח שירים',
            questionTypes: ['source-analysis', 'open'],
            isMandatory: true,
            numQuestions: 2
        },
        {
            name: 'prose',
            hebrewName: 'חלק ב - פרוזה',
            points: 40,
            description: 'ניתוח סיפורים ורומנים',
            questionTypes: ['source-analysis', 'open', 'essay'],
            isMandatory: true,
            numQuestions: 2,
            chooseFrom: 4
        },
        {
            name: 'unseen',
            hebrewName: 'חלק ג - יצירה שלא נלמדה',
            points: 30,
            description: 'ניתוח קטע חדש',
            questionTypes: ['source-analysis'],
            isMandatory: true,
            numQuestions: 1
        }
    ],
    sourceTypes: [
        {
            type: 'poem',
            hebrewName: 'שיר',
            examples: [
                'שירי רחל',
                'שירי אלתרמן',
                'שירי לאה גולדברג',
                'שירי עמיחי',
                'שירי זך'
            ],
            frequency: 0.35
        },
        {
            type: 'story-excerpt',
            hebrewName: 'קטע סיפורי',
            examples: [
                'קטע מסיפור של עגנון',
                'קטע מרומן',
                'קטע מנובלה'
            ],
            frequency: 0.35
        },
        {
            type: 'drama-excerpt',
            hebrewName: 'קטע מחזאי',
            examples: [
                'קטע ממחזה',
                'דיאלוג בין דמויות'
            ],
            frequency: 0.15
        },
        {
            type: 'unseen-text',
            hebrewName: 'טקסט שלא נלמד',
            examples: [
                'שיר חדש',
                'קטע סיפורי חדש'
            ],
            frequency: 0.15
        }
    ],
    questionDistribution: {
        'source-analysis': 0.50,
        'open': 0.30,
        'multiple-choice': 0.05,
        'essay': 0.10,
        'comparison': 0.05
    },
    targetQuestionsPerChapter: 25,
    notes: [
        'דגש על אמצעים ספרותיים',
        'ניתוח דמויות ומוטיבים',
        'השוואה בין יצירות'
    ]
};

// ============================================
// BIBLE - תנ"ך
// ============================================

export const BIBLE_STRUCTURE: ExamStructure = {
    subject: 'bible',
    hebrewName: 'תנ"ך',
    totalPoints: 100,
    parts: [
        {
            name: 'text-analysis',
            hebrewName: 'חלק א - פרשנות טקסט',
            points: 40,
            description: 'ניתוח פסוקים ופרשנות',
            questionTypes: ['source-analysis'],
            isMandatory: true,
            numQuestions: 2
        },
        {
            name: 'content',
            hebrewName: 'חלק ב - תוכן ורעיונות',
            points: 40,
            description: 'שאלות על תוכן ומסרים',
            questionTypes: ['open', 'essay'],
            isMandatory: true,
            numQuestions: 2,
            chooseFrom: 4
        },
        {
            name: 'comparison',
            hebrewName: 'חלק ג - השוואה',
            points: 20,
            description: 'השוואה בין פרקים או דמויות',
            questionTypes: ['essay'],
            isMandatory: true,
            numQuestions: 1,
            chooseFrom: 2
        }
    ],
    sourceTypes: [
        {
            type: 'torah-verses',
            hebrewName: 'פסוקים מהתורה',
            examples: [
                'פסוקים מבראשית',
                'פסוקים משמות',
                'פסוקים מדברים'
            ],
            frequency: 0.30
        },
        {
            type: 'prophets-verses',
            hebrewName: 'פסוקים מנביאים',
            examples: [
                'פסוקים מישעיהו',
                'פסוקים מירמיהו',
                'פסוקים משמואל'
            ],
            frequency: 0.35
        },
        {
            type: 'writings-verses',
            hebrewName: 'פסוקים מכתובים',
            examples: [
                'פסוקים מתהילים',
                'פסוקים ממשלי',
                'פסוקים מאיוב'
            ],
            frequency: 0.20
        },
        {
            type: 'commentary',
            hebrewName: 'פרשנות מסורתית',
            examples: [
                'רש"י',
                'רד"ק',
                'אבן עזרא'
            ],
            frequency: 0.15
        }
    ],
    questionDistribution: {
        'source-analysis': 0.45,
        'open': 0.30,
        'multiple-choice': 0.10,
        'essay': 0.10,
        'comparison': 0.05
    },
    targetQuestionsPerChapter: 25,
    notes: [
        'דגש על פרשנות פסוקים',
        'הבנת דמויות ומעשיהן',
        'מסרים ורעיונות מרכזיים'
    ]
};

// ============================================
// HEBREW - עברית
// ============================================

export const HEBREW_STRUCTURE: ExamStructure = {
    subject: 'hebrew',
    hebrewName: 'עברית',
    totalPoints: 100,
    parts: [
        {
            name: 'reading-comprehension',
            hebrewName: 'חלק א - הבנת הנקרא',
            points: 40,
            description: 'שאלות על טקסט עיוני',
            questionTypes: ['source-analysis', 'open', 'multiple-choice'],
            isMandatory: true,
            numQuestions: 8
        },
        {
            name: 'writing',
            hebrewName: 'חלק ב - כתיבה',
            points: 35,
            description: 'חיבור טיעוני או סיכום',
            questionTypes: ['essay'],
            isMandatory: true,
            numQuestions: 1,
            chooseFrom: 2
        },
        {
            name: 'language',
            hebrewName: 'חלק ג - לשון',
            points: 25,
            description: 'שאלות דקדוק ולשון',
            questionTypes: ['multiple-choice', 'open'],
            isMandatory: true,
            numQuestions: 10
        }
    ],
    sourceTypes: [
        {
            type: 'expository-text',
            hebrewName: 'טקסט עיוני',
            examples: [
                'מאמר מדעי',
                'מאמר חברתי',
                'כתבה עיתונאית'
            ],
            frequency: 0.40
        },
        {
            type: 'argumentative-text',
            hebrewName: 'טקסט טיעוני',
            examples: [
                'מאמר דעה',
                'נאום',
                'מכתב לעורך'
            ],
            frequency: 0.30
        },
        {
            type: 'literary-text',
            hebrewName: 'טקסט ספרותי',
            examples: [
                'קטע סיפורי',
                'שיר',
                'מסה'
            ],
            frequency: 0.20
        },
        {
            type: 'visual-text',
            hebrewName: 'טקסט חזותי',
            examples: [
                'גרף',
                'טבלה',
                'מודעה'
            ],
            frequency: 0.10
        }
    ],
    questionDistribution: {
        'source-analysis': 0.30,
        'open': 0.25,
        'multiple-choice': 0.30,
        'essay': 0.10,
        'comparison': 0.05
    },
    targetQuestionsPerChapter: 30,
    notes: [
        'דגש על הבנת טענות וראיות',
        'זיהוי אמצעים רטוריים',
        'כתיבה טיעונית מובנית'
    ]
};

// ============================================
// ENGLISH - אנגלית
// ============================================

export const ENGLISH_STRUCTURE: ExamStructure = {
    subject: 'english',
    hebrewName: 'אנגלית',
    totalPoints: 100,
    parts: [
        {
            name: 'reading',
            hebrewName: 'Part A - Reading Comprehension',
            points: 40,
            description: 'Unseen text comprehension',
            questionTypes: ['source-analysis', 'multiple-choice', 'open'],
            isMandatory: true,
            numQuestions: 10
        },
        {
            name: 'literature',
            hebrewName: 'Part B - Literature',
            points: 30,
            description: 'Questions on studied literature',
            questionTypes: ['open', 'essay'],
            isMandatory: true,
            numQuestions: 2,
            chooseFrom: 4
        },
        {
            name: 'writing',
            hebrewName: 'Part C - Writing',
            points: 30,
            description: 'Essay writing',
            questionTypes: ['essay'],
            isMandatory: true,
            numQuestions: 1,
            chooseFrom: 2
        }
    ],
    sourceTypes: [
        {
            type: 'narrative-text',
            hebrewName: 'Narrative Text',
            examples: [
                'Short story excerpt',
                'News story',
                'Biography excerpt'
            ],
            frequency: 0.30
        },
        {
            type: 'expository-text',
            hebrewName: 'Expository Text',
            examples: [
                'Scientific article',
                'Informational text',
                'Encyclopedia entry'
            ],
            frequency: 0.35
        },
        {
            type: 'literary-text',
            hebrewName: 'Literary Text',
            examples: [
                'Poem',
                'Play excerpt',
                'Novel excerpt'
            ],
            frequency: 0.25
        },
        {
            type: 'visual-text',
            hebrewName: 'Visual Text',
            examples: [
                'Chart',
                'Advertisement',
                'Infographic'
            ],
            frequency: 0.10
        }
    ],
    questionDistribution: {
        'source-analysis': 0.35,
        'open': 0.25,
        'multiple-choice': 0.25,
        'essay': 0.10,
        'comparison': 0.05
    },
    targetQuestionsPerChapter: 25,
    notes: [
        'Focus on inference and bridging',
        'Vocabulary in context',
        'Literary analysis skills'
    ]
};

// ============================================
// HISTORY - היסטוריה
// ============================================

export const HISTORY_STRUCTURE: ExamStructure = {
    subject: 'history',
    hebrewName: 'היסטוריה',
    totalPoints: 100,
    parts: [
        {
            name: 'source-analysis',
            hebrewName: 'חלק א - ניתוח מקורות',
            points: 30,
            description: 'ניתוח מסמכים היסטוריים',
            questionTypes: ['source-analysis'],
            isMandatory: true,
            numQuestions: 2
        },
        {
            name: 'content',
            hebrewName: 'חלק ב - שאלות תוכן',
            points: 50,
            description: 'שאלות על תקופות ואירועים',
            questionTypes: ['open', 'essay'],
            isMandatory: true,
            numQuestions: 3,
            chooseFrom: 6
        },
        {
            name: 'synthesis',
            hebrewName: 'חלק ג - שאלת סינתזה',
            points: 20,
            description: 'חיבור מקיף על תקופה',
            questionTypes: ['essay'],
            isMandatory: true,
            numQuestions: 1,
            chooseFrom: 2
        }
    ],
    sourceTypes: [
        {
            type: 'historical-document',
            hebrewName: 'מסמך היסטורי',
            examples: [
                'הצהרת בלפור',
                'תוכנית באזל',
                'החלטת החלוקה',
                'הסכם שביתת נשק'
            ],
            frequency: 0.30
        },
        {
            type: 'speech',
            hebrewName: 'נאום',
            examples: [
                'נאום הרצל',
                'נאום בן גוריון',
                'נאום היטלר'
            ],
            frequency: 0.15
        },
        {
            type: 'letter',
            hebrewName: 'מכתב',
            examples: [
                'מכתבי מנהיגים',
                'עדויות ניצולים',
                'יומנים'
            ],
            frequency: 0.15
        },
        {
            type: 'photograph',
            hebrewName: 'תצלום היסטורי',
            examples: [
                'תצלומי התיישבות',
                'תצלומי מלחמה',
                'תצלומי השואה'
            ],
            frequency: 0.15
        },
        {
            type: 'map',
            hebrewName: 'מפה היסטורית',
            examples: [
                'מפת החלוקה',
                'מפת ההתיישבות',
                'מפת מלחמות'
            ],
            frequency: 0.10
        },
        {
            type: 'statistics',
            hebrewName: 'נתונים סטטיסטיים',
            examples: [
                'נתוני עלייה',
                'נתוני אוכלוסייה',
                'נתוני כלכלה'
            ],
            frequency: 0.10
        },
        {
            type: 'newspaper',
            hebrewName: 'כתבה עיתונאית',
            examples: [
                'כותרות עיתונים',
                'כתבות תקופה'
            ],
            frequency: 0.05
        }
    ],
    questionDistribution: {
        'source-analysis': 0.35,
        'open': 0.35,
        'multiple-choice': 0.10,
        'essay': 0.15,
        'comparison': 0.05
    },
    targetQuestionsPerChapter: 25,
    notes: [
        'דגש על סיבה ותוצאה',
        'הבנת תהליכים היסטוריים',
        'ניתוח מקורות ראשוניים'
    ]
};

// ============================================
// EXPORT ALL STRUCTURES
// ============================================

export const EXAM_STRUCTURES: Record<BagrutSubject, ExamStructure> = {
    civics: CIVICS_STRUCTURE,
    literature: LITERATURE_STRUCTURE,
    bible: BIBLE_STRUCTURE,
    hebrew: HEBREW_STRUCTURE,
    english: ENGLISH_STRUCTURE,
    history: HISTORY_STRUCTURE
};

// ============================================
// POINT VALUES
// ============================================

export const STANDARD_POINT_VALUES = [10, 15, 20, 25];

export function getPointsForQuestionType(type: BagrutQuestionType): number {
    switch (type) {
        case 'multiple-choice':
            return 10;
        case 'open':
            return 15;
        case 'source-analysis':
            return 20;
        case 'essay':
            return 25;
        default:
            return 15;
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTotalTargetQuestions(subject: BagrutSubject, numChapters: number): number {
    const structure = EXAM_STRUCTURES[subject];
    return structure.targetQuestionsPerChapter * numChapters;
}

export function getQuestionTypeDistribution(subject: BagrutSubject): Array<{ type: BagrutQuestionType; count: number }> {
    const structure = EXAM_STRUCTURES[subject];
    const total = structure.targetQuestionsPerChapter;

    return [
        { type: 'source-analysis', count: Math.round(total * structure.questionDistribution['source-analysis']) },
        { type: 'open', count: Math.round(total * structure.questionDistribution['open']) },
        { type: 'multiple-choice', count: Math.round(total * structure.questionDistribution['multiple-choice']) },
        { type: 'essay', count: Math.round(total * structure.questionDistribution['essay']) }
    ];
}
