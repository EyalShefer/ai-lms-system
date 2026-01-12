/**
 * Usage Tracking & License Quota Service
 *
 * Provides centralized token tracking, quota management, and usage logging
 * for all AI operations in the system.
 */

import * as logger from "firebase-functions/logger";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { v4 as uuidv4 } from 'uuid';

const db = getFirestore();

// ============================================================================
// Types (mirroring frontend types)
// ============================================================================

export type AICallType =
    | 'lesson_skeleton'
    | 'step_content'
    | 'podcast'
    | 'mind_map'
    | 'grading'
    | 'image_generation'
    | 'transcription'
    | 'chat'
    | 'validation'
    | 'refinement'
    | 'exam_generation'
    | 'student_analysis'
    | 'class_analysis'
    | 'question_generation';

export type AIProvider = 'openai' | 'gemini' | 'dall-e' | 'imagen' | 'whisper';

export interface TokenUsage {
    input: number;
    output: number;
    total: number;
}

export interface UsageLogEntry {
    institutionId: string;
    userId: string;
    userRole?: 'admin' | 'teacher' | 'student';
    callType: AICallType;
    provider: AIProvider;
    model: string;
    tokens: TokenUsage;
    units?: {
        images?: number;
        audioSeconds?: number;
    };
    context?: {
        courseId?: string;
        lessonId?: string;
        functionName: string;
    };
    performance?: {
        latencyMs: number;
        cached: boolean;
        retryCount: number;
    };
    status: 'success' | 'error' | 'rate_limited';
    errorMessage?: string;
}

export type QuotaType = 'textTokens' | 'imageGenerations' | 'audioMinutes' | 'podcastGenerations';

export type LicenseTier = 'free' | 'basic' | 'pro' | 'enterprise';

export interface QuotaCheckResult {
    allowed: boolean;
    reason?: 'quota_exceeded' | 'license_expired' | 'feature_disabled' | 'rate_limited' | 'no_institution';
    message: string;
    messageHe: string;
    currentUsage: number;
    limit: number;
    percentUsed: number;
    canUpgrade: boolean;
    resetDate?: Date;
}

// ============================================================================
// Cost Calculation Constants
// ============================================================================

const AI_COST_RATES: Record<string, { input?: number; output?: number; perImage?: number; perMinute?: number }> = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4o': { input: 0.0025, output: 0.01 },
    'gemini-pro': { input: 0.000125, output: 0.000375 },
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'dall-e-3': { perImage: 0.04 },
    'imagen-3': { perImage: 0.04 },
    'gemini-image': { perImage: 0.04 },
    'whisper-1': { perMinute: 0.006 },
};

