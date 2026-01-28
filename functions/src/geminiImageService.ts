/**
 * Gemini Image Generation Service
 * Uses Gemini 3 Pro Image for high-quality Hebrew infographics
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI, Modality } from '@google/genai';
import { withGeminiRetry } from './utils/retry';

// Google AI Studio API Key
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Single model for all image generation
const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image-preview';

/**
 * Cloud Function: generateGeminiImage
 * Generates images using Gemini 3 Pro Image
 *
 * Request body:
 * - prompt: string (required) - The image generation prompt
 * - userId: string (optional) - For rate limiting
 */
export const generateGeminiImage = onRequest(
    {
        cors: true,
        memory: '512MiB',
        timeoutSeconds: 120,
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
            res.status(401).json({ error: 'נדרשת הזדהות', code: 'UNAUTHORIZED' });
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];
        try {
            const auth = getAuth();
            await auth.verifyIdToken(idToken);
        } catch (error) {
            logger.error('Invalid Firebase token:', error);
            res.status(401).json({ error: 'נדרשת הזדהות', code: 'UNAUTHORIZED' });
            return;
        }

        // 3. Extract request data
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({ error: 'Missing or invalid prompt' });
            return;
        }

        logger.info(`Generating image with ${GEMINI_IMAGE_MODEL}`, {
            promptLength: prompt.length
        });

        const startTime = Date.now();

        try {
            // 5. Initialize Gemini client (Google AI Studio ONLY - no Vertex AI)
            // Clean API key - remove any BOM or invisible characters
            const rawKey = geminiApiKey.value();
            const cleanKey = rawKey.replace(/[^\x20-\x7E]/g, '').trim();

            logger.info('API Key debug', {
                rawLength: rawKey.length,
                cleanLength: cleanKey.length,
                startsWithAI: cleanKey.startsWith('AIza'),
                firstChars: cleanKey.substring(0, 10)
            });

            const client = new GoogleGenAI({
                apiKey: cleanKey,
                vertexai: false
            });

            // 6. Generate image with retry logic
            const response = await withGeminiRetry(async () => {
                return client.models.generateContent({
                    model: GEMINI_IMAGE_MODEL,
                    contents: prompt,
                    config: {
                        responseModalities: [Modality.IMAGE, Modality.TEXT],
                    }
                });
            });

            // 7. Extract image from response
            const parts = response.candidates?.[0]?.content?.parts;

            if (!parts || parts.length === 0) {
                logger.error('No parts in response', { response: JSON.stringify(response) });
                res.status(500).json({
                    error: 'No image generated',
                    details: 'Response contained no parts'
                });
                return;
            }

            // Find the image part
            const imagePart = parts.find(part => part.inlineData?.mimeType?.startsWith('image/'));

            if (!imagePart || !imagePart.inlineData) {
                logger.error('No image in response parts', {
                    partsTypes: parts.map(p => p.inlineData?.mimeType || 'text')
                });
                res.status(500).json({
                    error: 'No image in response',
                    details: 'Response did not contain an image'
                });
                return;
            }

            const generationTime = Date.now() - startTime;

            logger.info(`Image generated successfully in ${generationTime}ms`, {
                model: GEMINI_IMAGE_MODEL,
                mimeType: imagePart.inlineData.mimeType
            });

            // 8. Return successful response
            res.status(200).json({
                success: true,
                image: {
                    base64: imagePart.inlineData.data,
                    mimeType: imagePart.inlineData.mimeType || 'image/png'
                },
                metadata: {
                    model: GEMINI_IMAGE_MODEL,
                    generationTime,
                    cost: 0.04
                }
            });

        } catch (error: any) {
            logger.error('Gemini image generation failed:', error);

            // Handle specific error types
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
                error: 'Image generation failed',
                details: error.message || 'Unknown error'
            });
        }
    }
);
