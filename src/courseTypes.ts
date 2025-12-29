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
    | 'podcast';

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
    type: 'interactive-chat' | 'memory_game' | 'fill_in_blanks';
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

export type ActivityBlock =
    | MultipleChoiceBlock
    | OpenQuestionBlock
    | OrderingBlock
    | CategorizationBlock
    | MediaBlock
    | GenericBlock
    | PodcastBlock;

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