// Default quotas for each tier
const LICENSE_TIER_QUOTAS: Record<LicenseTier, {
    textTokensMonthly: number;
    imageGenerationsMonthly: number;
    audioMinutesMonthly: number;
    podcastGenerationsMonthly: number;
    allowOverage: boolean;
    maxOveragePercent: number;
}> = {
    free: {
        textTokensMonthly: 50000,
        imageGenerationsMonthly: 10,
        audioMinutesMonthly: 10,
        podcastGenerationsMonthly: 2,
        allowOverage: false,
        maxOveragePercent: 0,
    },
    basic: {
        textTokensMonthly: 500000,
        imageGenerationsMonthly: 50,
        audioMinutesMonthly: 60,
        podcastGenerationsMonthly: 10,
        allowOverage: true,
        maxOveragePercent: 10,
    },
    pro: {
        textTokensMonthly: 2000000,
        imageGenerationsMonthly: 200,
        audioMinutesMonthly: 300,
        podcastGenerationsMonthly: 50,
        allowOverage: true,
        maxOveragePercent: 20,
    },
    enterprise: {
        textTokensMonthly: Number.MAX_SAFE_INTEGER,
        imageGenerationsMonthly: Number.MAX_SAFE_INTEGER,
        audioMinutesMonthly: Number.MAX_SAFE_INTEGER,
        podcastGenerationsMonthly: Number.MAX_SAFE_INTEGER,
        allowOverage: true,
        maxOveragePercent: 100,
    },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate estimated cost for a token-based operation
 */
export function calculateTokenCost(model: string, tokens: TokenUsage): number {
    const rates = AI_COST_RATES[model];
    if (rates && rates.input !== undefined && rates.output !== undefined) {
        return (tokens.input / 1000 * rates.input) + (tokens.output / 1000 * rates.output);
    }
    // Default estimate for unknown models
    return tokens.total / 1000 * 0.0003;
}

/**
 * Calculate cost for image generation
 */
export function calculateImageCost(model: string, count: number): number {
    const rates = AI_COST_RATES[model];
    if (rates && rates.perImage !== undefined) {
        return rates.perImage * count;
    }
    return 0.04 * count; // Default
}

/**
 * Calculate cost for audio transcription
 */
export function calculateAudioCost(model: string, durationSeconds: number): number {
    const durationMinutes = durationSeconds / 60;
    const rates = AI_COST_RATES[model] || AI_COST_RATES['whisper-1'];
    if (rates && rates.perMinute !== undefined) {
        return rates.perMinute * durationMinutes;
    }
    return 0.006 * durationMinutes; // Default
}

/**
 * Map call type to quota type
 */
function mapCallTypeToQuotaType(callType: AICallType): QuotaType {
    switch (callType) {
        case 'image_generation':
            return 'imageGenerations';
        case 'transcription':
            return 'audioMinutes';
        case 'podcast':
            return 'podcastGenerations';
        default:
            return 'textTokens';
    }
}

/**
 * Get current month partition key
 */
function getPartitionKey(institutionId: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${institutionId}_${year}-${month}`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get institution ID for a user
 * Returns null if user doesn't belong to an institution (uses personal free tier)
 */
export async function getInstitutionForUser(userId: string): Promise<string | null> {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return null;
        }
        const userData = userDoc.data();
        return userData?.institutionId || null;
    } catch (error) {
        logger.error('Error getting institution for user:', error);
        return null;
    }
}

/**
 * Get license for an institution
 * If no institution, returns a virtual "free" license for personal use
 */
export async function getLicenseForInstitution(institutionId: string | null): Promise<{
    tier: LicenseTier;
    status: 'active' | 'expired' | 'suspended' | 'trial';
    quotas: typeof LICENSE_TIER_QUOTAS['free'];
    institutionId: string | null;
    features: Record<string, boolean>;
}> {
    // Personal user (no institution) - free tier
    if (!institutionId) {
        return {
            tier: 'free',
            status: 'active',
            quotas: LICENSE_TIER_QUOTAS.free,
            institutionId: null,
            features: {
                lessonGeneration: true,
                examGeneration: true,
                imageGeneration: true,
                podcastGeneration: true,
                mindMapGeneration: true,
                knowledgeBase: false,
                advancedAnalytics: false,
            },
        };
    }

    try {
        // Get institution to find license ID
        const institutionDoc = await db.collection('institutions').doc(institutionId).get();
        if (!institutionDoc.exists) {
            logger.warn(`Institution ${institutionId} not found, using free tier`);
            return {
                tier: 'free',
                status: 'active',
                quotas: LICENSE_TIER_QUOTAS.free,
                institutionId,
                features: {
                    lessonGeneration: true,
                    examGeneration: true,
                    imageGeneration: true,
                    podcastGeneration: true,
                    mindMapGeneration: true,
                    knowledgeBase: false,
                    advancedAnalytics: false,
                },
            };
        }

        const institution = institutionDoc.data()!;
        const licenseId = institution.licenseId;

        if (!licenseId) {
            // Institution without license - free tier
            return {
                tier: 'free',
                status: 'active',
                quotas: LICENSE_TIER_QUOTAS.free,
                institutionId,
                features: {
                    lessonGeneration: true,
                    examGeneration: true,
                    imageGeneration: true,
                    podcastGeneration: true,
                    mindMapGeneration: true,
                    knowledgeBase: false,
                    advancedAnalytics: false,
                },
            };
        }

        // Get license document
        const licenseDoc = await db.collection('licenses').doc(licenseId).get();
        if (!licenseDoc.exists) {
            logger.warn(`License ${licenseId} not found, using free tier`);
            return {
                tier: 'free',
                status: 'active',
                quotas: LICENSE_TIER_QUOTAS.free,
                institutionId,
                features: {
                    lessonGeneration: true,
                    examGeneration: true,
                    imageGeneration: true,
                    podcastGeneration: true,
                    mindMapGeneration: true,
                    knowledgeBase: false,
                    advancedAnalytics: false,
                },
            };
        }

        const license = licenseDoc.data()!;
        const tier = license.tier as LicenseTier;

        return {
            tier,
            status: license.status || 'active',
            quotas: {
                textTokensMonthly: license.quotas?.textTokensMonthly ?? LICENSE_TIER_QUOTAS[tier].textTokensMonthly,
                imageGenerationsMonthly: license.quotas?.imageGenerationsMonthly ?? LICENSE_TIER_QUOTAS[tier].imageGenerationsMonthly,
                audioMinutesMonthly: license.quotas?.audioMinutesMonthly ?? LICENSE_TIER_QUOTAS[tier].audioMinutesMonthly,
                podcastGenerationsMonthly: license.quotas?.podcastGenerationsMonthly ?? LICENSE_TIER_QUOTAS[tier].podcastGenerationsMonthly,
                allowOverage: license.overagePolicy?.allowOverage ?? LICENSE_TIER_QUOTAS[tier].allowOverage,
                maxOveragePercent: license.overagePolicy?.maxOveragePercent ?? LICENSE_TIER_QUOTAS[tier].maxOveragePercent,
            },
            institutionId,
            features: license.features || {
                lessonGeneration: true,
                examGeneration: true,
                imageGeneration: true,
                podcastGeneration: true,
                mindMapGeneration: true,
                knowledgeBase: tier !== 'free',
                advancedAnalytics: tier === 'pro' || tier === 'enterprise',
            },
        };
    } catch (error) {
        logger.error('Error getting license:', error);
        // Fallback to free tier on error
        return {
            tier: 'free',
            status: 'active',
            quotas: LICENSE_TIER_QUOTAS.free,
            institutionId,
            features: {
                lessonGeneration: true,
                examGeneration: true,
                imageGeneration: true,
                podcastGeneration: true,
                mindMapGeneration: true,
                knowledgeBase: false,
                advancedAnalytics: false,
            },
        };
    }
}

/**
 * Get current usage for an institution or personal user
 */
export async function getCurrentUsage(institutionId: string | null, userId: string): Promise<{
    textTokensUsed: number;
    imageGenerationsUsed: number;
    audioMinutesUsed: number;
    podcastGenerationsUsed: number;
}> {
    const partitionKey = getPartitionKey(institutionId || `personal_${userId}`);

    try {
        // Query aggregations for current month
        const aggQuery = await db.collection('usage_aggregations')
            .where('partition', '==', partitionKey)
            .where('period', '==', 'monthly')
            .limit(1)
            .get();

        if (aggQuery.empty) {
            return {
                textTokensUsed: 0,
                imageGenerationsUsed: 0,
                audioMinutesUsed: 0,
                podcastGenerationsUsed: 0,
            };
        }

        const agg = aggQuery.docs[0].data();
        return {
            textTokensUsed: agg.totals?.totalTokens || 0,
            imageGenerationsUsed: agg.totals?.imagesGenerated || 0,
            audioMinutesUsed: agg.totals?.audioMinutesProcessed || 0,
            podcastGenerationsUsed: agg.totals?.podcastsGenerated || 0,
        };
    } catch (error) {
        logger.error('Error getting current usage:', error);
        return {
            textTokensUsed: 0,
            imageGenerationsUsed: 0,
            audioMinutesUsed: 0,
            podcastGenerationsUsed: 0,
        };
    }
}

/**
 * Check if a user has quota for a specific operation
 */
export async function checkQuota(
    userId: string,
    callType: AICallType,
    estimatedUsage?: number
): Promise<QuotaCheckResult> {
    const institutionId = await getInstitutionForUser(userId);
    const license = await getLicenseForInstitution(institutionId);

    // Check license status
    if (license.status === 'expired') {
        return {
            allowed: false,
            reason: 'license_expired',
            message: 'Your license has expired',
            messageHe: 'הרישיון שלך פג תוקף. אנא חדש את המנוי.',
            currentUsage: 0,
            limit: 0,
            percentUsed: 100,
            canUpgrade: true,
        };
    }

    if (license.status === 'suspended') {
        return {
            allowed: false,
            reason: 'license_expired',
            message: 'Your license has been suspended',
            messageHe: 'הרישיון שלך הושעה. אנא פנה לתמיכה.',
            currentUsage: 0,
            limit: 0,
            percentUsed: 100,
            canUpgrade: false,
        };
    }

    // Check feature enabled
    const featureMap: Record<AICallType, string> = {
        lesson_skeleton: 'lessonGeneration',
        step_content: 'lessonGeneration',
        exam_generation: 'examGeneration',
        image_generation: 'imageGeneration',
        podcast: 'podcastGeneration',
        mind_map: 'mindMapGeneration',
        grading: 'lessonGeneration',
        transcription: 'lessonGeneration',
        chat: 'lessonGeneration',
        validation: 'lessonGeneration',
        refinement: 'lessonGeneration',
        student_analysis: 'advancedAnalytics',
        class_analysis: 'advancedAnalytics',
        question_generation: 'lessonGeneration',
    };

    const requiredFeature = featureMap[callType];
    if (requiredFeature && !license.features[requiredFeature]) {
        return {
            allowed: false,
            reason: 'feature_disabled',
            message: `This feature is not included in your ${license.tier} plan`,
            messageHe: `תכונה זו אינה כלולה בתוכנית ${license.tier === 'free' ? 'החינמית' : 'שלך'}. שדרג כדי להשתמש בה.`,
            currentUsage: 0,
            limit: 0,
            percentUsed: 0,
            canUpgrade: license.tier !== 'enterprise',
        };
    }

    // Get current usage
    const usage = await getCurrentUsage(institutionId, userId);
    const quotaType = mapCallTypeToQuotaType(callType);

    // Get relevant limits and usage
    let currentUsage: number;
    let limit: number;

    switch (quotaType) {
        case 'imageGenerations':
            currentUsage = usage.imageGenerationsUsed;
            limit = license.quotas.imageGenerationsMonthly;
            break;
        case 'audioMinutes':
            currentUsage = usage.audioMinutesUsed;
            limit = license.quotas.audioMinutesMonthly;
            break;
        case 'podcastGenerations':
            currentUsage = usage.podcastGenerationsUsed;
            limit = license.quotas.podcastGenerationsMonthly;
            break;
        default:
            currentUsage = usage.textTokensUsed;
            limit = license.quotas.textTokensMonthly;
    }

    const percentUsed = limit === Number.MAX_SAFE_INTEGER ? 0 : (currentUsage / limit) * 100;

    // Check if quota exceeded
    if (limit !== Number.MAX_SAFE_INTEGER && currentUsage >= limit) {
        const overageLimit = license.quotas.allowOverage
            ? limit * (1 + license.quotas.maxOveragePercent / 100)
            : limit;

        if (currentUsage >= overageLimit) {
            const quotaNames: Record<QuotaType, string> = {
                textTokens: 'טוקנים',
                imageGenerations: 'תמונות',
                audioMinutes: 'דקות אודיו',
                podcastGenerations: 'פודקאסטים',
            };

            return {
                allowed: false,
                reason: 'quota_exceeded',
                message: `You've exceeded your monthly ${quotaType} quota`,
                messageHe: `חרגת ממכסת ה${quotaNames[quotaType]} החודשית. ${license.tier !== 'enterprise' ? 'שדרג את התוכנית או המתן לאיפוס בתחילת החודש.' : ''}`,
                currentUsage,
                limit,
                percentUsed: Math.round(percentUsed),
                canUpgrade: license.tier !== 'enterprise',
                resetDate: getNextMonthStart(),
            };
        }
    }

    return {
        allowed: true,
        currentUsage,
        limit,
        percentUsed: Math.round(percentUsed),
        canUpgrade: license.tier !== 'enterprise',
        message: 'OK',
        messageHe: 'בסדר',
        resetDate: getNextMonthStart(),
    };
}

