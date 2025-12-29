import type { DialogueLine } from "../types/gemini.types";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// Default High Quality Voices (Pre-made ElevenLabs Voices)
// "Adam" for Dan
// "Rachel" for Noa
// NOTE: These are standard public voice IDs.
const VOICES: Record<string, string> = {
    Dan: "pNInz6obpgDQGcFmaJgB", // Adam (Deep, Narrator-like)
    Noa: "21m00Tcm4TlvDq8ikWAM", // Rachel (Clear, American Female)
};

// Fallback if user wants Hebrew-specific voices?
// ElevenLabs Multilingual v2 supports Hebrew accurately with these voices.

export const ElevenLabsService = {
    /**
     * Checks if API key is configured.
     */
    isConfigured: (): boolean => {
        return !!import.meta.env.VITE_ELEVENLABS_API_KEY;
    },

    /**
     * Generates audio for a single dialogue line.
     * @param line The dialogue line containing speaker and text.
     * @returns Promise resolving to an Audio Blob URL.
     */
    generateAudioSegment: async (line: DialogueLine): Promise<string | null> => {
        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        if (!apiKey) {
            console.error("Missing VITE_ELEVENLABS_API_KEY");
            return null;
        }

        const voiceId = VOICES[line.speaker] || VOICES.Noa; // Default to Noa if unknown

        try {
            const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}/stream`, {
                method: "POST",
                headers: {
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": apiKey
                },
                body: JSON.stringify({
                    text: line.text,
                    model_id: "eleven_multilingual_v2", // Best for Hebrew/English mix
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: line.emotion === "Excited" ? 0.8 : 0.0 // Try to map emotion
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("ElevenLabs API Error:", err);
                return null;
            }

            const blob = await response.blob();
            return URL.createObjectURL(blob);

        } catch (error) {
            console.error("TTS Network Error:", error);
            return null;
        }
    }
};
