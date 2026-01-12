/**
 * Imagen 4 Infographic Service
 * Cloud Function to generate REAL infographic images using Imagen 4
 *
 * This generates actual AI-generated images, not HTML conversions
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getAuth } from 'firebase-admin/auth';
import { generateInfographicWithImagen4, isImagen4Available } from './services/imagen4Service';

/**
 * Cloud Function: generateImagen4Infographic
 * Generates real infographic images using Imagen 4
 *
 * Request body:
 * - content: string (required) - Educational content in Hebrew
 * - visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle' (required)
 * - topic: string (optional) - Topic name for context
 */
export const generateImagen4Infographic = onRequest(
    {
        cors: true,
        memory: '1GiB',
        timeoutSeconds: 180,
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

        // 3. Check if Imagen 4 is available
        if (!isImagen4Available()) {
            res.status(503).json({
                error: 'Imagen 4 is not available',
                code: 'SERVICE_UNAVAILABLE'
            });
            return;
        }

        // 4. Extract request data
        const { content, visualType, topic } = req.body;

        if (!content || typeof content !== 'string') {
            res.status(400).json({ error: 'Missing or invalid content' });
            return;
        }

        if (!visualType || !['flowchart', 'timeline', 'comparison', 'cycle'].includes(visualType)) {
            res.status(400).json({ error: 'Invalid visualType. Must be: flowchart, timeline, comparison, or cycle' });
            return;
        }

        logger.info('🎨 Generating infographic with Imagen 4', {
            contentLength: content.length,
            visualType,
            topic
        });

        const startTime = Date.now();

        try {
            // 5. Generate image using Imagen 4
            const result = await generateInfographicWithImagen4(content, visualType, topic);

            if (!result) {
                res.status(500).json({
                    error: 'Failed to generate infographic image',
                    code: 'GENERATION_FAILED'
                });
                return;
            }

            const generationTime = Date.now() - startTime;

            logger.info(`✅ Imagen 4 infographic generated successfully in ${generationTime}ms`, {
                visualType,
                imageSize: `${Math.round(result.base64.length * 0.75 / 1024)}KB`
            });

            // 6. Return successful response with base64 image
            res.status(200).json({
                success: true,
                image: {
                    base64: result.base64,
                    mimeType: result.mimeType
                },
                metadata: {
                    model: 'imagen-4.0-generate-001',
                    visualType,
                    generationTime,
                    estimatedCost: 0.04 // Approximate cost per image
                }
            });

        } catch (error: any) {
            logger.error('Imagen 4 infographic generation failed:', error);

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
