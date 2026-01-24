/**
 * ProfileService - Student Learning Profile Persistence
 *
 * This service aggregates session telemetry into a persistent student profile,
 * enabling adaptive learning decisions based on historical performance.
 *
 * Key Features:
 * - Rolling averages for performance metrics
 * - Hint dependency tracking (behavioral pattern)
 * - Topic-specific error tracking
 * - Error fingerprint for misconception analysis
 */

import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment, Timestamp } from "firebase/firestore";
import type { StudentProfile, SessionData, SessionInteraction } from "../types/studentProfile";

const USERS_COLLECTION = "users";
const PROFILE_SUBCOLLECTION = "profile";
const STATS_DOC = "stats";
const SESSIONS_SUBCOLLECTION = "sessions";

/**
 * Default profile for new students
 */
export const DEFAULT_STUDENT_PROFILE: Omit<StudentProfile, 'userId' | 'lastUpdated'> = {
    performance: {
        average_response_time_sec: 0,
        global_accuracy_rate: 0,
        error_rate_by_topic: {},
        total_questions_attempted: 0,
        total_correct_answers: 0
    },
    behavioral: {
        hint_dependency_score: 0,
        retry_persistence: 0,
        media_preference: {
            text: 0,
            video: 0,
            gamified: 0
        }
    },
    engagement: {
        total_learning_time_sec: 0,
        completed_lessons_count: 0,
        last_active_at: new Date()
    }
};

/**
 * Error Fingerprint - tracks patterns in student mistakes
 */
export interface ErrorFingerprint {
    errorTags: Record<string, number>; // e.g., { "calculation_error": 5, "sign_error": 2 }
    lastUpdated: Timestamp | Date;
}

/**
 * Proficiency Vector - mastery level per topic
 */
export interface ProficiencyVector {
    topics: Record<string, number>; // e.g., { "fractions": 0.75, "addition": 0.95 }
    lastUpdated: Timestamp | Date;
}

/**
 * Fetches the student profile from Firestore
 */
export const getStudentProfile = async (userId: string): Promise<StudentProfile | null> => {
    if (!userId) return null;

    const profileRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, STATS_DOC);

    try {
        const docSnap = await getDoc(profileRef);

        if (docSnap.exists()) {
            return {
                userId,
                ...DEFAULT_STUDENT_PROFILE,
                ...docSnap.data()
            } as StudentProfile;
        }

        return null;
    } catch (error) {
        console.error("Error fetching student profile:", error);
        return null;
    }
};

/**
 * Calculates rolling average for response time
 * Uses exponential moving average for smooth updates
 */
const calculateRollingAverage = (
    currentAvg: number,
    newValue: number,
    totalCount: number,
    alpha: number = 0.1 // Smoothing factor
): number => {
    if (totalCount <= 1) return newValue;
    // Exponential moving average: EMA = alpha * newValue + (1 - alpha) * oldEMA
    return alpha * newValue + (1 - alpha) * currentAvg;
};

/**
 * Calculates hint dependency score from session data
 * Score = average hints per question, normalized to 0-1
 */
const calculateHintDependency = (
    currentScore: number,
    sessionHints: number,
    sessionQuestions: number,
    totalQuestions: number
): number => {
    if (sessionQuestions === 0) return currentScore;

    // Average hints per question in this session (max 3 hints typically)
    const sessionHintRate = Math.min(sessionHints / sessionQuestions / 3, 1);

    // Weighted average with historical data
    if (totalQuestions <= sessionQuestions) {
        return sessionHintRate;
    }

    const historyWeight = (totalQuestions - sessionQuestions) / totalQuestions;
    return historyWeight * currentScore + (1 - historyWeight) * sessionHintRate;
};

/**
 * Calculates retry persistence score
 * Score = ratio of retries after failures, normalized to 0-1
 */
const calculateRetryPersistence = (interactions: SessionInteraction[]): number => {
    const failures = interactions.filter(i => !i.isCorrect && i.attemptCount === 1);
    const retriedAfterFailure = interactions.filter(i => i.attemptCount > 1);

    if (failures.length === 0) return 1; // No failures = perfect persistence (default high)

    return Math.min(retriedAfterFailure.length / Math.max(failures.length, 1), 1);
};

/**
 * Updates media preference based on interaction types
 */
const updateMediaPreference = (
    currentPref: { text: number; video: number; gamified: number },
    interactions: SessionInteraction[]
): { text: number; video: number; gamified: number } => {
    const counts = { text: 0, video: 0, gamified: 0 };

    interactions.forEach(i => {
        if (['text', 'pdf', 'open-question'].includes(i.type)) {
            counts.text++;
        } else if (['video', 'podcast'].includes(i.type)) {
            counts.video++;
        } else if (['memory_game', 'interactive-chat', 'categorization', 'ordering'].includes(i.type)) {
            counts.gamified++;
        }
    });

    const total = counts.text + counts.video + counts.gamified;
    if (total === 0) return currentPref;

    // Blend with existing preferences (70% history, 30% new session)
    return {
        text: 0.7 * currentPref.text + 0.3 * (counts.text / total),
        video: 0.7 * currentPref.video + 0.3 * (counts.video / total),
        gamified: 0.7 * currentPref.gamified + 0.3 * (counts.gamified / total)
    };
};

