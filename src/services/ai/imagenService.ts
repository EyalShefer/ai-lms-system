/**
 * Gemini Image Generation Service
 * Uses Gemini 3 Pro Image for high-quality Hebrew infographics
 * Falls back to DALL-E 3 if Gemini fails
 *
 * Setup Instructions:
 * 1. Enable Vertex AI in Google Cloud Console
 * 2. Deploy Cloud Function: firebase deploy --only functions:generateGeminiImage
 * 3. Set VITE_ENABLE_GEMINI_IMAGE=true in .env
 */

import { auth } from '../../firebase';

/**
 * Gemini Image configuration
 */
export const GEMINI_IMAGE_CONFIG = {
    model: 'gemini-3-pro-image',
    endpoint: 'generateGeminiImage'
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
 * @returns Promise<Blob | null> - PNG image blob or null on failure
 */
export const generateGeminiImage = async (
    prompt: string
): Promise<Blob | null> => {
    if (!isGeminiImageAvailable()) {
        console.warn('⚠️ Gemini Image is not configured. Set VITE_ENABLE_GEMINI_IMAGE=true');
        return null;
    }

    try {
        console.log(`🎨 Generating image with Gemini 3 Pro Image...`);

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
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));

            // Handle specific error codes
            if (response.status === 429) {
                console.warn('⚠️ Rate limited, will fall back to DALL-E');
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
 * Cost helper - Gemini 3 Pro Image only
 */
export const getImageGenerationCost = (): {
    perImage: number;
    per1000: number;
    currency: string;
} => {
    return { perImage: 0.040, per1000: 40, currency: 'USD' };
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
