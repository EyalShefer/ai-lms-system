/**
 * Distributed Rate Limiter using Firestore
 *
 * SECURITY: This rate limiter shares state across all Cloud Function instances
 * to prevent bypass attacks that exploit instance scaling.
 *
 * Features:
 * - Firestore-backed for distributed state
 * - Sliding window algorithm for fair rate limiting
 * - IP-based fallback for unauthenticated requests
 * - Automatic cleanup of expired entries
 */

import * as admin from 'firebase-admin';
import type { Request } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

// Firestore reference - will be initialized on first use
let db: admin.firestore.Firestore | null = null;

function getFirestore(): admin.firestore.Firestore {
  if (!db) {
    db = admin.firestore();
  }
  return db;
}

// Define Response type locally
interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
}

// Rate limit configurations
export interface RateLimitConfig {
  points: number;        // Maximum requests allowed
  duration: number;      // Time window in seconds
  blockDuration?: number; // How long to block after exceeding (optional)
}

// Predefined rate limit configurations
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // AI Generation: 10 requests per minute per user
  'ai-generation': {
    points: 10,
    duration: 60,
    blockDuration: 60,
  },
  // Chat/Interactive: 30 requests per minute per user
  'chat': {
    points: 30,
    duration: 60,
  },
  // General API: 100 requests per minute per user
  'general': {
    points: 100,
    duration: 60,
  },
  // Grading: 20 requests per hour per user
  'grading': {
    points: 20,
    duration: 3600,
    blockDuration: 300, // 5 minute block after exceeding
  },
  // Login attempts: 5 per minute per IP (anti brute-force)
  'login': {
    points: 5,
    duration: 60,
    blockDuration: 300, // 5 minute block
  },
  // Wizdi API: 50 per minute per API key
  'wizdi-api': {
    points: 50,
    duration: 60,
  },
};

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

interface RateLimitEntry {
  count: number;
  windowStart: admin.firestore.Timestamp;
  blockedUntil?: admin.firestore.Timestamp;
}

/**
 * Get a unique identifier for rate limiting
 * Uses user ID if authenticated, otherwise IP address
 */
function getIdentifier(req: Request): string {
  // Try to get authenticated user ID
  const userId = (req as any).auth?.uid;
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.headers['x-real-ip']?.toString()
    || req.ip
    || 'unknown';

  // Hash the IP to avoid storing raw IPs
  return `ip:${hashString(ip)}`;
}

/**
 * Simple hash function for IPs
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check and consume rate limit
 * Returns { allowed: boolean, remaining: number, resetAt: Date }
 */
async function checkAndConsume(
  identifier: string,
  limitType: RateLimitType
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}> {
  const config = RATE_LIMIT_CONFIGS[limitType];
  if (!config) {
    throw new Error(`Unknown rate limit type: ${limitType}`);
  }

  const firestore = getFirestore();
  const docRef = firestore.collection('rate_limits').doc(`${limitType}:${identifier}`);

  const now = admin.firestore.Timestamp.now();
  const windowStart = new Date(now.toMillis() - config.duration * 1000);

  try {
    const result = await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      const data = doc.data() as RateLimitEntry | undefined;

      // Check if currently blocked
      if (data?.blockedUntil && data.blockedUntil.toMillis() > now.toMillis()) {
        const retryAfter = Math.ceil((data.blockedUntil.toMillis() - now.toMillis()) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetAt: data.blockedUntil.toDate(),
          retryAfter,
        };
      }

      // Check if we're in a new window
      const isNewWindow = !data || data.windowStart.toMillis() < windowStart.getTime();

      if (isNewWindow) {
        // Start a new window
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
        });
        return {
          allowed: true,
          remaining: config.points - 1,
          resetAt: new Date(now.toMillis() + config.duration * 1000),
        };
      }

      // Check if we've exceeded the limit
      if (data.count >= config.points) {
        // Apply block if configured
        const updateData: Partial<RateLimitEntry> = {};
        if (config.blockDuration) {
          updateData.blockedUntil = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + config.blockDuration * 1000
          );
          transaction.update(docRef, updateData);
        }

        const resetTime = config.blockDuration
          ? new Date(now.toMillis() + config.blockDuration * 1000)
          : new Date(data.windowStart.toMillis() + config.duration * 1000);

        return {
          allowed: false,
          remaining: 0,
          resetAt: resetTime,
          retryAfter: Math.ceil((resetTime.getTime() - now.toMillis()) / 1000),
        };
      }

      // Increment count
      transaction.update(docRef, {
        count: admin.firestore.FieldValue.increment(1),
      });

      return {
        allowed: true,
        remaining: config.points - data.count - 1,
        resetAt: new Date(data.windowStart.toMillis() + config.duration * 1000),
      };
    });

    return result;
  } catch (error) {
    logger.error('Rate limit check failed', { identifier, limitType, error });
    // Fail open - allow the request but log the error
    return {
      allowed: true,
      remaining: config.points,
      resetAt: new Date(Date.now() + config.duration * 1000),
    };
  }
}