/**
 * Main function: Updates student profile with session data
 * Called at the end of each learning session
 */
export const updateStudentProfile = async (
    userId: string,
    sessionData: SessionData,
    topicId?: string
): Promise<StudentProfile | null> => {
    if (!userId || !sessionData) {
        console.warn("updateStudentProfile: Missing userId or sessionData");
        return null;
    }

    const profileRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, STATS_DOC);

    try {
        // 1. Fetch existing profile or create default
        const docSnap = await getDoc(profileRef);
        let profile: StudentProfile;

        if (docSnap.exists()) {
            profile = {
                userId,
                ...DEFAULT_STUDENT_PROFILE,
                ...docSnap.data()
            } as StudentProfile;
        } else {
            profile = {
                userId,
                lastUpdated: new Date(),
                ...DEFAULT_STUDENT_PROFILE
            };
        }

        // 2. Calculate new performance metrics
        const { summary, interactions, duration_sec } = sessionData;
        const newTotalQuestions = profile.performance.total_questions_attempted + summary.total_questions;
        const newTotalCorrect = profile.performance.total_correct_answers + summary.correct_answers;

        // Global accuracy rate
        const newAccuracyRate = newTotalQuestions > 0
            ? newTotalCorrect / newTotalQuestions
            : 0;

        // Rolling average response time
        const newAvgResponseTime = calculateRollingAverage(
            profile.performance.average_response_time_sec,
            summary.avg_response_time_sec,
            newTotalQuestions
        );

        // Error rate by topic
        const errorRateByTopic = { ...profile.performance.error_rate_by_topic };
        if (topicId) {
            const sessionErrors = summary.total_questions - summary.correct_answers;
            errorRateByTopic[topicId] = (errorRateByTopic[topicId] || 0) + sessionErrors;
        }

        // 3. Calculate behavioral metrics
        const newHintDependency = calculateHintDependency(
            profile.behavioral.hint_dependency_score,
            summary.total_hints_used,
            summary.total_questions,
            newTotalQuestions
        );

        const newRetryPersistence = calculateRetryPersistence(interactions);
        // Blend with history (80% history, 20% new)
        const blendedRetryPersistence = 0.8 * profile.behavioral.retry_persistence + 0.2 * newRetryPersistence;

        const newMediaPreference = updateMediaPreference(
            profile.behavioral.media_preference,
            interactions
        );

        // 4. Update engagement metrics
        const newTotalLearningTime = profile.engagement.total_learning_time_sec + duration_sec;
        const newCompletedLessons = profile.engagement.completed_lessons_count + 1;

        // 5. Build updated profile
        const updatedProfile: StudentProfile = {
            userId,
            lastUpdated: new Date(),
            performance: {
                average_response_time_sec: Math.round(newAvgResponseTime * 100) / 100,
                global_accuracy_rate: Math.round(newAccuracyRate * 1000) / 1000,
                error_rate_by_topic: errorRateByTopic,
                total_questions_attempted: newTotalQuestions,
                total_correct_answers: newTotalCorrect
            },
            behavioral: {
                hint_dependency_score: Math.round(newHintDependency * 1000) / 1000,
                retry_persistence: Math.round(blendedRetryPersistence * 1000) / 1000,
                media_preference: {
                    text: Math.round(newMediaPreference.text * 1000) / 1000,
                    video: Math.round(newMediaPreference.video * 1000) / 1000,
                    gamified: Math.round(newMediaPreference.gamified * 1000) / 1000
                }
            },
            engagement: {
                total_learning_time_sec: Math.round(newTotalLearningTime),
                completed_lessons_count: newCompletedLessons,
                last_active_at: new Date()
            }
        };

        // 6. Save to Firestore
        await setDoc(profileRef, updatedProfile, { merge: true });

        console.log(`Profile updated for user ${userId}:`, {
            accuracy: updatedProfile.performance.global_accuracy_rate,
            hintDependency: updatedProfile.behavioral.hint_dependency_score,
            totalQuestions: updatedProfile.performance.total_questions_attempted
        });

        return updatedProfile;

    } catch (error) {
        console.error("Error updating student profile:", error);
        return null;
    }
};

/**
 * Saves the raw session data for historical analysis
 */
