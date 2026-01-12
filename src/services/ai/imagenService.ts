/**
 * Gemini Image Generation Service
 * Uses Gemini 2.5 Flash Image (Nano Banana) or Gemini 3 Pro Image
 * for high-quality Hebrew infographics
 *
 * Models:
 * - flash: Gemini 2.5 Flash Image (Nano Banana) - Fast, cheaper
 * - pro: Gemini 3 Pro Image Preview - Higher quality, better Hebrew
 *
 * Setup Instructions:
 * 1. Enable Vertex AI in Google Cloud Console
 * 2. Deploy Cloud Function: firebase deploy --only functions:generateGeminiImage
 * 3. Set VITE_ENABLE_GEMINI_IMAGE=true in .env
 */

import { auth } from '../../firebase';

/**
 * Gemini Image configuration
 * Note: Model selection is handled by the Cloud Function
 */
export const GEMINI_IMAGE_CONFIG = {
    models: {
        flash: 'gemini-2.5-flash-preview-05-20',  // Nano Banana - Fast, cheaper
        pro: 'gemini-2.0-flash-exp'                // Gemini 2.0 Flash Exp - Higher quality
    },
    endpoint: 'generateGeminiImage',
    defaultModel: 'pro' as const
};

// Legacy export for backwards compatibility
export const IMAGEN_CONFIG = GEMINI_IMAGE_CONFIG;

/**
 * Check if Gemini Image is available and configured
 */
export const isImagenAvailable = (): boolean => {
    return import.meta.env.VITE_ENABLE_GEMINI_IMAGE === 'true' ||
           import.meta.env.VITE_ENABLE_IMAGEN === 'true' ||
           false;
};

// Alias for clarity
export const isGeminiImageAvailable = isImagenAvailable;

/**
 * Generate image using Gemini 3 Pro Image
 * Best for Hebrew text and educational infographics
 *
 * @param prompt - Image generation prompt
 * @param model - 'flash' for speed, 'pro' for quality (default: 'pro')
 * @returns Promise<Blob | null> - PNG image blob or null on failure
 */
export const generateGeminiImage = async (
    prompt: string,
    model: 'flash' | 'pro' = 'pro'
): Promise<Blob | null> => {
    if (!isGeminiImageAvailable()) {
        console.warn('⚠️ Gemini Image is not configured. Set VITE_ENABLE_GEMINI_IMAGE=true');
        return null;
    }

    try {
        console.log(`🎨 Generating image with Gemini ${model === 'pro' ? '3 Pro' : '2.5 Flash'} Image...`);

        // Get Firebase auth token for authentication
        const user = auth.currentUser;
        if (!user) {
            console.error('❌ User not authenticated');
            return null;
        }

        const idToken = await user.getIdToken();

        // Build Cloud Function URL
        const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
        const functionUrl = import.meta.env.VITE_GEMINI_IMAGE_FUNCTION_URL ||
            `https://us-central1-${projectId}.cloudfunctions.net/generateGeminiImage`;

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                prompt,
                model
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));

            // Handle specific error codes
            if (response.status === 429) {
                console.warn('⚠️ Rate limited by Gemini Image API');
                return null;
            }

            throw new Error(`Gemini Image API error: ${errorData.error || response.statusText}`);
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

            console.log(`✅ Gemini Image generation successful (${data.metadata?.generationTime}ms, model: ${data.metadata?.model})`);

            return new Blob([byteArray], { type: data.image.mimeType || 'image/png' });
        }

        console.warn('⚠️ Gemini returned success but no image data');
        return null;

    } catch (error) {
        console.error('❌ Gemini Image generation failed:', error);
        return null;
    }
};

// Legacy alias for backwards compatibility
export const generateImagenImage = generateGeminiImage;

/**
 * Cost comparison helper
 * Only Gemini models supported (Nano Banana + Gemini 3 Pro)
 */
export const getImageGenerationCost = (provider: 'gemini-flash' | 'gemini-pro'): {
    perImage: number;
    per1000: number;
    currency: string;
} => {
    const costs = {
        'gemini-flash': { perImage: 0.020, per1000: 20, currency: 'USD' },  // Nano Banana
        'gemini-pro': { perImage: 0.040, per1000: 40, currency: 'USD' }     // Gemini 3 Pro
    };
    return costs[provider];
};

/**
 * Setup guide for educators
 */
export const GEMINI_IMAGE_SETUP_GUIDE = `
# הגדרת Gemini Image (איכות עברית מעולה!)

## שלב 1: Google Cloud Console
1. גש ל-https://console.cloud.google.com
2. הפעל Vertex AI API
3. וודא שה-Firebase project מחובר

## שלב 2: Deploy Cloud Function
\`\`\`bash
cd functions
npm install
firebase deploy --only functions:generateGeminiImage
\`\`\`

## שלב 3: הגדרת משתני סביבה
בקובץ .env:
\`\`\`
VITE_ENABLE_GEMINI_IMAGE=true
\`\`\`

## יתרונות Gemini 3 Pro Image:
- תמיכה מעולה בעברית ו-RTL
- איכות תמונה גבוהה
- טקסט קריא וברור
- אידיאלי לאינפוגרפיקות חינוכיות
`;

// Legacy export
export const IMAGEN_SETUP_GUIDE = GEMINI_IMAGE_SETUP_GUIDE;