/**
 * Get the start of next month
 */
function getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Log usage for an AI call
 */
export async function logUsage(entry: UsageLogEntry): Promise<string> {
    const requestId = uuidv4();
    const now = Timestamp.now();
    const institutionId = entry.institutionId || `personal_${entry.userId}`;
    const partition = getPartitionKey(institutionId);

    // Calculate cost
    let estimatedCostUSD = 0;
    if (entry.tokens.total > 0) {
        estimatedCostUSD = calculateTokenCost(entry.model, entry.tokens);
    }
    if (entry.units?.images) {
        estimatedCostUSD += calculateImageCost(entry.model, entry.units.images);
    }
    if (entry.units?.audioSeconds) {
        estimatedCostUSD += calculateAudioCost(entry.model, entry.units.audioSeconds);
    }

    const logEntry = {
        id: requestId,
        institutionId,
        userId: entry.userId,
        userRole: entry.userRole || 'teacher',
        callType: entry.callType,
        provider: entry.provider,
        model: entry.model,
        tokens: entry.tokens,
        units: entry.units || null,
        cost: {
            estimatedUSD: estimatedCostUSD,
            tokenCost: calculateTokenCost(entry.model, entry.tokens),
        },
        context: {
            ...entry.context,
            functionName: entry.context?.functionName || entry.callType,
            requestId,
        },
        performance: entry.performance || {
            latencyMs: 0,
            cached: false,
            retryCount: 0,
        },
        status: entry.status,
        errorMessage: entry.errorMessage || null,
        timestamp: now,
        partition,
    };

    try {
        // Write log entry
        await db.collection('usage_logs').doc(requestId).set(logEntry);

        // Update aggregation (increment counters)
        await updateAggregation(institutionId, entry);

        logger.info(`Usage logged: ${requestId} - ${entry.callType} - ${entry.tokens.total} tokens`);
        return requestId;
    } catch (error) {
        logger.error('Error logging usage:', error);
        throw error;
    }
}

