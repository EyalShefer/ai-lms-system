/**
 * App Check Middleware
 *
 * Verifies that requests come from legitimate app instances.
 * Protects AI APIs from abuse and unauthorized access.
 *
 * Setup:
 * 1. Enable App Check in Firebase Console
 * 2. Register your app with reCAPTCHA
 * 3. Set VITE_RECAPTCHA_SITE_KEY in frontend
 * 4. Enable App Check enforcement in Functions
 *
 * @see https://firebase.google.com/docs/app-check
 */

import * as admin from 'firebase-admin';
import type { Request } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

// Response type for middleware
interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
}

// Configuration
const APP_CHECK_ENABLED = process.env.APP_CHECK_ENABLED !== 'false';
const ENFORCEMENT_MODE = process.env.APP_CHECK_ENFORCEMENT || 'warn'; // 'enforce' | 'warn' | 'off'

/**
 * Verify App Check token from request header
 */
async function verifyAppCheckToken(token: string): Promise<{
  valid: boolean;
  appId?: string;
  error?: string;
}> {
  try {
    const decodedToken = await admin.appCheck().verifyToken(token);
    return {
      valid: true,
      appId: decodedToken.appId
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid App Check token'
    };
  }
}

/**
 * App Check middleware for Cloud Functions
 *
 * @param mode - 'enforce' blocks invalid requests, 'warn' just logs, 'off' skips check
 */
export function appCheckMiddleware(mode: 'enforce' | 'warn' | 'off' = 'warn') {
  return async (req: Request, res: Response, next: () => void | Promise<void>) => {
    // Skip if App Check is disabled
    if (!APP_CHECK_ENABLED || mode === 'off') {
      await next();
      return;
    }

    // Get App Check token from header
    const appCheckToken = req.headers['x-firebase-appcheck'] as string;

    if (!appCheckToken) {
      logger.warn('App Check: No token provided', {
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent']
      });

      if (mode === 'enforce') {
        res.status(401).json({
          error: 'Unauthorized: App Check token required',
          code: 'APP_CHECK_REQUIRED'
        });
        return;
      }

      // In warn mode, continue but flag the request
      (req as any).appCheckVerified = false;
      await next();
      return;
    }

    // Verify the token
    const result = await verifyAppCheckToken(appCheckToken);

    if (!result.valid) {
      logger.warn('App Check: Invalid token', {
        error: result.error,
        ip: req.ip,
        path: req.path
      });

      if (mode === 'enforce') {
        res.status(401).json({
          error: 'Unauthorized: Invalid App Check token',
          code: 'APP_CHECK_INVALID'
        });
        return;
      }

      (req as any).appCheckVerified = false;
      await next();
      return;
    }

    // Token is valid
    logger.info('App Check: Token verified', {
      appId: result.appId,
      path: req.path
    });

    (req as any).appCheckVerified = true;
    (req as any).appCheckAppId = result.appId;

    await next();
  };
}

/**
 * Simple check for onCall functions
 * Firebase automatically validates App Check for onCall when enabled
 *
 * @param context - The CallableContext from onCall
 * @param options - Configuration options
 */
export function validateAppCheck(
  context: { app?: { appId: string; token: { [key: string]: any } } },
  options: { enforce?: boolean } = {}
): { valid: boolean; appId?: string } {
  const { enforce = ENFORCEMENT_MODE === 'enforce' } = options;

  if (!APP_CHECK_ENABLED) {
    return { valid: true };
  }

  if (!context.app) {
    logger.warn('App Check: No app context in onCall');

    if (enforce) {
      return { valid: false };
    }

    return { valid: true }; // Allow in warn mode
  }

  return {
    valid: true,
    appId: context.app.appId
  };
}

/**
 * Decorator for protecting expensive operations
 * Adds stricter App Check validation for AI generation endpoints
 */
export function requireAppCheck(
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    const middleware = appCheckMiddleware('enforce');

    await middleware(req, res, async () => {
      await handler(req, res);
    });
  };
}

/**
 * Log App Check metrics for monitoring
 */
export function logAppCheckMetrics(): void {
  // This would integrate with your monitoring system
  logger.info('App Check metrics logging enabled');
}

/**
 * Check if request passed App Check validation
 */
export function isAppCheckVerified(req: Request): boolean {
  return (req as any).appCheckVerified === true;
}

/**
 * Get the App ID from a verified request
 */
export function getAppCheckAppId(req: Request): string | undefined {
  return (req as any).appCheckAppId;
}

export default {
  appCheckMiddleware,
  validateAppCheck,
  requireAppCheck,
  isAppCheckVerified,
  getAppCheckAppId,
  logAppCheckMetrics
};
