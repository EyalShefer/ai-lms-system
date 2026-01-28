/**
 * Zod Validation Schemas for Capabilities
 *
 * Validates parameters before wizard execution to prevent
 * invalid data from being passed to content generation.
 */

import { z } from 'zod';

// ========== Common Schemas ==========

const gradeSchema = z.string().optional();
const subjectSchema = z.string().optional();
const topicSchema = z.string().min(2, 'נושא חייב להכיל לפחות 2 תווים').max(200, 'נושא ארוך מדי');

const activityLengthSchema = z.enum(['short', 'medium', 'long']).optional();
const difficultyLevelSchema = z.enum(['support', 'core', 'enrichment', 'all']).optional();

// ========== Interactive Content Schemas ==========

/**
 * Create Interactive Lesson
 */
export const createInteractiveLessonSchema = z.object({
    topic: topicSchema,
    grade: gradeSchema,
    subject: subjectSchema,
    activityLength: activityLengthSchema,
    difficultyLevel: difficultyLevelSchema,
    includeBot: z.boolean().optional()
});

/**
 * Create Interactive Activity
 */
export const createInteractiveActivitySchema = z.object({
    topic: topicSchema,
    grade: gradeSchema,
    activityLength: activityLengthSchema,
    profile: z.enum(['balanced', 'educational', 'game']).optional(),
    questionTypes: z.array(z.string()).optional()
});

/**
 * Create Interactive Exam
 */
export const createInteractiveExamSchema = z.object({
    topic: topicSchema,
    grade: gradeSchema,
    questionCount: z.number().min(5).max(50).optional(),
    difficultyLevel: difficultyLevelSchema,
    timeLimit: z.number().min(0).max(180).optional()
});

/**
 * Create Micro Activity
 */
export const createMicroActivitySchema = z.object({
    topic: topicSchema,
    activityType: z.enum([
        'memory_game',
        'matching',
        'categorization',
        'ordering',
        'sentence_builder',
        'drag_and_drop',
        'fill_in_blanks',
        'multiple_choice',
        'true_false',
        'open_question',
        'highlight',
        'table_completion'
    ]).optional(),
    grade: gradeSchema,
    subject: subjectSchema,
    itemCount: z.number().min(3).max(20).optional(),
    sourceType: z.enum(['topic', 'text', 'file']).optional()
});

// ========== Static Content Schemas ==========

/**
 * Generate Worksheet
 */
export const generateWorksheetSchema = z.object({
    topic: topicSchema,
    grade: gradeSchema,
    questionCount: z.number().min(5).max(30).optional(),
    includeAnswerKey: z.boolean().optional()
});

/**
 * Generate Lesson Plan
 */
export const generateLessonPlanSchema = z.object({
    topic: topicSchema,
    grade: gradeSchema,
    duration: z.number().min(15).max(120).optional(),
    objectives: z.array(z.string()).optional()
});

/**
 * Generate Letter
 */
export const generateLetterSchema = z.object({
    subject: z.string().min(2, 'נושא המכתב חייב להכיל לפחות 2 תווים'),
    letterType: z.enum(['update', 'request', 'invitation', 'summary', 'concern', 'praise']).optional(),
    tone: z.enum(['professional', 'warm', 'formal', 'casual']).optional()
});

/**
 * Generate Feedback
 */
export const generateFeedbackSchema = z.object({
    studentName: z.string().optional(),
    context: z.string().min(2, 'יש לציין הקשר למשוב'),
    strengths: z.array(z.string()).optional(),
    improvements: z.array(z.string()).optional(),
    tone: z.enum(['encouraging', 'constructive', 'formal']).optional()
});

/**
 * Generate Rubric
 */
export const generateRubricSchema = z.object({
    assignmentType: z.string().min(2, 'יש לציין סוג משימה'),
    criteria: z.array(z.string()).optional(),
    levels: z.number().min(3).max(6).optional()
});

/**
 * Generate Printable Test
 */
export const generatePrintableTestSchema = z.object({
    topic: topicSchema,
    grade: gradeSchema,
    questionCount: z.number().min(5).max(50).optional(),
    duration: z.number().min(15).max(180).optional()
});

// ========== Schema Registry ==========

export const capabilitySchemas: Record<string, z.ZodSchema<any>> = {
    // Interactive
    'create_interactive_lesson': createInteractiveLessonSchema,
    'create_interactive_activity': createInteractiveActivitySchema,
    'create_interactive_exam': createInteractiveExamSchema,
    'create_micro_activity': createMicroActivitySchema,
    // Static
    'generate_worksheet': generateWorksheetSchema,
    'generate_lesson_plan': generateLessonPlanSchema,
    'generate_letter': generateLetterSchema,
    'generate_feedback': generateFeedbackSchema,
    'generate_rubric': generateRubricSchema,
    'generate_printable_test': generatePrintableTestSchema
};

// ========== Validation Function ==========

export interface ValidationResult {
    success: boolean;
    data?: any;
    errors?: string[];
}

/**
 * Validate capability parameters
 */
export function validateCapabilityParams(
    capabilityId: string,
    params: Record<string, any>
): ValidationResult {
    const schema = capabilitySchemas[capabilityId];

    if (!schema) {
        console.warn(`[Validation] No schema found for capability: ${capabilityId}`);
        // Return success for unknown capabilities (fallback)
        return { success: true, data: params };
    }

    const result = schema.safeParse(params);

    if (result.success) {
        return {
            success: true,
            data: result.data
        };
    }

    // Extract error messages in Hebrew
    const errors = result.error.errors.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
    });

    return {
        success: false,
        errors
    };
}

/**
 * Get missing required fields for a capability
 */
export function getMissingRequiredFields(
    capabilityId: string,
    params: Record<string, any>
): string[] {
    const schema = capabilitySchemas[capabilityId];
    if (!schema) return [];

    const result = schema.safeParse(params);
    if (result.success) return [];

    // Find fields with "Required" errors
    return result.error.errors
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'));
}
