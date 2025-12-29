import * as admin from 'firebase-admin';

// Interfaces (Duplicated from frontend for independence, or should be in a shared lib)
export interface SessionData {
    userId: string;
    lessonId: string;
    startTime: number;
    endTime: number;
    duration_sec: number;
    interactions: SessionInteraction[];
    summary: {
        total_questions: number;
        correct_answers: number;
        total_hints_used: number;
        avg_response_time_sec: number;
    };
}

export interface SessionInteraction {
    questionId: string;
    type: string;
    isCorrect: boolean;
    attemptCount: number;
    timeSpentSec: number;
    hintsUsed: number;
    timestamp: number;
}

/**
 * Aggregates session data into the student's persistent profile.
 * Call this function from a Cloud Function triggered by lesson completion.
 */
export const updateStudentProfile = async (userId: string, sessionData: SessionData) => {
    const db = admin.firestore();
    const profileRef = db.doc(`users/${userId}/profile/stats`);

    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(profileRef);
        const data = doc.data() || {};

        // 1. Current aggregates
        const currentPerformance = data.performance || {
            average_response_time_sec: 0,
            global_accuracy_rate: 0,
            total_questions_attempted: 0,
            total_correct_answers: 0,
            error_rate_by_topic: {}
        };

        const currentBehavioral = data.behavioral || {
            hint_dependency_score: 0,
            retry_persistence: 0,
            total_hints_taken: 0,
            total_opportunities: 0,
            media_preference: { text: 0, video: 0, gamified: 0 }
        };

        // 2. Calculate New Performance Metrics
        const sessionQuestions = sessionData.summary.total_questions;
        const sessionCorrect = sessionData.summary.correct_answers;
        const sessionHints = sessionData.summary.total_hints_used;
        const sessionAvgTime = sessionData.summary.avg_response_time_sec;

        // Rolling Average Response Time
        const totalPrevQuestions = currentPerformance.total_questions_attempted || 0;
        const newTotalQuestions = totalPrevQuestions + sessionQuestions;

        let newAvgResponseTime = currentPerformance.average_response_time_sec;
        if (newTotalQuestions > 0) {
            newAvgResponseTime = (
                (currentPerformance.average_response_time_sec * totalPrevQuestions) +
                (sessionAvgTime * sessionQuestions)
            ) / newTotalQuestions;
        }

        // Global Accuracy
        const totalPrevCorrect = currentPerformance.total_correct_answers || 0;
        const newTotalCorrect = totalPrevCorrect + sessionCorrect;
        const newAccuracy = newTotalQuestions > 0 ? newTotalCorrect / newTotalQuestions : 0;

        // Error Rate by Topic (Simple increment for now, can be more complex)
        const newErrorRateByTopic = { ...currentPerformance.error_rate_by_topic };
        sessionData.interactions.forEach(interaction => {
            if (!interaction.isCorrect) {
                // Assuming interaction.type as topic proxy or if topic is available
                // If questionId has topic info or we fetch it. For now using type as a broad category or just ID
                // The requirement said "start", "gamified" etc. 
                // Let's use the interaction.type as the key for now.
                const key = interaction.type;
                newErrorRateByTopic[key] = (newErrorRateByTopic[key] || 0) + 1;
            }
        });

        // 3. Behavioral Metrics
        // Hint Dependency: Hints per question
        const totalHintsTaken = (currentBehavioral.total_hints_taken || 0) + sessionHints;
        const newHintDependency = newTotalQuestions > 0 ? totalHintsTaken / newTotalQuestions : 0;

        // Retry Persistence (Simplification: did they submit > 1 attempt on failures?)
        // This requires detailed interaction analysis. 
        // Let's count how many interactions had attemptCount > 1
        const retriedCount = sessionData.interactions.filter(i => i.attemptCount > 1).length;
        // We update a rolling score or counter.
        // Let's update media preference based on performance in those types.

        const newMediaPreference = { ...(currentBehavioral.media_preference || { text: 0, video: 0, gamified: 0 }) };

        // Update media preference based on accuracy in types
        const textTypes = ['text', 'pdf', 'open-question'];
        const videoTypes = ['video', 'podcast'];
        const gamifiedTypes = ['memory_game', 'ordering', 'categorization', 'interactive-chat'];

        const updateScore = (types: string[], interactions: SessionInteraction[], key: string) => {
            const relevant = interactions.filter(i => types.includes(i.type));
            if (relevant.length > 0) {
                const correct = relevant.filter(i => i.isCorrect).length;
                const accuracy = correct / relevant.length;
                // Weighted update or simple addition of accuracy points
                newMediaPreference[key] = (newMediaPreference[key] || 0) + accuracy;
            }
        };

        updateScore(textTypes, sessionData.interactions, 'text');
        updateScore(videoTypes, sessionData.interactions, 'video');
        updateScore(gamifiedTypes, sessionData.interactions, 'gamified');

        // 4. Engagement
        const incrementTime = sessionData.duration_sec;

        // Prepare Update Object
        transaction.set(profileRef, {
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            performance: {
                average_response_time_sec: newAvgResponseTime,
                global_accuracy_rate: newAccuracy,
                error_rate_by_topic: newErrorRateByTopic,
                total_questions_attempted: newTotalQuestions,
                total_correct_answers: newTotalCorrect
            },
            behavioral: {
                hint_dependency_score: newHintDependency,
                total_hints_taken: totalHintsTaken, // Helper field
                retry_persistence: currentBehavioral.retry_persistence, // Placeholder for more complex logic
                media_preference: newMediaPreference
            },
            engagement: {
                total_learning_time_sec: admin.firestore.FieldValue.increment(incrementTime),
                completed_lessons_count: admin.firestore.FieldValue.increment(1),
                last_active_at: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
    });

    console.log(`Updated profile for ${userId}`);
};
