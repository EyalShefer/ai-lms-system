import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    IconBrain, IconArrowBack, IconSparkles,
    IconCheck, IconX, IconBook, IconWand, IconCloudUpload, IconVideo,
    IconHeadphones, IconTarget, IconJoystick, IconLibrary, IconBalance,
    IconChevronDown, IconChevronUp
} from '../icons';
import { MultimodalService, TRANSCRIPTION_ERROR_CODES } from '../services/multimodalService';
import TextbookSelector from './TextbookSelector';
import type { TextbookSelection } from '../services/textbookService';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { activityTimer } from '../utils/monitoring';

// --- רשימות מיושרות עם הדשבורד ---
const GRADES = [
    "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
    "כיתה ז׳", "כיתה ח׳", "כיתה ט׳",
    "כיתה י׳", "כיתה י״א", "כיתה י״ב",
    "מכינה", "סטודנטים", "הכשרה מקצועית"
];

const SUBJECTS = [
    "חינוך לשוני (עברית)", "מתמטיקה", "אנגלית", "מדע וטכנולוגיה",
    "היסטוריה", "אזרחות", "תנ״ך", "ספרות", "גיאוגרפיה",
    "פיזיקה", "כימיה", "ביולוגיה", "מדעי המחשב", "הנדסת תוכנה", "רובוטיקה",
    "חינוך גופני", "חינוך פיננסי", "אמנות", "תקשורת", "פסיכולוגיה", "סוציולוגיה", "אחר"
];

type ProductType = 'lesson' | 'podcast' | 'exam' | 'activity' | null;

// === פרופילי סוגי שאלות ===
type QuestionProfile = 'balanced' | 'educational' | 'game' | 'custom';

interface QuestionTypeConfig {
    enabled: boolean;
    priority: number; // 1-3 (1 = גבוה)
}

interface QuestionPreferences {
    profile: QuestionProfile;
    customSettings?: Record<string, QuestionTypeConfig>;
}

