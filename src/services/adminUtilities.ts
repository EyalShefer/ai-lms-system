/**
 * Admin Utilities Service
 *
 * Maintenance and reconciliation functions for the adaptive learning system.
 * These functions are designed to be run by administrators or scheduled jobs.
 *
 * Key Features:
 * - Data reconciliation (ensure consistency between events and profiles)
 * - Cache cleanup (remove expired variants)
 * - System health checks
 * - Batch operations
 *
 * Created: 2026-01-23
 */

import { db } from '../firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { reanalyzeAllScaffoldingPatterns } from './adaptiveIntegrationService';
import { cleanupExpiredVariants, getCacheStats } from './variantCacheService';

// ========================================
// RECONCILIATION OPERATIONS
// ========================================

/**
 * Reconcile scaffolding patterns for a single user
 *
 * Re-analyzes all adaptive events and updates profile patterns.
 * Use this when you suspect data inconsistency.
 *
 * @param userId - The user to reconcile
 * @returns Success status
 */
export const reconcileUserScaffoldingPatterns = async (userId: string): Promise<boolean> => {
    console.log(`🔄 Reconciling scaffolding patterns for user ${userId}...`);

    try {
        const success = await reanalyzeAllScaffoldingPatterns(userId);

        if (success) {
            console.log(`✅ Successfully reconciled user ${userId}`);
        } else {
            console.warn(`⚠️ No data to reconcile for user ${userId}`);
        }

        return success;
    } catch (error) {
        console.error(`❌ Failed to reconcile user ${userId}:`, error);
        return false;
    }
};

/**
 * Reconcile all users in the system
 *
 * WARNING: This is a heavy operation. Use sparingly.
 * Consider running during low-traffic hours.
 *
 * @param maxUsers - Maximum number of users to process (safety limit)
 * @returns Statistics about the operation
 */
export const reconcileAllUsers = async (maxUsers: number = 100): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
}> => {
    console.log(`🔄 Starting bulk reconciliation (max ${maxUsers} users)...`);

    const stats = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0
    };

    try {
        // Get all users with profile data
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        console.log(`📊 Found ${snapshot.size} users total`);

        // Process each user (with limit)
        for (const userDoc of snapshot.docs) {
            if (stats.processed >= maxUsers) {
                console.log(`⚠️ Reached max users limit (${maxUsers}), stopping.`);
                stats.skipped = snapshot.size - stats.processed;
                break;
            }

            const userId = userDoc.id;
            stats.processed++;

            console.log(`[${stats.processed}/${maxUsers}] Processing user ${userId}...`);

            const success = await reconcileUserScaffoldingPatterns(userId);

            if (success) {
                stats.succeeded++;
            } else {
                stats.failed++;
            }

            // Small delay to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('✅ Bulk reconciliation complete:', stats);
        return stats;

    } catch (error) {
        console.error('❌ Bulk reconciliation failed:', error);
        return stats;
    }
};

// ========================================
// CACHE CLEANUP OPERATIONS
// ========================================

/**
 * Clean up expired variants from cache
 *
 * Removes variants that have passed their TTL (expiresAt < now).
 * Safe to run regularly (e.g., daily cron job).
 *
 * @returns Number of variants cleaned up
 */
export const runCacheCleanup = async (): Promise<number> => {
    console.log('🧹 Running cache cleanup...');

    try {
        const cleanedCount = await cleanupExpiredVariants();

        console.log(`✅ Cache cleanup complete: removed ${cleanedCount} expired variants`);

        return cleanedCount;
    } catch (error) {
        console.error('❌ Cache cleanup failed:', error);
        return 0;
    }
};

/**
 * Get cache statistics for monitoring
 *
 * @returns Cache usage statistics
 */
export const getCacheStatistics = async (): Promise<{
    totalCached: number;
    byType: { הבנה: number; העמקה: number };
}> => {
    try {
        const stats = await getCacheStats();
        console.log('📊 Cache stats:', stats);
        return stats;
    } catch (error) {
        console.error('❌ Failed to get cache stats:', error);
        return { totalCached: 0, byType: { הבנה: 0, העמקה: 0 } };
    }
};

// ========================================
// HEALTH CHECK OPERATIONS
// ========================================

/**
 * Check system health
 *
 * Runs basic diagnostics to ensure the adaptive system is working properly.
 *
 * @returns Health check results
 */
