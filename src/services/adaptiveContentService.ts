
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

/**
 * Batch enrich all blocks in a unit.
 */
export const enrichUnitBlocks = async (blocks: ActivityBlock[], topic: string): Promise<ActivityBlock[]> => {
    // Run in parallel but limit concurrency if needed (for now Promise.all is fine for small units)
    const promises = blocks.map(b => enrichActivityBlock(b, topic));
    return Promise.all(promises);
};

import { v4 as uuidv4 } from 'uuid';

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
