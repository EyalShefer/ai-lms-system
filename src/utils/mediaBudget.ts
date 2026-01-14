/**
 * Media Budget Manager
 * Ensures balanced media distribution in lessons:
 * - ONE curiosity-provoking image in Hook (always)
 * - ONE infographic in Summary (always)
 * - No media in slides (teacher uses whiteboard)
 *
 * Total: 1-0-1 pattern (Hook image, no slides media, Summary infographic)
 */

import type { InfographicType } from '../services/ai/geminiApi';

// --- Types ---

export interface MediaPlan {
    hook_video_query: string | null;
    summary_infographic_type: InfographicType;
    summary_infographic_description: string;
}

export interface MediaBudget {
    maxHookImages: 1;      // One curiosity image in hook (always)
    maxInfographics: 1;    // One infographic in summary (always)
    maxSlideImages: 0;     // No images in slides (teacher uses whiteboard)
}

export interface MediaUsage {
    youtubeVideos: number;
    infographics: number;
    images: number;
}

// --- Constants ---

export const DEFAULT_MEDIA_BUDGET: MediaBudget = {
    maxHookImages: 1,
    maxInfographics: 1,
    maxSlideImages: 0
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

// ============ ACTIVITY MEDIA BUDGET ============
// For standalone student activities (not lesson plans)
// Strategy: Images provide "the why" (meaning), UI provides "the fun" (stars/gamification)

/**
 * Activity Media Budget Configuration
 * - 1 Context Image (opening): Places student in professional/realistic situation
 * - 0-2 Scenario Images: Only for application questions that need visualization
 * - Total max: 3 images per activity
 */
export interface ActivityMediaBudget {
    maxContextImages: 1;        // Opening image - mandatory
    maxScenarioImages: 2;       // In-question images - only for application level
    totalMaxImages: 3;          // Hard limit
}

export interface ActivityMediaPlan {
    contextImage: {
        prompt: string;         // Gemini prompt for context image
        description: string;    // Hebrew description for accessibility
    };
    scenarioImages: Array<{
        blockId: string;        // Which question block needs this image
        prompt: string;         // Gemini prompt
        description: string;    // Hebrew description
    }>;
}

export interface ActivityMediaUsage {
    contextImages: number;
    scenarioImages: number;
}

export const DEFAULT_ACTIVITY_MEDIA_BUDGET: ActivityMediaBudget = {
    maxContextImages: 1,
    maxScenarioImages: 2,
    totalMaxImages: 3
};

/**
 * Bloom's Taxonomy levels that warrant scenario images
 * Only application+ levels benefit from visualization
 * Strategy: Images show "the dilemma" - a situation before intervention
 */
const APPLICATION_TAXONOMY_LEVELS = ['application', 'analysis', 'evaluation', 'creation'];

/**
 * Question types that benefit from scenario images
 * These types typically present a situation that needs student intervention
 */
const SCENARIO_QUESTION_TYPES = ['multiple-choice', 'open-question'];

/**
 * Determines if a question block should have a scenario image
 *
 * Strategy (from product requirements):
 * - Context image (opening): Always created, places student in professional setting
 * - Scenario images: Only for application+ level questions that benefit from visualization
 *
 * The key insight: UI provides "the fun" (stars/gamification),
 * images provide "the why" (meaning/context for the problem)
 */
export const shouldAddScenarioImage = (
    questionText: string,
    taxonomyLevel?: string,
    currentUsage: ActivityMediaUsage = { contextImages: 0, scenarioImages: 0 },
    questionType?: string
): boolean => {
    // Check budget - max 2 scenario images
    if (currentUsage.scenarioImages >= DEFAULT_ACTIVITY_MEDIA_BUDGET.maxScenarioImages) {
        return false;
    }

    // Check total budget - max 3 images total (1 context + 2 scenario)
    const totalUsed = currentUsage.contextImages + currentUsage.scenarioImages;
    if (totalUsed >= DEFAULT_ACTIVITY_MEDIA_BUDGET.totalMaxImages) {
        return false;
    }

    // Primary criterion: Bloom's taxonomy level must be application or higher
    // This is the main filter - only application+ questions benefit from scenario visualization
    if (!taxonomyLevel || !APPLICATION_TAXONOMY_LEVELS.includes(taxonomyLevel.toLowerCase())) {
        return false;
    }

    // Secondary criterion: Question type should benefit from visualization
    // Categorization questions usually don't need scenario images (the items ARE the visual)
    if (questionType && !SCENARIO_QUESTION_TYPES.includes(questionType)) {
        return false;
    }

    // If we reach here, the question is application+ level and a suitable type
    return true;
};

/**
 * Creates a context image prompt for activity opening
 * Places student in professional/realistic situation related to topic
 */
export const createContextImagePrompt = (
    topic: string,
    subject: string,
    gradeLevel: string
): string => {
    const subjectContexts: Record<string, string> = {
        'מתמטיקה': 'אדריכל, מהנדס, או חוקר מדעי',
        'לשון': 'עיתונאי, סופר, או מנהל תקשורת',
        'מדעים': 'מדען במעבדה, חוקר בשטח, או רופא',
        'היסטוריה': 'ארכיאולוג, היסטוריון, או מנהיג',
        'אנגלית': 'דיפלומט, מתורגמן, או איש עסקים בינלאומי',
        'גיאוגרפיה': 'חוקר, נווט, או מתכנן ערים',
        'אזרחות': 'עורך דין, פוליטיקאי, או פעיל חברתי',
        'תנ"ך': 'ארכיאולוג, חוקר כתבים עתיקים, או מורה דרך'
    };

    const professionalContext = subjectContexts[subject] || 'מומחה בתחום';

    return `Create an educational illustration showing a ${professionalContext} in a realistic professional setting related to "${topic}".
The scene should:
- Show a person actively working (not posed)
- Include relevant professional tools or environment
- Be age-appropriate for grade ${gradeLevel} students
- Convey "you are the expert" feeling
- NO text, NO labels, NO Hebrew characters
- Warm, inviting colors
- Semi-realistic style (not cartoon, not photorealistic)`;
};

/**
 * Creates a scenario image prompt for application questions
 * Shows a situation that needs student's intervention/solution
 */
export const createScenarioImagePrompt = (
    questionText: string,
    topic: string
): string => {
    return `Create an educational illustration showing a problem situation related to "${topic}".
The scene should:
- Depict a moment BEFORE resolution (the problem state)
- Show visual tension or something that needs fixing
- Be clear enough that students can identify what's wrong
- NO text, NO labels, NO Hebrew characters
- Related to this question context: "${questionText.slice(0, 100)}..."
- Semi-realistic educational style`;
};

/**
 * Creates complete activity media plan based on topic and questions
 */
export const createActivityMediaPlan = (
    topic: string,
    subject: string,
    gradeLevel: string,
    questions: Array<{ id: string; text: string; taxonomy?: string; type?: string }>
): ActivityMediaPlan => {
    const usage: ActivityMediaUsage = { contextImages: 1, scenarioImages: 0 };

    // Always create context image
    const contextImage = {
        prompt: createContextImagePrompt(topic, subject, gradeLevel),
        description: `תמונת פתיחה: ${subject} - ${topic}`
    };

    // Check which questions need scenario images
    const scenarioImages: ActivityMediaPlan['scenarioImages'] = [];

    for (const question of questions) {
        if (shouldAddScenarioImage(question.text, question.taxonomy, usage, question.type)) {
            scenarioImages.push({
                blockId: question.id,
                prompt: createScenarioImagePrompt(question.text, topic),
                description: `תמונת דילמה לשאלה: ${question.text.slice(0, 50)}...`
            });
            usage.scenarioImages++;
        }
    }

    return { contextImage, scenarioImages };
};

/**
 * Get activity media usage summary
 */
export const getActivityMediaSummary = (usage: ActivityMediaUsage): string => {
    const total = usage.contextImages + usage.scenarioImages;
    if (total === 0) return 'ללא תמונות';

    const parts: string[] = [];
    if (usage.contextImages > 0) {
        parts.push(`🎯 תמונת פתיחה`);
    }
    if (usage.scenarioImages > 0) {
        parts.push(`🖼️ ${usage.scenarioImages} תמונות דילמה`);
    }

    return parts.join(' + ');
};
