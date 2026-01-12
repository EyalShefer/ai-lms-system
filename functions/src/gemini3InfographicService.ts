/**
 * Gemini 3 Pro Infographic Service
 * Cloud Function to generate infographic HTML using Gemini 3 Pro Preview
 *
 * This endpoint generates high-quality HTML for Hebrew infographics
 * The frontend converts the HTML to an image using html-to-image
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getAuth } from 'firebase-admin/auth';
import { generateInfographicHTML, isGemini3TextAvailable } from './services/gemini3TextService';

/**
 * Cloud Function: generateGemini3Infographic
 * Generates infographic HTML using Gemini 3 Pro Preview via Vertex AI
 *
 * Request body:
 * - content: string (required) - Educational content in Hebrew
 * - visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle' (required)
 * - topic: string (optional) - Topic name for context
 */
export const generateGemini3Infographic = onRequest(
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

        // 3. Check if Gemini 3 Pro is available
        if (!isGemini3TextAvailable()) {
            res.status(503).json({
                error: 'Gemini 3 Pro is not available',
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

        logger.info('Generating infographic with Gemini 3 Pro', {
            contentLength: content.length,
            visualType,
            topic
        });

        const startTime = Date.now();

        try {
            // 5. Generate HTML using Gemini 3 Pro
            const html = await generateInfographicHTML(content, visualType, topic);

            if (!html) {
                res.status(500).json({
                    error: 'Failed to generate infographic HTML',
                    code: 'GENERATION_FAILED'
                });
                return;
            }

            const generationTime = Date.now() - startTime;

            logger.info(`Infographic HTML generated successfully in ${generationTime}ms`, {
                visualType,
                htmlLength: html.length
            });

            // 6. Return successful response
            res.status(200).json({
                success: true,
                html,
                metadata: {
                    model: 'gemini-3-pro-preview',
                    visualType,
                    generationTime,
                    estimatedCost: 0.002 // Approximate cost per request
                }
            });

        } catch (error: any) {
            logger.error('Gemini 3 Pro infographic generation failed:', error);

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
