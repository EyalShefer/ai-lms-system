import React, { useEffect, useState, useCallback } from 'react';
import { IconLoader } from '../icons';

interface GeoGuardProps {
    children: React.ReactNode;
    /** If true, bypass geo-check in development mode */
    bypassInDev?: boolean;
    /** If true, allow access when geo-check fails (fail-open). Default: true for better UX */
    failOpen?: boolean;
}

interface GeoCheckResult {
    allowed: boolean;
    country: string | null;
    method: string;
    error?: string;
}

// Cache key for session storage
const GEO_CACHE_KEY = 'ai_lms_geo_check_v2'; // v2 to invalidate old cache after CSP fix
const GEO_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get cached geo result if still valid
 */
function getCachedResult(): GeoCheckResult | null {
    try {
        const cached = sessionStorage.getItem(GEO_CACHE_KEY);
        if (!cached) return null;

        const { result, timestamp } = JSON.parse(cached);

        // Check if cache is still valid
        if (Date.now() - timestamp < GEO_CACHE_TTL) {
            return result;
        }

        // Clear expired cache
        sessionStorage.removeItem(GEO_CACHE_KEY);
        return null;
    } catch {
        return null;
    }
}

/**
 * Cache the geo result
 */
function cacheResult(result: GeoCheckResult): void {
    try {
        sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
            result,
            timestamp: Date.now()
        }));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Check country using multiple fallback APIs
 * All APIs use HTTPS to avoid mixed-content issues
 */
async function checkCountry(): Promise<GeoCheckResult> {
    // List of geo APIs to try (in order) - all HTTPS
    const apis = [
        {
            name: 'ipwho.is',
            url: 'https://ipwho.is/',
            extractCountry: (data: any) => data.success !== false ? data.country_code : null,
        },
        {
            name: 'ipapi.co',
            url: 'https://ipapi.co/json/',
            extractCountry: (data: any) => data.country_code || data.country,
        },
        {
            name: 'ipinfo.io',
            url: 'https://ipinfo.io/json',
            extractCountry: (data: any) => data.country,
        },
        {
            name: 'freeipapi.com',
            url: 'https://freeipapi.com/api/json/',
            extractCountry: (data: any) => data.countryCode,
        },
        {
            name: 'ipdata.co',
            url: 'https://api.ipdata.co/?api-key=test',
            extractCountry: (data: any) => data.country_code,
        },
    ];

    for (const api of apis) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(api.url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`[GeoGuard] ${api.name} returned ${response.status}`);
                continue;
            }

            const data = await response.json();
            const country = api.extractCountry(data);

            if (country) {
                const countryCode = country.toUpperCase();
                const isIsrael = countryCode === 'IL';

                console.log(`[GeoGuard] ${api.name}: country=${countryCode}, allowed=${isIsrael}`);

                return {
                    allowed: isIsrael,
                    country: countryCode,
                    method: api.name,
                };
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.warn(`[GeoGuard] ${api.name} timeout`);
            } else {
                console.warn(`[GeoGuard] ${api.name} error:`, error.message);
            }
            // Continue to next API
        }
    }

    // All APIs failed
    return {
        allowed: true, // Fail-open by default
        country: null,
        method: 'fallback',
        error: 'All geo APIs failed',
    };
}

/**
 * Log geo block event to analytics
 */
async function logGeoBlock(country: string | null, method: string): Promise<void> {
    try {
        // Try to log to your analytics/security service
        const { logSecurityEvent } = await import('../services/loggerService');
        logSecurityEvent('GEO_BLOCK', {
            country,
            method,
            timestamp: new Date().toISOString(),
            url: window.location.href,
        });
    } catch {
        // Silently fail if logging service is unavailable
        console.warn('[GeoGuard] Failed to log geo block event');
    }
}

const GeoGuard: React.FC<GeoGuardProps> = ({
    children,
    bypassInDev = true,
    failOpen = true
}) => {
    const [result, setResult] = useState<GeoCheckResult | null>(() => getCachedResult());
    const [checking, setChecking] = useState(!result);

    const performCheck = useCallback(async () => {
        // Bypass in development mode
        if (bypassInDev && import.meta.env.DEV) {
            const devResult: GeoCheckResult = {
                allowed: true,
                country: 'DEV',
                method: 'dev-bypass',
            };
            setResult(devResult);
            setChecking(false);
            return;
        }

        // Check cache first
        const cached = getCachedResult();
        if (cached) {
            setResult(cached);
            setChecking(false);
            return;
        }

        setChecking(true);

        try {
            const checkResult = await checkCountry();

            // Apply fail-open/fail-closed policy
            if (checkResult.error && !failOpen) {
                checkResult.allowed = false;
            }

            // Cache the result
            cacheResult(checkResult);
            setResult(checkResult);

            // Log if blocked
            if (!checkResult.allowed) {
                await logGeoBlock(checkResult.country, checkResult.method);
            }
        } catch (error) {
            console.error('[GeoGuard] Unexpected error:', error);

            // Apply fail-open/fail-closed policy
            const fallbackResult: GeoCheckResult = {
                allowed: failOpen,
                country: null,
                method: 'error-fallback',
                error: 'Unexpected error during geo check',
            };
            setResult(fallbackResult);
        } finally {
            setChecking(false);
        }
    }, [bypassInDev, failOpen]);

    useEffect(() => {
        if (!result) {
            performCheck();
        }
    }, [result, performCheck]);

    // Loading state
    if (checking || result === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 flex-col gap-4">
                <IconLoader className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-gray-500 font-medium">מבצע בדיקת אבטחה...</p>
                <p className="text-gray-400 text-sm">Security verification in progress...</p>
            </div>
        );
    }

    // Blocked state
    if (!result.allowed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border-t-4 border-red-500">
                    {/* Israeli Flag */}
                    <div className="text-5xl mb-4">🇮🇱</div>

                    <h1 className="text-2xl font-bold text-gray-800 mb-2" dir="rtl">
                        הגישה מוגבלת לישראל בלבד
                    </h1>

                    <p className="text-gray-600 mb-6" dir="rtl">
                        מערכת זו זמינה לשימוש מישראל בלבד.
                        <br />
                        אם אתה נמצא בישראל ורואה הודעה זו, נסה להשבית VPN או פרוקסי.
                    </p>

                    <div className="border-t border-gray-200 pt-4 mt-4">
                        <h2 className="text-lg font-semibold text-gray-700 mb-2">
                            Access Restricted to Israel
                        </h2>
                        <p className="text-gray-500 text-sm">
                            This system is only available for users in Israel.
                            <br />
                            If you are in Israel and seeing this message, try disabling your VPN or proxy.
                        </p>
                    </div>

                    {result.country && result.country !== 'UNKNOWN' && (
                        <div className="mt-6 p-3 bg-gray-100 rounded-lg">
                            <p className="text-xs text-gray-500">
                                Detected location: <span className="font-mono font-bold">{result.country}</span>
                            </p>
                        </div>
                    )}

                    <div className="mt-6 text-xs text-gray-400">
                        Event ID: GEO_{Date.now().toString(36).toUpperCase()}
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={() => {
                                // Clear cache and retry
                                sessionStorage.removeItem(GEO_CACHE_KEY);
                                setResult(null);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            נסה שוב / Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Allowed - render children
    return <>{children}</>;
};

export default GeoGuard;
