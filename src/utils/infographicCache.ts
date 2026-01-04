/**
 * Infographic Caching Utility
 * Prevents duplicate generation of identical infographics
 * Uses SHA-256 hash of (text + visualType) as cache key
 */

import type { InfographicType } from '../services/ai/geminiApi';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

// Simple in-memory cache for current session
const memoryCache = new Map<string, string>();

/**
 * Generates a unique hash for text + visual type combination
 * @param text - The source text content
 * @param visualType - The infographic type
 * @returns SHA-256 hash string
 */
export const generateInfographicHash = async (
    text: string,
    visualType: InfographicType
): Promise<string> => {
    const content = `${visualType}:${text.trim()}`;

    // Use Web Crypto API for SHA-256 hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
};

/**
 * Check if infographic exists in memory cache
 * @param hash - The unique hash
 * @returns Cached data URL or null
 */
export const getCachedInfographic = (hash: string): string | null => {
    return memoryCache.get(hash) || null;
};

/**
 * Save infographic to memory cache
 * @param hash - The unique hash
 * @param dataUrl - The base64 data URL
 */
export const setCachedInfographic = (hash: string, dataUrl: string): void => {
    memoryCache.set(hash, dataUrl);

    // Limit cache size to 50 items (prevent memory bloat)
    if (memoryCache.size > 50) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey) memoryCache.delete(firstKey);
    }
};

/**
 * Clear all cached infographics
 */
export const clearInfographicCache = (): void => {
    memoryCache.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => ({
    size: memoryCache.size,
    maxSize: 50,
    keys: Array.from(memoryCache.keys()).slice(0, 5) // First 5 for debugging
});

/**
 * Firebase Storage Integration - Persistent Cache
 * ENABLED: Caches infographics permanently across sessions
 */

/**
 * Save infographic to Firebase Storage for persistent caching
 * @param hash - Unique hash identifier
 * @param blob - Image blob to save
 * @returns Download URL of the saved image
 */
export const saveToFirebaseCache = async (
    hash: string,
    blob: Blob
): Promise<string> => {
    try {
        const storageRef = ref(storage, `infographic_cache/${hash}.png`);
        await uploadBytes(storageRef, blob, {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000' // 1 year cache
        });
        const url = await getDownloadURL(storageRef);
        console.log(`☁️ Saved to Firebase Storage: ${hash.substring(0, 8)}...`);
        return url;
    } catch (error) {
        console.error('Failed to save to Firebase Storage:', error);
        throw error;
    }
};

/**
 * Retrieve infographic from Firebase Storage
 * @param hash - Unique hash identifier
 * @returns Download URL if exists, null otherwise
 */
export const getFromFirebaseCache = async (hash: string): Promise<string | null> => {
    try {
        const storageRef = ref(storage, `infographic_cache/${hash}.png`);
        const url = await getDownloadURL(storageRef);
        console.log(`☁️ Retrieved from Firebase Storage: ${hash.substring(0, 8)}...`);
        return url;
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            return null; // Not found - this is expected
        }
        console.error('Error retrieving from Firebase Storage:', error);
        return null;
    }
};
