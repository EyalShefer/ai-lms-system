/**
 * Gemini Image Generation Service
 * Uses Gemini 2.5 Flash Image or Gemini 3 Pro Image for high-quality Hebrew infographics
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenAI, Modality } from '@google/genai';

// Model options - Gemini 3 Pro Image is best for Hebrew text
const GEMINI_IMAGE_MODELS = {
    flash: 'gemini-2.5-flash-image',      // Fast, cheaper
    pro: 'gemini-3-pro-image-preview'     // Higher quality, better Hebrew
} as const;

// Default to Pro for best Hebrew support
const DEFAULT_MODEL = GEMINI_IMAGE_MODELS.pro;

/**
 * Cloud Function: generateGeminiImage
 * Generates images using Gemini's native image generation
 *
 * Request body:
 * - prompt: string (required) - The image generation prompt
 * - model: 'flash' | 'pro' (optional) - Model to use, defaults to 'pro'
 * - userId: string (optional) - For rate limiting
 */
export const generateGeminiImage = onRequest(
    {
        cors: true,
        memory: '512MiB',
        timeoutSeconds: 120,
        region: 'us-central1'
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
        const { prompt, model = 'pro' } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({ error: 'Missing or invalid prompt' });
            return;
        }

        // 4. Select model
        const modelName = model === 'flash'
            ? GEMINI_IMAGE_MODELS.flash
            : GEMINI_IMAGE_MODELS.pro;

        logger.info(`Generating image with ${modelName}`, {
            promptLength: prompt.length,
            model: modelName
        });

        const startTime = Date.now();

        try {
            // 5. Initialize Gemini client
            // Uses Application Default Credentials from Cloud Functions environment
            const client = new GoogleGenAI({
                vertexai: true,
                project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
                location: 'us-central1'
            });

            // 6. Generate image
            const response = await client.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                }
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
                model: modelName,
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
                    model: modelName,
                    generationTime,
                    cost: model === 'flash' ? 0.02 : 0.04 // Approximate costs
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