/**
 * Update usage aggregation counters
 */
async function updateAggregation(institutionId: string, entry: UsageLogEntry): Promise<void> {
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const aggId = `${institutionId}_${periodKey}_monthly`;
    const partition = getPartitionKey(institutionId);

    const aggRef = db.collection('usage_aggregations').doc(aggId);

    try {
        await db.runTransaction(async (transaction) => {
            const aggDoc = await transaction.get(aggRef);

            if (!aggDoc.exists) {
                // Create new aggregation document
                transaction.set(aggRef, {
                    id: aggId,
                    institutionId,
                    period: 'monthly',
                    periodKey,
                    partition,
                    totals: {
                        totalCalls: 1,
                        successfulCalls: entry.status === 'success' ? 1 : 0,
                        failedCalls: entry.status !== 'success' ? 1 : 0,
                        cachedCalls: entry.performance?.cached ? 1 : 0,
                        inputTokens: entry.tokens.input,
                        outputTokens: entry.tokens.output,
                        totalTokens: entry.tokens.total,
                        imagesGenerated: entry.units?.images || 0,
                        audioMinutesProcessed: (entry.units?.audioSeconds || 0) / 60,
                        podcastsGenerated: entry.callType === 'podcast' ? 1 : 0,
                        estimatedCostUSD: calculateTokenCost(entry.model, entry.tokens),
                    },
                    byCallType: {
                        [entry.callType]: {
                            calls: 1,
                            tokens: entry.tokens.total,
                            cost: calculateTokenCost(entry.model, entry.tokens),
                        },
                    },
                    byProvider: {
                        [entry.provider]: {
                            calls: 1,
                            tokens: entry.tokens.total,
                            cost: calculateTokenCost(entry.model, entry.tokens),
                        },
                    },
                    byUser: {
                        [entry.userId]: {
                            calls: 1,
                            tokens: entry.tokens.total,
                            cost: calculateTokenCost(entry.model, entry.tokens),
                        },
                    },
                    startTime: Timestamp.now(),
                    endTime: Timestamp.now(),
                    computedAt: Timestamp.now(),
                });
            } else {
                // Update existing aggregation
                const cost = calculateTokenCost(entry.model, entry.tokens);

                transaction.update(aggRef, {
                    'totals.totalCalls': FieldValue.increment(1),
                    'totals.successfulCalls': FieldValue.increment(entry.status === 'success' ? 1 : 0),
                    'totals.failedCalls': FieldValue.increment(entry.status !== 'success' ? 1 : 0),
                    'totals.cachedCalls': FieldValue.increment(entry.performance?.cached ? 1 : 0),
                    'totals.inputTokens': FieldValue.increment(entry.tokens.input),
                    'totals.outputTokens': FieldValue.increment(entry.tokens.output),
                    'totals.totalTokens': FieldValue.increment(entry.tokens.total),
                    'totals.imagesGenerated': FieldValue.increment(entry.units?.images || 0),
                    'totals.audioMinutesProcessed': FieldValue.increment((entry.units?.audioSeconds || 0) / 60),
                    'totals.podcastsGenerated': FieldValue.increment(entry.callType === 'podcast' ? 1 : 0),
                    'totals.estimatedCostUSD': FieldValue.increment(cost),
                    [`byCallType.${entry.callType}.calls`]: FieldValue.increment(1),
                    [`byCallType.${entry.callType}.tokens`]: FieldValue.increment(entry.tokens.total),
                    [`byCallType.${entry.callType}.cost`]: FieldValue.increment(cost),
                    [`byProvider.${entry.provider}.calls`]: FieldValue.increment(1),
                    [`byProvider.${entry.provider}.tokens`]: FieldValue.increment(entry.tokens.total),
                    [`byProvider.${entry.provider}.cost`]: FieldValue.increment(cost),
                    [`byUser.${entry.userId}.calls`]: FieldValue.increment(1),
                    [`byUser.${entry.userId}.tokens`]: FieldValue.increment(entry.tokens.total),
                    [`byUser.${entry.userId}.cost`]: FieldValue.increment(cost),
                    endTime: Timestamp.now(),
                    computedAt: Timestamp.now(),
                });
            }
        });
    } catch (error) {
        logger.error('Error updating aggregation:', error);
        // Don't throw - aggregation is secondary to logging
    }
}

