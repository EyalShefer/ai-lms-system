/**
 * Gemini Infographic Service
 * Cloud Function to generate REAL infographic images using Gemini 3 Pro Image
 *
 * This generates actual AI-generated images, not HTML conversions
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI, Modality } from '@google/genai';

// Google AI Studio API Key
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Single model for all infographic generation
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * Build infographic-specific prompt based on visual type
 */
const buildInfographicPrompt = (
    content: string,
    visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle',
    topic?: string
): string => {
    const promptTemplates: Record<string, string> = {
        flowchart: `Create a professional educational flowchart infographic.
Style: Clean, modern design with a gradient background (purple to blue).
Layout: Vertical flow with 4-5 numbered steps connected by arrows.
Text: All text must be in Hebrew (עברית), right-to-left direction.
Elements: White rounded boxes with shadows, colorful numbered circles, directional arrows.
Topic: ${topic || 'Educational Process'}
Content to visualize: ${content.substring(0, 500)}
Requirements: High contrast, large readable text, professional educational style, 1024x1024 square format.`,

        timeline: `Create a professional educational timeline infographic.
Style: Modern horizontal timeline with a warm gradient background (orange to red).
Layout: Timeline axis from right to left (RTL for Hebrew), with events above and below.
Text: All text must be in Hebrew (עברית), right-to-left direction.
Elements: Central timeline line, colorful milestone circles, event cards with dates.
Topic: ${topic || 'Historical Timeline'}
Content to visualize: ${content.substring(0, 500)}
Requirements: Clear chronological order, large readable Hebrew text, professional style, 1024x1024 square format.`,

        comparison: `Create a professional educational comparison infographic.
Style: Clean side-by-side comparison with a neutral gradient background.
Layout: Two columns - right side in blue theme, left side in red/orange theme.
Text: All text must be in Hebrew (עברית), right-to-left direction.
Elements: Clear headers for each column, bullet points with icons, visual separation.
Topic: ${topic || 'Comparison'}
Content to visualize: ${content.substring(0, 500)}
Requirements: Balanced layout, high contrast, large readable Hebrew text, 1024x1024 square format.`,

        cycle: `Create a professional educational cycle diagram infographic.
Style: Circular arrangement with a green to teal gradient background.
Layout: 4-6 stages arranged in a circle with clockwise arrows.
Text: All text must be in Hebrew (עברית), right-to-left direction.
Elements: Central circle with title, colored stage boxes, directional arrows showing flow.
Topic: ${topic || 'Cycle Process'}
Content to visualize: ${content.substring(0, 500)}
Requirements: Clear circular flow, large readable Hebrew text, professional style, 1024x1024 square format.`
    };

    return promptTemplates[visualType];
};

/**
 * Cloud Function: generateGeminiInfographic
 * Generates real infographic images using Gemini 3 Pro Image
 *
 * Request body:
 * - content: string (required) - Educational content in Hebrew
 * - visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle' (required)
 * - topic: string (optional) - Topic name for context
 */
export const generateGeminiInfographic = onRequest(
    {
        cors: true,
        memory: '1GiB',
        timeoutSeconds: 180,
        region: 'us-central1',
        secrets: [geminiApiKey]
    },
    async (req, res) => {
        // 1. Validate Method
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method Not Allowed' });
            return;
        }

        // 2. Authenticate user via Firebase Auth token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Missing or invalid Authorization header');
            res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];
        try {
            const auth = getAuth();
            await auth.verifyIdToken(idToken);
        } catch (error) {
            logger.error('Invalid Firebase token:', error);
            res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
            return;
        }

        // 3. Extract request data
        const { content, visualType, topic } = req.body;

        if (!content || typeof content !== 'string') {
            res.status(400).json({ error: 'Missing or invalid content' });
            return;
        }

        if (!visualType || !['flowchart', 'timeline', 'comparison', 'cycle'].includes(visualType)) {
            res.status(400).json({ error: 'Invalid visualType. Must be: flowchart, timeline, comparison, or cycle' });
            return;
        }

        logger.info('🎨 Generating infographic with Gemini 3 Pro Image', {
            contentLength: content.length,
            visualType,
            topic
        });

        const startTime = Date.now();

        try {
            // 4. Build the prompt
            const prompt = buildInfographicPrompt(content, visualType, topic);

            // 5. Initialize Gemini client (Google AI Studio ONLY - no Vertex AI)
            const client = new GoogleGenAI({
                apiKey: geminiApiKey.value(),
                vertexai: false
            });

            // 6. Generate image
            const response = await client.models.generateContent({
                model: GEMINI_IMAGE_MODEL,
                contents: prompt,
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                }
            });

            // 7. Extract image from response
            const parts = response.candidates?.[0]?.content?.parts;

            if (!parts || parts.length === 0) {
                logger.error('No parts in response');
                res.status(500).json({
                    error: 'Failed to generate infographic image',
                    code: 'GENERATION_FAILED'
                });
                return;
            }

            // Find the image part
            const imagePart = parts.find(part => part.inlineData?.mimeType?.startsWith('image/'));

            if (!imagePart || !imagePart.inlineData) {
                logger.error('No image in response parts');
                res.status(500).json({
                    error: 'No image in response',
                    code: 'GENERATION_FAILED'
                });
                return;
            }

            const generationTime = Date.now() - startTime;

            logger.info(`✅ Gemini 3 Pro Image infographic generated successfully in ${generationTime}ms`, {
                visualType,
                imageSize: `${Math.round((imagePart.inlineData.data?.length || 0) * 0.75 / 1024)}KB`
            });

            // 8. Return successful response with base64 image
            res.status(200).json({
                success: true,
                image: {
                    base64: imagePart.inlineData.data,
                    mimeType: imagePart.inlineData.mimeType || 'image/png'
                },
                metadata: {
                    model: GEMINI_IMAGE_MODEL,
                    visualType,
                    generationTime,
                    estimatedCost: 0.04
                }
            });

        } catch (error: any) {
            logger.error('Gemini 3 Pro Image infographic generation failed:', error);

            if (error.message?.includes('SAFETY')) {
                res.status(400).json({
                    error: 'Content blocked by safety filters',
                    code: 'SAFETY_BLOCK'
                });
                return;
            }

            if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    code: 'RATE_LIMITED'
                });
                return;
            }

            res.status(500).json({
                error: 'Infographic generation failed',
                details: error.message || 'Unknown error'
            });
        }
    }
);
