/**
 * Adaptive Learning Enhanced Types
 *
 * Types for advanced adaptive learning features:
 * - IRT (Item Response Theory) calibration
 * - Learning trend analysis
 * - Forgetting curve
 * - A/B testing
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// IRT (Item Response Theory) Types
// ============================================================================

/**
 * IRT calibration data for a question/variant
 * Stored in: variants_cache/{blockId}_{type}/irt_data
 * Or: activity_bank/{activityId}/blocks/{blockId}/irt_data
 */
export interface IRTData {
    /**
     * IRT difficulty parameter (theta scale, typically -3 to +3)
     * Higher = harder question
     */
    irtDifficulty: number;

    /**
     * Discrimination parameter (how well the question differentiates ability levels)
     * Higher = better at distinguishing students
     * Typically 0.5 to 2.5
     */
    discrimination: number;

    /**
     * Guessing parameter for multiple choice (pseudo-guessing, c parameter)
     * Probability of getting correct by random guess
     * For 4-option MC: ~0.25
     */
    guessingParam: number;

    /**
     * Number of responses used for calibration
     * Higher = more reliable estimate
     */
    calibrationN: number;

    /**
     * When was this calibrated
     */
    lastCalibrated: Timestamp | Date;

    /**
     * Confidence interval for difficulty estimate
     */
    difficultyCI?: {
        lower: number;
        upper: number;
    };
}

/**
 * Data collected per submission for IRT calibration
 */
export interface IRTSubmissionData {
    questionId: string;
    variantId?: string;
    variantType: 'יישום' | 'הבנה' | 'העמקה';
    isCorrect: boolean;
    responseTimeMs: number;
    studentMasteryAtSubmission: number;
    timestamp: Timestamp | Date;
}

// ============================================================================
// Learning Trend Types
// ============================================================================

/**
 * Learning trend classification
 */
export type LearningTrend =
    | 'improving_fast'    // Rapid improvement (slope > 0.02)
    | 'improving'         // Steady improvement (slope > 0.005)
    | 'stable'            // No significant change
    | 'declining'         // Getting worse (slope < -0.005)
    | 'declining_fast'    // Rapidly declining (slope < -0.02)
    | 'insufficient_data'; // Not enough data points

/**
 * Mastery history entry for trend calculation
 */
export interface MasteryHistoryEntry {
    mastery: number;
    timestamp: Timestamp | Date;
    questionCount: number;  // How many questions answered at this point
}

/**
 * Extended proficiency vector with trend data
 */
export interface ExtendedProficiencyVector {
    topics: Record<string, number>;
    lastUpdated: Timestamp | Date;

    /**
     * Mastery history per topic (last 30 data points)
     */
    masteryHistory?: Record<string, MasteryHistoryEntry[]>;

    /**
     * Last practice date per topic (for forgetting curve)
     */
    lastPracticeDate?: Record<string, Timestamp | Date>;

    /**
     * Calculated trend per topic
     */
    trends?: Record<string, LearningTrend>;

    /**
     * Learning velocity per topic (mastery change per day)
     */
    learningVelocity?: Record<string, number>;
}

/**
 * Trend calculation result
 */
export interface TrendResult {
    trend: LearningTrend;
    slope: number;           // Mastery change per data point
    velocity: number;        // Mastery change per day
    r2: number;              // R-squared (fit quality)
    dataPoints: number;      // Number of points used
    predictedMastery7d: number; // Predicted mastery in 7 days
}

// ============================================================================
// Forgetting Curve Types
// ============================================================================

/**
 * Forgetting curve parameters
 */
export interface ForgettingCurveParams {
    /**
     * Base decay rate (lambda)
     * Higher = faster forgetting
     * Default: 0.02 (lose ~50% after 35 days)
     */
    decayRate: number;

    /**
     * Minimum retention (floor)
     * Mastery won't decay below this percentage of original
     * Default: 0.3 (retain at least 30% of learned material)
     */
    minimumRetention: number;

    /**
     * Strength factor (how well-learned affects decay)
     * Higher mastery = slower decay
     * Default: 1.5
     */
    strengthFactor: number;
}

/**
 * Default forgetting curve parameters (research-based)
 */
