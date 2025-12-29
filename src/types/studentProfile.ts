import { Timestamp } from 'firebase/firestore';

export interface StudentProfile {
    userId: string;
    lastUpdated: Timestamp | Date;

    performance: {
        average_response_time_sec: number; // Rolling average
        global_accuracy_rate: number; // 0.0 to 1.0
        error_rate_by_topic: Record<string, number>; // Topic ID -> Error count
        total_questions_attempted: number;
        total_correct_answers: number;
    };

    behavioral: {
        hint_dependency_score: number; // 0.0 to 1.0 (Average hints used per question)
        retry_persistence: number; // 0.0 to 1.0 (Rate of retrying after failure)
        media_preference: {
            text: number;
            video: number;
            gamified: number; // e.g. memory_game, interactive-chat
        };
    };

    engagement: {
        total_learning_time_sec: number;
        completed_lessons_count: number;
        last_active_at: Timestamp | Date;
    };
}

export interface SessionData {
    userId: string;
    lessonId: string;
    startTime: number; // timestamp
    endTime: number; // timestamp
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
    type: string; // 'multiple-choice', 'open-question', etc.
    isCorrect: boolean;
    attemptCount: number;
    timeSpentSec: number;
    hintsUsed: number;
    timestamp: number;
}