export const runHealthCheck = async (): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
        cache: { status: 'ok' | 'warning' | 'error'; message: string };
        users: { status: 'ok' | 'warning' | 'error'; message: string; count: number };
        events: { status: 'ok' | 'warning' | 'error'; message: string };
    };
}> => {
    console.log('🏥 Running health check...');

    const results = {
        status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        checks: {
            cache: { status: 'ok' as 'ok' | 'warning' | 'error', message: '' },
            users: { status: 'ok' as 'ok' | 'warning' | 'error', message: '', count: 0 },
            events: { status: 'ok' as 'ok' | 'warning' | 'error', message: '' }
        }
    };

    try {
        // Check 1: Cache stats
        const cacheStats = await getCacheStats();

        if (cacheStats.totalCached === 0) {
            results.checks.cache.status = 'warning';
            results.checks.cache.message = 'No variants cached yet';
        } else {
            results.checks.cache.status = 'ok';
            results.checks.cache.message = `${cacheStats.totalCached} variants cached`;
        }

        // Check 2: Users count
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        results.checks.users.count = usersSnapshot.size;

        if (usersSnapshot.size === 0) {
            results.checks.users.status = 'warning';
            results.checks.users.message = 'No users in system';
        } else {
            results.checks.users.status = 'ok';
            results.checks.users.message = `${usersSnapshot.size} users active`;
        }

        // Check 3: Sample a user's events to ensure logging is working
        if (usersSnapshot.size > 0) {
            const sampleUser = usersSnapshot.docs[0];
            const eventsRef = collection(db, 'users', sampleUser.id, 'adaptive_events');
            const eventsSnapshot = await getDocs(eventsRef);

            if (eventsSnapshot.size === 0) {
                results.checks.events.status = 'warning';
                results.checks.events.message = 'Sample user has no events';
            } else {
                results.checks.events.status = 'ok';
                results.checks.events.message = `Event logging operational`;
            }
        } else {
            results.checks.events.status = 'warning';
            results.checks.events.message = 'No users to check events';
        }

        // Determine overall status
        const hasError = Object.values(results.checks).some(c => c.status === 'error');
        const hasWarning = Object.values(results.checks).some(c => c.status === 'warning');

        if (hasError) {
            results.status = 'unhealthy';
        } else if (hasWarning) {
            results.status = 'degraded';
        } else {
            results.status = 'healthy';
        }

        console.log('✅ Health check complete:', results.status);
        return results;

    } catch (error) {
        console.error('❌ Health check failed:', error);
        results.status = 'unhealthy';
        results.checks.cache.status = 'error';
        results.checks.cache.message = 'Health check failed';
        return results;
    }
};

// ========================================
// SCHEDULED TASKS
// ========================================

/**
 * Daily maintenance routine
 *
 * Recommended to run once per day during low-traffic hours.
 * Performs cache cleanup and basic reconciliation.
 *
 * @returns Summary of operations performed
 */
export const runDailyMaintenance = async (): Promise<{
    timestamp: Date;
    cacheCleanup: { removed: number };
    healthCheck: Awaited<ReturnType<typeof runHealthCheck>>;
}> => {
    console.log('🔧 Starting daily maintenance...');

    const timestamp = new Date();

    // 1. Cache cleanup
    const removed = await runCacheCleanup();

    // 2. Health check
    const healthCheck = await runHealthCheck();

    console.log('✅ Daily maintenance complete');

    return {
        timestamp,
        cacheCleanup: { removed },
        healthCheck
    };
};

/**
 * Weekly reconciliation routine
 *
 * Recommended to run once per week.
 * Re-analyzes scaffolding patterns for all users to ensure data consistency.
 *
 * @param maxUsers - Maximum users to process
 * @returns Reconciliation statistics
 */
export const runWeeklyReconciliation = async (
    maxUsers: number = 1000
): Promise<Awaited<ReturnType<typeof reconcileAllUsers>>> => {
    console.log('🔄 Starting weekly reconciliation...');

    const stats = await reconcileAllUsers(maxUsers);

    console.log('✅ Weekly reconciliation complete:', stats);

    return stats;
};

// ========================================
// UTILITY EXPORTS
// ========================================

/**
 * Get a summary of all admin utilities
 * (useful for documentation or CLI help)
 */
export const getAdminUtilitiesSummary = () => {
    return {
        reconciliation: {
            reconcileUserScaffoldingPatterns: 'Re-analyze scaffolding patterns for one user',
            reconcileAllUsers: 'Bulk reconciliation for all users (heavy operation)',
        },
        cache: {
            runCacheCleanup: 'Remove expired variants from cache',
            getCacheStatistics: 'Get current cache usage stats',
        },
        health: {
            runHealthCheck: 'Check system health and diagnostics',
        },
        scheduled: {
            runDailyMaintenance: 'Daily cleanup + health check',
            runWeeklyReconciliation: 'Weekly full reconciliation',
        }
    };
};

/**
 * Example usage for Cloud Functions:
 *
 * ```typescript
 * // functions/src/index.ts
 * import * as functions from 'firebase-functions';
 * import { runDailyMaintenance, runWeeklyReconciliation } from './services/adminUtilities';
 *
 * // Run every day at 2 AM
 * export const dailyMaintenance = functions.pubsub
 *     .schedule('0 2 * * *')
 *     .timeZone('Asia/Jerusalem')
 *     .onRun(async () => {
 *         await runDailyMaintenance();
 *     });
 *
 * // Run every Sunday at 3 AM
 * export const weeklyReconciliation = functions.pubsub
 *     .schedule('0 3 * * 0')
 *     .timeZone('Asia/Jerusalem')
 *     .onRun(async () => {
 *         await runWeeklyReconciliation(1000);
 *     });
 * ```
 */
