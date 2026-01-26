/**
 * IRT (Item Response Theory) Calibration Service
 *
 * Calculates question difficulty and discrimination parameters from student response data.
 * Uses a simplified 2-Parameter Logistic (2PL) model.
 *
 * Runs as a scheduled Cloud Function (daily) to update question statistics.
 */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const db = getFirestore();

/**
 * IRT submission log entry (from irt_submission_logs collection)
 */
interface IRTSubmissionLog {
    questionId: string;
    variantId: string;
    variantType: 'יישום' | 'הבנה' | 'העמקה';
    isCorrect: boolean;
    responseTimeMs: number | null;
    studentMasteryAtSubmission: number;
    difficulty: number;
    topic: string;
    timestamp: Timestamp;
}

/**
 * Aggregated statistics for a question/variant
 */
interface QuestionStats {
    totalResponses: number;
    correctResponses: number;
    avgResponseTimeMs: number;

    // By mastery bucket (for IRT calculation)
    byMasteryBucket: {
        low: { total: number; correct: number };      // mastery < 0.3
        medium: { total: number; correct: number };   // 0.3 <= mastery < 0.7
        high: { total: number; correct: number };     // mastery >= 0.7
    };
}

/**
 * IRT calibration result
 */
interface IRTCalibrationResult {
    irtDifficulty: number;      // theta scale, typically -3 to +3
    discrimination: number;      // a parameter, typically 0.5 to 2.5
    guessingParam: number;       // c parameter, typically 0.1 to 0.3
    calibrationN: number;        // number of responses used
    lastCalibrated: Date;
    difficultyCI: {
        lower: number;
        upper: number;
    };
}

/**
 * Aggregate submission logs into question statistics
 */
