import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { getSkeletonPrompt, getStepContentPrompt, getPodcastPrompt, getGuardianPrompt } from "../ai/prompts";
import { mapSystemItemToBlock } from "../shared/utils/geminiParsers";

// Note: In a real migration, we would ideally move the 'geminiApi.ts' logic 
// fully to a 'service' file in the backend. For this "Vault" phase, 
// we will implement the specific 'generateLessonPlan' endpoint which matches 
// what 'generateUnitSkeleton' did in the frontend.

// Since `generateUnitSkeleton` in frontend was doing the heavy lifting of calling the API,
// we will recreate that orchestration here.

export const createAiController = (openaiApiKey: any) => {

    // const openai = new OpenAI({ apiKey: openaiApiKey.value() }); // MOVED INSIDE HANDLERS
    const MODEL_NAME = "gpt-4o-mini";

    const generateUnitSkeleton = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { topic, gradeLevel, activityLength, sourceText, mode, productType } = request.data;

        logger.info(`Vault: Generating Lesson Plan for ${topic}`);

        // 1. Construct Prompt (Server Side Only)
        // We need to replicate valid logic for 'stepCount' etc.
        // 1. Construct Prompt (Server Side Only)
        let stepCount = 5;
        let structureGuide = "";

        if (productType === 'exam' || mode === 'exam') {
            stepCount = activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5);
            structureGuide = `
              STEP 1: Knowledge Check. Type: multiple_choice OR true_false (Strict).
              STEP 2: Application. Type: categorization OR ordering.
              STEP 3-${stepCount}: Synthesis/Audio. Type: open_question OR audio_response. NO teaching content.
              `;
        } else if (productType === 'game') {
            if (activityLength === 'short') {
                stepCount = 3;
                structureGuide = `
                STEP 1: Speed Challenge. Type: true_false_speed OR memory_game.
                STEP 2: Puzzle Challenge. Type: ordering OR categorization.
                STEP 3: Master Challenge. Type: memory_game OR categorization (Hard).
                `;
            } else {
                stepCount = activityLength === 'long' ? 7 : 5;
                structureGuide = `
                STEPS 1-2: Warmup Games. Type: memory_game / true_false_speed.
                STEPS 3-4: Logic Puzzles. Type: ordering / categorization / matching.
                STEPS 5-${stepCount}: Boss Levels. Type: categorization / matching (Complex).
                `;
            }
        } else {
            // LESSON MODE (Default)
            if (activityLength === 'short') {
                stepCount = 3;
                structureGuide = `
                STEP 1: Introduction & Exposition (Teach + Check). Type: multiple_choice (as Knowledge Check). DO NOT use memory_game.
                STEP 2: Deep Dive (Understand). Type: fill_in_blanks (Conceptual Cloze).
                STEP 3: Conclusion & Reflection. Type: open_question.
                `;
            } else if (activityLength === 'long') {
                stepCount = 7;
                structureGuide = `
                STEPS 1-2: Exposition & Concepts. Type: multiple_choice (Knowledge Check) / true_false.
                STEPS 3-5: Application & Practice. Type: fill_in_blanks / categorization / ordering.
                STEPS 6-7: Synthesis & Critical Thinking. Type: open_question / multiple_choice (Complex Scenario).
                `;
            } else {
                stepCount = 5;
                structureGuide = `
                STEPS 1-2: Core Concepts (Teach). Type: multiple_choice (Concept Check) OR true_false (Misconception Buster).
                STEPS 3-4: Analysis (Apply). Type: fill_in_blanks OR categorization.
                STEP 5: Synthesis (Create/Evaluate). Type: open_question OR audio_response.
                `;
            }
        }

        // Bloom Logic (simplified for backend v1)
        const bloomSteps = ["Remember", "Understand", "Apply", "Analyze", "Evaluate"];

        const prompt = getSkeletonPrompt(
            sourceText ? `SOURCE MATERIAL: ${sourceText.substring(0, 5000)}` : "",
            gradeLevel,
            "PERSONALITY: Teacher", // Default
            mode,
            productType,
            stepCount,
            bloomSteps,
            structureGuide
        );

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: "You are an expert curriculum developer." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });

            const rawContent = completion.choices[0].message.content;
            if (!rawContent) throw new Error("Empty response from AI");

            // --- GUARDIAN AUDIT START ---
            if (productType === 'lesson') {
                logger.info("Vault: Running Guardian Audit...");
                const guardianPrompt = getGuardianPrompt('LESSON_PLAN', rawContent); // Strict mode for lesson

                const guardianCheck = await openai.chat.completions.create({
                    model: "gpt-4o-mini", // Fast audit
                    messages: [
                        { role: "system", content: "You are the Integrity Guardian." },
                        { role: "user", content: guardianPrompt }
                    ],
                    response_format: { type: "json_object" }
                });

                const auditJson = guardianCheck.choices[0].message.content || "{}";
                const auditResult = JSON.parse(auditJson);

                if (auditResult.audit_result?.status === "CRITICAL_FAIL" || auditResult.audit_result?.status === "WARNING") {
                    const failReason = auditResult.audit_result.failure_reason_code;
                    const repairInstruction = auditResult.auto_repair_instruction;

                    logger.warn(`Vault: Guardian Blocked Content! Reason: ${failReason}`);
                    logger.info(`Vault: Attempting Self-Healing with instruction: ${repairInstruction}`);

                    // RELOOP - RETRY (One-shot repair)
                    const repairPrompt = prompt + `\n\nCRITICAL SYSTEM FEEDBACK: The previous generation failed the pedagogical audit. \nReason: ${failReason}.\nRepair Instruction: ${repairInstruction}.\nFIX AND REGENERATE THE JSON.`;

                    const repairRun = await openai.chat.completions.create({
                        model: MODEL_NAME,
                        messages: [
                            { role: "system", content: "You are an expert curriculum developer. Correct your work based on feedback." },
                            { role: "user", content: repairPrompt }
                        ],
                        response_format: { type: "json_object" }
                    });

                    const repairedContent = repairRun.choices[0].message.content;
                    // If repair successful, verify format and return
                    if (repairedContent) {
                        try {
                            const repairedJson = JSON.parse(repairedContent);
                            logger.info("Vault: Self-Healing Successful. Returning patched content.");
                            return repairedJson;
                        } catch (e) {
                            logger.error("Vault: Repair produced invalid JSON. Fallback to original.");
                        }
                    }
                }
            }
            // --- GUARDIAN AUDIT END ---

            const json = JSON.parse(rawContent);
            return json; // Return the Skeleton JSON directly to client

        } catch (error: any) {
            logger.error("Vault Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 2. Generate Step Content ---
    const generateStepContent = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { topic, stepInfo, gradeLevel, sourceText, fileData, mode } = request.data;
        logger.info(`Vault: Generating Step ${stepInfo?.step_number} Content`);

        // Linguistic Logic Re-creation (Simplified for Vault V1)
        const linguisticConstraints = "LINGUISTIC CONSTRAINTS: Use clear, engaging language.";

        const contextText = sourceText ? `Source: ${sourceText.substring(0, 3000)}...` : `Topic: ${topic}`;

        const prompt = getStepContentPrompt(
            contextText,
            "", // examEnforcer
            stepInfo,
            mode,
            linguisticConstraints,
            gradeLevel
        );

        const userContent: any[] = [{ type: "text", text: prompt }];
        if (fileData) {
            const dataUrl = `data:${fileData.mimeType};base64,${fileData.base64}`;
            userContent.push({ type: "image_url", image_url: { url: dataUrl } });
        }

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: userContent as any }],
                response_format: { type: "json_object" },
                temperature: 0.7
            });

            const text = completion.choices[0].message.content || "{}";
            const result = JSON.parse(text);

            // Exam Enforcer Logic (Backend Side)
            if (mode === 'exam' && result) {
                result.teach_content = "";
                if (result.data) result.data.progressive_hints = [];
            }
            return result;

        } catch (error: any) {
            logger.error("Vault Step Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 3. Generate Podcast ---
    const generatePodcastScript = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { sourceText, topic } = request.data;
        // Logic to construct prompt
        // We need getPodcastPrompt imported. (Assuming it is in prompts.ts)
        // Oops, I need to check if getPodcastPrompt is imported. Yes it is in my previous `view_file` of controller? No, I need to add it to imports.

        // Re-construct logic here if import fails, but best to import.
        // For now, let's assume I will fix imports in next step if missing.

        const prompt = `
          generate a "Deep Dive" podcast script between two hosts, Dan and Noa.
          Topic: ${topic || "The provided text"}
          Source Material: """${(sourceText || "").substring(0, 15000)}"""
          Characters: Dan (Curious), Noa (Expert).
          Format: JSON { "title": "...", "lines": [{ "speaker": "Dan", "text": "..." }] }.
          Language: Hebrew.
        `;

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });
            const text = completion.choices[0].message.content || "{}";
            return JSON.parse(text);
        } catch (error: any) {
            logger.error("Vault Podcast Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    return { generateUnitSkeleton, generateStepContent, generatePodcastScript };
};
