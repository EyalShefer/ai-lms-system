/**
 * Variant Cache Service
 *
 * שירות חדש לניהול cache של variants (הבנה/העמקה)
 *
 * עקרונות:
 * - Lazy Generation: יוצר variants רק כשצריך
 * - Cache-First: בודק cache לפני יצירה
 * - Background Generation: לא חוסם UI
 * - Safe: לא משנה קוד קיים
 *
 * Created: 2026-01-23
 */

import { db } from '../firebase';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import type { ActivityBlock } from '../shared/types/courseTypes';
import type {
    VariantType,
    VariantCacheEntry,
    VariantCacheStatus,
    VariantGenerationRequest,
    VariantGenerationResult
} from '../types/variantCache.types';

// ייבוא הפונקציות הקיימות - לא משנה אותן!
import { generateHavanaVariant, generateHaamakaVariant } from './adaptiveContentService';

// ========================================
// CONFIGURATION
// ========================================

const CACHE_COLLECTION = 'variants_cache';
const CACHE_VERSION = '1.0.0'; // לניהול גרסאות
const DEFAULT_TTL_DAYS = 90; // ברירת מחדל: 90 יום

// ========================================
// CACHE READ OPERATIONS
// ========================================

/**
 * בודק אם variant קיים ב-cache
 *
 * @param blockId - ID של ה-block המקורי
 * @param variantType - סוג ה-variant
 * @returns סטטוס ה-cache
 */
export const checkVariantCache = async (
    blockId: string,
    variantType: VariantType
): Promise<VariantCacheStatus> => {
    try {
        // Build cache document ID
        const cacheId = `${blockId}_${variantType}`;
        const cacheRef = doc(db, CACHE_COLLECTION, cacheId);

        const cacheSnap = await getDoc(cacheRef);

        if (!cacheSnap.exists()) {
            console.log(`❌ Cache MISS: ${blockId} - ${variantType}`);
            return {
                exists: false,
                variant: null
            };
        }

        const data = cacheSnap.data() as VariantCacheEntry;

        // Check if expired (if TTL exists)
        let isValid = true;
        if (data.expiresAt) {
            const now = new Date();
            const expiresAt = (data.expiresAt as Timestamp).toDate();
            isValid = now < expiresAt;
        }

        if (!isValid) {
            console.log(`⚠️ Cache EXPIRED: ${blockId} - ${variantType}`);
            return {
                exists: true,
                variant: null,
                cachedAt: (data.generatedAt as Timestamp).toDate(),
                isValid: false
            };
        }

        console.log(`✅ Cache HIT: ${blockId} - ${variantType}`);
        return {
            exists: true,
            variant: data.content,
            cachedAt: (data.generatedAt as Timestamp).toDate(),
            isValid: true
        };

    } catch (error) {
        console.error('Error checking variant cache:', error);
        return {
            exists: false,
            variant: null
        };
    }
};

/**
 * מחזיר variant מה-cache (אם קיים)
 *
 * @param blockId - ID של ה-block המקורי
 * @param variantType - סוג ה-variant
 * @returns ה-variant או null
 */
export const getVariantFromCache = async (
    blockId: string,
    variantType: VariantType
): Promise<ActivityBlock | null> => {
    const status = await checkVariantCache(blockId, variantType);
    return status.isValid ? status.variant : null;
};

// ========================================
// CACHE WRITE OPERATIONS
// ========================================

/**
 * שומר variant ב-cache
 *
 * @param blockId - ID של ה-block המקורי
 * @param variantType - סוג ה-variant
 * @param content - התוכן המלא של ה-variant
 * @param topic - הנושא
 * @param activityId - ID של ה-activity (אופציונלי)
 * @param metadata - מטאדאטה נוספת
 */
export const saveVariantToCache = async (
    blockId: string,
    variantType: VariantType,
    content: ActivityBlock,
    topic: string,
    activityId?: string,
    metadata?: {
        generationTimeMs?: number;
        generationMethod?: 'background' | 'on-demand' | 'pre-warm';
    }
): Promise<void> => {
    try {
        const cacheId = `${blockId}_${variantType}`;
        const cacheRef = doc(db, CACHE_COLLECTION, cacheId);

        // Calculate expiration date (TTL)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + DEFAULT_TTL_DAYS);

        const cacheEntry: Omit<VariantCacheEntry, 'generatedAt' | 'expiresAt'> & {
            generatedAt: any;
            expiresAt: any;
        } = {
            activityId: activityId || 'unknown',
            blockId,
            variantType,
            content,
            topic,
            generatedAt: serverTimestamp(),
            expiresAt: Timestamp.fromDate(expiresAt),
            metadata: {
                ...metadata,
                version: CACHE_VERSION
            }
        };

        await setDoc(cacheRef, cacheEntry);

        console.log(`💾 Cached ${variantType} for block ${blockId}`);

    } catch (error) {
        console.error('Error saving variant to cache:', error);
        throw error;
    }
};

// ========================================
// GENERATION OPERATIONS
// ========================================

/**
 * יוצר variant (משתמש בפונקציות הקיימות)
 *
 * @param request - פרטי הבקשה
 * @returns תוצאת הגנרציה
 */
