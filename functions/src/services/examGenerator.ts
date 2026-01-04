/**
 * EXAM GENERATOR SERVICE
 *
 * Stage 2 of the Exam Generation Pipeline: The Hands
 *
 * Responsibilities:
 * - Generate individual exam questions based on architect's specifications
 * - Ensure questions are rigorous and unambiguous
 * - Create NO hints, NO teaching content (exam-only mode)
 * - Use low temperature for consistency
 *
 * Output: Individual question blocks ready for mapping
 */

import OpenAI from "openai";
import * as logger from "firebase-functions/logger";
import { cleanJsonString } from '../shared/utils/geminiParsers';
import { getExamGeneratorPrompt } from '../ai/examPrompts';
import type { ExamSkeletonStep } from './examArchitect';

export interface ExamQuestionResponse {
    step_number: number;
    bloom_level: string;
    teach_content: string; // Should ALWAYS be empty for exams
    selected_interaction: string;
    points: number;
    data: {
        progressive_hints: string[]; // Should ALWAYS be empty for exams
        source_reference_hint?: string;
        question?: string;
        options?: string[];
        correct_answer?: string;
        feedback_correct?: string;
        feedback_incorrect?: string;
        model_answer?: string;
        teacher_guidelines?: string;
        // ✨ NEW: Pedagogical enhancements
        distractor_analysis?: { [distractor: string]: string }; // For multiple choice
        rubric?: { // For open questions
            rubric_type: 'analytic';
            total_points: number;
            criteria: Array<{
                criterion_name: string;
                weight_points: number;
                levels: {
                    excellent: { points: number; description: string };
                    good: { points: number; description: string };
                    partial: { points: number; description: string };
                    missing: { points: number; description: string };
                };
            }>;
            model_answer: string;
            common_mistakes: string[];
        };
        criteria?: any; // Legacy format fallback
        estimated_time_minutes?: number;
        difficulty_level?: 'easy' | 'medium' | 'hard';
        [key: string]: any;
    };
}

export interface ExamGeneratorContext {
    topic: string;
    gradeLevel: string;
    sourceText?: string;
}

/**
 * Generate a single exam question
 *
 * This function creates ONE rigorous exam question based on the
 * specifications provided by the Exam Architect.
 *
 * CRITICAL: Uses temperature 0.3 for deterministic output.
 */
export async function generateExamQuestion(
    openai: OpenAI,
    stepInfo: ExamSkeletonStep,
    context: ExamGeneratorContext
): Promise<ExamQuestionResponse | null> {
    // Prepare context text
    const contextText = context.sourceText
        ? `Source Material:\n"""${context.sourceText.substring(0, 3000)}..."""`
        : `Topic: ${context.topic}`;

    // Generate the prompt
    const systemPrompt = getExamGeneratorPrompt(contextText, stepInfo, context.gradeLevel);

    try {
        logger.info(`✍️ Exam Generator: Creating question ${stepInfo.step_number} (${stepInfo.suggested_interaction_type})`);

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fast model for question generation
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Generate exam question ${stepInfo.step_number} now.` }
            ],
            temperature: 0.3, // LOW temperature for exam consistency
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content || "{}";
        const result = JSON.parse(cleanJsonString(text)) as ExamQuestionResponse;

        // Validate exam integrity
        if (result.teach_content && result.teach_content.trim() !== "") {
            logger.warn(`⚠️ Question ${stepInfo.step_number}: Contains teach_content (will be removed by Guardian)`);
        }

        if (result.data.progressive_hints && result.data.progressive_hints.length > 0) {
            logger.warn(`⚠️ Question ${stepInfo.step_number}: Contains hints (will be removed by Guardian)`);
        }

        logger.info(`✅ Exam Generator: Question ${stepInfo.step_number} created successfully`);

        return result;

    } catch (error) {
        logger.error(`❌ Exam Generator Error (Question ${stepInfo.step_number}):`, error);
        return null;
    }
}

/**
 * Generate all exam questions in parallel
 *
 * This function takes the full skeleton and generates all questions
 * concurrently for speed, then filters out any failures.
 */
export async function generateAllExamQuestions(
    openai: OpenAI,
    skeleton: { steps: ExamSkeletonStep[] },
    context: ExamGeneratorContext
): Promise<ExamQuestionResponse[]> {
    logger.info(`🚀 Exam Generator: Starting parallel generation of ${skeleton.steps.length} questions`);

    const promises = skeleton.steps.map(step =>
        generateExamQuestion(openai, step, context)
    );

    const results = await Promise.all(promises);
    const validResults = results.filter(r => r !== null) as ExamQuestionResponse[];

    logger.info(`✅ Exam Generator: ${validResults.length}/${skeleton.steps.length} questions generated successfully`);

    if (validResults.length < skeleton.steps.length) {
        logger.warn(`⚠️ Exam Generator: ${skeleton.steps.length - validResults.length} questions failed to generate`);
    }

    return validResults;
}
