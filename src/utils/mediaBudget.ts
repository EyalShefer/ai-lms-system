/**
 * Media Budget Manager
 * Ensures balanced media distribution in lessons:
 * - ONE YouTube video in Hook (optional)
 * - ONE infographic in Summary
 * - No media overload
 */

import type { InfographicType } from '../services/ai/geminiApi';

// --- Types ---

export interface MediaPlan {
    hook_video_query: string | null;
    summary_infographic_type: InfographicType;
    summary_infographic_description: string;
}

export interface MediaBudget {
    maxYouTubeVideos: 1;
    maxInfographics: 1;
    maxImages: 0;  // No standalone images (use infographics instead)
}

export interface MediaUsage {
    youtubeVideos: number;
    infographics: number;
    images: number;
}

// --- Constants ---

export const DEFAULT_MEDIA_BUDGET: MediaBudget = {
    maxYouTubeVideos: 1,
    maxInfographics: 1,
    maxImages: 0
};

// --- Functions ---

/**
 * Validate media plan against budget
 */
export const validateMediaPlan = (plan: MediaPlan): { valid: boolean; warnings: string[] } => {
    const warnings: string[] = [];

    // Check infographic type
    const validTypes: InfographicType[] = ['flowchart', 'timeline', 'comparison', 'cycle'];
    if (!validTypes.includes(plan.summary_infographic_type)) {
        warnings.push(`Invalid infographic type: ${plan.summary_infographic_type}. Defaulting to flowchart.`);
    }

    // Check description
    if (!plan.summary_infographic_description || plan.summary_infographic_description.length < 10) {
        warnings.push('Infographic description is too short. May result in generic output.');
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
};

/**
 * Get recommended infographic type based on content analysis
 */
export const suggestInfographicType = (content: string): InfographicType => {
    const lowerContent = content.toLowerCase();

    // Process indicators
    const processKeywords = ['תהליך', 'שלבים', 'צעדים', 'איך', 'כיצד', 'אלגוריתם', 'פעולות'];
    const processScore = processKeywords.filter(k => lowerContent.includes(k)).length;

    // Timeline indicators
    const timelineKeywords = ['שנת', 'תאריך', 'היסטוריה', 'תקופה', 'מאה', 'עידן', 'לפני', 'אחרי'];
    const timelineScore = timelineKeywords.filter(k => lowerContent.includes(k)).length;
    const hasYears = /\b(19|20)\d{2}\b/.test(content); // Years like 1948, 2024

    // Comparison indicators
    const comparisonKeywords = ['לעומת', 'בהשוואה', 'מול', 'vs', 'הבדל', 'דומה', 'שונה', 'יתרון', 'חיסרון'];
    const comparisonScore = comparisonKeywords.filter(k => lowerContent.includes(k)).length;

    // Cycle indicators
    const cycleKeywords = ['מחזור', 'חוזר', 'סיבוב', 'לולאה', 'מעגל', 'חוזרני'];
    const cycleScore = cycleKeywords.filter(k => lowerContent.includes(k)).length;

    // Calculate scores
    const scores = {
        flowchart: processScore,
        timeline: timelineScore + (hasYears ? 2 : 0),
        comparison: comparisonScore,
        cycle: cycleScore
    };

    // Find highest score
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
        return 'flowchart'; // Default
    }

    const winner = Object.entries(scores).find(([_, score]) => score === maxScore);
    return (winner?.[0] as InfographicType) || 'flowchart';
};

/**
 * Create media plan from lesson content
 */
export const createMediaPlanFromContent = (
    lessonTitle: string,
    lessonContent: string,
    objectives: string[]
): MediaPlan => {
    // Suggest infographic type
    const infographicType = suggestInfographicType(lessonContent);

    // Create description based on objectives
    const objectivesText = objectives.length > 0
        ? objectives.join(', ')
        : lessonTitle;

    const typeDescriptions: Record<InfographicType, string> = {
        flowchart: `תרשים זרימה המציג את השלבים העיקריים של ${objectivesText}`,
        timeline: `ציר זמן המציג את האירועים המרכזיים של ${objectivesText}`,
        comparison: `טבלת השוואה בין המושגים העיקריים של ${objectivesText}`,
        cycle: `דיאגרמת מחזור המציגה את התהליך החוזר של ${objectivesText}`
    };

    return {
        hook_video_query: `${lessonTitle} הסבר לילדים`,
        summary_infographic_type: infographicType,
        summary_infographic_description: typeDescriptions[infographicType]
    };
};

/**
 * Check if media budget allows more of a specific type
 */
export const canAddMedia = (
    type: 'youtube' | 'infographic' | 'image',
    currentUsage: MediaUsage,
    budget: MediaBudget = DEFAULT_MEDIA_BUDGET
): boolean => {
    switch (type) {
        case 'youtube':
            return currentUsage.youtubeVideos < budget.maxYouTubeVideos;
        case 'infographic':
            return currentUsage.infographics < budget.maxInfographics;
        case 'image':
            return currentUsage.images < budget.maxImages;
        default:
            return false;
    }
};

/**
 * Get media usage summary for display
 */
export const getMediaUsageSummary = (usage: MediaUsage): string => {
    const parts: string[] = [];

    if (usage.youtubeVideos > 0) {
        parts.push(`📺 ${usage.youtubeVideos} סרטון`);
    }
    if (usage.infographics > 0) {
        parts.push(`📊 ${usage.infographics} אינפוגרפיקה`);
    }
    if (usage.images > 0) {
        parts.push(`🖼️ ${usage.images} תמונות`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'ללא מדיה';
};
