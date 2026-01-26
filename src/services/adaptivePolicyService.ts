/**
 * Adaptive Policy Service
 *
 * Handles intelligent content flow decisions based on BKT actions:
 * - Challenge Mode: Skip easy content when student excels
 * - Mastery Skip: Jump to next topic when current is mastered
 * - Content Variants: Select appropriate difficulty variants
 *
 * Enhanced with:
 * - Forgetting Curve: Mastery decays over time
 * - Learning Trend: Detect improving/declining students
 * - A/B Testing: Experiment with policy parameters
 */

import type { ActivityBlock } from '../shared/types/courseTypes';
import { MATH_TOPICS, getRecommendedTopics, canLearnTopic } from '../data/topicTaxonomy';
import { getProficiencyVector } from './profileService';
import { isFeatureEnabled } from '../config/adaptiveFeatureFlags';
import {
    getEffectiveMastery,
    getDaysSincePractice,
    getLearningTrendForTopic,
    getExperimentValue,
    selectVariantEnhanced,
    getExtendedProficiency,
} from './adaptiveEnhancementsService';
import type { LearningTrend, SelectVariantOutput } from '../shared/types/adaptiveTypes';

/**
 * BKT Action types from the backend
 */
export type BKTAction = 'continue' | 'challenge' | 'remediate' | 'mastered';

/**
 * Result of policy decision
 */
export interface PolicyDecision {
    action: 'continue' | 'skip' | 'skip_to_topic' | 'load_variant';
    skipCount?: number;           // How many blocks to skip
    targetTopicId?: string;       // Topic to jump to (for mastery skip)
    variantType?: 'הבנה' | 'העמקה'; // Which variant to load (Hebrew: Understanding/Deepening)
    message?: string;             // Feedback message for student
    toast?: {                     // Toast notification config
        type: 'success' | 'info' | 'challenge';
        title: string;
        description: string;
    };
}

/**
 * Configuration for adaptive policy
 */
export interface PolicyConfig {
    enableChallengeMode: boolean;
    enableMasterySkip: boolean;
    challengeSkipThreshold: number;    // How many easy blocks to skip (default: 2)
    masteryThreshold: number;          // Mastery level to trigger skip (default: 0.95)
    minBlocksBeforeSkip: number;       // Minimum blocks before allowing skip (default: 3)
}

const DEFAULT_CONFIG: PolicyConfig = {
    enableChallengeMode: true,
    enableMasterySkip: true,
    challengeSkipThreshold: 2,
    masteryThreshold: 0.95,
    minBlocksBeforeSkip: 3
};

/**
 * Identifies easy blocks that can be skipped in challenge mode
 */
const findEasyBlocksToSkip = (
    queue: ActivityBlock[],
    currentIndex: number,
    maxSkip: number
): number => {
    let skipCount = 0;
    const easyBloomLevels = ['Remember', 'Understand'];
    const easyTypes = ['multiple-choice', 'true_false_speed', 'memory_game'];

    for (let i = currentIndex + 1; i < queue.length && skipCount < maxSkip; i++) {
        const block = queue[i];

        // Check if block is "easy"
        const isEasyBloom = block.metadata?.bloom_taxonomy &&
            easyBloomLevels.includes(block.metadata.bloom_taxonomy);
        const isEasyType = easyTypes.includes(block.type);
        const isLowDifficulty = (block.metadata?.difficulty_level ?? 0.5) < 0.4;

        // Skip passive content (text, video) without counting
        const isPassive = ['text', 'pdf', 'video', 'podcast'].includes(block.type);
        if (isPassive) {
            skipCount++;
            continue;
        }

        // Skip easy interactive blocks
        if (isEasyBloom || isEasyType || isLowDifficulty) {
            skipCount++;
        } else {
            // Stop at first non-easy block
            break;
        }
    }

    return skipCount;
};

/**
 * Finds the next topic's first block index
 */
