import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Institution Types
// ============================================================================

export type InstitutionType = 'school' | 'university' | 'organization' | 'individual';
export type LicenseStatus = 'active' | 'suspended' | 'expired' | 'trial' | 'grace_period';

export interface InstitutionStats {
    totalTeachers: number;
    totalStudents: number;
    totalCoursesCreated: number;
    totalAiCalls: number;
    lastActivityAt: Timestamp | null;
}

export interface InstitutionSettings {
    allowTeacherInvites: boolean;
    defaultLanguage: 'he' | 'en' | 'ar';
    enableAdvancedFeatures: boolean;
    customBranding?: {
        logoUrl: string;
        primaryColor: string;
    };
}

export interface Institution {
    id: string;
    name: string;
    slug: string;
    type: InstitutionType;
    contactEmail: string;
    billingEmail?: string;
    phone?: string;
    address?: {
        street: string;
        city: string;
        country: string;
        zipCode?: string;
    };
    licenseId: string;
    licenseStatus: LicenseStatus;
    stats: InstitutionStats;
    settings: InstitutionSettings;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
}

// ============================================================================
// License Types
// ============================================================================

export type LicenseTier = 'free' | 'basic' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';

export interface LicenseQuotas {
    // Text AI (GPT-4o-mini, Gemini)
    textTokensMonthly: number;
    textTokensUsed: number;

    // Image Generation (DALL-E, Imagen, Gemini Image)
    imageGenerationsMonthly: number;
    imageGenerationsUsed: number;

    // Audio (Whisper transcription)
    audioMinutesMonthly: number;
    audioMinutesUsed: number;

    // Podcast Generation
    podcastGenerationsMonthly: number;
    podcastGenerationsUsed: number;

    // Teacher/Student Limits
    maxTeachers: number;
    maxStudentsPerTeacher: number;
}

export interface OveragePolicy {
    allowOverage: boolean;
    overageRatePer1K: number; // Cost per 1K tokens over limit (ILS)
    maxOveragePercent: number; // Maximum % over quota allowed
    hardLimit: boolean; // Block at hard limit
}

export interface LicenseFeatures {
    lessonGeneration: boolean;
    examGeneration: boolean;
    imageGeneration: boolean;
    podcastGeneration: boolean;
    mindMapGeneration: boolean;
    knowledgeBase: boolean;
    referenceExams: boolean;
    advancedAnalytics: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
}

export interface LicensePricing {
    monthlyPrice: number;
    yearlyPrice: number;
    currency: 'ILS' | 'USD';
}

export interface License {
    id: string;
    institutionId: string;
    tier: LicenseTier;
    startDate: Timestamp;
    endDate: Timestamp | null; // null for lifetime/enterprise
    billingCycle: BillingCycle;
    quotas: LicenseQuotas;
    overagePolicy: OveragePolicy;
    features: LicenseFeatures;
    pricing: LicensePricing;
    status: LicenseStatus;
    gracePeriodEndDate?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastResetAt: Timestamp;
    nextResetAt: Timestamp;
}

// ============================================================================
// License Tier Defaults
// ============================================================================

