import type { StudentProfile } from '../types/studentProfile';
import { Timestamp } from 'firebase/firestore';

export const SCORING_CONFIG = {
    CORRECT_FIRST_TRY: 100,
    HINT_PENALTY: 2,
    RETRY_PARTIAL: 50,
};

export const OPEN_QUESTION_SCORES = {
    CORRECT: 100,
    PARTIAL: 50,
    INCORRECT: 0,
};

export interface AnswerAttempt {
    isCorrect: boolean;
    attempts: number;
    hintsUsed: number;
    responseTimeSec: number;
}

/**
 * Calculates the score for a single question based on attempts and hints.
 */
export const calculateQuestionScore = (attempt: AnswerAttempt): number => {
    if (attempt.isCorrect) {
        if (attempt.attempts === 1) {
            // Check for hints
            if (attempt.hintsUsed > 0) {
                return Math.max(0, SCORING_CONFIG.CORRECT_FIRST_TRY - (attempt.hintsUsed * SCORING_CONFIG.HINT_PENALTY));
            }
            return SCORING_CONFIG.CORRECT_FIRST_TRY;
        } else {
            // Retries
            return SCORING_CONFIG.RETRY_PARTIAL;
        }
    }
    return 0;
};

/**
 * Updates the student's profile performance metrics.
 * Calculates new rolling average for response time.
 */
export const updateStudentProfile = (
    currentProfile: StudentProfile,
    newAttempt: AnswerAttempt
): StudentProfile => {
    const perf = currentProfile.performance;

    // Calculate new rolling average for response time
    const oldTotalTime = perf.average_response_time_sec * perf.total_questions_attempted;
    const newTotalQuestions = perf.total_questions_attempted + 1;
    const newAvgTime = (oldTotalTime + newAttempt.responseTimeSec) / newTotalQuestions;

    // Update Correct Answers
    const newCorrectCount = newAttempt.isCorrect ? perf.total_correct_answers + 1 : perf.total_correct_answers;

    // Update Accuracy Rate
    const newAccuracy = newCorrectCount / newTotalQuestions;

    return {
        ...currentProfile,
        lastUpdated: new Date() as any, // In real app, use serverTimestamp() or ensure consistent type
        performance: {
            ...perf,
            average_response_time_sec: Number(newAvgTime.toFixed(2)),
            total_questions_attempted: newTotalQuestions,
            total_correct_answers: newCorrectCount,
            global_accuracy_rate: Number(newAccuracy.toFixed(2)),
        }
    };
};
