
import OpenAI from "openai";

// LEGACY CLIENT - TO BE REPLACED BY PROXY SERVICE ONCE IT SUPPORTS MULTIPART
// USED FOR: Whisper Audio Transcription
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error("Missing VITE_OPENAI_API_KEY in .env file (Legacy Client)");
}

export const openaiLegacy = new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true, // Needed for client-side Whisper
    timeout: 60000,
    maxRetries: 2
});
