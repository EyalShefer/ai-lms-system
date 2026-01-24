/**
 * Variant Cache Types
 *
 * קובץ חדש לטיפוסים של מערכת ה-Variant Cache
 * לא משנה או תלוי בקבצים קיימים
 *
 * Created: 2026-01-23
 * Purpose: Lazy variant generation system
 */

import type { ActivityBlock } from '../shared/types/courseTypes';
import type { Timestamp } from 'firebase/firestore';

/**
 * Variant Type - סוג הvariant
 */
export type VariantType = 'הבנה' | 'העמקה';

/**
 * Cache Entry - רשומה בcache
 */
export interface VariantCacheEntry {
    /** ID של ה-activity המקורי */
    activityId: string;

    /** ID של ה-block המקורי */
    blockId: string;

    /** סוג ה-variant */
    variantType: VariantType;

    /** התוכן המלא של ה-variant */
    content: ActivityBlock;

    /** הנושא (לשימוש בגנרציה) */
    topic: string;

    /** מתי נוצר */
    generatedAt: Timestamp;

    /** מתי נוצר ה-block המקורי (לvalidation) */
    originalGeneratedAt?: Timestamp;

    /** אופציונלי: TTL לניקוי אוטומטי */
    expiresAt?: Timestamp;

    /** מטאדאטה נוספת */
    metadata?: {
        /** כמה זמן לקח ליצור (ms) */
        generationTimeMs?: number;

        /** האם נוצר ברקע או on-demand */
        generationMethod?: 'background' | 'on-demand' | 'pre-warm';

        /** גרסת הקוד שיצרה */
        version?: string;
    };
}

/**
 * Cache Status - סטטוס בדיקת cache
 */
export interface VariantCacheStatus {
    /** האם ה-variant קיים ב-cache */
    exists: boolean;

    /** ה-variant אם קיים */
    variant: ActivityBlock | null;

    /** מתי נוצר (אם קיים) */
    cachedAt?: Date;

    /** האם ה-cache עדיין valid */
    isValid?: boolean;
}

/**
 * Generation Request - בקשה ליצירת variant
 */
export interface VariantGenerationRequest {
    /** ה-block המקורי */
    baseBlock: ActivityBlock;

    /** סוג ה-variant לייצר */
    variantType: VariantType;

    /** הנושא */
    topic: string;

    /** ID של ה-activity (לcache) */
    activityId?: string;

    /** האם לרוץ ברקע */
    runInBackground?: boolean;
}

/**
 * Generation Result - תוצאת גנרציה
 */
export interface VariantGenerationResult {
    /** האם הצליח */
    success: boolean;

    /** ה-variant שנוצר (אם הצליח) */
    variant: ActivityBlock | null;

    /** שגיאה (אם נכשל) */
    error?: string;

    /** כמה זמן לקח (ms) */
    durationMs: number;

    /** מאיפה התקבל */
    source: 'cache' | 'generated' | 'failed';
}

/**
 * Cache Statistics - סטטיסטיקות שימוש
 */
export interface VariantCacheStats {
    /** סה"כ בקשות */
    totalRequests: number;

    /** cache hits */
    cacheHits: number;

    /** cache misses */
    cacheMisses: number;

    /** אחוז hit rate */
    hitRate: number;

    /** התפלגות לפי סוג */
    byType: {
        הבנה: number;
        העמקה: number;
    };

    /** זמן גנרציה ממוצע (ms) */
    avgGenerationTimeMs?: number;
}
