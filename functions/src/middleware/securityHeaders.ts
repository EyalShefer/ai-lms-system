/**
 * Security Headers Middleware
 *
 * SECURITY: Adds essential HTTP security headers to protect against common attacks:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME type sniffing
 * - Information disclosure
 */

import type { Request } from 'firebase-functions/v2/https';

interface Response {
  setHeader: (name: string, value: string) => void;
  set: (name: string, value: string) => void;
}

// Allowed domains for frame-ancestors (who can embed us)
const FRAME_ANCESTORS = [
  "'self'",
  'https://wizdi.co.il',
  'https://*.wizdi.co.il',
  'https://ai-lms-system.web.app',
  'https://ai-lms-system.firebaseapp.com',
];

// CSP directives
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for React
    "'unsafe-eval'", // Required for some React features (remove in production if possible)
    'https://www.gstatic.com', // Firebase
    'https://apis.google.com',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-components/emotion
    'https://fonts.googleapis.com',
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'data:',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.googleapis.com',
    'https://*.googleusercontent.com',
    'https://firebasestorage.googleapis.com',
  ],
  'connect-src': [
    "'self'",
    'https://*.googleapis.com',
    'https://*.cloudfunctions.net',
    'https://*.firebaseio.com',
    'wss://*.firebaseio.com',
    'https://firebasestorage.googleapis.com',
    'https://ai-lms-system.web.app',
    'https://generativelanguage.googleapis.com', // Gemini API
    'https://api.openai.com', // OpenAI API
    'https://ipwho.is', // Geo-location APIs
    'https://ipapi.co',
    'https://ipinfo.io',
    'https://freeipapi.com',
    'https://api.ipdata.co',
  ],
  'frame-src': [
    "'self'",
    'https://www.youtube.com',
    'https://player.vimeo.com',
  ],
  'frame-ancestors': FRAME_ANCESTORS,
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [],
};

/**
 * Build CSP header string from directives
 */
function buildCspHeader(directives: typeof CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Security headers configuration
 */
const SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS filter in older browsers
  'X-XSS-Protection': '1; mode=block',

  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Prevent clickjacking (older browsers)
  // Note: CSP frame-ancestors is preferred for modern browsers
  'X-Frame-Options': `ALLOW-FROM https://wizdi.co.il`,

  // DNS prefetch control
  'X-DNS-Prefetch-Control': 'off',

  // Disable client-side caching for API responses
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',

  // Prevent Adobe Flash and PDF plugins from reading content
  'X-Permitted-Cross-Domain-Policies': 'none',

  // Content Security Policy
  'Content-Security-Policy': buildCspHeader(CSP_DIRECTIVES),
};

/**
 * Additional headers for API responses
 */
const API_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(res: Response, isApi = false): void {
  // Apply all security headers
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    res.set(header, value);
  });

  // Apply additional API headers
  if (isApi) {
    Object.entries(API_HEADERS).forEach(([header, value]) => {
      res.set(header, value);
    });
  }
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: () => void | Promise<void>
): void | Promise<void> {
  // Determine if this is an API request
  const isApi = req.path.startsWith('/api') || req.headers.accept?.includes('application/json');

  applySecurityHeaders(res, isApi);

  return next();
}

/**
 * Get CSP header for iframe embedding context
 * Use this when the app is embedded in Wizdi
 */
export function getEmbeddedCspHeader(parentOrigin?: string): string {
  const frameAncestors = parentOrigin
    ? ["'self'", parentOrigin]
    : FRAME_ANCESTORS;

  const embeddedDirectives = {
    ...CSP_DIRECTIVES,
    'frame-ancestors': frameAncestors,
  };

  return buildCspHeader(embeddedDirectives);
}

/**
 * Strict security headers for sensitive endpoints
 * Disables embedding entirely
 */
export const STRICT_SECURITY_HEADERS: Record<string, string> = {
  ...SECURITY_HEADERS,
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': buildCspHeader({
    ...CSP_DIRECTIVES,
    'frame-ancestors': ["'none'"],
  }),
};

/**
 * Apply strict security headers (no iframe embedding)
 */
export function applyStrictSecurityHeaders(res: Response): void {
  Object.entries(STRICT_SECURITY_HEADERS).forEach(([header, value]) => {
    res.set(header, value);
  });
}

/**
 * Permission-Policy header (formerly Feature-Policy)
 * Controls which browser features can be used
 */
export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=(self)',
  'camera=()',
  'display-capture=()',
  'encrypted-media=(self)',
  'fullscreen=(self)',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=(self)', // Allow for audio responses
  'midi=()',
  'payment=()',
  'picture-in-picture=(self)',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'sync-xhr=(self)',
  'usb=()',
  'web-share=(self)',
  'xr-spatial-tracking=()',
].join(', ');

/**
 * Apply full security headers including Permissions-Policy
 */
export function applyFullSecurityHeaders(res: Response, isApi = false): void {
  applySecurityHeaders(res, isApi);
  res.set('Permissions-Policy', PERMISSIONS_POLICY);
}

export default {
  applySecurityHeaders,
  applyStrictSecurityHeaders,
  applyFullSecurityHeaders,
  securityHeadersMiddleware,
  getEmbeddedCspHeader,
  SECURITY_HEADERS,
  STRICT_SECURITY_HEADERS,
  PERMISSIONS_POLICY,
};
