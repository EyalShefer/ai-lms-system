/**
 * Seed Capabilities - Initial capability definitions
 *
 * מכיל את כל היכולות הקיימות של המערכת לטעינה ל-Firestore
 */

import type { Capability } from '../../../src/shared/types/capabilityTypes';

// ========== Interactive Content Capabilities ==========

const createInteractiveLesson: Capability = {
    id: 'create_interactive_lesson',
    version: '1.0.0',
    name: 'יצירת שיעור אינטראקטיבי',
    description: 'יצירת שיעור מלא עם שקפים, אינפוגרפיקות, הסברים ושאלות. התלמידים עוברים את השיעור במערכת עם תמונות מונפשות ומשוב מיידי.',
    shortDescription: 'שיעור דיגיטלי עם תמונות ושאלות',
    category: 'interactive_content',
    complexity: 'complex',
    executionType: 'wizard',

    parameters: {
        topic: {
            name: 'topic',
            type: 'string',
            description: 'נושא השיעור',
            required: true,
            validationRules: { minLength: 2, maxLength: 200 }
        },
        grade: {
            name: 'grade',
            type: 'string',
            description: 'שכבת גיל (כיתה א-יב)',
            required: false
        },
        subject: {
            name: 'subject',
            type: 'string',
            description: 'תחום דעת (מתמטיקה, מדעים, עברית וכו\')',
            required: false
        },
        activityLength: {
            name: 'activityLength',
            type: 'enum',
            description: 'אורך השיעור',
            required: false,
            defaultValue: 'medium',
            enumValues: ['short', 'medium', 'long']
        },
        difficultyLevel: {
            name: 'difficultyLevel',
            type: 'enum',
            description: 'רמת קושי',
            required: false,
            defaultValue: 'core',
            enumValues: ['support', 'core', 'enrichment', 'all']
        },
        includeBot: {
            name: 'includeBot',
            type: 'boolean',
            description: 'האם לכלול בוט AI לעזרה',
            required: false,
            defaultValue: true
        }
    },

    triggers: {
        keywords: [
            'שיעור', 'מערך שיעור', 'שיעור אינטראקטיבי', 'שיעור דיגיטלי',
            'שיעור עם תמונות', 'שיעור ויזואלי', 'שיעור במערכת',
            'לימוד', 'הסבר', 'הוראה'
        ],
        contexts: ['content_creation', 'interactive_mode'],
        exclusions: ['להדפסה', 'מודפס', 'PDF', 'Word']
    },

    examples: [
        {
            userMessage: 'תכין לי שיעור על מחזור המים לכיתה ד',
            expectedParams: { topic: 'מחזור המים', grade: 'ד' },
            explanation: 'בקשה ברורה לשיעור עם נושא וכיתה'
        },
        {
            userMessage: 'צור שיעור אינטראקטיבי על שברים',
            expectedParams: { topic: 'שברים' },
            explanation: 'המילה "אינטראקטיבי" מבהירה שזה שיעור דיגיטלי'
        }
    ],

    functionDeclaration: {
        name: 'create_interactive_lesson',
        description: 'יצירת שיעור אינטראקטיבי עם שקפים, תמונות, ושאלות',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: 'נושא השיעור' },
                grade: { type: 'string', description: 'כיתה/שכבת גיל' },
                subject: { type: 'string', description: 'תחום דעת' },
                activityLength: { type: 'string', enum: ['short', 'medium', 'long'] },
                difficultyLevel: { type: 'string', enum: ['support', 'core', 'enrichment', 'all'] },
                includeBot: { type: 'boolean' }
            },
            required: ['topic']
        }
    },

    execution: {
        type: 'wizard',
        wizardComponent: 'ContentCreationWizard',
        wizardMode: 'lesson'
    },

    ui: {
        icon: 'IconBook',
        color: 'blue',
        showInMenu: true,
        menuOrder: 1,
        quickRepliesAfter: ['צור עוד שיעור', 'צור פעילות', 'הוסף שאלות']
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['lesson', 'interactive', 'visual', 'infographics']
};