export const aggregateQuestionStats = async (
    questionId: string,
    variantType: string = 'יישום'
): Promise<QuestionStats | null> => {
    const logsRef = db.collection('irt_submission_logs');

    // Query logs for this question/variant
    const query = logsRef
        .where('questionId', '==', questionId)
        .where('variantType', '==', variantType)
        .orderBy('timestamp', 'desc')
        .limit(1000); // Use last 1000 responses

    const snapshot = await query.get();

    if (snapshot.empty) {
        return null;
    }

    const stats: QuestionStats = {
        totalResponses: 0,
        correctResponses: 0,
        avgResponseTimeMs: 0,
        byMasteryBucket: {
            low: { total: 0, correct: 0 },
            medium: { total: 0, correct: 0 },
            high: { total: 0, correct: 0 },
        },
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    snapshot.docs.forEach(doc => {
        const log = doc.data() as IRTSubmissionLog;

        stats.totalResponses++;
        if (log.isCorrect) {
            stats.correctResponses++;
        }

        if (log.responseTimeMs) {
            totalResponseTime += log.responseTimeMs;
            responseTimeCount++;
        }

        // Categorize by mastery bucket
        const mastery = log.studentMasteryAtSubmission;
        if (mastery < 0.3) {
            stats.byMasteryBucket.low.total++;
            if (log.isCorrect) stats.byMasteryBucket.low.correct++;
        } else if (mastery < 0.7) {
            stats.byMasteryBucket.medium.total++;
            if (log.isCorrect) stats.byMasteryBucket.medium.correct++;
        } else {
            stats.byMasteryBucket.high.total++;
            if (log.isCorrect) stats.byMasteryBucket.high.correct++;
        }
    });

    stats.avgResponseTimeMs = responseTimeCount > 0
        ? Math.round(totalResponseTime / responseTimeCount)
        : 0;

    return stats;
};

/**
 * Calculate IRT parameters from question statistics
 *
 * Uses simplified 2PL model estimation:
 * - Difficulty (b): Based on overall correct rate, mapped to theta scale
 * - Discrimination (a): Based on difference in performance between mastery levels
 * - Guessing (c): Estimated from low-mastery correct rate
 */
export const calculateIRTParameters = (stats: QuestionStats): IRTCalibrationResult => {
    const overallCorrectRate = stats.totalResponses > 0
        ? stats.correctResponses / stats.totalResponses
        : 0.5;

    // Calculate correct rates per bucket
    const lowCorrectRate = stats.byMasteryBucket.low.total > 0
        ? stats.byMasteryBucket.low.correct / stats.byMasteryBucket.low.total
        : 0.25;
    const mediumCorrectRate = stats.byMasteryBucket.medium.total > 0
        ? stats.byMasteryBucket.medium.correct / stats.byMasteryBucket.medium.total
        : 0.5;
    const highCorrectRate = stats.byMasteryBucket.high.total > 0
        ? stats.byMasteryBucket.high.correct / stats.byMasteryBucket.high.total
        : 0.75;

    // Difficulty (b parameter)
    // Map overall correct rate to theta scale (-3 to +3)
    // Higher correct rate = easier question = lower difficulty
    // Using logit transformation
    const clampedRate = Math.max(0.05, Math.min(0.95, overallCorrectRate));
    const irtDifficulty = -Math.log(clampedRate / (1 - clampedRate)) / 1.7;

    // Discrimination (a parameter)
    // Higher difference between low and high mastery = better discrimination
    const masteryDifference = highCorrectRate - lowCorrectRate;
    // Map to typical a parameter range (0.5 to 2.5)
    const discrimination = Math.max(0.5, Math.min(2.5, 0.5 + masteryDifference * 2));

    // Guessing parameter (c)
    // Estimate from low-mastery correct rate
    // For MC with 4 options, theoretical minimum is 0.25
    const guessingParam = Math.max(0.1, Math.min(0.35, lowCorrectRate * 0.8));

    // Confidence interval (simplified, based on sample size)
    const se = Math.sqrt((overallCorrectRate * (1 - overallCorrectRate)) / stats.totalResponses);
    const ciWidth = 1.96 * se * 3; // Map to theta scale

    return {
        irtDifficulty: Math.round(irtDifficulty * 1000) / 1000,
        discrimination: Math.round(discrimination * 1000) / 1000,
        guessingParam: Math.round(guessingParam * 1000) / 1000,
        calibrationN: stats.totalResponses,
        lastCalibrated: new Date(),
        difficultyCI: {
            lower: Math.round((irtDifficulty - ciWidth) * 1000) / 1000,
            upper: Math.round((irtDifficulty + ciWidth) * 1000) / 1000,
        },
    };
};

/**
 * Run IRT calibration for all questions with sufficient data
 * Called by scheduled Cloud Function
 */
export const runIRTCalibration = async (
    minResponses: number = 30
): Promise<{
    calibrated: number;
    skipped: number;
    errors: number;
}> => {
    const results = { calibrated: 0, skipped: 0, errors: 0 };

    try {
        // Get all unique question IDs from submission logs
        const logsRef = db.collection('irt_submission_logs');

        // Group by questionId + variantType
        // Note: Firestore doesn't support GROUP BY, so we need to aggregate differently
        // We'll use a separate tracking collection

        const trackingRef = db.collection('irt_calibration_tracking');
        const trackingSnapshot = await trackingRef.get();

        // Build set of known questions
        const questionsToCalibrate = new Map<string, string[]>(); // questionId -> variantTypes[]

        // Get questions that have been answered recently
        const recentLogs = await logsRef
            .orderBy('timestamp', 'desc')
            .limit(5000)
            .get();

        recentLogs.docs.forEach(doc => {
            const log = doc.data() as IRTSubmissionLog;
            const key = log.questionId;
            const variantType = log.variantType;

            if (!questionsToCalibrate.has(key)) {
                questionsToCalibrate.set(key, []);
            }
            const variants = questionsToCalibrate.get(key)!;
            if (!variants.includes(variantType)) {
                variants.push(variantType);
            }
        });

        logger.info(`Found ${questionsToCalibrate.size} unique questions to potentially calibrate`);

        // Calibrate each question/variant combination
        const questionIds = Array.from(questionsToCalibrate.keys());
        for (const questionId of questionIds) {
            const variantTypes = questionsToCalibrate.get(questionId) || [];
            for (const variantType of variantTypes) {
                try {
                    const stats = await aggregateQuestionStats(questionId, variantType);

                    if (!stats || stats.totalResponses < minResponses) {
                        results.skipped++;
                        continue;
                    }

                    const irtResult = calculateIRTParameters(stats);

                    // Save to question_calibration collection
                    const calibrationRef = db.collection('question_calibration')
                        .doc(`${questionId}_${variantType}`);

                    await calibrationRef.set({
                        questionId,
                        variantType,
                        ...irtResult,
                        stats: {
                            totalResponses: stats.totalResponses,
                            correctResponses: stats.correctResponses,
                            avgResponseTimeMs: stats.avgResponseTimeMs,
                            overallCorrectRate: stats.correctResponses / stats.totalResponses,
                        },
                        updatedAt: FieldValue.serverTimestamp(),
                    });

                    // Also update variants_cache if exists
                    const cacheRef = db.collection('variants_cache')
                        .doc(`${questionId}_${variantType}`);
                    const cacheDoc = await cacheRef.get();

                    if (cacheDoc.exists) {
                        await cacheRef.update({
                            'irt_data': irtResult,
                        });
                    }

                    results.calibrated++;

                    logger.info(`Calibrated ${questionId}/${variantType}: difficulty=${irtResult.irtDifficulty}, discrimination=${irtResult.discrimination}, n=${irtResult.calibrationN}`);

                } catch (error) {
                    logger.error(`Error calibrating ${questionId}/${variantType}:`, error);
                    results.errors++;
                }
            }
        }

        logger.info(`IRT Calibration complete: ${results.calibrated} calibrated, ${results.skipped} skipped, ${results.errors} errors`);

        return results;

    } catch (error) {
        logger.error('IRT Calibration failed:', error);
        throw error;
    }
};

/**
 * Get IRT parameters for a question
 * Falls back to AI estimate if not calibrated
 */
export const getIRTDifficulty = async (
    questionId: string,
    variantType: string = 'יישום',
    fallbackDifficulty: number = 0.5
): Promise<number> => {
    try {
        const calibrationRef = db.collection('question_calibration')
            .doc(`${questionId}_${variantType}`);
        const calibrationDoc = await calibrationRef.get();

        if (calibrationDoc.exists) {
            const data = calibrationDoc.data();
            // Convert IRT difficulty (theta scale) to 0-1 scale
            // irtDifficulty of 0 = 0.5 difficulty
            // irtDifficulty of -3 = ~0.05 difficulty (very easy)
            // irtDifficulty of +3 = ~0.95 difficulty (very hard)
            const irtDiff = data?.irtDifficulty || 0;
            return 1 / (1 + Math.exp(-irtDiff * 1.7));
        }

        return fallbackDifficulty;

    } catch (error) {
        logger.error('Error getting IRT difficulty:', error);
        return fallbackDifficulty;
    }
};

/**
 * Cleanup old IRT submission logs
 * Keeps last 90 days of data
 */
export const cleanupOldIRTLogs = async (daysToKeep: number = 90): Promise<number> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const logsRef = db.collection('irt_submission_logs');
    const oldLogs = await logsRef
        .where('timestamp', '<', cutoffDate)
        .limit(500)
        .get();

    if (oldLogs.empty) {
        return 0;
    }

    const batch = db.batch();
    oldLogs.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    logger.info(`Deleted ${oldLogs.size} old IRT logs`);

    return oldLogs.size;
};
