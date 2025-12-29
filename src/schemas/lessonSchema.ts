import { z } from 'zod';

// --- Zod Schemas for Wizdi LMS Content ---

// 1. Basic Content Types
export const MultipleChoiceContentSchema = z.object({
    question: z.string().min(1, "Question validation failed: Question text is empty"),
    options: z.array(z.string()).min(2, "Must have at least 2 options"),
    correctAnswer: z.string().min(1, "Correct answer must be defined"),
    // Optional: Validation to ensure correctAnswer exists in options (custom refinement below if needed)
}).refine(data => data.options.includes(data.correctAnswer), {
    message: "Correct answer must be one of the provided options",
    path: ["correctAnswer"]
});

export const OpenQuestionContentSchema = z.object({
    question: z.string().min(1),
});

export const OrderingContentSchema = z.object({
    instruction: z.string().min(1),
    correct_order: z.array(z.string()).min(2),
});

export const CategorizationContentSchema = z.object({
    question: z.string().min(1),
    categories: z.array(z.string()).min(2),
    items: z.array(z.object({
        text: z.string(),
        category: z.string()
    })).min(1),
});

// 2. Block Metadata Schema
export const ActivityBlockMetadataSchema = z.object({
    difficultyLevel: z.number().min(1).max(5).optional(),
    bloomLevel: z.enum(['knowledge', 'comprehension', 'application', 'analysis', 'synthesis', 'evaluation']).optional(),
    score: z.number().min(0).max(100).optional(),
    modelAnswer: z.string().optional(),
    feedbackCorrect: z.string().optional(),
    feedbackIncorrect: z.string().optional(),
}).catchall(z.any()); // Allow other optional metadata fields

// 3. Block Schemas
export const ActivityBlockBaseSchema = z.object({
    id: z.string(),
    metadata: ActivityBlockMetadataSchema.optional(),
});

export const MultipleChoiceBlockSchema = ActivityBlockBaseSchema.extend({
    type: z.literal('multiple-choice'),
    content: MultipleChoiceContentSchema,
});

export const OpenQuestionBlockSchema = ActivityBlockBaseSchema.extend({
    type: z.literal('open-question'),
    content: OpenQuestionContentSchema,
});

export const OrderingBlockSchema = ActivityBlockBaseSchema.extend({
    type: z.literal('ordering'),
    content: OrderingContentSchema,
});

export const CategorizationBlockSchema = ActivityBlockBaseSchema.extend({
    type: z.literal('categorization'),
    content: CategorizationContentSchema,
});

// Union of all block types
export const ActivityBlockSchema = z.discriminatedUnion('type', [
    MultipleChoiceBlockSchema,
    OpenQuestionBlockSchema,
    OrderingBlockSchema,
    CategorizationBlockSchema,
    // Add other block schemas here as needed (e.g. MediaBlockSchema)
]);

// 4. Lesson / Unit Schema
export const LearningUnitSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['acquisition', 'practice', 'test']),
    activityBlocks: z.array(ActivityBlockSchema),
});

// Export inferred types if needed
export type LessonSchemaType = z.infer<typeof LearningUnitSchema>;
