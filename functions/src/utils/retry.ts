/**
 * Retry Utility with Exponential Backoff
 *
 * Provides reliable retry logic for API calls, especially AI services
 * that may have transient failures.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Timeout support
 * - Detailed logging
 */

import { logger } from 'firebase-functions/v2';

// ============================================================
// TYPES
// ============================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;

  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;

  /** Add randomness to delays to prevent thundering herd (default: true) */
  jitter?: boolean;

  /** Timeout for each attempt in milliseconds (default: 60000) */
  timeout?: number;

  /** Function to determine if error is retryable (default: checks common transient errors) */
  isRetryable?: (error: Error) => boolean;

  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;

  /** Operation name for logging */
  operationName?: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'operationName'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  timeout: 60000,
  isRetryable: defaultIsRetryable
};

/**
 * Default retry condition - checks for common transient errors
 */
function defaultIsRetryable(error: Error): boolean {
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';

  // Network errors
  if (message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')) {
    return true;
  }

  // Rate limiting
  if (message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429') ||
      message.includes('quota')) {
    return true;
  }

  // Server errors (5xx)
  if (message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error') ||
      message.includes('service unavailable')) {
    return true;
  }

  // Gemini/AI specific errors
  if (message.includes('overloaded') ||
      message.includes('capacity') ||
      message.includes('temporarily unavailable') ||
      message.includes('resource exhausted')) {
    return true;
  }

  // Timeout errors
  if (name.includes('timeout') || message.includes('timeout')) {
    return true;
  }

  return false;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean
): number {
  // Exponential backoff: delay = initialDelay * (backoffFactor ^ attempt)
  let delay = initialDelay * Math.pow(backoffFactor, attempt);

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter (±25% randomness)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5; // 0.75 to 1.25
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// ============================================================
// MAIN RETRY FUNCTION
// ============================================================

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @returns Promise with the result or throws after all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => callGeminiAPI(prompt),
 *   {
 *     maxRetries: 3,
 *     operationName: 'generateContent'
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffFactor,
    jitter,
    timeout,
    isRetryable,
    onRetry,
    operationName
  } = opts;

  const opName = operationName || 'operation';
  let lastError: Error = new Error('Unknown error');
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute with timeout
      const result = await withTimeout(fn(), timeout);

      // Success - log if we had to retry
      if (attempt > 0) {
        logger.info(`${opName}: Succeeded after ${attempt} retries`, {
          attempts: attempt + 1,
          totalTime: Date.now() - startTime
        });
      }

      return result;

    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      if (attempt < maxRetries && isRetryable(lastError)) {
        const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffFactor, jitter);

        logger.warn(`${opName}: Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries,
          delay
        });

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt + 1, lastError, delay);
        }

        await sleep(delay);
      } else {
        // Not retryable or out of retries
        break;
      }
    }
  }

  // All retries exhausted
  logger.error(`${opName}: All ${maxRetries + 1} attempts failed`, {
    error: lastError.message,
    totalTime: Date.now() - startTime
  });

  throw lastError;
}

/**
 * Execute a function with retry logic and return detailed result
 * (doesn't throw, returns success/failure object)
 */
export async function withRetryResult<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    // Use a wrapper to count attempts
    const result = await withRetry(async () => {
      attempts++;
      return fn();
    }, options);

    return {
      success: true,
      result,
      attempts,
      totalTime: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts,
      totalTime: Date.now() - startTime
    };
  }
}

// ============================================================
// SPECIALIZED RETRY FUNCTIONS
// ============================================================

/**
 * Retry configuration optimized for Gemini API calls
 */
export const GEMINI_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 2000,  // 2 seconds initial delay
  maxDelay: 30000,     // 30 seconds max delay
  backoffFactor: 2,
  jitter: true,
  timeout: 120000,     // 2 minutes timeout per attempt
  operationName: 'Gemini API',
  isRetryable: (error) => {
    // Default checks
    if (defaultIsRetryable(error)) return true;

    // Gemini-specific
    const message = error.message?.toLowerCase() || '';
    if (message.includes('model is overloaded') ||
        message.includes('safety') ||
        message.includes('blocked')) {
      // Don't retry safety/blocked errors
      return false;
    }

    return false;
  }
};

/**
 * Retry for Gemini API calls
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, GEMINI_RETRY_OPTIONS);
}

/**
 * Retry configuration for external API calls (non-AI)
 */
export const API_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 2,
  initialDelay: 500,
  maxDelay: 5000,
  backoffFactor: 2,
  jitter: true,
  timeout: 30000,
  operationName: 'External API'
};

/**
 * Retry for external API calls
 */
export async function withApiRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, API_RETRY_OPTIONS);
}

/**
 * Retry configuration for Firestore operations
 */
export const FIRESTORE_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 2000,
  backoffFactor: 2,
  jitter: true,
  timeout: 10000,
  operationName: 'Firestore',
  isRetryable: (error) => {
    const message = error.message?.toLowerCase() || '';
    return message.includes('unavailable') ||
           message.includes('deadline') ||
           message.includes('aborted') ||
           message.includes('internal') ||
           defaultIsRetryable(error);
  }
};

/**
 * Retry for Firestore operations
 */
export async function withFirestoreRetry<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, FIRESTORE_RETRY_OPTIONS);
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  withRetry,
  withRetryResult,
  withGeminiRetry,
  withApiRetry,
  withFirestoreRetry,
  GEMINI_RETRY_OPTIONS,
  API_RETRY_OPTIONS,
  FIRESTORE_RETRY_OPTIONS,
  defaultIsRetryable
};
