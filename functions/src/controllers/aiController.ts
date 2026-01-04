import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { getSkeletonPrompt, getStepContentPrompt, getPodcastPrompt, getGuardianPrompt } from "../ai/prompts";
import { mapSystemItemToBlock, cleanJsonString } from "../shared/utils/geminiParsers";
import { getCached, setCache, getSkeletonCacheKey, getStepContentCacheKey } from "../services/cacheService";

// Note: In a real migration, we would ideally move the 'geminiApi.ts' logic 
// fully to a 'service' file in the backend. For this "Vault" phase, 
// we will implement the specific 'generateLessonPlan' endpoint which matches 
// what 'generateUnitSkeleton' did in the frontend.

// Since `generateUnitSkeleton` in frontend was doing the heavy lifting of calling the API,
// we will recreate that orchestration here.

export const createAiController = (openaiApiKey: any) => {

    const MODEL_NAME = "gpt-4o-mini";
    // --- 1. Generate Teacher Lesson PLAN (Teacher View) ---
    // Formerly 'generateUnitSkeleton' - Renamed to avoid confusion with Student Unit
    const generateTeacherLessonPlan = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { topic, gradeLevel, activityLength, sourceText, mode, productType } = request.data;
        const durationMap: Record<string, string> = { short: "45 min", medium: "90 min", long: "120 min" };

        logger.info(`Vault: Generating TEACHER Lesson Plan (Architect) for ${topic}`);

        // --- NEW ARCHITECT PROMPT (User Defined) ---
        const ARCHITECT_PROMPT = `
System Prompt: The Pedagogical Lesson Architect
Role: You are an expert Pedagogical Architect and Instructional Designer for the "Wizdi" system. Your mission is to process raw content and synthesize it into a high-level Teacher's Lesson Plan.

Core Philosophy:
Audience: You are writing for the TEACHER, not the student.
Tone: Professional, directive, helpful, and structured.
Goal: To provide a step-by-step script that helps the teacher manage the class time effectively.

Input Data:
Topic: ${topic}
Grade Level: ${gradeLevel}
Duration: ${durationMap[activityLength || 'medium']}
Source Material: """${(sourceText || "").substring(0, 10000)}"""

Part 1: Pedagogical Processing Instructions
You must structure the lesson based on the "5E Model" or standard Direct Instruction flow:
1. Hook (Opening)
2. Knowledge (Body)
3. Guided Practice
4. Independent Practice
5. Closure (Assessment)

The Bridge to System Tools (Crucial):
- When the lesson reaches the Practice phase, you must explicitly prompt the teacher to launch the "Interactive Activity".
- When the lesson reaches the Assessment phase, prompt the teacher to launch the "Test Generator".

Part 3: Output Generation (Hebrew JSON)
Generate a JSON object with the following structure. Strict JSON.
{
  "title": "Lesson Title",
  "metadata": {
      "grade": "${gradeLevel}",
      "duration": "${durationMap[activityLength || 'medium']}",
      "objectives": ["obj1", "obj2"],
      "keywords": ["key1", "key2"]
  },
  "steps": [
      {
          "step_number": 1,
          "title": "פתיחה וגירוי",
          "duration": "0-5 min",
          "type": "frontal",
          "teacher_instructions": "Detailed script for the teacher...",
          "system_tool": null
      },
      {
          "step_number": 2,
          "title": "הקניה והוראה",
          "duration": "5-15 min",
          "type": "frontal",
          "teacher_instructions": "Explanation content...",
          "system_tool": null
      },
      {
          "step_number": 3,
          "title": "תרגול כיתתי",
          "duration": "15-30 min",
          "type": "interactive",
          "teacher_instructions": "Group activity instructions...",
          "system_tool": "Interactive Activity"
      },
      {
          "step_number": 4,
          "title": "סיכום והערכה",
          "duration": "40-45 min",
          "type": "assessment",
          "teacher_instructions": "Closing question...",
          "system_tool": "Test Generator"
      }
  ]
}
`;

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: "You are the Wizdi Pedagogical Architect." },
                    { role: "user", content: ARCHITECT_PROMPT }
                ],
                response_format: { type: "json_object" }
            });

            const rawContent = completion.choices[0].message.content;
            if (!rawContent) throw new Error("Empty response from AI");

            const architectJson = JSON.parse(cleanJsonString(rawContent));

            // --- MAP TO FRONTEND SHELL ---
            const mappedSteps = architectJson.steps.map((s: any) => ({
                step_number: s.step_number,
                title: `${s.title} (${s.duration})`,
                type: s.type === 'interactive' ? 'interactive' : (s.type === 'assessment' ? 'quiz' : 'text'),
                description: s.teacher_instructions,
                system_tool: s.system_tool
            }));

            return {
                title: architectJson.title,
                steps: mappedSteps,
                metadata: architectJson.metadata
            };

        } catch (error: any) {
            logger.error("Vault Architect (Lesson Plan) Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 2. Generate STUDENT Unit Skeleton (Interactive Flow) ---
    // Ported from frontend/gemini.ts to Fix "Split Brain"
    const generateStudentUnitSkeleton = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { topic, gradeLevel, activityLength, sourceText, mode, productType, bloomPreferences, studentProfile } = request.data;

        logger.info(`Vault: Generating STUDENT Unit Skeleton for ${topic} (Mode: ${mode})`);

        // Check cache first (skip if sourceText provided - custom content)
        if (!sourceText && !bloomPreferences) {
            const cacheKey = getSkeletonCacheKey(topic, gradeLevel, activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5), mode || 'learning');
            const cached = await getCached(cacheKey);

            if (cached) {
                logger.info(`Cache hit for skeleton: ${cacheKey}`);
                return cached;
            }
        }

        // Helper for Bloom Distribution (Inlined from frontend)
        const getBloomDistribution = (count: number, requestedDistribution?: Record<string, number>): string[] => {
            if (!requestedDistribution) {
                switch (count) {
                    case 3: return ["Remember (Foundation)", "Analyze (Process)", "Create (Synthesis)"];
                    case 5: return ["Remember", "Remember", "Apply", "Analyze", "Create"];
                    case 7: return ["Remember", "Remember", "Apply", "Apply", "Analyze", "Evaluate", "Create"];
                    default: return Array(count).fill("Mix of Levels");
                }
            }
            const totalPercentage = Object.values(requestedDistribution).reduce((a, b) => a + b, 0);
            const distribution: string[] = [];
            Object.entries(requestedDistribution).forEach(([level, percent]) => {
                const numItems = Math.round((percent / totalPercentage) * count);
                for (let i = 0; i < numItems; i++) distribution.push(level);
            });
            while (distribution.length < count) distribution.push("Apply");
            return distribution.slice(0, count).sort();
        };

        // Personality Injection
        let personalityInstruction = "";
        if (studentProfile?.confirmedTraits && studentProfile.confirmedTraits.length > 0) {
            personalityInstruction = `\n    PERSONALIZATION OVERRIDE:\n    The student has confirmed traits: ${JSON.stringify(studentProfile.confirmedTraits)}.\n    ADAPT THE SKELETON TO THESE PREFERENCES (e.g. if 'Visual Learner', prefer visual blocks. If 'Competitive', increase difficulty).`;
        }

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
            // Standard Lesson
            if (activityLength === 'short') {
                stepCount = 3;
                structureGuide = `
                  STEP 1: Introduction & Exposition (Teach + Check). Type: multiple_choice.
                  STEP 2: Deep Dive (Understand). Type: fill_in_blanks.
                  STEP 3: Conclusion & Reflection. Type: open_question.
                `;
            } else if (activityLength === 'long') {
                stepCount = 7;
                structureGuide = `
                  STEPS 1-2: Exposition. Type: multiple_choice / true_false.
                  STEPS 3-5: Practice. Type: fill_in_blanks / categorization / ordering.
                  STEPS 6-7: Synthesis. Type: open_question / multiple_choice.
                `;
            } else {
                stepCount = 5;
                structureGuide = `
                  STEPS 1-2: Core Concepts. Type: multiple_choice OR true_false.
                  STEPS 3-4: Analysis. Type: fill_in_blanks OR categorization.
                  STEP 5: Synthesis. Type: open_question.
                `;
            }
        }

        const contextPart = sourceText
            ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
            : `Topic: "${topic}"`;

        const bloomSteps = getBloomDistribution(stepCount, bloomPreferences);

        const prompt = `
            Task: Create a "Skeleton" for a learning unit.
            ${contextPart}
            Target Audience: ${gradeLevel}.
            ${personalityInstruction}
            Mode: ${mode === 'exam' || productType === 'exam' ? 'STRICT EXAMINATION / TEST MODE' : (productType === 'game' ? 'GAMIFICATION / PLAY MODE' : 'Learning/Tutorial Mode')}
            Count: Exactly ${stepCount} steps.
            Language: Hebrew.
            
            BLOOM TAXONOMY REQUIREMENTS:
            ${JSON.stringify(bloomSteps)}

            MISSION:
            1. **Holistic Analysis:** Read the ENTIRE source text first.
            2. **SEGMENTATION STRATEGY:** Divorce the Source Text into ${stepCount} DISTINCT chunks.
            3. **ZERO-TEXT-WALL POLICY:** Ensure frequent interaction.
            4. **Topic Policing:** Define strict narrative_focus vs forbidden_topics.
            
            Structure Guide:
            ${structureGuide}

            Output JSON Structure:
            {
              "unit_title": "String",
              "steps": [
                {
                  "step_number": 1,
                  "title": "Title",
                  "narrative_focus": "Discuss ONLY...",
                  "forbidden_topics": ["..."],
                  "bloom_level": "Remember",
                  "suggested_interaction_type": "multiple_choice"
                }
              ]
            }
        `;

        try {
            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                temperature: 0.7
            });

            const text = completion.choices[0].message.content || "{}";
            const result = JSON.parse(cleanJsonString(text));

            if (!result.steps || !Array.isArray(result.steps)) {
                logger.warn("Invalid skeleton format received from AI");
                return null;
            }

            // Cache the result (if no custom parameters)
            if (!sourceText && !bloomPreferences) {
                const cacheKey = getSkeletonCacheKey(topic, gradeLevel, activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5), mode || 'learning');
                const TTL_7_DAYS = 7 * 24 * 60 * 60 * 1000;
                await setCache(cacheKey, result, TTL_7_DAYS, [topic, gradeLevel]);
                logger.info(`Cached skeleton: ${cacheKey}`);
            }

            return result;

        } catch (error: any) {
            logger.error("Vault Student Skeleton Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    // --- 2. Generate Step Content ---
    const generateStepContent = onCall({ cors: true, secrets: [openaiApiKey] }, async (request) => {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        const { topic, stepInfo, gradeLevel, sourceText, fileData, mode } = request.data;
        logger.info(`Vault: Generating Step ${stepInfo?.step_number} Content`);

        // Check cache (skip if custom sourceText or fileData)
        if (!sourceText && !fileData && stepInfo?.description) {
            const cacheKey = getStepContentCacheKey(stepInfo.step_number, topic, stepInfo.description);
            const cached = await getCached(cacheKey);

            if (cached) {
                logger.info(`Cache hit for step content: ${cacheKey}`);
                return cached;
            }
        }

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
            const result = JSON.parse(cleanJsonString(text));

            // Exam Enforcer Logic (Backend Side)
            if (mode === 'exam' && result) {
                result.teach_content = "";
                if (result.data) result.data.progressive_hints = [];
            }

            // Cache the result (if no custom parameters)
            if (!sourceText && !fileData && stepInfo?.description) {
                const cacheKey = getStepContentCacheKey(stepInfo.step_number, topic, stepInfo.description);
                const TTL_7_DAYS = 7 * 24 * 60 * 60 * 1000;
                await setCache(cacheKey, result, TTL_7_DAYS, [topic, gradeLevel]);
                logger.info(`Cached step content: ${cacheKey}`);
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
            return JSON.parse(cleanJsonString(text));
        } catch (error: any) {
            logger.error("Vault Podcast Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    return { generateTeacherLessonPlan, generateStudentUnitSkeleton, generateStepContent, generatePodcastScript };
};
