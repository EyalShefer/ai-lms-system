import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https"; // Added for Proxy
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

// --- TYPES ---
interface StepInfo {
    step_number: number;
    title: string;
    narrative_focus: string;
    forbidden_topics: string[];
    bloom_level: string;
    suggested_interaction_type: string;
}

interface UnitSkeleton {
    unit_title: string;
    steps: StepInfo[];
}

// --- PROXY FUNCTION (Production Fix) ---
export const openaiProxy = onRequest({ secrets: [openAiApiKey], cors: true }, async (req, res) => {
    // 1. Validate Method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const apiKey = openAiApiKey.value();
        // 2. Extract Path (e.g., /chat/completions)
        // req.path will include the full path from the rewrite. 
        // If local rewrite is /api/openai -> proxy, we need to extract the OpenAI endpoint.
        // Assuming rewrite sends /api/openai/v1/chat/completions -> proxy/v1/chat/completions
        const endpoint = req.path.replace('/api/openai', '');

        const url = `https://api.openai.com/v1${endpoint}`;

        logger.info(`Proxying request to: ${url}`);

        // 3. Forward Request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(req.body)
        });

        // 4. Handle Response
        if (!response.ok) {
            const errorText = await response.text();
            logger.error(`OpenAI Error (${response.status}):`, errorText);
            res.status(response.status).send(errorText);
            return;
        }

        const data = await response.json();
        res.json(data);

    } catch (error: any) {
        logger.error("Proxy Internal Error:", error);
        res.status(500).send({ error: error.message });
    }
});

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
    if (!item) return null;

    // 1. ROBUST DATA NORMALIZATION
    // Handle different AI nesting styles (Direct object vs 'data' wrapper vs 'interactive_question' wrapper)
    const rawData: any = (item.data?.data || item.data || item.interactive_question || item);

    // Extract Type
    // Keep as string for loose matching against AI outputs (which might use underscores)
    const typeString = item.selected_interaction || item.type || rawData.type || 'multiple_choice';

    // Extract Question Text (Handle all known variations - Check Root AND Data)
    const questionObj = rawData.question || item.question;
    const questionText =
        (typeof questionObj === 'object' ? questionObj?.text : questionObj) || // Handle { question: { text: "..." } }
        rawData.question_text ||
        rawData.text ||
        rawData.instruction ||
        rawData.text ||
        rawData.instruction;

    const commonMetadata = {
        bloomLevel: item.bloom_level || "General",
        feedbackCorrect: rawData.feedback_correct || rawData.feedback || "תשובה נכונה!",
        feedbackIncorrect: rawData.feedback_incorrect || "נסו שוב.",
        sourceReference: rawData.source_reference || rawData.source_reference_hint || null
    };

    // === CASE A: MULTIPLE CHOICE / TRUE-FALSE ===
    if (typeString === 'multiple_choice' || typeString === 'multiple-choice' || typeString === 'true_false' || typeString === 'teach_then_ask') {
        let options: any[] = [];
        if (Array.isArray(rawData.options)) options = rawData.options;
        else if (Array.isArray(item.options)) options = item.options;
        else if (Array.isArray(rawData.choices)) options = rawData.choices;
        else if (Array.isArray(rawData.answers)) options = rawData.answers;

        // Normalize Options to Strings for Content
        const normalizedOptions: string[] = options.map((o) =>
            typeof o === 'string' ? o : (o.text || o.label || "")
        );

        // Fallback if empty options
        if (normalizedOptions.length < 2) {
            if (typeString === 'true_false') {
                normalizedOptions.push("נכון", "לא נכון");
            } else {
                return null;
            }
        }

        let correctAnswer = "";
        // 1. Check for "is_correct" flag in rich objects
        const correctOptObj = options.find((o) => typeof o === 'object' && (o.is_correct || o.isCorrect === true));
        if (correctOptObj) {
            correctAnswer = correctOptObj.text || correctOptObj.label || "";
        }
        // 2. Check for explicit correct answer string
        else if (rawData.correct_answer && typeof rawData.correct_answer === 'string') {
            correctAnswer = rawData.correct_answer;
        }
        // 3. Check for correct index
        else if (rawData.correct_index !== undefined && normalizedOptions[rawData.correct_index]) {
            correctAnswer = normalizedOptions[rawData.correct_index];
        }
        // 4. Fallback to first option
        else {
            correctAnswer = normalizedOptions[0];
        }

        const finalType = typeString === 'true_false' ? 'multiple-choice' : 'multiple-choice';

        return {
            id: uuidv4(),
            type: finalType,
            content: {
                question: questionText || "שאלה",
                options: normalizedOptions,
                correctAnswer: correctAnswer
            },
            metadata: {
                ...commonMetadata,
                score: 10,
                progressiveHints: rawData.progressive_hints || [],
                richOptions: options.some(o => typeof o === 'object') ? options : undefined
            }
        };
    }

    // === CASE B: OPEN QUESTION ===
    if (typeString === 'open_question' || typeString === 'open-question' || typeString === 'open_ended') {
        return {
            id: uuidv4(),
            type: 'open-question',
            content: { question: questionText || "שאלה פתוחה" },
            metadata: {
                ...commonMetadata,
                modelAnswer: Array.isArray(rawData.model_answer)
                    ? rawData.model_answer.join('\n- ')
                    : (rawData.model_answer || rawData.teacher_guidelines || rawData.answer_key || "התשובה נמצאת בחומר הלימוד."),
                score: 20
            }
        };
    }

    // === CASE C: ORDERING / SEQUENCING ===
    if (typeString === 'ordering' || typeString === 'sequencing') {
        const rawItems = rawData.items || rawData.steps || rawData.correct_order || [];
        const items = rawItems.map((i: any) => {
            if (typeof i === 'string') return i;
            const iObj = i as any;
            return iObj.text || iObj.step || iObj.content || iObj.description || JSON.stringify(i);
        });

        if (items.length < 2) {
            return null;
        }

        return {
            id: uuidv4(),
            type: 'ordering',
            content: {
                instruction: (questionText && questionText !== "שאלה ללא טקסט") ? questionText : "סדרו את השלבים לפי הסדר הנכון:",
                correct_order: items
            },
            metadata: { ...commonMetadata, score: 15 }
        };
    }

    // === CASE D: CATEGORIZATION / GROUPING / MATCHING ===
    if (typeString === 'categorization' || typeString === 'grouping' || typeString === 'matching' || typeString === 'sorting') {
        let categories: string[] = [];
        let items: { text: string; category: string }[] = [];

        if (typeString === 'matching' || rawData.pairs) {
            const pairs = rawData.pairs || [];
            const uniqueCats = new Set<string>();
            pairs.forEach((p: any) => uniqueCats.add(p.right || p.category || ""));
            categories = Array.from(uniqueCats).filter(Boolean) as string[];
            items = pairs.map((p: any) => ({
                text: p.left || p.item || "",
                category: p.right || p.category || ""
            }));
        }
        else {
            categories = rawData.groups || rawData.categories || ["קטגוריה 1", "קטגוריה 2"];
            const rawListing = (rawData.items || []) as any[];

            items = rawListing.map((item) => {
                if (typeof item === 'object' && item.category) {
                    return { text: item.text || item.content || JSON.stringify(item), category: item.category };
                }
                if (typeof item === 'object' && item.group_index !== undefined && categories[item.group_index]) {
                    return { text: item.text || item.content || "", category: categories[item.group_index] };
                }
                if (typeof item === 'object' && item.group) return { text: item.text, category: item.group };

                return {
                    text: typeof item === 'string' ? item : (item.text || JSON.stringify(item)),
                    category: categories[0] || "כללי"
                };
            });
        }

        if (items.length === 0 || categories.length === 0) {
            return null;
        }

        return {
            id: uuidv4(),
            type: 'categorization',
            content: {
                question: (questionText && questionText !== "שאלה ללא טקסט") ? questionText : "מיינו את הפריטים לקטגוריות:",
                categories: categories,
                items: items
            },
            metadata: { ...commonMetadata, score: 20 }
        };
    }

    // === CASE E: FILL IN BLANKS ===
    if (typeString === 'fill_in_blanks' || typeString === 'cloze') {
        const safeData = rawData as any;
        return {
            id: uuidv4(),
            type: 'fill_in_blanks',
            content: {
                text: safeData.text || safeData.content || questionText || "חסר טקסט להשלמה",
            },
            metadata: {
                ...commonMetadata,
                score: 15,
                wordBank: safeData.word_bank || safeData.options || []
            }
        };
    }

    // === CASE F: MEMORY GAME ===
    if (typeString === 'memory_game' || typeString === 'memory' || typeString === 'matching_pairs') {
        const pairs = rawData.pairs || rawData.cards || [];
        const normalizedPairs: { card_a: string; card_b: string }[] = [];

        if (Array.isArray(pairs)) {
            pairs.forEach((p: any) => {
                if (p.card_a && p.card_b) normalizedPairs.push({ card_a: p.card_a, card_b: p.card_b });
                else if (p.left && p.right) normalizedPairs.push({ card_a: p.left, card_b: p.right });
                else if (Array.isArray(p) && p.length === 2) normalizedPairs.push({ card_a: p[0], card_b: p[1] });
            });
        }

        if (normalizedPairs.length < 2) {
            return null;
        }

        return {
            id: uuidv4(),
            type: 'memory_game',
            content: {
                pair_count: normalizedPairs.length,
                pairs: normalizedPairs,
                question: questionText || "התאימו בין הזוגות:"
            },
            metadata: { ...commonMetadata, score: 15 }
        };
    }

    // === CASE G: PLAIN TEXT ===
    if (typeString === 'text' || typeString === 'explanation' || typeString === 'content') {
        return {
            id: uuidv4(),
            type: 'text',
            content: typeof rawData === 'string' ? rawData : (rawData.text || rawData.content || questionText || ""),
            metadata: { ...commonMetadata, score: 0 }
        };
    }

    return null;
};

