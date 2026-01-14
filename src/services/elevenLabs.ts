import type { DialogueLine } from "../types/gemini.types";
import { auth } from '../firebase';

// Multi-language Voice Configuration
// The system automatically selects voices based on the language detected in the text
interface VoiceConfig {
    Dan: string;
    Noa: string;
}

const HEBREW_VOICES: VoiceConfig = {
    Dan: "Hcr1PUBJC4hYJ9PyCCpi", // wizdi (Male, Hebrew, Middle-aged)
    Noa: "15jgdbYN49TalaJRlJJw", // gil voice (Female, Hebrew, Middle-aged)
};

const ENGLISH_VOICES: VoiceConfig = {
    Dan: "pNInz6obpgDQGcFmaJgB", // Adam (Deep, Narrator-like)
    Noa: "kPzsL2i3teMYv0FxEYQ6", // Brittney (Fun, Youthful & Informative)
};

/**
 * Detects if text is primarily Hebrew or English
 * @param text - The text to analyze
 * @returns 'he' for Hebrew, 'en' for English
 */
function detectLanguage(text: string): 'he' | 'en' {
    // Count Hebrew characters (Unicode range: \u0590-\u05FF)
    const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
    // Count English letters
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;

    // If more than 30% of characters are Hebrew, consider it Hebrew
    const totalChars = text.length;
    const hebrewRatio = hebrewChars / totalChars;

    return hebrewRatio > 0.3 ? 'he' : 'en';
}

/**
 * Selects the appropriate voice set based on detected language
 */
function getVoiceConfig(text: string): VoiceConfig {
    const language = detectLanguage(text);
    return language === 'he' ? HEBREW_VOICES : ENGLISH_VOICES;
}

export const ElevenLabsService = {
    /**
     * Checks if ElevenLabs is available (user must be authenticated)
     */
    isConfigured: (): boolean => {
        return !!auth.currentUser;
    },

    /**
     * Generates audio for a single dialogue line.
     * Automatically selects appropriate voice based on language detection.
     * Uses Cloud Function proxy to keep API key secure.
     * @param line The dialogue line containing speaker and text.
     * @returns Promise resolving to an Audio Blob URL.
     */
    generateAudioSegment: async (line: DialogueLine): Promise<string | null> => {
        // Check if user is authenticated
        const user = auth.currentUser;
        if (!user) {
            console.error("User not authenticated for TTS");
            return null;
        }

        // Automatically select voice based on language detected in the text
        const voiceConfig = getVoiceConfig(line.text);
        const voiceId = voiceConfig[line.speaker];

        // Detect language for model selection
        const language = detectLanguage(line.text);
        const modelId = language === 'he' ? "eleven_multilingual_v2" : "eleven_turbo_v2_5";

        console.log(`🎙️ Generating audio: ${line.speaker} (${language}) - "${line.text.substring(0, 30)}..."`)

        try {
            // Get Firebase ID token for authentication
            const idToken = await user.getIdToken();

            // Call Cloud Function proxy instead of direct API
            const response = await fetch('/api/elevenlabs', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    voiceId,
                    text: line.text,
                    modelId,
                    voiceSettings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: line.emotion === "Excited" ? 0.8 : 0.0
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                console.error("ElevenLabs Proxy Error:", err);
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
