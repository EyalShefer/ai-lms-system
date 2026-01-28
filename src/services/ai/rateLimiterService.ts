/**
 * Rate Limiter Service
 *
 * Limits content creation to prevent abuse.
 * Default: 10 creations per hour per user.
 *
 * Uses localStorage for client-side enforcement (can be bypassed, but
 * backend should also enforce limits for security).
 */

// ========== Constants ==========

const RATE_LIMIT_KEY = 'wizdi_rate_limit';
const MAX_CREATIONS_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ========== Types ==========

interface RateLimitEntry {
    userId: string;
    timestamps: number[];  // Creation timestamps within the window
}

// ========== Rate Limit Functions ==========

/**
 * Get rate limit entry from localStorage
 */
function getRateLimitEntry(userId: string): RateLimitEntry {
    try {
        const stored = localStorage.getItem(`${RATE_LIMIT_KEY}_${userId}`);
        if (!stored) {
            return { userId, timestamps: [] };
        }
        return JSON.parse(stored);
    } catch {
        return { userId, timestamps: [] };
    }
}

/**
 * Save rate limit entry to localStorage
 */
function saveRateLimitEntry(entry: RateLimitEntry): void {
    try {
        localStorage.setItem(`${RATE_LIMIT_KEY}_${entry.userId}`, JSON.stringify(entry));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Clean up old timestamps outside the window
 */
function cleanOldTimestamps(timestamps: number[]): number[] {
    const cutoff = Date.now() - WINDOW_MS;
    return timestamps.filter(ts => ts > cutoff);
}

/**
 * Check if user can create content (under rate limit)
 */
export function canCreateContent(userId: string): {
    allowed: boolean;
    remaining: number;
    resetIn?: number;  // ms until reset
} {
    if (!userId) {
        return { allowed: false, remaining: 0 };
    }

    const entry = getRateLimitEntry(userId);
    const validTimestamps = cleanOldTimestamps(entry.timestamps);

    if (validTimestamps.length >= MAX_CREATIONS_PER_HOUR) {
        // Rate limited
        const oldestTimestamp = Math.min(...validTimestamps);
        const resetIn = oldestTimestamp + WINDOW_MS - Date.now();

        return {
            allowed: false,
            remaining: 0,
            resetIn: Math.max(0, resetIn)
        };
    }

    return {
        allowed: true,
        remaining: MAX_CREATIONS_PER_HOUR - validTimestamps.length
    };
}

/**
 * Record a content creation event
 */
export function recordCreation(userId: string): void {
    if (!userId) return;

    const entry = getRateLimitEntry(userId);
    const validTimestamps = cleanOldTimestamps(entry.timestamps);

    validTimestamps.push(Date.now());
    entry.timestamps = validTimestamps;

    saveRateLimitEntry(entry);
    console.log(`[RateLimiter] Recorded creation for ${userId}. ${MAX_CREATIONS_PER_HOUR - validTimestamps.length} remaining`);
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(userId: string): {
    used: number;
    limit: number;
    remaining: number;
    resetIn?: number;
} {
    if (!userId) {
        return { used: 0, limit: MAX_CREATIONS_PER_HOUR, remaining: MAX_CREATIONS_PER_HOUR };
    }

    const entry = getRateLimitEntry(userId);
    const validTimestamps = cleanOldTimestamps(entry.timestamps);
    const used = validTimestamps.length;

    let resetIn: number | undefined;
    if (used > 0) {
        const oldestTimestamp = Math.min(...validTimestamps);
        resetIn = oldestTimestamp + WINDOW_MS - Date.now();
    }

    return {
        used,
        limit: MAX_CREATIONS_PER_HOUR,
        remaining: Math.max(0, MAX_CREATIONS_PER_HOUR - used),
        resetIn: resetIn && resetIn > 0 ? resetIn : undefined
    };
}

/**
 * Format reset time for display
 */
export function formatResetTime(resetInMs: number): string {
    const minutes = Math.ceil(resetInMs / 60000);
    if (minutes <= 1) {
        return 'עוד דקה';
    }
    if (minutes < 60) {
        return `עוד ${minutes} דקות`;
    }
    return 'עוד כשעה';
}

/**
 * Clear rate limit for user (for testing/admin)
 */
export function clearRateLimit(userId: string): void {
    localStorage.removeItem(`${RATE_LIMIT_KEY}_${userId}`);
    console.log(`[RateLimiter] Cleared rate limit for ${userId}`);
}

/**
 * Rate limit check with Hebrew error message
 */
export function checkRateLimitWithMessage(userId: string): {
    allowed: boolean;
    message?: string;
} {
    const status = canCreateContent(userId);

    if (status.allowed) {
        return { allowed: true };
    }

    const resetTime = status.resetIn ? formatResetTime(status.resetIn) : 'בקרוב';
    return {
        allowed: false,
        message: `יצרת כבר ${MAX_CREATIONS_PER_HOUR} תכנים בשעה האחרונה. נסה שוב ${resetTime}.`
    };
}
