import { useState, useRef, useCallback } from 'react';
import type { SessionData, SessionInteraction } from '../types/studentProfile';

export const useStudentTelemetry = (userId: string, lessonId: string) => {
    const [startTime] = useState<number>(Date.now());
    const interactionsRef = useRef<SessionInteraction[]>([]);

    // Ref to track current question state
    const currentQuestionRef = useRef<{
        questionId: string;
        type: string;
        startTime: number;
        hintCount: number;
    } | null>(null);

    const onQuestionStart = useCallback((questionId: string, type: string) => {
        currentQuestionRef.current = {
            questionId,
            type,
            startTime: Date.now(),
            hintCount: 0
        };

    }, []);

    const onHintRequested = useCallback(() => {
        if (currentQuestionRef.current) {
            currentQuestionRef.current.hintCount++;

        }
    }, []);

    const onAnswerSubmitted = useCallback((isCorrect: boolean, attemptCount: number) => {
        if (!currentQuestionRef.current) return;

        const endTime = Date.now();
        const duration = (endTime - currentQuestionRef.current.startTime) / 1000;

        const interaction: SessionInteraction = {
            questionId: currentQuestionRef.current.questionId,
            type: currentQuestionRef.current.type,
            isCorrect,
            attemptCount,
            timeSpentSec: duration,
            hintsUsed: currentQuestionRef.current.hintCount,
            timestamp: endTime
        };

        interactionsRef.current.push(interaction);


        // Reset current question
        currentQuestionRef.current = null;
    }, []);

    const getSessionSummary = useCallback((): SessionData => {
        const endTime = Date.now();
        const interactions = interactionsRef.current;

        const totalQuestions = interactions.length;
        const correctAnswers = interactions.filter(i => i.isCorrect).length;
        const totalHints = interactions.reduce((acc, curr) => acc + curr.hintsUsed, 0);
        const totalDuration = interactions.reduce((acc, curr) => acc + curr.timeSpentSec, 0);

        return {
            userId,
            lessonId,
            startTime,
            endTime,
            duration_sec: (endTime - startTime) / 1000,
            interactions,
            summary: {
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                total_hints_used: totalHints,
                avg_response_time_sec: totalQuestions > 0 ? totalDuration / totalQuestions : 0
            }
        };
    }, [userId, lessonId, startTime]);

    return {
        onQuestionStart,
        onHintRequested,
        onAnswerSubmitted,
        getSessionSummary
    };
};