const findNextTopicIndex = (
    queue: ActivityBlock[],
    currentIndex: number,
    currentTopicId: string
): number | null => {
    for (let i = currentIndex + 1; i < queue.length; i++) {
        const block = queue[i];
        const blockTopic = block.metadata?.tags?.[0] || block.metadata?.topic;

        // Found a different topic
        if (blockTopic && blockTopic !== currentTopicId) {
            return i;
        }
    }
    return null;
};

/**
 * Main policy decision function
 */
export const makeAdaptiveDecision = async (
    bktAction: BKTAction,
    mastery: number,
    queue: ActivityBlock[],
    currentIndex: number,
    currentBlock: ActivityBlock,
    userId?: string,
    config: Partial<PolicyConfig> = {}
): Promise<PolicyDecision> => {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Get current topic
    const currentTopicId = currentBlock.metadata?.tags?.[0] ||
        currentBlock.metadata?.topic ||
        'general';

    // Default: continue normally
    const defaultDecision: PolicyDecision = {
        action: 'continue',
        message: undefined
    };

    // --- CHALLENGE MODE ---
    if (bktAction === 'challenge' && cfg.enableChallengeMode) {
        // Only trigger after minimum blocks
        if (currentIndex >= cfg.minBlocksBeforeSkip) {
            const skipCount = findEasyBlocksToSkip(
                queue,
                currentIndex,
                cfg.challengeSkipThreshold
            );

            if (skipCount > 0) {
                return {
                    action: 'skip',
                    skipCount,
                    message: '🌟 מצוין!',
                    toast: {
                        type: 'challenge',
                        title: '🌟 מצוין!',
                        description: 'המשיכו כך!'
                    }
                };
            }
        }

        // No skip possible, but still provide feedback
        return {
            action: 'continue',
            message: '🌟 מצוין!',
            toast: {
                type: 'success',
                title: '🌟 מצוין!',
                description: 'המשיכו כך!'
            }
        };
    }

    // --- MASTERY SKIP ---
    if (bktAction === 'mastered' && cfg.enableMasterySkip) {
        // Find next topic
        const nextTopicIndex = findNextTopicIndex(queue, currentIndex, currentTopicId);

        if (nextTopicIndex !== null) {
            // Check if student can learn next topic (prerequisites met)
            let canProceed = true;
            if (userId) {
                try {
                    const proficiency = await getProficiencyVector(userId);
                    const nextBlock = queue[nextTopicIndex];
                    const nextTopicId = nextBlock.metadata?.tags?.[0] || 'general';

                    if (proficiency?.topics) {
                        canProceed = canLearnTopic(nextTopicId, proficiency.topics, 0.6);
                    }
                } catch (e) {
                    console.error('Failed to check prerequisites:', e);
                }
            }

            if (canProceed) {
                const skippedCount = nextTopicIndex - currentIndex - 1;
                return {
                    action: 'skip_to_topic',
                    skipCount: skippedCount,
                    targetTopicId: queue[nextTopicIndex].metadata?.tags?.[0],
                    message: '🏆 מצוין!',
                    toast: {
                        type: 'success',
                        title: '🏆 מצוין!',
                        description: 'המשיכו כך!'
                    }
                };
            }
        }

        // No next topic or can't proceed
        return {
            action: 'continue',
            message: '🏆 מצוין!',
            toast: {
                type: 'success',
                title: '🏆 מצוין!',
                description: 'המשיכו כך!'
            }
        };
    }

    // --- REMEDIATE (handled elsewhere, just pass through) ---
    if (bktAction === 'remediate') {
        return {
            action: 'continue',
            message: undefined
        };
    }

    return defaultDecision;
};

/**
 * Apply the policy decision to the queue
 * Returns the new index to navigate to
 */
export const applyPolicyDecision = (
    decision: PolicyDecision,
    currentIndex: number,
    queueLength: number
): number => {
    switch (decision.action) {
        case 'skip':
        case 'skip_to_topic':
            const newIndex = currentIndex + (decision.skipCount || 0) + 1;
            return Math.min(newIndex, queueLength - 1);

        case 'continue':
        default:
            return currentIndex + 1;
    }
};