/**
 * Extract token usage from OpenAI response
 */
export function extractOpenAITokens(response: any): TokenUsage {
    if (response?.usage) {
        return {
            input: response.usage.prompt_tokens || 0,
            output: response.usage.completion_tokens || 0,
            total: response.usage.total_tokens || 0,
        };
    }
    return { input: 0, output: 0, total: 0 };
}

/**
 * Extract token usage from Gemini response
 */
export function extractGeminiTokens(response: any): TokenUsage {
    if (response?.usageMetadata) {
        const input = response.usageMetadata.promptTokenCount || 0;
        const output = response.usageMetadata.candidatesTokenCount || 0;
        return {
            input,
            output,
            total: input + output,
        };
    }
    return { input: 0, output: 0, total: 0 };
}

/**
 * Wrapper to track AI calls with quota enforcement
 */
export async function trackAiCall<T>(
    userId: string,
    callType: AICallType,
    provider: AIProvider,
    model: string,
    context: { courseId?: string; lessonId?: string; functionName: string },
    executeFn: () => Promise<T>
): Promise<T & { _usageTracking?: { requestId: string; tokens: TokenUsage } }> {
    const startTime = Date.now();
    let tokens: TokenUsage = { input: 0, output: 0, total: 0 };

    // Pre-flight quota check
    const quotaCheck = await checkQuota(userId, callType);
    if (!quotaCheck.allowed) {
        const error = new Error(quotaCheck.messageHe) as any;
        error.code = quotaCheck.reason;
        error.details = {
            currentUsage: quotaCheck.currentUsage,
            limit: quotaCheck.limit,
            percentUsed: quotaCheck.percentUsed,
            canUpgrade: quotaCheck.canUpgrade,
            resetDate: quotaCheck.resetDate,
        };
        throw error;
    }

    const institutionId = await getInstitutionForUser(userId);

    try {
        // Execute the AI call
        const result = await executeFn();

        // Extract tokens from result
        if (provider === 'openai') {
            tokens = extractOpenAITokens(result);
        } else if (provider === 'gemini') {
            tokens = extractGeminiTokens(result);
        }

        // Log successful usage
        const requestId = await logUsage({
            institutionId: institutionId || `personal_${userId}`,
            userId,
            callType,
            provider,
            model,
            tokens,
            context,
            performance: {
                latencyMs: Date.now() - startTime,
                cached: false,
                retryCount: 0,
            },
            status: 'success',
        });

        // Check soft limits and create notifications if needed
        await checkAndNotifySoftLimits(userId, institutionId);

        return {
            ...result,
            _usageTracking: { requestId, tokens },
        };
    } catch (error: any) {
        // Log failed attempt
        await logUsage({
            institutionId: institutionId || `personal_${userId}`,
            userId,
            callType,
            provider,
            model,
            tokens: { input: 0, output: 0, total: 0 },
            context,
            performance: {
                latencyMs: Date.now() - startTime,
                cached: false,
                retryCount: 0,
            },
            status: 'error',
            errorMessage: error.message,
        }).catch(logError => logger.error('Failed to log error usage:', logError));

        throw error;
    }
}

