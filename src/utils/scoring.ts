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

// ============================================
// BLOOM-BASED SMART SCORING SYSTEM
// ============================================

/**
 * Base weight for each question type (before Bloom multiplier)
 */
export const BASE_WEIGHTS: Record<string, number> = {
    'multiple_choice': 5,
    'multiple-choice': 5,
    'true_false': 5,
    'true-false': 5,
    'fill_in_blanks': 7,
    'fill-in-blanks': 7,
    'cloze': 7,
    'memory_game': 8,
    'memory-game': 8,
    'ordering': 10,
    'categorization': 10,
    'open_question': 15,
    'open-question': 15,
    'audio_response': 10,
    'audio-response': 10,
};

/**
 * Bloom's Taxonomy multipliers - higher cognitive levels = more points
 */
export const BLOOM_MULTIPLIERS: Record<string, number> = {
    'Remember': 1.0,
    'Understand': 1.2,
    'Apply': 1.5,
    'Analyze': 1.7,
    'Evaluate': 2.0,
    'Create': 2.2,
    // Hebrew variants
    'זכירה': 1.0,
    'הבנה': 1.2,
    'יישום': 1.5,
    'ניתוח': 1.7,
    'הערכה': 2.0,
    'יצירה': 2.2,
    // Legacy/alternate names
    'Knowledge': 1.0,
    'Comprehension': 1.2,
    'Application': 1.5,
    'Analysis': 1.7,
    'Synthesis': 2.0,
    'Evaluation': 2.0,
};

/**
 * Default Bloom level for each question type (when not specified)
 */
export const DEFAULT_BLOOM_LEVELS: Record<string, string> = {
    'multiple_choice': 'Remember',
    'multiple-choice': 'Remember',
    'true_false': 'Remember',
    'true-false': 'Remember',
    'fill_in_blanks': 'Understand',
    'fill-in-blanks': 'Understand',
    'cloze': 'Understand',
    'memory_game': 'Remember',
    'memory-game': 'Remember',
    'ordering': 'Apply',
    'categorization': 'Apply',
    'open_question': 'Analyze',
    'open-question': 'Analyze',
    'audio_response': 'Apply',
    'audio-response': 'Apply',
};

/**
 * Calculate the weight/points for a question based on type and Bloom level
 *
 * Formula: baseWeight[type] × bloomMultiplier[level]
 *
 * @param questionType - The type of question (e.g., 'multiple_choice', 'ordering')
 * @param bloomLevel - The Bloom's taxonomy level (e.g., 'Remember', 'Apply')
 * @returns The calculated weight/points for this question
 */
export const calculateQuestionWeight = (
    questionType: string,
    bloomLevel?: string
): number => {
    // Normalize question type (handle hyphens/underscores)
    const normalizedType = questionType.toLowerCase().replace(/-/g, '_');

    // Get base weight (default to 10 if unknown type)
    const baseWeight = BASE_WEIGHTS[normalizedType] ?? BASE_WEIGHTS[questionType] ?? 10;

    // Determine Bloom level
    let effectiveBloomLevel = bloomLevel;
    if (!effectiveBloomLevel || !BLOOM_MULTIPLIERS[effectiveBloomLevel]) {
        // Use default for this question type, or 'Remember' as fallback
        effectiveBloomLevel = DEFAULT_BLOOM_LEVELS[normalizedType] ??
                              DEFAULT_BLOOM_LEVELS[questionType] ??
                              'Remember';
    }

    // Get Bloom multiplier (default to 1.0)
    const bloomMultiplier = BLOOM_MULTIPLIERS[effectiveBloomLevel] ?? 1.0;

    // Calculate and round to integer
    return Math.round(baseWeight * bloomMultiplier);
};

/**
 * Calculate partial score for complex question types (categorization, ordering, fill_in_blanks)
 * Used primarily in Exam mode where partial credit is given
 *
 * @param questionType - The type of question
 * @param correctCount - Number of correct items/placements
 * @param totalCount - Total number of items
 * @param questionWeight - The weight of the question (from calculateQuestionWeight)
 * @returns The partial score
 */
export const calculatePartialScore = (
    questionType: string,
    correctCount: number,
    totalCount: number,
    questionWeight: number
): number => {
    if (totalCount === 0) return 0;

    const ratio = correctCount / totalCount;
    return Math.round(questionWeight * ratio * 10) / 10; // Round to 1 decimal
};

/**
 * Calculate ordering score using pair-based comparison
 * More accurate than simple position matching
 *
 * @param userOrder - Array of item IDs/indices in user's order
 * @param correctOrder - Array of item IDs/indices in correct order
 * @param questionWeight - The weight of the question
 * @returns The partial score based on correct pairs
 */
export const calculateOrderingScore = (
    userOrder: (string | number)[],
    correctOrder: (string | number)[],
    questionWeight: number
): number => {
    if (userOrder.length !== correctOrder.length || userOrder.length < 2) {
        return 0;
    }

    const n = userOrder.length;
    const totalPairs = (n * (n - 1)) / 2; // Number of unique pairs

    // Create position maps
    const userPositions = new Map<string | number, number>();
    const correctPositions = new Map<string | number, number>();

    userOrder.forEach((item, idx) => userPositions.set(item, idx));
    correctOrder.forEach((item, idx) => correctPositions.set(item, idx));

    // Count pairs in correct relative order
    let correctPairs = 0;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const itemA = correctOrder[i];
            const itemB = correctOrder[j];

            const userPosA = userPositions.get(itemA);
            const userPosB = userPositions.get(itemB);

            if (userPosA !== undefined && userPosB !== undefined && userPosA < userPosB) {
                correctPairs++;
            }
        }
    }

    const ratio = correctPairs / totalPairs;
    return Math.round(questionWeight * ratio * 10) / 10;
};

/**
 * Calculate final score combining question weight and performance
 *
 * Learning Mode: weight × (performanceScore / 100)
 * Exam Mode: weight × correctnessRatio
 *
 * @param questionWeight - The weight of the question
 * @param performanceOrRatio - Performance score (0-100) for learning, or ratio (0-1) for exam
 * @param isExamMode - Whether this is exam mode
 * @returns The final weighted score
 */
export const calculateFinalScore = (
    questionWeight: number,
    performanceOrRatio: number,
    isExamMode: boolean = false
): number => {
    if (isExamMode) {
        // Exam mode: ratio is already 0-1
        return Math.round(questionWeight * performanceOrRatio * 10) / 10;
    } else {
        // Learning mode: performance is 0-100
        return Math.round(questionWeight * (performanceOrRatio / 100) * 10) / 10;
    }
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
