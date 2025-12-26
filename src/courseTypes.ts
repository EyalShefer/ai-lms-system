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
    | 'memory_game';

export type BloomLevel = 'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation';

export interface ActivityBlockMetadata {
    difficultyLevel?: number; // 1-5
    bloomLevel?: BloomLevel;
    score?: number; // 0-100 (הניקוד לשאלה)

    // שדות לשאלות
    modelAnswer?: string;

    // שדות לתמונות/וידאו (העלאת קבצים)
    aiPrompt?: string;
    uploadedFileUrl?: string; // ה-URL של הקובץ ב-Firebase Storage
    fileName?: string; // שם הקובץ המקורי לתצוגה

    // שדות לצ'אט אינטראקטיבי
    systemPrompt?: string; // "האישיות" של הבוט
    initialMessage?: string; // הודעת הפתיחה של הבוט

    [key: string]: any;
}

export interface ActivityBlock {
    id: string;
    type: ActivityBlockType;
    content: any; // תוכן הבלוק (טקסט, URL, אובייקט שאלה וכו')
    metadata?: ActivityBlockMetadata;
}

export interface LearningUnit {
    id: string;
    title: string;
    type: LearningUnitType;
    baseContent: string;
    activityBlocks: ActivityBlock[];
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