export const LICENSE_TIER_DEFAULTS: Record<LicenseTier, {
    quotas: LicenseQuotas;
    overagePolicy: OveragePolicy;
    features: LicenseFeatures;
    pricing: LicensePricing;
}> = {
    free: {
        quotas: {
            textTokensMonthly: 50000,
            textTokensUsed: 0,
            imageGenerationsMonthly: 10,
            imageGenerationsUsed: 0,
            audioMinutesMonthly: 10,
            audioMinutesUsed: 0,
            podcastGenerationsMonthly: 2,
            podcastGenerationsUsed: 0,
            maxTeachers: 1,
            maxStudentsPerTeacher: 30,
        },
        overagePolicy: {
            allowOverage: false,
            overageRatePer1K: 0,
            maxOveragePercent: 0,
            hardLimit: true,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: false,
            referenceExams: false,
            advancedAnalytics: false,
            apiAccess: false,
            whiteLabel: false,
        },
        pricing: {
            monthlyPrice: 0,
            yearlyPrice: 0,
            currency: 'ILS',
        },
    },
    basic: {
        quotas: {
            textTokensMonthly: 500000,
            textTokensUsed: 0,
            imageGenerationsMonthly: 50,
            imageGenerationsUsed: 0,
            audioMinutesMonthly: 60,
            audioMinutesUsed: 0,
            podcastGenerationsMonthly: 10,
            podcastGenerationsUsed: 0,
            maxTeachers: 5,
            maxStudentsPerTeacher: 100,
        },
        overagePolicy: {
            allowOverage: true,
            overageRatePer1K: 0.05,
            maxOveragePercent: 10,
            hardLimit: false,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: true,
            referenceExams: false,
            advancedAnalytics: false,
            apiAccess: false,
            whiteLabel: false,
        },
        pricing: {
            monthlyPrice: 199,
            yearlyPrice: 1990,
            currency: 'ILS',
        },
    },
    pro: {
        quotas: {
            textTokensMonthly: 2000000,
            textTokensUsed: 0,
            imageGenerationsMonthly: 200,
            imageGenerationsUsed: 0,
            audioMinutesMonthly: 300,
            audioMinutesUsed: 0,
            podcastGenerationsMonthly: 50,
            podcastGenerationsUsed: 0,
            maxTeachers: 20,
            maxStudentsPerTeacher: 300,
        },
        overagePolicy: {
            allowOverage: true,
            overageRatePer1K: 0.03,
            maxOveragePercent: 20,
            hardLimit: false,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: true,
            referenceExams: true,
            advancedAnalytics: true,
            apiAccess: false,
            whiteLabel: false,
        },
        pricing: {
            monthlyPrice: 599,
            yearlyPrice: 5990,
            currency: 'ILS',
        },
    },
    enterprise: {
        quotas: {
            textTokensMonthly: Number.MAX_SAFE_INTEGER,
            textTokensUsed: 0,
            imageGenerationsMonthly: Number.MAX_SAFE_INTEGER,
            imageGenerationsUsed: 0,
            audioMinutesMonthly: Number.MAX_SAFE_INTEGER,
            audioMinutesUsed: 0,
            podcastGenerationsMonthly: Number.MAX_SAFE_INTEGER,
            podcastGenerationsUsed: 0,
            maxTeachers: Number.MAX_SAFE_INTEGER,
            maxStudentsPerTeacher: Number.MAX_SAFE_INTEGER,
        },
        overagePolicy: {
            allowOverage: true,
            overageRatePer1K: 0.02,
            maxOveragePercent: 50,
            hardLimit: false,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: true,
            referenceExams: true,
            advancedAnalytics: true,
            apiAccess: true,
            whiteLabel: true,
        },
        pricing: {
            monthlyPrice: 0, // Custom pricing
            yearlyPrice: 0,
            currency: 'ILS',
        },
    },
};

// ============================================================================
// Usage Tracking Types
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

export type AIProvider = 'openai' | 'gemini' | 'gemini-image' | 'whisper';

export interface TokenUsage {
    input: number;
    output: number;
    total: number;
}

export interface UsageUnits {
    images?: number;
    audioSeconds?: number;
}

export interface UsageCost {
    estimatedUSD: number;
    tokenCost: number;
}

export interface UsageContext {
    courseId?: string;
    lessonId?: string;
    functionName: string;
    requestId: string;
}

export interface UsagePerformance {
    latencyMs: number;
    cached: boolean;
    retryCount: number;
}

export interface UsageLog {
    id: string;
    institutionId: string;
    userId: string;
    userRole: 'admin' | 'teacher' | 'student';
    callType: AICallType;
    provider: AIProvider;
    model: string;
    tokens: TokenUsage;
    units?: UsageUnits;
    cost: UsageCost;
    context: UsageContext;
    performance: UsagePerformance;
    status: 'success' | 'error' | 'rate_limited';
    errorMessage?: string;
    timestamp: Timestamp;
    partition: string; // e.g., "inst_abc123_2024-01"
}

// ============================================================================
// Usage Aggregation Types
// ============================================================================

export interface UsageTotals {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    cachedCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    imagesGenerated: number;
    audioMinutesProcessed: number;
    podcastsGenerated: number;
    estimatedCostUSD: number;
}

export interface UsageBreakdown {
    calls: number;
    tokens: number;
    cost: number;
}

export interface UsageAggregation {
    id: string;
    institutionId: string;
    userId?: string; // null for institution-level
    period: 'daily' | 'monthly';
    periodKey: string; // "2024-01-15" or "2024-01"
    totals: UsageTotals;
    byCallType: Record<string, UsageBreakdown>;
    byProvider: Record<string, UsageBreakdown>;
    byUser?: Record<string, UsageBreakdown>; // institution-level only
    startTime: Timestamp;
    endTime: Timestamp;
    computedAt: Timestamp;
}

// ============================================================================
// Quota Check Types
// ============================================================================

