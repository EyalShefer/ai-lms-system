/**
 * Licensing Controller
 *
 * Cloud Functions for managing institutions, licenses, and usage statistics.
 */

import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
    getInstitutionUsageStats,
    getAllInstitutionsUsage,
    getCurrentUsage,
    getLicenseForInstitution,
    getInstitutionForUser,
} from "../services/usageService";

const db = getFirestore();

// ============================================================================
// Types
// ============================================================================

type LicenseTier = 'free' | 'basic' | 'pro' | 'enterprise';

interface CreateInstitutionData {
    name: string;
    type: 'school' | 'university' | 'organization' | 'individual';
    contactEmail: string;
    tier?: LicenseTier;
}

interface UpdateLicenseData {
    institutionId: string;
    tier?: LicenseTier;
    quotas?: {
        textTokensMonthly?: number;
        imageGenerationsMonthly?: number;
        audioMinutesMonthly?: number;
    };
    status?: 'active' | 'suspended' | 'expired';
}

// License tier defaults
const LICENSE_TIER_DEFAULTS: Record<LicenseTier, {
    quotas: {
        textTokensMonthly: number;
        imageGenerationsMonthly: number;
        audioMinutesMonthly: number;
        podcastGenerationsMonthly: number;
        maxTeachers: number;
        maxStudentsPerTeacher: number;
    };
    features: Record<string, boolean>;
}> = {
    free: {
        quotas: {
            textTokensMonthly: 50000,
            imageGenerationsMonthly: 10,
            audioMinutesMonthly: 10,
            podcastGenerationsMonthly: 2,
            maxTeachers: 1,
            maxStudentsPerTeacher: 30,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: false,
            referenceExams: false,
            advancedAnalytics: false,
            apiAccess: false,
            whiteLabel: false,
        },
    },
    basic: {
        quotas: {
            textTokensMonthly: 500000,
            imageGenerationsMonthly: 50,
            audioMinutesMonthly: 60,
            podcastGenerationsMonthly: 10,
            maxTeachers: 5,
            maxStudentsPerTeacher: 100,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: true,
            referenceExams: false,
            advancedAnalytics: false,
            apiAccess: false,
            whiteLabel: false,
        },
    },
    pro: {
        quotas: {
            textTokensMonthly: 2000000,
            imageGenerationsMonthly: 200,
            audioMinutesMonthly: 300,
            podcastGenerationsMonthly: 50,
            maxTeachers: 20,
            maxStudentsPerTeacher: 300,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: true,
            referenceExams: true,
            advancedAnalytics: true,
            apiAccess: false,
            whiteLabel: false,
        },
    },
    enterprise: {
        quotas: {
            textTokensMonthly: Number.MAX_SAFE_INTEGER,
            imageGenerationsMonthly: Number.MAX_SAFE_INTEGER,
            audioMinutesMonthly: Number.MAX_SAFE_INTEGER,
            podcastGenerationsMonthly: Number.MAX_SAFE_INTEGER,
            maxTeachers: Number.MAX_SAFE_INTEGER,
            maxStudentsPerTeacher: Number.MAX_SAFE_INTEGER,
        },
        features: {
            lessonGeneration: true,
            examGeneration: true,
            imageGeneration: true,
            podcastGeneration: true,
            mindMapGeneration: true,
            knowledgeBase: true,
            referenceExams: true,
            advancedAnalytics: true,
            apiAccess: true,
            whiteLabel: true,
        },
    },
};

// ============================================================================
// Helper Functions
// ============================================================================

async function isSystemAdmin(userId: string): Promise<boolean> {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return false;

        const userData = userDoc.data();
        return userData?.roles?.includes('admin') || userData?.isAdmin === true;
    } catch {
        return false;
    }
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
}

// ============================================================================
// Institution Management
// ============================================================================

/**
 * Create a new institution with license
 * Admin only
 */
