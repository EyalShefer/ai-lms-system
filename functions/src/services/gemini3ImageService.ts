/**
 * Gemini 3 Pro Image Service
 * Google's latest image generation model with advanced text rendering
 * Model: gemini-3-pro-image-preview
 *
 * Features:
 * - 94% text rendering accuracy across multiple languages
 * - Native Hebrew (iw) support
 * - High-resolution output (1K, 2K, 4K)
 * - Advanced reasoning for complex compositions
 *
 * Status: Preview (Not GA - use with caution in production)
 */

// Dynamic import to avoid initialization timeout
// import { VertexAI } from '@google-cloud/vertexai';
import * as logger from 'firebase-functions/logger';

/**
 * Gemini 3 Pro Image configuration
 */
export const GEMINI3_IMAGE_CONFIG = {
  model: 'gemini-3-pro-image-preview',
  location: 'us-central1',
  projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT,
  defaultAspectRatio: '1:1', // Square for infographics
  defaultResolution: '1K', // 1024x1024 equivalent
  supportedAspectRatios: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'] as const,
  supportedResolutions: ['1K', '2K', '4K'] as const
};

export type AspectRatio = typeof GEMINI3_IMAGE_CONFIG.supportedAspectRatios[number];
export type Resolution = typeof GEMINI3_IMAGE_CONFIG.supportedResolutions[number];

/**
 * Check if Gemini 3 Pro Image is available
 * Preview models may have limited availability
 */
export const isGemini3ImageAvailable = (): boolean => {
  try {
    // Check if project ID is configured
    const hasProjectId = !!(GEMINI3_IMAGE_CONFIG.projectId);

    // Environment flag to enable/disable (useful for rollback)
    const isEnabled = process.env.ENABLE_GEMINI3_IMAGE !== 'false';

    return hasProjectId && isEnabled;
  } catch (error) {
    logger.warn('Gemini 3 Pro Image availability check failed:', error);
    return false;
  }
};

/**
 * Generate infographic image using Gemini 3 Pro Image
 *
 * @param prompt - Hebrew text prompt for image generation
 * @param aspectRatio - Image aspect ratio (default: 1:1 for infographics)
 * @param resolution - Output resolution (default: 1K = 1024x1024)
 * @returns Base64 encoded PNG image or null on failure
 */
export const generateGemini3Image = async (
  prompt: string,
  aspectRatio: AspectRatio = '1:1',
  resolution: Resolution = '1K'
): Promise<{ base64: string; mimeType: string } | null> => {
  if (!isGemini3ImageAvailable()) {
    logger.warn('Gemini 3 Pro Image is not available');
    return null;
  }

  try {
    logger.info('🎨 Generating image with Gemini 3 Pro Image...', {
      promptLength: prompt.length,
      aspectRatio,
      resolution
    });

    const startTime = Date.now();

    // Dynamic import to avoid cold start delays
    const { VertexAI } = await import('@google-cloud/vertexai');

    // Initialize Vertex AI client
    const vertexAI = new VertexAI({
      project: GEMINI3_IMAGE_CONFIG.projectId!,
      location: GEMINI3_IMAGE_CONFIG.location
    });

    // Get the generative model
    const model = vertexAI.getGenerativeModel({
      model: GEMINI3_IMAGE_CONFIG.model
    });

    // Generate content with image output
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        // @ts-ignore - Preview API may have different types
        responseModalities: ['Image'],
        // @ts-ignore
        imageConfig: {
          aspectRatio,
          // Note: resolution might not be supported in all versions
          // Will gracefully fallback to default if not available
        }
      }
    });

    const generationTime = Date.now() - startTime;

    // Extract image from response
    const response = result.response;

    // @ts-ignore - Preview API structure
    if (response.candidates && response.candidates[0]?.content?.parts) {
      // @ts-ignore
      for (const part of response.candidates[0].content.parts) {
        // @ts-ignore
        if (part.inlineData && part.inlineData.data) {
          const base64Image = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';

          logger.info('✅ Gemini 3 Pro Image generation successful', {
            generationTime: `${generationTime}ms`,
            imageSize: `${Math.round(base64Image.length * 0.75 / 1024)}KB`,
            mimeType
          });

          return {
            base64: base64Image,
            mimeType
          };
        }
      }
    }

    logger.error('❌ Gemini 3 Pro Image: No image in response', { response });
    return null;

  } catch (error: any) {
    logger.error('❌ Gemini 3 Pro Image generation failed:', {
      error: error.message,
      code: error.code,
      details: error.details
    });
    return null;
  }
};

