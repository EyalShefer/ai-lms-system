/**
 * Error Monitoring Service
 *
 * Integrates Sentry for error tracking and performance monitoring.
 * Captures errors, exceptions, and performance metrics.
 *
 * Setup:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new React project
 * 3. Copy your DSN and add to environment variables
 */

import * as Sentry from '@sentry/react';

// ============================================================
// CONFIGURATION
// ============================================================

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT = import.meta.env.MODE || 'development';
const RELEASE = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Only enable Sentry in production or if explicitly enabled
const IS_ENABLED = ENVIRONMENT === 'production' ||
                   import.meta.env.VITE_SENTRY_ENABLED === 'true';

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize Sentry error monitoring
 * Call this once at app startup (main.tsx)
 */
export function initErrorMonitoring(): void {
  if (!IS_ENABLED || !SENTRY_DSN) {
    console.log('[Error Monitoring] Disabled - no DSN or not in production');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,

    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0, // 10% in prod

    // Session Replay for debugging
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% on error

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      // Browser extensions
      /chrome-extension/,
      /moz-extension/,
      // Network errors that are expected
      /Failed to fetch/,
      /NetworkError/,
      /AbortError/,
      // Firebase auth expected errors
      /auth\/popup-closed-by-user/,
      /auth\/cancelled-popup-request/,
    ],

    // Don't send PII
    beforeSend(event) {
      // Remove sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers) {
        // Remove auth headers
        delete event.request.headers['Authorization'];
        delete event.request.headers['Cookie'];
      }
      return event;
    },
  });

  console.log('[Error Monitoring] Sentry initialized');
}

// ============================================================
// ERROR CAPTURING
// ============================================================

/**
 * Capture an exception and send to Sentry
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, any>
): string | undefined {
  if (!IS_ENABLED) {
    console.error('[Error]', error, context);
    return undefined;
  }

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message (for non-error events)
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): string | undefined {
  if (!IS_ENABLED) {
    console.log(`[${level}]`, message, context);
    return undefined;
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
): void {
  if (!IS_ENABLED) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

// ============================================================
// USER CONTEXT
// ============================================================

/**
 * Set the current user for error context
 * Call this after login
 */
export function setUser(user: {
  id: string;
  email?: string;
  role?: string;
}): void {
  if (!IS_ENABLED) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Don't include name for privacy
  });

  Sentry.setTag('user.role', user.role || 'unknown');
}

/**
 * Clear user context
 * Call this on logout
 */
export function clearUser(): void {
  if (!IS_ENABLED) return;

  Sentry.setUser(null);
}

// ============================================================
// PERFORMANCE MONITORING
// ============================================================

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string
): Sentry.Span | undefined {
  if (!IS_ENABLED) return undefined;

  return Sentry.startInactiveSpan({
    name,
    op,
    forceTransaction: true,
  });
}

/**
 * Wrap an async operation with performance tracking
 */
export async function trackAsync<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!IS_ENABLED) {
    return fn();
  }

  return Sentry.startSpan(
    { name, op: operation },
    async () => fn()
  );
}

// ============================================================
// CUSTOM TAGS & CONTEXT
// ============================================================

/**
 * Set a custom tag for all subsequent events
 */
export function setTag(key: string, value: string): void {
  if (!IS_ENABLED) return;
  Sentry.setTag(key, value);
}

/**
 * Set extra context data
 */
export function setContext(name: string, data: Record<string, any>): void {
  if (!IS_ENABLED) return;
  Sentry.setContext(name, data);
}

// ============================================================
// ERROR BOUNDARY COMPONENT
// ============================================================

/**
 * React Error Boundary wrapper
 * Usage: <ErrorBoundary fallback={<ErrorPage />}>...</ErrorBoundary>
 */
export const ErrorBoundary = Sentry.ErrorBoundary;

/**
 * Fallback component props type
 */
export type FallbackProps = {
  error: Error;
  componentStack: string;
  resetError: () => void;
};

// ============================================================
// HEALTH CHECK
// ============================================================

/**
 * Check if error monitoring is working
 */
export function testErrorMonitoring(): void {
  if (!IS_ENABLED) {
    console.log('[Error Monitoring] Test skipped - not enabled');
    return;
  }

  try {
    throw new Error('Sentry test error - ignore this');
  } catch (error) {
    captureException(error, { test: true });
    console.log('[Error Monitoring] Test error sent to Sentry');
  }
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  init: initErrorMonitoring,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  clearUser,
  startTransaction,
  trackAsync,
  setTag,
  setContext,
  testErrorMonitoring,
};
