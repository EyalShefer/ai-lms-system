/**
 * useCapabilities Hook
 *
 * Loads and caches agent capabilities from Firestore.
 * Provides reactive access to capabilities for the SmartCreation system.
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Capability, CapabilityCategory } from '../shared/types/capabilityTypes';

// ========== Types ==========

interface UseCapabilitiesResult {
    capabilities: Capability[];
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    getByCategory: (category: CapabilityCategory) => Capability[];
    getById: (id: string) => Capability | undefined;
    getForMenu: () => Capability[];
}

// ========== In-Memory Cache ==========

let cachedCapabilities: Capability[] = [];
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ========== Hook ==========

export function useCapabilities(): UseCapabilitiesResult {
    const [capabilities, setCapabilities] = useState<Capability[]>(cachedCapabilities);
    const [isLoading, setIsLoading] = useState<boolean>(cachedCapabilities.length === 0);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Load capabilities from Firestore
     */
    const loadCapabilities = useCallback(async (forceRefresh: boolean = false) => {
        const now = Date.now();

        // Return cached if valid and not forcing refresh
        // IMPORTANT: Always reload if cache is empty (don't cache failures)
        if (!forceRefresh && cachedCapabilities.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
            console.log(`📚 [useCapabilities] Using cached ${cachedCapabilities.length} capabilities`);
            setCapabilities(cachedCapabilities);
            setIsLoading(false);
            return;
        }

        console.log(`📚 [useCapabilities] Loading from Firestore (forceRefresh=${forceRefresh}, cached=${cachedCapabilities.length})`);

        setIsLoading(true);
        setError(null);

        try {
            const capabilitiesRef = collection(db, 'capabilities');
            // Simple query - filter client-side to avoid composite index requirement
            const snapshot = await getDocs(capabilitiesRef);

            console.log(`📚 [useCapabilities] Firestore returned ${snapshot.docs.length} docs`);
            if (snapshot.docs.length > 0) {
                console.log(`📚 [useCapabilities] First doc:`, snapshot.docs[0].id, snapshot.docs[0].data().status);
            }

            const loadedCapabilities: Capability[] = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Capability))
                .filter(cap => cap.status === 'active')
                .sort((a, b) => {
                    // Sort by category first, then by menuOrder
                    if (a.category !== b.category) {
                        return (a.category || '').localeCompare(b.category || '');
                    }
                    return (a.ui?.menuOrder || 100) - (b.ui?.menuOrder || 100);
                });

            // Update cache
            cachedCapabilities = loadedCapabilities;
            cacheTimestamp = now;

            setCapabilities(loadedCapabilities);
            console.log(`📚 [useCapabilities] Loaded ${loadedCapabilities.length} capabilities`);

        } catch (err: any) {
            console.error('❌ [useCapabilities] Failed to load capabilities:', err);
            setError(err);

            // Use cached if available even if stale
            if (cachedCapabilities.length > 0) {
                setCapabilities(cachedCapabilities);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Refresh capabilities (force)
     */
    const refresh = useCallback(async () => {
        await loadCapabilities(true);
    }, [loadCapabilities]);

    /**
     * Get capabilities by category
     */
    const getByCategory = useCallback((category: CapabilityCategory): Capability[] => {
        return capabilities.filter(cap => cap.category === category);
    }, [capabilities]);

    /**
     * Get capability by ID
     */
    const getById = useCallback((id: string): Capability | undefined => {
        return capabilities.find(cap => cap.id === id);
    }, [capabilities]);

    /**
     * Get capabilities that should appear in the creation menu
     */
    const getForMenu = useCallback((): Capability[] => {
        return capabilities
            .filter(cap => cap.ui?.showInMenu === true)
            .sort((a, b) => (a.ui?.menuOrder || 100) - (b.ui?.menuOrder || 100));
    }, [capabilities]);

    // Load on mount
    useEffect(() => {
        loadCapabilities();
    }, [loadCapabilities]);

    return {
        capabilities,
        isLoading,
        error,
        refresh,
        getByCategory,
        getById,
        getForMenu
    };
}

// ========== Utility Functions ==========

/**
 * Clear the capabilities cache (useful for testing)
 */
export function clearCapabilitiesCache(): void {
    cachedCapabilities = [];
    cacheTimestamp = 0;
}

/**
 * Get cached capabilities without subscribing to updates
 */
export function getCachedCapabilities(): Capability[] {
    return cachedCapabilities;
}
