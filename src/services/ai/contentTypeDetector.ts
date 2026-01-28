/**
 * Content Type Detector - STUB
 *
 * This is a minimal stub to keep V1 SmartCreationChat compiling.
 * V2 uses Gemini function calling instead (no content type detection).
 *
 * @deprecated Use SmartCreationChatV2 with VITE_USE_SUPER_AGENT_V2=true
 */

export type ContentDeliveryMode = 'interactive' | 'static' | 'ambiguous';

export interface ContentTypeAnalysis {
    mode: ContentDeliveryMode;
    confidence: number;
    suggestedQuestion?: string;
    signals: {
        interactive: string[];
        static: string[];
    };
}

/**
 * @deprecated Gemini decides content type in V2
 */
export function detectContentType(_text: string): ContentTypeAnalysis {
    console.warn('[contentTypeDetector] DEPRECATED - V2 uses Gemini function calling');
    return {
        mode: 'ambiguous',
        confidence: 0,
        signals: { interactive: [], static: [] }
    };
}

/**
 * @deprecated Gemini decides content type in V2
 */
export function resolveAmbiguity(_response: string, _analysis: ContentTypeAnalysis): ContentDeliveryMode {
    console.warn('[contentTypeDetector] DEPRECATED - V2 uses Gemini function calling');
    return 'interactive';
}

/**
 * @deprecated Gemini decides content type in V2
 */
export function createDisambiguationQuestion(_analysis: ContentTypeAnalysis): string {
    console.warn('[contentTypeDetector] DEPRECATED - V2 uses Gemini function calling');
    return 'Would you like interactive questions or static content?';
}