const createInteractiveActivity: Capability = {
    id: 'create_interactive_activity',
    version: '1.0.0',
    name: 'יצירת פעילות אינטראקטיבית',
    description: 'יצירת פעילות תרגול עם שאלות מגוונות - התאמה, מיון, סידור, חידונים ועוד. התלמידים מקבלים משוב מיידי וניקוד.',
    shortDescription: 'פעילות תרגול עם שאלות ומשוב',
    category: 'interactive_content',
    complexity: 'medium',
    executionType: 'wizard',

    parameters: {
        topic: {
            name: 'topic',
            type: 'string',
            description: 'נושא הפעילות',
            required: true
        },
        grade: {
            name: 'grade',
            type: 'string',
            description: 'כיתה',
            required: false
        },
        activityLength: {
            name: 'activityLength',
            type: 'enum',
            description: 'אורך הפעילות',
            required: false,
            defaultValue: 'medium',
            enumValues: ['short', 'medium', 'long']
        },
        profile: {
            name: 'profile',
            type: 'enum',
            description: 'סגנון הפעילות',
            required: false,
            defaultValue: 'balanced',
            enumValues: ['balanced', 'educational', 'game']
        },
        questionTypes: {
            name: 'questionTypes',
            type: 'array',
            description: 'סוגי שאלות לכלול',
            required: false
        }
    },

    triggers: {
        keywords: [
            'פעילות', 'תרגול', 'תרגילים', 'משחק לימודי',
            'חידון', 'שאלות', 'אינטראקטיבי'
        ],
        contexts: ['content_creation', 'interactive_mode'],
        exclusions: ['להדפסה', 'דף עבודה']
    },

    examples: [
        {
            userMessage: 'צור פעילות תרגול על פעלים',
            expectedParams: { topic: 'פעלים' }
        },
        {
            userMessage: 'בנה לי משחק לימודי על מספרים עד 100',
            expectedParams: { topic: 'מספרים עד 100', profile: 'game' }
        }
    ],

    functionDeclaration: {
        name: 'create_interactive_activity',
        description: 'יצירת פעילות תרגול אינטראקטיבית',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string' },
                grade: { type: 'string' },
                activityLength: { type: 'string', enum: ['short', 'medium', 'long'] },
                profile: { type: 'string', enum: ['balanced', 'educational', 'game'] },
                questionTypes: { type: 'array', items: { type: 'string' } }
            },
            required: ['topic']
        }
    },

    execution: {
        type: 'wizard',
        wizardComponent: 'ContentCreationWizard',
        wizardMode: 'activity'
    },

    ui: {
        icon: 'IconPuzzle',
        color: 'green',
        showInMenu: true,
        menuOrder: 2
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['activity', 'interactive', 'practice', 'quiz']
};

const createInteractiveExam: Capability = {
    id: 'create_interactive_exam',
    version: '1.0.0',
    name: 'יצירת מבחן דיגיטלי',
    description: 'יצירת מבחן או בוחן דיגיטלי עם ציון אוטומטי, ניתוח תשובות, והמלצות לתלמידים.',
    shortDescription: 'מבחן עם ציון אוטומטי',
    category: 'interactive_content',
    complexity: 'medium',
    executionType: 'wizard',

    parameters: {
        topic: {
            name: 'topic',
            type: 'string',
            description: 'נושא המבחן',
            required: true
        },
        grade: {
            name: 'grade',
            type: 'string',
            description: 'כיתה',
            required: false
        },
        questionCount: {
            name: 'questionCount',
            type: 'number',
            description: 'מספר שאלות',
            required: false,
            defaultValue: 10,
            validationRules: { min: 5, max: 50 }
        },
        difficultyLevel: {
            name: 'difficultyLevel',
            type: 'enum',
            description: 'רמת קושי',
            required: false,
            enumValues: ['support', 'core', 'enrichment', 'all']
        },
        timeLimit: {
            name: 'timeLimit',
            type: 'number',
            description: 'זמן מוגבל בדקות (0 = ללא הגבלה)',
            required: false,
            defaultValue: 0
        }
    },

    triggers: {
        keywords: [
            'מבחן', 'בוחן', 'מבחן דיגיטלי', 'בוחן דיגיטלי',
            'מבחן עם ציון אוטומטי', 'מבדק'
        ],
        contexts: ['content_creation', 'interactive_mode'],
        exclusions: ['להדפסה', 'מודפס', 'PDF']
    },

    examples: [
        {
            userMessage: 'צור מבחן דיגיטלי על היסטוריה',
            expectedParams: { topic: 'היסטוריה' }
        },
        {
            userMessage: 'בנה בוחן של 15 שאלות על גיאומטריה',
            expectedParams: { topic: 'גיאומטריה', questionCount: 15 }
        }
    ],

    functionDeclaration: {
        name: 'create_interactive_exam',
        description: 'יצירת מבחן או בוחן דיגיטלי',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string' },
                grade: { type: 'string' },
                questionCount: { type: 'number' },
                difficultyLevel: { type: 'string', enum: ['support', 'core', 'enrichment', 'all'] },
                timeLimit: { type: 'number' }
            },
            required: ['topic']
        }
    },

    execution: {
        type: 'wizard',
        wizardComponent: 'ContentCreationWizard',
        wizardMode: 'exam'
    },

    ui: {
        icon: 'IconClipboardCheck',
        color: 'orange',
        showInMenu: true,
        menuOrder: 3
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['exam', 'test', 'assessment', 'interactive']
};

