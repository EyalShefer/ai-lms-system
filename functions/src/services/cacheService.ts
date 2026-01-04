import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

const CACHE_COLLECTION = '_cache';
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  tags?: string[]; // For cache invalidation by tag
}

/**
 * Get cached value by key
 * Returns null if not found or expired
 */
export const getCached = async <T = any>(key: string): Promise<T | null> => {
  try {
    const db = getFirestore();
    const doc = await db.collection(CACHE_COLLECTION).doc(key).get();

    if (!doc.exists) {
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    const data = doc.data() as CacheEntry;
    const now = Date.now();

    // Check if expired
    if (now - data.timestamp > data.ttl) {
      logger.debug(`Cache expired: ${key}`);
      // Delete expired entry
      await doc.ref.delete();
      return null;
    }

    logger.debug(`Cache hit: ${key}`);
    return data.value as T;
  } catch (error) {
    logger.error('Error getting cached value', { key, error });
    return null; // Fail gracefully
  }
};

/**
 * Set cached value
 * @param key Cache key
 * @param value Value to cache
 * @param ttl Time to live in milliseconds (default: 7 days)
 * @param tags Optional tags for grouped invalidation
 */
export const setCache = async (
  key: string,
  value: any,
  ttl: number = DEFAULT_TTL,
  tags?: string[]
): Promise<void> => {
  try {
    const db = getFirestore();
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      tags: tags || [],
    };

    await db.collection(CACHE_COLLECTION).doc(key).set(entry);
    logger.debug(`Cache set: ${key}`, { ttl, tags });
  } catch (error) {
    logger.error('Error setting cache', { key, error });
    // Don't throw - caching is optional
  }
};

/**
 * Delete specific cache entry
 */
export const deleteCache = async (key: string): Promise<void> => {
  try {
    const db = getFirestore();
    await db.collection(CACHE_COLLECTION).doc(key).delete();
    logger.debug(`Cache deleted: ${key}`);
  } catch (error) {
    logger.error('Error deleting cache', { key, error });
  }
};

/**
 * Invalidate all cache entries with a specific tag
 * Useful for invalidating related entries (e.g., all skeleton caches for a topic)
 */
export const invalidateByTag = async (tag: string): Promise<void> => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection(CACHE_COLLECTION)
      .where('tags', 'array-contains', tag)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logger.info(`Cache invalidated by tag: ${tag}`, { count: snapshot.size });
  } catch (error) {
    logger.error('Error invalidating cache by tag', { tag, error });
  }
};

/**
 * Clear all expired cache entries
 * Should be run periodically (e.g., daily Cloud Scheduler)
 */
export const clearExpiredCache = async (): Promise<number> => {
  try {
    const db = getFirestore();
    const now = Date.now();
    const snapshot = await db.collection(CACHE_COLLECTION).get();

    const batch = db.batch();
    let deletedCount = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as CacheEntry;
      if (now - data.timestamp > data.ttl) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      logger.info(`Cleared ${deletedCount} expired cache entries`);
    }

    return deletedCount;
  } catch (error) {
    logger.error('Error clearing expired cache', error);
    return 0;
  }
};

/**
 * Generate cache key for skeleton generation
 */
export const getSkeletonCacheKey = (
  topic: string,
  gradeLevel: string,
  activityLength: number,
  mode: string = 'learning'
): string => {
  // Normalize inputs to create consistent keys
  const normalizedTopic = topic.trim().toLowerCase();
  const normalizedMode = mode.toLowerCase();
  return `skeleton:${normalizedTopic}:${gradeLevel}:${activityLength}:${normalizedMode}`;
};

/**
 * Generate cache key for step content
 */
export const getStepContentCacheKey = (
  stepNumber: number,
  topic: string,
  stepDescription: string
): string => {
  const normalizedTopic = topic.trim().toLowerCase();
  const normalizedDesc = stepDescription.substring(0, 50).trim().toLowerCase();
  return `step:${stepNumber}:${normalizedTopic}:${normalizedDesc}`;
};

/**
 * Wrapper function to automatically cache function results
 * Usage:
 * const result = await withCache(
 *   'my-key',
 *   () => expensiveOperation(),
 *   3600000 // 1 hour
 * );
 */
export const withCache = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
  tags?: string[]
): Promise<T> => {
  // Try to get from cache first
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - execute function
  logger.debug(`Cache miss, executing function: ${key}`);
  const result = await fetchFn();

  // Store in cache
  await setCache(key, result, ttl, tags);

  return result;
};
