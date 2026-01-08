/**
 * Geographic Restriction Middleware
 *
 * SECURITY: Restricts access to users from Israel only.
 * Uses Cloudflare/Firebase headers and IP geolocation as fallback.
 *
 * How it works:
 * 1. First checks Cloudflare CF-IPCountry header (if behind Cloudflare)
 * 2. Then checks X-AppEngine-Country header (if on Google Cloud)
 * 3. Falls back to IP geolocation lookup via free API
 */

import type { Request } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { logSecurityEvent } from '../services/auditLogger';

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  setHeader: (name: string, value: string) => void;
  set: (name: string, value: string) => void;
}

// Allowed country codes (ISO 3166-1 alpha-2)
const ALLOWED_COUNTRIES = ['IL']; // Israel only

// Palestinian territories if you want to include them
// const ALLOWED_COUNTRIES = ['IL', 'PS'];

// Cache for IP lookups to avoid repeated API calls
const geoCache = new Map<string, { country: string; expiry: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

// Bypass IPs (for development/testing)
const BYPASS_IPS = [
  '127.0.0.1',
  '::1',
  'localhost',
];

// Check if geo-restriction is enabled (can be controlled via environment variable)
const GEO_RESTRICTION_ENABLED = process.env.GEO_RESTRICTION_ENABLED !== 'false';

/**
 * Extract client IP from request
 */
function getClientIp(req: Request): string {
  // Try various headers in order of reliability
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one (original client)
    const ips = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',');
    return ips[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return typeof realIp === 'string' ? realIp : realIp[0];
  }

  // Firebase/Cloud Functions IP
  return req.ip || 'unknown';
}

/**
 * Get country from CDN/proxy headers
 * These are set by Cloudflare, Google Cloud, AWS CloudFront, etc.
 */
