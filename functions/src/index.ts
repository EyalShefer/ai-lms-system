import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import { v4 as uuidv4 } from 'uuid';

// 1. אתחול
initializeApp();
const db = getFirestore();
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const MODEL_NAME = "gpt-4o-mini"; // Cost-effective for multi-stage calls

// --- פונקציות עזר ---

const sanitizeData = (data: any): any => {
    return JSON.parse(JSON.stringify(data, (key, value) => {
        return value === undefined ? null : value;
    }));
};

const cleanJsonString = (text: string): string => {
    try {
        let clean = text.replace(/```json|```/g, '').trim();
        const firstBrace = clean.indexOf('{');
        const firstBracket = clean.indexOf('[');
        let startIndex = -1;
        let endIndex = -1;

        if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
            startIndex = firstBracket;
            endIndex = clean.lastIndexOf(']') + 1;
        } else if (firstBrace !== -1) {
            startIndex = firstBrace;
            endIndex = clean.lastIndexOf('}') + 1;
        }

        if (startIndex !== -1 && endIndex !== -1) {
            clean = clean.substring(startIndex, endIndex);
        }
        clean = clean.replace(/}\s*{/g, '}, {');
        return clean;
    } catch (e) {
        logger.error("JSON cleaning failed", e);
        return text;
    }
};

const mapSystemItemToBlock = (item: any) => {
    const commonMetadata = {
        bloomLevel: item.bloom_level,
        feedbackCorrect: item.feedback_correct,
        feedbackIncorrect: item.feedback_incorrect,
        sourceReference: item.source_reference
    };

    if (item.type === 'multiple_choice' || item.type === 'true_false') {
        let options = item.content.options || [];
        // Support for True/False automatically if not provided
        if (item.type === 'true_false' && options.length === 0) {
            options = ["נכון", "לא נכון"];
        }

        let correctAnswer = "";
        if (typeof item.content.correct_index === 'number' && options[item.content.correct_index]) {
            correctAnswer = options[item.content.correct_index];
        } else {
            correctAnswer = options[0] || "";
        }
        return {
            id: uuidv4(),
            type: 'multiple-choice',
            content: { question: item.question_text, options: options, correctAnswer: correctAnswer },
            metadata: { ...commonMetadata, score: 10 }
        };
    }

    if (item.type === 'open_question') {
        return {
            id: uuidv4(),
            type: 'open-question',
            content: { question: item.question_text },
            metadata: {
                ...commonMetadata,
                modelAnswer: item.content.key_points ? item.content.key_points.join('\n') : "תשובה מלאה",
                hint: item.content.hint,
                score: 20
            }
        };
    }

    if (item.type === 'sorting' || item.type === 'sequencing') {
        const isSorting = item.type === 'sorting';
        return {
            id: uuidv4(),
            type: 'multiple-choice', // Simplified mapping for now as per original code
            content: {
                question: item.question_text + (isSorting ? " (בחר את ההתאמה הנכונה)" : " (בחר את הסדר הנכון)"),
                options: isSorting
                    ? ["התאמה נכונה של הפריטים לקטגוריות", "התאמה שגויה", "התאמה חלקית", "אף תשובה אינה נכונה"]
                    : ["הסדר הנכון כפי שנלמד", "סדר הפוך", "סדר אקראי א", "סדר אקראי ב"],
                correctAnswer: isSorting ? "התאמה נכונה של הפריטים לקטגוריות" : "הסדר הנכון כפי שנלמד"
            },
            metadata: { ...commonMetadata, note: "הומר אוטומטית משאלת מיון/רצף" }
        };
    }

    return null;
};

// --- Agentic Workflow Stages ---

