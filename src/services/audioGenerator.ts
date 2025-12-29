import { openai, MODEL_NAME, cleanJsonString } from "../gemini";
import type { AudioOverviewRequest, DialogueScript } from "../types/gemini.types";
import { AUDIO_OVERVIEW_PROMPT } from "../prompts/audioPrompts";

/**
 * Service to handle Audio Overview (NotebookLM) generation.
 * Refactored to use OpenAI (Unified Stack).
 */
export const AudioGenerator = {
    /**
     * Checks if API key is configured (OpenAI).
     */
    isConfigured: (): boolean => {
        return !!import.meta.env.VITE_OPENAI_API_KEY;
    },

    /**
     * Generates a "Deep Dive" podcast script from the source text.
     * 
     * @param request - The configuration for the audio overview.
     * @returns {Promise<DialogueScript | null>} The strict JSON script or null on failure.
     */
    generateScript: async (request: AudioOverviewRequest): Promise<DialogueScript | null> => {
        if (!AudioGenerator.isConfigured()) {
            console.error("OpenAI API Key missing.");
            return null;
        }

        try {
            // Construct the full prompt
            const fullPrompt = `
        ${AUDIO_OVERVIEW_PROMPT}

        ---
        TARGET AUDIENCE: ${request.targetAudience}
        LANGUAGE: ${request.language === 'he' ? "Hebrew" : "English"}
        FOCUS TOPIC: ${request.focusTopic || "General Overview"}
        
        SOURCE TEXT:
        """
        ${request.sourceText.substring(0, 50000)} 
        """
        // Note: GPT-4o-mini has 128k context, keeping safe buffer.
      `;

            console.log(`Generating Audio Script with ${MODEL_NAME}...`);

            const completion = await openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: "user", content: fullPrompt }],
                response_format: { type: "json_object" },
                temperature: 0.7
            });

            let text = completion.choices[0].message.content || "{}";

            // Clean and Parse
            text = cleanJsonString(text);
            const script = JSON.parse(text) as DialogueScript;

            // Basic Validation
            if (!script.lines || !Array.isArray(script.lines) || script.lines.length < 2) {
                console.warn("Generated script is too short or invalid.");
                return null;
            }

            return script;

        } catch (error) {
            console.error("AudioGenerator.generateScript Failed:", error);
            return null;
        }
    },

    /**
     * Future method for TTS integration
     * (Placeholder for Phase 3)
     */
    synthesizeAudio: async (script: DialogueScript): Promise<string | null> => {
        console.log("TTS not implemented yet. Script ready:", script.title);
        return null;
    }
};
