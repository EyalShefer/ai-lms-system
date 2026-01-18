
import type { ActivityBlock } from '../shared/types/courseTypes';
import { openai, MODEL_NAME } from './ai'; // Updated import

/**
 * Service to enrich "Dumb" content blocks with "Smart" pedagogical metadata.
 * This corresponds to Phase 1 of the ADLS implementation.
 */

export interface EnrichedMetadata {
    difficulty_level: number; // 0.0 - 1.0
    bloom_taxonomy: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
    estimated_time_sec?: number;
    // For MC/Closed questions
    distractor_analysis?: {
        option_text: string;
        error_tag: string; // e.g., 'calculation_error', 'misconception'
        feedback?: string;
    }[];
}

/**
 * Enriches a single ActivityBlock with pedagogical metadata using GenAI.
 * @param block The source block (must have content)
 * @param topic Context topic
 */
export const enrichActivityBlock = async (block: ActivityBlock, topic: string = "General"): Promise<ActivityBlock> => {
    // 1. Prepare Prompt
    const blockJson = JSON.stringify(block.content, null, 2);

    const prompt = `
    You are an expert Pedagogical Data Scientist.
    TASK: Analyze this Learning Item and generate "Adaptive Metadata".
    
    CONTEXT TOPIC: ${topic}
    ITEM TYPE: ${block.type}
    ITEM CONTENT:
    ${blockJson}

    REQUIREMENTS:
    1. **Difficulty Index (IRT Beta):** Estimate probability of failure (0.0 = Trivial, 1.0 = Impossible).
    2. **Bloom Taxonomy:** Classify the cognitive load.
    3. **Error Tagging:** 
       - If this is a Multiple Choice / True-False question, analyze the WRONG answers (distractors).
       - Assign a specific 'error_tag' concept to each wrong answer (e.g., "sign_error", "phonetic_confusion").
       - If distractors are missing or generic, invent tags based on potential student errors.

    OUTPUT JSON FORMAT:
    {
        "difficulty_level": 0.5,
        "bloom_taxonomy": "Apply",
        "estimated_time_sec": 45,
        "distractors_analysis": [
             { "option_text": "Option A", "error_tag": "calculation_error", "feedback": "Did you forget to carry the 1?" }
        ]
    }
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.3 // Low temp for analytical consistency
        });

        const text = completion.choices[0].message.content || "{}";
        const analysis = JSON.parse(text) as EnrichedMetadata;

        // 2. Merge Metadata
        const updatedBlock: ActivityBlock = {
            ...block,
            metadata: {
                ...block.metadata,
                // Merge new AI insights
                difficulty_level: analysis.difficulty_level,
                bloom_taxonomy: analysis.bloom_taxonomy,
                estimated_time_sec: analysis.estimated_time_sec,
                adaptive_analysis: analysis // Store full analysis
            }
        };

        // If specific error tags were found for MC, we could potentially inject them into the richOptions 
        // if we decide to change the schema structure, but for now storing in metadata is safer.

        return updatedBlock;

    } catch (e) {
        console.error("Enrichment Failed:", e);
        return block; // Fail safe, return original
    }
};

import { v4 as uuidv4 } from 'uuid';

/**
 * Content Variants System
 *
 * Generates three difficulty variants for question blocks:
 * - הבנה (Understanding) - easier variant for struggling students
 * - יישום (Application) - standard level (original)
 * - העמקה (Deepening) - harder variant for advanced students
 *
 * These are pre-generated during content creation and stored for adaptive delivery.
 */

export interface ContentVariants {
    הבנה?: ActivityBlock;    // Easier variant with hints, simpler options (Understanding)
    העמקה?: ActivityBlock;   // Harder variant with extension challenges (Deepening)
}

/**
 * Generates a הבנה (Understanding/easier) variant of a question block.
 * - Adds more hints
 * - Simplifies language
 * - Provides worked examples
 */
export const generateHavanaVariant = async (
    block: ActivityBlock,
    topic: string
): Promise<ActivityBlock | null> => {
    if (!['multiple-choice', 'open-question', 'fill_in_blanks', 'ordering'].includes(block.type)) {
        return null; // Only for question types
    }

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
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.5
        });

        const text = completion.choices[0].message.content || "{}";
        const result = JSON.parse(text);

        if (!result.scaffolded_content) {
            console.warn("Scaffolding generation returned empty content");
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

    } catch (e) {
        console.error("הבנה Gen Failed:", e);
        return null;
    }
};

/**
 * Generates a העמקה (Deepening/harder) variant of a question block.
 * - Adds complexity
 * - Requires deeper thinking
 * - Extends to related concepts
 */
export const generateHaamakaVariant = async (
    block: ActivityBlock,
    topic: string
): Promise<ActivityBlock | null> => {
    if (!['multiple-choice', 'open-question', 'fill_in_blanks', 'ordering'].includes(block.type)) {
        return null;
    }

    const blockJson = JSON.stringify(block.content, null, 2);

    const prompt = `
    You are an expert Instructional Designer specializing in gifted education.

    TASK: Create a MORE CHALLENGING variant of this question for advanced students.

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
        "extension_question": "An optional follow-up challenge question for those who want more",
        "connection_note": "Brief note on how this connects to more advanced topics"
    }

    Important: Keep the question type the same. If it's multiple-choice, keep 4 options.
    Write in Hebrew if the original was in Hebrew.
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.6
        });

        const text = completion.choices[0].message.content || "{}";
        const result = JSON.parse(text);

        if (!result.enriched_content) {
            console.warn("Enrichment generation returned empty content");
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
                difficulty_level: Math.min(1, (block.metadata?.difficulty_level || 0.5) + 0.2),
                bloom_taxonomy: 'Analyze' // העמקה typically requires higher-order thinking
            }
        };

        return haamakaBlock;

    } catch (e) {
        console.error("העמקה Gen Failed:", e);
        return null;
    }
};