/**
 * Get recommended next topics for a student
 */
export const getNextTopicsForStudent = async (
    userId: string,
    grade: number,
    maxRecommendations: number = 3
): Promise<string[]> => {
    try {
        const proficiency = await getProficiencyVector(userId);
        const masteryVector = proficiency?.topics || {};

        return getRecommendedTopics(masteryVector, grade, maxRecommendations, MATH_TOPICS);
    } catch (e) {
        console.error('Failed to get recommendations:', e);
        return [];
    }
};

/**
 * Check if a block has variants available
 * הבנה = Understanding (easier) variant
 * העמקה = Deepening (harder) variant
 */
export const hasVariants = (block: ActivityBlock): {
    hasHavana: boolean;    // הבנה - easier variant
    hasHaamaka: boolean;   // העמקה - harder variant
} => {
    return {
        hasHavana: !!block.metadata?.הבנה_id || !!block.metadata?.scaffolding_id,
        hasHaamaka: !!block.metadata?.העמקה_id || !!block.metadata?.enrichment_id
    };
};

/**
 * Select appropriate variant based on student performance
 * הבנה = Understanding (easier variant for struggling students)
 * יישום = Application (standard variant)
 * העמקה = Deepening (harder variant for advanced students)
 */
export const selectVariant = (
    block: ActivityBlock,
    mastery: number,
    recentAccuracy: number
): 'יישום' | 'הבנה' | 'העמקה' => {
    // If struggling, use easier variant (הבנה)
    if (mastery < 0.4 && recentAccuracy < 0.5 && (block.metadata?.הבנה_id || block.metadata?.scaffolding_id)) {
        return 'הבנה';
    }

    // If excelling, use harder variant (העמקה)
    // ENHANCED: Lowered threshold from 0.8/0.9 to 0.7/0.85 for proactive enrichment
    if (mastery >= 0.7 && recentAccuracy >= 0.85 && (block.metadata?.העמקה_id || block.metadata?.enrichment_id)) {
        return 'העמקה';
    }

    return 'יישום';
};

/**
 * Determines if enrichment should be offered to a high-performing student
 *
 * STUDENT AGENCY: This function checks if conditions are met to OFFER enrichment,
 * but the student will have the choice to accept or decline.
 *
 * Pedagogical rationale:
 * - Based on mastery and accuracy (no streak/combo requirement)
 * - Students are not penalized for occasional mistakes
 * - Proactive enrichment for capable students
 *
 * @param mastery - Current topic mastery (0-1)
 * @param recentAccuracy - Recent accuracy rate (0-1)
 * @param block - The current block (to check if enrichment exists)
 * @returns true if enrichment should be offered
 */
export const shouldOfferEnrichment = (
    mastery: number,
    recentAccuracy: number,
    block: ActivityBlock
): boolean => {
    // Check if enrichment variant exists for this block
    const hasEnrichment = !!(block.metadata?.העמקה_id || block.metadata?.enrichment_id);

    if (!hasEnrichment) {
        return false; // No enrichment available
    }

    // Pedagogical thresholds - based on mastery and accuracy only (no combo penalty)
    const MASTERY_THRESHOLD = 0.7;
    const ACCURACY_THRESHOLD = 0.85;

    // Offer enrichment if student demonstrates good understanding
    return (
        mastery >= MASTERY_THRESHOLD &&
        recentAccuracy >= ACCURACY_THRESHOLD
    );
};

/**
 * Determine initial variant based on existing student profile.
 * Called at the START of a learning session to give personalized starting level.
 *
 * @param topicMastery - The student's existing mastery for this specific topic (0-1)
 * @param block - The content block being delivered
 * @returns The variant to start with:
 *   - הבנה (Understanding) - for struggling students
 *   - יישום (Application) - standard level
 *   - העמקה (Deepening) - for advanced students
 */
