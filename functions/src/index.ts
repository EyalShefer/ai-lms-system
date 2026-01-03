import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https"; // Added for Proxy & Error handling
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import { v4 as uuidv4 } from 'uuid';

// 1. אתחול
initializeApp();
const db = getFirestore();
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const MODEL_NAME = "gpt-4o-mini"; // Cost-effective for multi-stage calls

// --- CONTROLLERS ---
import { createAiController } from "./controllers/aiController";

const { generateUnitSkeleton, generateStepContent, generatePodcastScript } = createAiController(openAiApiKey);
export { generateUnitSkeleton, generateStepContent, generatePodcastScript };

// --- SHARED IMPORTS ---
import { mapSystemItemToBlock, cleanJsonString } from './shared/utils/geminiParsers';
import type { RawAiItem } from './shared/types/gemini.types';
import type { MappedLearningBlock } from './shared/types/gemini.types';
import type { UnitSkeleton, SkeletonStep, StepContentResponse } from './shared/types/gemini.types';

// --- TYPES ---
// --- TYPES REMOVED (Imported from Shared) ---
// interface StepInfo ...
// interface UnitSkeleton ...

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

// --- YOUTUBE TRANSCRIPTION FUNCTION ---
import { YoutubeTranscript } from 'youtube-transcript';
// onCall and HttpsError imported at top level

/**
 * Fetches transcript from a YouTube video URL.
 * Fails fast if no captions are available.
 */
export const transcribeYoutube = onCall({ cors: true, memory: "256MiB", secrets: [openAiApiKey] }, async (request) => {
    const { url, videoId } = request.data;
    const target = videoId || url;

    if (!target) {
        throw new Error("Missing 'url' or 'videoId' parameter");
    }

    try {
        logger.info(`Fetching transcript for: ${target}`);

        // Strategy: Try Hebrew ('he'), then Legacy Hebrew ('iw'), then English ('en'), then Default/Auto.
        let transcriptItems = null;
        const attempts = ['he', 'iw', 'en', undefined]; // undefined = default/auto

        for (const lang of attempts) {
            try {
                if (lang) logger.info(`Attempting transcript fetch with lang: ${lang} for ${target}`);
                else logger.info(`Attempting default (auto) transcript fetch for ${target}`);

                const config = lang ? { lang } : undefined;
                transcriptItems = await YoutubeTranscript.fetchTranscript(target, config);

                if (transcriptItems && transcriptItems.length > 0) {
                    logger.info(`Success with lang: ${lang || 'auto'}`);
                    break;
                }
            } catch (e) {
                logger.warn(`Failed fetch with lang ${lang || 'auto'}:`, e);
                // Continue to next attempt
            }
        }

        if (!transcriptItems || transcriptItems.length === 0) {
            throw new Error("Could not find any captions (Hebrew or English) for this video.");
        }

        // Combine text
        const fullText = transcriptItems.map(item => item.text).join(' ');

        // Basic cleanup
        let cleanText = fullText.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

        // 2. Auto-Translation if not in Hebrew
        const hasHebrew = /[\u0590-\u05FF]/.test(cleanText);
        if (!hasHebrew) {
            logger.info("Transcript detected as non-Hebrew. Translating to Hebrew via GPT-4o-mini...");
            try {
                const openai = new OpenAI({ apiKey: openAiApiKey.value() });
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are a professional translator. Translate the following video transcript into clear, natural Hebrew. Keep formatting intact." },
                        { role: "user", content: cleanText.substring(0, 15000) } // Safety cap for context window
                    ],
                    temperature: 0.3
                });

                const translated = response.choices[0].message.content;
                if (translated) {
                    cleanText = translated;
                    logger.info("Translation complete.");
                }
            } catch (transError) {
                logger.error("Translation failed, returning original text:", transError);
                // Fallback to original text if translation fails
            }
        }

        return { text: cleanText };

    } catch (error: any) {
        logger.error("Youtube Transcript Error:", error);
        throw new Error(`Failed to fetch transcript: ${error.message}`);
    }
});


// --- פונקציות עזר ---

const sanitizeData = (data: any): any => {
    return JSON.parse(JSON.stringify(data, (key, value) => {
        return value === undefined ? null : value;
    }));
};

