/**
 * Gaming Detection Service
 * זיהוי דפוסים חשודים של "גיימינג" - ניסיון לעבור שאלות בלי ללמוד
 */

import type { StudentTaskSubmission } from '../shared/types/courseTypes';

// Types
export type GamingType = 'quick_skip' | 'random_click' | 'pattern_response' | 'copy_paste' | 'tab_switching';

export interface GamingAlert {
    type: GamingType;
    confidence: number; // 0-1
    evidence: string[];
    severity: 'low' | 'medium' | 'high';
    timestamp: number;
}

export interface GamingAnalysis {
    hasGaming: boolean;
    alerts: GamingAlert[];
    overallRisk: 'none' | 'low' | 'medium' | 'high';
    summary: string;
}

// Thresholds
const THRESHOLDS = {
    QUICK_SKIP_TIME: 3, // seconds - responses faster than this are suspicious
    QUICK_SKIP_STREAK: 3, // number of consecutive quick responses
    RANDOM_ACCURACY: 0.25, // accuracy below this with fast responses = random clicking
    PATTERN_VARIANCE: 0.5, // low variance in response times = pattern
    COPY_PASTE_SIMILARITY: 0.9 // text similarity threshold
};

// Hebrew labels
export const GAMING_LABELS_HE: Record<GamingType, string> = {
    quick_skip: 'דילוגים מהירים',
    random_click: 'לחיצות אקראיות',
    pattern_response: 'תבנית תגובה',
    copy_paste: 'העתקה',
    tab_switching: 'מעבר בין חלונות'
};

export const GAMING_DESCRIPTIONS_HE: Record<GamingType, string> = {
    quick_skip: 'התלמיד עונה מהר מדי על שאלות ללא קריאה',
    random_click: 'התלמיד לוחץ על תשובות באופן אקראי',
    pattern_response: 'התלמיד משתמש בתבנית קבועה (תמיד א\', או תמיד ב\')',
    copy_paste: 'התלמיד מעתיק תשובות מאותו מקור',
    tab_switching: 'התלמיד עובר לחלונות אחרים (אולי מחפש תשובות)'
};

/**
 * חישוב הסטיית תקן
 */
const calculateStdDev = (values: number[]): number => {
    if (values.length < 2) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
};

/**
 * חישוב דמיון טקסט (Levenshtein distance normalized)
 */
const calculateTextSimilarity = (text1: string, text2: string): number => {
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;

    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) return 1;

    // Simple word overlap similarity
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const intersection = words1.filter(w => words2.includes(w));

    return intersection.length / Math.max(words1.length, words2.length);
};

/**
 * זיהוי דילוגים מהירים
 */
