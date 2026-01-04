/**
 * EXAM CONTROLLER
 *
 * Orchestrates the complete Exam Generation Pipeline
 *
 * Pipeline Stages:
 * 1. Exam Architect (The Brain) - Strategic test planning
 * 2. Exam Generator (The Hands) - Question creation (parallel)
 * 3. Local Validation - Fast integrity checks
 * 4. Auto-Repair - Fix common issues
 * 5. Exam Guardian (The Validator) - AI-powered quality assurance
 * 6. Final Assembly - Build complete exam structure
 *
 * This controller is completely isolated from learning content generation.
 */

import OpenAI from "openai";
import * as logger from "firebase-functions/logger";
import { v4 as uuidv4 } from 'uuid';
import { runExamArchitect, type ExamArchitectContext, type ExamSkeleton } from '../services/examArchitect';
import { generateAllExamQuestions, type ExamGeneratorContext, type ExamQuestionResponse } from '../services/examGenerator';
import { validateExamIntegrity, performLocalValidation, autoRepairExamQuestions, type ExamGuardianResult } from '../services/examGuardian';
import { mapSystemItemToBlock } from '../shared/utils/geminiParsers';

export interface ExamGenerationRequest {
    topic: string;
    gradeLevel: string;
    subject?: string;
    fileData?: any;
    activityLength?: 'short' | 'medium' | 'long';
    sourceText?: string;
    taxonomy?: { knowledge: number; application: number; evaluation: number };
    customTitle?: string;
}

export interface ExamGenerationResult {
    success: boolean;
    exam?: any[]; // Final course structure
    skeleton?: ExamSkeleton;
    guardianResult?: ExamGuardianResult;
    error?: string;
    metadata: {
        totalQuestions: number;
        totalPoints: number;
        generationTimeMs: number;
        qualityScore: number;
    };
}

/**
 * Main exam generation pipeline
 *
 * This function orchestrates the complete 3-stage pipeline with
 * validation and auto-repair steps.
 */
export async function generateExam(
    openai: OpenAI,
    request: ExamGenerationRequest
): Promise<ExamGenerationResult> {
    const startTime = Date.now();

    logger.info(`🎓 Exam Controller: Starting exam generation for "${request.topic}"`);

    try {
        // ===== STAGE 1: ARCHITECT (THE BRAIN) =====
        logger.info(`📋 Stage 1/5: Running Exam Architect...`);

        const architectContext: ExamArchitectContext = {
            topic: request.topic,
            gradeLevel: request.gradeLevel,
            subject: request.subject || 'כללי',
            fileData: request.fileData,
            activityLength: request.activityLength || 'medium',
            sourceText: request.sourceText,
            taxonomy: request.taxonomy
        };

        const skeleton = await runExamArchitect(openai, architectContext);

        if (!skeleton || !skeleton.steps || skeleton.steps.length === 0) {
            throw new Error("Exam Architect failed to generate valid skeleton");
        }

        logger.info(`✅ Stage 1/5: Architect created ${skeleton.steps.length} question specifications`);

        // ===== STAGE 2: GENERATOR (THE HANDS) =====
        logger.info(`📋 Stage 2/5: Running Exam Generator (parallel)...`);

        const generatorContext: ExamGeneratorContext = {
            topic: request.topic,
            gradeLevel: request.gradeLevel,
            sourceText: request.sourceText
        };

        const questions = await generateAllExamQuestions(openai, skeleton, generatorContext);

        if (questions.length === 0) {
            throw new Error("Exam Generator failed to create any questions");
        }

        logger.info(`✅ Stage 2/5: Generator created ${questions.length} questions`);

        // ===== STAGE 3: LOCAL VALIDATION =====
        logger.info(`📋 Stage 3/5: Running local validation...`);

        const localValidation = performLocalValidation(questions);

        if (!localValidation.passed) {
            logger.warn(`⚠️ Stage 3/5: Local validation found ${localValidation.issues.length} issues`);
        } else {
            logger.info(`✅ Stage 3/5: Local validation passed`);
        }

        // ===== STAGE 4: AUTO-REPAIR =====
        logger.info(`📋 Stage 4/5: Running auto-repair...`);

        const repairedQuestions = autoRepairExamQuestions(questions);

        logger.info(`✅ Stage 4/5: Auto-repair completed`);

        // ===== STAGE 5: EXAM GUARDIAN (AI VALIDATION) =====
        logger.info(`📋 Stage 5/5: Running Exam Guardian...`);

        const guardianResult = await validateExamIntegrity(openai, repairedQuestions);

        if (guardianResult.status === 'CRITICAL_FAIL') {
            logger.error(`❌ Exam Guardian: CRITICAL FAIL - ${guardianResult.critical_fail_reason}`);

            // Return error with detailed feedback
            return {
                success: false,
                error: `Exam Guardian blocked content: ${guardianResult.critical_fail_reason}. ${guardianResult.feedback_hebrew}`,
                skeleton,
                guardianResult,
                metadata: {
                    totalQuestions: questions.length,
                    totalPoints: skeleton.total_points,
                    generationTimeMs: Date.now() - startTime,
                    qualityScore: guardianResult.overall_quality_score
                }
            };
        }

        logger.info(`✅ Stage 5/5: Guardian approved content (Quality: ${guardianResult.overall_quality_score}/100)`);

        // ===== STAGE 6: FINAL ASSEMBLY =====
        logger.info(`📋 Final Assembly: Building exam structure...`);

        const exam = await buildExamStructure(
            request,
            skeleton,
            repairedQuestions
        );

        const generationTimeMs = Date.now() - startTime;

        logger.info(`🎉 Exam Controller: Successfully generated exam in ${generationTimeMs}ms`);

        return {
            success: true,
            exam,
            skeleton,
            guardianResult,
            metadata: {
                totalQuestions: repairedQuestions.length,
                totalPoints: skeleton.total_points,
                generationTimeMs,
                qualityScore: guardianResult.overall_quality_score
            }
        };

    } catch (error: any) {
        logger.error("❌ Exam Controller: Generation failed", error);

        return {
            success: false,
            error: error.message || "Unknown error occurred during exam generation",
            metadata: {
                totalQuestions: 0,
                totalPoints: 0,
                generationTimeMs: Date.now() - startTime,
                qualityScore: 0
            }
        };
    }
}

