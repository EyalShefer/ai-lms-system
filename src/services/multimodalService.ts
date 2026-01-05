import { openaiLegacy } from './ai/legacyClient';
// functions will be imported dynamically or from firebase

// Error codes matching backend
export const TRANSCRIPTION_ERROR_CODES = {
    NO_CAPTIONS: 'NO_CAPTIONS',
    PRIVATE_VIDEO: 'PRIVATE_VIDEO',
    VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    WHISPER_FAILED: 'WHISPER_FAILED',
    INVALID_URL: 'INVALID_URL',
    UNKNOWN: 'UNKNOWN'
} as const;

export type TranscriptionErrorCode = typeof TRANSCRIPTION_ERROR_CODES[keyof typeof TRANSCRIPTION_ERROR_CODES];

export interface TranscriptionError extends Error {
    code: TranscriptionErrorCode;
    userMessage: string;
}

export interface TranscriptionResult {
    text: string;
    metadata?: {
        source: 'captions' | 'whisper';
        originalLanguage: string;
        wasTranslated: boolean;
        characterCount: number;
    };
}

// Helper to create typed errors
function createTranscriptionError(code: TranscriptionErrorCode, userMessage: string): TranscriptionError {
    const error = new Error(userMessage) as TranscriptionError;
    error.code = code;
    error.userMessage = userMessage;
    return error;
}

// Helper to extract error details from Firebase error
function parseFirebaseError(error: any): { code: TranscriptionErrorCode; userMessage: string } {
    // Firebase HttpsError format
    if (error?.details?.code) {
        return {
            code: error.details.code as TranscriptionErrorCode,
            userMessage: error.details.userMessage || 'שגיאה בתמלול הסרטון'
        };
    }

    // Check error message for common issues
    const msg = error?.message?.toLowerCase() || '';

    if (msg.includes('private') || msg.includes('permission')) {
        return {
            code: TRANSCRIPTION_ERROR_CODES.PRIVATE_VIDEO,
            userMessage: 'הסרטון פרטי ולא ניתן לגשת אליו'
        };
    }

    if (msg.includes('not found') || msg.includes('unavailable') || msg.includes('404')) {
        return {
            code: TRANSCRIPTION_ERROR_CODES.VIDEO_NOT_FOUND,
            userMessage: 'הסרטון לא נמצא או שהוסר'
        };
    }

    if (msg.includes('rate') || msg.includes('429') || msg.includes('quota')) {
        return {
            code: TRANSCRIPTION_ERROR_CODES.RATE_LIMITED,
            userMessage: 'יותר מדי בקשות. נסו שוב בעוד דקה.'
        };
    }

    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch')) {
        return {
            code: TRANSCRIPTION_ERROR_CODES.NETWORK_ERROR,
            userMessage: 'בעיית רשת. בדקו את החיבור ונסו שוב.'
        };
    }

    if (msg.includes('caption') || msg.includes('subtitle') || msg.includes('transcript')) {
        return {
            code: TRANSCRIPTION_ERROR_CODES.NO_CAPTIONS,
            userMessage: 'לסרטון אין כתוביות זמינות. נסו להעתיק את התמליל ידנית מיוטיוב.'
        };
    }

    return {
        code: TRANSCRIPTION_ERROR_CODES.UNKNOWN,
        userMessage: 'שגיאה בתמלול הסרטון. נסו שוב או העתיקו את התמליל ידנית.'
    };
}

