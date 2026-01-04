import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define the database schema
interface CacheDB extends DBSchema {
  skeletons: {
    key: string;
    value: {
      cacheKey: string;
      data: any;
      timestamp: number;
      ttl: number;
    };
  };
  stepContent: {
    key: string;
    value: {
      cacheKey: string;
      data: any;
      timestamp: number;
      ttl: number;
    };
  };
  general: {
    key: string;
    value: {
      cacheKey: string;
      data: any;
      timestamp: number;
      ttl: number;
    };
  };
}

const DB_NAME = 'ai-lms-cache';
const DB_VERSION = 1;
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

let db: IDBPDatabase<CacheDB> | null = null;

/**
 * Initialize the IndexedDB database
 */
async function getDB(): Promise<IDBPDatabase<CacheDB>> {
  if (db) return db;

  db = await openDB<CacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object stores
      if (!db.objectStoreNames.contains('skeletons')) {
        db.createObjectStore('skeletons', { keyPath: 'cacheKey' });
      }
      if (!db.objectStoreNames.contains('stepContent')) {
        db.createObjectStore('stepContent', { keyPath: 'cacheKey' });
      }
      if (!db.objectStoreNames.contains('general')) {
        db.createObjectStore('general', { keyPath: 'cacheKey' });
      }
    },
  });

  return db;
}

type CacheStore = 'skeletons' | 'stepContent' | 'general';

/**
 * Get cached value from specific store
 * @param store Object store name
 * @param key Cache key
 * @returns Cached data or null if not found/expired
 */
export async function getCached<T = any>(
  store: CacheStore,
  key: string
): Promise<T | null> {
  try {
    const database = await getDB();
    const cached = await database.get(store, key);

    if (!cached) {
      console.debug(`[Cache] Miss: ${store}/${key}`);
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      console.debug(`[Cache] Expired: ${store}/${key}`);
      // Delete expired entry
      await database.delete(store, key);
      return null;
    }

    console.debug(`[Cache] Hit: ${store}/${key}`);
    return cached.data as T;
  } catch (error) {
    console.error('[Cache] Error getting cached value:', error);
    return null;
  }
}

/**
 * Set cached value in specific store
 * @param store Object store name
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in milliseconds (default: 7 days)
 */
export async function setCache(
  store: CacheStore,
  key: string,
  data: any,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const database = await getDB();
    await database.put(store, {
      cacheKey: key,
      data,
      timestamp: Date.now(),
      ttl,
    });
    console.debug(`[Cache] Set: ${store}/${key} (TTL: ${ttl}ms)`);
  } catch (error) {
    console.error('[Cache] Error setting cache:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Delete specific cache entry
 */
export async function deleteCache(store: CacheStore, key: string): Promise<void> {
  try {
    const database = await getDB();
    await database.delete(store, key);
    console.debug(`[Cache] Deleted: ${store}/${key}`);
  } catch (error) {
    console.error('[Cache] Error deleting cache:', error);
  }
}

/**
 * Clear all entries in a specific store
 */
export async function clearStore(store: CacheStore): Promise<void> {
  try {
    const database = await getDB();
    await database.clear(store);
    console.info(`[Cache] Cleared store: ${store}`);
  } catch (error) {
    console.error('[Cache] Error clearing store:', error);
  }
}

/**
 * Clear all expired entries across all stores
 */
export async function clearExpired(): Promise<number> {
  try {
    const database = await getDB();
    const stores: CacheStore[] = ['skeletons', 'stepContent', 'general'];
    const now = Date.now();
    let deletedCount = 0;

    for (const store of stores) {
      const allKeys = await database.getAllKeys(store);

      for (const key of allKeys) {
        const entry = await database.get(store, key);
        if (entry && now - entry.timestamp > entry.ttl) {
          await database.delete(store, key);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      console.info(`[Cache] Cleared ${deletedCount} expired entries`);
    }

    return deletedCount;
  } catch (error) {
    console.error('[Cache] Error clearing expired entries:', error);
    return 0;
  }
}

/**
 * Generate cache key for skeleton generation
 */
export function getSkeletonCacheKey(
  topic: string,
  gradeLevel: string,
  activityLength: number,
  mode: string = 'learning'
): string {
  const normalizedTopic = topic.trim().toLowerCase();
  const normalizedMode = mode.toLowerCase();
  return `${normalizedTopic}:${gradeLevel}:${activityLength}:${normalizedMode}`;
}

/**
 * Generate cache key for step content
 */
export function getStepContentCacheKey(
  stepNumber: number,
  topic: string,
  stepDescription: string
): string {
  const normalizedTopic = topic.trim().toLowerCase();
  const normalizedDesc = stepDescription.substring(0, 50).trim().toLowerCase();
  return `${stepNumber}:${normalizedTopic}:${normalizedDesc}`;
}

/**
 * Wrapper function to automatically cache function results
 * @param store Cache store to use
 * @param key Cache key
 * @param fetchFn Function to execute if cache miss
 * @param ttl Time to live (default: 7 days)
 * @returns Cached or freshly fetched data
 */
export async function withCache<T>(
  store: CacheStore,
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  // Try cache first
  const cached = await getCached<T>(store, key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - execute function
  console.debug(`[Cache] Executing function for: ${store}/${key}`);
  const result = await fetchFn();

  // Store in cache
  await setCache(store, key, result, ttl);

  return result;
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const database = await getDB();
    const stores: CacheStore[] = ['skeletons', 'stepContent', 'general'];
    const stats: Record<string, { total: number; expired: number }> = {};
    const now = Date.now();

    for (const store of stores) {
      const allEntries = await database.getAll(store);
      const expiredCount = allEntries.filter(
        (entry) => now - entry.timestamp > entry.ttl
      ).length;

      stats[store] = {
        total: allEntries.length,
        expired: expiredCount,
      };
    }

    return stats;
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
    return {};
  }
}

/**
 * Initialize cache cleanup on app load
 * Clears expired entries periodically
 */
export function initCacheCleanup(intervalMs: number = 60 * 60 * 1000): void {
  // Clear expired on startup
  clearExpired();

  // Set up periodic cleanup (default: every hour)
  setInterval(() => {
    clearExpired();
  }, intervalMs);
}
