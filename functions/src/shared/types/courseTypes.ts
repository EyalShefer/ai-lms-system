export type LearningUnitType = 'acquisition' | 'practice' | 'test';

// סוגי הפעילויות האפשריים (כולל הצ'אט החדש והמשחקים)
export type ActivityBlockType =
    | 'text'
    | 'video'
    | 'image'
    | 'pdf'
    | 'multiple-choice'
    | 'open-question'
    | 'interactive-chat'
    | 'gem-link'
    // New Types
    | 'fill_in_blanks'
    | 'ordering'
    | 'categorization'
    | 'memory_game'
    | 'true_false_speed'
    | 'true_false_speed'
    | 'podcast'
    | 'audio-response'
    // 8 New Question Types
    | 'matching'           // Connect items with lines (התאמה)
    | 'highlight'          // Circle/underline correct answers in text (הקפה/סימון)
    | 'sentence_builder'   // Build sentence from scrambled words (סידור משפטים)
    | 'image_labeling'     // Drag labels onto image (תיוג תמונה)
    | 'table_completion'   // Fill in missing cells in table (השלמת טבלה)
    | 'text_selection'     // Select words/sentences from text (בחירת טקסט)
    | 'rating_scale'       // Rate on a scale 1-5 or 1-10 (סקאלת דירוג)
    | 'matrix';            // Matrix/grid with multiple rows and options (מטריקס)

export interface MultipleChoiceContent {
    question: string;
    options: string[];
    correctAnswer: string;
}

export interface OpenQuestionContent {
    question: string;
}

export interface OrderingContent {
    instruction: string;
    correct_order: string[];
}

export interface CategorizationContent {
    question: string;
    categories: string[];
    items: { text: string; category: string }[];
}

// Union of all strict content types
export type StrictBlockContent =
    | MultipleChoiceContent
    | OpenQuestionContent
    | OrderingContent
    | CategorizationContent
    | any; // Temporary fallback for legacy blocks

export type BloomLevel = 'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation';

export interface ActivityBlockMetadata {
    difficultyLevel?: number; // 1-5
    bloomLevel?: BloomLevel;
    score?: number; // 0-100 (הניקוד לשאלה)

    // שדות לשאלות
    modelAnswer?: string;
    sourceHint?: string; // New: Hint pointing to source text

    // שדות לתמונות/וידאו (העלאת קבצים)
    aiPrompt?: string;
    uploadedFileUrl?: string; // ה-URL של הקובץ ב-Firebase Storage
    fileName?: string; // שם הקובץ המקורי לתצוגה

    // שדות לצ'אט אינטראקטיבי
    systemPrompt?: string; // "האישיות" של הבוט
    initialMessage?: string; // הודעת הפתיחה של הבוט

    [key: string]: any;

    // Scaffolding / Error Handling
    progressiveHints?: string[]; // [General, Specific, Almost Answer]
    richOptions?: RichOption[];
    aiValidation?: {
        cefr_level: string;
        readability_score: number;
        cognitive_load: string;
        tone_audit?: string; // e.g. "Objective", "Encouraging"
        timestamp: number;
    };
}


export interface RichOption {
    text?: string;
    label?: string;
    id?: string;
    is_correct?: boolean;
    isCorrect?: boolean;
    feedback?: string;
}

// --- Strict Block Types (Discriminated Union) ---

// --- Strict Block Types (Discriminated Union) ---

export interface TelemetryData {
    timeSeconds: number;
    attempts: number;
    hintsUsed: number;
    lastAnswer: any;
    events?: { event: string; level?: number; timestamp?: number;[key: string]: any }[];
}

export interface ActivityBlockBase {
    id: string;
    metadata?: ActivityBlockMetadata;
}

export interface MultipleChoiceBlock extends ActivityBlockBase {
    type: 'multiple-choice';
    content: MultipleChoiceContent;
}

export interface OpenQuestionBlock extends ActivityBlockBase {
    type: 'open-question';
    content: OpenQuestionContent;
}

export interface OrderingBlock extends ActivityBlockBase {
    type: 'ordering';
    content: OrderingContent;
}

export interface CategorizationBlock extends ActivityBlockBase {
    type: 'categorization';
    content: CategorizationContent;
}

// Simple Media Blocks
export interface MediaBlock extends ActivityBlockBase {
    type: 'text' | 'image' | 'video' | 'pdf' | 'gem-link';
    content: string; // URL or Text
}