const QUESTION_PROFILES: Record<QuestionProfile, {
    label: string;
    description: string;
    icon: 'balance' | 'book' | 'joystick' | 'wand';
    color: string;
    bgColor: string;
    borderColor: string;
    textColor: string;
    iconBg: string;
    iconText: string;
    allowedTypes: string[];
    priorityTypes: string[];
}> = {
    balanced: {
        label: 'מאוזן',
        description: 'שילוב מגוון של כל סוגי השאלות',
        icon: 'balance',
        color: 'blue',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-600',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600',
        allowedTypes: ['multiple_choice', 'true_false', 'fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'open_question', 'matching', 'highlight', 'sentence_builder', 'matrix', 'table_completion'],
        priorityTypes: ['multiple_choice', 'fill_in_blanks', 'categorization']
    },
    educational: {
        label: 'לימודי',
        description: 'שאלות מדידות עם משוב מפורט, ללא משחקים',
        icon: 'book',
        color: 'indigo',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-400',
        textColor: 'text-indigo-600',
        iconBg: 'bg-indigo-100',
        iconText: 'text-indigo-600',
        allowedTypes: ['multiple_choice', 'true_false', 'fill_in_blanks', 'ordering', 'categorization', 'open_question', 'matching', 'table_completion', 'text_selection', 'matrix', 'rating_scale', 'audio_response'],
        priorityTypes: ['multiple_choice', 'open_question', 'fill_in_blanks', 'ordering']
    },
    game: {
        label: 'משחקי',
        description: 'אינטראקטיבי וחוויתי, משחקי זיכרון ואתגרים',
        icon: 'joystick',
        color: 'cyan',
        bgColor: 'bg-cyan-50',
        borderColor: 'border-cyan-400',
        textColor: 'text-cyan-600',
        iconBg: 'bg-cyan-100',
        iconText: 'text-cyan-600',
        allowedTypes: ['memory_game', 'ordering', 'categorization', 'matching', 'sentence_builder', 'true_false', 'highlight', 'image_labeling'],
        priorityTypes: ['memory_game', 'categorization', 'matching', 'ordering']
    },
    custom: {
        label: 'מותאם אישית',
        description: 'בחירה ידנית של סוגי השאלות',
        icon: 'wand',
        color: 'violet',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-400',
        textColor: 'text-violet-600',
        iconBg: 'bg-violet-100',
        iconText: 'text-violet-600',
        allowedTypes: [], // מוגדר על ידי המשתמש
        priorityTypes: []
    }
};

// === טון/סגנון כתיבה ===
type ContentTone = 'friendly' | 'professional' | 'playful' | 'neutral';

const CONTENT_TONES: Record<ContentTone, {
    label: string;
    description: string;
    emoji: string;
}> = {
    friendly: {
        label: 'ידידותי',
        description: 'חם ומעודד, מתאים לרוב התלמידים',
        emoji: '😊'
    },
    professional: {
        label: 'מקצועי',
        description: 'עניני וממוקד, ללא הקדמות מיותרות',
        emoji: '📋'
    },
    playful: {
        label: 'משחקי',
        description: 'קליל ומהנה, עם הומור קל',
        emoji: '🎮'
    },
    neutral: {
        label: 'ניטרלי',
        description: 'פשוט וישיר, ללא סגנון מיוחד',
        emoji: '📝'
    }
};

const ALL_QUESTION_TYPES = [
    // בסיסי
    { id: 'multiple_choice', label: 'בחירה מרובה', category: 'basic' },
    { id: 'true_false', label: 'נכון/לא נכון', category: 'basic' },
    { id: 'fill_in_blanks', label: 'השלמת חסר', category: 'basic' },
    // לוגי
    { id: 'ordering', label: 'סידור בסדר', category: 'logic' },
    { id: 'categorization', label: 'מיון לקטגוריות', category: 'logic' },
    { id: 'matching', label: 'התאמה', category: 'logic' },
    { id: 'matrix', label: 'מטריצה / טבלת התאמה', category: 'logic' },
    // משחקי
    { id: 'memory_game', label: 'משחק זיכרון', category: 'game' },
    // מתקדם
    { id: 'open_question', label: 'שאלה פתוחה', category: 'advanced' },
    { id: 'sentence_builder', label: 'בניית משפט', category: 'advanced' },
    { id: 'highlight', label: 'סימון בטקסט', category: 'advanced' },
    { id: 'table_completion', label: 'השלמת טבלה', category: 'advanced' },
    { id: 'text_selection', label: 'בחירת טקסט', category: 'advanced' },
    // מולטימדיה ומיוחד
    { id: 'audio_response', label: 'תשובה קולית', category: 'multimedia' },
    { id: 'image_labeling', label: 'תיוג תמונה', category: 'multimedia' },
    { id: 'rating_scale', label: 'סולם דירוג', category: 'special' }
];

const PRODUCT_CONFIG: Record<string, {
    titleLabel: string;
    lengthLabel: string;
    headerLabel: string;
    defaultTitleName: string;
    lengthOptions: { id: string; label: string }[];
}> = {
    lesson: {
        titleLabel: "כותרת השיעור",
        lengthLabel: "היקף השיעור",
        headerLabel: "יצירת מערך שיעור",
        defaultTitleName: "שיעור חדש",
        lengthOptions: [
            { id: 'short', label: 'קצר (ממוקד)' },
            { id: 'medium', label: 'בינוני (סטנדרטי)' },
            { id: 'long', label: 'ארוך (מקיף)' }
        ]
    },
    exam: {
        titleLabel: "כותרת המבחן",
        lengthLabel: "היקף המבחן",
        headerLabel: "יצירת מבחן",
        defaultTitleName: "מבחן חדש",
        lengthOptions: [
            { id: 'short', label: 'קצר' },
            { id: 'medium', label: 'בינוני' },
            { id: 'long', label: 'ארוך' }
        ]
    },
    activity: {
        titleLabel: "כותרת הפעילות",
        lengthLabel: "משך הפעילות",
        headerLabel: "יצירת פעילות לתלמיד",
        defaultTitleName: "פעילות חדשה",
        lengthOptions: [
            { id: 'short', label: 'קצרה' },
            { id: 'medium', label: 'בינונית' },
            { id: 'long', label: 'ארוכה' }
        ]
    },
    podcast: {
        titleLabel: "כותרת הפודקאסט",
        lengthLabel: "משך הפרק",
        headerLabel: "יצירת פודקאסט",
        defaultTitleName: "פודקאסט חדש",
        lengthOptions: [
            { id: 'short', label: 'קצר' },
            { id: 'medium', label: 'בינוני' },
            { id: 'long', label: 'ארוך' }
        ]
    }
};

const DEFAULT_CONFIG = {
    titleLabel: "כותרת הפעילות",
    lengthLabel: "אורך הפעילות",
    headerLabel: "יצירת פעילות חדשה",
    defaultTitleName: "פעילות חדשה",
    lengthOptions: [
        { id: 'short', label: 'קצרה' },
        { id: 'medium', label: 'בינונית' },
        { id: 'long', label: 'ארוכה' }
    ]
};

// Chat context type for pre-filling wizard from bot conversation
interface ChatContext {
    topic?: string;
    grade?: string;
    subject?: string;
    productType?: 'lesson' | 'podcast' | 'exam' | 'activity' | 'micro';
    activityLength?: 'short' | 'medium' | 'long';
    profile?: 'balanced' | 'educational' | 'game' | 'custom';
    difficultyLevel?: string;
    conversationSummary?: string;
}

interface IngestionWizardProps {
    onComplete: (data: any) => void;
    onCancel: () => void;
    initialTopic?: string;
    initialMode?: 'learning' | 'exam';
    initialProduct?: 'lesson' | 'podcast' | 'exam' | 'activity';
    title?: string;
    cancelLabel?: string;
    cancelIcon?: React.ReactNode;
    chatContext?: ChatContext;
}

// --- UI Components ---
const StepIndicator = ({ num, label, isActive, isCompleted }: any) => (
    <div className={`flex flex-col items-center gap-2 relative z-10 ${isActive ? 'scale-110' : 'opacity-80'}`}>
        <div className={`
            w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-lg transition-all duration-300
            ${isActive ? 'bg-white text-wizdi-royal shadow-lg ring-4 ring-blue-500/20' :
                isCompleted ? 'bg-wizdi-lime text-wizdi-royal' : 'bg-blue-800/50 text-white border-2 border-blue-400/30'}
        `}>
            {isCompleted ? <IconCheck className="w-5 h-5 md:w-6 md:h-6" /> : num}
        </div>
        <span className={`text-xs md:text-sm font-medium hidden md:block ${isActive ? 'text-white' : 'text-blue-200'}`}>
            {label}
        </span>
    </div>
);

const StepLine = ({ isCompleted }: any) => (
    <div className={`
        h-1 flex-1 mx-2 rounded-full transition-all duration-500 relative top-[-14px]
        ${isCompleted ? 'bg-wizdi-lime' : 'bg-blue-800/30'}
    `} />
);

// --- Improved Styling Maps (to ensure Tailwind JIT picks them up) ---
const THEMES: Record<string, any> = {
    blue: {
        active: "border-blue-500 bg-blue-50 ring-blue-200",
        hover: "hover:border-blue-400",
        iconActive: "bg-blue-100 text-blue-600",
        iconHover: "group-hover:bg-blue-50 group-hover:text-blue-600",
        check: "text-blue-500"
    },
    green: {
        active: "border-green-500 bg-green-50 ring-green-200",
        hover: "hover:border-green-400",
        iconActive: "bg-green-100 text-green-600",
        iconHover: "group-hover:bg-green-50 group-hover:text-green-600",
        check: "text-green-500"
    },
    red: {
        active: "border-red-500 bg-red-50 ring-red-200",
        hover: "hover:border-red-400",
        iconActive: "bg-red-100 text-red-600",
        iconHover: "group-hover:bg-red-50 group-hover:text-red-600",
        check: "text-red-500"
    },
    purple: {
        active: "border-purple-500 bg-purple-50 ring-purple-200",
        hover: "hover:border-purple-400",
        iconActive: "bg-purple-100 text-purple-600",
        iconHover: "group-hover:bg-purple-50 group-hover:text-purple-600",
        check: "text-purple-500"
    },
    orange: {
        active: "border-orange-500 bg-orange-50 ring-orange-200",
        hover: "hover:border-orange-400",
        iconActive: "bg-orange-100 text-orange-600",
        iconHover: "group-hover:bg-orange-50 group-hover:text-orange-600",
        check: "text-orange-500"
    },
    indigo: {
        active: "border-indigo-500 bg-indigo-50 ring-indigo-200",
        hover: "hover:border-indigo-400",
        iconActive: "bg-indigo-100 text-indigo-600",
        iconHover: "group-hover:bg-indigo-50 group-hover:text-indigo-600",
        check: "text-indigo-500"
    },
    pink: {
        active: "border-pink-500 bg-pink-50 ring-pink-200",
        hover: "hover:border-pink-400",
        iconActive: "bg-pink-100 text-pink-600",
        iconHover: "group-hover:bg-pink-50 group-hover:text-pink-600",
        check: "text-pink-500"
    }
};

const SourceCard = ({ label, icon: Icon, color, isActive, onClick, innerRef, children, disabled, ...props }: any) => {
    const theme = THEMES[color] || THEMES['blue'];
    return (
        <div
            ref={innerRef}
            {...props}
            onClick={disabled ? undefined : onClick}
            className={`
                group relative p-6 rounded-2xl border transition-all duration-200 overflow-hidden
                flex flex-col items-center text-center gap-4 h-full
                ${disabled
                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                    : isActive
                        ? `${theme.active} shadow-md ring-1 cursor-pointer`
                        : `border-slate-200 bg-white ${theme.hover} hover:shadow-lg hover:-translate-y-1 cursor-pointer`
                }
            `}
        >
            <div className={`
                w-16 h-16 rounded-full flex items-center justify-center transition-transform ${disabled ? '' : 'group-hover:scale-110'}
                ${isActive ? theme.iconActive : `bg-slate-50 text-slate-500 ${disabled ? '' : theme.iconHover}`}
            `}>
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <h4 className={`text-lg font-bold mb-1 ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{label}</h4>
                <div className="text-sm text-slate-500">{children}</div>
            </div>
            {isActive && <div className={`absolute top-3 right-3 ${theme.check}`}><IconCheck className="w-5 h-5" /></div>}
            {disabled && (
                <div className="absolute top-4 left-4 bg-slate-400 text-white px-2 py-1 rounded-full text-xs font-bold">
                    בקרוב
                </div>
            )}
        </div>
    );
};

const ProductCard = ({ label, icon: Icon, color, desc, isActive, onClick, disabled }: any) => {
    // const theme = THEMES[color] || THEMES['blue'];
    return (
        <div
            onClick={disabled ? undefined : onClick}
            className={`
                relative p-6 rounded-2xl border transition-all duration-200
                flex flex-col items-center text-center h-full
                ${disabled
                    ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                    : isActive
                        ? 'border-wizdi-royal bg-blue-50/50 shadow-lg ring-2 ring-wizdi-royal cursor-pointer'
                        : `border-slate-200 bg-white hover:border-blue-300 hover:shadow-md cursor-pointer`
                }
            `}
        >
            <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform
                ${isActive ? `bg-white shadow-sm text-${color}-600` : `bg-${color}-50 text-${color}-600`}
            `}>
                <Icon className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">{label}</h4>
            <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>

            {isActive && (
                <div className="absolute top-4 right-4 bg-wizdi-royal text-white p-1 rounded-full shadow-sm animate-pop">
                    <IconCheck className="w-4 h-4" />
                </div>
            )}
            {disabled && (
                <div className="absolute top-4 left-4 bg-slate-400 text-white px-2 py-1 rounded-full text-xs font-bold">
                    בקרוב
                </div>
            )}
        </div>
    );
};


const IngestionWizard: React.FC<IngestionWizardProps> = ({
    onComplete,
    onCancel,
    initialTopic,
    initialMode = 'learning',
    initialProduct,
    chatContext,
    //  cancelLabel = "חזרה",
    //  cancelIcon = <IconArrowBack className="w-4 h-4 rotate-180" />
}) => {
    // Log chatContext for debugging
    if (chatContext) {
        console.log('🧙 [IngestionWizard] Received chatContext:', chatContext);
    }

    // Helper to find grade from chatContext (e.g., 'ו' -> 'כיתה ו׳')
    const findGradeFromContext = (gradeHint?: string): string => {
        if (!gradeHint) return GRADES[6];
        // Try to find a matching grade
        const normalized = gradeHint.trim();
        const found = GRADES.find(g =>
            g.includes(normalized) ||
            g.replace(/[׳״\'\"]/g, '').includes(normalized.replace(/[׳״\'\"]/g, ''))
        );
        return found || GRADES[6];
    };

    // --- State ---
    const [step, setStep] = useState(1); // 1: Source, 2: Product, 3: Settings
    const [isProcessing, setIsProcessing] = useState(false);

    // Step 1: Source - auto-select 'topic' mode if chatContext has topic
    const [mode, setMode] = useState<'upload' | 'topic' | 'text' | 'multimodal' | 'textbook' | null>(
        chatContext?.topic ? 'topic' : null
    );
    const [topic, setTopic] = useState(chatContext?.topic || '');
    const [file, setFile] = useState<File | null>(null);
    const [pastedText, setPastedText] = useState('');
    const [textbookSelection, setTextbookSelection] = useState<TextbookSelection | null>(null);
    // const [subMode, setSubMode] = useState<'youtube' | 'audio' | null>(null);

    // Step 2: Product - use chatContext.productType or initialProduct if provided
    const [selectedProduct, setSelectedProduct] = useState<ProductType>(
        (chatContext?.productType === 'micro' ? 'activity' : chatContext?.productType) || initialProduct || null
    );

    // Step 3: Settings - pre-fill from chatContext if available
    const [customTitle, setCustomTitle] = useState(chatContext?.topic || '');
    const [grade, setGrade] = useState(findGradeFromContext(chatContext?.grade));
    const [subject, setSubject] = useState(chatContext?.subject || 'חינוך לשוני (עברית)');
    const [activityLength, setActivityLength] = useState<'short' | 'medium' | 'long'>(chatContext?.activityLength || 'medium');
    const [taxonomy, setTaxonomy] = useState<{ knowledge: number; application: number; evaluation: number }>({ knowledge: 30, application: 50, evaluation: 20 });
    const [includeBot] = useState(false); // Restore includeBot state
    const [botPersona] = useState('socratic');
    const [courseMode, setCourseMode] = useState<'learning' | 'exam'>(initialMode);
    // const [showSourceToStudent, setShowSourceToStudent] = useState(true);

    // בחירת טון/סגנון כתיבה
    const [contentTone, setContentTone] = useState<'friendly' | 'professional' | 'playful' | 'neutral'>('friendly');

    // הגדרות מתקדמות לסוגי שאלות - נפרד לכל סוג מוצר
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [questionProfile, setQuestionProfile] = useState<QuestionProfile>('balanced');
    const [customQuestionTypes, setCustomQuestionTypes] = useState<string[]>(
        ALL_QUESTION_TYPES.map(t => t.id) // ברירת מחדל: הכל מופעל
    );
    const [savedProfileLoaded, setSavedProfileLoaded] = useState(false); // האם נטען פרופיל שמור
    const [allProductPreferences, setAllProductPreferences] = useState<Record<string, {
        profile: QuestionProfile;
        customTypes: string[];
    }>>({});

    // ברירות מחדל מומלצות לפי סוג מוצר
    const DEFAULT_PROFILES_BY_PRODUCT: Record<string, QuestionProfile> = {
        lesson: 'balanced',
        activity: 'game',
        exam: 'educational'
    };

    // Auto-advance steps if chatContext provides enough data
    useEffect(() => {
        if (!chatContext) return;

        // If we have topic and productType, go to step 3 (settings)
        if (chatContext.topic && chatContext.productType) {
            console.log('🧙 [IngestionWizard] Auto-advancing to step 3 (settings) from chatContext');
            setStep(3);
        }
        // If we have topic but no productType, go to step 2 (product selection)
        else if (chatContext.topic) {
            console.log('🧙 [IngestionWizard] Auto-advancing to step 2 (product) from chatContext');
            setStep(2);
        }
    }, []); // Run once on mount

    // טעינת העדפות המורה מ-Firestore - לכל סוגי המוצרים
    useEffect(() => {
        const loadTeacherPreferences = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const prefDoc = await getDoc(doc(db, 'teacher_preferences', user.uid));
                if (prefDoc.exists()) {
                    const data = prefDoc.data();

                    // טעינת העדפות לפי סוג מוצר (מבנה חדש)
                    if (data.productPreferences) {
                        setAllProductPreferences(data.productPreferences);
                        setSavedProfileLoaded(true);
                    }
                    // תמיכה לאחור במבנה הישן
                    else if (data.questionProfile) {
                        // אם יש רק פרופיל גלובלי ישן, נשתמש בו לכל המוצרים
                        const legacyPrefs: Record<string, { profile: QuestionProfile; customTypes: string[] }> = {};
                        ['lesson', 'activity', 'exam'].forEach(p => {
                            legacyPrefs[p] = {
                                profile: data.questionProfile,
                                customTypes: data.customQuestionTypes || ALL_QUESTION_TYPES.map(t => t.id)
                            };
                        });
                        setAllProductPreferences(legacyPrefs);
                        setSavedProfileLoaded(true);
                    }
                }
            } catch (err) {
                console.warn('Failed to load teacher preferences:', err);
            }
        };

        loadTeacherPreferences();
    }, []);

    // כשמשנים סוג מוצר, נטען את הפרופיל המתאים
    useEffect(() => {
        if (!selectedProduct || selectedProduct === 'podcast') return;

        const productPrefs = allProductPreferences[selectedProduct];
        if (productPrefs) {
            setQuestionProfile(productPrefs.profile);
            setCustomQuestionTypes(productPrefs.customTypes);
        } else {
            // ברירת מחדל לפי סוג מוצר
            setQuestionProfile(DEFAULT_PROFILES_BY_PRODUCT[selectedProduct] || 'balanced');
            setCustomQuestionTypes(ALL_QUESTION_TYPES.map(t => t.id));
        }
    }, [selectedProduct, allProductPreferences]);

    // שמירת העדפות המורה כשמשנה פרופיל - לפי סוג מוצר
    const saveTeacherPreferences = async (profile: QuestionProfile, customTypes: string[]) => {
        const user = auth.currentUser;
        if (!user || !selectedProduct || selectedProduct === 'podcast') return;

        try {
            // עדכון הסטייט המקומי
            const updatedPrefs = {
                ...allProductPreferences,
                [selectedProduct]: { profile, customTypes }
            };
            setAllProductPreferences(updatedPrefs);

            // שמירה ב-Firestore
            await setDoc(doc(db, 'teacher_preferences', user.uid), {
                productPreferences: updatedPrefs,
                updatedAt: new Date()
            }, { merge: true });
            setSavedProfileLoaded(true);
        } catch (err) {
            console.warn('Failed to save teacher preferences:', err);
        }
    };

    // עדכון פרופיל עם שמירה
    const handleProfileChange = (newProfile: QuestionProfile) => {
        setQuestionProfile(newProfile);
        saveTeacherPreferences(newProfile, customQuestionTypes);
    };

    // עדכון סוגי שאלות מותאמים אישית עם שמירה
    const handleCustomTypesChange = (newTypes: string[]) => {
        setCustomQuestionTypes(newTypes);
        if (questionProfile === 'custom') {
            saveTeacherPreferences(questionProfile, newTypes);
        }
    };

    // בדיקה האם נטען פרופיל שמור למוצר הנוכחי
    const isCurrentProductProfileSaved = selectedProduct &&
        selectedProduct !== 'podcast' &&
        allProductPreferences[selectedProduct] !== undefined;

    useEffect(() => {
        console.log("DEBUG: IngestionWizard MOUNTED");
        return () => { };
    }, []);

    const config = (selectedProduct && PRODUCT_CONFIG[selectedProduct]) || DEFAULT_CONFIG;

    // --- Effects ---
    useEffect(() => {
        if (initialTopic && initialTopic !== "טוען..." && initialTopic.trim() !== "") {
            setTopic(initialTopic);
            setCustomTitle(initialTopic);
            setMode('topic');
            // If topic is provided, maybe jump? For now, stay at step 1 or 2.
            // Let's create a flow: if topic exists, source is chosen, go to Product selection.
            setStep(2);
        }
    }, [initialTopic]);

    // Update course mode based on product selection
    useEffect(() => {
        if (selectedProduct === 'exam') {
            setCourseMode('exam');
            setTaxonomy({ knowledge: 20, application: 40, evaluation: 40 });
        } else if (selectedProduct === 'activity') {
            setCourseMode('learning');
            setTaxonomy({ knowledge: 20, application: 70, evaluation: 10 });
        } else {
            setCourseMode('learning');
            setTaxonomy({ knowledge: 30, application: 50, evaluation: 20 });
        }
    }, [selectedProduct]);

    const handleTaxonomyChange = (changedKey: keyof typeof taxonomy, newValue: number) => {
        const remainingSpace = 100 - newValue;
        const otherKeys = Object.keys(taxonomy).filter(k => k !== changedKey) as (keyof typeof taxonomy)[];
        const keyA = otherKeys[0];
        const keyB = otherKeys[1];
        const currentOthersTotal = taxonomy[keyA] + taxonomy[keyB];
        let newA, newB;
        if (currentOthersTotal === 0) { newA = remainingSpace / 2; newB = remainingSpace / 2; }
        else { const ratio = taxonomy[keyA] / currentOthersTotal; newA = Math.round(remainingSpace * ratio); newB = remainingSpace - newA; }
        setTaxonomy({ ...taxonomy, [changedKey]: newValue, [keyA]: newA, [keyB]: newB });
    };

    const { getRootProps, getInputProps, open } = useDropzone({
        accept: {
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt'],
            'audio/mpeg': ['.mp3', '.mpga'],
            'audio/wav': ['.wav'],
            'audio/m4a': ['.m4a'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
            'image/gif': ['.gif']
        },
        maxFiles: 1,
        maxSize: 10485760,
        noClick: true, // Manual click handling
        noKeyboard: true, // Manual keyboard handling
        onDropRejected: (rejectedFiles) => {
            const error = rejectedFiles[0]?.errors[0];
            if (error?.code === 'file-too-large') {
                alert("הקובץ גדול מדי (מקסימום 10MB).");
            } else {
                alert("שגיאה בהעלאת הקובץ.");
            }
        },
        onDrop: async (acceptedFiles) => {
            const f = acceptedFiles[0];
            if (!f) return;

            if (f.type.startsWith('audio/')) {
                setIsProcessing(true);
            }

            try {
                if (f.type.startsWith('audio/')) {
                    setMode('multimodal');
                    // setSubMode('audio');

                    const text = await MultimodalService.transcribeAudio(f);
                    if (text) {
                        setPastedText(text);
                        setTopic(f.name.replace(/\.[^/.]+$/, ""));
                    } else {
                        alert("תמלול הקובץ נכשל.");
                        // Reset to upload mode if failed? Or keep multimodal?
                    }
                } else if (f.type.startsWith('image/')) {
                    // Image file - will be analyzed by Vision API
                    setFile(f);
                    setMode('upload');
                    setTopic(f.name.replace(/\.[^/.]+$/, ""));
                    setPastedText('');
                } else {
                    // Standard file (PDF, TXT)
                    setFile(f);
                    setMode('upload');
                    // Explicitly clear other states if needed
                    setPastedText('');
                }
            } catch (error) {
                console.error("Upload error:", error);
                alert("אירעה שגיאה בטעינת הקובץ.");
                setFile(null); // Reset file on critical error
            } finally {
                setIsProcessing(false);
            }
        }
    });

    const canProceed = () => {
        if (step === 1) {
            return mode && (
                (mode === 'topic' && topic) ||
                (mode === 'upload' && file) ||
                (mode === 'text' && pastedText) ||
                (mode === 'multimodal' && pastedText) ||
                (mode === 'textbook' && textbookSelection && textbookSelection.selectedTocEntries.length > 0)
            );
        }
        if (step === 2) {
            return !!selectedProduct;
        }
        return true;
    };

    const updateTitleFromInput = () => {
        let suggestedTitle = customTitle;
        if (!suggestedTitle) {
            if (mode === 'upload' && file) {
                suggestedTitle = file.name.replace(/\.[^/.]+$/, "");
            } else if (mode === 'topic' && topic) {
                suggestedTitle = topic;
            } else if (mode === 'text' && pastedText) {
                suggestedTitle = topic || "פעילות טקסט חופשי";
            } else if (mode === 'textbook' && textbookSelection) {
                const chapters = textbookSelection.selectedTocEntries.map(e => e.title).join(', ');
                suggestedTitle = `${textbookSelection.textbookTitle} - ${chapters}`.substring(0, 100);
            }
        }
        setCustomTitle(suggestedTitle);
    };

    const handleNext = async (e?: React.MouseEvent) => {
        console.log("DEBUG: handleNext CALLED. Source:", e?.target, "Type:", e?.type);
        if (e && e.stopPropagation) e.stopPropagation();

        if (step === 1 && canProceed()) {
            updateTitleFromInput();
            // Skip step 2 if initialProduct was provided (user already chose product type)
            if (initialProduct) {
                setStep(3);
            } else {
                setStep(2);
            }
        } else if (step === 2 && canProceed()) {
            setStep(3);
        } else if (step === 3) {
            // ⏱️ Start activity creation timer
            activityTimer.startSession(selectedProduct || 'activity');
            activityTimer.startStep('Wizard: Preparing data');

            setIsProcessing(true);
            const finalData = {
                mode,
                file,
                pastedText,
                title: customTitle || topic || config.defaultTitleName,
                originalTopic: topic,
                // Textbook alignment data (when mode === 'textbook')
                textbookSelection: mode === 'textbook' ? textbookSelection : null,
                settings: {
                    subject: subject || "כללי",
                    grade: grade,
                    targetAudience: grade,
                    activityLength,
                    taxonomy,
                    includeBot,
                    botPersona: includeBot ? botPersona : null,

                    courseMode,
                    // showSourceToStudent,
                    productType: selectedProduct, // Pass the product type!
                    contentTone, // טון/סגנון הכתיבה
                    // הגדרות מתקדמות לסוגי שאלות
                    questionPreferences: {
                        profile: questionProfile,
                        allowedTypes: questionProfile === 'custom'
                            ? customQuestionTypes
                            : QUESTION_PROFILES[questionProfile].allowedTypes,
                        priorityTypes: questionProfile === 'custom'
                            ? customQuestionTypes.slice(0, 4)
                            : QUESTION_PROFILES[questionProfile].priorityTypes
                    }
                },
                targetAudience: grade
            };
            activityTimer.endStep();
            activityTimer.startStep('Wizard: Calling onComplete');
            if (onComplete) await onComplete(finalData);
            activityTimer.endStep();
        }
    };

    const handleBack = () => {
        if (step > 1) {
            // If going back to step 2 and current product is disabled, reset selection
            if (step === 3 && selectedProduct === 'lesson') {
                setSelectedProduct(null);
            }

            // Skip step 2 when going back if chatContext had productType or initialProduct was set
            // This mirrors the skip logic in handleNext
            if (step === 3 && (chatContext?.productType || initialProduct)) {
                setStep(1);
            } else {
                setStep(step - 1);
            }
        }
        else onCancel();
    };


    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-0 md:p-4 md:pt-8 animate-fade-in overflow-y-auto bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <div className="bg-slate-50 w-full max-w-5xl md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col h-full md:h-auto md:min-h-[600px] relative transition-all duration-500">

                {/* --- Header (Deep Royal) --- */}
                <div className="bg-wizdi-royal p-4 pt-6 pb-12 md:p-8 md:pt-10 md:pb-16 relative overflow-hidden shrink-0 shadow-lg">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-10 -translate-y-10 animate-pulse">
                        <IconWand className="w-64 h-64 text-white" />
                    </div>

                    <div className="relative z-10 flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                                <IconSparkles className="w-8 h-8 text-wizdi-lime animate-wiggle" />
                                {config.headerLabel}
                            </h2>
                            <p className="text-blue-100/80 font-medium text-lg">
                                {step === 1 && "בואו נתחיל! איך תרצו להזין את התוכן?"}
                                {step === 2 && "מה תרצו ליצור מהתוכן הזה?"}
                                {step === 3 && "כמעט סיימנו... דיוקים אחרונים."}
                            </p>
                        </div>
                        <button onClick={onCancel} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-md text-white">
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Stepper - show only 2 steps if productType was pre-selected */}
                    <div className="flex items-center justify-center max-w-2xl mx-auto relative z-10">
                        {(chatContext?.productType || initialProduct) ? (
                            <>
                                {/* 2-step flow: Source -> Settings (product already chosen) */}
                                <StepIndicator num="1" label="בחירת מקור" isActive={step === 1} isCompleted={step > 1} />
                                <StepLine isCompleted={step > 1} />
                                <StepIndicator num="2" label="הגדרות" isActive={step === 3} isCompleted={step > 3} />
                            </>
                        ) : (
                            <>
                                {/* 3-step flow: Source -> Product -> Settings */}
                                <StepIndicator num="1" label="בחירת מקור" isActive={step === 1} isCompleted={step > 1} />
                                <StepLine isCompleted={step > 1} />
                                <StepIndicator num="2" label="סוג תוצר" isActive={step === 2} isCompleted={step > 2} />
                                <StepLine isCompleted={step > 2} />
                                <StepIndicator num="3" label="הגדרות" isActive={step === 3} isCompleted={step > 3} />
                            </>
                        )}
                    </div>
                </div>

                {/* --- Main Content Area --- */}
                <div className="p-4 md:p-8 pb-24 md:pb-32 flex-1 overflow-y-auto custom-scrollbar -mt-6">

                    {/* Step 1: Input Selection */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 animate-slide-up">
                            {(() => {
                                const dropzoneProps = getRootProps();

                                // SAFE: We configured dropzone with noClick/noKeyboard, 
                                // so getRootProps won't contain conflicting handlers.
                                // We safely spread everything to ensure state management (onFocus/onBlur/onDrop) works for the Input.
                                const { ref, ...spreadProps } = dropzoneProps as any;

                                return (
                                    <SourceCard
                                        id="upload"
                                        label="העלאת קובץ"
                                        icon={IconCloudUpload}
                                        color="blue"
                                        isActive={mode === 'upload'}
                                        innerRef={ref}
                                        {...spreadProps}
                                        onClick={(e: any) => {
                                            e.stopPropagation();
                                            open();
                                        }}
                                    >
                                        {file ? <span className="text-wizdi-royal font-bold">{file.name}</span> : "PDF, TXT"}
                                        <input {...getInputProps()} />
                                    </SourceCard>
                                );
                            })()}

                            <SourceCard
                                id="text"
                                label="הדבקת טקסט"
                                icon={IconBook}
                                color="green"
                                isActive={mode === 'text'}
                                onClick={() => setMode('text')}
                            >
                                הדבקת מאמר או סיכום
                            </SourceCard>

                            <SourceCard
                                id="topic"
                                label="לפי נושא"
                                icon={IconBrain}
                                color="purple"
                                isActive={mode === 'topic'}
                                onClick={() => setMode('topic')}
                            >
                                מחולל AI חופשי
                            </SourceCard>

                            <SourceCard
                                id="multimodal"
                                label="יוטיוב / וידאו"
                                icon={IconVideo}
                                color="red"
                                isActive={mode === 'multimodal'}
                                onClick={() => setMode('multimodal')}
                            >
                                סרטון יוטיוב או קובץ וידאו
                            </SourceCard>

                            <SourceCard
                                id="textbook"
                                label="מספר הלימוד"
                                icon={IconLibrary}
                                color="indigo"
                                isActive={mode === 'textbook'}
                                onClick={() => setMode('textbook')}
                                disabled={true}
                            >
                                {textbookSelection
                                    ? <span className="text-indigo-600 font-bold">{textbookSelection.selectedTocEntries.length} פרקים נבחרו</span>
                                    : "בחירה מספר שהועלה"
                                }
                            </SourceCard>

                            {/* Additional Inputs based on selection */}
                            <div className="col-span-full mt-4">
                                {mode === 'text' && (
                                    <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <textarea
                                            value={pastedText}
                                            onChange={(e) => setPastedText(e.target.value)}
                                            className="w-full h-40 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none"
                                            placeholder="הדביקו כאן את הטקסט..."
                                            autoFocus
                                        />
                                        {/* Character count and limit warning */}
                                        <div className="flex justify-between items-center mt-2 text-sm">
                                            <span className={`font-medium ${pastedText.length > 15000 ? 'text-orange-600' : 'text-slate-400'}`}>
                                                {pastedText.length.toLocaleString()} תווים
                                                {pastedText.length > 15000 && (
                                                    <span className="text-orange-500 mr-2">
                                                        ⚠️ יחתך ל-15,000 תווים
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-slate-400">מקסימום: 15,000 תווים</span>
                                        </div>
                                    </div>
                                )}

                                {mode === 'topic' && (
                                    <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <input
                                            type="text"
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            className="w-full p-4 text-lg border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                            placeholder="על מה תרצו ליצור את הפעילות?"
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {mode === 'multimodal' && (
                                    <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="flex gap-2 mb-4">
                                            <input
                                                type="text"
                                                dir="ltr"
                                                className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-left"
                                                placeholder="https://www.youtube.com/..."
                                                id="youtube-input"
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        const url = e.currentTarget.value?.trim();
                                                        if (url && MultimodalService.validateYouTubeUrl(url)) {
                                                            setIsProcessing(true);
                                                            try {
                                                                const result = await MultimodalService.processYoutubeUrl(url);
                                                                if (result?.text) {
                                                                    setPastedText(result.text);
                                                                    setTopic("YouTube Video");
                                                                }
                                                            } catch (error: any) {
                                                                alert(MultimodalService.getErrorMessage(error));
                                                            } finally {
                                                                setIsProcessing(false);
                                                            }
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    const input = document.getElementById('youtube-input') as HTMLInputElement;
                                                    const url = input?.value?.trim();

                                                    if (!url) {
                                                        alert("אנא הזינו קישור ליוטיוב");
                                                        return;
                                                    }

                                                    if (!MultimodalService.validateYouTubeUrl(url)) {
                                                        alert("הקישור לא תקין. וודאו שזה קישור ליוטיוב (למשל: youtube.com/watch?v=... או youtu.be/...)");
                                                        return;
                                                    }

                                                    setIsProcessing(true);
                                                    try {
                                                        const result = await MultimodalService.processYoutubeUrl(url);
                                                        if (result?.text) {
                                                            setPastedText(result.text);
                                                            setTopic("YouTube Video");

                                                            // Show success message with metadata
                                                            if (result.metadata?.source === 'whisper') {
                                                                console.log("📢 Video was transcribed using speech-to-text (no captions found)");
                                                            }
                                                            if (result.metadata?.wasTranslated) {
                                                                console.log("📢 Content was automatically translated to Hebrew");
                                                            }
                                                        }
                                                    } catch (error: any) {
                                                        console.error("YouTube Error:", error);

                                                        // Get user-friendly error message
                                                        const userMessage = MultimodalService.getErrorMessage(error);
                                                        const errorCode = error?.code;

                                                        // Build helpful message based on error type
                                                        let helpTip = "";
                                                        if (errorCode === TRANSCRIPTION_ERROR_CODES.NO_CAPTIONS) {
                                                            helpTip = "\n\n💡 טיפ: לחצו על שלוש הנקודות (...) מתחת לסרטון ביוטיוב, בחרו 'הצג תמליל', העתיקו והדביקו בלשונית 'הדבקת טקסט'.";
                                                        } else if (errorCode === TRANSCRIPTION_ERROR_CODES.PRIVATE_VIDEO) {
                                                            helpTip = "\n\n💡 טיפ: נסו סרטון ציבורי אחר, או העתיקו את התמליל ידנית.";
                                                        } else if (errorCode === TRANSCRIPTION_ERROR_CODES.RATE_LIMITED) {
                                                            helpTip = "\n\n⏳ המתינו דקה ונסו שוב.";
                                                        } else if (MultimodalService.isRetryableError(error)) {
                                                            helpTip = "\n\n🔄 ניתן לנסות שוב.";
                                                        }

                                                        alert(userMessage + helpTip);
                                                    } finally {
                                                        setIsProcessing(false);
                                                    }
                                                }}
                                                disabled={isProcessing}
                                                className="bg-red-600 text-white px-4 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                            >
                                                {isProcessing ? 'מעבד...' : 'תמלל'}
                                            </button>
                                        </div>
                                        {pastedText && <div className="text-green-600 text-sm font-bold flex items-center gap-2 animate-bounce"><IconCheck className="w-4 h-4" /> התמלול התקבל בהצלחה ({pastedText.length} תווים)</div>}
                                    </div>
                                )}

                                {mode === 'textbook' && (
                                    <div className="animate-fade-in">
                                        <TextbookSelector
                                            onSelect={(selection) => {
                                                setTextbookSelection(selection);
                                                // Auto-set grade from textbook
                                                if (selection.grade) {
                                                    const gradeMap: Record<string, string> = {
                                                        'א': "כיתה א׳", 'ב': "כיתה ב׳", 'ג': "כיתה ג׳",
                                                        'ד': "כיתה ד׳", 'ה': "כיתה ה׳", 'ו': "כיתה ו׳",
                                                        'ז': "כיתה ז׳", 'ח': "כיתה ח׳", 'ט': "כיתה ט׳",
                                                        'י': "כיתה י׳", 'יא': "כיתה י״א", 'יב': "כיתה י״ב"
                                                    };
                                                    const mappedGrade = gradeMap[selection.grade];
                                                    if (mappedGrade) {
                                                        setGrade(mappedGrade);
                                                    }
                                                }
                                            }}
                                            onClear={() => {
                                                setMode(null);
                                                setTextbookSelection(null);
                                            }}
                                            selectedValue={textbookSelection}
                                            compact={false}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Product Selection */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
                            <ProductCard
                                id="lesson"
                                label="סוכני הוראה"
                                desc="בניית יחידת לימוד שלמה הכוללת פתיחה, הקניה, תרגול וסיכום."
                                icon={IconBook}
                                color="blue"
                                isActive={selectedProduct === 'lesson'}
                                onClick={() => setSelectedProduct('lesson')}
                                disabled={true}
                            />
                            <ProductCard
                                id="podcast"
                                label="פודקאסט AI"
                                desc="יצירת פרק אודיו המבוסס על התוכן, להאזנה ולמידה."
                                icon={IconHeadphones}
                                color="orange"
                                isActive={selectedProduct === 'podcast'}
                                onClick={() => setSelectedProduct('podcast')}
                            />
                            <ProductCard
                                id="exam"
                                label="מבחן / בוחן"
                                desc="שאלון הערכה מסכם לבדיקת ידע, עם ציונים ומשוב."
                                icon={IconTarget}
                                color="indigo"
                                isActive={selectedProduct === 'exam'}
                                onClick={() => setSelectedProduct('exam')}
                            />
                            <ProductCard
                                id="activity"
                                label="פעילות לתלמיד"
                                desc="פעילות אינטראקטיבית לתרגול וחזרה בצורה חוויתית."
                                icon={IconJoystick} // Using Joystick icon
                                color="pink"
                                isActive={selectedProduct === 'activity'}
                                onClick={() => setSelectedProduct('activity')}
                            />
                        </div>
                    )}

                    {/* Step 3: Settings (Old Step 2) */}
                    {step === 3 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up">
                            <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{config.titleLabel}</label>
                                    <input
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:border-wizdi-royal outline-none font-bold text-slate-800"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">תחום דעת</label>
                                        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white">
                                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">קהל יעד</label>
                                        <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white">
                                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{config.lengthLabel}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {config.lengthOptions.map(o => {
                                            const questionCount = o.id === 'short' ? 3 : (o.id === 'long' ? 7 : 5);
                                            return (
                                                <button key={o.id} onClick={() => setActivityLength(o.id as any)} className={`p-2 rounded-xl text-sm font-bold transition-all flex flex-col items-center ${activityLength === o.id ? 'bg-wizdi-royal text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                                    <span>{o.label}</span>
                                                    <span className={`text-xs font-normal ${activityLength === o.id ? 'text-blue-100' : 'text-slate-400'}`}>({questionCount} שאלות)</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* === הגדרות מתקדמות - סוגי שאלות === */}
                                {selectedProduct !== 'podcast' && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                                            className="flex items-center gap-2 text-sm text-slate-500 hover:text-wizdi-royal transition-colors w-full"
                                        >
                                            {showAdvancedSettings ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                                            <span className="font-medium">הגדרות מתקדמות</span>
                                            <span className="text-xs text-slate-400 mr-auto flex items-center gap-1">
                                                פרופיל: {QUESTION_PROFILES[questionProfile].label}
                                                {isCurrentProductProfileSaved && (
                                                    <span className="text-green-500">
                                                        (שמור ל{selectedProduct === 'lesson' ? 'שיעורים' : selectedProduct === 'activity' ? 'פעילויות' : 'מבחנים'})
                                                    </span>
                                                )}
                                            </span>
                                        </button>

                                        {showAdvancedSettings && (
                                            <div className="mt-4 animate-fade-in">
                                                <label className="block text-sm font-bold text-slate-700 mb-3">סגנון שאלות</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(Object.entries(QUESTION_PROFILES) as [QuestionProfile, typeof QUESTION_PROFILES['balanced']][]).map(([key, profile]) => {
                                                        const IconComponent = profile.icon === 'balance' ? IconBalance
                                                            : profile.icon === 'book' ? IconBook
                                                            : profile.icon === 'joystick' ? IconJoystick
                                                            : IconWand;

                                                        return (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => handleProfileChange(key)}
                                                                className={`
                                                                    p-3 rounded-xl border-2 transition-all text-right flex items-start gap-3
                                                                    ${questionProfile === key
                                                                        ? `${profile.borderColor} ${profile.bgColor} shadow-sm`
                                                                        : 'border-slate-100 bg-white hover:border-slate-200'}
                                                                `}
                                                            >
                                                                <div className={`
                                                                    p-2 rounded-lg shrink-0
                                                                    ${questionProfile === key ? `${profile.iconBg} ${profile.iconText}` : 'bg-slate-100 text-slate-400'}
                                                                `}>
                                                                    <IconComponent className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className={`font-bold text-sm ${questionProfile === key ? 'text-slate-800' : 'text-slate-600'}`}>
                                                                        {profile.label}
                                                                    </div>
                                                                    <div className="text-xs text-slate-400 leading-tight mt-0.5">
                                                                        {profile.description}
                                                                    </div>
                                                                </div>
                                                                {questionProfile === key && (
                                                                    <IconCheck className={`w-4 h-4 ${profile.textColor} shrink-0`} />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* בחירה מותאמת אישית */}
                                                {questionProfile === 'custom' && (
                                                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                        <label className="block text-sm font-medium text-slate-600 mb-3">בחר סוגי שאלות:</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {ALL_QUESTION_TYPES.map(qType => (
                                                                <label
                                                                    key={qType.id}
                                                                    className={`
                                                                        flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors
                                                                        ${customQuestionTypes.includes(qType.id)
                                                                            ? 'bg-violet-50 border border-violet-200'
                                                                            : 'bg-white border border-slate-100 hover:bg-slate-50'}
                                                                    `}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={customQuestionTypes.includes(qType.id)}
                                                                        onChange={(e) => {
                                                                            const newTypes = e.target.checked
                                                                                ? [...customQuestionTypes, qType.id]
                                                                                : customQuestionTypes.filter(t => t !== qType.id);
                                                                            handleCustomTypesChange(newTypes);
                                                                        }}
                                                                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                                                                    />
                                                                    <span className="text-sm text-slate-700">{qType.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        {customQuestionTypes.length === 0 && (
                                                            <p className="text-xs text-orange-500 mt-2">⚠️ בחר לפחות סוג שאלה אחד</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* === בחירת טון/סגנון כתיבה === */}
                                                <div className="mt-6 pt-4 border-t border-slate-100">
                                                    <label className="block text-sm font-bold text-slate-700 mb-3">טון הכתיבה</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {(Object.entries(CONTENT_TONES) as [ContentTone, typeof CONTENT_TONES['friendly']][]).map(([key, tone]) => (
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => setContentTone(key)}
                                                                className={`
                                                                    p-3 rounded-xl border-2 transition-all text-right flex items-center gap-3
                                                                    ${contentTone === key
                                                                        ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                                                                        : 'border-slate-100 bg-white hover:border-slate-200'}
                                                                `}
                                                            >
                                                                <span className="text-xl">{tone.emoji}</span>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className={`font-bold text-sm ${contentTone === key ? 'text-indigo-700' : 'text-slate-600'}`}>
                                                                        {tone.label}
                                                                    </div>
                                                                    <div className="text-xs text-slate-400 leading-tight">
                                                                        {tone.description}
                                                                    </div>
                                                                </div>
                                                                {contentTone === key && (
                                                                    <IconCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300">
                                {/* Hide pedagogical settings for podcast - not relevant */}
                                {selectedProduct === 'podcast' ? (
                                    <div className="text-center py-8">
                                        <IconHeadphones className="w-16 h-16 text-orange-400 mx-auto mb-4" />
                                        <h3 className="font-bold text-lg text-slate-700 mb-2">פודקאסט AI</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                                            הפודקאסט ייווצר עם שני מגישים - דן ונועה - בשיחה מעניינת ומותאמת לקהל היעד שבחרת.
                                            <br /><br />
                                            <span className="text-orange-600 font-medium">משך הפרק:</span> {activityLength === 'short' ? '~3 דקות' : activityLength === 'long' ? '~8 דקות' : '~5 דקות'}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                            <IconBrain className="w-5 h-5 text-wizdi-royal" />
                                            התאמה פדגוגית
                                        </h3>

                                        {/* SLIDERS */}
                                        <div>
                                            {(() => {
                                                // Calculate total questions based on activity length
                                                const totalQuestions = activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5);

                                                // Distribute questions ensuring sum equals total (using largest remainder method)
                                                const distributeQuestions = () => {
                                                    const categories = ['knowledge', 'application', 'evaluation'] as const;
                                                    const percents = categories.map(k => (taxonomy as any)[k] as number);
                                                    const totalPercent = percents.reduce((a, b) => a + b, 0);

                                                    // Calculate exact (fractional) counts
                                                    const exactCounts = percents.map(p => (p / totalPercent) * totalQuestions);
                                                    // Floor each value
                                                    const floored = exactCounts.map(Math.floor);
                                                    // Calculate remainders
                                                    const remainders = exactCounts.map((exact, i) => exact - floored[i]);
                                                    // How many more do we need to add?
                                                    let remaining = totalQuestions - floored.reduce((a, b) => a + b, 0);

                                                    // Create result starting from floored values
                                                    const result = [...floored];
                                                    // Sort indices by remainder (descending) and add 1 to each until we've distributed all
                                                    const sortedIndices = [0, 1, 2].sort((a, b) => remainders[b] - remainders[a]);
                                                    for (const idx of sortedIndices) {
                                                        if (remaining <= 0) break;
                                                        result[idx]++;
                                                        remaining--;
                                                    }

                                                    return { knowledge: result[0], application: result[1], evaluation: result[2] };
                                                };

                                                const questionCounts = distributeQuestions();

                                                return (
                                                    <>
                                                        <div className="flex items-center justify-between mb-4">
                                                            <span className="text-sm font-bold text-slate-500">או התאמה ידנית:</span>
                                                            <span className="text-xs text-slate-400">סה״כ {totalQuestions} שאלות</span>
                                                        </div>
                                                        {[
                                                            { k: 'knowledge', l: 'ידע והבנה', c: 'green' },
                                                            { k: 'application', l: 'יישום וניתוח', c: 'blue' },
                                                            { k: 'evaluation', l: 'הערכה ויצירה', c: 'purple' }
                                                        ].map((t: any) => {
                                                            const questionCount = questionCounts[t.k as keyof typeof questionCounts];
                                                            return (
                                                                <div key={t.k} className="mb-4">
                                                                    <div className="flex justify-between text-sm mb-1 px-1">
                                                                        <span className="font-medium text-slate-600">{t.l}</span>
                                                                        <span className="font-bold text-wizdi-royal">
                                                                            {questionCount} {questionCount === 1 ? 'שאלה' : 'שאלות'}
                                                                        </span>
                                                                    </div>
                                                                    <input
                                                                        type="range"
                                                                        value={(taxonomy as any)[t.k]}
                                                                        onChange={(e) => handleTaxonomyChange(t.k, parseInt(e.target.value))}
                                                                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-wizdi-royal"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- Footer (Actions) --- */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-white border-t border-slate-100 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <button onClick={handleBack} className="text-slate-400 hover:text-wizdi-royal font-bold px-2 md:px-4 transition-colors flex items-center gap-2 text-sm md:text-base">
                        <IconArrowBack className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
                        חזרה
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed() || isProcessing}
                        className={`
                            btn-lip-action px-6 md:px-12 py-3 md:py-4 text-lg md:text-xl flex items-center gap-2 md:gap-3 shadow-xl w-full md:w-auto justify-center ml-2
                            ${(!canProceed() || isProcessing) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
                        `}
                    >
                        {isProcessing ? (
                            <span className="animate-pulse text-sm md:text-base">מעבד...</span>
                        ) : (
                            <>
                                {step === 3 ? 'סיום ויצירה' : 'המשך'}
                                <IconArrowBack className="w-5 h-5 md:w-6 md:h-6" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;