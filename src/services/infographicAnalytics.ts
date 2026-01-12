/**
 * Infographic Analytics Service
 * Tracks usage, performance, and cost metrics for infographic generation
 */

import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase';
import type { InfographicType } from './ai/geminiApi';

// --- Types ---

export interface InfographicAnalyticsEvent {
    eventType: 'generation_started' | 'generation_completed' | 'generation_failed' |
               'cache_hit' | 'cache_miss' | 'preview_opened' | 'preview_confirmed' |
               'preview_rejected' | 'type_changed';
    visualType: InfographicType;
    provider?: 'gemini-flash' | 'gemini-pro';  // Only Gemini models supported
    cacheSource?: 'memory' | 'firebase-storage';
    generationTime?: number; // milliseconds
    cost?: number; // USD
    textLength?: number;
    userId?: string;
    courseId?: string;
    timestamp: number;
}

export interface InfographicAnalyticsSummary {
    totalGenerations: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    cacheHitRate: number; // percentage
    totalCost: number; // USD
    costSavings: number; // USD saved due to caching
    averageGenerationTime: number; // milliseconds
    providerUsage: {
        'gemini-flash': number;  // Nano Banana
        'gemini-pro': number;    // Gemini 3 Pro
    };
    typeUsage: Record<InfographicType, number>;
    period: {
        start: number;
        end: number;
    };
}

// --- In-Memory Store (for session analytics) ---

const analyticsStore: InfographicAnalyticsEvent[] = [];

// --- Core Functions ---

/**
 * Track infographic generation start
 */