export type QuotaExceededReason =
    | 'quota_exceeded'
    | 'license_expired'
    | 'feature_disabled'
    | 'rate_limited'
    | 'max_teachers_reached';

export interface QuotaCheckResult {
    allowed: boolean;
    reason?: QuotaExceededReason;
    message: string;
    messageHe: string;
    currentUsage: number;
    limit: number;
    percentUsed: number;
    canUpgrade: boolean;
    resetDate?: Date;
}

// ============================================================================
// Notification Types
// ============================================================================

export type UsageNotificationType =
    | 'quota_warning'
    | 'quota_critical'
    | 'quota_exceeded'
    | 'license_expiring'
    | 'license_expired'
    | 'overage_charged';

export interface UsageNotification {
    id: string;
    institutionId: string;
    userId?: string;
    type: UsageNotificationType;
    message: string;
    messageHe: string;
    severity: 'info' | 'warning' | 'error';
    dismissed: boolean;
    createdAt: Timestamp;
    expiresAt?: Timestamp;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// User Extension for Institution
// ============================================================================

export interface UserUsageStats {
    currentMonthTokens: number;
    currentMonthImages: number;
    currentMonthAudio: number;
    lastResetAt: Timestamp;
}

export interface UserPermissions {
    canGenerateLessons: boolean;
    canGenerateExams: boolean;
    canGenerateImages: boolean;
    canGeneratePodcasts: boolean;
    canViewInstitutionStats: boolean;
    canManageTeachers: boolean;
}

// Extended user fields (to add to existing UserProfile)
export interface UserInstitutionExtension {
    institutionId?: string;
    role: 'admin' | 'teacher' | 'student';
    usageStats?: UserUsageStats;
    permissions?: UserPermissions;
}

// ============================================================================
// Cost Calculation Constants
// ============================================================================

export const AI_COST_RATES = {
    'gpt-4o-mini': {
        input: 0.00015, // per 1K tokens
        output: 0.0006,
    },
    'gpt-4o': {
        input: 0.0025,
        output: 0.01,
    },
    'gemini-pro': {
        input: 0.000125,
        output: 0.000375,
    },
    'gemini-1.5-pro': {
        input: 0.00125,
        output: 0.005,
    },
    'gemini-2.5-flash-image': {
        perImage: 0.02, // Nano Banana - fast, cheaper
    },
    'gemini-3-pro-image': {
        perImage: 0.04, // Gemini 3 Pro - higher quality
    },
    'gemini-image': {
        perImage: 0.04, // Legacy alias
    },
    'whisper-1': {
        perMinute: 0.006,
    },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

export function calculateTokenCost(
    model: string,
    tokens: TokenUsage
): number {
    const rates = AI_COST_RATES[model as keyof typeof AI_COST_RATES];
    if (rates && 'input' in rates) {
        return (tokens.input / 1000 * rates.input) +
            (tokens.output / 1000 * rates.output);
    }
    // Default estimate for unknown models
    return tokens.total / 1000 * 0.0003;
}

export function calculateImageCost(
    model: string,
    count: number,
    _resolution: string = '1024x1024'
): number {
    // Gemini 2.5 Flash Image (Nano Banana) - faster, cheaper
    if (model === 'gemini-2.5-flash-image' || model === 'nano-banana') {
        return 0.02 * count;
    }
    // Gemini 3 Pro Image - higher quality
    if (model === 'gemini-3-pro-image' || model === 'gemini-image') {
        return 0.04 * count;
    }
    return 0.04 * count; // Default
}

export function calculateAudioCost(
    model: string,
    durationSeconds: number
): number {
    const durationMinutes = durationSeconds / 60;
    if (model === 'whisper-1' || model === 'whisper') {
        return AI_COST_RATES['whisper-1'].perMinute * durationMinutes;
    }
    return 0.006 * durationMinutes; // Default
}

export function formatQuotaUsage(used: number, total: number): string {
    if (total === Number.MAX_SAFE_INTEGER) {
        return `${used.toLocaleString()} (ללא הגבלה)`;
    }
    const percent = Math.round((used / total) * 100);
    return `${used.toLocaleString()} / ${total.toLocaleString()} (${percent}%)`;
}

export function getQuotaStatus(used: number, total: number): 'ok' | 'warning' | 'critical' | 'exceeded' {
    if (total === Number.MAX_SAFE_INTEGER) return 'ok';
    const percent = used / total;
    if (percent >= 1) return 'exceeded';
    if (percent >= 0.95) return 'critical';
    if (percent >= 0.8) return 'warning';
    return 'ok';
}