export const saveSessionData = async (
    userId: string,
    sessionData: SessionData
): Promise<boolean> => {
    if (!userId || !sessionData) return false;

    const sessionRef = doc(
        db,
        USERS_COLLECTION,
        userId,
        SESSIONS_SUBCOLLECTION,
        `${sessionData.lessonId}_${sessionData.startTime}`
    );

    try {
        await setDoc(sessionRef, {
            ...sessionData,
            savedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error saving session data:", error);
        return false;
    }
};

/**
 * Updates Error Fingerprint with new error tags
 * Called when student makes mistakes to track patterns
 */
export const updateErrorFingerprint = async (
    userId: string,
    errorTags: string[]
): Promise<void> => {
    if (!userId || !errorTags.length) return;

    const fingerprintRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, 'error_fingerprint');

    try {
        const docSnap = await getDoc(fingerprintRef);
        let fingerprint: ErrorFingerprint;

        if (docSnap.exists()) {
            fingerprint = docSnap.data() as ErrorFingerprint;
        } else {
            fingerprint = {
                errorTags: {},
                lastUpdated: new Date()
            };
        }

        // Increment counts for each error tag
        errorTags.forEach(tag => {
            fingerprint.errorTags[tag] = (fingerprint.errorTags[tag] || 0) + 1;
        });
        fingerprint.lastUpdated = new Date();

        await setDoc(fingerprintRef, fingerprint);

        console.log(`Error fingerprint updated for ${userId}:`, fingerprint.errorTags);

    } catch (error) {
        console.error("Error updating error fingerprint:", error);
    }
};

/**
 * Gets the student's Error Fingerprint
 */
export const getErrorFingerprint = async (userId: string): Promise<ErrorFingerprint | null> => {
    if (!userId) return null;

    const fingerprintRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, 'error_fingerprint');

    try {
        const docSnap = await getDoc(fingerprintRef);
        return docSnap.exists() ? docSnap.data() as ErrorFingerprint : null;
    } catch (error) {
        console.error("Error fetching error fingerprint:", error);
        return null;
    }
};

/**
 * Updates Proficiency Vector for a specific topic
 * Called after BKT calculates new mastery level
 */
export const updateProficiencyVector = async (
    userId: string,
    topicId: string,
    masteryLevel: number
): Promise<void> => {
    if (!userId || !topicId) return;

    const vectorRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, 'proficiency_vector');

    try {
        const docSnap = await getDoc(vectorRef);
        let vector: ProficiencyVector;

        if (docSnap.exists()) {
            vector = docSnap.data() as ProficiencyVector;
        } else {
            vector = {
                topics: {},
                lastUpdated: new Date()
            };
        }

        // Update the specific topic mastery
        vector.topics[topicId] = Math.round(masteryLevel * 1000) / 1000;
        vector.lastUpdated = new Date();

        await setDoc(vectorRef, vector);

        console.log(`Proficiency vector updated for ${userId}: ${topicId} = ${masteryLevel}`);

    } catch (error) {
        console.error("Error updating proficiency vector:", error);
    }
};

/**
 * Gets the student's Proficiency Vector
 */
export const getProficiencyVector = async (userId: string): Promise<ProficiencyVector | null> => {
    if (!userId) return null;

    const vectorRef = doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, 'proficiency_vector');

    try {
        const docSnap = await getDoc(vectorRef);
        return docSnap.exists() ? docSnap.data() as ProficiencyVector : null;
    } catch (error) {
        console.error("Error fetching proficiency vector:", error);
        return null;
    }
};

/**
 * Comprehensive function: End of session handler
 * Updates profile, saves session, and returns updated data
 */
export const onSessionComplete = async (
    userId: string,
    sessionData: SessionData,
    topicId?: string,
    errorTags?: string[]
): Promise<{
    profile: StudentProfile | null;
    sessionSaved: boolean;
}> => {
    // Run updates in parallel for performance
    const [profile, sessionSaved] = await Promise.all([
        updateStudentProfile(userId, sessionData, topicId),
        saveSessionData(userId, sessionData)
    ]);

    // AUTO-COLLECT ERROR TAGS from interactions (if not provided manually)
    let collectedErrorTags = errorTags || [];

    if (!errorTags || errorTags.length === 0) {
        // Extract error tags from incorrect interactions
        const autoCollectedTags: string[] = [];

        sessionData.interactions.forEach(interaction => {
            if (!interaction.isCorrect && interaction.errorTags) {
                autoCollectedTags.push(...interaction.errorTags);
            }
        });

        if (autoCollectedTags.length > 0) {
            console.log(`📊 Auto-collected ${autoCollectedTags.length} error tags from session`);
            collectedErrorTags = autoCollectedTags;
        }
    }

    // Update error fingerprint with collected tags
    if (collectedErrorTags.length > 0) {
        await updateErrorFingerprint(userId, collectedErrorTags);
    }

    // --- INTEGRATION LAYER: Update scaffolding patterns from adaptive events ---
    // This bridges the gap between detailed adaptive events and aggregated profile
    // Import is lazy to avoid circular dependencies
    try {
        const { updateProfileFromAdaptiveEvents } = await import('./adaptiveIntegrationService');
        const sessionStartDate = new Date(sessionData.startTime);

        await updateProfileFromAdaptiveEvents(userId, sessionStartDate);
        console.log('✅ Scaffolding patterns updated from adaptive events');
    } catch (error) {
        console.error('Failed to update scaffolding patterns:', error);
        // Don't throw - this is supplementary data
    }

    return { profile, sessionSaved };
};
