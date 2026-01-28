/**
 * Capability Cache Service
 *
 * Caches capabilities in localStorage with TTL to reduce Firestore reads.
 * Simple and fast for the small dataset (10 capabilities).
 */

import type { Capability } from '../../shared/types/capabilityTypes';

// ========== Constants ==========

const CACHE_KEY = 'wizdi_capabilities_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ========== Types ==========

interface CacheEntry {
    capabilities: Capability[];
    timestamp: number;
    version: string;
}

// Current cache version - increment to invalidate all caches
const CACHE_VERSION = '1.0.0';

// ========== Cache Functions ==========

/**
 * Get cached capabilities from localStorage
 */
export function getCachedCapabilities(): Capability[] | null {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) {
            console.log('[CapabilityCache] No cache found');
            return null;
        }

        const entry: CacheEntry = JSON.parse(cached);

        // Check version
        if (entry.version !== CACHE_VERSION) {
            console.log('[CapabilityCache] Cache version mismatch, invalidating');
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        // Check TTL
        const now = Date.now();
        if (now - entry.timestamp > CACHE_TTL) {
            console.log('[CapabilityCache] Cache expired');
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        console.log(`[CapabilityCache] Cache hit: ${entry.capabilities.length} capabilities`);
        return entry.capabilities;

    } catch (error) {
        console.error('[CapabilityCache] Error reading cache:', error);
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
}

/**
 * Save capabilities to localStorage cache
 */
export function setCachedCapabilities(capabilities: Capability[]): void {
    try {
        const entry: CacheEntry = {
            capabilities,
            timestamp: Date.now(),
            version: CACHE_VERSION
        };

        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
        console.log(`[CapabilityCache] Cached ${capabilities.length} capabilities`);

    } catch (error) {
        console.error('[CapabilityCache] Error writing cache:', error);
        // If localStorage is full, try to clear old data
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            clearCapabilityCache();
        }
    }
}

/**
 * Clear capability cache
 */
export function clearCapabilityCache(): void {
    localStorage.removeItem(CACHE_KEY);
    console.log('[CapabilityCache] Cache cleared');
}

/**
 * Get cache age in milliseconds
 */
export function getCacheAge(): number | null {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const entry: CacheEntry = JSON.parse(cached);
        return Date.now() - entry.timestamp;

    } catch {
        return null;
    }
}

/**
 * Check if cache is valid (exists and not expired)
 */
export function isCacheValid(): boolean {
    const age = getCacheAge();
    return age !== null && age < CACHE_TTL;
}

// ========== Preload on module load ==========

// Preload cache info for debugging
if (typeof window !== 'undefined') {
    const age = getCacheAge();
    if (age !== null) {
        const minutes = Math.round(age / 60000);
        console.log(`[CapabilityCache] Existing cache is ${minutes} minutes old`);
    }
}