const createMicroActivity: Capability = {
    id: 'create_micro_activity',
    version: '1.0.0',
    name: 'יצירת מיקרו פעילות',
    description: 'יצירת פעילות קצרה וממוקדת - משחק זיכרון, התאמה, מיון, סידור, השלמת חסר, בניית משפט ועוד. מושלם לתרגול מהיר או כחלק משיעור.',
    shortDescription: 'פעילות קצרה וממוקדת',
    category: 'interactive_content',
    complexity: 'simple',
    executionType: 'wizard',

    parameters: {
        topic: {
            name: 'topic',
            type: 'string',
            description: 'נושא הפעילות או טקסט מקור',
            required: true
        },
        activityType: {
            name: 'activityType',
            type: 'enum',
            description: 'סוג המיקרו פעילות',
            required: false,
            enumValues: [
                'memory_game',    // משחק זיכרון
                'matching',       // התאמה
                'categorization', // מיון
                'ordering',       // סידור
                'sentence_builder', // בניית משפט
                'drag_and_drop',  // גרור והנח
                'fill_in_blanks', // השלמת חסר
                'multiple_choice', // רב-ברירה
                'true_false',     // נכון/לא נכון
                'open_question',  // שאלה פתוחה
                'highlight',      // סימון טקסט
                'table_completion' // השלמת טבלה
            ]
        },
        grade: {
            name: 'grade',
            type: 'string',
            description: 'כיתה',
            required: false
        },
        subject: {
            name: 'subject',
            type: 'string',
            description: 'תחום דעת',
            required: false
        },
        itemCount: {
            name: 'itemCount',
            type: 'number',
            description: 'מספר פריטים בפעילות',
            required: false,
            defaultValue: 6,
            validationRules: { min: 3, max: 20 }
        },
        sourceType: {
            name: 'sourceType',
            type: 'enum',
            description: 'מקור התוכן',
            required: false,
            defaultValue: 'topic',
            enumValues: ['topic', 'text', 'file']
        }
    },

    triggers: {
        keywords: [
            'מיקרו פעילות', 'פעילות קצרה', 'פעילות מהירה',
            'משחק זיכרון', 'זיכרון', 'memory',
            'התאמה', 'matching', 'חיבור',
            'מיון', 'קטגוריות', 'סיווג',
            'סידור', 'ordering', 'סדר נכון',
            'בניית משפט', 'הרכבת משפט',
            'גרור והנח', 'drag and drop',
            'השלמת חסר', 'fill in the blanks', 'cloze',
            'נכון לא נכון', 'true false',
            'סימון טקסט', 'highlight'
        ],
        contexts: ['content_creation', 'interactive_mode', 'quick_activity']
    },

    examples: [
        {
            userMessage: 'צור משחק זיכרון על בעלי חיים',
            expectedParams: { topic: 'בעלי חיים', activityType: 'memory_game' },
            explanation: 'בקשה למשחק זיכרון עם נושא'
        },
        {
            userMessage: 'פעילות התאמה על פעלים בבניינים',
            expectedParams: { topic: 'פעלים בבניינים', activityType: 'matching' },
            explanation: 'התאמה בין פועל לבניין'
        },
        {
            userMessage: 'מיקרו פעילות מיון על סוגי משולשים',
            expectedParams: { topic: 'סוגי משולשים', activityType: 'categorization' },
            explanation: 'מיון משולשים לקטגוריות'
        },
        {
            userMessage: 'סדר את שלבי מחזור המים',
            expectedParams: { topic: 'מחזור המים', activityType: 'ordering' },
            explanation: 'סידור בסדר כרונולוגי'
        },
        {
            userMessage: 'השלמת חסר על הכרזת העצמאות',
            expectedParams: { topic: 'הכרזת העצמאות', activityType: 'fill_in_blanks' }
        }
    ],

    functionDeclaration: {
        name: 'create_micro_activity',
        description: 'יצירת מיקרו פעילות - פעילות קצרה וממוקדת כמו משחק זיכרון, התאמה, מיון, סידור, השלמת חסר ועוד',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string', description: 'נושא הפעילות' },
                activityType: {
                    type: 'string',
                    enum: ['memory_game', 'matching', 'categorization', 'ordering', 'sentence_builder', 'drag_and_drop', 'fill_in_blanks', 'multiple_choice', 'true_false', 'open_question', 'highlight', 'table_completion'],
                    description: 'סוג המיקרו פעילות'
                },
                grade: { type: 'string', description: 'כיתה' },
                subject: { type: 'string', description: 'תחום דעת' },
                itemCount: { type: 'number', description: 'מספר פריטים' },
                sourceType: { type: 'string', enum: ['topic', 'text', 'file'] }
            },
            required: ['topic']
        }
    },

    execution: {
        type: 'wizard',
        wizardComponent: 'MicroActivityWizard',
        wizardMode: 'micro_activity',
        apiEndpoint: 'generateMicroActivity'
    },

    ui: {
        icon: 'IconPuzzle2',
        color: 'pink',
        showInMenu: true,
        menuOrder: 4,
        quickRepliesAfter: ['צור עוד', 'שנה סוג', 'הוסף לשיעור']
    },

    dependencies: {
        suggestAfter: ['create_interactive_lesson', 'create_interactive_activity']
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['micro', 'activity', 'game', 'quick', 'interactive', 'memory', 'matching', 'ordering']
};

