/**
 * Gemini 3 Pro Text Service
 * Uses Gemini 3 Pro Preview via Google GenAI SDK for high-quality HTML generation
 * Model: gemini-3-pro-preview
 *
 * This service generates HTML for infographics which can then be converted to images
 */

import * as logger from 'firebase-functions/logger';
import { GoogleGenAI } from '@google/genai';

// Configuration for Gemini 3 Pro (Text)
// IMPORTANT: gemini-3-pro-preview is only available on GLOBAL endpoints
export const GEMINI3_TEXT_CONFIG = {
    model: 'gemini-3-pro-preview',
    location: 'global',  // Must be 'global' for Gemini 3 Pro Preview
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT
};

/**
 * Check if Gemini 3 Pro is available
 */
export const isGemini3TextAvailable = (): boolean => {
    const hasProjectId = !!GEMINI3_TEXT_CONFIG.projectId;
    const isEnabled = process.env.ENABLE_GEMINI3 !== 'false';
    return hasProjectId && isEnabled;
};

/**
 * Generate HTML for infographic using Gemini 3 Pro
 *
 * @param content - Educational content in Hebrew
 * @param visualType - Type of infographic
 * @param topic - Optional topic name
 * @returns HTML string or null on failure
 */
export const generateInfographicHTML = async (
    content: string,
    visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle',
    topic?: string
): Promise<string | null> => {
    if (!isGemini3TextAvailable()) {
        logger.warn('Gemini 3 Pro is not available');
        return null;
    }

    try {
        logger.info('🎨 Generating infographic HTML with Gemini 3 Pro...', {
            visualType,
            topic,
            contentLength: content.length
        });

        const startTime = Date.now();

        // Initialize Google GenAI client with Vertex AI (supports global endpoint)
        const client = new GoogleGenAI({
            vertexai: true,
            project: GEMINI3_TEXT_CONFIG.projectId!,
            location: GEMINI3_TEXT_CONFIG.location  // 'global' for Gemini 3 Pro
        });

        // Build the prompt
        const systemPrompt = `You are an expert HTML/CSS developer specializing in Hebrew educational infographics.

CRITICAL RULES:
1. Output ONLY valid HTML code - no explanations, no markdown code blocks
2. All text MUST be in Hebrew with dir="rtl"
3. Keep the design SIMPLE and CLEAN - maximum 4-5 main elements
4. Use large, readable fonts (minimum 24px for body text, 48px for titles)
5. High contrast colors on gradient backgrounds
6. The output will be rendered at exactly 1024x1024px
7. Use inline styles only (no external CSS)
8. Include a beautiful gradient background`;

        const promptTemplates: Record<string, string> = {
            flowchart: `Create a flowchart infographic HTML.
- Use vertical flow with arrows between boxes
- Each step in a white rounded box with shadow
- Numbered circles for steps
- Gradient background (purple to blue)`,

            timeline: `Create a timeline infographic HTML.
- Horizontal timeline from right to left (RTL)
- Events above and below the timeline
- Milestone circles on the line
- Gradient background (orange to red)`,

            comparison: `Create a comparison infographic HTML.
- Two columns side by side
- Right column in blue theme, left in red
- Clear headers for each side
- Gradient background (gray to white)`,

            cycle: `Create a cycle diagram infographic HTML.
- Circular arrangement of 4-6 steps
- Arrows showing clockwise flow
- Central circle with title
- Gradient background (green to teal)`
        };

        const userPrompt = `${promptTemplates[visualType]}

Topic: ${topic || 'Educational Content'}

Content to visualize:
${content.substring(0, 1500)}

Generate ONLY the HTML code, no explanations.`;

        // Generate content using Google GenAI SDK
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const response = await client.models.generateContent({
            model: GEMINI3_TEXT_CONFIG.model,
            contents: fullPrompt,
            config: {
                temperature: 0.5,
                maxOutputTokens: 8192
            }
        });

        const generationTime = Date.now() - startTime;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            // Clean up the response (remove markdown code blocks if present)
            const htmlCode = text
                .replace(/```html\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            logger.info('✅ Gemini 3 Pro HTML generation successful', {
                generationTime: `${generationTime}ms`,
                htmlLength: htmlCode.length
            });

            return htmlCode;
        }

        logger.error('❌ Gemini 3 Pro: No text in response');
        return null;

    } catch (error: any) {
        logger.error('❌ Gemini 3 Pro text generation failed:', {
            error: error.message,
            code: error.code
        });
        return null;
    }
};
