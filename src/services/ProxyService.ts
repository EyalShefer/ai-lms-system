import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { withRetry, withTimeout, getErrorMessage } from '../utils/errorHandling';

/**
 * Message format compatible with OpenAI/Gemini
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Options for chat completion
 */
export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: 'json_object' | 'text' };
}

/**
 * Call Gemini Chat via Cloud Function
 * Replaces OpenAI chat completions
 */
export const callGeminiChat = async (
    messages: ChatMessage[],
    options?: ChatOptions
): Promise<string> => {
    return await withRetry(
        async () => {
            return await withTimeout(
                async () => {
                    const geminiChatFn = httpsCallable(functions, 'geminiChat', {
                        timeout: 120000 // 2 minutes
                    });

                    const result = await geminiChatFn({ messages, options });
                    const data = result.data as { content: string; type: string };

                    return data.content;
                },
                120000,
                'הבקשה ארכה זמן רב מדי. נסה שוב.'
            );
        },
        {
            maxRetries: 3,
            initialDelay: 1000,
            backoffMultiplier: 2,
            onRetry: (attempt, error) => {
                console.warn(
                    `[Gemini Retry] Attempt ${attempt}/3:`,
                    getErrorMessage(error)
                );
            },
            shouldRetry: (error: Error) => {
                const message = error.message.toLowerCase();
                // Don't retry on auth errors or invalid requests
                if (message.includes('unauthenticated') || message.includes('invalid-argument')) {
                    return false;
                }
                // Retry on network errors, timeouts, and server errors
                return (
                    message.includes('network') ||
                    message.includes('timeout') ||
                    message.includes('internal') ||
                    message.includes('unavailable') ||
                    message.includes('502') ||
                    message.includes('503') ||
                    message.includes('bad gateway') ||
                    message.includes('service unavailable')
                );
            }
        }
    );
};

/**
 * Call Gemini Chat and parse JSON response
 */
export const callGeminiJSON = async <T = any>(
    messages: ChatMessage[],
    options?: Omit<ChatOptions, 'responseFormat'>
): Promise<T> => {
    const content = await callGeminiChat(messages, {
        ...options,
        responseFormat: { type: 'json_object' }
    });

    try {
        return JSON.parse(content) as T;
    } catch (error) {
        console.error('Failed to parse Gemini JSON response:', content.substring(0, 500));
        throw new Error('תשובה לא תקינה מהשרת');
    }
};

/**
 * Legacy callAI function for backwards compatibility
 * @deprecated Use callGeminiChat instead
 */
export const callAI = async (endpoint: string, payload: any): Promise<any> => {
    // Convert OpenAI format to Gemini format
    if (endpoint.includes('/chat/completions')) {
        const messages = payload.messages as ChatMessage[];
        const content = await callGeminiChat(messages, {
            temperature: payload.temperature,
            maxTokens: payload.max_tokens,
            responseFormat: payload.response_format
        });

        // Return in OpenAI-compatible format
        return {
            choices: [{
                message: {
                    role: 'assistant',
                    content
                }
            }]
        };
    }

    throw new Error(`Unsupported endpoint: ${endpoint}. Use callGeminiChat directly.`);
};
