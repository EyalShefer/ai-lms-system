/**
 * Adaptive Learning Feature Flags
 *
 * These flags control the gradual rollout of advanced adaptive features.
 * All flags default to FALSE to preserve existing behavior.
 *
 * To enable a feature:
 * 1. Set the flag to true
 * 2. Monitor metrics in dashboard
 * 3. If issues occur, set back to false
 */

export interface AdaptiveFeatureFlags {
    /**
     * Use IRT-calibrated difficulty instead of AI estimates
     * When enabled: Uses real student data to determine question difficulty
     * When disabled: Uses metadata.difficulty_level (AI estimate)
     */
    useIrtDifficulty: boolean;

    /**
     * Consider learning trend in variant selection
     * When enabled: Students improving fast get less scaffolding, declining get more
     * When disabled: Only current mastery matters
     */
    useTrendAnalysis: boolean;

    /**
     * Apply forgetting curve to mastery
     * When enabled: Mastery decays over time since last practice
     * When disabled: Mastery stays constant
     */
    useForgettingCurve: boolean;

    /**
     * Enable A/B testing for policy parameters
     * When enabled: Students may be assigned to experiment variants
     * When disabled: All students get default policy
     */
    enableABTesting: boolean;

    /**
     * Use prerequisite mastery in variant selection
     * When enabled: Weak prerequisites lead to easier variants
     * When disabled: Only current topic mastery matters
     */
    usePrerequisiteCheck: boolean;
}

/**
 * Current feature flag settings
 *
 * IMPORTANT: All features start DISABLED to ensure backwards compatibility
 */
export const ADAPTIVE_FEATURE_FLAGS: AdaptiveFeatureFlags = {
    useIrtDifficulty: false,
    useTrendAnalysis: false,
    useForgettingCurve: false,
    enableABTesting: false,
    usePrerequisiteCheck: false,
};

/**
 * Check if a specific feature is enabled
 */
export const isFeatureEnabled = (feature: keyof AdaptiveFeatureFlags): boolean => {
    return ADAPTIVE_FEATURE_FLAGS[feature] ?? false;
};

/**
 * Get all enabled features (for logging/debugging)
 */
export const getEnabledFeatures = (): string[] => {
    return Object.entries(ADAPTIVE_FEATURE_FLAGS)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature);
};
