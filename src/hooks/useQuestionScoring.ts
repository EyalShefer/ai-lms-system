import { useState, useCallback, useRef } from 'react';
import { calculateQuestionScore, SCORING_CONFIG } from '../utils/scoring';

export interface ScoringState {
    attempts: number;
    hintsUsed: number;
    startTime: number;
    isSubmitted: boolean;
}

export interface ScoringResult {
    score: number;
    xpGain: number;
    gemsGain: number;
    feedback: {
        message: string;
        type: 'success' | 'partial' | 'failure';
    };
}

/**
 * Central Hook for Question Scoring
 *
 * This hook unifies scoring logic across all question types according to PROJECT_DNA.md rules:
 * - First try correct with no hints: 100 points
 * - First try correct with hints: 100 - (hintsUsed * HINT_PENALTY)
 * - Second+ try correct: RETRY_PARTIAL (50 points)
 * - Incorrect: 0 points
 *
 * @param blockId - Unique identifier for the current question block
 * @param isExamMode - Whether this is exam/assessment mode (affects hints and feedback)
 */
export const useQuestionScoring = (blockId: string, isExamMode: boolean = false) => {
    const [state, setState] = useState<ScoringState>({
        attempts: 0,
        hintsUsed: 0,
        startTime: Date.now(),
        isSubmitted: false
    });

    // Track start time for accurate response time calculation
    const startTimeRef = useRef<number>(Date.now());

    /**
     * Reset the scoring state for a new question
     */
    const resetScoring = useCallback(() => {
        startTimeRef.current = Date.now();
        setState({
            attempts: 0,
            hintsUsed: 0,
            startTime: Date.now(),
            isSubmitted: false
        });
    }, []);

    /**
     * Increment hint counter
     * Only allowed in learning mode (not exams)
     */
    const incrementHint = useCallback(() => {
        if (isExamMode) {
            console.warn('❌ Hints are forbidden in exam mode!');
            return;
        }

        setState(prev => ({
            ...prev,
            hintsUsed: prev.hintsUsed + 1
        }));
    }, [isExamMode]);

    /**
     * Record an attempt (whether correct or not)
     */
    const recordAttempt = useCallback(() => {
        setState(prev => ({
            ...prev,
            attempts: prev.attempts + 1
        }));
    }, []);

    /**
     * Calculate final score based on attempt data
     *
     * @param isCorrect - Whether the answer was correct
     * @returns ScoringResult with score, XP, gems, and feedback
     */
    const calculateScore = useCallback((isCorrect: boolean): ScoringResult => {
        const responseTimeSec = (Date.now() - startTimeRef.current) / 1000;

        // Use the central scoring function
        const score = calculateQuestionScore({
            isCorrect,
            attempts: state.attempts + 1, // +1 because we haven't called recordAttempt yet
            hintsUsed: state.hintsUsed,
            responseTimeSec
        });

        // Mark as submitted
        setState(prev => ({ ...prev, isSubmitted: true, attempts: prev.attempts + 1 }));

        // Calculate gamification rewards
        // XP is directly tied to score (0-100)
        const xpGain = score;

        // Gems: 1 for correct answer, bonus for perfect score
        let gemsGain = 0;
        if (isCorrect) {
            gemsGain = 1;
            if (score === 100) {
                gemsGain = 2; // Bonus gem for perfect score
            }
        }

        // Generate contextual feedback
        let feedback: ScoringResult['feedback'];

        if (!isCorrect) {
            feedback = {
                type: 'failure',
                message: 'לא נורא, נסה שוב!'
            };
        } else if (score === 100) {
            feedback = {
                type: 'success',
                message: ['מעולה!', 'כל הכבוד!', 'יפה מאוד!', 'מושלם!'][Math.floor(Math.random() * 4)]
            };
        } else if (score >= SCORING_CONFIG.RETRY_PARTIAL) {
            feedback = {
                type: 'partial',
                message: state.hintsUsed > 0
                    ? `יפה! (${SCORING_CONFIG.CORRECT_FIRST_TRY - score} נקודות הופחתו בגלל ${state.hintsUsed} רמזים)`
                    : 'טוב! (תשובה נכונה בניסיון נוסף)'
            };
        } else {
            feedback = {
                type: 'partial',
                message: 'כמעט!'
            };
        }

        return {
            score,
            xpGain,
            gemsGain,
            feedback
        };
    }, [state.attempts, state.hintsUsed]);

    /**
     * Get current scoring state for display/debugging
     */
    const getScoringInfo = useCallback(() => {
        return {
            attempts: state.attempts,
            hintsUsed: state.hintsUsed,
            responseTimeSec: (Date.now() - startTimeRef.current) / 1000,
            isSubmitted: state.isSubmitted,
            maxPossibleScore: state.attempts === 0
                ? SCORING_CONFIG.CORRECT_FIRST_TRY - (state.hintsUsed * SCORING_CONFIG.HINT_PENALTY)
                : SCORING_CONFIG.RETRY_PARTIAL
        };
    }, [state]);

    return {
        // State
        attempts: state.attempts,
        hintsUsed: state.hintsUsed,
        isSubmitted: state.isSubmitted,

        // Actions
        incrementHint,
        recordAttempt,
        calculateScore,
        resetScoring,
        getScoringInfo
    };
};