// Complex / Legacy Blocks
export interface GenericBlock extends ActivityBlockBase {
    type: 'interactive-chat' | 'memory_game' | 'fill_in_blanks' | 'true_false_speed';
    content: any;
}


export interface PodcastBlock extends ActivityBlockBase {
    type: 'podcast';
    content: {
        title?: string;
        audioUrl?: string | null;
        script?: any; // DialogueScript
        transcript?: string;
    };
}

export interface AudioResponseContent {
    question: string;
    description?: string;
    maxDuration?: number; // seconds, default 60
}

export interface AudioResponseBlock extends ActivityBlockBase {
    type: 'audio-response';
    content: AudioResponseContent;
}

export type ActivityBlock =
    | MultipleChoiceBlock
    | OpenQuestionBlock
    | OrderingBlock
    | CategorizationBlock
    | MediaBlock
    | GenericBlock
    | GenericBlock
    | PodcastBlock
    | AudioResponseBlock;

export interface LearningUnit {
    id: string;
    title: string;
    type: LearningUnitType;
    baseContent: string;
    activityBlocks: ActivityBlock[];
    audioOverview?: {
        script: any; // Context: DialogueScript from gemini.types.ts
        audioUrl?: string;
    };
}

export interface Module {
    id: string;
    title: string;
    learningUnits: LearningUnit[];
}

export interface Course {
    id: string;
    teacherId: string;
    title: string;
    targetAudience: string;
    gradeLevel?: string;
    subject?: string;
    botPersona?: string;
    mode?: 'learning' | 'exam';
    activityLength?: 'short' | 'medium' | 'long';
    syllabus: Module[];
    createdAt?: any;
    updatedAt?: any;
    fullBookContent?: string; // THe full extracted text
    showSourceToStudent?: boolean; // Visibility toggle
    pdfSource?: string | null; // URL of the original PDF file
    settings?: {
        totalScore: number;
        passScore: number;
    };
}

export interface Assignment {
    id: string;
    courseId: string;
    title: string;
    instructions?: string;
    dueDate?: string | number;
    activeSubmission?: {
        answers: Record<string, any>;
    };
    [key: string]: any;
}

export interface StudentAnalyticsProfile {
    studentId?: string;
    strengths: string[];          // מיומנויות חזקות
    weaknesses: string[];         // נושאים לחיזוק
    recommendedFocus: string;     // נושא מומלץ לתרגול
    engagementScore: number;      // ציון מעורבות (0-100)

    // מדדי למידה
    learningMetrics?: {
        averageTimePerQuestion: number;  // זמן ממוצע לשאלה (שניות)
        hintUsageRate: number;           // אחוז שימוש ברמזים (0-1)
        attemptsPerQuestion: number;     // ניסיונות ממוצע לשאלה
        completionRate: number;          // אחוז השלמה (0-1)
    };

    // העדפות למידה
    learningPreferences?: {
        visual: number;      // 0-1
        textual: number;
        gamified: number;
        scaffolded: number;
    };
}

// --- Validation Types ---
export type ValidationStatus = 'PASS' | 'REJECT';

export interface ValidationMetrics {
    cefr_level: string; // e.g., 'A2', 'B1'
    readability_score: number; // 0-100
    cognitive_load: 'Low' | 'Medium' | 'High';
}

export interface ValidationIssue {
    module_index: number;
    issue_type: string; // e.g., 'Grammar', 'Tone', 'Complexity'
    description: string;
    suggested_fix: string;
}

export interface ValidationResult {
    status: ValidationStatus;
    metrics: ValidationMetrics;
    issues: ValidationIssue[];
}

// --- Gamification Types ---
export interface GamificationProfile {
    // Basic Stats
    xp: number;
    level: number;
    currentStreak: number;
    lastActivityDate: string; // ISO Date to check streak
    frozenDays: number; // Inventory of Streak Freezes

    // Currency
    gems: number;

    // Social
    leagueTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';
    leagueWeeklyXp: number; // Resets weekly

    // Unlocks
    unlockedThemes: string[];
    equippedTheme: string;
}

export type GamificationEventType = 'XP_GAIN' | 'LEVEL_UP' | 'STREAK_MAINTAINED' | 'STREAK_LOST' | 'GEM_EARNED';

export interface GamificationEventPayload {
    type: GamificationEventType;
    amount?: number;
    reason?: string;
    newLevel?: number;
    timestamp: number;
}
