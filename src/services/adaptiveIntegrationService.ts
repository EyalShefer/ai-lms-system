/**
 * Adaptive Integration Service
 *
 * Bridges the gap between adaptive events (detailed telemetry) and student profiles (aggregated metrics).
 *
 * This service solves the problem of having scaffolding decisions logged as events
 * but not reflected in the student's profile, by analyzing adaptive events and
 * extracting behavioral patterns.
 *
 * Created: 2026-01-23
 */

import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import type { AdaptiveEvent, AdaptiveEventType } from './adaptiveLoggingService';

/**
 * Scaffolding pattern analysis result
 */
export interface ScaffoldingPatterns {
    // Acceptance behavior
    totalOffered: number;
    totalAccepted: number;
    totalDeclined: number;
    acceptanceRate: number; // 0-1

    // Performance context
    avgMasteryWhenOffered: number; // Average mastery when scaffolding was offered
    avgMasteryWhenAccepted: number;
    avgMasteryWhenDeclined: number;

    // Variant preferences
    הבנהOffered: number;
    הבנהAccepted: number;
    העמקהOffered: number;
    העמקהAccepted: number;

    // Timing
    lastScaffoldingAt?: Date;
    firstScaffoldingAt?: Date;
}

/**
 * Extended profile document for scaffolding patterns
 * Saved to: users/{userId}/profile/scaffolding_patterns
 */
export interface ScaffoldingProfileDoc extends ScaffoldingPatterns {
    userId: string;
    lastUpdated: Date | Timestamp;
    lastAnalyzedEventTimestamp?: Date | Timestamp;
}

/**
 * Fetch adaptive events for a user within a time range
 */
export const getAdaptiveEventsByTimeRange = async (
    userId: string,
    startTime: Date,
    endTime?: Date
): Promise<AdaptiveEvent[]> => {
    try {
        const eventsRef = collection(db, 'users', userId, 'adaptive_events');

        let q = query(
            eventsRef,
            where('timestamp', '>=', Timestamp.fromDate(startTime)),
            orderBy('timestamp', 'asc')
        );

        if (endTime) {
            q = query(q, where('timestamp', '<=', Timestamp.fromDate(endTime)));
        }

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
        })) as AdaptiveEvent[];

    } catch (error) {
        console.error('Error fetching adaptive events:', error);
        return [];
    }
};

/**
 * Fetch recent adaptive events (last N events)
 */
export const getRecentAdaptiveEvents = async (
    userId: string,
    limitCount: number = 100
): Promise<AdaptiveEvent[]> => {
    try {
        const eventsRef = collection(db, 'users', userId, 'adaptive_events');

        const q = query(
            eventsRef,
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
        })) as AdaptiveEvent[];

    } catch (error) {
        console.error('Error fetching recent adaptive events:', error);
        return [];
    }
};

/**
 * Analyze scaffolding patterns from a list of adaptive events
 */