// Stage 1: The Architect (Planner)
async function runArchitectStage(openai: OpenAI, context: { topic: string, gradeLevel: string, subject: string, fileData: any }): Promise<string> {
    const systemPrompt = `
    Role: Pedagogical Architect.
    Task: Analyze the topic/content and create a "Pedagogical Blueprint" for accurate content generation.
    Target Audience: ${context.gradeLevel}.
    Subject: ${context.subject}.
    Language: Hebrew.
    
    Output structured text containing:
    1. Key Learning Objectives (suitable for age).
    2. Core Concepts (3-5 main points).
    3. Potential Misconceptions to avoid.
    4. Appropriate Vocabulary Level guidelines.
    `;

    const userContent: any[] = [{ type: "text", text: `Build a blueprint for topic: ${context.topic}` }];

    if (context.fileData) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${context.fileData.mimeType};base64,${context.fileData.base64}` }
        });
    }

    const response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent as any }
        ],
        temperature: 0.7
    });

    return response.choices[0].message.content || "No blueprint generated.";
}

// Stage 2: The Generator (Drafter)
async function runGeneratorStage(openai: OpenAI, blueprint: string, context: { topic: string, gradeLevel: string, activityLength: string, taxonomy?: any }): Promise<any[]> {
    let questionCountStr = "6-8";
    if (context.activityLength === 'short') questionCountStr = "3-4";
    if (context.activityLength === 'long') questionCountStr = "12-14";

    let taxonomyInstructions = "";
    if (context.taxonomy) {
        taxonomyInstructions = `
        Bloom's Taxonomy Distribution REQUIRED:
        - Knowledge/Understanding: ${context.taxonomy.knowledge}% (Direct retrieval, definitions)
        - Application/Analysis: ${context.taxonomy.application}% (Problem solving, comparison)
        - Evaluation/Creation: ${context.taxonomy.evaluation}% (Judgment, synthesis, open-ended)
        
        STRICTLY ADHERE to this distribution.
        `;
    }

    const systemPrompt = `
    Role: Content Generator.
    Input: Pedagogical Blueprint.
    Task: Create a draft JSON of exactly ${questionCountStr} learning items.
    ${taxonomyInstructions}
    
    CRITICAL INSTRUCTIONS:
    1. NEVER use placeholders like "Option 1", "Answer A", or "Student Answer". ALL content must be real, educational, and fully written out in Hebrew.
    2. For Multiple Choice: Provide 4 DISTINCT, PLAUSIBLE options. One correct, three distractors.
    3. For Open Questions: 'key_points' MUST be a detailed model answer (at least 3 sentences) for the teacher to check against.
    4. 'internal_reasoning': Explain WHY the correct answer is right and why the distractors are wrong but plausible.

    Output: VALID JSON Array Only.
    Schema per item:
    {
       "internal_reasoning": "REQUIRED: Explain pedagogical logic...",
       "bloom_level": "Knowledge" | "Understanding" | "Analysis",
       "type": "multiple_choice" | "true_false" | "open_question" | "sorting" | "sequencing",
       "question_text": "Hebrew question",
       "source_reference": "Reference",
       "feedback_correct": "Detailed positive feedback explaining why it's correct",
       "feedback_incorrect": "Educational hint pointing to the right concepts",
       "content": {
           "options": ["Real Option 1", "Real Option 2", "Real Option 3", "Real Option 4"], 
           "correct_index": 0, 
           "hint": "Hebrew hint",
           "key_points": ["Detailed point 1...", "Detailed point 2..."]
       }
    }
    Generate exactly ${questionCountStr} items.
    `;

    const response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Blueprint:\n${blueprint}\n\nCreate the quiz now. REMEMBER: NO PLACEHOLDERS.` }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
    });

    const text = response.choices[0].message.content || "[]";
    try {
        const parsed = JSON.parse(text);
        // Handle wrapped responses like { "items": [...] }
        return Array.isArray(parsed) ? parsed : (Object.values(parsed)[0] as any[] || []);
    } catch (e) {
        return JSON.parse(cleanJsonString(text)) || [];
    }
}

// Stage 3: The Critic (Refiner)
async function runCriticStage(openai: OpenAI, draftItems: any[], context: { gradeLevel: string }): Promise<any[]> {
    const systemPrompt = `
    Role: Content Critic & Refiner.
    Task: Review the draft items and fix ANY quality issues.
    
    CHECKLIST:
    1. PLACEHOLDER CHECK: If you see "Option 1", "Option A", or vague answers -> REWRITE them immediately with real content.
    2. DEPTH: If 'feedback' or 'modelAnswer' is too short -> EXPAND it.
    3. VOCABULARY: Adjust Hebrew to match grade level: ${context.gradeLevel}.
    4. STRIP: Remove 'internal_reasoning' field from the output.
    
    Output: VALID JSON Array of the final items. Same schema, minus 'internal_reasoning'.
    `;

    const response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(draftItems) }
        ],
        temperature: 0.5, // Lower temp for precision
        response_format: { type: "json_object" }
    });

    const text = response.choices[0].message.content || "[]";
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : (Object.values(parsed)[0] as any[] || []);
    } catch (e) {
        return JSON.parse(cleanJsonString(text)) || [];
    }
}

