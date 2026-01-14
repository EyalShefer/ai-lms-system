/**
 * Gemini 3 Pro Service
 * Unified service for all LLM text generation using Gemini 3 Pro
 * Uses Google AI Studio (not Vertex AI)
 *
 * ============================================================
 * IMPORTANT: DO NOT CHANGE THE MODEL WITHOUT EXPLICIT APPROVAL
 * See AI_MODELS_POLICY.md for approved models.
 * Approved: gemini-3-pro-preview (text), gemini-3-pro-image-preview (images)
 * ============================================================
 */

import * as logger from 'firebase-functions/logger';
import { GoogleGenAI } from '@google/genai';

// Configuration
// WARNING: Do not change without approval - see AI_MODELS_POLICY.md
export const GEMINI_CONFIG = {
    model: 'gemini-3-pro-preview'
};

// Singleton client with API key
let geminiClient: GoogleGenAI | null = null;

/**
 * Get or create Gemini client (lazy initialization from environment)
 */
const getClient = (): GoogleGenAI => {
    if (!geminiClient) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        geminiClient = new GoogleGenAI({ apiKey });
        logger.info('Gemini client initialized with Google AI Studio');
    }
    return geminiClient;
};

/**
 * Check if Gemini is available
 */
export const isGeminiAvailable = (): boolean => {
    return !!process.env.GEMINI_API_KEY;
};

/**
 * Message format compatible with OpenAI structure
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

/**
 * Generate text using Gemini 2.5 Pro
 * Drop-in replacement for OpenAI chat completions
 *
 * @param messages - Array of messages in OpenAI format
 * @param options - Generation options
 * @returns Generated text content
 */
export const generateText = async (
    messages: ChatMessage[],
    options: {
        temperature?: number;
        maxTokens?: number;
        responseFormat?: { type: 'json_object' | 'text' };
    } = {}
): Promise<string> => {
    const client = getClient();
    const startTime = Date.now();

    try {
        // Convert OpenAI message format to Gemini format
        let systemPrompt = '';
        const conversationParts: string[] = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.map(c => c.text || '').join('\n');
            } else if (msg.role === 'user' || msg.role === 'assistant') {
                const prefix = msg.role === 'user' ? 'User: ' : 'Assistant: ';
                const content = typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.map(c => c.text || '').join('\n');
                conversationParts.push(`${prefix}${content}`);
            }
        }

        // Build full prompt
        let fullPrompt = systemPrompt ? `${systemPrompt}\n\n` : '';
        fullPrompt += conversationParts.join('\n\n');

        // Add JSON instruction if needed
        if (options.responseFormat?.type === 'json_object') {
            fullPrompt += '\n\nIMPORTANT: Respond with valid JSON only. No explanations or markdown.';
        }

        // Generate content
        const response = await client.models.generateContent({
            model: GEMINI_CONFIG.model,
            contents: fullPrompt,
            config: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? 16384  // Increased from 4096 to handle large JSON responses
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const generationTime = Date.now() - startTime;

        // Check for empty response
        if (!text || text.trim().length === 0) {
            logger.warn('Gemini returned empty response', {
                model: GEMINI_CONFIG.model,
                promptLength: fullPrompt.length,
                response: JSON.stringify(response).substring(0, 500)
            });
        }

        logger.info('Gemini 2.5 Pro generation completed', {
            model: GEMINI_CONFIG.model,
            inputLength: fullPrompt.length,
            outputLength: text.length,
            generationTime: `${generationTime}ms`
        });

        return text;

    } catch (error: any) {
        logger.error('Gemini 2.5 Pro generation failed:', {
            error: error.message,
            code: error.code
        });
        throw error;
    }
};

/**
 * Generate text with vision (image analysis)
 * Replacement for GPT-4o vision
 *
 * @param prompt - Text prompt
 * @param imageBase64 - Base64 encoded image
 * @param mimeType - Image mime type
 * @returns Generated text analysis
 */
export const generateWithVision = async (
    prompt: string,
    imageBase64: string,
    mimeType: string = 'image/png',
    options: {
        temperature?: number;
        maxTokens?: number;
    } = {}
): Promise<string> => {
    const client = getClient();
    const startTime = Date.now();

    try {
        const response = await client.models.generateContent({
            model: GEMINI_CONFIG.model,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType,
                                data: imageBase64
                            }
                        }
                    ]
                }
            ],
            config: {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.maxTokens ?? 16384
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const generationTime = Date.now() - startTime;

        logger.info('Gemini 2.5 Pro vision analysis completed', {
            model: GEMINI_CONFIG.model,
            generationTime: `${generationTime}ms`
        });

        return text;

    } catch (error: any) {
        logger.error('Gemini 2.5 Pro vision analysis failed:', {
            error: error.message,
            code: error.code
        });
        throw error;
    }
};

/**
 * Generate structured JSON response
 *
 * @param prompt - Full prompt including instructions
 * @param schema - Expected JSON schema description
 * @returns Parsed JSON object
 */
export const generateJSON = async <T = any>(
    messages: ChatMessage[],
    options: {
        temperature?: number;
        maxTokens?: number;
    } = {}
): Promise<T> => {
    const text = await generateText(messages, {
        ...options,
        responseFormat: { type: 'json_object' }
    });

    // Check for empty response
    if (!text || text.trim().length === 0) {
        logger.error('Empty response from Gemini');
        throw new Error('Empty response from Gemini');
    }

    // Clean up response
    let jsonText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

    // Try to extract JSON object if wrapped in other text
    const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
        jsonText = jsonObjectMatch[0];
    } else {
        // Try to extract JSON array
        const jsonArrayMatch = jsonText.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
            jsonText = jsonArrayMatch[0];
        }
    }

    try {
        return JSON.parse(jsonText) as T;
    } catch (error) {
        logger.error('Failed to parse Gemini JSON response:', {
            text: jsonText.substring(0, 500),
            originalText: text.substring(0, 500)
        });
        throw new Error(`Invalid JSON response from Gemini: ${jsonText.substring(0, 100)}`);
    }
};

/**
 * Estimate token count (approximate)
 */
export const estimateTokens = (text: string): number => {
    // Rough estimate: ~4 characters per token for Hebrew/English mix
    return Math.ceil(text.length / 4);
};

/**
 * Get model cost per 1M tokens (approximate)
 */
export const getModelCost = (): { input: number; output: number } => {
    return {
        input: 1.25,  // $1.25 per 1M input tokens
        output: 5.00  // $5.00 per 1M output tokens
    };
};
