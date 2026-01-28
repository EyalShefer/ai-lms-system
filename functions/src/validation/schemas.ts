/**
 * Zod Validation Schemas
 *
 * Runtime validation for all incoming payloads and LLM outputs.
 * This provides type safety beyond TypeScript's compile-time checks.
 *
 * Categories:
 * 1. API Request Schemas - Validate incoming Cloud Function requests
 * 2. LLM Output Schemas - Validate and repair AI-generated JSON
 * 3. Domain Schemas - Core business objects
 */

import { z } from 'zod';

// ============================================================
// COMMON SCHEMAS
// ============================================================

export const UUIDSchema = z.string().uuid().or(z.string().min(10).max(50));

export const TimestampSchema = z.union([
  z.string().datetime(),
  z.date(),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() }),
  z.null()
]);

export const GradeLevelSchema = z.enum([
  'א', 'ב', 'ג', 'ד', 'ה', 'ו',
  'ז', 'ח', 'ט', 'י', 'יא', 'יב',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
]).optional();

export const DifficultyLevelSchema = z.enum([
  'הבנה', 'יישום', 'העמקה',
  'basic', 'intermediate', 'advanced',
  'easy', 'medium', 'hard'
]);

export const BloomLevelSchema = z.enum([
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create',
  'זכירה', 'הבנה', 'יישום', 'ניתוח', 'הערכה', 'יצירה'
]);

// ============================================================
// API REQUEST SCHEMAS
// ============================================================

/**
 * Chat completion request schema
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.union([
    z.string(),
    z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
      image_url: z.object({ url: z.string() }).optional()
    }))
  ])
});

export const GeminiChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  options: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(32768).optional(),
    responseFormat: z.object({
      type: z.enum(['json_object', 'text'])
    }).optional()
  }).optional()
});

/**
 * Course generation request schema
 */
export const CourseGenerationRequestSchema = z.object({
  title: z.string().min(1).max(200),
  targetAudience: z.string().min(1).max(500),
  gradeLevel: GradeLevelSchema,
  subject: z.string().optional(),
  mode: z.enum(['learning', 'exam', 'lesson']).optional(),
  activityLength: z.enum(['short', 'medium', 'long']).optional(),
  pdfContent: z.string().max(2000000).optional(), // Max 2MB of text
  moduleCount: z.number().min(1).max(20).optional()
});

/**
 * Activity generation request schema
 */
export const ActivityGenerationRequestSchema = z.object({
  unitId: z.string().min(1),
  courseId: z.string().min(1),
  activityType: z.string().min(1).max(50),
  context: z.object({
    unitTitle: z.string().optional(),
    baseContent: z.string().max(100000).optional(),
    gradeLevel: GradeLevelSchema,
    previousActivities: z.array(z.string()).optional()
  }).optional(),
  count: z.number().min(1).max(10).default(1)
});

/**
 * Exam grading request schema
 */
export const GradingRequestSchema = z.object({
  examId: z.string().min(1),
  answers: z.record(z.string(), z.any()),
  studentId: z.string().min(1)
});

/**
 * User role management request schema
 */
export const SetUserRoleRequestSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'teacher', 'student'])
});

export const GrantPremiumRequestSchema = z.object({
  userId: z.string().min(1)
});

// ============================================================
// LLM OUTPUT SCHEMAS
// ============================================================

/**
 * Activity block schema (from LLM generation)
 */
export const ActivityBlockSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  content: z.any(), // Varies by type
  metadata: z.record(z.string(), z.any()).optional()
}).passthrough(); // Allow additional fields from LLM

/**
 * Learning unit skeleton (from Exam Architect)
 */
export const UnitSkeletonSchema = z.object({
  title: z.string().min(1).max(200),
  goals: z.array(z.string()).optional(),
  activityTypes: z.array(z.string()).optional(),
  estimatedDuration: z.number().optional(),
  difficultyProgression: z.array(DifficultyLevelSchema).optional()
});

/**
 * Course skeleton (from LLM)
 */
export const CourseSkeletonSchema = z.object({
  title: z.string().min(1).max(200),
  modules: z.array(z.object({
    title: z.string().min(1).max(200),
    units: z.array(UnitSkeletonSchema)
  }))
});

/**
 * Grading result schema
 */
export const GradingResultSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  breakdown: z.array(z.object({
    questionId: z.string(),
    score: z.number(),
    feedback: z.string().optional(),
    isCorrect: z.boolean().optional()
  })).optional(),
  suggestions: z.array(z.string()).optional()
});

/**
 * Question schema (from LLM generation)
 */
export const QuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'multiple_choice', 'open_ended', 'true_false', 'fill_blank',
    'matching', 'ordering', 'short_answer'
  ]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.any(),
  explanation: z.string().optional(),
  difficulty: DifficultyLevelSchema.optional(),
  bloomLevel: BloomLevelSchema.optional(),
  points: z.number().optional()
}).passthrough();

/**
 * Variant block schema (adaptive learning)
 */
export const VariantBlockSchema = z.object({
  id: z.string(),
  type: z.string(),
  content: z.any(),
  difficultyLevel: DifficultyLevelSchema.optional(),
  scaffolding: z.object({
    hints: z.array(z.string()).optional(),
    explanation: z.string().optional(),
    simplifiedVersion: z.any().optional()
  }).optional()
}).passthrough();

// ============================================================
// DOMAIN SCHEMAS
// ============================================================

/**
 * User profile schema
 */
export const UserProfileSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  gradeLevel: GradeLevelSchema,
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional()
}).passthrough();

/**
 * Course metadata schema
 */
export const CourseMetadataSchema = z.object({
  id: z.string().min(1),
  teacherId: z.string().min(1),
  title: z.string().min(1).max(200),
  targetAudience: z.string().max(500),
  gradeLevel: GradeLevelSchema,
  subject: z.string().optional(),
  mode: z.enum(['learning', 'exam', 'lesson']).optional(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional()
}).passthrough();

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate and parse data with schema
 * Returns parsed data or throws ZodError
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = context
        ? `Validation failed for ${context}: ${error.message}`
        : `Validation failed: ${error.message}`;
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Safe validate - returns result object instead of throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validate LLM output with repair attempts
 * Tries to fix common LLM JSON issues
 */
export function validateLLMOutput<T>(
  schema: z.ZodSchema<T>,
  rawOutput: string,
  context?: string
): T {
  // 1. Clean up common LLM output issues
  let cleaned = rawOutput
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // 2. Try to extract JSON if wrapped in text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  // 3. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to repair common JSON issues
    cleaned = cleaned
      .replace(/,\s*}/g, '}')  // Trailing commas
      .replace(/,\s*]/g, ']')  // Trailing commas in arrays
      .replace(/'/g, '"')       // Single quotes to double
      .replace(/(\w+):/g, '"$1":'); // Unquoted keys

    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      throw new Error(
        `Failed to parse LLM output as JSON${context ? ` (${context})` : ''}: ` +
        `${String(parseError)}. Raw output: ${rawOutput.substring(0, 200)}...`
      );
    }
  }

  // 4. Validate against schema
  return validateSchema(schema, parsed, context);
}

/**
 * Create a partial schema for update operations
 */
export function createPartialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}
