export type LearningUnitType = 'acquisition' | 'practice' | 'test';

export type ActivityBlockType = 'text' | 'video' | 'image' | 'pdf' | 'multiple-choice' | 'open-question' | 'gem-link';

export interface ActivityBlockMetadata {
    difficultyLevel?: number;
    modelAnswer?: string;
    aiPrompt?: string;
    [key: string]: any;
}

export interface ActivityBlock {
    id: string;
    type: ActivityBlockType;
    content: any;
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

// הנה הייצוא שהיה חסר
export interface Course {
    id: string;
    teacherId: string;
    title: string;
    targetAudience: string;
    syllabus: Module[];
    createdAt?: any;
}