export const analyzeScaffoldingPatterns = (events: AdaptiveEvent[]): ScaffoldingPatterns => {
    const offeredEvents = events.filter(e => e.type === 'scaffolding_offered');
    const acceptedEvents = events.filter(e => e.type === 'scaffolding_accepted');
    const declinedEvents = events.filter(e => e.type === 'scaffolding_declined');

    // Calculate acceptance rate
    const totalOffered = offeredEvents.length;
    const totalAccepted = acceptedEvents.length;
    const totalDeclined = declinedEvents.length;
    const acceptanceRate = totalOffered > 0 ? totalAccepted / totalOffered : 0;

    // Calculate average mastery at different decision points
    const avgMasteryWhenOffered = totalOffered > 0
        ? offeredEvents.reduce((sum, e) => sum + (e.data.mastery || 0), 0) / totalOffered
        : 0;

    const avgMasteryWhenAccepted = totalAccepted > 0
        ? acceptedEvents.reduce((sum, e) => sum + (e.data.mastery || 0), 0) / totalAccepted
        : 0;

    const avgMasteryWhenDeclined = totalDeclined > 0
        ? declinedEvents.reduce((sum, e) => sum + (e.data.mastery || 0), 0) / totalDeclined
        : 0;

    // Count by variant type
    const הבנהOffered = offeredEvents.filter(e => e.data.scaffoldingVariantType === 'הבנה').length;
    const הבנהAccepted = acceptedEvents.filter(e => e.data.scaffoldingVariantType === 'הבנה').length;
    const העמקהOffered = offeredEvents.filter(e => e.data.scaffoldingVariantType === 'העמקה').length;
    const העמקהAccepted = acceptedEvents.filter(e => e.data.scaffoldingVariantType === 'העמקה').length;

    // Find first and last scaffolding timestamps
    const scaffoldingEvents = [...offeredEvents, ...acceptedEvents, ...declinedEvents];
    const timestamps = scaffoldingEvents
        .map(e => e.timestamp instanceof Date ? e.timestamp : new Date())
        .filter(d => d instanceof Date && !isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

    const firstScaffoldingAt = timestamps.length > 0 ? timestamps[0] : undefined;
    const lastScaffoldingAt = timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined;

    return {
        totalOffered,
        totalAccepted,
        totalDeclined,
        acceptanceRate,
        avgMasteryWhenOffered,
        avgMasteryWhenAccepted,
        avgMasteryWhenDeclined,
        הבנהOffered,
        הבנהAccepted,
        העמקהOffered,
        העמקהAccepted,
        firstScaffoldingAt,
        lastScaffoldingAt
    };
};

/**
 * Get existing scaffolding patterns from profile
 *
 * ENHANCED: If no patterns exist yet, performs on-the-fly analysis
 * of recent adaptive events to prevent eventual consistency issues
 */
export const getScaffoldingPatterns = async (userId: string): Promise<ScaffoldingProfileDoc | null> => {
    if (!userId) return null;

    const patternsRef = doc(db, 'users', userId, 'profile', 'scaffolding_patterns');

    try {
        const docSnap = await getDoc(patternsRef);

        if (docSnap.exists()) {
            return docSnap.data() as ScaffoldingProfileDoc;
        }

        // FALLBACK: No patterns saved yet - analyze recent events on-the-fly
        console.log('⚠️ No scaffolding patterns saved yet, analyzing recent events...');

        const recentEvents = await getRecentAdaptiveEvents(userId, 50);
        const scaffoldingEvents = recentEvents.filter(e =>
            e.type === 'scaffolding_offered' ||
            e.type === 'scaffolding_accepted' ||
            e.type === 'scaffolding_declined'
        );

        if (scaffoldingEvents.length === 0) {
            return null; // Truly no scaffolding events yet
        }

        // Analyze and return (without saving - that will happen at session end)
        const patterns = analyzeScaffoldingPatterns(scaffoldingEvents);

        console.log('✅ Generated on-the-fly patterns from', scaffoldingEvents.length, 'events');

        return {
            userId,
            ...patterns,
            lastUpdated: new Date()
        };

    } catch (error) {
        console.error('Error fetching scaffolding patterns:', error);
        return null;
    }
};

/**
 * Update profile with scaffolding patterns
 */
export const updateScaffoldingPatterns = async (
    userId: string,
    patterns: ScaffoldingPatterns
): Promise<void> => {
    if (!userId) return;

    const patternsRef = doc(db, 'users', userId, 'profile', 'scaffolding_patterns');

    try {
        const profileDoc: ScaffoldingProfileDoc = {
            userId,
            ...patterns,
            lastUpdated: new Date()
        };

        await setDoc(patternsRef, profileDoc, { merge: true });

        console.log(`📊 Scaffolding patterns updated for ${userId}:`, {
            acceptanceRate: (patterns.acceptanceRate * 100).toFixed(0) + '%',
            totalOffered: patterns.totalOffered,
            totalAccepted: patterns.totalAccepted
        });

    } catch (error) {
        console.error('Error updating scaffolding patterns:', error);
    }
};

/**
 * Main integration function: Update profile from adaptive events
 *
 * This is called after a session completes to analyze scaffolding behavior
 * and update the student's profile with behavioral patterns.
 *
 * @param userId - The user ID
 * @param sessionStartTime - When the session started (to filter relevant events)
 * @returns The updated scaffolding patterns, or null if failed
 */
export const updateProfileFromAdaptiveEvents = async (
    userId: string,
    sessionStartTime?: Date
): Promise<ScaffoldingPatterns | null> => {
    if (!userId) {
        console.warn('updateProfileFromAdaptiveEvents: Missing userId');
        return null;
    }

    try {
        // If no session start time provided, analyze all recent events (last 100)
        const events = sessionStartTime
            ? await getAdaptiveEventsByTimeRange(userId, sessionStartTime)
            : await getRecentAdaptiveEvents(userId, 100);

        if (events.length === 0) {
            console.log('No adaptive events to analyze');
            return null;
        }

        // Filter for scaffolding-related events
        const scaffoldingEvents = events.filter(e =>
            e.type === 'scaffolding_offered' ||
            e.type === 'scaffolding_accepted' ||
            e.type === 'scaffolding_declined'
        );

        if (scaffoldingEvents.length === 0) {
            console.log('No scaffolding events in this session');
            return null;
        }

        // Get existing patterns
        const existingPatterns = await getScaffoldingPatterns(userId);

        // Analyze new events
        const newPatterns = analyzeScaffoldingPatterns(scaffoldingEvents);

        // If we have existing patterns, merge them with new data
        let finalPatterns: ScaffoldingPatterns;

        if (existingPatterns && sessionStartTime) {
            // Incremental update: add new events to existing patterns
            finalPatterns = {
                totalOffered: existingPatterns.totalOffered + newPatterns.totalOffered,
                totalAccepted: existingPatterns.totalAccepted + newPatterns.totalAccepted,
                totalDeclined: existingPatterns.totalDeclined + newPatterns.totalDeclined,
                acceptanceRate: 0, // Will recalculate below

                // Weighted average for mastery metrics
                avgMasteryWhenOffered: existingPatterns.totalOffered + newPatterns.totalOffered > 0
                    ? (existingPatterns.avgMasteryWhenOffered * existingPatterns.totalOffered +
                       newPatterns.avgMasteryWhenOffered * newPatterns.totalOffered) /
                      (existingPatterns.totalOffered + newPatterns.totalOffered)
                    : 0,

                avgMasteryWhenAccepted: existingPatterns.totalAccepted + newPatterns.totalAccepted > 0
                    ? (existingPatterns.avgMasteryWhenAccepted * existingPatterns.totalAccepted +
                       newPatterns.avgMasteryWhenAccepted * newPatterns.totalAccepted) /
                      (existingPatterns.totalAccepted + newPatterns.totalAccepted)
                    : 0,

                avgMasteryWhenDeclined: existingPatterns.totalDeclined + newPatterns.totalDeclined > 0
                    ? (existingPatterns.avgMasteryWhenDeclined * existingPatterns.totalDeclined +
                       newPatterns.avgMasteryWhenDeclined * newPatterns.totalDeclined) /
                      (existingPatterns.totalDeclined + newPatterns.totalDeclined)
                    : 0,

                הבנהOffered: existingPatterns.הבנהOffered + newPatterns.הבנהOffered,
                הבנהAccepted: existingPatterns.הבנהAccepted + newPatterns.הבנהAccepted,
                העמקהOffered: existingPatterns.העמקהOffered + newPatterns.העמקהOffered,
                העמקהAccepted: existingPatterns.העמקהAccepted + newPatterns.העמקהAccepted,

                firstScaffoldingAt: existingPatterns.firstScaffoldingAt
                    ? (existingPatterns.firstScaffoldingAt instanceof Date
                        ? existingPatterns.firstScaffoldingAt
                        : (existingPatterns.firstScaffoldingAt as Timestamp).toDate())
                    : newPatterns.firstScaffoldingAt,

                lastScaffoldingAt: newPatterns.lastScaffoldingAt || existingPatterns.lastScaffoldingAt
                    ? (existingPatterns.lastScaffoldingAt instanceof Date
                        ? existingPatterns.lastScaffoldingAt
                        : existingPatterns.lastScaffoldingAt
                            ? (existingPatterns.lastScaffoldingAt as Timestamp).toDate()
                            : undefined)
                    : undefined
            };

            // Recalculate acceptance rate
            finalPatterns.acceptanceRate = finalPatterns.totalOffered > 0
                ? finalPatterns.totalAccepted / finalPatterns.totalOffered
                : 0;

        } else {
            // No existing patterns or no session time (analyzing all history)
            finalPatterns = newPatterns;
        }

        // Update profile with patterns
        await updateScaffoldingPatterns(userId, finalPatterns);

        return finalPatterns;

    } catch (error) {
        console.error('Error in updateProfileFromAdaptiveEvents:', error);
        return null;
    }
};

/**
 * Batch update: Re-analyze all users' scaffolding patterns from scratch
 * Useful for backfilling historical data or fixing corrupted patterns
 *
 * NOTE: This should be run as a Cloud Function or admin script, not from client
 */
export const reanalyzeAllScaffoldingPatterns = async (userId: string): Promise<boolean> => {
    try {
        console.log(`🔄 Re-analyzing all scaffolding patterns for user ${userId}...`);

        // Get ALL adaptive events (no time filter)
        const events = await getRecentAdaptiveEvents(userId, 1000); // Last 1000 events

        if (events.length === 0) {
            console.log('No events found for user');
            return false;
        }

        // Filter for scaffolding events
        const scaffoldingEvents = events.filter(e =>
            e.type === 'scaffolding_offered' ||
            e.type === 'scaffolding_accepted' ||
            e.type === 'scaffolding_declined'
        );

        if (scaffoldingEvents.length === 0) {
            console.log('No scaffolding events found');
            return false;
        }

        // Analyze all events from scratch
        const patterns = analyzeScaffoldingPatterns(scaffoldingEvents);

        // Update profile
        await updateScaffoldingPatterns(userId, patterns);

        console.log(`✅ Re-analysis complete. Analyzed ${scaffoldingEvents.length} scaffolding events.`);

        return true;

    } catch (error) {
        console.error('Error in reanalyzeAllScaffoldingPatterns:', error);
        return false;
    }
};
