/**
 * EXAM ARCHITECT SERVICE
 *
 * Stage 1 of the Exam Generation Pipeline: The Brain
 *
 * Responsibilities:
 * - Analyze source material holistically
 * - Create a strategic test plan (skeleton)
 * - Ensure balanced coverage of topics
 * - Assign Bloom levels and question types
 *
 * Output: ExamSkeleton with question specifications
 */

import * as logger from "firebase-functions/logger";
import { cleanJsonString } from '../shared/utils/geminiParsers';
import {
    getExamArchitectPrompt,
    getExamArchitectPromptWithDNA,
    getExamStructureGuide,
    getExamBloomSteps,
    calculateQuestionPoints,
    estimateQuestionTime
} from '../ai/examPrompts';
import { generateJSON, ChatMessage } from './geminiService';
import type { ExamDNA } from './knowledgeBase/types';

export interface ExamSkeletonStep {
    step_number: number;
    title: string;
    assessment_focus: string;
    forbidden_topics: string[];
    bloom_level: string;
    suggested_interaction_type: string;
    points: number;
    estimated_time_minutes: number; // ✨ NEW
    difficulty_level: 'easy' | 'medium' | 'hard'; // ✨ NEW
}

export interface CoverageMatrixEntry {
    question_numbers: number[];
    bloom_levels: string[];
    total_points: number;
}

export interface ExamSkeleton {
    exam_title: string;
    total_points: number;
    estimated_duration_minutes: number; // ✨ NEW
    coverage_matrix?: { [topic: string]: CoverageMatrixEntry }; // ✨ NEW
    steps: ExamSkeletonStep[];
}

export interface ExamArchitectContext {
    topic: string;
    gradeLevel: string;
    subject: string;
    fileData?: any;
    activityLength: 'short' | 'medium' | 'long';
    sourceText?: string;
    taxonomy?: { knowledge: number; application: number; evaluation: number };
    // NEW: Reference Exam DNA for template-based generation
    referenceExamDna?: ExamDNA;
}

/**
 * Run the Exam Architect stage
 *
 * This function uses Gemini 2.5 Pro with low temperature (0.3) to ensure
 * deterministic, consistent exam structure generation.
 */
export async function runExamArchitect(
    context: ExamArchitectContext
): Promise<ExamSkeleton | null> {
    // Determine question count based on length or DNA
    let stepCount = 5;
    if (context.referenceExamDna) {
        // Use DNA's question count as base
        stepCount = context.referenceExamDna.questionCount;
        logger.info(`🧬 Using Reference Exam DNA: ${stepCount} questions`);
    } else if (context.activityLength === 'short') {
        stepCount = 3;
    } else if (context.activityLength === 'long') {
        stepCount = 7;
    }

    // Get structure guide and Bloom steps
    const structureGuide = getExamStructureGuide(stepCount);
    const bloomSteps = getExamBloomSteps(stepCount, context.taxonomy);

    // Prepare context part (source material or topic)
    const contextPart = context.sourceText
        ? `BASE EXAM ON THIS TEXT ONLY:\n"""${context.sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
        : `Topic: "${context.topic}"`;

    // Generate the prompt - use DNA-enhanced prompt if available
    let systemPrompt: string;
    if (context.referenceExamDna) {
        systemPrompt = getExamArchitectPromptWithDNA(
            contextPart,
            context.gradeLevel,
            stepCount,
            bloomSteps,
            structureGuide,
            context.referenceExamDna
        );
    } else {
        systemPrompt = getExamArchitectPrompt(
            contextPart,
            context.gradeLevel,
            stepCount,
            bloomSteps,
            structureGuide
        );
    }

    // Prepare user content
    let userContentText = `Create exam skeleton for: ${context.topic}`;

    // Note: For image support, Gemini 2.5 Pro handles this differently
    // If fileData is present, we would use generateWithVision instead
    if (context.fileData) {
        logger.warn('⚠️ File data provided but Gemini JSON generation does not support images. Using text-only mode.');
    }

    try {
        logger.info(`🧠 Exam Architect: Planning ${stepCount} questions for "${context.topic}"`);

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContentText }
        ];

        const result = await generateJSON<ExamSkeleton>(messages, {
            temperature: 0.3 // LOW temperature for deterministic exam planning
        });

        // Validate structure
        if (!result.steps || !Array.isArray(result.steps) || result.steps.length === 0) {
            logger.error("❌ Exam Architect: Invalid skeleton format", result);
            return null;
        }

        // ✨ POST-PROCESSING: Calculate smart points and time if AI didn't provide them
        result.steps = result.steps.map((step) => {
            // If AI didn't calculate points correctly, use our formula
            if (!step.points || step.points === 10) {
                step.points = calculateQuestionPoints(step.bloom_level, step.suggested_interaction_type);
            }

            // If AI didn't estimate time, calculate it
            if (!step.estimated_time_minutes) {
                step.estimated_time_minutes = estimateQuestionTime(step.bloom_level, step.suggested_interaction_type);
            }

            // If AI didn't set difficulty, infer from Bloom level
            if (!step.difficulty_level) {
                if (step.bloom_level === 'Remember' || step.bloom_level === 'Understand') {
                    step.difficulty_level = 'easy';
                } else if (step.bloom_level === 'Apply' || step.bloom_level === 'Analyze') {
                    step.difficulty_level = 'medium';
                } else {
                    step.difficulty_level = 'hard';
                }
            }

            return step;
        });

        // Calculate totals
        result.total_points = result.steps.reduce((sum, step) => sum + step.points, 0);
        result.estimated_duration_minutes = result.steps.reduce((sum, step) => sum + step.estimated_time_minutes, 0);

        // Add 25% buffer for reading time and transitions
        result.estimated_duration_minutes = Math.round(result.estimated_duration_minutes * 1.25);

        logger.info(`✅ Exam Architect: Created skeleton with ${result.steps.length} questions`);
        logger.info(`   📊 Total Points: ${result.total_points}`);
        logger.info(`   ⏱️ Estimated Duration: ${result.estimated_duration_minutes} minutes`);

        return result;

    } catch (error) {
        logger.error("❌ Exam Architect Error:", error);
        return null;
    }
}
