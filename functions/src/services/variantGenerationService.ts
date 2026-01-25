/**
 * Variant Generation Service
 *
 * Server-side service for generating adaptive content variants.
 * Uses Bloom-aware strategy to minimize API calls.
 *
 * Created: 2026-01-25
 */

import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";

const db = getFirestore();

// Types
export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
export type VariantType = 'הבנה' | 'העמקה';

export interface ActivityBlock {
    id: string;
    type: string;
    content: any;
    metadata?: {
        bloom_taxonomy?: BloomLevel;
        difficulty_level?: number;
        [key: string]: any;
    };
}

export interface VariantDecision {
    generateHavana: boolean;  // הבנה - easier variant
    generateHaamaka: boolean; // העמקה - harder variant
}

export interface VariantGenerationStats {
    totalBlocks: number;
    processed: number;
    failed: number;
    skippedByBloom: number;
    cachedHits: number;
}

// Configuration
const CACHE_COLLECTION = 'variants_cache';
const DEFAULT_TTL_DAYS = 90;

const QUESTION_TYPES = [
    'multiple-choice',
    'open-question',
    'fill_in_blanks',
    'ordering',
    'categorization',
    'matching',
    'true_false_speed',
    'memory_game'
];

// ========================================
// BLOOM-AWARE DECISION LOGIC
// ========================================

/**
 * Determines which variants are needed based on Bloom taxonomy level.
 *
 * Strategy:
 * - Lower levels (Remember/Understand): Only generate harder variant (העמקה)
 *   Rationale: These are already easy, no need for easier variant
 *
 * - Middle levels (Apply/Analyze): Generate both variants
 *   Rationale: Students may need easier or harder based on performance
 *
 * - Higher levels (Evaluate/Create): Only generate easier variant (הבנה)
 *   Rationale: These are already hard, no need for harder variant
 *
 * - Unknown: Generate both (safe fallback)
 */
export function determineVariantsNeeded(bloomLevel?: BloomLevel): VariantDecision {
    if (!bloomLevel) {
        logger.warn('Block missing bloom_taxonomy, generating both variants');
        return { generateHavana: true, generateHaamaka: true };
    }

    const lowerLevels: BloomLevel[] = ['Remember', 'Understand'];
    const middleLevels: BloomLevel[] = ['Apply', 'Analyze'];
    const higherLevels: BloomLevel[] = ['Evaluate', 'Create'];

    if (lowerLevels.includes(bloomLevel)) {
        // Easy content -> only generate harder variant
        return { generateHavana: false, generateHaamaka: true };
    }

    if (middleLevels.includes(bloomLevel)) {
        // Middle content -> generate both
        return { generateHavana: true, generateHaamaka: true };
    }

    if (higherLevels.includes(bloomLevel)) {
        // Hard content -> only generate easier variant
        return { generateHavana: true, generateHaamaka: false };
    }

    // Fallback
    return { generateHavana: true, generateHaamaka: true };
}

// ========================================
// CACHE OPERATIONS
// ========================================

/**
 * Checks if a variant already exists in cache and is valid.
 */
export async function checkVariantCache(
    blockId: string,
    variantType: VariantType
): Promise<{ exists: boolean; isValid: boolean }> {
    try {
        const cacheId = `${blockId}_${variantType}`;
        const cacheDoc = await db.doc(`${CACHE_COLLECTION}/${cacheId}`).get();

        if (!cacheDoc.exists) {
            return { exists: false, isValid: false };
        }

        const data = cacheDoc.data();
        if (!data) {
            return { exists: false, isValid: false };
        }

        // Check TTL
        const expiresAt = data.expiresAt?.toDate();
        if (expiresAt && expiresAt < new Date()) {
            return { exists: true, isValid: false };
        }

        return { exists: true, isValid: true };

    } catch (error) {
        logger.error('Error checking cache:', error);
        return { exists: false, isValid: false };
    }
}

/**
 * Saves a generated variant to cache.
 */