// --- Cloud Function ---

export const generateLessonPlan = onDocumentCreated(
    {
        document: "course_generation_queue/{docId}",
        secrets: [openAiApiKey],
        timeoutSeconds: 540, // Increased timeout for 3 stages
        memory: "512MiB",
    },
    async (event) => {
        if (!event.data) return;

        const docId = event.params.docId;
        const data = event.data.data() as any;

        if (!data || data.status !== "pending") return;

        try {
            logger.info(`Starting 3-Stage generation for document ${docId}`);
            await event.data.ref.update({ status: "processing" });

            const openai = new OpenAI({ apiKey: openAiApiKey.value() });
            const { topic, gradeLevel, subject = "כללי", fileData, activityLength = "medium", taxonomy, includeBot = true } = data;
            const unitTitle = topic || "פעילות למידה";

            // --- EXECUTE STAGES ---

            // 1. Architect
            logger.info("Stage 1: Architect running...");
            const blueprint = await runArchitectStage(openai, { topic, gradeLevel, subject, fileData });

            // 2. Generator
            logger.info("Stage 2: Generator running...", { taxonomy }); // Log taxonomy for debugging
            const draftItems = await runGeneratorStage(openai, blueprint, { topic, gradeLevel, activityLength, taxonomy });

            // 3. Critic
            logger.info("Stage 3: Critic running...");
            const finalItems = await runCriticStage(openai, draftItems, { gradeLevel });

            logger.info(`Generation complete. Processed ${finalItems.length} items.`);

            // --- BUILDING FINAL DOCUMENT ---

            const blocks: any[] = [];

            // Add Introduction Block (Standard)
            blocks.push({
                id: uuidv4(),
                type: 'text',
                content: `### ברוכים הבאים לשיעור ב${subject}\n**נושא:** ${unitTitle}\nמותאם עבור ${gradeLevel}.\n\n*מטרות השיעור (מתוך הארכיטקט):*\n${blueprint.substring(0, 300)}...`, // Preview of architect's thought
                metadata: {}
            });

            // Add Teacher Bot (Standard)
            // Add Teacher Bot (Optional)
            if (includeBot) {
                blocks.push({
                    id: uuidv4(),
                    type: 'interactive-chat',
                    content: { title: "המורה הוירטואלי", description: `עזרה בנושאי ${subject}` },
                    metadata: {
                        botPersona: 'teacher',
                        initialMessage: `שלום! אני המורה ל${subject}. איך אפשר לעזור בנושא ${unitTitle}?`,
                        systemPrompt: `אתה מורה ל${subject} בכיתה ${gradeLevel}. ענה בעברית רק בהקשר ל${topic}.`
                    }
                });
            }

            // Add Generated Questions
            if (Array.isArray(finalItems)) {
                finalItems.forEach((item: any) => {
                    const block = mapSystemItemToBlock(item);
                    if (block) blocks.push(block);
                });
            }

            if (finalItems.length === 0) {
                throw new Error("Generated content is empty. Please try again.");
            }

            const finalPlan = [
                {
                    id: uuidv4(),
                    title: "פעילות",
                    learningUnits: [
                        {
                            id: uuidv4(),
                            title: topic || "פעילות למידה",
                            type: 'practice',
                            activityBlocks: blocks
                        }
                    ]
                }
            ];

            const cleanFinalPlan = sanitizeData(finalPlan);

            await event.data.ref.update({
                status: "completed",
                result: cleanFinalPlan,
                updatedAt: new Date(),
            });

            logger.info(`Successfully generated lesson for ${docId}`);

        } catch (error: any) {
            logger.error("Error generating lesson:", error);
            await event.data.ref.update({
                status: "error",
                error: error.message || "Unknown error occurred",
            });
        }
    }
);
