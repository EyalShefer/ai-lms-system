/**
 * Adaptive Enhancements Service
 *
 * Provides enhanced adaptive learning features that extend the base system:
 * - Forgetting Curve: Mastery decays over time
 * - Learning Trend: Detect improving/declining students
 * - A/B Testing: Experiment with policy parameters
 * - Enhanced Variant Selection: Uses all available signals
 *
 * IMPORTANT: All features are backwards compatible.
 * When feature flags are disabled, behavior matches the original system.
 */

import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { ADAPTIVE_FEATURE_FLAGS, isFeatureEnabled } from '../config/adaptiveFeatureFlags';
import type {
    LearningTrend,
    TrendResult,
    MasteryHistoryEntry,
    ExtendedProficiencyVector,
    ForgettingCurveParams,
    DEFAULT_FORGETTING_PARAMS,
    Experiment,
    ExperimentVariant,
    UserExperiments,
    SelectVariantInput,
    SelectVariantOutput,
} from '../shared/types/adaptiveTypes';
import type { ActivityBlock } from '../shared/types/courseTypes';

// ============================================================================
// FORGETTING CURVE
// ============================================================================

/**
 * Default forgetting curve parameters
 */
const FORGETTING_PARAMS: ForgettingCurveParams = {
    decayRate: 0.02,           // ~50% retention after 35 days
    minimumRetention: 0.3,     // Never drop below 30% of learned mastery
    strengthFactor: 1.5,       // Higher mastery = slower decay
};

/**
 * Calculate effective mastery after applying forgetting curve
 *
 * Formula: effective = stored * max(minimumRetention, e^(-λ * days / strength))
 * Where strength = 1 + (stored - 0.5) * strengthFactor
 *
 * @param storedMastery - The stored mastery value (0-1)
 * @param daysSincePractice - Days since last practice on this topic
 * @param params - Optional custom forgetting parameters
 * @returns Effective mastery after decay (0-1)
 *
 * @example
 * // Student with 0.8 mastery, hasn't practiced for 30 days
 * getEffectiveMastery(0.8, 30) // Returns ~0.52
 *
 * @example
 * // Feature disabled - returns original mastery
 * getEffectiveMastery(0.8, 30) // Returns 0.8 when flag is off
 */
export const getEffectiveMastery = (
    storedMastery: number,
    daysSincePractice: number,
    params: ForgettingCurveParams = FORGETTING_PARAMS
): number => {
    // If feature disabled, return original mastery (backwards compatible)
    if (!isFeatureEnabled('useForgettingCurve')) {
        return storedMastery;
    }

    // No decay if practiced recently
    if (daysSincePractice <= 0) {
        return storedMastery;
    }

    // Higher mastery = slower decay (better retention)
    const strength = 1 + (storedMastery - 0.5) * params.strengthFactor;
    const adjustedDecayRate = params.decayRate / Math.max(strength, 0.5);

    // Exponential decay
    const retention = Math.exp(-adjustedDecayRate * daysSincePractice);

    // Apply minimum retention floor
    const effectiveRetention = Math.max(retention, params.minimumRetention);

    return storedMastery * effectiveRetention;
};

/**
 * Calculate days since last practice for a topic
 */
