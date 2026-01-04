/**
 * Request Deduplication Utility
 * Prevents duplicate concurrent requests with the same parameters
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

// Store pending requests by key
const pendingRequests = new Map<string, PendingRequest<any>>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_PENDING_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cache key from request parameters
 */
export function generateRequestKey(
  endpoint: string,
  params: Record<string, any>
): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);

  return `${endpoint}:${JSON.stringify(sortedParams)}`;
}

/**
 * Execute function with deduplication
 * If same request is already pending, return the existing promise
 */
export async function withDeduplication<T>(
  key: string,
  fn: () => Promise<T>,
  options: {
    ttl?: number; // Time to keep request in cache after completion (ms)
    force?: boolean; // Force new request even if pending
  } = {}
): Promise<T> {
  const { ttl = 0, force = false } = options;

  // Check if request is already pending
  if (!force && pendingRequests.has(key)) {
    const pending = pendingRequests.get(key)!;
    console.debug(`[Dedup] Reusing pending request: ${key}`);
    return pending.promise;
  }

  // Execute new request
  console.debug(`[Dedup] Starting new request: ${key}`);
  const promise = fn();

  // Store as pending
  pendingRequests.set(key, {
    promise,
    timestamp: Date.now(),
  });

  try {
    const result = await promise;

    // Keep in cache for TTL if specified
    if (ttl > 0) {
      setTimeout(() => {
        pendingRequests.delete(key);
      }, ttl);
    } else {
      // Remove immediately after completion
      pendingRequests.delete(key);
    }

    return result;
  } catch (error) {
    // Remove on error
    pendingRequests.delete(key);
    throw error;
  }
}

/**
 * Clear a specific pending request
 */
export function clearPendingRequest(key: string): void {
  pendingRequests.delete(key);
}

/**
 * Clear all pending requests
 */
export function clearAllPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Get stats about pending requests
 */
export function getPendingRequestsStats() {
  return {
    count: pendingRequests.size,
    keys: Array.from(pendingRequests.keys()),
    oldestTimestamp: Math.min(
      ...Array.from(pendingRequests.values()).map((r) => r.timestamp)
    ),
  };
}

/**
 * Cleanup old pending requests (in case they never resolved)
 */
function cleanupOldRequests() {
  const now = Date.now();
  const toDelete: string[] = [];

  pendingRequests.forEach((request, key) => {
    if (now - request.timestamp > MAX_PENDING_TIME) {
      console.warn(`[Dedup] Cleaning up stale request: ${key}`);
      toDelete.push(key);
    }
  });

  toDelete.forEach((key) => pendingRequests.delete(key));
}

// Start periodic cleanup
if (typeof window !== 'undefined') {
  setInterval(cleanupOldRequests, CLEANUP_INTERVAL);
}

/**
 * Debounced request executor
 * Useful for search inputs, etc.
 */
export function createDebouncedRequest<T>(
  fn: (...args: any[]) => Promise<T>,
  delay: number = 500
): (...args: any[]) => Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let latestResolve: ((value: T) => void) | null = null;
  let latestReject: ((error: any) => void) | null = null;

  return (...args: any[]): Promise<T> => {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise<T>((resolve, reject) => {
      latestResolve = resolve;
      latestReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          latestResolve?.(result);
        } catch (error) {
          latestReject?.(error);
        }
      }, delay);
    });
  };
}