// ========== Static Content Capabilities ==========

const generateWorksheet: Capability = {
    id: 'generate_worksheet',
    version: '1.0.0',
    name: 'יצירת דף עבודה להדפסה',
    description: 'יצירת דף עבודה מעוצב להדפסה עם תרגילים, שאלות, ומקום לתשובות.',
    shortDescription: 'דף עבודה PDF להדפסה',
    category: 'static_content',
    complexity: 'simple',
    executionType: 'prompt_based',

    parameters: {
        topic: {
            name: 'topic',
            type: 'string',
            description: 'נושא דף העבודה',
            required: true
        },
        grade: {
            name: 'grade',
            type: 'string',
            description: 'כיתה',
            required: false
        },
        questionCount: {
            name: 'questionCount',
            type: 'number',
            description: 'מספר שאלות',
            required: false,
            defaultValue: 10
        },
        includeAnswerKey: {
            name: 'includeAnswerKey',
            type: 'boolean',
            description: 'האם לכלול מפתח תשובות',
            required: false,
            defaultValue: true
        }
    },

    triggers: {
        keywords: [
            'דף עבודה', 'גיליון עבודה', 'דף תרגילים',
            'דף תרגול', 'להדפסה', 'מודפס'
        ],
        contexts: ['content_creation', 'static_mode']
    },

    examples: [
        {
            userMessage: 'צור דף עבודה על כפל לכיתה ג',
            expectedParams: { topic: 'כפל', grade: 'ג' }
        },
        {
            userMessage: 'דף עבודה להדפסה על הפועל',
            expectedParams: { topic: 'הפועל' }
        }
    ],

    functionDeclaration: {
        name: 'generate_worksheet',
        description: 'יצירת דף עבודה להדפסה',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string' },
                grade: { type: 'string' },
                questionCount: { type: 'number' },
                includeAnswerKey: { type: 'boolean' }
            },
            required: ['topic']
        }
    },

    execution: {
        type: 'direct_api',
        apiEndpoint: 'generateStaticContent',
        apiMethod: 'POST',
        preprocessors: ['mapToStaticContentRequest']
    },

    ui: {
        icon: 'IconFileTypePdf',
        color: 'red',
        showInMenu: true,
        menuOrder: 10,
        quickRepliesAfter: ['הורד PDF', 'צור עוד', 'שנה']
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['worksheet', 'printable', 'static', 'pdf']
};