/**
 * Check soft limits and create notifications
 */
async function checkAndNotifySoftLimits(userId: string, institutionId: string | null): Promise<void> {
    try {
        const license = await getLicenseForInstitution(institutionId);
        const usage = await getCurrentUsage(institutionId, userId);

        const checks = [
            { used: usage.textTokensUsed, limit: license.quotas.textTokensMonthly, type: 'טוקנים' },
            { used: usage.imageGenerationsUsed, limit: license.quotas.imageGenerationsMonthly, type: 'תמונות' },
            { used: usage.audioMinutesUsed, limit: license.quotas.audioMinutesMonthly, type: 'דקות אודיו' },
        ];

        for (const check of checks) {
            if (check.limit === Number.MAX_SAFE_INTEGER) continue;

            const percent = (check.used / check.limit) * 100;

            if (percent >= 95) {
                await createNotificationIfNotExists(
                    institutionId || `personal_${userId}`,
                    userId,
                    'quota_critical',
                    `קריטי: השתמשת ב-${Math.round(percent)}% ממכסת ה${check.type} החודשית`,
                    'error'
                );
            } else if (percent >= 80) {
                await createNotificationIfNotExists(
                    institutionId || `personal_${userId}`,
                    userId,
                    'quota_warning',
                    `השתמשת ב-${Math.round(percent)}% ממכסת ה${check.type} החודשית`,
                    'warning'
                );
            }
        }
    } catch (error) {
        logger.error('Error checking soft limits:', error);
    }
}

