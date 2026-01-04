/**
 * Imagen 3 Proxy Cloud Function
 * Handles image generation requests using Google Cloud Vertex AI
 * Provides secure server-side access to Imagen 3 API
 */

import * as functions from 'firebase-functions';
import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex AI with project configuration
const projectId = process.env.GCLOUD_PROJECT || 'your-project-id';
const location = 'us-central1'; // Vertex AI location

const vertexAI = new VertexAI({
    project: projectId,
    location: location
});

// Imagen 3 model configuration
const MODEL_NAME = 'imagen-3.0-generate-001';

/**
 * Rate limiting configuration
 * Prevents abuse and manages costs
 */
const RATE_LIMITS = {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxCostPerDay: 50.00 // USD
};

// In-memory rate limiting store (use Redis/Firestore for production)
const rateLimitStore = new Map<string, { count: number; resetTime: number; dailyCost: number }>();

/**
 * Check if request is within rate limits
 */
const checkRateLimit = (userId: string): { allowed: boolean; reason?: string } => {
    const now = Date.now();
    const userLimit = rateLimitStore.get(userId);

    if (!userLimit) {
        // First request from this user
        rateLimitStore.set(userId, {
            count: 1,
            resetTime: now + 60000, // 1 minute from now
            dailyCost: 0.020 // Cost of one Imagen image
        });
        return { allowed: true };
    }

    // Check if reset time has passed
    if (now > userLimit.resetTime) {
        userLimit.count = 1;
        userLimit.resetTime = now + 60000;
        userLimit.dailyCost += 0.020;
        return { allowed: true };
    }

    // Check minute limit
    if (userLimit.count >= RATE_LIMITS.maxRequestsPerMinute) {
        return {
            allowed: false,
            reason: `Rate limit exceeded: ${RATE_LIMITS.maxRequestsPerMinute} requests per minute`
        };
    }

    // Check daily cost limit
    if (userLimit.dailyCost >= RATE_LIMITS.maxCostPerDay) {
        return {
            allowed: false,
            reason: `Daily cost limit exceeded: $${RATE_LIMITS.maxCostPerDay}`
        };
    }

    userLimit.count++;
    userLimit.dailyCost += 0.020;
    return { allowed: true };
};

/**
 * Main Cloud Function: Generate image with Imagen 3
 */
export const generateImagenImage = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
        // CORS handling
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        try {
            // Extract request data
            const { prompt, userId } = req.body;

            if (!prompt || typeof prompt !== 'string') {
                res.status(400).json({ error: 'Invalid prompt' });
                return;
            }

            // Rate limiting check
            const userIdOrIp = userId || req.ip || 'anonymous';
            const rateLimitResult = checkRateLimit(userIdOrIp);

            if (!rateLimitResult.allowed) {
                res.status(429).json({
                    error: 'Rate limit exceeded',
                    reason: rateLimitResult.reason
                });
                return;
            }

            console.log(`🎨 Imagen 3 request from ${userIdOrIp}:`, prompt.substring(0, 100));

            // Initialize Imagen 3 model
            const generativeModel = vertexAI.preview.getGenerativeModel({
                model: MODEL_NAME
            });

            // Generate image
            const startTime = Date.now();

            const result = await generativeModel.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{
                        text: prompt
                    }]
                }]
            });

            const generationTime = Date.now() - startTime;

            // Extract image data
            const response = result.response;

            if (!response || !response.candidates || response.candidates.length === 0) {
                throw new Error('No image generated');
            }

            const candidate = response.candidates[0];

            // Check for safety blocks
            if (candidate.finishReason === 'SAFETY') {
                res.status(400).json({
                    error: 'Image generation blocked due to safety filters',
                    details: candidate.safetyRatings
                });
                return;
            }

            // Extract base64 image data
            const imagePart = candidate.content.parts.find((part: any) => part.inlineData);

            if (!imagePart || !imagePart.inlineData) {
                throw new Error('No image data in response');
            }

            const base64Image = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType || 'image/png';

            console.log(`✅ Imagen 3 generation successful (${generationTime}ms, cost: $0.020)`);

            // Return image data
            res.status(200).json({
                success: true,
                image: {
                    base64: base64Image,
                    mimeType: mimeType
                },
                metadata: {
                    model: MODEL_NAME,
                    generationTime: generationTime,
                    cost: 0.020,
                    finishReason: candidate.finishReason
                }
            });

        } catch (error: any) {
            console.error('❌ Imagen 3 generation error:', error);

            res.status(500).json({
                error: 'Image generation failed',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

/**
 * Health check endpoint
 */
export const imagenHealthCheck = functions.https.onRequest((req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Imagen 3 Proxy',
        model: MODEL_NAME,
        location: location,
        timestamp: new Date().toISOString()
    });
});

/**
 * Get rate limit stats (admin only)
 */
export const imagenStats = functions.https.onRequest((req, res) => {
    // TODO: Add authentication check here

    const stats = Array.from(rateLimitStore.entries()).map(([userId, data]) => ({
        userId,
        requestCount: data.count,
        dailyCost: data.dailyCost,
        resetTime: new Date(data.resetTime).toISOString()
    }));

    res.status(200).json({
        totalUsers: stats.length,
        totalDailyCost: stats.reduce((sum, s) => sum + s.dailyCost, 0),
        users: stats.slice(0, 10) // Top 10 users
    });
});
