export type LearningUnitType = 'acquisition' | 'practice' | 'test';

// הוספנו כאן: image, pdf
export type ActivityBlockType = 'text' | 'video' | 'image' | 'pdf' | 'multiple-choice' | 'open-question' | 'gem-link';

export interface ActivityBlockMetadata {
    difficultyLevel?: number;
    modelAnswer?: string; // לתשובות פתוחות
    aiPrompt?: string;    // לתיאור תמונה שנוצר ע"י AI
    [key: string]: any;
}

export interface ActivityBlock {
    id: string;
    type: ActivityBlockType;
    content: any; // יכול להיות טקסט, לינק, או אובייקט שאלה
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
    title: string;
    targetAudience: string;
    syllabus: Module[];
}