/**
 * Capability Types - Agent Knowledge System
 *
 * מערכת הידע של הסוכן - מאפשרת לסוכן לדעת את כל היכולות של המערכת
 * ולבצע אותן דינמית באמצעות Function Calling
 */

// ========== Core Types ==========

/**
 * סוג היכולת - קובע את הפורמט ואיך מבצעים
 */
export type CapabilityCategory =
    | 'interactive_content'  // תוכן אינטראקטיבי במערכת (lesson, activity, exam)
    | 'static_content'       // תוכן סטטי להדפסה (worksheet, letter, rubric)
    | 'curriculum'           // פעולות תוכ"ל
    | 'media'               // יצירת מדיה (תמונות, אודיו)
    | 'search'              // חיפוש תכנים
    | 'analytics'           // ניתוח נתונים
    | 'utility';            // כלים עזר

/**
 * רמת מורכבות - קובע כמה context לטעון
 */
export type ComplexityLevel = 'simple' | 'medium' | 'complex';

/**
 * סוג הביצוע
 */
export type ExecutionType =
    | 'wizard'           // מפעיל wizard קיים
    | 'direct_api'       // קריאת API ישירה
    | 'prompt_based'     // יצירה מבוססת פרומפט
    | 'hybrid';          // שילוב של הנ"ל

/**
 * פרמטר של יכולת
 */
export interface CapabilityParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
    description: string;           // תיאור בעברית
    required: boolean;
    defaultValue?: any;
    enumValues?: string[];         // אם type === 'enum'
    validationRules?: {
        minLength?: number;
        maxLength?: number;
        min?: number;
        max?: number;
        pattern?: string;
    };
    // For nested objects
    properties?: Record<string, CapabilityParameter>;
}

/**
 * דוגמה לשימוש ביכולת - עוזר ל-AI להבין מתי להשתמש
 */
export interface CapabilityExample {
    userMessage: string;          // מה המשתמש אמר
    expectedParams: Record<string, any>;  // הפרמטרים שצריך לחלץ
    explanation?: string;         // הסבר למה זו הבחירה הנכונה
}

/**
 * טריגרים שמפעילים את היכולת
 */
export interface CapabilityTriggers {
    keywords: string[];           // מילות מפתח (בעברית)
    patterns?: string[];          // regex patterns
    contexts?: string[];          // הקשרים שמפעילים (e.g., "after_topic_collected")
    exclusions?: string[];        // מילים שמונעות הפעלה
}

/**
 * הגדרת Function Declaration ל-Gemini
 */
export interface GeminiFunctionDeclaration {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
}

/**
 * היכולת המלאה - מאוחסנת ב-Firestore
 */
export interface Capability {
    // ========== מזהים ==========
    id: string;                   // e.g., "create_interactive_lesson"
    version: string;              // e.g., "1.0.0"

    // ========== מטאדאטה ==========
    name: string;                 // שם בעברית: "יצירת שיעור אינטראקטיבי"
    description: string;          // תיאור מלא בעברית
    shortDescription: string;     // תיאור קצר לתצוגה ב-RAG
    category: CapabilityCategory;
    complexity: ComplexityLevel;
    executionType: ExecutionType;

    // ========== פרמטרים ==========
    parameters: Record<string, CapabilityParameter>;

    // ========== טריגרים ==========
    triggers: CapabilityTriggers;

    // ========== דוגמאות ==========
    examples: CapabilityExample[];

    // ========== Function Calling ==========
    functionDeclaration: GeminiFunctionDeclaration;

    // ========== ביצוע ==========
    execution: {
        type: ExecutionType;
        // For wizard type
        wizardComponent?: string;     // e.g., "ContentCreationWizard"
        wizardMode?: string;          // e.g., "lesson"
        // For API type
        apiEndpoint?: string;         // e.g., "generateStaticContent"
        apiMethod?: 'POST' | 'GET';
        // For prompt-based
        promptId?: string;            // reference to prompts collection
        // Common
        preprocessors?: string[];     // functions to run before
        postprocessors?: string[];    // functions to run after
    };

    // ========== UI/UX ==========
    ui: {
        icon?: string;                // Tabler icon name
        color?: string;               // Theme color
        showInMenu?: boolean;         // האם להציג בתפריט יצירה
        menuOrder?: number;           // סדר בתפריט
        quickRepliesAfter?: string[]; // תשובות מהירות להציג אחרי
    };

    // ========== Dependencies ==========
    dependencies?: {
        requires?: string[];          // capabilities that must run first
        conflictsWith?: string[];     // capabilities that cannot run together
        suggestAfter?: string[];      // capabilities to suggest after completion
    };

    // ========== Status & Analytics ==========
    status: 'active' | 'deprecated' | 'beta' | 'disabled';
    analytics?: {
        usageCount: number;
        successRate: number;
        avgExecutionTime: number;
        lastUsed?: Date;
    };

    // ========== Metadata ==========
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    tags?: string[];                  // for search/filtering
}

// ========== RAG Types ==========

/**
 * תוצאת חיפוש יכולת
 */
export interface CapabilitySearchResult {
    capability: Capability;
    score: number;                    // relevance score 0-100
    matchedTriggers: string[];        // which triggers matched
    reasoning?: string;               // why this was selected
}

/**
 * Context שנטען לסוכן
 */
export interface AgentContext {
    relevantCapabilities: CapabilitySearchResult[];
    conversationSummary?: string;
    userPreferences?: {
        preferredContentType?: 'interactive' | 'static';
        recentTopics?: string[];
        commonSubjects?: string[];
    };
    systemState?: {
        hasActiveWizard?: boolean;
        currentStep?: string;
    };
}

// ========== Function Call Types ==========

/**
 * בקשת ביצוע מהסוכן
 */
export interface CapabilityExecutionRequest {
    capabilityId: string;
    params: Record<string, any>;
    context?: {
        conversationId?: string;
        userId?: string;
        previousCapabilityId?: string;
    };
}

/**
 * תוצאת ביצוע
 */
export interface CapabilityExecutionResult {
    success: boolean;
    capabilityId: string;
    result?: any;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    nextSteps?: {
        suggestedCapabilities?: string[];
        message?: string;
        quickReplies?: string[];
    };
    executionTime?: number;
}

// ========== Helper Types ==========

/**
 * מיפוי בין productType ישן ליכולת חדשה
 */
export const LEGACY_PRODUCT_TYPE_TO_CAPABILITY: Record<string, string> = {
    'lesson': 'create_interactive_lesson',
    'activity': 'create_interactive_activity',
    'exam': 'create_interactive_exam',
    'podcast': 'create_podcast',
    // Static content
    'worksheet': 'generate_worksheet',
    'lesson_plan': 'generate_lesson_plan',
    'letter': 'generate_letter',
    'feedback': 'generate_feedback',
    'rubric': 'generate_rubric',
    'test': 'generate_test_printable'
};

/**
 * קטגוריות להצגה בתפריט
 */
export const CAPABILITY_CATEGORY_LABELS: Record<CapabilityCategory, string> = {
    'interactive_content': 'תוכן אינטראקטיבי',
    'static_content': 'תוכן להדפסה',
    'curriculum': 'תוכ"ל',
    'media': 'מדיה',
    'search': 'חיפוש',
    'analytics': 'ניתוח',
    'utility': 'כלים'
};
