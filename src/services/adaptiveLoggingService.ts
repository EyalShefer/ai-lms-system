/**
 * Adaptive Logging Service
 *
 * Logs all adaptive learning events to Firestore for analysis.
 * Helps understand what the adaptive system is actually doing.
 */

import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc, increment, getDoc } from 'firebase/firestore';

export type AdaptiveEventType =
    | 'variant_selected'      // When הבנה/העמקה variant is chosen (Understanding/Deepening)
    | 'bkt_update'           // When BKT calculates new mastery
    | 'העמקה_mode'           // When העמקה mode is activated (skip easy content for advanced)
    | 'mastery_skip'         // When topic is mastered and skipped
    | 'הבנה_injected'        // When הבנה (remedial) block is generated and inserted
    | 'session_start'        // When student starts a lesson
    | 'session_complete'     // When student completes a lesson
    | 'scaffolding_offered'  // When scaffolding variant is offered after 3 failures (struggling student)
    | 'scaffolding_accepted' // When student accepts scaffolding variant
    | 'scaffolding_declined' // When student declines scaffolding variant
    | 'enrichment_offered'   // When enrichment variant is offered to high-performing student
    | 'enrichment_accepted'  // When student accepts enrichment challenge
    | 'enrichment_declined'; // When student declines enrichment challenge

export interface AdaptiveEvent {
    type: AdaptiveEventType;
    userId: string;
    courseId?: string;
    lessonId?: string;
    blockId?: string;
    timestamp?: any;

    // Event-specific data
    data: {
        // For variant_selected (Hebrew: הבנה=Understanding, יישום=Application, העמקה=Deepening)
        variantType?: 'הבנה' | 'יישום' | 'העמקה';
        mastery?: number;
        accuracy?: number;

        // For bkt_update
        previousMastery?: number;
        newMastery?: number;
        action?: string; // continue/challenge/remediate/mastered
        isCorrect?: boolean;

        // For העמקה_mode / mastery_skip
        skippedBlocks?: number;
        targetTopicId?: string;

        // For הבנה_injected
        הבנהBlockId?: string;
        wrongAnswer?: any;

        // For scaffolding events
        scaffoldingVariantType?: 'הבנה' | 'העמקה';
        attempts?: number;

        // General
        blockType?: string;
        topicId?: string;
    };
}

/**
 * Log an adaptive event to Firestore
 * Saved to: users/{userId}/adaptive_events/{auto-id}
 */
export const logAdaptiveEvent = async (event: AdaptiveEvent): Promise<void> => {
    try {
        const eventsRef = collection(db, 'users', event.userId, 'adaptive_events');
        await addDoc(eventsRef, {
            ...event,
            timestamp: serverTimestamp()
        });

        // Also update aggregated stats
        await updateAdaptiveStats(event.userId, event.type);

        // Console log for immediate visibility (dev)
        console.log(`📊 [Adaptive Log] ${event.type}:`, event.data);

    } catch (error) {
        console.error('Failed to log adaptive event:', error);
        // Don't throw - logging should not break the app
    }
};

/**
 * Update aggregated adaptive stats for quick dashboard access
 * Saved to: users/{userId}/profile/adaptive_stats
 */
const updateAdaptiveStats = async (userId: string, eventType: AdaptiveEventType): Promise<void> => {
    const statsRef = doc(db, 'users', userId, 'profile', 'adaptive_stats');

    const updateData: Record<string, any> = {
        lastUpdated: serverTimestamp(),
        [`counts.${eventType}`]: increment(1),
        'counts.total': increment(1)
    };

    await setDoc(statsRef, updateData, { merge: true });
};

/**
 * Get adaptive stats summary for a student
 */
export const getAdaptiveStats = async (userId: string): Promise<{
    counts: Record<AdaptiveEventType, number>;
    lastUpdated: Date | null;
} | null> => {
    try {
        const statsRef = doc(db, 'users', userId, 'profile', 'adaptive_stats');
        const snap = await getDoc(statsRef);

        if (!snap.exists()) return null;

        const data = snap.data();
        return {
            counts: data.counts || {},
            lastUpdated: data.lastUpdated?.toDate() || null
        };
    } catch (error) {
        console.error('Failed to get adaptive stats:', error);
        return null;
    }
};

/**
 * Helper: Log variant selection event
 * Hebrew variants: הבנה (Understanding), יישום (Application), העמקה (Deepening)
 */
export const logVariantSelected = (
    userId: string,
    courseId: string,
    blockId: string,
    variantType: 'הבנה' | 'יישום' | 'העמקה',
    mastery: number,
    accuracy: number
): void => {
    logAdaptiveEvent({
        type: 'variant_selected',
        userId,
        courseId,
        blockId,
        data: {
            variantType,
            mastery,
            accuracy
        }
    });
};