/**
 * Generates both הבנה and העמקה variants for a block.
 * Returns the variants to be stored in metadata for adaptive selection.
 */
export const generateContentVariants = async (
    block: ActivityBlock,
    topic: string
): Promise<ContentVariants> => {
    // Run both in parallel for efficiency
    const [הבנה, העמקה] = await Promise.all([
        generateHavanaVariant(block, topic),
        generateHaamakaVariant(block, topic)
    ]);

    return { הבנה, העמקה };
};

/**
 * Enriches a block AND generates its variants in one pass.
 * Call this during content creation to pre-generate adaptive versions.
 */
export const enrichBlockWithVariants = async (
    block: ActivityBlock,
    topic: string
): Promise<ActivityBlock> => {
    // First enrich the base block (יישום level)
    const enrichedBlock = await enrichActivityBlock(block, topic);

    // Then generate variants (הבנה and העמקה)
    const variants = await generateContentVariants(enrichedBlock, topic);

    // Store variant IDs AND the full variant content in metadata for retrieval
    // This ensures we can deliver the correct variant at runtime
    return {
        ...enrichedBlock,
        metadata: {
            ...enrichedBlock.metadata,
            הבנה_id: variants.הבנה?.id,
            העמקה_id: variants.העמקה?.id,
            has_variants: !!(variants.הבנה || variants.העמקה),
            // Store the full variant blocks for runtime selection
            הבנה_variant: variants.הבנה || null,
            העמקה_variant: variants.העמקה || null
        }
    };
};

/**
 * Selects the appropriate variant based on student state.
 * Called by the adaptive policy when delivering content.
 * - הבנה (Understanding) for struggling students
 * - יישום (Application) for standard students (original block)
 * - העמקה (Deepening) for advanced students
 */
export const selectBlockVariant = (
    originalBlock: ActivityBlock,
    variants: ContentVariants,
    studentMastery: number,
    recentAccuracy: number
): ActivityBlock => {
    // Use הבנה for struggling students
    if (studentMastery < 0.4 && recentAccuracy < 0.5 && variants.הבנה) {
        console.log(`📚 Selecting הבנה variant for block ${originalBlock.id}`);
        return variants.הבנה;
    }

    // Use העמקה for excelling students
    if (studentMastery > 0.8 && recentAccuracy > 0.9 && variants.העמקה) {
        console.log(`🚀 Selecting העמקה variant for block ${originalBlock.id}`);
        return variants.העמקה;
    }

    // Default to original (יישום)
    return originalBlock;
};

/**
 * Generates a "Bridge" content block to fix a specific misconception.
 * Triggered when BKT detects failure/remediation need.
 */
export const generateRemedialBlock = async (failedBlock: ActivityBlock, topic: string, wrongAnswer?: string): Promise<ActivityBlock | null> => {
    const blockJson = JSON.stringify(failedBlock.content, null, 2);
    const errorContext = wrongAnswer ? `User chose WRONG answer: "${wrongAnswer}"` : "User failed this task.";

    const prompt = `
    You are an expert AI Tutor (Remediation Specialist).
    A student FAILED the following learning item.
    
    TOPIC: ${topic}
    ORIGINAL ITEM:
    ${blockJson}

    FAILURE CONTEXT: ${errorContext}

    MISSION:
    1. Identify the likely misconception causing this error.
    2. Create a "Bridge" explanation block (Text) that clarifies this SPECIFIC concept.
    3. Use an encouraging, non-judgmental tone.
    4. Keep it concise (under 80 words).
    5. Use analogies if helpful.

    OUTPUT JSON:
    {
       "remedial_text": "Here is why... (Explanation)... Remember that..."
    }
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.5
        });

        const text = completion.choices[0].message.content || "{}";
        const result = JSON.parse(text);

        return {
            id: uuidv4(),
            type: 'text',
            content: `### 💡 בואו נדייק את זה\n\n${result.remedial_text || "בוא נחזור שניה על החומר..."}`,
            metadata: {
                isRemediation: true,
                relatedToBlockId: failedBlock.id,
                bloom_taxonomy: 'Understand'
            }
        };

    } catch (e) {
        console.error("Remediation Gen Failed", e);
        return null;
    }
};
