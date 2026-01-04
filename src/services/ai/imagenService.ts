/**
 * Google Imagen 3 Integration
 * Cost-effective alternative to DALL-E 3 ($0.020 vs $0.040 per image)
 *
 * Setup Instructions:
 * 1. Enable Vertex AI in Google Cloud Console
 * 2. Add GOOGLE_CLOUD_PROJECT to Firebase environment
 * 3. Deploy Cloud Function with Imagen proxy
 * 4. Update firebase.json with Imagen endpoint
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

/**
 * Imagen 3 configuration
 */
export const IMAGEN_CONFIG = {
    model: 'imagen-3.0-generate-001',
    endpoint: 'generateImagenImage', // Cloud Function name
    imageSize: '1024x1024',
    outputFormat: 'PNG',
    aspectRatio: '1:1',
    sampleCount: 1
};

/**
 * Check if Imagen is available and configured
 * Set to true to enable Imagen 3 (requires Cloud Function deployment)
 */
export const isImagenAvailable = (): boolean => {
    // Enable Imagen after deploying Cloud Functions
    // Run: firebase deploy --only functions:generateImagenImage
    return import.meta.env.VITE_ENABLE_IMAGEN === 'true' || false;
};

/**
 * Generate image using Google Imagen 3
 * @param prompt - Image generation prompt
 * @returns Promise<Blob | null> - PNG image blob or null on failure
 */
export const generateImagenImage = async (prompt: string): Promise<Blob | null> => {
    if (!isImagenAvailable()) {
        console.warn('⚠️ Imagen 3 is not configured. Falling back to DALL-E.');
        return null;
    }

    try {
        console.log('🎨 Generating image with Imagen 3 via Cloud Function...');

        // Get user ID for rate limiting
        const { auth } = await import('../../firebase');
        const userId = auth.currentUser?.uid;

        // Call Cloud Function directly (HTTP endpoint for better CORS handling)
        const functionUrl = import.meta.env.VITE_IMAGEN_FUNCTION_URL ||
            `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/generateImagenImage`;

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                userId
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Imagen API error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();

        // Extract base64 image from response
        if (data.success && data.image?.base64) {
            const base64Data = data.image.base64;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);

            console.log(`✅ Imagen 3 generation successful (${data.metadata?.generationTime}ms, cost: $${data.metadata?.cost})`);

            return new Blob([byteArray], { type: data.image.mimeType || 'image/png' });
        }

        return null;
    } catch (error) {
        console.error('❌ Imagen 3 generation failed:', error);
        return null;
    }
};

/**
 * Cost comparison helper
 */
export const getImageGenerationCost = (provider: 'dall-e' | 'imagen'): {
    perImage: number;
    per1000: number;
    currency: string;
} => {
    const costs = {
        'dall-e': { perImage: 0.040, per1000: 40, currency: 'USD' },
        'imagen': { perImage: 0.020, per1000: 20, currency: 'USD' }
    };
    return costs[provider];
};

/**
 * FUTURE: Firebase Cloud Function for Imagen Proxy
 * Deploy this to functions/src/imagenProxy.ts
 *
 * ```typescript
 * import { onRequest } from 'firebase-functions/v2/https';
 * import { VertexAI } from '@google-cloud/aiplatform';
 *
 * export const imagenGenerate = onRequest(async (req, res) => {
 *     const { prompt, model, aspectRatio } = req.body;
 *
 *     const vertexAI = new VertexAI({
 *         project: process.env.GOOGLE_CLOUD_PROJECT,
 *         location: 'us-central1'
 *     });
 *
 *     const generativeModel = vertexAI.preview.getGenerativeModel({
 *         model: model || 'imagen-3.0-generate-001'
 *     });
 *
 *     const result = await generativeModel.generateImages({
 *         prompt,
 *         number_of_images: 1,
 *         aspect_ratio: aspectRatio || '1:1'
 *     });
 *
 *     res.json(result);
 * });
 * ```
 */

/**
 * Setup guide for educators
 */
export const IMAGEN_SETUP_GUIDE = `
# הגדרת Imagen 3 (חיסכון של 50% בעלויות!)

## שלב 1: Google Cloud Console
1. גש ל-https://console.cloud.google.com
2. הפעל Vertex AI API
3. צור Service Account עם הרשאות Vertex AI User

## שלב 2: Firebase Configuration
\`\`\`bash
firebase functions:config:set imagen.enabled=true
firebase functions:config:set google.project_id=YOUR_PROJECT_ID
\`\`\`

## שלב 3: Deploy Cloud Function
\`\`\`bash
cd functions
npm install @google-cloud/aiplatform
firebase deploy --only functions:imagenGenerate
\`\`\`

## שלב 4: Update Code
בקובץ src/services/ai/imagenService.ts:
\`\`\`typescript
export const isImagenAvailable = (): boolean => {
    return true; // שנה ל-true
};
\`\`\`

## עלויות משוערות:
- DALL-E 3: $40 ל-1000 תמונות
- Imagen 3: $20 ל-1000 תמונות
- **חיסכון: $20/חודש** (על 1000 תמונות)
`;