function getCountryFromHeaders(req: Request): string | null {
  // Cloudflare
  const cfCountry = req.headers['cf-ipcountry'];
  if (cfCountry) {
    return (typeof cfCountry === 'string' ? cfCountry : cfCountry[0]).toUpperCase();
  }

  // Google App Engine / Cloud Run
  const appEngineCountry = req.headers['x-appengine-country'];
  if (appEngineCountry) {
    return (typeof appEngineCountry === 'string' ? appEngineCountry : appEngineCountry[0]).toUpperCase();
  }

  // Google Cloud Load Balancer
  const gclbCountry = req.headers['x-client-geo-location'];
  if (gclbCountry) {
    // Format might be "country=IL,region=TA"
    const match = (typeof gclbCountry === 'string' ? gclbCountry : gclbCountry[0]).match(/country=([A-Z]{2})/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  // AWS CloudFront
  const cloudFrontCountry = req.headers['cloudfront-viewer-country'];
  if (cloudFrontCountry) {
    return (typeof cloudFrontCountry === 'string' ? cloudFrontCountry : cloudFrontCountry[0]).toUpperCase();
  }

  // Fastly
  const fastlyCountry = req.headers['fastly-client-ip-geo-country-code'];
  if (fastlyCountry) {
    return (typeof fastlyCountry === 'string' ? fastlyCountry : fastlyCountry[0]).toUpperCase();
  }

  return null;
}

/**
 * Lookup country from IP using free geolocation API
 * Uses ip-api.com (free tier: 45 requests/minute)
 */
async function lookupCountryFromIp(ip: string): Promise<string | null> {
  // Check cache first
  const cached = geoCache.get(ip);
  if (cached && cached.expiry > Date.now()) {
    return cached.country;
  }

  try {
    // Using ip-api.com free service
    // Alternative: ipinfo.io, ipdata.co, ipgeolocation.io
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,status`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      logger.warn('IP geolocation API error', { ip, status: response.status });
      return null;
    }

    const data = await response.json();

    if (data.status === 'success' && data.countryCode) {
      const country = data.countryCode.toUpperCase();

      // Cache the result
      geoCache.set(ip, {
        country,
        expiry: Date.now() + CACHE_TTL_MS,
      });

      return country;
    }

    return null;
  } catch (error) {
    logger.warn('IP geolocation lookup failed', { ip, error });
    return null;
  }
}

/**
 * Determine if request is from an allowed country
 */
async function isAllowedCountry(req: Request): Promise<{ allowed: boolean; country: string | null; method: string }> {
  const ip = getClientIp(req);

  // Bypass for development/localhost
  if (BYPASS_IPS.includes(ip)) {
    return { allowed: true, country: 'BYPASS', method: 'bypass' };
  }

  // Try to get country from headers first (fastest, most reliable)
  const headerCountry = getCountryFromHeaders(req);
  if (headerCountry) {
    return {
      allowed: ALLOWED_COUNTRIES.includes(headerCountry),
      country: headerCountry,
      method: 'header',
    };
  }

  // Fall back to IP lookup
  const lookupCountry = await lookupCountryFromIp(ip);
  if (lookupCountry) {
    return {
      allowed: ALLOWED_COUNTRIES.includes(lookupCountry),
      country: lookupCountry,
      method: 'ip-lookup',
    };
  }

  // If we can't determine country, we have options:
  // Option 1: Allow access (fail open) - better UX, less secure
  // Option 2: Block access (fail closed) - worse UX, more secure

  // For this implementation, we'll fail open but log the incident
  logger.warn('Could not determine country for request', {
    ip: ip.substring(0, ip.lastIndexOf('.')) + '.xxx', // Partial IP for privacy
    path: req.path,
  });

  return { allowed: true, country: 'UNKNOWN', method: 'unknown-allowed' };
}

/**
 * Geo-restriction middleware
 * Blocks requests from outside Israel
 */
export async function geoRestrictionMiddleware(
  req: Request,
  res: Response,
  next: () => void | Promise<void>
): Promise<void> {
  // Skip if geo-restriction is disabled
  if (!GEO_RESTRICTION_ENABLED) {
    return next();
  }

  const { allowed, country, method } = await isAllowedCountry(req);

  if (!allowed) {
    const ip = getClientIp(req);

    logger.warn('Geo-restricted access attempt', {
      country,
      method,
      path: req.path,
      ip: ip.substring(0, ip.lastIndexOf('.')) + '.xxx',
    });

    // Log security event
    await logSecurityEvent('SECURITY_UNAUTHORIZED_ACCESS', {
      ipAddress: ip,
      userAgent: req.headers['user-agent']?.toString(),
      resource: req.path,
      details: {
        reason: 'geo-restriction',
        country,
        detectionMethod: method,
      },
    });

    res.status(403).json({
      error: 'שירות זה זמין רק בישראל',
      errorEn: 'This service is only available in Israel',
      code: 'GEO_RESTRICTED',
      country,
    });
    return;
  }

  // Add country to request for downstream use
  (req as any).geoCountry = country;

  return next();
}

/**
 * Geo-restriction middleware factory with custom allowed countries
 */
export function createGeoRestrictionMiddleware(
  allowedCountries: string[],
  options: {
    failOpen?: boolean;
    logBlocked?: boolean;
  } = {}
): (req: Request, res: Response, next: () => void | Promise<void>) => Promise<void> {
  const { failOpen = true, logBlocked = true } = options;

  return async (req: Request, res: Response, next: () => void | Promise<void>) => {
    if (!GEO_RESTRICTION_ENABLED) {
      return next();
    }

    const ip = getClientIp(req);

    // Bypass for development
    if (BYPASS_IPS.includes(ip)) {
      return next();
    }

    // Get country
    let country = getCountryFromHeaders(req);
    let method = 'header';

    if (!country) {
      country = await lookupCountryFromIp(ip);
      method = country ? 'ip-lookup' : 'unknown';
    }

    // Check if allowed
    const isAllowed = country
      ? allowedCountries.includes(country)
      : failOpen;

    if (!isAllowed) {
      if (logBlocked) {
        await logSecurityEvent('SECURITY_UNAUTHORIZED_ACCESS', {
          ipAddress: ip,
          resource: req.path,
          details: { reason: 'geo-restriction', country, method },
        });
      }

      res.status(403).json({
        error: 'שירות זה אינו זמין באזורך',
        errorEn: 'This service is not available in your region',
        code: 'GEO_RESTRICTED',
      });
      return;
    }

    (req as any).geoCountry = country;
    return next();
  };
}

/**
 * Check if an IP is from Israel (utility function)
 */
export async function isIsraeliIp(ip: string): Promise<boolean> {
  if (BYPASS_IPS.includes(ip)) {
    return true;
  }

  const country = await lookupCountryFromIp(ip);
  return country === 'IL';
}

/**
 * Clear geo cache (for testing)
 */
export function clearGeoCache(): void {
  geoCache.clear();
}

export default {
  geoRestrictionMiddleware,
  createGeoRestrictionMiddleware,
  isIsraeliIp,
  clearGeoCache,
  ALLOWED_COUNTRIES,
};