/**
 * Rate limiting middleware for Cloud Functions
 */
export const distributedRateLimit = (limitType: RateLimitType = 'general') => {
  const config = RATE_LIMIT_CONFIGS[limitType];

  return async (req: Request, res: Response, next: () => void | Promise<void>) => {
    const identifier = getIdentifier(req);

    try {
      const result = await checkAndConsume(identifier, limitType);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.points.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          identifier,
          limitType,
          retryAfter: result.retryAfter,
        });

        res.setHeader('Retry-After', (result.retryAfter || 60).toString());
        res.status(429).json({
          error: getRateLimitErrorMessage(limitType, result.retryAfter || 60),
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString(),
        });
        return;
      }

      await next();
    } catch (error) {
      logger.error('Rate limiter error', { identifier, limitType, error });
      // Fail open - don't block on rate limiter errors
      await next();
    }
  };
};

/**
 * Check rate limit without consuming (for status checks)
 */
export async function getRateLimitStatus(
  identifier: string,
  limitType: RateLimitType
): Promise<{
  limit: number;
  remaining: number;
  resetAt: Date | null;
  blocked: boolean;
}> {
  const config = RATE_LIMIT_CONFIGS[limitType];
  const firestore = getFirestore();
  const docRef = firestore.collection('rate_limits').doc(`${limitType}:${identifier}`);

  try {
    const doc = await docRef.get();
    const data = doc.data() as RateLimitEntry | undefined;

    if (!data) {
      return {
        limit: config.points,
        remaining: config.points,
        resetAt: null,
        blocked: false,
      };
    }

    const now = Date.now();
    const windowStart = now - config.duration * 1000;

    // Check if blocked
    if (data.blockedUntil && data.blockedUntil.toMillis() > now) {
      return {
        limit: config.points,
        remaining: 0,
        resetAt: data.blockedUntil.toDate(),
        blocked: true,
      };
    }

    // Check if window has expired
    if (data.windowStart.toMillis() < windowStart) {
      return {
        limit: config.points,
        remaining: config.points,
        resetAt: null,
        blocked: false,
      };
    }

    return {
      limit: config.points,
      remaining: Math.max(0, config.points - data.count),
      resetAt: new Date(data.windowStart.toMillis() + config.duration * 1000),
      blocked: false,
    };
  } catch (error) {
    logger.error('Error getting rate limit status', { identifier, limitType, error });
    return {
      limit: config.points,
      remaining: config.points,
      resetAt: null,
      blocked: false,
    };
  }
}

/**
 * Reset rate limit for a specific identifier (admin function)
 */
export async function resetRateLimit(
  identifier: string,
  limitType: RateLimitType
): Promise<void> {
  const firestore = getFirestore();
  const docRef = firestore.collection('rate_limits').doc(`${limitType}:${identifier}`);

  try {
    await docRef.delete();
    logger.info('Rate limit reset', { identifier, limitType });
  } catch (error) {
    logger.error('Failed to reset rate limit', { identifier, limitType, error });
    throw error;
  }
}

/**
 * Cleanup expired rate limit entries (run periodically)
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const firestore = getFirestore();
  const now = admin.firestore.Timestamp.now();
  const cutoff = admin.firestore.Timestamp.fromMillis(
    now.toMillis() - 24 * 60 * 60 * 1000 // 24 hours ago
  );

  try {
    const snapshot = await firestore
      .collection('rate_limits')
      .where('windowStart', '<', cutoff)
      .limit(500) // Process in batches
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = firestore.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logger.info('Cleaned up expired rate limits', { count: snapshot.size });
    return snapshot.size;
  } catch (error) {
    logger.error('Failed to cleanup rate limits', { error });
    throw error;
  }
}

/**
 * Get user-friendly error message in Hebrew
 */
function getRateLimitErrorMessage(type: RateLimitType, seconds: number): string {
  const minutes = Math.ceil(seconds / 60);

  switch (type) {
    case 'ai-generation':
      return `הגעת למגבלת יצירת תוכן AI. אנא נסה שוב בעוד ${seconds} שניות.`;
    case 'chat':
      return `יותר מדי הודעות בצ'אט. אנא המתן ${seconds} שניות.`;
    case 'grading':
      return `הגעת למגבלת הערכות. אנא נסה שוב בעוד ${minutes} דקות.`;
    case 'login':
      return `יותר מדי ניסיונות התחברות. אנא המתן ${minutes} דקות.`;
    case 'wizdi-api':
      return `חריגה ממגבלת ה-API. אנא נסה שוב בעוד ${seconds} שניות.`;
    case 'general':
    default:
      return `יותר מדי בקשות. אנא נסה שוב בעוד ${seconds} שניות.`;
  }
}

export default {
  distributedRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  cleanupExpiredRateLimits,
  RATE_LIMIT_CONFIGS,
};