export const getDaysSincePractice = (
    lastPracticeDate: Date | Timestamp | undefined
): number => {
    if (!lastPracticeDate) {
        return 0; // No data = assume recent (conservative)
    }

    const lastDate = lastPracticeDate instanceof Timestamp
        ? lastPracticeDate.toDate()
        : lastPracticeDate;

    const now = new Date();
    const diffMs = now.getTime() - lastDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

// ============================================================================
// LEARNING TREND
// ============================================================================

/**
 * Calculate learning trend from mastery history
 *
 * Uses linear regression on recent mastery values to determine if student
 * is improving, stable, or declining.
 *
 * @param history - Array of mastery history entries (most recent last)
 * @param minDataPoints - Minimum entries needed for trend calculation
 * @returns Trend result with classification and metrics
 *
 * @example
 * const history = [
 *   { mastery: 0.3, timestamp: ..., questionCount: 5 },
 *   { mastery: 0.4, timestamp: ..., questionCount: 10 },
 *   { mastery: 0.5, timestamp: ..., questionCount: 15 },
 * ];
 * calculateLearningTrend(history) // Returns { trend: 'improving', slope: 0.1, ... }
 */
export const calculateLearningTrend = (
    history: MasteryHistoryEntry[],
    minDataPoints: number = 5
): TrendResult => {
    // Not enough data
    if (history.length < minDataPoints) {
        return {
            trend: 'insufficient_data',
            slope: 0,
            velocity: 0,
            r2: 0,
            dataPoints: history.length,
            predictedMastery7d: history.length > 0 ? history[history.length - 1].mastery : 0.5,
        };
    }

    // Use last 30 data points max
    const recentHistory = history.slice(-30);
    const n = recentHistory.length;

    // Simple linear regression: y = mx + b
    // x = index (0, 1, 2, ...), y = mastery
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    recentHistory.forEach((entry, i) => {
        sumX += i;
        sumY += entry.mastery;
        sumXY += i * entry.mastery;
        sumX2 += i * i;
        sumY2 += entry.mastery * entry.mastery;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // R-squared (coefficient of determination)
    const yMean = sumY / n;
    let ssTotal = 0, ssResidual = 0;

    recentHistory.forEach((entry, i) => {
        const predicted = slope * i + intercept;
        ssTotal += Math.pow(entry.mastery - yMean, 2);
        ssResidual += Math.pow(entry.mastery - predicted, 2);
    });

    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    // Calculate velocity (mastery change per day)
    let velocity = 0;
    if (recentHistory.length >= 2) {
        const firstEntry = recentHistory[0];
        const lastEntry = recentHistory[recentHistory.length - 1];

        const firstDate = firstEntry.timestamp instanceof Timestamp
            ? firstEntry.timestamp.toDate()
            : firstEntry.timestamp;
        const lastDate = lastEntry.timestamp instanceof Timestamp
            ? lastEntry.timestamp.toDate()
            : lastEntry.timestamp;

        const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 0) {
            velocity = (lastEntry.mastery - firstEntry.mastery) / daysDiff;
        }
    }

    // Classify trend based on slope
    let trend: LearningTrend;
    if (slope > 0.02) {
        trend = 'improving_fast';
    } else if (slope > 0.005) {
        trend = 'improving';
    } else if (slope < -0.02) {
        trend = 'declining_fast';
    } else if (slope < -0.005) {
        trend = 'declining';
    } else {
        trend = 'stable';
    }

    // Predict mastery in 7 days (using velocity)
    const currentMastery = recentHistory[recentHistory.length - 1].mastery;
    const predictedMastery7d = Math.max(0, Math.min(1, currentMastery + velocity * 7));

    return {
        trend,
        slope,
        velocity,
        r2,
        dataPoints: n,
        predictedMastery7d,
    };
};

/**
 * Get learning trend for a user's topic
 * Fetches history from Firestore and calculates trend
 */
export const getLearningTrendForTopic = async (
    userId: string,
    topicId: string
): Promise<TrendResult> => {
    // If feature disabled, return neutral trend
    if (!isFeatureEnabled('useTrendAnalysis')) {
        return {
            trend: 'stable',
            slope: 0,
            velocity: 0,
            r2: 0,
            dataPoints: 0,
            predictedMastery7d: 0.5,
        };
    }

    try {
        const vectorRef = doc(db, 'users', userId, 'profile', 'proficiency_vector');
        const vectorSnap = await getDoc(vectorRef);

        if (!vectorSnap.exists()) {
            return {
                trend: 'insufficient_data',
                slope: 0,
                velocity: 0,
                r2: 0,
                dataPoints: 0,
                predictedMastery7d: 0.5,
            };
        }

        const vector = vectorSnap.data() as ExtendedProficiencyVector;
        const history = vector.masteryHistory?.[topicId] || [];

        return calculateLearningTrend(history);

    } catch (error) {
        console.error('Error getting learning trend:', error);
        return {
            trend: 'insufficient_data',
            slope: 0,
            velocity: 0,
            r2: 0,
            dataPoints: 0,
            predictedMastery7d: 0.5,
        };
    }
};

// ============================================================================
// A/B TESTING
// ============================================================================

/**
 * Get user's experiment variant assignment
 * Uses deterministic hashing for consistent assignment
 *
 * @param userId - The user ID
 * @param experimentId - The experiment ID
 * @returns The variant assignment ('control' or 'treatment')
 */
export const getExperimentVariant = async (
    userId: string,
    experimentId: string
): Promise<ExperimentVariant | null> => {
    // If A/B testing disabled, return null (use default behavior)
    if (!isFeatureEnabled('enableABTesting')) {
        return null;
    }

    try {
        // Check if experiment is running
        const experimentRef = doc(db, 'experiments', experimentId);
        const experimentSnap = await getDoc(experimentRef);

        if (!experimentSnap.exists()) {
            return null;
        }

        const experiment = experimentSnap.data() as Experiment;

        // Check if experiment is active
        if (experiment.status !== 'running') {
            return null;
        }

        const now = new Date();
        const startDate = experiment.startDate instanceof Timestamp
            ? experiment.startDate.toDate()
            : experiment.startDate;
        const endDate = experiment.endDate instanceof Timestamp
            ? experiment.endDate.toDate()
            : experiment.endDate;

        if (now < startDate || now > endDate) {
            return null;
        }

        // Check if user already has assignment
        const userExperimentsRef = doc(db, 'users', userId, 'profile', 'experiments');
        const userExperimentsSnap = await getDoc(userExperimentsRef);

        if (userExperimentsSnap.exists()) {
            const userExperiments = userExperimentsSnap.data() as UserExperiments;
            if (userExperiments.assignments[experimentId]) {
                return userExperiments.assignments[experimentId];
            }
        }

        // Assign user to variant (deterministic hash)
        const hash = hashUserForExperiment(userId, experimentId);
        const variant: ExperimentVariant = hash < experiment.trafficAllocation
            ? 'treatment'
            : 'control';

        // Save assignment
        await setDoc(userExperimentsRef, {
            assignments: { [experimentId]: variant },
            lastUpdated: new Date(),
        }, { merge: true });

        console.log(`🧪 User ${userId} assigned to ${variant} for experiment ${experimentId}`);

        return variant;

    } catch (error) {
        console.error('Error getting experiment variant:', error);
        return null;
    }
};

/**
 * Deterministic hash for experiment assignment
 * Same user+experiment always gets same result
 */
const hashUserForExperiment = (userId: string, experimentId: string): number => {
    const str = `${userId}_${experimentId}`;
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Normalize to 0-1 range
    return Math.abs(hash % 1000) / 1000;
};

/**
 * Get experiment parameter value for user
 * Returns treatment value if in treatment, control value otherwise
 */
export const getExperimentValue = async (
    userId: string,
    experimentId: string,
    defaultValue: number
): Promise<number> => {
    const variant = await getExperimentVariant(userId, experimentId);

    if (!variant) {
        return defaultValue;
    }

    try {
        const experimentRef = doc(db, 'experiments', experimentId);
        const experimentSnap = await getDoc(experimentRef);

        if (!experimentSnap.exists()) {
            return defaultValue;
        }

        const experiment = experimentSnap.data() as Experiment;

        return variant === 'treatment'
            ? experiment.treatmentValue
            : experiment.controlValue;

    } catch (error) {
        console.error('Error getting experiment value:', error);
        return defaultValue;
    }
};

// ============================================================================
// ENHANCED VARIANT SELECTION
// ============================================================================

/**
 * Default thresholds (used when no experiment override)
 */
const DEFAULT_THRESHOLDS = {
    scaffoldingMastery: 0.4,
    scaffoldingAccuracy: 0.5,
    enrichmentMastery: 0.7,
    enrichmentAccuracy: 0.85,
};

/**
 * Enhanced variant selection that uses all available signals
 *
 * This function wraps the original selectVariant logic with additional
 * signals from trend, forgetting curve, and A/B testing.
 *
 * BACKWARDS COMPATIBLE: When all feature flags are off, behaves exactly
 * like the original selectVariant function.
 *
 * @param block - The activity block
 * @param input - Enhanced input with all available signals
 * @returns Enhanced output with variant and decision factors
 */
export const selectVariantEnhanced = async (
    block: ActivityBlock,
    input: SelectVariantInput
): Promise<SelectVariantOutput> => {
    const {
        mastery,
        recentAccuracy,
        trend,
        daysSincePractice,
        prerequisiteMastery,
        experimentVariant,
        experimentThreshold,
    } = input;

    // Track what influenced the decision
    const factors = {
        basedOnMastery: true,
        basedOnAccuracy: true,
        basedOnTrend: false,
        basedOnForgetting: false,
        basedOnExperiment: false,
        basedOnPrerequisites: false,
    };

    // 1. Apply forgetting curve
    let effectiveMastery = mastery;
    if (isFeatureEnabled('useForgettingCurve') && daysSincePractice !== undefined) {
        effectiveMastery = getEffectiveMastery(mastery, daysSincePractice);
        if (effectiveMastery !== mastery) {
            factors.basedOnForgetting = true;
        }
    }

    // 2. Get threshold (possibly from experiment)
    let scaffoldingThreshold = DEFAULT_THRESHOLDS.scaffoldingMastery;
    let enrichmentThreshold = DEFAULT_THRESHOLDS.enrichmentMastery;

    if (isFeatureEnabled('enableABTesting') && experimentThreshold !== undefined) {
        scaffoldingThreshold = experimentThreshold;
        factors.basedOnExperiment = true;
    }

    // 3. Check prerequisites
    if (isFeatureEnabled('usePrerequisiteCheck') && prerequisiteMastery) {
        const weakPrereqs = Object.values(prerequisiteMastery).filter(m => m < 0.5);
        if (weakPrereqs.length > 0) {
            // Weak prerequisites = needs scaffolding regardless of current mastery
            factors.basedOnPrerequisites = true;

            return {
                variant: 'הבנה',
                factors,
                effectiveValues: { mastery: effectiveMastery, threshold: scaffoldingThreshold },
                debug: `Weak prerequisites detected (${weakPrereqs.length} topics below 0.5)`,
            };
        }
    }

    // 4. Apply trend-based adjustments
    if (isFeatureEnabled('useTrendAnalysis') && trend) {
        factors.basedOnTrend = true;

        // Improving fast - don't scaffold even if mastery is borderline
        if (trend === 'improving_fast' && effectiveMastery >= scaffoldingThreshold - 0.1) {
            if (effectiveMastery < scaffoldingThreshold) {
                return {
                    variant: 'יישום',
                    factors,
                    effectiveValues: { mastery: effectiveMastery, threshold: scaffoldingThreshold },
                    debug: `Trend override: improving_fast, skipping scaffolding`,
                };
            }
        }

        // Declining - scaffold earlier
        if ((trend === 'declining' || trend === 'declining_fast') &&
            effectiveMastery < scaffoldingThreshold + 0.1) {
            const hasHavana = !!(block.metadata?.הבנה_id || block.metadata?.scaffolding_id);
            if (hasHavana) {
                return {
                    variant: 'הבנה',
                    factors,
                    effectiveValues: { mastery: effectiveMastery, threshold: scaffoldingThreshold },
                    debug: `Trend override: ${trend}, offering scaffolding earlier`,
                };
            }
        }

        // Stable high performer - can enrich at lower threshold
        if (trend === 'stable' && effectiveMastery >= enrichmentThreshold - 0.1) {
            const hasHaamaka = !!(block.metadata?.העמקה_id || block.metadata?.enrichment_id);
            if (hasHaamaka && recentAccuracy >= DEFAULT_THRESHOLDS.enrichmentAccuracy - 0.05) {
                return {
                    variant: 'העמקה',
                    factors,
                    effectiveValues: { mastery: effectiveMastery, threshold: enrichmentThreshold },
                    debug: `Trend override: stable high performer, offering enrichment`,
                };
            }
        }
    }

    // 5. Standard logic (matches original selectVariant)
    const hasHavana = !!(block.metadata?.הבנה_id || block.metadata?.scaffolding_id);
    const hasHaamaka = !!(block.metadata?.העמקה_id || block.metadata?.enrichment_id);

    // Scaffolding for struggling students
    if (effectiveMastery < scaffoldingThreshold &&
        recentAccuracy < DEFAULT_THRESHOLDS.scaffoldingAccuracy &&
        hasHavana) {
        return {
            variant: 'הבנה',
            factors,
            effectiveValues: { mastery: effectiveMastery, threshold: scaffoldingThreshold },
        };
    }

    // Enrichment for excelling students
    if (effectiveMastery >= enrichmentThreshold &&
        recentAccuracy >= DEFAULT_THRESHOLDS.enrichmentAccuracy &&
        hasHaamaka) {
        return {
            variant: 'העמקה',
            factors,
            effectiveValues: { mastery: effectiveMastery, threshold: enrichmentThreshold },
        };
    }

    // Default: standard variant
    return {
        variant: 'יישום',
        factors,
        effectiveValues: { mastery: effectiveMastery, threshold: scaffoldingThreshold },
    };
};

// ============================================================================
// MASTERY HISTORY MANAGEMENT
// ============================================================================

/**
 * Add a mastery entry to history
 * Called after each BKT update
 */
export const addMasteryHistoryEntry = async (
    userId: string,
    topicId: string,
    mastery: number,
    questionCount: number
): Promise<void> => {
    const vectorRef = doc(db, 'users', userId, 'profile', 'proficiency_vector');

    try {
        const vectorSnap = await getDoc(vectorRef);
        let vector: ExtendedProficiencyVector;

        if (vectorSnap.exists()) {
            vector = vectorSnap.data() as ExtendedProficiencyVector;
        } else {
            vector = {
                topics: {},
                lastUpdated: new Date(),
            };
        }

        // Initialize history if needed
        if (!vector.masteryHistory) {
            vector.masteryHistory = {};
        }
        if (!vector.masteryHistory[topicId]) {
            vector.masteryHistory[topicId] = [];
        }

        // Add new entry
        vector.masteryHistory[topicId].push({
            mastery,
            timestamp: new Date(),
            questionCount,
        });

        // Keep only last 30 entries
        if (vector.masteryHistory[topicId].length > 30) {
            vector.masteryHistory[topicId] = vector.masteryHistory[topicId].slice(-30);
        }

        // Update last practice date
        if (!vector.lastPracticeDate) {
            vector.lastPracticeDate = {};
        }
        vector.lastPracticeDate[topicId] = new Date();

        // Update current mastery
        vector.topics[topicId] = mastery;
        vector.lastUpdated = new Date();

        // Calculate and store trend
        if (!vector.trends) {
            vector.trends = {};
        }
        if (!vector.learningVelocity) {
            vector.learningVelocity = {};
        }

        const trendResult = calculateLearningTrend(vector.masteryHistory[topicId]);
        vector.trends[topicId] = trendResult.trend;
        vector.learningVelocity[topicId] = trendResult.velocity;

        await setDoc(vectorRef, vector);

        console.log(`📈 Mastery history updated for ${userId}/${topicId}: ${mastery.toFixed(3)}, trend: ${trendResult.trend}`);

    } catch (error) {
        console.error('Error adding mastery history entry:', error);
    }
};

/**
 * Get extended proficiency data for a user
 */
export const getExtendedProficiency = async (
    userId: string
): Promise<ExtendedProficiencyVector | null> => {
    try {
        const vectorRef = doc(db, 'users', userId, 'profile', 'proficiency_vector');
        const vectorSnap = await getDoc(vectorRef);

        if (!vectorSnap.exists()) {
            return null;
        }

        return vectorSnap.data() as ExtendedProficiencyVector;

    } catch (error) {
        console.error('Error getting extended proficiency:', error);
        return null;
    }
};
