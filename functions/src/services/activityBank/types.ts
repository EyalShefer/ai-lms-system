/**
 * Activity Bank Types
 *
 * Type definitions for the Activity Bank system - a repository of
 * reusable educational activities independent of courses.
 */

import { Timestamp } from 'firebase-admin/firestore';
import type { ActivityBlockType, BloomLevel, ActivityBlockMetadata, StrictBlockContent } from '../../shared/types/courseTypes';

// ============================================
// Guardian Result (from examGuardian.ts)
// ============================================

export interface GuardianCheckResult {
    status: 'PASS' | 'FAIL' | 'WARNING';
    details: string;
}

export interface GuardianResult {
    status: 'PASS' | 'CRITICAL_FAIL' | 'WARNING';
    overall_quality_score: number;
    critical_fail_reason: string | null;
    phase1_checks: {
        hints_leak: GuardianCheckResult;
        teaching_content: GuardianCheckResult;
        tone_check: GuardianCheckResult;
        answer_reveal: GuardianCheckResult;
    };
    phase2_fairness: {
        cultural_bias: GuardianCheckResult;
        gender_bias: GuardianCheckResult;
        socioeconomic_bias: GuardianCheckResult;
        accessibility: GuardianCheckResult;
    };
    phase3_scores: {
        coverage: number;
        bloom_accuracy: number;
        question_clarity: number;
        distractor_quality: number;
        rubric_quality: number;
    };
    feedback_hebrew: string;
    issues: Array<{
        question_number?: number;
        severity: 'CRITICAL' | 'WARNING' | 'INFO';
        description: string;
    }>;
}

// ============================================
// Activity Bank - Main Entity
// ============================================

export type ActivitySubject = 'hebrew' | 'science';
export type GradeLevel = 'ה' | 'ו';
export type ReviewStatus = 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
export type GeneratedBy = 'claude_agent' | 'manual';

export interface BankActivity {
    id: string;
    version: number;

    // Classification
    subject: ActivitySubject;
    gradeLevel: GradeLevel;
    topic: string;
    subtopic?: string;
    curriculumStandardId: string;

    // Content (matches ActivityBlock structure)
    activityType: ActivityBlockType;
    content: StrictBlockContent;
    metadata: ActivityBlockMetadata;
    bloomLevel: BloomLevel;
    learningObjectives: string[];

    // Quality Metrics
    qualityScore: number;           // 0-100
    guardianResult: GuardianResult;
    reviewStatus: ReviewStatus;

    // Generation Metadata
    generatedBy: GeneratedBy;
    generationModel?: string;       // e.g., 'claude-opus-4-5'
    generationTimeMs?: number;
    sourceContext?: string;         // Curriculum text used for generation

    // Usage Tracking
    usageCount: number;
    averageRating: number;
    ratingCount: number;
    copiedToCoursesCount: number;

    // Metadata
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;              // 'system' or teacherId for manual additions

    // Discovery
    tags: string[];
    searchKeywords: string[];
    isFeatured: boolean;
}

// ============================================
// Curriculum Standards
// ============================================

export type CurriculumSource = 'ministry_of_education' | 'textbook_aligned' | 'custom';

export interface CurriculumStandard {
    id: string;

    // Classification
    subject: ActivitySubject;
    gradeLevel: GradeLevel;

    // Hierarchy
    domain: string;                     // e.g., "קריאה והבנת הנקרא", "מדעי החיים"
    topic: string;                      // e.g., "סוגי טקסטים", "מערכות בגוף האדם"
    subtopic?: string;                  // Optional deeper level

    // Content
    standardCode?: string;              // Ministry of Education code if available
    title: string;                      // Hebrew title
    description: string;                // Full description
    learningObjectives: string[];       // Specific objectives
    requiredSkills: string[];           // Skills students should acquire

    // Activity Generation Guidance
    recommendedActivityTypes: ActivityBlockType[];
    recommendedBloomLevels: BloomLevel[];
    samplePrompts?: string[];           // Example prompts for AI generation

    // Embedding for semantic search
    embedding: number[];                // 1536 dimensions for RAG

    // Metadata
    source: CurriculumSource;
    sourceDocument?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ============================================
// Activity Generation Queue
// ============================================

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ActivityGenerationRequest {
    id: string;
    userId: string;
    status: GenerationStatus;

    // Parameters
    subject: ActivitySubject;
    gradeLevel: GradeLevel;
    topic?: string;
    activityCount: number;          // Recommended: 5-10
    bloomLevels: BloomLevel[];
    activityTypes?: ActivityBlockType[];

    // Results (populated after completion)
    result?: {
        activitiesCreated: number;
        activityIds: string[];
        qualityScores: number[];
        errors?: string[];
    };

    // Timestamps
    createdAt: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;

    // Error handling
    error?: string;
    retryCount?: number;
}

// ============================================
// Activity Ratings
// ============================================

export interface ActivityRating {
    id: string;
    activityId: string;
    userId: string;
    userName: string;
    rating: number;          // 1-5
    comment?: string;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

// ============================================
// Generation Result
// ============================================

export interface GenerationResult {
    activitiesCreated: number;
    activityIds: string[];
    qualityScores: number[];
    errors: string[];
    totalTimeMs: number;
}

// ============================================
// Quality Thresholds
// ============================================

export const QUALITY_THRESHOLDS = {
    AUTO_APPROVE: 80,      // Auto-approve if score >= 80
    PENDING_REVIEW: 60,    // Pending review if score 60-79
    AUTO_REJECT: 59        // Auto-reject if score < 60
} as const;

// ============================================
// Agent Configuration
// ============================================

export interface AgentConfig {
    geminiApiKey?: string;      // Optional - uses GEMINI_API_KEY env var if not provided
    openaiApiKey: string;       // For embeddings
    maxIterations: number;      // Max tool calls per run
    timeoutMs: number;          // Total timeout
    activityCountPerRun: number; // Max activities per run (5-10)
}

// ============================================
// Tool Schemas (for Claude Agent SDK)
// ============================================

export interface ToolInput {
    load_curriculum_standards: {
        subject: ActivitySubject;
        gradeLevel: GradeLevel;
        topic?: string;
        bloomLevels?: BloomLevel[];
    };
    generate_activity_skeleton: {
        curriculumStandardId: string;
        activityType: ActivityBlockType;
        bloomLevel: BloomLevel;
        difficultyLevel?: 'easy' | 'medium' | 'hard';
    };
    generate_activity_content: {
        skeleton: any;
        curriculumContext: string;
        gradeLevel: string;
    };
    validate_activity: {
        activity: any;
        curriculumStandard: CurriculumStandard;
        gradeLevel: string;
    };
    save_to_activity_bank: {
        activity: any;
        curriculumStandardId: string;
        qualityScore: number;
        guardianResult: GuardianResult;
        metadata: {
            subject: ActivitySubject;
            gradeLevel: GradeLevel;
            topic: string;
            bloomLevel: BloomLevel;
            learningObjectives?: string[];
        };
    };
    search_existing_activities: {
        topic: string;
        activityType?: ActivityBlockType;
        bloomLevel?: BloomLevel;
        gradeLevel: GradeLevel;
    };
}

export interface ToolOutput {
    load_curriculum_standards: CurriculumStandard[];
    generate_activity_skeleton: any;
    generate_activity_content: any;
    validate_activity: GuardianResult;
    save_to_activity_bank: { success: boolean; activityId: string };
    search_existing_activities: { exists: boolean; similarActivities: BankActivity[] };
}