const generateLessonPlan: Capability = {
    id: 'generate_lesson_plan',
    version: '1.0.0',
    name: 'יצירת מערך שיעור להדפסה',
    description: 'יצירת מערך שיעור מפורט למורה - מטרות, פתיחה, גוף השיעור, סיכום, והערכה.',
    shortDescription: 'מערך שיעור למורה (PDF)',
    category: 'static_content',
    complexity: 'medium',
    executionType: 'prompt_based',

    parameters: {
        topic: {
            name: 'topic',
            type: 'string',
            description: 'נושא השיעור',
            required: true
        },
        grade: {
            name: 'grade',
            type: 'string',
            description: 'כיתה',
            required: false
        },
        duration: {
            name: 'duration',
            type: 'number',
            description: 'אורך השיעור בדקות',
            required: false,
            defaultValue: 45
        },
        objectives: {
            name: 'objectives',
            type: 'array',
            description: 'מטרות השיעור',
            required: false
        }
    },

    triggers: {
        keywords: [
            'מערך שיעור', 'תכנית שיעור', 'תכנון שיעור',
            'מערך למורה', 'תל"א'
        ],
        contexts: ['content_creation', 'static_mode']
    },

    examples: [
        {
            userMessage: 'צור מערך שיעור להדפסה על שברים',
            expectedParams: { topic: 'שברים' }
        }
    ],

    functionDeclaration: {
        name: 'generate_lesson_plan',
        description: 'יצירת מערך שיעור מודפס למורה',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string' },
                grade: { type: 'string' },
                duration: { type: 'number' },
                objectives: { type: 'array', items: { type: 'string' } }
            },
            required: ['topic']
        }
    },

    execution: {
        type: 'direct_api',
        apiEndpoint: 'generateStaticContent',
        apiMethod: 'POST'
    },

    ui: {
        icon: 'IconFileTypeDoc',
        color: 'blue',
        showInMenu: true,
        menuOrder: 11
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['lesson_plan', 'printable', 'teacher', 'planning']
};