export const getInitialVariant = (
    topicMastery: number | undefined,
    block: ActivityBlock
): 'יישום' | 'הבנה' | 'העמקה' => {
    // If no existing profile data, start with יישום (standard)
    if (topicMastery === undefined) {
        return 'יישום';
    }

    // High existing mastery in this topic → start with העמקה (deepening)
    if (topicMastery > 0.75 && (block.metadata?.העמקה_id || block.metadata?.enrichment_id)) {
        console.log(`🎯 Initial variant: העמקה (existing mastery: ${topicMastery.toFixed(2)})`);
        return 'העמקה';
    }

    // Low existing mastery in this topic → start with הבנה (understanding)
    if (topicMastery < 0.35 && (block.metadata?.הבנה_id || block.metadata?.scaffolding_id)) {
        console.log(`🎯 Initial variant: הבנה (existing mastery: ${topicMastery.toFixed(2)})`);
        return 'הבנה';
    }

    // Middle ground → יישום (application/standard)
    return 'יישום';
};

/**
 * Get the initial mastery and accuracy values for a student starting a course.
 * Uses existing profile data if available.
 */
export const getInitialStudentState = async (
    userId: string,
    topicId: string
): Promise<{ mastery: number; accuracy: number }> => {
    try {
        const proficiency = await getProficiencyVector(userId);

        if (proficiency?.topics && proficiency.topics[topicId] !== undefined) {
            // Use existing topic mastery as starting point
            const existingMastery = proficiency.topics[topicId];

            // For accuracy, we assume a neutral value until they answer questions
            // But we bias it based on their mastery level
            const estimatedAccuracy = existingMastery > 0.7 ? 0.75 : existingMastery < 0.3 ? 0.4 : 0.6;

            console.log(`📊 Loaded existing profile for ${userId}: topic=${topicId}, mastery=${existingMastery.toFixed(2)}`);

            return {
                mastery: existingMastery,
                accuracy: estimatedAccuracy
            };
        }

        // No existing data - return defaults
        return { mastery: 0.5, accuracy: 0.5 };

    } catch (e) {
        console.error('Failed to load student profile:', e);
        return { mastery: 0.5, accuracy: 0.5 };
    }
};

// ============================================================================
// ENHANCED VARIANT SELECTION (with feature flags)
// ============================================================================

/**
 * Enhanced variant selection that uses all available adaptive signals.
 *
 * This function extends selectVariant with:
 * - Forgetting Curve: Considers time since last practice
 * - Learning Trend: Considers if student is improving/declining
 * - A/B Testing: Can use experimental thresholds
 *
 * BACKWARDS COMPATIBLE: When all feature flags are disabled,
 * this function behaves exactly like the original selectVariant.
 *
 * @param block - The activity block to select variant for
 * @param mastery - Current mastery level (0-1)
 * @param recentAccuracy - Recent accuracy rate (0-1)
 * @param userId - Optional: User ID for fetching enhanced data
 * @param topicId - Optional: Topic ID for fetching enhanced data
 * @returns Promise resolving to variant selection with metadata
 *
 * @example
 * // Basic usage (backwards compatible)
 * const result = await selectVariantWithEnhancements(block, 0.35, 0.4);
 * console.log(result.variant); // 'הבנה'
 *
 * @example
 * // Enhanced usage with user context
 * const result = await selectVariantWithEnhancements(block, 0.35, 0.4, userId, 'fractions');
 * console.log(result.variant); // May differ based on trend, forgetting, etc.
 * console.log(result.factors); // Shows what influenced the decision
 */