export const MultimodalService = {
    /**
     * Transcribes an audio file using OpenAI Whisper.
     * @param file - The audio file (mp3, wav, etc.)
     * @returns The transcribed text.
     */
    transcribeAudio: async (file: File): Promise<string | null> => {
        try {
            // Validate file size (Whisper limit is 25MB)
            if (file.size > 25 * 1024 * 1024) {
                console.error("Audio file too large:", file.size);
                throw createTranscriptionError(
                    TRANSCRIPTION_ERROR_CODES.UNKNOWN,
                    'קובץ האודיו גדול מדי (מקסימום 25MB)'
                );
            }

            const transcription = await openaiLegacy.audio.transcriptions.create({
                file: file,
                model: "whisper-1",
                language: "he", // Optimize for Hebrew
            });

            return transcription.text;
        } catch (e: any) {
            console.error("Transcription failed:", e);

            // Re-throw if already a TranscriptionError
            if (e.code && e.userMessage) {
                throw e;
            }

            throw createTranscriptionError(
                TRANSCRIPTION_ERROR_CODES.WHISPER_FAILED,
                'תמלול הקובץ נכשל. נסו קובץ אחר או פורמט אחר.'
            );
        }
    },

    /**
     * Validates a YouTube URL and extracts the video ID.
     * @param url - YouTube video URL
     * @returns Video ID or null if invalid.
     */
    validateYouTubeUrl: (url: string): string | null => {
        if (!url || typeof url !== 'string') return null;

        // Clean the URL
        const cleanUrl = url.trim();

        // Multiple regex patterns to catch various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
            /^([a-zA-Z0-9_-]{11})$/ // Just the video ID
        ];

        for (const pattern of patterns) {
            const match = cleanUrl.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }

        return null;
    },

    /**
     * Calls the backend function to transcribe a YouTube video.
     * Uses multiple strategies: YouTube captions → Whisper fallback → Translation
     *
     * @param url - Valid YouTube URL
     * @returns TranscriptionResult with text and metadata
     * @throws TranscriptionError with specific error code and user message
     */
    processYoutubeUrl: async (url: string): Promise<TranscriptionResult> => {
        // Validate URL first
        const videoId = MultimodalService.validateYouTubeUrl(url);
        if (!videoId) {
            throw createTranscriptionError(
                TRANSCRIPTION_ERROR_CODES.INVALID_URL,
                'הקישור שהזנת לא תקין. וודאו שזה קישור ליוטיוב.'
            );
        }

        try {
            console.log(`🎬 Processing YouTube video: ${videoId}`);

            // Lazy load Firebase functions
            const { functions } = await import('../firebase');
            const { httpsCallable } = await import('firebase/functions');

            const transcribeFn = httpsCallable(functions, 'transcribeYoutube', {
                timeout: 300000 // 5 minute timeout to match backend
            });

            // Send videoId AND url (backup)
            const result = await transcribeFn({ videoId, url });

            const data = result.data as TranscriptionResult;

            // Validate response
            if (!data?.text || data.text.length < 10) {
                throw createTranscriptionError(
                    TRANSCRIPTION_ERROR_CODES.NO_CAPTIONS,
                    'לא הצלחנו לחלץ טקסט מהסרטון. נסו להעתיק את התמליל ידנית מיוטיוב.'
                );
            }

            console.log(`✅ Transcription successful: ${data.text.length} characters`);

            // Log metadata if available
            if (data.metadata) {
                console.log(`📊 Source: ${data.metadata.source}, Translated: ${data.metadata.wasTranslated}`);
            }

            return data;

        } catch (e: any) {
            console.error("YouTube processing failed:", e);

            // Re-throw if already a TranscriptionError
            if (e.code && e.userMessage) {
                throw e;
            }

            // Parse Firebase error
            const { code, userMessage } = parseFirebaseError(e);
            throw createTranscriptionError(code, userMessage);
        }
    },

    /**
     * Get user-friendly error message for display
     */
    getErrorMessage: (error: any): string => {
        if (error?.userMessage) {
            return error.userMessage;
        }

        const { userMessage } = parseFirebaseError(error);
        return userMessage;
    },

    /**
     * Check if error is retryable
     */
    isRetryableError: (error: any): boolean => {
        const code = error?.code || parseFirebaseError(error).code;

        return [
            TRANSCRIPTION_ERROR_CODES.NETWORK_ERROR,
            TRANSCRIPTION_ERROR_CODES.RATE_LIMITED,
            TRANSCRIPTION_ERROR_CODES.UNKNOWN
        ].includes(code);
    }
};