/**
 * Helper: Log BKT update event
 */
export const logBktUpdate = (
    userId: string,
    courseId: string,
    blockId: string,
    previousMastery: number,
    newMastery: number,
    action: string,
    isCorrect: boolean,
    topicId?: string
): void => {
    logAdaptiveEvent({
        type: 'bkt_update',
        userId,
        courseId,
        blockId,
        data: {
            previousMastery,
            newMastery,
            action,
            isCorrect,
            topicId
        }
    });
};

/**
 * Helper: Log challenge mode activation
 */
export const logChallengeMode = (
    userId: string,
    courseId: string,
    skippedBlocks: number
): void => {
    logAdaptiveEvent({
        type: 'challenge_mode',
        userId,
        courseId,
        data: {
            skippedBlocks
        }
    });
};

/**
 * Helper: Log mastery skip event
 */
export const logMasterySkip = (
    userId: string,
    courseId: string,
    topicId: string,
    mastery: number
): void => {
    logAdaptiveEvent({
        type: 'mastery_skip',
        userId,
        courseId,
        data: {
            topicId,
            mastery
        }
    });
};

/**
 * Helper: Log remediation injection event
 */
export const logRemediationInjected = (
    userId: string,
    courseId: string,
    originalBlockId: string,
    remediationBlockId: string,
    wrongAnswer: any
): void => {
    logAdaptiveEvent({
        type: 'remediation_injected',
        userId,
        courseId,
        blockId: originalBlockId,
        data: {
            remediationBlockId,
            wrongAnswer
        }
    });
};

/**
 * Helper: Log scaffolding offer event
 */
export const logScaffoldingOffered = (
    userId: string,
    courseId: string,
    blockId: string,
    variantType: 'הבנה' | 'העמקה',
    mastery: number,
    attempts: number
): void => {
    logAdaptiveEvent({
        type: 'scaffolding_offered',
        userId,
        courseId,
        blockId,
        data: {
            scaffoldingVariantType: variantType,
            mastery,
            attempts
        }
    });
};

/**
 * Helper: Log scaffolding acceptance event
 */
export const logScaffoldingAccepted = (
    userId: string,
    courseId: string,
    originalBlockId: string,
    variantBlockId: string,
    variantType: 'הבנה' | 'העמקה',
    mastery: number
): void => {
    logAdaptiveEvent({
        type: 'scaffolding_accepted',
        userId,
        courseId,
        blockId: originalBlockId,
        data: {
            scaffoldingVariantType: variantType,
            הבנהBlockId: variantBlockId,
            mastery
        }
    });
};

/**
 * Helper: Log scaffolding decline event
 */
export const logScaffoldingDeclined = (
    userId: string,
    courseId: string,
    blockId: string,
    variantType: 'הבנה' | 'העמקה',
    mastery: number
): void => {
    logAdaptiveEvent({
        type: 'scaffolding_declined',
        userId,
        courseId,
        blockId,
        data: {
            scaffoldingVariantType: variantType,
            mastery
        }
    });
};

/**
 * Helper: Log enrichment offer event (for high-performing students)
 */
export const logEnrichmentOffered = (
    userId: string,
    courseId: string,
    blockId: string,
    variantType: 'העמקה',
    mastery: number
): void => {
    logAdaptiveEvent({
        type: 'enrichment_offered',
        userId,
        courseId,
        blockId,
        data: {
            scaffoldingVariantType: variantType,
            mastery
        }
    });
};

/**
 * Helper: Log enrichment acceptance event
 */
export const logEnrichmentAccepted = (
    userId: string,
    courseId: string,
    originalBlockId: string,
    variantBlockId: string,
    variantType: 'העמקה',
    mastery: number
): void => {
    logAdaptiveEvent({
        type: 'enrichment_accepted',
        userId,
        courseId,
        blockId: originalBlockId,
        data: {
            scaffoldingVariantType: variantType,
            הבנהBlockId: variantBlockId, // Reusing field for enrichment block ID
            mastery
        }
    });
};

/**
 * Helper: Log enrichment decline event
 */
export const logEnrichmentDeclined = (
    userId: string,
    courseId: string,
    blockId: string,
    variantType: 'העמקה',
    mastery: number
): void => {
    logAdaptiveEvent({
        type: 'enrichment_declined',
        userId,
        courseId,
        blockId,
        data: {
            scaffoldingVariantType: variantType,
            mastery
        }
    });
};