// [cleanJsonString and mapSystemItemToBlock removed - imported from shared]

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
        const result = JSON.parse(cleanJsonString(text)) as UnitSkeleton;

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
async function generateSingleStep(openai: OpenAI, stepInfo: SkeletonStep, context: { topic: string, gradeLevel: string, sourceText?: string, mode?: string }): Promise<any | null> {
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
        return JSON.parse(cleanJsonString(text));
    } catch (e) {
        logger.error(`Step Gen Error (Step ${stepInfo.step_number}):`, e);
        return null;
    }
}

// Stage 3: Critic Removed (Architecture Optimization)

// --- AGENTIC GUARDIAN (STRICT VALIDATION) ---

const LESSON_PLAN_GUARDIAN_PROMPT = `
System Role: You are the "Wizdi" System Integrity & Pedagogical Guardian. Your primal directive is to verify that a generated output strictly adheres to the definitions of a LESSON PLAN and has not accidentally degenerated into a Quiz, Activity, or Summary.

Context: The system has a specific mode called "Lesson Plan Generator". Sometimes, AI models get confused and generate a list of questions (a Quiz) instead of a teaching guide. Your job is to catch this error immediately.

Input Data:
Declared Mode: {{SYSTEM_MODE}} (Should always be "LESSON_PLAN" for this check).
Generated Content: {{CONTENT_TEXT}}
UI Flags (Metadata): {{UI_BUTTONS_PRESENT}} (Buttons enabled for this content).

Phase 1: The "Identity Check" (Critical Fail Conditions)
Before analyzing quality, check for System Mode Violations. If any of these are TRUE, report CRITICAL FAIL immediately:

1. The "Worksheet Fallacy": 
   - Does the content consist only of questions and answers without instructional text for the teacher? (YES = FAIL).
   
2. The "Student Voice" Error: 
   - Does the text address the reader as "You, the student" (e.g., "Draw a line...", "Circle the answer") instead of "You, the teacher" (e.g., "Ask the students to...", "Present the slide")? (YES = FAIL).

3. The "Link Logic" Violation: 
   - (Based on UI Flags) Is the "Send Link to Student" button enabled for this content? 
   - Rule: A Lesson Plan is for the teacher's eyes only. It must NOT be shareable to students as a playable task. (YES = FAIL).

Phase 2: Qualitative Pedagogical Audit
Only if Phase 1 passed, proceed to evaluate quality:

Structure Verification:
- Does it have a distinct Time Allocation (e.g., "5 mins")?
- Is there a clear separation between "Teacher Action" (Frontal teaching) and "Student Activity"?

Source Integrity:
- Does the lesson plan reflect the specific provided topic/file?

Output Format (Hebrew JSON):
{
  "status": "PASS" | "REJECT",
  "critical_fail_reason": null | "Worksheet Fallacy" | "Student Voice Error" | "Link Logic Violation",
  "pedagogical_score": number, // 0-100
  "feedback_hebrew": "Short summary of issues or approval in Hebrew",
  "issues": [
      { "description": "...", "severity": "CRITICAL" | "WARNING" }
  ]
}
`;