export const DEFAULT_FORGETTING_PARAMS: ForgettingCurveParams = {
    decayRate: 0.02,
    minimumRetention: 0.3,
    strengthFactor: 1.5,
};

// ============================================================================
// A/B Testing Types
// ============================================================================

/**
 * Experiment status
 */
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';

/**
 * Experiment variant assignment
 */
export type ExperimentVariant = 'control' | 'treatment';

/**
 * A/B Experiment definition
 * Stored in: experiments/{experimentId}
 */
export interface Experiment {
    id: string;
    name: string;
    description: string;
    status: ExperimentStatus;

    /**
     * When the experiment starts/ends
     */
    startDate: Timestamp | Date;
    endDate: Timestamp | Date;

    /**
     * What parameter is being tested
     */
    parameter: string; // e.g., 'scaffolding_threshold', 'enrichment_threshold'

    /**
     * Parameter values for each variant
     */
    controlValue: number;
    treatmentValue: number;

    /**
     * Traffic allocation (0-1, percentage to treatment)
     */
    trafficAllocation: number;

    /**
     * Primary metric to measure
     */
    primaryMetric: 'learning_gain' | 'time_to_mastery' | 'completion_rate' | 'scaffolding_acceptance';

    /**
     * Minimum sample size before results are meaningful
     */
    minimumSampleSize: number;

    /**
     * Created/updated metadata
     */
    createdAt: Timestamp | Date;
    updatedAt: Timestamp | Date;
    createdBy: string;
}

/**
 * User's experiment assignments
 * Stored in: users/{userId}/profile/experiments
 */
export interface UserExperiments {
    assignments: Record<string, ExperimentVariant>; // experimentId -> variant
    lastUpdated: Timestamp | Date;
}

/**
 * Experiment event for tracking
 * Stored in: experiment_events/{eventId}
 */
export interface ExperimentEvent {
    experimentId: string;
    userId: string;
    variant: ExperimentVariant;
    eventType: 'variant_selected' | 'scaffolding_offered' | 'scaffolding_accepted' |
               'enrichment_offered' | 'enrichment_accepted' | 'session_complete';
    timestamp: Timestamp | Date;

    /**
     * Metrics at time of event
     */
    metrics?: {
        mastery?: number;
        accuracy?: number;
        responseTimeMs?: number;
        learningGain?: number;
    };
}

/**
 * Experiment results summary
 */
export interface ExperimentResults {
    experimentId: string;
    calculatedAt: Timestamp | Date;

    control: {
        sampleSize: number;
        meanLearningGain: number;
        meanTimeToMastery: number;
        completionRate: number;
        scaffoldingAcceptanceRate: number;
    };

    treatment: {
        sampleSize: number;
        meanLearningGain: number;
        meanTimeToMastery: number;
        completionRate: number;
        scaffoldingAcceptanceRate: number;
    };

    /**
     * Statistical significance
     */
    significance: {
        pValue: number;
        effectSize: number;
        confidenceInterval: { lower: number; upper: number };
        isSignificant: boolean; // p < 0.05
    };

    /**
     * Recommendation based on results
     */
    recommendation: 'adopt_treatment' | 'keep_control' | 'inconclusive' | 'need_more_data';
}

// ============================================================================
// Enhanced Variant Selection Types
// ============================================================================

/**
 * Extended input for selectVariant function
 */
export interface SelectVariantInput {
    mastery: number;
    recentAccuracy: number;

    // Optional enhanced inputs (backwards compatible)
    trend?: LearningTrend;
    daysSincePractice?: number;
    prerequisiteMastery?: Record<string, number>;
    experimentVariant?: ExperimentVariant;
    experimentThreshold?: number;
}

/**
 * Extended output from selectVariant function
 */
export interface SelectVariantOutput {
    variant: 'יישום' | 'הבנה' | 'העמקה';

    /**
     * What factors influenced the decision
     */
    factors: {
        basedOnMastery: boolean;
        basedOnAccuracy: boolean;
        basedOnTrend: boolean;
        basedOnForgetting: boolean;
        basedOnExperiment: boolean;
        basedOnPrerequisites: boolean;
    };

    /**
     * Effective values used for decision
     */
    effectiveValues: {
        mastery: number;          // After forgetting curve
        threshold: number;        // After experiment adjustment
    };

    /**
     * Debug info
     */
    debug?: string;
}