export const generateVariant = async (
    request: VariantGenerationRequest
): Promise<VariantGenerationResult> => {
    const startTime = Date.now();

    try {
        console.log(`🔄 Generating ${request.variantType} variant for block ${request.baseBlock.id}`);

        let variant: ActivityBlock | null = null;

        // שימוש בפונקציות הקיימות - לא משנה אותן!
        if (request.variantType === 'הבנה') {
            variant = await generateHavanaVariant(request.baseBlock, request.topic);
        } else {
            variant = await generateHaamakaVariant(request.baseBlock, request.topic);
        }

        const durationMs = Date.now() - startTime;

        if (!variant) {
            console.error(`❌ Failed to generate ${request.variantType} variant`);
            return {
                success: false,
                variant: null,
                error: 'Generation returned null',
                durationMs,
                source: 'failed'
            };
        }

        // Save to cache
        await saveVariantToCache(
            request.baseBlock.id,
            request.variantType,
            variant,
            request.topic,
            request.activityId,
            {
                generationTimeMs: durationMs,
                generationMethod: request.runInBackground ? 'background' : 'on-demand'
            }
        );

        console.log(`✅ Generated and cached ${request.variantType} variant in ${durationMs}ms`);

        return {
            success: true,
            variant,
            durationMs,
            source: 'generated'
        };

    } catch (error: any) {
        const durationMs = Date.now() - startTime;
        console.error(`❌ Error generating variant:`, error);

        return {
            success: false,
            variant: null,
            error: error.message || 'Unknown error',
            durationMs,
            source: 'failed'
        };
    }
};

/**
 * יוצר variant ברקע (fire-and-forget)
 *
 * לא חוסם, מחזיר מיד
 *
 * @param request - פרטי הבקשה
 */
export const generateVariantInBackground = (
    request: VariantGenerationRequest
): void => {
    // Fire and forget - לא ממתינים לתוצאה
    generateVariant({ ...request, runInBackground: true })
        .then(result => {
            if (result.success) {
                console.log(`🎉 Background generation complete: ${request.variantType} for ${request.baseBlock.id}`);
            }
        })
        .catch(error => {
            console.error(`❌ Background generation failed:`, error);
        });
};

// ========================================
// HIGH-LEVEL OPERATIONS
// ========================================

/**
 * פונקציה מרכזית: מחזירה variant (מcache או יוצרת)
 *
 * Logic:
 * 1. בודק cache
 * 2. אם קיים → מחזיר
 * 3. אם לא → יוצר (ברקע או חוסם)
 *
 * @param request - פרטי הבקשה
 * @param waitForGeneration - האם לחכות לגנרציה או להחזיר null
 * @returns ה-variant או null
 */
export const getOrGenerateVariant = async (
    request: VariantGenerationRequest,
    waitForGeneration: boolean = false
): Promise<ActivityBlock | null> => {
    // 1. Check cache first
    const cached = await getVariantFromCache(request.baseBlock.id, request.variantType);

    if (cached) {
        return cached;
    }

    // 2. Not in cache
    if (waitForGeneration) {
        // Option A: Wait for generation
        console.log(`⏳ Variant not cached, generating synchronously...`);
        const result = await generateVariant(request);
        return result.variant;
    } else {
        // Option B: Generate in background, return null
        console.log(`⏳ Variant not cached, generating in background...`);
        generateVariantInBackground(request);
        return null;
    }
};

// ========================================
// CACHE MANAGEMENT
// ========================================

/**
 * מוחק variants ישנים/לא תקפים
 *
 * @returns מספר הרשומות שנמחקו
 */
export const cleanupExpiredVariants = async (): Promise<number> => {
    try {
        const now = Timestamp.now();
        const cacheRef = collection(db, CACHE_COLLECTION);
        const q = query(cacheRef, where('expiresAt', '<', now));

        const snapshot = await getDocs(q);

        console.log(`🧹 Cleaning up ${snapshot.size} expired variants...`);

        // Note: בפרודקשן צריך batch delete או Cloud Function
        // כאן רק לדוגמה
        for (const doc of snapshot.docs) {
            await doc.ref.delete();
        }

        return snapshot.size;

    } catch (error) {
        console.error('Error cleaning up expired variants:', error);
        return 0;
    }
};

/**
 * מחזיר סטטיסטיקות cache
 * (לדשבורד/מוניטורינג)
 */
export const getCacheStats = async (): Promise<{
    totalCached: number;
    byType: { הבנה: number; העמקה: number };
}> => {
    try {
        const cacheRef = collection(db, CACHE_COLLECTION);
        const snapshot = await getDocs(cacheRef);

        let הבנה = 0;
        let העמקה = 0;

        snapshot.forEach(doc => {
            const data = doc.data() as VariantCacheEntry;
            if (data.variantType === 'הבנה') הבנה++;
            if (data.variantType === 'העמקה') העמקה++;
        });

        return {
            totalCached: snapshot.size,
            byType: { הבנה, העמקה }
        };

    } catch (error) {
        console.error('Error getting cache stats:', error);
        return { totalCached: 0, byType: { הבנה: 0, העמקה: 0 } };
    }
};