export const trackGenerationStart = (
    visualType: InfographicType,
    textLength: number,
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'generation_started',
        visualType,
        textLength,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    // Send to Firebase Analytics
    if (analytics) {
        logEvent(analytics, 'infographic_generation_start', {
            visual_type: visualType,
            text_length: textLength,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Generation started', { visualType, textLength });
};

/**
 * Track successful infographic generation
 */
export const trackGenerationComplete = (
    visualType: InfographicType,
    provider: 'gemini-flash' | 'gemini-pro',
    generationTime: number,
    cost: number,
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'generation_completed',
        visualType,
        provider,
        generationTime,
        cost,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    // Send to Firebase Analytics
    if (analytics) {
        logEvent(analytics, 'infographic_generation_complete', {
            visual_type: visualType,
            provider,
            generation_time: generationTime,
            cost,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Generation completed', {
        visualType,
        provider,
        generationTime: `${generationTime}ms`,
        cost: `$${cost.toFixed(4)}`
    });
};

/**
 * Track failed infographic generation
 */
export const trackGenerationFailed = (
    visualType: InfographicType,
    provider: 'gemini-flash' | 'gemini-pro',
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'generation_failed',
        visualType,
        provider,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    // Send to Firebase Analytics
    if (analytics) {
        logEvent(analytics, 'infographic_generation_failed', {
            visual_type: visualType,
            provider,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Generation failed', { visualType, provider });
};

/**
 * Track cache hit
 */
export const trackCacheHit = (
    visualType: InfographicType,
    cacheSource: 'memory' | 'firebase-storage',
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'cache_hit',
        visualType,
        cacheSource,
        cost: 0, // No cost for cache hit!
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    // Send to Firebase Analytics
    if (analytics) {
        logEvent(analytics, 'infographic_cache_hit', {
            visual_type: visualType,
            cache_source: cacheSource,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Cache HIT', { visualType, cacheSource });
};

/**
 * Track cache miss
 */
export const trackCacheMiss = (
    visualType: InfographicType,
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'cache_miss',
        visualType,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    // Send to Firebase Analytics
    if (analytics) {
        logEvent(analytics, 'infographic_cache_miss', {
            visual_type: visualType,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Cache MISS', { visualType });
};

/**
 * Track preview modal opened
 */
export const trackPreviewOpened = (
    visualType: InfographicType,
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'preview_opened',
        visualType,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    if (analytics) {
        logEvent(analytics, 'infographic_preview_opened', {
            visual_type: visualType,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Preview opened', { visualType });
};

/**
 * Track preview confirmed (added to lesson)
 */
export const trackPreviewConfirmed = (
    visualType: InfographicType,
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'preview_confirmed',
        visualType,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    if (analytics) {
        logEvent(analytics, 'infographic_preview_confirmed', {
            visual_type: visualType,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Preview confirmed', { visualType });
};

/**
 * Track preview rejected
 */
export const trackPreviewRejected = (
    visualType: InfographicType,
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'preview_rejected',
        visualType,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    if (analytics) {
        logEvent(analytics, 'infographic_preview_rejected', {
            visual_type: visualType,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Preview rejected', { visualType });
};

/**
 * Track type changed (user tried another type)
 */
export const trackTypeChanged = (
    fromType: InfographicType,
    toType: InfographicType,
    userId?: string,
    courseId?: string
) => {
    const event: InfographicAnalyticsEvent = {
        eventType: 'type_changed',
        visualType: toType,
        userId,
        courseId,
        timestamp: Date.now()
    };

    analyticsStore.push(event);

    if (analytics) {
        logEvent(analytics, 'infographic_type_changed', {
            from_type: fromType,
            to_type: toType,
            user_id: userId,
            course_id: courseId
        });
    }

    console.log('📊 Analytics: Type changed', { fromType, toType });
};

// --- Summary & Reporting ---

/**
 * Get analytics summary for a time period
 */
export const getAnalyticsSummary = (
    startTime?: number,
    endTime?: number
): InfographicAnalyticsSummary => {
    const start = startTime || (Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const end = endTime || Date.now();

    const relevantEvents = analyticsStore.filter(
        e => e.timestamp >= start && e.timestamp <= end
    );

    const totalGenerations = relevantEvents.filter(
        e => e.eventType === 'generation_completed'
    ).length;

    const totalCacheHits = relevantEvents.filter(
        e => e.eventType === 'cache_hit'
    ).length;

    const totalCacheMisses = relevantEvents.filter(
        e => e.eventType === 'cache_miss'
    ).length;

    const cacheHitRate = totalCacheHits + totalCacheMisses > 0
        ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100
        : 0;

    const totalCost = relevantEvents
        .filter(e => e.cost !== undefined)
        .reduce((sum, e) => sum + (e.cost || 0), 0);

    // Calculate cost savings from cache hits
    // Assume average cost of $0.02 (Gemini Flash - Nano Banana)
    const costSavings = totalCacheHits * 0.02;

    const generationEvents = relevantEvents.filter(
        e => e.eventType === 'generation_completed' && e.generationTime
    );

    const averageGenerationTime = generationEvents.length > 0
        ? generationEvents.reduce((sum, e) => sum + (e.generationTime || 0), 0) / generationEvents.length
        : 0;

    const providerUsage = {
        'gemini-flash': relevantEvents.filter(e => e.provider === 'gemini-flash').length,  // Nano Banana
        'gemini-pro': relevantEvents.filter(e => e.provider === 'gemini-pro').length       // Gemini 3 Pro
    };

    const typeUsage: Record<InfographicType, number> = {
        'flowchart': 0,
        'timeline': 0,
        'comparison': 0,
        'cycle': 0
    };

    relevantEvents
        .filter(e => e.eventType === 'generation_completed')
        .forEach(e => {
            if (e.visualType) {
                typeUsage[e.visualType]++;
            }
        });

    return {
        totalGenerations,
        totalCacheHits,
        totalCacheMisses,
        cacheHitRate,
        totalCost,
        costSavings,
        averageGenerationTime,
        providerUsage,
        typeUsage,
        period: { start, end }
    };
};

/**
 * Get formatted analytics report (console-friendly)
 */
export const printAnalyticsReport = () => {
    const summary = getAnalyticsSummary();

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           📊 INFOGRAPHIC ANALYTICS REPORT                     ║
╚═══════════════════════════════════════════════════════════════╝

⏱️  Period: ${new Date(summary.period.start).toLocaleDateString()} - ${new Date(summary.period.end).toLocaleDateString()}

📈 GENERATION METRICS:
   Total Generations: ${summary.totalGenerations}
   Average Generation Time: ${summary.averageGenerationTime.toFixed(0)}ms

💾 CACHE PERFORMANCE:
   Cache Hits: ${summary.totalCacheHits}
   Cache Misses: ${summary.totalCacheMisses}
   Hit Rate: ${summary.cacheHitRate.toFixed(1)}%

💰 COST METRICS:
   Total Cost: $${summary.totalCost.toFixed(2)}
   Cost Savings (from cache): $${summary.costSavings.toFixed(2)}
   Net Cost: $${(summary.totalCost - summary.costSavings).toFixed(2)}

🎨 PROVIDER USAGE:
   Nano Banana (Gemini Flash): ${summary.providerUsage['gemini-flash']} (${((summary.providerUsage['gemini-flash'] / (summary.totalGenerations || 1)) * 100).toFixed(1)}%)
   Gemini 3 Pro: ${summary.providerUsage['gemini-pro']} (${((summary.providerUsage['gemini-pro'] / (summary.totalGenerations || 1)) * 100).toFixed(1)}%)

📊 TYPE DISTRIBUTION:
   Flowchart: ${summary.typeUsage.flowchart}
   Timeline: ${summary.typeUsage.timeline}
   Comparison: ${summary.typeUsage.comparison}
   Cycle: ${summary.typeUsage.cycle}

═══════════════════════════════════════════════════════════════
    `);

    return summary;
};

/**
 * Export analytics data as JSON
 */
export const exportAnalyticsData = () => {
    return {
        events: analyticsStore,
        summary: getAnalyticsSummary()
    };
};

/**
 * Clear analytics store (use with caution)
 */
export const clearAnalyticsStore = () => {
    analyticsStore.length = 0;
    console.log('📊 Analytics store cleared');
};

// --- Utility: Get stats for dashboard ---

export const getQuickStats = () => {
    const summary = getAnalyticsSummary();
    return {
        totalGenerations: summary.totalGenerations,
        cacheHitRate: summary.cacheHitRate,
        totalSavings: summary.costSavings,
        avgTime: summary.averageGenerationTime
    };
};