const detectQuickSkip = (telemetry: any): GamingAlert | null => {
    if (!telemetry?.responseTimes) return null;

    const times: number[] = Object.values(telemetry.responseTimes || {});
    if (times.length < 3) return null;

    // Find consecutive quick responses
    let maxStreak = 0;
    let currentStreak = 0;
    const quickTimes: number[] = [];

    times.forEach(time => {
        if (time < THRESHOLDS.QUICK_SKIP_TIME) {
            currentStreak++;
            quickTimes.push(time);
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    if (maxStreak >= THRESHOLDS.QUICK_SKIP_STREAK) {
        const avgQuickTime = quickTimes.reduce((a, b) => a + b, 0) / quickTimes.length;

        return {
            type: 'quick_skip',
            confidence: Math.min(0.9, 0.5 + (maxStreak - THRESHOLDS.QUICK_SKIP_STREAK) * 0.1),
            evidence: [
                `${maxStreak} שאלות רצופות עם זמן תגובה מתחת ל-${THRESHOLDS.QUICK_SKIP_TIME} שניות`,
                `זמן תגובה ממוצע: ${avgQuickTime.toFixed(1)} שניות`
            ],
            severity: maxStreak >= 5 ? 'high' : maxStreak >= 4 ? 'medium' : 'low',
            timestamp: Date.now()
        };
    }

    return null;
};

/**
 * זיהוי לחיצות אקראיות
 */
const detectRandomClicking = (submission: StudentTaskSubmission): GamingAlert | null => {
    const telemetry = submission.telemetry;
    if (!telemetry) return null;

    const accuracy = telemetry.successBlocks / (telemetry.totalBlocks || 1);
    const avgTime = (telemetry.timeSpentSeconds || 0) / (telemetry.totalBlocks || 1);

    // Low accuracy + fast responses = random clicking
    if (accuracy < THRESHOLDS.RANDOM_ACCURACY && avgTime < THRESHOLDS.QUICK_SKIP_TIME * 2) {
        return {
            type: 'random_click',
            confidence: Math.min(0.85, 0.4 + (THRESHOLDS.RANDOM_ACCURACY - accuracy)),
            evidence: [
                `דיוק נמוך: ${Math.round(accuracy * 100)}%`,
                `זמן תגובה ממוצע: ${avgTime.toFixed(1)} שניות`,
                'שילוב של דיוק נמוך עם מהירות גבוהה מצביע על לחיצות אקראיות'
            ],
            severity: accuracy < 0.15 ? 'high' : 'medium',
            timestamp: Date.now()
        };
    }

    return null;
};

/**
 * זיהוי תבנית תגובה (תמיד אותה אפשרות)
 */
const detectPatternResponse = (submission: StudentTaskSubmission): GamingAlert | null => {
    const answers = submission.answers || {};
    const mcAnswers: string[] = [];

    Object.values(answers).forEach((answer: any) => {
        if (answer?.selectedOption !== undefined) {
            mcAnswers.push(String(answer.selectedOption));
        }
    });

    if (mcAnswers.length < 5) return null;

    // Count frequency of each option
    const frequency: Record<string, number> = {};
    mcAnswers.forEach(opt => {
        frequency[opt] = (frequency[opt] || 0) + 1;
    });

    // Check if one option dominates
    const maxFreq = Math.max(...Object.values(frequency));
    const dominantRatio = maxFreq / mcAnswers.length;

    if (dominantRatio > 0.7) {
        const dominantOption = Object.entries(frequency).find(([_, count]) => count === maxFreq)?.[0];

        return {
            type: 'pattern_response',
            confidence: Math.min(0.8, dominantRatio),
            evidence: [
                `${Math.round(dominantRatio * 100)}% מהתשובות הן אפשרות ${dominantOption}`,
                `מתוך ${mcAnswers.length} שאלות רב-ברירה`
            ],
            severity: dominantRatio > 0.85 ? 'high' : 'medium',
            timestamp: Date.now()
        };
    }

    return null;
};

/**
 * זיהוי העתקה (תשובות פתוחות דומות מאוד)
 */
const detectCopyPaste = (submission: StudentTaskSubmission): GamingAlert | null => {
    const answers = submission.answers || {};
    const openAnswers: string[] = [];

    Object.values(answers).forEach((answer: any) => {
        if (answer?.text && typeof answer.text === 'string' && answer.text.length > 20) {
            openAnswers.push(answer.text);
        }
    });

    if (openAnswers.length < 2) return null;

    // Check similarity between open answers
    let highSimilarityCount = 0;
    const similarities: number[] = [];

    for (let i = 0; i < openAnswers.length; i++) {
        for (let j = i + 1; j < openAnswers.length; j++) {
            const similarity = calculateTextSimilarity(openAnswers[i], openAnswers[j]);
            similarities.push(similarity);
            if (similarity > THRESHOLDS.COPY_PASTE_SIMILARITY) {
                highSimilarityCount++;
            }
        }
    }

    if (highSimilarityCount > 0) {
        const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

        return {
            type: 'copy_paste',
            confidence: Math.min(0.75, avgSimilarity),
            evidence: [
                `${highSimilarityCount} זוגות תשובות עם דמיון גבוה`,
                `דמיון ממוצע: ${Math.round(avgSimilarity * 100)}%`
            ],
            severity: highSimilarityCount > 2 ? 'high' : 'medium',
            timestamp: Date.now()
        };
    }

    return null;
};

/**
 * זיהוי מעבר בין חלונות (אם יש telemetry)
 */
const detectTabSwitching = (telemetry: any): GamingAlert | null => {
    if (!telemetry?.tabSwitches) return null;

    const switches = telemetry.tabSwitches as number;
    const duration = (telemetry.timeSpentSeconds || 60) / 60; // in minutes

    const switchesPerMinute = switches / duration;

    if (switchesPerMinute > 3) {
        return {
            type: 'tab_switching',
            confidence: Math.min(0.7, 0.4 + switchesPerMinute * 0.05),
            evidence: [
                `${switches} מעברים בין חלונות`,
                `ממוצע ${switchesPerMinute.toFixed(1)} מעברים לדקה`
            ],
            severity: switchesPerMinute > 5 ? 'high' : 'medium',
            timestamp: Date.now()
        };
    }

    return null;
};

/**
 * ניתוח Gaming מלא להגשה
 */
export const analyzeSubmissionForGaming = (
    submission: StudentTaskSubmission
): GamingAnalysis => {
    const alerts: GamingAlert[] = [];

    // Run all detectors
    const quickSkip = detectQuickSkip(submission.telemetry);
    if (quickSkip) alerts.push(quickSkip);

    const randomClick = detectRandomClicking(submission);
    if (randomClick) alerts.push(randomClick);

    const pattern = detectPatternResponse(submission);
    if (pattern) alerts.push(pattern);

    const copyPaste = detectCopyPaste(submission);
    if (copyPaste) alerts.push(copyPaste);

    const tabSwitch = detectTabSwitching(submission.telemetry);
    if (tabSwitch) alerts.push(tabSwitch);

    // Calculate overall risk
    let overallRisk: 'none' | 'low' | 'medium' | 'high' = 'none';

    if (alerts.length > 0) {
        const highAlerts = alerts.filter(a => a.severity === 'high').length;
        const mediumAlerts = alerts.filter(a => a.severity === 'medium').length;

        if (highAlerts >= 2 || (highAlerts >= 1 && mediumAlerts >= 2)) {
            overallRisk = 'high';
        } else if (highAlerts >= 1 || mediumAlerts >= 2) {
            overallRisk = 'medium';
        } else {
            overallRisk = 'low';
        }
    }

    // Generate summary
    let summary = '';
    if (alerts.length === 0) {
        summary = 'לא זוהו דפוסים חשודים';
    } else {
        const types = alerts.map(a => GAMING_LABELS_HE[a.type]);
        summary = `זוהו ${alerts.length} דפוסים חשודים: ${types.join(', ')}`;
    }

    return {
        hasGaming: alerts.length > 0,
        alerts,
        overallRisk,
        summary
    };
};

/**
 * חישוב "ניחוש מהיר" vs "מאמץ גבוה"
 */
export type EffortType = 'high_effort' | 'quick_guess' | 'normal';

export const calculateEffortType = (submission: StudentTaskSubmission): EffortType => {
    const telemetry = submission.telemetry;
    if (!telemetry) return 'normal';

    const avgTimePerBlock = (telemetry.timeSpentSeconds || 0) / (telemetry.totalBlocks || 1);
    const totalHints = Object.values(telemetry.hintsUsed || {}).reduce((a: number, b: any) => a + (b as number), 0);
    const accuracy = telemetry.successBlocks / (telemetry.totalBlocks || 1);

    // High effort: takes time, uses hints appropriately, reasonable accuracy
    if (avgTimePerBlock > 45 && accuracy > 0.5) {
        return 'high_effort';
    }

    // Quick guess: very fast, low accuracy, few hints
    if (avgTimePerBlock < 10 && accuracy < 0.5 && totalHints < 2) {
        return 'quick_guess';
    }

    return 'normal';
};

export const EFFORT_LABELS_HE: Record<EffortType, string> = {
    high_effort: 'מאמץ גבוה',
    quick_guess: 'ניחוש מהיר',
    normal: 'רגיל'
};

export const EFFORT_COLORS: Record<EffortType, string> = {
    high_effort: '#22c55e', // Green
    quick_guess: '#f59e0b', // Amber
    normal: '#6b7280'       // Gray
};

// Export service object
export const gamingDetectionService = {
    analyzeSubmissionForGaming,
    calculateEffortType,
    detectQuickSkip,
    detectRandomClicking,
    detectPatternResponse,
    detectCopyPaste,
    detectTabSwitching,
    GAMING_LABELS_HE,
    GAMING_DESCRIPTIONS_HE,
    EFFORT_LABELS_HE,
    EFFORT_COLORS
};

export default gamingDetectionService;
