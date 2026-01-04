/**
 * Text-to-Speech Service for Lesson Plan Scripts
 *
 * Uses Web Speech API for instant, free Hebrew TTS playback.
 * Fallback to ElevenLabs for high-quality exports (optional).
 */

export interface TTSOptions {
    lang?: string;
    rate?: number; // 0.1 to 10 (default: 1)
    pitch?: number; // 0 to 2 (default: 1)
    volume?: number; // 0 to 1 (default: 1)
}

class TextToSpeechService {
    private synthesis: SpeechSynthesis;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
    private isPaused: boolean = false;

    constructor() {
        this.synthesis = window.speechSynthesis;
    }

    /**
     * Check if TTS is supported in the browser
     */
    isSupported(): boolean {
        return 'speechSynthesis' in window;
    }

    /**
     * Get available Hebrew voices
     */
    getHebrewVoices(): SpeechSynthesisVoice[] {
        const voices = this.synthesis.getVoices();
        return voices.filter(voice =>
            voice.lang.startsWith('he') ||
            voice.lang.startsWith('iw') // Old Hebrew language code
        );
    }

    /**
     * Get the best available Hebrew voice
     */
    getBestHebrewVoice(): SpeechSynthesisVoice | null {
        const hebrewVoices = this.getHebrewVoices();

        if (hebrewVoices.length === 0) {
            console.warn('No Hebrew voices found. Falling back to default voice.');
            return null;
        }

        // Prefer local voices for better quality
        const localVoice = hebrewVoices.find(v => v.localService);
        if (localVoice) return localVoice;

        // Otherwise return first available
        return hebrewVoices[0];
    }

    /**
     * Speak the given text
     *
     * @param text - The text to speak (in Hebrew)
     * @param options - TTS options (rate, pitch, volume)
     * @returns Promise that resolves when speech is complete
     */
    speak(text: string, options: TTSOptions = {}): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isSupported()) {
                reject(new Error('Text-to-Speech is not supported in this browser'));
                return;
            }

            // Stop any ongoing speech
            this.stop();

            const utterance = new SpeechSynthesisUtterance(text);

            // Set voice
            const hebrewVoice = this.getBestHebrewVoice();
            if (hebrewVoice) {
                utterance.voice = hebrewVoice;
            }

            // Set language
            utterance.lang = options.lang || 'he-IL';

            // Set voice parameters
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 1.0;

            // Event handlers
            utterance.onend = () => {
                this.currentUtterance = null;
                this.isPaused = false;
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('TTS Error:', event);
                this.currentUtterance = null;
                this.isPaused = false;
                reject(event);
            };

            this.currentUtterance = utterance;
            this.synthesis.speak(utterance);
        });
    }

    /**
     * Pause the current speech
     */
    pause(): void {
        if (this.synthesis.speaking && !this.isPaused) {
            this.synthesis.pause();
            this.isPaused = true;
        }
    }

    /**
     * Resume paused speech
     */
    resume(): void {
        if (this.isPaused) {
            this.synthesis.resume();
            this.isPaused = false;
        }
    }

    /**
     * Stop the current speech
     */
    stop(): void {
        if (this.synthesis.speaking || this.isPaused) {
            this.synthesis.cancel();
            this.currentUtterance = null;
            this.isPaused = false;
        }
    }

    /**
     * Check if currently speaking
     */
    isSpeaking(): boolean {
        return this.synthesis.speaking;
    }

    /**
     * Check if paused
     */
    isCurrentlyPaused(): boolean {
        return this.isPaused;
    }

    /**
     * Speak a lesson script with natural pauses
     * Adds automatic pauses at sentence boundaries for better listening experience
     *
     * @param script - The lesson script to speak
     * @param options - TTS options
     */
    async speakLessonScript(script: string, options: TTSOptions = {}): Promise<void> {
        // Split script into sentences for natural pauses
        const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];

        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed) {
                await this.speak(trimmed, options);
                // Small pause between sentences (handled by TTS naturally)
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }
}

// Export singleton instance
export const ttsService = new TextToSpeechService();

// Ensure voices are loaded (some browsers need this)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log('TTS voices loaded:', window.speechSynthesis.getVoices().length);
    };
}