// --- Agentic Workflow Stages ---

// Stage 1: The Architect (Planner) - BRAIN
async function runArchitectStage(openai: OpenAI, context: { topic: string, gradeLevel: string, subject: string, fileData: any, activityLength: string, sourceText?: string, mode?: string }): Promise<UnitSkeleton | null> {
    let stepCount = 5;
    let structureGuide = "";

    if (context.activityLength === 'short') {
        stepCount = 3;
        structureGuide = `
        STEP 1: Foundation (Remember/Understand). Type: memory_game OR multiple_choice.
        STEP 2: Connection (Apply/Analyze). Type: fill_in_blanks OR categorization.
        STEP 3: Synthesis (Evaluate/Create). Type: open_question OR multiple_choice (scenario).
        `;
    } else if (context.activityLength === 'long') {
        stepCount = 7;
        structureGuide = `
        STEPS 1-2: Foundation. Type: memory_game / multiple_choice / true_false.
        STEPS 3-5: Connection. Type: fill_in_blanks / ordering / categorization / matching.
        STEPS 6-7: Synthesis. Type: open_question / multiple_choice.
        `;
    } else {
        stepCount = 5;
        structureGuide = `
        STEPS 1-2: Foundation (Remember). Type: memory_game OR multiple_choice.
        STEPS 3-4: Connection (Analyze). Type: fill_in_blanks OR categorization.
        STEP 5: Synthesis (Create). Type: open_question.
        `;
    }

    const contextPart = context.sourceText
        ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${context.sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
        : `Topic: "${context.topic}"`;

    const isAssessment = context.mode === 'assessment';

    // --- MODE SPECIFIC INSTRUCTIONS ---
    const taskDefinition = isAssessment
        ? `Task: Create a "Test Plan" (Exam Skeleton).`
        : `Task: Create a "Learning Skeleton" (Curriculum Plan).`;

    const segmentationRule = isAssessment
        ? `- **Assessment Strategy:** Scan for distinct topics to TEST. Identify key facts and processes that require verification.`
        : `- **Segmentation Strategy:** Scan for stories/topics to TEACH. Divorce the source text into ${stepCount} distinct narratives.`;

    const policyRule = isAssessment
        ? `- **POLICY:** Questions ONLY. No "Teaching" blocks. Focusing on Verification of Knowledge.`
        : `- **POLICY:** Text Chunk -> Question. Ensure frequent interaction.`;

    const systemPrompt = `
    Role: Pedagogical Architect (The Brain).
    ${taskDefinition}
    ${contextPart}
    Target Audience: ${context.gradeLevel}.
    Count: Exactly ${stepCount} steps.
    Language: Hebrew.

    MISSION:
    1. **Holistic Analysis:** Read the ENTIRE source text first.
    2. **STRATEGY:**
       ${segmentationRule}
       - **Anti-Bias Rule:** You MUST include ALL major distinct stories found.
       - **Constraint:** Chunk A must end completely before Chunk B begins.

    3. **ZERO-TEXT-WALL POLICY (V4):**
       ${policyRule}

    4. **Topic Policing:**
       - For each step, define a strict **narrative_focus** (Allowed Content) and **forbidden_topics** (Banned Content).

    5. **LOGIC SAFETY:**
       - **Categorization:** Categories must be MUTUALLY EXCLUSIVE.
       - **Ordering:** Must be based on objective criteria.

    6. **Structure Guide:**
    ${structureGuide}

    Output JSON Structure:
    {
      "unit_title": "String",
      "steps": [
        {
          "step_number": 1,
          "title": "Unique Title for Chunk A",
          "narrative_focus": "Discuss ONLY [Specific Concept A]...",
          "forbidden_topics": ["Concept B", "Concept C"],
          "bloom_level": "Remember",
          "suggested_interaction_type": "memory_game"
        }
      ]
    }
    `;

    const userContent: any[] = [{ type: "text", text: `Build the skeleton for topic: ${context.topic}` }];

    if (context.fileData) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${context.fileData.mimeType};base64,${context.fileData.base64}` }
        });
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // USE STRONG MODEL FOR BRAIN
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent as any }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        const text = response.choices[0].message.content || "{}";
        const result = JSON.parse(text) as UnitSkeleton;

        if (!result.steps || !Array.isArray(result.steps)) {
            logger.error("Invalid skeleton format");
            return null;
        }
        return result;

    } catch (e) {
        logger.error("Architect Error:", e);
        return null; // Handle error gracefully
    }
}

// Stage 2: The Generator (Drafter) - HANDS (Parallel)
async function generateSingleStep(openai: OpenAI, stepInfo: StepInfo, context: { topic: string, gradeLevel: string, sourceText?: string, mode?: string }): Promise<any | null> {
    const contextText = context.sourceText
        ? `Source Material:\n"""${context.sourceText.substring(0, 3000)}..."""`
        : `Topic: ${context.topic}`;

    const isAssessment = context.mode === 'assessment';

    // --- MODE SPECIFIC PROMPTS ---
    const roleDefinition = isAssessment
        ? `Role: "Strict Examiner" (Objective Testing AI).\nTask: Create a single rigorous exam question.`
        : `Role: "Wizdi-Bot" (Expert Pedagogical AI).\nTask: Create ONE interactive learning block.`;

    const contentRule = isAssessment
        ? `
        - **CONTENT BAN:** You are creating a TEST. Do NOT teach. 
        - **Constraint:** \`teach_content\` field MUST be empty string "" or null.
        - **Tone:** Neutral, Objective, Formal.
        `
        : `
        - **Focus:** Discuss ONLY: ${stepInfo.narrative_focus}.
        - **Tone:** Engaging, Scaffolding, Age-Appropriate.
        `;

    const hintsRule = isAssessment
        ? `- **NO HINTS:** \`progressive_hints\` MUST be an empty array [].`
        : `- **Scaffolding:** Provide 2-3 progressive hints.`;

    const systemPrompt = `
    ${roleDefinition}
    Input: Step Instructions from Architect.
    ${contextText}

    MANDATORY REQUIREMENTS:
    1. **Pedagogy:** Strictly follow the Bloom Level (${stepInfo.bloom_level}) and Interaction Type (${stepInfo.suggested_interaction_type}).
    2. **ZERO-TEXT-WALL RULE (V4):**
       ${contentRule}
       - **BAN:** Do NOT mention: ${JSON.stringify(stepInfo.forbidden_topics || [])}.

    3. **Complexity Adaptation (Age: ${context.gradeLevel}):** 
       - **Age Adaptation (Grades 1-6):** Use concrete terminology.
       - **Tone (Grade 7+):** Objective, Historical Tone.

    4. **STRICT GROUNDING (Anti-Hallucination V3):**
       - **Rule:** Use ONLY the provided Source Text. If it's not in the PDF, it doesn't exist.

    5. **Micro-Learning Progression:**
       - Treat this step as "Question ${stepInfo.step_number}".

    6. **Logic & Interaction Rules:**
       - **Ordering:** The 'teach_content' (if allowed) MUST be a narrative story. Items must be paraphrased.
       - **Categorization:** Categories must be **MUTUALLY EXCLUSIVE**.
       - **OPEN QUESTION RUBRIC:** Provide a detailed \`model_answer\` with 3-4 bullet points.
       - **Language:** OUTPUT VALUES MUST BE IN HEBREW.

    7. **PEDAGOGICAL SAFETY VALVE (BLOOM-PRESERVING FALLBACK):**
       - If requested type is impossible given text, fallback to a valid type that preserves Bloom Level.
       - NEVER return empty/broken JSON.

    8. **Assessment Specifics:**
       ${hintsRule}
       - **Feedback:** Explain WHY the answer is correct/incorrect (Discriminative).

    Output FORMAT (JSON ONLY):
    {
       "step_number": ${stepInfo.step_number},
       "bloom_level": "${stepInfo.bloom_level}", 
       "teach_content": "${isAssessment ? "" : "Full explanation text..."}",
       "selected_interaction": "${stepInfo.suggested_interaction_type}", 
       "data": {
          "progressive_hints": ${isAssessment ? "[]" : `["Hint 1", "Hint 2"]`},
          "source_reference_hint": "See section '...'",
          // DYNAMIC STRUCTURE BASED ON INTERACTION TYPE...
       }
    }
    `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // FAST MODEL FOR HANDS
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Generate Step ${stepInfo.step_number} now.` }
            ],
            temperature: isAssessment ? 0.3 : 0.7, // Lower temperature for Assessment
            response_format: { type: "json_object" }
        });

        const text = response.choices[0].message.content || "{}";
        return JSON.parse(text);
    } catch (e) {
        logger.error(`Step Gen Error (Step ${stepInfo.step_number}):`, e);
        return null;
    }
}

// Stage 3: Critic Removed (Architecture Optimization)

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

            // 1. Architect (The Brain)
            logger.info(`Stage 1: Architect (Hyperspeed) running in ${data.mode || 'learning'} mode...`);
            const skeleton = await runArchitectStage(openai, {
                topic,
                gradeLevel,
                subject,
                fileData,
                activityLength,
                sourceText: data.sourceText,
                mode: data.mode || 'learning' // Pass mode
            });

            if (!skeleton || !skeleton.steps) {
                throw new Error("Architect failed to generate a valid skeleton.");
            }

            // 2. Generator (The Hands) - PARALLEL EXECUTION
            logger.info(`Stage 2: Hands running in PARALLEL for ${skeleton.steps.length} steps...`);

            const stepPromises = skeleton.steps.map(step =>
                generateSingleStep(openai, step, {
                    topic,
                    gradeLevel,
                    sourceText: data.sourceText,
                    mode: data.mode || 'learning' // Pass mode
                })
            );

            const results = await Promise.all(stepPromises);
            const validResults = results.filter(r => r !== null);

            logger.info(`Generation complete. Success: ${validResults.length}/${skeleton.steps.length}`);

            // --- BUILDING FINAL DOCUMENT ---

            const blocks: any[] = [];

            // Add Introduction Block
            blocks.push({
                id: uuidv4(),
                type: 'text',
                content: `### ברוכים הבאים לשיעור ב${subject}\n**נושא:** ${unitTitle}\nמותאם עבור ${gradeLevel}.\n\n*מטרות השיעור (מתוך הארכיטקט):*\n${skeleton.unit_title || unitTitle}`,
                metadata: {}
            });

            // Add Teacher Bot
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

            // Add Generated and Mapped Steps
            validResults.forEach((item: any) => {
                const block = mapSystemItemToBlock(item);
                if (block) blocks.push(block);
            });

            if (validResults.length === 0) {
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
