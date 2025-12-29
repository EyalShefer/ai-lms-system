import { calculateQuestionScore, updateStudentProfile, AnswerAttempt, SCORING_CONFIG } from './scoring';
import { StudentProfile } from '../types/studentProfile';

describe('Scoring Engine', () => {

    describe('calculateQuestionScore', () => {
        it('should return 100 for correct answer on 1st try with no hints', () => {
            const attempt: AnswerAttempt = { isCorrect: true, attempts: 1, hintsUsed: 0, responseTimeSec: 10 };
            expect(calculateQuestionScore(attempt)).toBe(100);
        });

        it('should penalize score when hints are used', () => {
            const attempt: AnswerAttempt = { isCorrect: true, attempts: 1, hintsUsed: 1, responseTimeSec: 15 };
            // 100 - 15 = 85
            expect(calculateQuestionScore(attempt)).toBe(85);
        });

        it('should return partial score for correct answer after retries', () => {
            const attempt: AnswerAttempt = { isCorrect: true, attempts: 2, hintsUsed: 0, responseTimeSec: 20 };
            expect(calculateQuestionScore(attempt)).toBe(SCORING_CONFIG.RETRY_PARTIAL);
        });

        it('should return 0 for incorrect answer', () => {
            const attempt: AnswerAttempt = { isCorrect: false, attempts: 1, hintsUsed: 0, responseTimeSec: 5 };
            expect(calculateQuestionScore(attempt)).toBe(0);
        });
    });

    describe('updateStudentProfile', () => {
        const mockProfile: StudentProfile = {
            userId: '123',
            lastUpdated: new Date() as any,
            performance: {
                average_response_time_sec: 10,
                global_accuracy_rate: 1.0,
                error_rate_by_topic: {},
                total_questions_attempted: 1,
                total_correct_answers: 1,
            },
            behavioral: { hint_dependency_score: 0, retry_persistence: 0, media_preference: { text: 0, video: 0, gamified: 0 } },
            engagement: { total_learning_time_sec: 100, completed_lessons_count: 1, last_active_at: new Date() as any }
        };

        it('should correctly calculate new rolling average for response time', () => {
            const newAttempt: AnswerAttempt = { isCorrect: true, attempts: 1, hintsUsed: 0, responseTimeSec: 20 };

            // Previous: 1 question, avg 10s -> Total 10s
            // New: 20s
            // Total: 30s / 2 questions = 15s avg

            const updatedProfile = updateStudentProfile(mockProfile, newAttempt);
            expect(updatedProfile.performance.average_response_time_sec).toBe(15);
            expect(updatedProfile.performance.total_questions_attempted).toBe(2);
        });

        it('should update accuracy rate correctly', () => {
            const newAttempt: AnswerAttempt = { isCorrect: false, attempts: 1, hintsUsed: 0, responseTimeSec: 10 };
            // Previous: 1/1 (100%)
            // New: Fail
            // Total: 1/2 (50%)

            const updatedProfile = updateStudentProfile(mockProfile, newAttempt);
            expect(updatedProfile.performance.global_accuracy_rate).toBe(0.5);
            expect(updatedProfile.performance.total_correct_answers).toBe(1); // Unchanged
        });
    });
});
