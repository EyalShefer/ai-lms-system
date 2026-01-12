/**
 * Imagen 4 Service
 * Uses Google's Imagen 4 for high-quality image generation
 * Model: imagen-4.0-generate-001
 *
 * This is a REAL image generation model (not HTML to image)
 */

import * as logger from 'firebase-functions/logger';

// Configuration for Imagen 4
export const IMAGEN4_CONFIG = {
    model: 'imagen-4.0-generate-001',
    location: 'us-central1',  // Imagen 4 is available in us-central1
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
};

/**
 * Check if Imagen 4 is available
 */
export const isImagen4Available = (): boolean => {
    const hasProjectId = !!IMAGEN4_CONFIG.projectId;
    const isEnabled = process.env.ENABLE_IMAGEN4 !== 'false';
    return hasProjectId && isEnabled;
};

/**
 * Generate infographic image using Imagen 4
 *
 * @param content - Educational content in Hebrew
 * @param visualType - Type of infographic
 * @param topic - Optional topic name
 * @returns Base64 PNG image or null on failure
 */
export const generateInfographicWithImagen4 = async (
    content: string,
    visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle',
    topic?: string
): Promise<{ base64: string; mimeType: string } | null> => {
    if (!isImagen4Available()) {
        logger.warn('Imagen 4 is not available');
        return null;
    }

    try {
        logger.info('🎨 Generating infographic with Imagen 4...', {
            visualType,
            topic,
            contentLength: content.length
        });

        const startTime = Date.now();

        // Dynamic import to avoid cold start delays
        const { VertexAI } = await import('@google-cloud/vertexai');

        // Initialize Vertex AI client
        const vertexAI = new VertexAI({
            project: IMAGEN4_CONFIG.projectId!,
            location: IMAGEN4_CONFIG.location
        });

        // Build infographic-specific prompt
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

        const prompt = promptTemplates[visualType];

        // Use Imagen 4 for image generation
        // @ts-ignore - Imagen API may have different types
        const imageModel = vertexAI.preview.getImageGenerationModel({
            model: IMAGEN4_CONFIG.model
        });

        // @ts-ignore
        const result = await imageModel.generateImages({
            prompt: prompt,
            numberOfImages: 1,
            aspectRatio: '1:1',
            // @ts-ignore
            sampleImageStyle: 'digital_art'
        });

        const generationTime = Date.now() - startTime;

        // @ts-ignore
        if (result.images && result.images.length > 0) {
            // @ts-ignore
            const image = result.images[0];
            const base64 = image.bytesBase64Encoded;

            logger.info('✅ Imagen 4 generation successful', {
                generationTime: `${generationTime}ms`,
                imageSize: `${Math.round(base64.length * 0.75 / 1024)}KB`
            });

            return {
                base64,
                mimeType: 'image/png'
            };
        }

        logger.error('❌ Imagen 4: No image in response');
        return null;

    } catch (error: any) {
        logger.error('❌ Imagen 4 generation failed:', {
            error: error.message,
            code: error.code
        });
        return null;
    }
};
