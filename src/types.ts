export type LearningUnitType = 'acquisition' | 'practice' | 'test';

export type ActivityBlockType = 'text' | 'video' | 'multiple-choice' | 'open-question';

export interface ActivityBlockMetadata {
    difficultyLevel?: number;
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

export interface Course {
    id: string;
    title: string;
    targetAudience: string;
    syllabus: Module[];
}