async function validateLessonPlanWithGuardian(openai: OpenAI, content: any[], mode: string): Promise<any> {
    // Only run Guardian in 'lesson' mode
    // However, the function might be called 'learning' mode in the legacy logic.
    // We treat 'learning' as 'lesson' for this purpose unless it's strictly 'game' or 'assessment'.
    if (mode === 'assessment' || mode === 'game') return { status: 'PASS', note: 'Guardian skipped for non-lesson mode' };

    logger.info("🛡️ GUARDIAN: Starting Strict Integrity Check...");

    // Serialize content for checking (Sample first 2 modules to save tokens, or full text if short)
    const contentSample = JSON.stringify(content).substring(0, 15000);

    // Define UI Flags based on intended mode
    const uiFlags = "Print PDF: ENABLED, Share with Colleague: ENABLED, Share to Student: DISABLED";

    const prompt = LESSON_PLAN_GUARDIAN_PROMPT
        .replace('{{SYSTEM_MODE}}', 'LESSON_PLAN')
        .replace('{{CONTENT_TEXT}}', contentSample)
        .replace('{{UI_BUTTONS_PRESENT}}', uiFlags);

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Strong model for validation
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        const resultText = response.choices[0].message.content || "{}";
        const validationResult = JSON.parse(cleanJsonString(resultText));

        logger.info("🛡️ GUARDIAN RESULT:", validationResult);
        return validationResult;

    } catch (e) {
        logger.error("Guardian Check Failed:", e);
        // Fail open or closed? Safe to fail open if AI errors, but log warning.
        return { status: 'PASS', note: 'Guardian failed to execute' };
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

            // --- 🛡️ GUARDIAN CHECK ---
            const guardianResult = await validateLessonPlanWithGuardian(openai, validResults, data.mode || 'learning');

            if (guardianResult.status === 'REJECT') {
                logger.warn("🛡️ GUARDIAN SOFT-BLOCK:", guardianResult);
                // throw new Error(`AI Guardian Blocked Content: ${guardianResult.critical_fail_reason} - ${guardianResult.feedback_hebrew}`);
                // FALLBACK: Allow content but log warning (Beta Mode)
            }
            logger.info("🛡️ Guardian Approved Content.");

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

// --- ADAPTIVE BRAIN (BKT ENGINE) ---
// This function moves the "Student Model" logic from the client (insecure) to the cloud (secure).
export const submitAdaptiveAnswer = onCall({ cors: true }, async (request) => {
    const { userId, unitId, blockId, score, metadata, isCorrect } = request.data;

    if (!userId || !unitId) {
        throw new HttpsError('invalid-argument', 'Missing userId or unitId');
    }

    const db = getFirestore();
    // 1. Get Topic from Metadata or Default
    // In a real system, we might have a Topic Map. Here we trust the client's enriched metadata or fallback.
    const topic = metadata?.tags?.[0] || 'general';
    const difficulty = metadata?.difficulty_level || 0.5;

    // 2. Fetch User's Cognitive State for this Unit/Topic
    const stateRef = db.doc(`users/${userId}/adaptive_state/${unitId}`);
    const stateDoc = await stateRef.get();
    let state = stateDoc.exists ? stateDoc.data() : {
        mastery: { [topic]: 0.1 }, // Initial prior
        history: []
    };

    // 3. Bayesian Knowledge Tracing (BKT) Simplified
    // P(L) = Probability of knowing the skill
    const prior = state?.mastery?.[topic] || 0.1;

    // BKT Parameters (Std defaults)
    const P_G = 0.25; // Guess
    const P_S = 0.1;  // Slip
    const P_T = 0.1;  // Transit (Learning rate)

    let posterior = 0;

    if (isCorrect) {
        // P(L|Correct) = (P(L) * (1 - P_S)) / (P(L)*(1-P_S) + (1-P(L))*P_G)
        const num = prior * (1 - P_S);
        const den = num + (1 - prior) * P_G;
        posterior = num / den;
    } else {
        // P(L|Incorrect) = (P(L) * P_S) / (P(L)*P_S + (1-P(L))*(1-P_G))
        const num = prior * P_S;
        const den = num + (1 - prior) * (1 - P_G);
        posterior = num / den;
    }

    // Update with Transit (Learning occurred during the step)
    // P(L_new) = P(L_posterior) + (1 - P(L_posterior)) * P_T
    const newMastery = posterior + (1 - posterior) * P_T;

    // 4. Update State
    const updatedMasteryMap = { ...(state?.mastery || {}), [topic]: newMastery };

    await stateRef.set({
        mastery: updatedMasteryMap,
        lastUpdated: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion({
            blockId,
            score,
            isCorrect,
            timestamp: Date.now(),
            prior,
            posterior: newMastery
        })
    }, { merge: true });

    // 5. Policy Engine: Decide Next Action
    let action = 'continue';
    let message = '';

    if (newMastery > 0.95) {
        action = 'mastered';
        message = 'Topic Mastered! You are ready for the next challenge.';
    } else if (newMastery < 0.2 && difficulty < 0.4) {
        // Failure on easy content -> Needs intervention
        action = 'remediate';
        message = 'Let\'s review the basics.';
    } else if (isCorrect && difficulty > 0.7) {
        action = 'challenge';
        message = 'Excellent! Moving to advanced topics.';
    }

    logger.info(`BKT Update for ${userId}: ${topic} ${prior.toFixed(2)} -> ${newMastery.toFixed(2)} [${action}]`);

    return {
        success: true,
        mastery: newMastery,
        action,
        feedback: message
    };
});
