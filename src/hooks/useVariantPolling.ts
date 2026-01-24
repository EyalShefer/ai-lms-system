/**
 * useVariantPolling Hook
 *
 * Hook לפולינג של variant cache - ממתין לסיום גנרציה
 *
 * שימוש:
 * const { variant, isLoading, error } = useVariantPolling(blockId, 'הבנה', enabled);
 *
 * Created: 2026-01-23
 */

import { useState, useEffect, useRef } from 'react';
import type { ActivityBlock } from '../shared/types/courseTypes';
import type { VariantType } from '../types/variantCache.types';
import { getVariantFromCache } from '../services/variantCacheService';

interface UseVariantPollingOptions {
    /** האם להתחיל polling */
    enabled?: boolean;
    /** כל כמה זמן לבדוק (ms) */
    intervalMs?: number;
    /** זמן מקסימלי להמתין (ms) */
    timeoutMs?: number;
}

interface UseVariantPollingResult {
    /** ה-variant אם נמצא */
    variant: ActivityBlock | null;
    /** האם עדיין טוען */
    isLoading: boolean;
    /** שגיאה אם יש */
    error: string | null;
    /** האם timeout */
    isTimeout: boolean;
}

/**
 * Hook לפולינג של variant cache
 *
 * @param blockId - ID של ה-block המקורי
 * @param variantType - סוג ה-variant
 * @param options - אופציות
 * @returns סטטוס הפולינג
 */
export const useVariantPolling = (
    blockId: string | null,
    variantType: VariantType | null,
    options: UseVariantPollingOptions = {}
): UseVariantPollingResult => {
    const {
        enabled = true,
        intervalMs = 2000, // Poll every 2 seconds
        timeoutMs = 30000  // Timeout after 30 seconds
    } = options;

    const [variant, setVariant] = useState<ActivityBlock | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isTimeout, setIsTimeout] = useState(false);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        // Reset state when inputs change
        setVariant(null);
        setIsLoading(false);
        setError(null);
        setIsTimeout(false);

        // Don't start if not enabled or missing inputs
        if (!enabled || !blockId || !variantType) {
            return;
        }

        setIsLoading(true);
        startTimeRef.current = Date.now();

        const pollCache = async () => {
            try {
                console.log(`🔄 Polling for variant: ${blockId} - ${variantType}`);

                const cached = await getVariantFromCache(blockId, variantType);

                if (cached) {
                    const elapsed = Date.now() - startTimeRef.current;
                    console.log(`✅ Variant found after ${elapsed}ms`);

                    setVariant(cached);
                    setIsLoading(false);

                    // Stop polling
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                        timeoutRef.current = null;
                    }
                }
            } catch (err: any) {
                console.error('Error polling variant:', err);
                setError(err.message || 'Unknown error');
                setIsLoading(false);

                // Stop polling on error
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        };

        // Initial check
        pollCache();

        // Start polling
        intervalRef.current = setInterval(pollCache, intervalMs);

        // Set timeout
        timeoutRef.current = setTimeout(() => {
            console.warn(`⏰ Variant polling timeout after ${timeoutMs}ms`);
            setIsTimeout(true);
            setIsLoading(false);

            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }, timeoutMs);

        // Cleanup
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [blockId, variantType, enabled, intervalMs, timeoutMs]);

    return {
        variant,
        isLoading,
        error,
        isTimeout
    };
};
