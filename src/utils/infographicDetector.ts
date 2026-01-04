/**
 * Automatic Infographic Type Detection
 * Analyzes text content to suggest the most appropriate infographic type
 */

import type { InfographicType } from '../services/ai/geminiApi';

interface DetectionResult {
    suggestedType: InfographicType;
    confidence: number; // 0-1
    reason: string;
    alternatives: Array<{ type: InfographicType; confidence: number }>;
}

/**
 * Detection patterns for each infographic type
 */
const DETECTION_PATTERNS = {
    flowchart: {
        keywords: ['תהליך', 'שלבים', 'צעדים', 'אלגוריתם', 'הליך', 'שלב', 'צעד', 'פעולה', 'בצע', 'בדוק', 'אם כן', 'אם לא'],
        numberPatterns: /(?:שלב|צעד|פעולה)\s*\d+|^\d+\.|^[\u05D0-\u05EA]\./gm, // "שלב 1", "1.", "א."
        structure: /\d+\.\s+.+\n\d+\.\s+/g, // Sequential numbering
        weight: 1.0
    },
    timeline: {
        keywords: ['שנת', 'תאריך', 'היסטוריה', 'התפתחות', 'מאז', 'עד', 'תקופה', 'עידן', 'מאה', 'לפנה״ס', 'לספירה', 'היסטורי'],
        datePatterns: /\b\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // Years: 1948, dates: 15/05/1948
        centuryPatterns: /מאה\s+ה-?\d+|המאה\s+ה-?\d+/g,
        structure: /(?:ב-?|משנת|בשנת)\s*\d{4}/g,
        weight: 1.2 // Slightly higher weight for timeline
    },
    comparison: {
        keywords: ['לעומת', 'בניגוד', 'השוואה', 'הבדל', 'דומה', 'שונה', 'מצד אחד', 'מצד שני', 'יתרונות', 'חסרונות', 'vs', 'ואילו'],
        vsPattern: /\b(vs\.?|versus)\b/gi,
        structure: /(.+)\s+(?:לעומת|בניגוד ל-?)\s+(.+)/g,
        tablePattern: /\|.+\|/g, // Markdown tables
        weight: 1.1
    },
    cycle: {
        keywords: ['מחזור', 'מעגל', 'חוזר', 'סיבוב', 'חזרה', 'מחזורי', 'חוזר על עצמו', 'מתחדש', 'סבב', 'לולאה'],
        cyclicPatterns: /חוזר|מחזור|מעגל|ושוב|חזרה/g,
        circularLogic: /(א.*ב.*ג.*א)|(הראשון.*האחרון.*הראשון)/g,
        weight: 0.9
    }
};

/**
 * Count keyword occurrences in text
 */
const countKeywords = (text: string, keywords: string[]): number => {
    const lowerText = text.toLowerCase();
    return keywords.reduce((count, keyword) => {
        const regex = new RegExp(keyword, 'gi');
        const matches = lowerText.match(regex);
        return count + (matches ? matches.length : 0);
    }, 0);
};

/**
 * Calculate score for each infographic type
 */
const calculateTypeScore = (
    text: string,
    type: InfographicType
): number => {
    const pattern = DETECTION_PATTERNS[type];
    let score = 0;

    // Keyword matching
    const keywordCount = countKeywords(text, pattern.keywords);
    score += keywordCount * 10;

    // Pattern matching (specific to each type)
    if (type === 'flowchart') {
        const numberMatches = text.match(pattern.numberPatterns);
        const structureMatches = text.match(pattern.structure);
        score += (numberMatches?.length || 0) * 15;
        score += (structureMatches?.length || 0) * 20;
    }

    if (type === 'timeline') {
        const dateMatches = text.match(pattern.datePatterns);
        const centuryMatches = text.match(pattern.centuryPatterns);
        const structureMatches = text.match(pattern.structure);
        score += (dateMatches?.length || 0) * 25;
        score += (centuryMatches?.length || 0) * 20;
        score += (structureMatches?.length || 0) * 15;
    }

    if (type === 'comparison') {
        const vsMatches = text.match(pattern.vsPattern);
        const structureMatches = text.match(pattern.structure);
        const tableMatches = text.match(pattern.tablePattern);
        score += (vsMatches?.length || 0) * 30;
        score += (structureMatches?.length || 0) * 20;
        score += (tableMatches?.length || 0) * 25;
    }

    if (type === 'cycle') {
        const cyclicMatches = text.match(pattern.cyclicPatterns);
        const circularMatches = text.match(pattern.circularLogic);
        score += (cyclicMatches?.length || 0) * 20;
        score += (circularMatches?.length || 0) * 30;
    }

    // Apply type-specific weight
    return score * pattern.weight;
};

