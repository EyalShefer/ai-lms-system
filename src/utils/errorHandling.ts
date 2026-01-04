/**
 * Error Handling Utilities
 * Provides retry logic, exponential backoff, and user-friendly error messages
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  onRetry: () => {},
  shouldRetry: (error: Error) => {
    // Retry on network errors and rate limits
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('econnreset')
    );
  },
};

/**
 * Execute a function with automatic retry on failure
 * Uses exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );

      console.warn(
        `[Retry] Attempt ${attempt}/${opts.maxRetries} failed. Retrying in ${delay}ms...`,
        error.message
      );

      // Call retry callback
      opts.onRetry(attempt, error);

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get user-friendly error message in Hebrew
 */
export function getErrorMessage(error: any): string {
  if (!error) return 'אירעה שגיאה לא צפויה';

  const errorMessage = error.message || String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Rate limiting
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
    return 'המערכת עמוסה כרגע. אנא נסה שוב בעוד מספר דקות.';
  }

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('offline') ||
    lowerMessage.includes('econnreset')
  ) {
    return 'אין חיבור לאינטרנט. אנא בדוק את החיבור שלך ונסה שוב.';
  }

  // Timeout
  if (lowerMessage.includes('timeout')) {
    return 'הפעולה ארכה זמן רב מדי. אנא נסה שוב.';
  }

  // Authentication
  if (
    lowerMessage.includes('auth') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('401')
  ) {
    return 'נדרשת הזדהות. אנא התחבר מחדש.';
  }

  // Permission
  if (
    lowerMessage.includes('permission') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('403')
  ) {
    return 'אין לך הרשאה לבצע פעולה זו.';
  }

  // Not found
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return 'המשאב המבוקש לא נמצא.';
  }

  // Server error
  if (
    lowerMessage.includes('500') ||
    lowerMessage.includes('server error') ||
    lowerMessage.includes('internal error')
  ) {
    return 'אירעה שגיאה בשרת. צוות התמיכה קיבל התראה.';
  }

  // Validation error
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'הנתונים שהוזנו אינם תקינים. אנא בדוק ונסה שוב.';
  }

  // AI-specific errors
  if (lowerMessage.includes('generation failed')) {
    return 'לא הצלחנו ליצור את התוכן. אנא נסה שוב עם תיאור שונה.';
  }

  // Generic error
  return 'אירעה שגיאה. אנא נסה שוב או פנה לתמיכה.';
}

/**
 * Error boundary wrapper for async functions
 * Logs errors and shows user-friendly messages
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    fallbackValue?: any;
    onError?: (error: Error) => void;
    showToast?: boolean;
  } = {}
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error: any) {
      console.error(`[Error] ${fn.name || 'Unknown function'}:`, error);

      // Call error callback
      if (options.onError) {
        options.onError(error);
      }

      // Show toast if requested
      if (options.showToast) {
        const message = getErrorMessage(error);
        // TODO: Integrate with toast library
        console.error('[User Error]', message);
      }

      // Return fallback value or rethrow
      if (options.fallbackValue !== undefined) {
        return options.fallbackValue;
      }

      throw error;
    }
  }) as T;
}

/**
 * Timeout wrapper
 * Rejects if function takes too long
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError: string = 'הפעולה ארכה זמן רב מדי'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

/**
 * Batch error handler
 * Handles multiple promises and returns results with errors
 */
export async function handleBatch<T>(
  promises: Promise<T>[]
): Promise<Array<{ success: true; data: T } | { success: false; error: Error }>> {
  const results = await Promise.allSettled(promises);

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { success: true as const, data: result.value };
    } else {
      return { success: false as const, error: result.reason };
    }
  });
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T = any>(
  json: string,
  fallback: T | null = null
): T | null {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('[JSON Parse Error]', error);
    return fallback;
  }
}

/**
 * Check if error is a specific type
 */
export function isRateLimitError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('rate limit') || message.includes('429');
}

export function isNetworkError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('econnreset')
  );
}

export function isAuthError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('auth') ||
    message.includes('unauthorized') ||
    message.includes('401')
  );
}
