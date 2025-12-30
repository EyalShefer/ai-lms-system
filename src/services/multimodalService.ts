import { openai } from '../gemini';

export const MultimodalService = {
    /**
     * Transcribes an audio file using OpenAI Whisper.
     * @param file - The audio file (mp3, wav, etc.)
     * @returns The transcribed text.
     */
    transcribeAudio: async (file: File): Promise<string | null> => {
        try {
            console.log("Starting Whisper transcription for:", file.name);

            const transcription = await openai.audio.transcriptions.create({
                file: file,
                model: "whisper-1",
                language: "he", // Optimize for Hebrew
            });

            console.log("Transcription complete.");
            return transcription.text;
        } catch (e) {
            console.error("Transcription failed:", e);
            return null;
        }
    },

    /**
     * Processes a YouTube URL (MVP: Validates URL and prepares for transcript paste).
     * @param url - YouTube video URL
     * @returns Metadata or null if invalid.
     */
    validateYouTubeUrl: (url: string): string | null => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);

        return (match && match[2].length === 11) ? match[2] : null;
    },

    /**
     * Calls the backend function to transcribe a YouTube video.
     * @param url - Valid YouTube URL
     * @returns The transcript text or null.
     */
    processYoutubeUrl: async (url: string): Promise<string | null> => {
        try {
            const videoId = MultimodalService.validateYouTubeUrl(url);
            if (!videoId) throw new Error("Invalid YouTube URL");

            console.log("Calling transcribeYoutube cloud function for ID:", videoId);

            // Lazy load functions
            const { functions } = await import('../gemini');
            const { httpsCallable } = await import('firebase/functions');

            const transcribeFn = httpsCallable(functions, 'transcribeYoutube');
            // Send videoId AND url (backup)
            const result = await transcribeFn({ videoId, url });

            const data = result.data as { text: string };
            return data.text || null;

        } catch (e) {
            console.error("YouTube processing failed:", e);
            throw e; // Let the caller handle the alert/logging
        }
    }
};