/**
 * Detect the most appropriate infographic type from text
 * @param text - The text content to analyze
 * @returns Detection result with suggested type and confidence
 */
export const detectInfographicType = (text: string): DetectionResult => {
    const types: InfographicType[] = ['flowchart', 'timeline', 'comparison', 'cycle'];

    // Calculate scores for all types
    const scores = types.map(type => ({
        type,
        score: calculateTypeScore(text, type)
    }));

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const topScore = scores[0].score;

    // Normalize confidence (0-1 scale)
    const confidence = totalScore > 0 ? Math.min(topScore / totalScore, 1) : 0;

    // Generate reason message
    let reason = '';
    if (scores[0].type === 'flowchart') {
        reason = 'זוהה טקסט עם שלבים רציפים או תהליך';
    } else if (scores[0].type === 'timeline') {
        reason = 'זוהו תאריכים או אירועים כרונולוגיים';
    } else if (scores[0].type === 'comparison') {
        reason = 'זוהתה השוואה או ניגוד בין מושגים';
    } else if (scores[0].type === 'cycle') {
        reason = 'זוהה תהליך מחזורי או חוזר';
    }

    // Build alternatives list (top 3)
    const alternatives = scores.slice(1, 4).map(s => ({
        type: s.type,
        confidence: totalScore > 0 ? s.score / totalScore : 0
    }));

    return {
        suggestedType: scores[0].type,
        confidence,
        reason,
        alternatives
    };
};

/**
 * Check if text is suitable for infographic generation
 * @param text - The text to analyze
 * @returns Object with suitability score and recommendations
 */
export const analyzeInfographicSuitability = (text: string): {
    isSuitable: boolean;
    score: number;
    issues: string[];
    recommendations: string[];
} => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check text length
    if (text.length < 50) {
        score -= 40;
        issues.push('הטקסט קצר מדי');
        recommendations.push('הוסף לפחות 2-3 משפטים');
    }

    if (text.length > 3000) {
        score -= 20;
        issues.push('הטקסט ארוך מדי');
        recommendations.push('קצר את הטקסט או חלק לחלקים');
    }

    // Check for structure
    const hasNumbering = /\d+\./g.test(text);
    const hasBullets = /[•\-\*]\s/g.test(text);
    const hasLineBreaks = text.includes('\n');

    if (!hasNumbering && !hasBullets && !hasLineBreaks) {
        score -= 30;
        issues.push('חסר מבנה ברור (נקודות, מספור)');
        recommendations.push('ארגן את התוכן ברשימה או שלבים');
    }

    // Check for key concepts
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 10) {
        score -= 20;
        issues.push('מעט מושגים לויזואליזציה');
        recommendations.push('הוסף פרטים נוספים');
    }

    return {
        isSuitable: score >= 50,
        score,
        issues,
        recommendations
    };
};

/**
 * Get user-friendly label for infographic type (Hebrew)
 */
export const getInfographicTypeLabel = (type: InfographicType): string => {
    const labels: Record<InfographicType, string> = {
        flowchart: 'תרשים זרימה',
        timeline: 'ציר זמן',
        comparison: 'השוואה',
        cycle: 'מחזור'
    };
    return labels[type];
};

/**
 * Get description for infographic type (Hebrew)
 */
export const getInfographicTypeDescription = (type: InfographicType): string => {
    const descriptions: Record<InfographicType, string> = {
        flowchart: 'מתאים לתהליכים, שלבים, ואלגוריתמים',
        timeline: 'מתאים לאירועים היסטוריים והתפתחות כרונולוגית',
        comparison: 'מתאים להשוואות, ניגודים, וטבלאות',
        cycle: 'מתאים למחזורים, תהליכים חוזרים, ולולאות'
    };
    return descriptions[type];
};
