import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { getSkeletonPrompt, getStepContentPrompt, getPodcastPrompt, getGuardianPrompt } from "../ai/prompts";
import { mapSystemItemToBlock, cleanJsonString } from "../shared/utils/geminiParsers";

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
        const durationMap: Record<string, string> = { short: "45 min", medium: "90 min", long: "120 min" };

        logger.info(`Vault: Generating Lesson Plan V2 (Architect) for ${topic}`);

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
            // For NON-Lesson products (Exam/Game), keep legacy logic or simplified fallback
            // But if productType is 'lesson', use the Architect.
            // For now, let's assume 'lesson' is the main path we are fixing.

            let promptToUse = ARCHITECT_PROMPT;
            // (We can re-add the Exam/Game logic branches later if needed, but for now we focus on the Lesson Plan refactor)

            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: "system", content: "You are the Wizdi Pedagogical Architect." },
                    { role: "user", content: promptToUse }
                ],
                response_format: { type: "json_object" }
            });

            const rawContent = completion.choices[0].message.content;
            if (!rawContent) throw new Error("Empty response from AI");

            const architectJson = JSON.parse(cleanJsonString(rawContent));

            // --- MAP TO FRONTEND SHELL ---
            // The frontend expects { steps: [ { step_number, title, type, content } ] }
            // We map the Architect's "teacher_instructions" into the content block.

            const mappedSteps = architectJson.steps.map((s: any) => ({
                step_number: s.step_number,
                title: `${s.title} (${s.duration})`,
                type: s.type === 'interactive' ? 'interactive' : (s.type === 'assessment' ? 'quiz' : 'text'),
                // We pre-fill the content so the frontend doesn't need to "generate" it again,
                // OR we leave it empty if we want the second pass. 
                // User requested "Show skeleton then load".
                // Ideally, we return the Instructions as the "Skeleton Description".
                description: s.teacher_instructions,
                system_tool: s.system_tool
            }));

            return {
                title: architectJson.title,
                steps: mappedSteps,
                metadata: architectJson.metadata
            };

        } catch (error: any) {
            logger.error("Vault Architect Error:", error);
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
            const result = JSON.parse(cleanJsonString(text));

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
            return JSON.parse(cleanJsonString(text));
        } catch (error: any) {
            logger.error("Vault Podcast Error:", error);
            throw new HttpsError('internal', error.message);
        }
    });

    return { generateUnitSkeleton, generateStepContent, generatePodcastScript };
};