/**
 * Create notification if one doesn't already exist for this type/month
 */
async function createNotificationIfNotExists(
    institutionId: string,
    userId: string,
    type: string,
    messageHe: string,
    severity: 'info' | 'warning' | 'error'
): Promise<void> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const notificationId = `${institutionId}_${type}_${monthKey}`;

    try {
        const existingDoc = await db.collection('usage_notifications').doc(notificationId).get();
        if (existingDoc.exists) {
            return; // Already notified this month
        }

        await db.collection('usage_notifications').doc(notificationId).set({
            id: notificationId,
            institutionId,
            userId,
            type,
            message: messageHe,
            messageHe,
            severity,
            dismissed: false,
            createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromDate(getNextMonthStart()),
        });
    } catch (error) {
        logger.error('Error creating notification:', error);
    }
}

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Get usage statistics for an institution
 */
export async function getInstitutionUsageStats(institutionId: string): Promise<{
    currentMonth: {
        tokens: number;
        images: number;
        audio: number;
        podcasts: number;
        cost: number;
    };
    byUser: Record<string, { tokens: number; calls: number }>;
    byCallType: Record<string, { tokens: number; calls: number }>;
}> {
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const aggId = `${institutionId}_${periodKey}_monthly`;

    const aggDoc = await db.collection('usage_aggregations').doc(aggId).get();

    if (!aggDoc.exists) {
        return {
            currentMonth: { tokens: 0, images: 0, audio: 0, podcasts: 0, cost: 0 },
            byUser: {},
            byCallType: {},
        };
    }

    const agg = aggDoc.data()!;

    return {
        currentMonth: {
            tokens: agg.totals?.totalTokens || 0,
            images: agg.totals?.imagesGenerated || 0,
            audio: agg.totals?.audioMinutesProcessed || 0,
            podcasts: agg.totals?.podcastsGenerated || 0,
            cost: agg.totals?.estimatedCostUSD || 0,
        },
        byUser: agg.byUser || {},
        byCallType: agg.byCallType || {},
    };
}

/**
 * Get all institutions with usage summary (for super admin)
 */
export async function getAllInstitutionsUsage(): Promise<Array<{
    id: string;
    name: string;
    tier: LicenseTier;
    status: string;
    usage: { tokens: number; images: number; cost: number };
    percentUsed: number;
}>> {
    const institutions = await db.collection('institutions').get();
    const results: Array<{
        id: string;
        name: string;
        tier: LicenseTier;
        status: string;
        usage: { tokens: number; images: number; cost: number };
        percentUsed: number;
    }> = [];

    for (const doc of institutions.docs) {
        const inst = doc.data();
        const license = await getLicenseForInstitution(doc.id);
        const stats = await getInstitutionUsageStats(doc.id);

        const percentUsed = license.quotas.textTokensMonthly === Number.MAX_SAFE_INTEGER
            ? 0
            : (stats.currentMonth.tokens / license.quotas.textTokensMonthly) * 100;

        results.push({
            id: doc.id,
            name: inst.name || 'Unknown',
            tier: license.tier,
            status: license.status,
            usage: {
                tokens: stats.currentMonth.tokens,
                images: stats.currentMonth.images,
                cost: stats.currentMonth.cost,
            },
            percentUsed: Math.round(percentUsed),
        });
    }

    return results;
}