const generateLetter: Capability = {
    id: 'generate_letter',
    version: '1.0.0',
    name: 'כתיבת מכתב להורים',
    description: 'יצירת מכתב מקצועי להורים - עדכונים, הודעות, בקשות, או סיכומים.',
    shortDescription: 'מכתב מעוצב להורים',
    category: 'static_content',
    complexity: 'simple',
    executionType: 'prompt_based',

    parameters: {
        subject: {
            name: 'subject',
            type: 'string',
            description: 'נושא המכתב',
            required: true
        },
        letterType: {
            name: 'letterType',
            type: 'enum',
            description: 'סוג המכתב',
            required: false,
            enumValues: ['update', 'request', 'invitation', 'summary', 'concern', 'praise']
        },
        tone: {
            name: 'tone',
            type: 'enum',
            description: 'טון המכתב',
            required: false,
            defaultValue: 'professional',
            enumValues: ['professional', 'warm', 'formal', 'casual']
        }
    },

    triggers: {
        keywords: [
            'מכתב', 'מכתב להורים', 'הודעה להורים',
            'עדכון להורים', 'מכתב רשמי'
        ]
    },

    examples: [
        {
            userMessage: 'כתוב מכתב להורים על טיול שנתי',
            expectedParams: { subject: 'טיול שנתי', letterType: 'update' }
        }
    ],

    functionDeclaration: {
        name: 'generate_letter',
        description: 'כתיבת מכתב מקצועי להורים',
        parameters: {
            type: 'object',
            properties: {
                subject: { type: 'string' },
                letterType: { type: 'string', enum: ['update', 'request', 'invitation', 'summary', 'concern', 'praise'] },
                tone: { type: 'string', enum: ['professional', 'warm', 'formal', 'casual'] }
            },
            required: ['subject']
        }
    },

    execution: {
        type: 'direct_api',
        apiEndpoint: 'generateStaticContent',
        apiMethod: 'POST'
    },

    ui: {
        icon: 'IconMail',
        color: 'purple',
        showInMenu: true,
        menuOrder: 12
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['letter', 'parents', 'communication']
};

const generateFeedback: Capability = {
    id: 'generate_feedback',
    version: '1.0.0',
    name: 'כתיבת משוב לתלמיד',
    description: 'יצירת משוב מקצועי ומותאם אישית לתלמיד - הערכה, נקודות חוזק, והמלצות לשיפור.',
    shortDescription: 'משוב מותאם אישית',
    category: 'static_content',
    complexity: 'simple',
    executionType: 'prompt_based',

    parameters: {
        studentName: {
            name: 'studentName',
            type: 'string',
            description: 'שם התלמיד',
            required: false
        },
        context: {
            name: 'context',
            type: 'string',
            description: 'הקשר המשוב (עבודה, מבחן, התנהגות)',
            required: true
        },
        strengths: {
            name: 'strengths',
            type: 'array',
            description: 'נקודות חוזק לציין',
            required: false
        },
        improvements: {
            name: 'improvements',
            type: 'array',
            description: 'נקודות לשיפור',
            required: false
        },
        tone: {
            name: 'tone',
            type: 'enum',
            description: 'טון המשוב',
            required: false,
            defaultValue: 'encouraging',
            enumValues: ['encouraging', 'constructive', 'formal']
        }
    },

    triggers: {
        keywords: [
            'משוב', 'משוב לתלמיד', 'הערכה', 'הערות',
            'פידבק', 'חוות דעת'
        ]
    },

    examples: [
        {
            userMessage: 'כתוב משוב על עבודה בהיסטוריה',
            expectedParams: { context: 'עבודה בהיסטוריה' }
        }
    ],

    functionDeclaration: {
        name: 'generate_feedback',
        description: 'כתיבת משוב לתלמיד',
        parameters: {
            type: 'object',
            properties: {
                studentName: { type: 'string' },
                context: { type: 'string' },
                strengths: { type: 'array', items: { type: 'string' } },
                improvements: { type: 'array', items: { type: 'string' } },
                tone: { type: 'string', enum: ['encouraging', 'constructive', 'formal'] }
            },
            required: ['context']
        }
    },

    execution: {
        type: 'direct_api',
        apiEndpoint: 'generateStaticContent',
        apiMethod: 'POST'
    },

    ui: {
        icon: 'IconMessage',
        color: 'teal',
        showInMenu: true,
        menuOrder: 13
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['feedback', 'student', 'assessment']
};

const generateRubric: Capability = {
    id: 'generate_rubric',
    version: '1.0.0',
    name: 'יצירת רובריקה/מחוון',
    description: 'יצירת מחוון הערכה מפורט עם קריטריונים, רמות ביצוע, ותיאורים.',
    shortDescription: 'מחוון להערכה',
    category: 'static_content',
    complexity: 'medium',
    executionType: 'prompt_based',

    parameters: {
        assignmentType: {
            name: 'assignmentType',
            type: 'string',
            description: 'סוג המשימה להערכה',
            required: true
        },
        criteria: {
            name: 'criteria',
            type: 'array',
            description: 'קריטריונים להערכה',
            required: false
        },
        levels: {
            name: 'levels',
            type: 'number',
            description: 'מספר רמות ביצוע',
            required: false,
            defaultValue: 4
        }
    },

    triggers: {
        keywords: [
            'רובריקה', 'מחוון', 'קריטריונים', 'הערכה',
            'ציון', 'מבחנה'
        ]
    },

    examples: [
        {
            userMessage: 'צור מחוון להערכת מצגת',
            expectedParams: { assignmentType: 'מצגת' }
        }
    ],

    functionDeclaration: {
        name: 'generate_rubric',
        description: 'יצירת רובריקה/מחוון הערכה',
        parameters: {
            type: 'object',
            properties: {
                assignmentType: { type: 'string' },
                criteria: { type: 'array', items: { type: 'string' } },
                levels: { type: 'number' }
            },
            required: ['assignmentType']
        }
    },

    execution: {
        type: 'direct_api',
        apiEndpoint: 'generateStaticContent',
        apiMethod: 'POST'
    },

    ui: {
        icon: 'IconTable',
        color: 'cyan',
        showInMenu: true,
        menuOrder: 14
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['rubric', 'assessment', 'criteria', 'grading']
};

const generatePrintableTest: Capability = {
    id: 'generate_printable_test',
    version: '1.0.0',
    name: 'יצירת מבחן להדפסה',
    description: 'יצירת מבחן מעוצב להדפסה עם שאלות, מקום לתשובות, ומפתח תשובות למורה.',
    shortDescription: 'מבחן PDF להדפסה',
    category: 'static_content',
    complexity: 'medium',
    executionType: 'prompt_based',

    parameters: {
        topic: {
            name: 'topic',
            type: 'string',
            description: 'נושא המבחן',
            required: true
        },
        grade: {
            name: 'grade',
            type: 'string',
            description: 'כיתה',
            required: false
        },
        questionCount: {
            name: 'questionCount',
            type: 'number',
            description: 'מספר שאלות',
            required: false,
            defaultValue: 20
        },
        duration: {
            name: 'duration',
            type: 'number',
            description: 'זמן בדקות',
            required: false,
            defaultValue: 45
        }
    },

    triggers: {
        keywords: [
            'מבחן להדפסה', 'מבחן מודפס', 'מבחן PDF',
            'בוחן להדפסה', 'מבחן על נייר'
        ]
    },

    examples: [
        {
            userMessage: 'צור מבחן להדפסה על מלחמת העולם הראשונה',
            expectedParams: { topic: 'מלחמת העולם הראשונה' }
        }
    ],

    functionDeclaration: {
        name: 'generate_printable_test',
        description: 'יצירת מבחן מודפס',
        parameters: {
            type: 'object',
            properties: {
                topic: { type: 'string' },
                grade: { type: 'string' },
                questionCount: { type: 'number' },
                duration: { type: 'number' }
            },
            required: ['topic']
        }
    },

    execution: {
        type: 'direct_api',
        apiEndpoint: 'generateStaticContent',
        apiMethod: 'POST'
    },

    ui: {
        icon: 'IconPrinter',
        color: 'gray',
        showInMenu: true,
        menuOrder: 15
    },

    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['test', 'printable', 'assessment', 'pdf']
};

// ========== Export All Capabilities ==========
// Note: Search capabilities (searchCurriculumStandards, searchExistingContent) were removed
// because they had no backend implementation and could cause AI hallucinations.
// Total: 10 capabilities (4 interactive + 6 static)

export const SEED_CAPABILITIES: Capability[] = [
    // Interactive Content (4)
    createInteractiveLesson,
    createInteractiveActivity,
    createInteractiveExam,
    createMicroActivity,
    // Static Content (6)
    generateWorksheet,
    generateLessonPlan,
    generateLetter,
    generateFeedback,
    generateRubric,
    generatePrintableTest
];

/**
 * Function to seed capabilities to Firestore
 */
export async function seedCapabilitiesToFirestore(
    firestore: FirebaseFirestore.Firestore
): Promise<{ success: boolean; count: number; errors: string[] }> {
    const errors: string[] = [];
    let successCount = 0;

    const batch = firestore.batch();

    for (const capability of SEED_CAPABILITIES) {
        try {
            const docRef = firestore.collection('capabilities').doc(capability.id);
            batch.set(docRef, {
                ...capability,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            successCount++;
        } catch (error: any) {
            errors.push(`Failed to add ${capability.id}: ${error.message}`);
        }
    }

    try {
        await batch.commit();
        console.log(`✅ Seeded ${successCount} capabilities to Firestore`);
    } catch (error: any) {
        errors.push(`Batch commit failed: ${error.message}`);
    }

    return {
        success: errors.length === 0,
        count: successCount,
        errors
    };
}