export const createInstitution = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isAdmin = await isSystemAdmin(request.auth.uid);
    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'רק מנהלי מערכת יכולים ליצור מוסדות');
    }

    const data = request.data as CreateInstitutionData;

    if (!data.name || !data.type || !data.contactEmail) {
        throw new HttpsError('invalid-argument', 'חסרים שדות חובה: name, type, contactEmail');
    }

    const tier = data.tier || 'free';
    const tierDefaults = LICENSE_TIER_DEFAULTS[tier];

    try {
        // Create license first
        const licenseRef = db.collection('licenses').doc();
        const now = Timestamp.now();
        const oneYearFromNow = Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

        await licenseRef.set({
            id: licenseRef.id,
            tier,
            startDate: now,
            endDate: tier === 'free' ? null : oneYearFromNow,
            billingCycle: tier === 'free' ? 'lifetime' : 'yearly',
            quotas: {
                ...tierDefaults.quotas,
                textTokensUsed: 0,
                imageGenerationsUsed: 0,
                audioMinutesUsed: 0,
                podcastGenerationsUsed: 0,
            },
            overagePolicy: {
                allowOverage: tier !== 'free',
                overageRatePer1K: tier === 'enterprise' ? 0.02 : (tier === 'pro' ? 0.03 : 0.05),
                maxOveragePercent: tier === 'free' ? 0 : (tier === 'basic' ? 10 : 20),
                hardLimit: tier === 'free',
            },
            features: tierDefaults.features,
            pricing: {
                monthlyPrice: tier === 'free' ? 0 : (tier === 'basic' ? 199 : (tier === 'pro' ? 599 : 0)),
                yearlyPrice: tier === 'free' ? 0 : (tier === 'basic' ? 1990 : (tier === 'pro' ? 5990 : 0)),
                currency: 'ILS',
            },
            status: 'active',
            createdAt: now,
            updatedAt: now,
            lastResetAt: now,
            nextResetAt: Timestamp.fromDate(getNextMonthStart()),
        });

        // Create institution
        const institutionRef = db.collection('institutions').doc();
        await institutionRef.set({
            id: institutionRef.id,
            name: data.name,
            slug: generateSlug(data.name),
            type: data.type,
            contactEmail: data.contactEmail,
            licenseId: licenseRef.id,
            licenseStatus: 'active',
            stats: {
                totalTeachers: 0,
                totalStudents: 0,
                totalCoursesCreated: 0,
                totalAiCalls: 0,
                lastActivityAt: null,
            },
            settings: {
                allowTeacherInvites: true,
                defaultLanguage: 'he',
                enableAdvancedFeatures: tier !== 'free',
            },
            createdAt: now,
            updatedAt: now,
            createdBy: request.auth.uid,
        });

        // Update license with institution ID
        await licenseRef.update({ institutionId: institutionRef.id });

        logger.info(`Created institution: ${institutionRef.id} with license: ${licenseRef.id}`);

        return {
            success: true,
            institutionId: institutionRef.id,
            licenseId: licenseRef.id,
        };
    } catch (error: any) {
        logger.error('Error creating institution:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Update license for an institution
 * Admin only
 */
export const updateLicense = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isAdmin = await isSystemAdmin(request.auth.uid);
    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'רק מנהלי מערכת יכולים לעדכן רישיונות');
    }

    const data = request.data as UpdateLicenseData;

    if (!data.institutionId) {
        throw new HttpsError('invalid-argument', 'חסר institutionId');
    }

    try {
        // Get institution
        const institutionDoc = await db.collection('institutions').doc(data.institutionId).get();
        if (!institutionDoc.exists) {
            throw new HttpsError('not-found', 'מוסד לא נמצא');
        }

        const institution = institutionDoc.data()!;
        const licenseId = institution.licenseId;

        if (!licenseId) {
            throw new HttpsError('not-found', 'רישיון לא נמצא');
        }

        const updates: Record<string, any> = {
            updatedAt: Timestamp.now(),
        };

        // Update tier if provided
        if (data.tier) {
            const tierDefaults = LICENSE_TIER_DEFAULTS[data.tier];
            updates.tier = data.tier;
            updates.quotas = {
                ...tierDefaults.quotas,
                textTokensUsed: FieldValue.increment(0), // Keep existing usage
                imageGenerationsUsed: FieldValue.increment(0),
                audioMinutesUsed: FieldValue.increment(0),
                podcastGenerationsUsed: FieldValue.increment(0),
            };
            updates.features = tierDefaults.features;
        }

        // Update specific quotas if provided
        if (data.quotas) {
            if (data.quotas.textTokensMonthly) {
                updates['quotas.textTokensMonthly'] = data.quotas.textTokensMonthly;
            }
            if (data.quotas.imageGenerationsMonthly) {
                updates['quotas.imageGenerationsMonthly'] = data.quotas.imageGenerationsMonthly;
            }
            if (data.quotas.audioMinutesMonthly) {
                updates['quotas.audioMinutesMonthly'] = data.quotas.audioMinutesMonthly;
            }
        }

        // Update status if provided
        if (data.status) {
            updates.status = data.status;

            // Also update institution's license status
            await db.collection('institutions').doc(data.institutionId).update({
                licenseStatus: data.status,
                updatedAt: Timestamp.now(),
            });
        }

        await db.collection('licenses').doc(licenseId).update(updates);

        logger.info(`Updated license ${licenseId} for institution ${data.institutionId}`);

        return { success: true };
    } catch (error: any) {
        logger.error('Error updating license:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Add user to institution
 * Admin or Institution Admin only
 */
export const addUserToInstitution = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { userId, institutionId, role } = request.data;

    if (!userId || !institutionId) {
        throw new HttpsError('invalid-argument', 'חסרים שדות חובה');
    }

    // Check permissions
    const isAdmin = await isSystemAdmin(request.auth.uid);
    const callerInstitutionId = await getInstitutionForUser(request.auth.uid);

    if (!isAdmin && callerInstitutionId !== institutionId) {
        throw new HttpsError('permission-denied', 'אין הרשאה להוסיף משתמשים למוסד זה');
    }

    try {
        // Update user document
        await db.collection('users').doc(userId).update({
            institutionId,
            role: role || 'teacher',
            updatedAt: Timestamp.now(),
        });

        // Update institution stats
        await db.collection('institutions').doc(institutionId).update({
            'stats.totalTeachers': FieldValue.increment(1),
            'stats.lastActivityAt': Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        logger.info(`Added user ${userId} to institution ${institutionId}`);

        return { success: true };
    } catch (error: any) {
        logger.error('Error adding user to institution:', error);
        throw new HttpsError('internal', error.message);
    }
});

// ============================================================================
// Usage Statistics
// ============================================================================

/**
 * Get usage statistics for current user's institution
 */
export const getMyUsageStats = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const userId = request.auth.uid;

    try {
        const institutionId = await getInstitutionForUser(userId);
        const license = await getLicenseForInstitution(institutionId);
        const usage = await getCurrentUsage(institutionId, userId);

        // Calculate percentages
        const textPercent = license.quotas.textTokensMonthly === Number.MAX_SAFE_INTEGER
            ? 0
            : Math.round((usage.textTokensUsed / license.quotas.textTokensMonthly) * 100);

        const imagesPercent = license.quotas.imageGenerationsMonthly === Number.MAX_SAFE_INTEGER
            ? 0
            : Math.round((usage.imageGenerationsUsed / license.quotas.imageGenerationsMonthly) * 100);

        return {
            tier: license.tier,
            status: license.status,
            usage: {
                textTokens: {
                    used: usage.textTokensUsed,
                    limit: license.quotas.textTokensMonthly,
                    percent: textPercent,
                },
                images: {
                    used: usage.imageGenerationsUsed,
                    limit: license.quotas.imageGenerationsMonthly,
                    percent: imagesPercent,
                },
                audio: {
                    used: usage.audioMinutesUsed,
                    limit: license.quotas.audioMinutesMonthly,
                    percent: license.quotas.audioMinutesMonthly === Number.MAX_SAFE_INTEGER
                        ? 0
                        : Math.round((usage.audioMinutesUsed / license.quotas.audioMinutesMonthly) * 100),
                },
                podcasts: {
                    used: usage.podcastGenerationsUsed,
                    limit: license.quotas.podcastGenerationsMonthly,
                    percent: license.quotas.podcastGenerationsMonthly === Number.MAX_SAFE_INTEGER
                        ? 0
                        : Math.round((usage.podcastGenerationsUsed / license.quotas.podcastGenerationsMonthly) * 100),
                },
            },
            features: license.features,
            resetDate: getNextMonthStart().toISOString(),
        };
    } catch (error: any) {
        logger.error('Error getting usage stats:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get detailed usage for institution (admin/institution admin)
 */
export const getInstitutionUsage = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { institutionId } = request.data;

    if (!institutionId) {
        throw new HttpsError('invalid-argument', 'חסר institutionId');
    }

    // Check permissions
    const isAdmin = await isSystemAdmin(request.auth.uid);
    const userInstitutionId = await getInstitutionForUser(request.auth.uid);

    if (!isAdmin && userInstitutionId !== institutionId) {
        throw new HttpsError('permission-denied', 'אין הרשאה לצפות בנתוני מוסד זה');
    }

    try {
        const stats = await getInstitutionUsageStats(institutionId);
        const license = await getLicenseForInstitution(institutionId);

        return {
            ...stats,
            license: {
                tier: license.tier,
                status: license.status,
                quotas: license.quotas,
            },
        };
    } catch (error: any) {
        logger.error('Error getting institution usage:', error);
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Get all institutions usage (super admin only)
 */
export const getAllUsage = onCall({ cors: true }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isAdmin = await isSystemAdmin(request.auth.uid);
    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'רק מנהלי מערכת יכולים לצפות בנתונים אלה');
    }

    try {
        const institutions = await getAllInstitutionsUsage();
        return { institutions };
    } catch (error: any) {
        logger.error('Error getting all usage:', error);
        throw new HttpsError('internal', error.message);
    }
});

// ============================================================================
// Scheduled Functions
// ============================================================================

/**
 * Monthly quota reset - runs at midnight on the 1st of each month
 */
export const monthlyQuotaReset = onSchedule('0 0 1 * *', async () => {
    logger.info('Starting monthly quota reset...');

    try {
        const licensesSnapshot = await db.collection('licenses')
            .where('status', '==', 'active')
            .get();

        let resetCount = 0;
        const batch = db.batch();

        for (const doc of licensesSnapshot.docs) {
            batch.update(doc.ref, {
                'quotas.textTokensUsed': 0,
                'quotas.imageGenerationsUsed': 0,
                'quotas.audioMinutesUsed': 0,
                'quotas.podcastGenerationsUsed': 0,
                lastResetAt: Timestamp.now(),
                nextResetAt: Timestamp.fromDate(getNextMonthStart()),
                updatedAt: Timestamp.now(),
            });
            resetCount++;
        }

        await batch.commit();
        logger.info(`Monthly quota reset completed. Reset ${resetCount} licenses.`);
    } catch (error) {
        logger.error('Error in monthly quota reset:', error);
        throw error;
    }
});

/**
 * Check for expiring licenses - runs daily at 9 AM
 */
export const checkExpiringLicenses = onSchedule('0 9 * * *', async () => {
    logger.info('Checking for expiring licenses...');

    try {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        const expiringLicenses = await db.collection('licenses')
            .where('status', '==', 'active')
            .where('endDate', '<=', Timestamp.fromDate(sevenDaysFromNow))
            .where('endDate', '>', Timestamp.now())
            .get();

        for (const doc of expiringLicenses.docs) {
            const license = doc.data();

            // Create notification
            await db.collection('usage_notifications').doc().set({
                institutionId: license.institutionId,
                type: 'license_expiring',
                message: `Your license will expire on ${license.endDate.toDate().toLocaleDateString('he-IL')}`,
                messageHe: `הרישיון שלך יפוג ב-${license.endDate.toDate().toLocaleDateString('he-IL')}`,
                severity: 'warning',
                dismissed: false,
                createdAt: Timestamp.now(),
            });
        }

        // Check for expired licenses and update status
        const expiredLicenses = await db.collection('licenses')
            .where('status', '==', 'active')
            .where('endDate', '<=', Timestamp.now())
            .get();

        for (const doc of expiredLicenses.docs) {
            const license = doc.data();

            // Set to grace period (7 days)
            await doc.ref.update({
                status: 'grace_period',
                gracePeriodEndDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
                updatedAt: Timestamp.now(),
            });

            // Update institution
            if (license.institutionId) {
                await db.collection('institutions').doc(license.institutionId).update({
                    licenseStatus: 'grace_period',
                    updatedAt: Timestamp.now(),
                });
            }

            // Create notification
            await db.collection('usage_notifications').doc().set({
                institutionId: license.institutionId,
                type: 'license_expired',
                message: 'Your license has expired. You have 7 days to renew.',
                messageHe: 'הרישיון שלך פג תוקף. יש לך 7 ימים לחדש.',
                severity: 'error',
                dismissed: false,
                createdAt: Timestamp.now(),
            });
        }

        logger.info(`License check completed. ${expiringLicenses.size} expiring, ${expiredLicenses.size} expired.`);
    } catch (error) {
        logger.error('Error checking licenses:', error);
        throw error;
    }
});

// ============================================================================
// Helper Functions
// ============================================================================

function getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