export async function saveVariantToCache(
    blockId: string,
    variantType: VariantType,
    content: ActivityBlock,
    topic: string
): Promise<void> {
    const cacheId = `${blockId}_${variantType}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_TTL_DAYS);

    await db.doc(`${CACHE_COLLECTION}/${cacheId}`).set({
        blockId,
        variantType,
        content,
        topic,
        generatedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        metadata: {
            generationMethod: 'progressive',
            version: '2.0.0'
        }
    });

    logger.info(`Cached ${variantType} variant for block ${blockId}`);
}

// ========================================
// VARIANT GENERATION
// ========================================

/**
 * Generates a הבנה (easier) variant of a question block.
 */
export async function generateHavanaVariant(
    openai: OpenAI,
    block: ActivityBlock,
    topic: string
): Promise<ActivityBlock | null> {
    const blockJson = JSON.stringify(block.content, null, 2);

    const prompt = `
    You are an expert Instructional Designer specializing in scaffolded learning.

    TASK: Create an EASIER variant of this question for struggling students.

    TOPIC: ${topic}
    ORIGINAL QUESTION TYPE: ${block.type}
    ORIGINAL CONTENT:
    ${blockJson}

    SCAFFOLDING STRATEGIES TO USE:
    1. Simplify the language (shorter sentences, simpler vocabulary)
    2. Add a concrete example or worked problem before the question
    3. For multiple-choice: Make wrong answers more obviously wrong
    4. Add 2-3 progressive hints that guide without giving away the answer
    5. Break down complex questions into smaller steps

    CRITICAL: Output MUST match the EXACT same content structure as the input.
    The type "${block.type}" requires specific content fields.

    OUTPUT JSON FORMAT:
    {
        "scaffolded_content": { ... same structure as original content, but easier ... },
        "progressive_hints": ["First hint (very subtle)", "Second hint (more direct)", "Third hint (almost gives it away)"],
        "pre_context": "A short example or explanation shown before the question (optional, max 50 words)"
    }

    Important: Keep the question type the same. If it's multiple-choice, keep 4 options.
    Write in Hebrew if the original was in Hebrew.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.5
        });

        const text = completion.choices[0].message.content || "{}";
        const result = JSON.parse(text);

        if (!result.scaffolded_content) {
            logger.warn("Scaffolding generation returned empty content");
            return null;
        }

        const havanaBlock: ActivityBlock = {
            id: `${block.id}_הבנה`,
            type: block.type,
            content: result.scaffolded_content,
            metadata: {
                ...block.metadata,
                isVariant: true,
                variantType: 'הבנה',
                originalBlockId: block.id,
                progressiveHints: result.progressive_hints || [],
                preContext: result.pre_context,
                difficulty_level: Math.max(0, (block.metadata?.difficulty_level || 0.5) - 0.2)
            }
        };

        return havanaBlock;

    } catch (error) {
        logger.error("הבנה generation failed:", error);
        return null;
    }
}

/**
 * Generates a העמקה (harder) variant of a question block.
 */