/**
 * Build final exam structure
 *
 * Converts the generated questions into the standard course structure
 * expected by the frontend player.
 */
async function buildExamStructure(
    request: ExamGenerationRequest,
    skeleton: ExamSkeleton,
    questions: ExamQuestionResponse[]
): Promise<any[]> {
    const blocks: any[] = [];

    // Add Exam Header Block
    blocks.push({
        id: uuidv4(),
        type: 'text',
        content: `# ${request.customTitle || skeleton.exam_title}\n\n**מקצוע:** ${request.subject || 'כללי'}\n**קהל יעד:** ${request.gradeLevel}\n**סה"כ נקודות:** ${skeleton.total_points}\n**זמן משוער:** ${skeleton.estimated_duration_minutes} דקות\n**מספר שאלות:** ${skeleton.steps.length}\n\n---\n\n### הוראות למבחן\n\n1. קרא כל שאלה בעיון\n2. ענה על כל השאלות\n3. ניתן לחזור ולשנות תשובות לפני ההגשה\n4. לחץ "הגש מבחן" בסיום\n5. **שים לב:** זמן מומלץ למבחן זה הוא ${skeleton.estimated_duration_minutes} דקות\n\n**בהצלחה!** 🎓`,
        metadata: {
            isExamHeader: true,
            totalPoints: skeleton.total_points,
            estimatedDuration: skeleton.estimated_duration_minutes,
            questionCount: skeleton.steps.length,
            accessibility: {
                screen_reader_friendly: true,
                tts_enabled: true
            }
        }
    });

    // Add Generated Questions (mapped to blocks)
    questions.forEach((question: any) => {
        const block = mapSystemItemToBlock(question);
        if (block) {
            // Add exam-specific metadata
            block.metadata = {
                ...block.metadata,
                isExamQuestion: true,
                points: question.points || 10,
                bloomLevel: question.bloom_level,
                estimatedTimeMinutes: question.data?.estimated_time_minutes || 5, // ✨ NEW
                difficultyLevel: question.data?.difficulty_level || 'medium', // ✨ NEW
                // ✨ NEW: Accessibility metadata
                accessibility: {
                    screen_reader_friendly: true,
                    tts_enabled: true,
                    dyslexia_friendly: true,
                    high_contrast_compatible: true,
                    alt_text: generateAltText(question), // Helper function
                    tts_text: generateTTSText(question) // Helper function
                },
                // ✨ NEW: Distractor analysis (if multiple choice)
                distractor_analysis: question.data?.distractor_analysis || null,
                // ✨ NEW: Rubric (if open question)
                rubric: question.data?.rubric || question.data?.criteria || null
            };
            blocks.push(block);
        }
    });

    // ✨ Helper functions for accessibility
    function generateAltText(question: any): string {
        if (question.selected_interaction === 'multiple_choice') {
            return `שאלת רב-בררה: ${question.data.question || 'שאלה'}. ${question.data.options?.length || 4} אפשרויות.`;
        } else if (question.selected_interaction === 'open_question') {
            return `שאלה פתוחה: ${question.data.question || 'שאלה'}. נדרשת תשובה מפורטת.`;
        }
        return `שאלה מסוג ${question.selected_interaction}`;
    }

    function generateTTSText(question: any): string {
        // Format for Text-to-Speech engines
        let tts = `שאלה מספר ${question.step_number}. `;

        if (question.data.question) {
            tts += `${question.data.question}. `;
        }

        if (question.selected_interaction === 'multiple_choice' && question.data.options) {
            tts += 'אפשרויות: ';
            question.data.options.forEach((opt: string, idx: number) => {
                tts += `אופציה ${String.fromCharCode(65 + idx)}: ${opt}. `;
            });
        }

        return tts;
    }

    // Wrap in standard course structure
    const examCourse = [
        {
            id: uuidv4(),
            title: request.customTitle || skeleton.exam_title,
            learningUnits: [
                {
                    id: uuidv4(),
                    title: skeleton.exam_title,
                    type: 'assessment', // Mark as assessment type
                    activityBlocks: blocks
                }
            ],
            metadata: {
                isExam: true,
                totalPoints: skeleton.total_points,
                totalQuestions: questions.length,
                examTitle: skeleton.exam_title
            }
        }
    ];

    return examCourse;
}

/**
 * Export function for use in Cloud Functions
 */
export function createExamController(openAiApiKey: any) {
    return {
        /**
         * Generate a complete exam
         */
        generateExam: async (request: ExamGenerationRequest): Promise<ExamGenerationResult> => {
            const openai = new OpenAI({ apiKey: openAiApiKey.value() });
            return generateExam(openai, request);
        }
    };
}
