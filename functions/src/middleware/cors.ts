/**
 * CORS Configuration Middleware
 *
 * SECURITY: Restricts cross-origin requests to known, trusted domains.
 * This prevents unauthorized websites from accessing the API.
 */

import type { Request } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  set: (name: string, value: string) => void;
  end: () => void;
}

// Allowed origins for CORS
// IMPORTANT: Update this list with actual production domains
const ALLOWED_ORIGINS: string[] = [
  // Production
  'https://ai-lms-system.web.app',
  'https://ai-lms-system.firebaseapp.com',

  // Wizdi integration
  'https://wizdi.co.il',
  'https://www.wizdi.co.il',
  'https://app.wizdi.co.il',
  'https://staging.wizdi.co.il',

  // Development (remove in production or use environment variable)
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

// Allowed methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];

// Allowed headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'X-Api-Key',
];

// Exposed headers (headers that JavaScript can access)
const EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
];

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  // Exact match
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow any subdomain of allowed domains
  try {
    const originUrl = new URL(origin);

    // Check for wizdi.co.il subdomains
    if (originUrl.hostname.endsWith('.wizdi.co.il') || originUrl.hostname === 'wizdi.co.il') {
      return true;
    }

    // Check for ai-lms-system Firebase domains
    if (originUrl.hostname.endsWith('.ai-lms-system.web.app') ||
      originUrl.hostname.endsWith('.ai-lms-system.firebaseapp.com')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Set CORS headers on response
 */
function setCorsHeaders(res: Response, origin: string | undefined, isPreflight = false): void {
  // Only set Access-Control-Allow-Origin if origin is allowed
  if (origin && isOriginAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }

  // Always set these headers
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Vary', 'Origin');

  if (isPreflight) {
    res.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    res.set('Access-Control-Max-Age', '86400'); // 24 hours
  } else {
    res.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
  }
}

/**
 * CORS middleware
 * Use this instead of cors: true in function options
 */
export function corsMiddleware(req: Request, res: Response, next: () => void | Promise<void>): void | Promise<void> {
  const origin = req.headers.origin;

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin, true);
    res.status(204).end();
    return;
  }

  // Check if origin is allowed for non-preflight requests
  if (origin && !isOriginAllowed(origin)) {
    logger.warn('CORS: Blocked request from disallowed origin', {
      origin,
      path: req.path,
      method: req.method,
    });

    res.status(403).json({
      error: 'CORS error: Origin not allowed',
      code: 'CORS_ORIGIN_DENIED',
    });
    return;
  }

  // Set CORS headers
  setCorsHeaders(res, origin, false);

  // Continue to next middleware
  return next();
}

/**
 * Strict CORS middleware for sensitive endpoints
 * Only allows specific origins, no wildcards
 */
export function strictCorsMiddleware(
  allowedOriginsOverride?: string[]
): (req: Request, res: Response, next: () => void | Promise<void>) => void | Promise<void> {
  const strictOrigins = allowedOriginsOverride || [
    'https://ai-lms-system.web.app',
    'https://ai-lms-system.firebaseapp.com',
  ];

  return (req: Request, res: Response, next: () => void | Promise<void>) => {
    const origin = req.headers.origin;

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      if (origin && strictOrigins.includes(origin)) {
        setCorsHeaders(res, origin, true);
        res.status(204).end();
        return;
      }
      res.status(403).json({ error: 'CORS preflight denied' });
      return;
    }

    // Check if origin is in the strict list
    if (origin && !strictOrigins.includes(origin)) {
      logger.warn('Strict CORS: Blocked request from non-whitelisted origin', {
        origin,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        error: 'Access denied',
        code: 'CORS_STRICT_ORIGIN_DENIED',
      });
      return;
    }

    // Set CORS headers
    setCorsHeaders(res, origin, false);

    return next();
  };
}

/**
 * CORS options for Firebase Functions
 * Use with onRequest functions that don't need custom CORS handling
 */
export const corsOptions = {
  cors: ALLOWED_ORIGINS,
};

/**
 * Get CORS configuration for specific use case
 */
export function getCorsConfig(type: 'public' | 'wizdi' | 'strict' = 'public'): string[] {
  switch (type) {
    case 'wizdi':
      return [
        'https://wizdi.co.il',
        'https://www.wizdi.co.il',
        'https://app.wizdi.co.il',
        'https://staging.wizdi.co.il',
        'https://ai-lms-system.web.app',
      ];
    case 'strict':
      return [
        'https://ai-lms-system.web.app',
        'https://ai-lms-system.firebaseapp.com',
      ];
    case 'public':
    default:
      return ALLOWED_ORIGINS;
  }
}

export default {
  corsMiddleware,
  strictCorsMiddleware,
  isOriginAllowed,
  corsOptions,
  getCorsConfig,
  ALLOWED_ORIGINS,
  ALLOWED_METHODS,
  ALLOWED_HEADERS,
};
