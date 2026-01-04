import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

// Rate limiters for different operations
// AI Generation: 10 requests per minute per user
const aiGenerationLimiter = new RateLimiterMemory({
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

// Chat/Interactive: 30 requests per minute per user (more frequent)
const chatLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
});

// General API: 100 requests per minute per user
const generalLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60,
});

// Grading: 20 requests per hour per user (expensive operation)
const gradingLimiter = new RateLimiterMemory({
  points: 20,
  duration: 3600, // 1 hour
});

export type RateLimitType = 'ai-generation' | 'chat' | 'general' | 'grading';

/**
 * Rate limiting middleware
 * @param limitType Type of rate limit to apply
 * @returns Middleware function
 */
export const checkRateLimit = (limitType: RateLimitType = 'general') => {
  const limiter = getLimiterByType(limitType);

  return async (req: Request, res: Response, next: () => void | Promise<void>) => {
    // Get user ID from Firebase Auth
    const userId = (req as any).auth?.uid;

    if (!userId) {
      logger.warn('Rate limit check: No authenticated user');
      res.status(401).json({
        error: 'נדרשת הזדהות',
        code: 'UNAUTHORIZED'
      });
      return;
    }

    try {
      // Consume 1 point for this request
      const rateLimitResult = await limiter.consume(userId);

      // Add rate limit headers to response
      res.setHeader('X-RateLimit-Limit', limiter.points.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitResult.remainingPoints.toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitResult.msBeforeNext).toISOString());

      // Continue to next middleware/handler
      await next();

    } catch (rateLimitError: any) {
      // Rate limit exceeded
      const msBeforeNext = rateLimitError?.msBeforeNext || 60000;
      const secondsToWait = Math.ceil(msBeforeNext / 1000);

      logger.warn(`Rate limit exceeded for user ${userId}`, {
        limitType,
        userId,
        msBeforeNext,
      });

      res.setHeader('Retry-After', secondsToWait.toString());
      res.status(429).json({
        error: getRateLimitErrorMessage(limitType, secondsToWait),
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: secondsToWait,
        resetAt: new Date(Date.now() + msBeforeNext).toISOString(),
      });
    }
  };
};

/**
 * Get the appropriate limiter based on type
 */
function getLimiterByType(type: RateLimitType): RateLimiterMemory {
  switch (type) {
    case 'ai-generation':
      return aiGenerationLimiter;
    case 'chat':
      return chatLimiter;
    case 'grading':
      return gradingLimiter;
    case 'general':
    default:
      return generalLimiter;
  }
}

/**
 * Get user-friendly error message in Hebrew
 */
function getRateLimitErrorMessage(type: RateLimitType, seconds: number): string {
  const minutes = Math.ceil(seconds / 60);

  switch (type) {
    case 'ai-generation':
      return `הגעת למגבלת יצירת תוכן AI (10 בקשות לדקה). אנא נסה שוב בעוד ${seconds} שניות.`;
    case 'chat':
      return `יותר מדי הודעות בצ'אט. אנא המתן ${seconds} שניות לפני שליחת הודעות נוספות.`;
    case 'grading':
      return `הגעת למגבלת הערכות (20 בשעה). אנא נסה שוב בעוד ${minutes} דקות.`;
    case 'general':
    default:
      return `יותר מדי בקשות. אנא נסה שוב בעוד ${seconds} שניות.`;
  }
}

/**
 * Reset rate limit for a specific user (admin function)
 * Useful for testing or resolving support issues
 */
export const resetUserRateLimit = async (userId: string, limitType: RateLimitType = 'general') => {
  const limiter = getLimiterByType(limitType);
  await limiter.delete(userId);
  logger.info(`Rate limit reset for user ${userId}, type: ${limitType}`);
};

/**
 * Get current rate limit status for a user
 * Returns remaining points and reset time
 */
export const getRateLimitStatus = async (userId: string, limitType: RateLimitType = 'general') => {
  const limiter = getLimiterByType(limitType);

  try {
    const status = await limiter.get(userId);

    if (!status) {
      return {
        limit: limiter.points,
        remaining: limiter.points,
        resetAt: null,
      };
    }

    return {
      limit: limiter.points,
      remaining: status.remainingPoints,
      resetAt: new Date(Date.now() + status.msBeforeNext),
    };
  } catch (error) {
    logger.error('Error getting rate limit status', { userId, limitType, error });
    throw error;
  }
};