export const selectVariantWithEnhancements = async (
    block: ActivityBlock,
    mastery: number,
    recentAccuracy: number,
    userId?: string,
    topicId?: string
): Promise<SelectVariantOutput> => {
    // If no enhanced features enabled or no user context, use simple logic
    const anyEnhancementEnabled =
        isFeatureEnabled('useForgettingCurve') ||
        isFeatureEnabled('useTrendAnalysis') ||
        isFeatureEnabled('enableABTesting') ||
        isFeatureEnabled('usePrerequisiteCheck');

    if (!anyEnhancementEnabled || !userId) {
        // Fall back to original logic
        const variant = selectVariant(block, mastery, recentAccuracy);
        return {
            variant,
            factors: {
                basedOnMastery: true,
                basedOnAccuracy: true,
                basedOnTrend: false,
                basedOnForgetting: false,
                basedOnExperiment: false,
                basedOnPrerequisites: false,
            },
            effectiveValues: {
                mastery,
                threshold: 0.4,
            },
        };
    }

    // Gather enhanced data
    let trend: LearningTrend | undefined;
    let daysSincePractice: number | undefined;
    let experimentThreshold: number | undefined;

    try {
        // Get extended proficiency data
        if (topicId) {
            const extendedProfile = await getExtendedProficiency(userId);

            if (extendedProfile) {
                // Get trend
                if (isFeatureEnabled('useTrendAnalysis') && extendedProfile.trends) {
                    trend = extendedProfile.trends[topicId];
                }

                // Get days since practice
                if (isFeatureEnabled('useForgettingCurve') && extendedProfile.lastPracticeDate) {
                    const lastPractice = extendedProfile.lastPracticeDate[topicId];
                    if (lastPractice) {
                        daysSincePractice = getDaysSincePractice(lastPractice);
                    }
                }
            }
        }

        // Get experiment threshold if A/B testing enabled
        if (isFeatureEnabled('enableABTesting')) {
            experimentThreshold = await getExperimentValue(
                userId,
                'scaffolding_threshold_experiment',
                0.4 // default threshold
            );
        }

    } catch (error) {
        console.error('Error gathering enhanced data:', error);
        // Continue with available data
    }

    // Use enhanced selection
    return selectVariantEnhanced(block, {
        mastery,
        recentAccuracy,
        trend,
        daysSincePractice,
        experimentThreshold,
    });
};

/**
 * Get enhanced initial student state including trend and effective mastery
 *
 * Extends getInitialStudentState with:
 * - Effective mastery (after forgetting curve)
 * - Learning trend for the topic
 * - Days since last practice
 */
export const getEnhancedStudentState = async (
    userId: string,
    topicId: string
): Promise<{
    mastery: number;
    effectiveMastery: number;
    accuracy: number;
    trend: LearningTrend;
    daysSincePractice: number;
}> => {
    try {
        const extendedProfile = await getExtendedProficiency(userId);

        if (!extendedProfile?.topics || extendedProfile.topics[topicId] === undefined) {
            // No existing data - return defaults
            return {
                mastery: 0.5,
                effectiveMastery: 0.5,
                accuracy: 0.5,
                trend: 'insufficient_data',
                daysSincePractice: 0,
            };
        }

        const storedMastery = extendedProfile.topics[topicId];

        // Calculate days since practice
        let daysSincePractice = 0;
        if (extendedProfile.lastPracticeDate?.[topicId]) {
            daysSincePractice = getDaysSincePractice(extendedProfile.lastPracticeDate[topicId]);
        }

        // Calculate effective mastery
        const effectiveMastery = getEffectiveMastery(storedMastery, daysSincePractice);

        // Get trend
        const trend = extendedProfile.trends?.[topicId] || 'insufficient_data';

        // Estimate accuracy based on mastery
        const estimatedAccuracy = effectiveMastery > 0.7 ? 0.75 : effectiveMastery < 0.3 ? 0.4 : 0.6;

        console.log(`📊 Enhanced profile for ${userId}/${topicId}:`, {
            storedMastery: storedMastery.toFixed(3),
            effectiveMastery: effectiveMastery.toFixed(3),
            daysSincePractice,
            trend,
        });

        return {
            mastery: storedMastery,
            effectiveMastery,
            accuracy: estimatedAccuracy,
            trend,
            daysSincePractice,
        };

    } catch (e) {
        console.error('Failed to load enhanced student profile:', e);
        return {
            mastery: 0.5,
            effectiveMastery: 0.5,
            accuracy: 0.5,
            trend: 'insufficient_data',
            daysSincePractice: 0,
        };
    }
};