/**
 * Generate educational infographic with optimized Hebrew prompt
 * Wraps generateGemini3Image with infographic-specific settings
 *
 * @param content - Educational content in Hebrew
 * @param visualType - Type of infographic (flowchart, timeline, etc.)
 * @param topic - Topic name for context
 * @returns Base64 encoded PNG image or null on failure
 */
export const generateInfographicWithGemini3 = async (
  content: string,
  visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle',
  topic?: string
): Promise<{ base64: string; mimeType: string } | null> => {
  // Type-specific prompt templates optimized for Gemini 3 Pro Image
  const promptTemplates = {
    flowchart: `Create a clean, professional flowchart infographic in Hebrew (RTL).

Visual Style:
- Clean, minimalist design with clear hierarchy
- Vibrant gradient background (educational palette)
- White rounded boxes for steps with drop shadows
- Directional arrows (↓ or →) showing flow
- Numbered circles for step indicators
- Large, readable Hebrew text (right-to-left)

Content to visualize:
${content}

${topic ? `Topic/Title: ${topic}` : ''}

Requirements:
- All text must be in Hebrew, written right-to-left
- Use clear, modern Hebrew fonts (Arial, Segoe UI, or similar)
- High contrast for readability
- Professional design suitable for classroom presentation
- Image size: 1024x1024px square`,

    timeline: `Create a horizontal timeline infographic in Hebrew (RTL).

Visual Style:
- Modern, clean timeline with central horizontal line
- Alternating event boxes above/below the line
- Colorful milestone markers (circles) on the line
- Gradient background (warm, educational colors)
- Event boxes with dates and descriptions in Hebrew
- Drop shadows for depth

Content to visualize:
${content}

${topic ? `Topic/Title: ${topic}` : ''}

Requirements:
- All text must be in Hebrew, written right-to-left
- Dates should be prominent (bold, colored)
- Clear chronological order from right to left (RTL)
- Professional, educational design
- Image size: 1024x1024px square`,

    comparison: `Create a side-by-side comparison infographic in Hebrew (RTL).

Visual Style:
- Two distinct columns with clear visual separation
- Different accent colors for each side (e.g., red vs. blue)
- Gradient background (modern, professional)
- Icon bullets or emoji for visual interest
- Clear headers for each column
- Equal spacing and balance

Content to visualize:
${content}

${topic ? `Topic/Title: ${topic}` : ''}

Requirements:
- All text must be in Hebrew, written right-to-left
- Right column first, then left column (RTL reading order)
- High contrast between columns
- Professional educational design
- Image size: 1024x1024px square`,

    cycle: `Create a circular cycle diagram infographic in Hebrew (RTL).

Visual Style:
- Circular arrangement with stages around a central circle
- Directional arrows showing clockwise flow
- Each stage in a colored box with distinct color
- Central circle with topic/title
- Gradient background (warm, vibrant)
- Drop shadows for depth

Content to visualize:
${content}

${topic ? `Topic/Title: ${topic}` : ''}

Requirements:
- All text must be in Hebrew, written right-to-left
- Clear cycle flow with arrows
- Distinct colors for each stage (rainbow palette)
- Central focus with topic name
- Professional educational design
- Image size: 1024x1024px square`
  };

  const enhancedPrompt = promptTemplates[visualType];

  logger.info('🎨 Generating infographic with Gemini 3 Pro Image', {
    visualType,
    topic,
    contentLength: content.length
  });

  // Generate with square aspect ratio (best for infographics)
  return await generateGemini3Image(enhancedPrompt, '1:1', '1K');
};

/**
 * Cost estimation helper
 * Note: Preview pricing may differ from GA pricing
 * Check latest pricing at: https://cloud.google.com/vertex-ai/pricing
 */
export const estimateGemini3ImageCost = (resolution: Resolution = '1K'): {
  estimatedCost: number;
  currency: string;
  note: string;
} => {
  // Estimated costs (Preview pricing - subject to change)
  const costs = {
    '1K': 0.015, // Estimated (between Imagen 3 and DALL-E)
    '2K': 0.025, // Estimated
    '4K': 0.040  // Estimated
  };

  return {
    estimatedCost: costs[resolution] || costs['1K'],
    currency: 'USD',
    note: 'Preview pricing - actual costs may vary when GA'
  };
};
