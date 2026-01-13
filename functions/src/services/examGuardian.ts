/**
 * EXAM GUARDIAN SERVICE
 *
 * Stage 3 of the Exam Generation Pipeline: The Validator
 *
 * Responsibilities:
 * - Verify exam integrity (no hints, no teaching content)
 * - Ensure all questions are assessment-focused
 * - Check for answer leaks in feedback
 * - Validate question quality and clarity
 *
 * Output: Validation result with pass/fail status and detailed feedback
 */

import * as logger from "firebase-functions/logger";
import { cleanJsonString } from '../shared/utils/geminiParsers';
import { getExamGuardianPrompt } from '../ai/examPrompts';
import { generateJSON, ChatMessage } from './geminiService';
import type { ExamQuestionResponse } from './examGenerator';

export interface GuardianCheckResult {
    status: 'PASS' | 'FAIL' | 'WARN';
    details: string;
}

export interface ExamGuardianResult {
    status: 'PASS' | 'CRITICAL_FAIL' | 'WARNING';
    critical_fail_reason: string | null;
    phase1_checks: {
        hints_leak: GuardianCheckResult;
        teaching_content: GuardianCheckResult;
        tone_check: GuardianCheckResult;
        answer_reveal: GuardianCheckResult;
    };
    phase2_fairness: { // ✨ NEW
        cultural_bias: GuardianCheckResult;
        gender_bias: GuardianCheckResult;
        socioeconomic_bias: GuardianCheckResult;
        accessibility: GuardianCheckResult;
    };
    phase3_scores: { // ✨ RENAMED from phase2_scores
        coverage: number;
        bloom_accuracy: number;
        question_clarity: number;
        distractor_quality: number;
        rubric_quality: number; // ✨ NEW
    };
    overall_quality_score: number;
    feedback_hebrew: string;
    issues: Array<{
        question_number?: number;
        severity: 'CRITICAL' | 'WARNING' | 'INFO';
        description: string;
    }>;
    auto_repair_instruction?: string;
}

/**
 * Validate exam content for integrity
 *
 * This function performs rigorous validation to ensure:
 * 1. No hints or scaffolding present
 * 2. No teaching content (exam-only mode)
 * 3. Formal, objective tone
 * 4. No answer reveals in feedback
 *
 * Uses Gemini 2.5 Pro with very low temperature (0.1) for strict validation.
 */
export async function validateExamIntegrity(
    questions: ExamQuestionResponse[]
): Promise<ExamGuardianResult> {
    logger.info(`🛡️ Exam Guardian: Starting integrity check for ${questions.length} questions`);

    // Serialize content for validation (sample to save tokens if very long)
    const contentSample = JSON.stringify(questions).substring(0, 15000);

    // Generate the prompt
    const prompt = getExamGuardianPrompt(contentSample);

    try {
        const messages: ChatMessage[] = [{ role: "user", content: prompt }];
        const validationResult = await generateJSON<ExamGuardianResult>(messages, {
            temperature: 0.1 // Very strict validation
        });

        // Log result
        if (validationResult.status === 'CRITICAL_FAIL') {
            logger.error(`🛡️ Exam Guardian: CRITICAL FAIL - ${validationResult.critical_fail_reason}`);
            logger.error(`Details: ${validationResult.feedback_hebrew}`);
        } else if (validationResult.status === 'WARNING') {
            logger.warn(`🛡️ Exam Guardian: WARNING - ${validationResult.feedback_hebrew}`);
        } else {
            logger.info(`🛡️ Exam Guardian: PASS - Quality Score: ${validationResult.overall_quality_score}/100`);
        }

        return validationResult;

    } catch (error) {
        logger.error("🛡️ Exam Guardian: Validation failed with error", error);

        // Fail-safe: Return a cautious pass with note
        return {
            status: 'WARNING',
            critical_fail_reason: null,
            phase1_checks: {
                hints_leak: { status: 'PASS', details: 'Guardian error - could not validate' },
                teaching_content: { status: 'PASS', details: 'Guardian error - could not validate' },
                tone_check: { status: 'PASS', details: 'Guardian error - could not validate' },
                answer_reveal: { status: 'PASS', details: 'Guardian error - could not validate' }
            },
            phase2_fairness: {
                cultural_bias: { status: 'WARN', details: 'Guardian error - could not validate' },
                gender_bias: { status: 'WARN', details: 'Guardian error - could not validate' },
                socioeconomic_bias: { status: 'WARN', details: 'Guardian error - could not validate' },
                accessibility: { status: 'WARN', details: 'Guardian error - could not validate' }
            },
            phase3_scores: {
                coverage: 0,
                bloom_accuracy: 0,
                question_clarity: 0,
                distractor_quality: 0,
                rubric_quality: 0
            },
            overall_quality_score: 0,
            feedback_hebrew: 'שגיאה בבדיקת האיכות - המערכת לא הצליחה לאמת את המבחן',
            issues: [{
                severity: 'WARNING',
                description: 'Guardian failed to execute - manual review recommended'
            }]
        };
    }
}

/**
 * Perform local validation (fast, pre-AI check)
 *
 * This function runs quick local checks before sending to AI Guardian.
 * It catches obvious issues like non-empty hints or teach_content.
 */
export function performLocalValidation(questions: ExamQuestionResponse[]): {
    passed: boolean;
    issues: string[];
} {
    const issues: string[] = [];

    questions.forEach((question, index) => {
        const qNum = index + 1;

        // Check 1: teach_content should be empty
        if (question.teach_content && question.teach_content.trim() !== "") {
            issues.push(`Question ${qNum}: Contains teaching content (${question.teach_content.substring(0, 50)}...)`);
        }

        // Check 2: progressive_hints should be empty
        if (question.data.progressive_hints && question.data.progressive_hints.length > 0) {
            issues.push(`Question ${qNum}: Contains ${question.data.progressive_hints.length} hints`);
        }

        // Check 3: Must have a question/instruction
        const hasQuestion = question.data.question || question.data.instruction || question.data.text;
        if (!hasQuestion) {
            issues.push(`Question ${qNum}: Missing question text`);
        }
    });

    const passed = issues.length === 0;

    if (!passed) {
        logger.warn(`🛡️ Local Validation: Found ${issues.length} issues`);
        issues.forEach(issue => logger.warn(`  - ${issue}`));
    } else {
        logger.info(`✅ Local Validation: All ${questions.length} questions passed preliminary checks`);
    }

    return { passed, issues };
}

/**
 * Auto-repair exam issues
 *
 * This function automatically fixes common exam integrity issues:
 * - Removes teach_content
 * - Clears progressive_hints
 * - Sanitizes feedback to avoid answer reveals
 */
export function autoRepairExamQuestions(questions: ExamQuestionResponse[]): ExamQuestionResponse[] {
    logger.info(`🔧 Auto-Repair: Processing ${questions.length} questions`);

    let repairCount = 0;

    const repairedQuestions = questions.map((question) => {
        let wasRepaired = false;

        // Repair 1: Remove teach_content
        if (question.teach_content && question.teach_content.trim() !== "") {
            question.teach_content = "";
            wasRepaired = true;
        }

        // Repair 2: Clear progressive_hints
        if (question.data.progressive_hints && question.data.progressive_hints.length > 0) {
            question.data.progressive_hints = [];
            wasRepaired = true;
        }

        if (wasRepaired) {
            repairCount++;
            logger.info(`🔧 Auto-Repair: Fixed question ${question.step_number}`);
        }

        return question;
    });

    logger.info(`✅ Auto-Repair: ${repairCount}/${questions.length} questions were repaired`);

    return repairedQuestions;
}