export async function generateHaamakaVariant(
    openai: OpenAI,
    block: ActivityBlock,
    topic: string
): Promise<ActivityBlock | null> {
    const blockJson = JSON.stringify(block.content, null, 2);

    const prompt = `
    You are an expert Instructional Designer specializing in challenge-based learning.

    TASK: Create a HARDER variant of this question for advanced students.

    TOPIC: ${topic}
    ORIGINAL QUESTION TYPE: ${block.type}
    ORIGINAL CONTENT:
    ${blockJson}

    ENRICHMENT STRATEGIES TO USE:
    1. Increase cognitive complexity (move up Bloom's taxonomy)
    2. Add real-world application or transfer questions
    3. For multiple-choice: Make distractors more plausible, require deeper analysis
    4. Add "why" or "how" elements to straightforward questions
    5. Connect to related advanced concepts

    CRITICAL: Output MUST match the EXACT same content structure as the input.
    The type "${block.type}" requires specific content fields.

    OUTPUT JSON FORMAT:
    {
        "enriched_content": { ... same structure as original content, but harder ... },
        "extension_question": "An optional follow-up challenge question",
        "connection_note": "Brief note on how this connects to advanced topics (optional)"
    }

    Important: Keep the question type the same. If it's multiple-choice, keep 4 options.
    Write in Hebrew if the original was in Hebrew.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.6
        });

        const text = completion.choices[0].message.content || "{}";
        const result = JSON.parse(text);

        if (!result.enriched_content) {
            logger.warn("Enrichment generation returned empty content");
            return null;
        }

        const haamakaBlock: ActivityBlock = {
            id: `${block.id}_העמקה`,
            type: block.type,
            content: result.enriched_content,
            metadata: {
                ...block.metadata,
                isVariant: true,
                variantType: 'העמקה',
                originalBlockId: block.id,
                extensionQuestion: result.extension_question,
                connectionNote: result.connection_note,
                bloom_taxonomy: 'Analyze',
                difficulty_level: Math.min(1, (block.metadata?.difficulty_level || 0.5) + 0.2)
            }
        };

        return haamakaBlock;

    } catch (error) {
        logger.error("העמקה generation failed:", error);
        return null;
    }
}

// ========================================
// MAIN PROCESSING FUNCTIONS
// ========================================

/**
 * Extracts all question blocks from a course syllabus.
 */
export function extractQuestionBlocks(syllabus: any[]): ActivityBlock[] {
    const blocks: ActivityBlock[] = [];

    for (const module of syllabus || []) {
        for (const unit of module.learningUnits || []) {
            for (const block of unit.activityBlocks || []) {
                if (QUESTION_TYPES.includes(block.type)) {
                    blocks.push(block);
                }
            }
        }
    }

    return blocks;
}

/**
 * Processes a single block - generates needed variants based on Bloom level.
 */
export async function processBlockVariants(
    openai: OpenAI,
    block: ActivityBlock,
    topic: string,
    stats: VariantGenerationStats
): Promise<void> {
    const bloomLevel = block.metadata?.bloom_taxonomy as BloomLevel | undefined;
    const decision = determineVariantsNeeded(bloomLevel);

    const promises: Promise<void>[] = [];

    // Generate הבנה if needed
    if (decision.generateHavana) {
        promises.push(
            (async () => {
                const cacheStatus = await checkVariantCache(block.id, 'הבנה');
                if (cacheStatus.isValid) {
                    stats.cachedHits++;
                    logger.info(`Cache hit for ${block.id}_הבנה`);
                    return;
                }

                const variant = await generateHavanaVariant(openai, block, topic);
                if (variant) {
                    await saveVariantToCache(block.id, 'הבנה', variant, topic);
                    stats.processed++;
                } else {
                    stats.failed++;
                }
            })()
        );
    } else {
        stats.skippedByBloom++;
    }

    // Generate העמקה if needed
    if (decision.generateHaamaka) {
        promises.push(
            (async () => {
                const cacheStatus = await checkVariantCache(block.id, 'העמקה');
                if (cacheStatus.isValid) {
                    stats.cachedHits++;
                    logger.info(`Cache hit for ${block.id}_העמקה`);
                    return;
                }

                const variant = await generateHaamakaVariant(openai, block, topic);
                if (variant) {
                    await saveVariantToCache(block.id, 'העמקה', variant, topic);
                    stats.processed++;
                } else {
                    stats.failed++;
                }
            })()
        );
    } else {
        stats.skippedByBloom++;
    }

    await Promise.all(promises);
}

/**
 * Main entry point: Process all variants for a course.
 */
export async function generateVariantsForCourse(
    openai: OpenAI,
    courseId: string,
    topic: string
): Promise<VariantGenerationStats> {
    const stats: VariantGenerationStats = {
        totalBlocks: 0,
        processed: 0,
        failed: 0,
        skippedByBloom: 0,
        cachedHits: 0
    };

    // 1. Fetch course
    const courseDoc = await db.doc(`courses/${courseId}`).get();
    if (!courseDoc.exists) {
        logger.error(`Course ${courseId} not found`);
        return stats;
    }

    const course = courseDoc.data();
    if (!course?.syllabus) {
        logger.warn(`Course ${courseId} has no syllabus`);
        return stats;
    }

    // 2. Extract question blocks
    const blocks = extractQuestionBlocks(course.syllabus);
    stats.totalBlocks = blocks.length;

    logger.info(`Processing ${blocks.length} blocks for course ${courseId}`);

    // 3. Process in parallel (with concurrency limit)
    const BATCH_SIZE = 5; // Process 5 blocks at a time
    for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
        const batch = blocks.slice(i, i + BATCH_SIZE);
        await Promise.all(
            batch.map(block => processBlockVariants(openai, block, topic, stats))
        );
    }

    logger.info(`Completed variant generation for course ${courseId}:`, stats);
    return stats;
}
