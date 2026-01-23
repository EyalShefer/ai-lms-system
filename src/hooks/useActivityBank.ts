/**
 * useActivityBank - React hook for Activity Bank operations
 */
import { useState, useEffect, useCallback } from 'react';
import {
    getActivities,
    getActivityById,
    searchActivities,
    trackActivityUsage,
    rateActivity,
    requestActivityGeneration,
    subscribeToGenerationStatus,
    type BankActivity,
    type ActivityFilters,
    type GenerationRequestParams
} from '../services/activityBankService';

/**
 * Hook for browsing and filtering activities
 */
export function useActivities(initialFilters?: ActivityFilters) {
    const [activities, setActivities] = useState<BankActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<ActivityFilters>(initialFilters || {});

    const loadActivities = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getActivities(filters, 50);
            setActivities(result);
        } catch (err: any) {
            setError(err.message || 'Error loading activities');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    const updateFilters = useCallback((newFilters: Partial<ActivityFilters>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({});
    }, []);

    const search = useCallback(async (query: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await searchActivities(query);
            setActivities(result);
        } catch (err: any) {
            setError(err.message || 'Error searching activities');
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        activities,
        loading,
        error,
        filters,
        updateFilters,
        clearFilters,
        refresh: loadActivities,
        search
    };
}

/**
 * Hook for a single activity
 */
export function useActivity(activityId: string | null) {
    const [activity, setActivity] = useState<BankActivity | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activityId) {
            setActivity(null);
            return;
        }

        const loadActivity = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getActivityById(activityId);
                setActivity(result);
            } catch (err: any) {
                setError(err.message || 'Error loading activity');
            } finally {
                setLoading(false);
            }
        };

        loadActivity();
    }, [activityId]);

    const rate = useCallback(async (userId: string, userName: string, rating: number, comment?: string) => {
        if (!activityId) return;
        await rateActivity(activityId, userId, userName, rating, comment);
        // Refresh activity to get updated rating
        const updated = await getActivityById(activityId);
        setActivity(updated);
    }, [activityId]);

    const trackUsage = useCallback(async () => {
        if (!activityId) return;
        await trackActivityUsage(activityId);
    }, [activityId]);

    return {
        activity,
        loading,
        error,
        rate,
        trackUsage
    };
}

/**
 * Hook for activity generation
 */
export function useActivityGeneration(userId: string | undefined) {
    const [requestId, setRequestId] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
    const [result, setResult] = useState<{
        activitiesCreated: number;
        activityIds: string[];
        qualityScores: number[];
        errors?: string[];
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to status updates
    useEffect(() => {
        if (!requestId) return;

        const unsubscribe = subscribeToGenerationStatus(
            requestId,
            (newStatus, newResult, newError) => {
                setStatus(newStatus as typeof status);
                if (newResult) setResult(newResult);
                if (newError) setError(newError);
            }
        );

        return unsubscribe;
    }, [requestId]);

    const startGeneration = useCallback(async (params: GenerationRequestParams) => {
        if (!userId) {
            setError('User not authenticated');
            return;
        }

        setStatus('pending');
        setError(null);
        setResult(null);

        try {
            const id = await requestActivityGeneration(userId, params);
            setRequestId(id);
        } catch (err: any) {
            setStatus('failed');
            setError(err.message || 'Error starting generation');
        }
    }, [userId]);

    const reset = useCallback(() => {
        setRequestId(null);
        setStatus('idle');
        setResult(null);
        setError(null);
    }, []);

    return {
        requestId,
        status,
        result,
        error,
        startGeneration,
        reset,
        isGenerating: status === 'pending' || status === 'processing'
    };
}
