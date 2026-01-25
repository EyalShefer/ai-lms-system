/**
 * useVariantReadiness Hook
 *
 * Monitors the variant generation status for a task.
 * Used by the player to show a loading state while variants are being generated.
 *
 * Features:
 * - Real-time updates via Firestore listener
 * - Backwards compatible (old tasks without variantStatus work normally)
 * - Graceful error handling
 *
 * Created: 2026-01-25
 */

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { VariantGenerationStatus } from '../shared/types/courseTypes';

export interface VariantReadinessState {
    /** Current status of variant generation */
    status: VariantGenerationStatus | 'unknown';

    /** Whether variants are ready (or task doesn't need them) */
    isReady: boolean;

    /** Whether generation is in progress */
    isLoading: boolean;

    /** Generation statistics */
    stats?: {
        totalBlocks: number;
        processed: number;
        failed: number;
    };

    /** Error message if generation failed */
    error?: string;
}

/**
 * Hook to monitor variant generation readiness for a task.
 *
 * @param taskId - The task ID to monitor (optional)
 * @returns VariantReadinessState
 *
 * @example
 * ```tsx
 * const { isReady, isLoading, stats } = useVariantReadiness(assignment?.taskId);
 *
 * if (isLoading) {
 *     return <VariantPreparationOverlay stats={stats} />;
 * }
 * ```
 */
export const useVariantReadiness = (taskId?: string): VariantReadinessState => {
    const [state, setState] = useState<VariantReadinessState>({
        status: 'unknown',
        isReady: true,  // Default to true for backwards compatibility
        isLoading: false
    });

    useEffect(() => {
        // No task ID = no need to check (direct access without assignment)
        if (!taskId) {
            setState({
                status: 'unknown',
                isReady: true,
                isLoading: false
            });
            return;
        }

        // Subscribe to task document changes
        const unsubscribe = onSnapshot(
            doc(db, 'student_tasks', taskId),
            (snapshot) => {
                if (!snapshot.exists()) {
                    // Task doesn't exist - allow access (might be direct link)
                    setState({
                        status: 'unknown',
                        isReady: true,
                        isLoading: false
                    });
                    return;
                }

                const data = snapshot.data();
                const status = data?.variantStatus as VariantGenerationStatus | undefined;

                // No variantStatus field = old task or task without variants
                // Allow access for backwards compatibility
                if (!status) {
                    setState({
                        status: 'unknown',
                        isReady: true,
                        isLoading: false
                    });
                    return;
                }

                // Determine state based on status
                const isLoading = status === 'pending' || status === 'processing';
                const isReady = status === 'ready' || status === 'partial';

                setState({
                    status,
                    isReady: isReady || status === 'failed', // Allow access even on failure (fallback to original)
                    isLoading,
                    stats: data?.variantStats,
                    error: data?.variantError
                });
            },
            (error) => {
                console.error('Error watching variant status:', error);
                // On error, allow access (fail open)
                setState({
                    status: 'unknown',
                    isReady: true,
                    isLoading: false,
                    error: error.message
                });
            }
        );

        return () => unsubscribe();
    }, [taskId]);

    return state;
};

export default useVariantReadiness;
