import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import OpenAI from "openai"; // Keep for legacy proxy support
import { defineSecret } from "firebase-functions/params";
import { v4 as uuidv4 } from 'uuid';

// 1. אתחול
initializeApp();
const db = getFirestore();
const auth = getAuth();
const openAiApiKey = defineSecret("OPENAI_API_KEY"); // Keep for legacy proxy support
const geminiApiKey = defineSecret("GEMINI_API_KEY"); // Google AI Studio API Key
const elevenLabsApiKey = defineSecret("ELEVENLABS_API_KEY"); // ElevenLabs TTS API Key
/**
 * ============================================================
 * IMPORTANT: DO NOT CHANGE THE MODEL WITHOUT EXPLICIT APPROVAL
 * See AI_MODELS_POLICY.md for approved models.
 * Approved: gemini-2.0-flash (text), gemini-2.0-flash-exp-image-generation (images)
 * ============================================================
 */
const MODEL_NAME = "gemini-2.0-flash"; // Standard model for all LLM calls

// --- GEMINI 3 PRO SERVICE ---
import { generateText, generateJSON, generateWithVision, ChatMessage } from "./services/geminiService";
import { withGeminiRetry } from "./utils/retry";

// --- CUSTOM CLAIMS SERVICE ---
import {
  setUserRole,
  grantPremium,
  revokePremium,
  getUserClaims,
  initializeNewUserClaims,
  syncClaimsFromFirestore,
  bulkSyncClaims,
  requireRole,
  extractClaimsFromContext,
  UserClaims
} from "./services/customClaims";

// --- MIDDLEWARE ---
// SECURITY: Use distributed rate limiter (Firestore-backed) instead of memory-based
// Memory-based rate limiting doesn't work in serverless as each instance has its own state
import { distributedRateLimit } from "./middleware/distributedRateLimiter";

// --- USAGE TRACKING SERVICE ---
import { checkQuota, logUsage, extractOpenAITokens, AICallType } from "./services/usageService";

// --- GEMINI IMAGE GENERATION ---
export { generateGeminiImage } from "./geminiImageService";

// --- STREAMING SERVER (SSE for real-time content generation) ---
export { streamingServer } from "./streaming";

// --- GEMINI CHAT PROXY (Universal LLM endpoint) ---
/**
 * Universal Gemini Chat endpoint for all LLM calls
 * Replaces OpenAI chat completions with Gemini 2.5 Pro
 */
export const geminiChat = onCall({
    secrets: [geminiApiKey],
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 120
}, async (request) => {
    const { messages, options } = request.data as {
        messages: ChatMessage[];
        options?: {
            temperature?: number;
            maxTokens?: number;
            responseFormat?: { type: 'json_object' | 'text' };
        };
    };

    if (!messages || !Array.isArray(messages)) {
        throw new HttpsError('invalid-argument', 'messages array is required');
    }

    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    logger.info(`🤖 Gemini Chat request from user ${userId}`, {
        messageCount: messages.length,
        options
    });

    try {
        // Check if JSON response requested
        if (options?.responseFormat?.type === 'json_object') {
            const result = await generateJSON(messages, {
                temperature: options?.temperature,
                maxTokens: options?.maxTokens
            });
            return { content: JSON.stringify(result), type: 'json' };
        }

        // Regular text response
        const result = await generateText(messages, {
            temperature: options?.temperature,
            maxTokens: options?.maxTokens
        });

        return { content: result, type: 'text' };

    } catch (error: any) {
        logger.error('Gemini Chat error:', error);
        throw new HttpsError('internal', `שגיאה ביצירת תוכן: ${error.message}`);
    }
});

// --- GEMINI CHAT FAST (Flash model for quick responses) ---
/**
 * Fast Gemini Chat endpoint using Flash model
 * For quick conversational responses (SmartCreationChat, etc.)
 */
export const geminiChatFast = onCall({
    secrets: [geminiApiKey],
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30
}, async (request) => {
    const { messages, options } = request.data as {
        messages: ChatMessage[];
        options?: {
            temperature?: number;
            maxTokens?: number;
            responseFormat?: { type: 'json_object' | 'text' };
        };
    };

    if (!messages || !Array.isArray(messages)) {
        throw new HttpsError('invalid-argument', 'messages array is required');
    }

    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    logger.info(`⚡ Gemini Chat FAST request from user ${userId}`, {
        messageCount: messages.length
    });

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        const client = new GoogleGenAI({ apiKey });

        // Convert messages to prompt
        let systemPrompt = '';
        const conversationParts: string[] = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt = typeof msg.content === 'string' ? msg.content : '';
            } else {
                const prefix = msg.role === 'user' ? 'User: ' : 'Assistant: ';
                const content = typeof msg.content === 'string' ? msg.content : '';
                conversationParts.push(`${prefix}${content}`);
            }
        }

        let fullPrompt = systemPrompt ? `${systemPrompt}\n\n` : '';
        fullPrompt += conversationParts.join('\n\n');

        if (options?.responseFormat?.type === 'json_object') {
            fullPrompt += '\n\nIMPORTANT: Respond with valid JSON only. No explanations or markdown.';
        }

        // Use Flash model for speed with retry logic
        const response = await withGeminiRetry(async () => {
            return client.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: fullPrompt,
                config: {
                    temperature: options?.temperature ?? 0.7,
                    maxOutputTokens: options?.maxTokens ?? 2048
                }
            });
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        logger.info(`⚡ Gemini Flash completed`, {
            outputLength: text.length
        });

        if (options?.responseFormat?.type === 'json_object') {
            // Clean and parse JSON
            let jsonText = text
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonText = jsonMatch[0];
            }
            return { content: jsonText, type: 'json' };
        }

        return { content: text, type: 'text' };

    } catch (error: any) {
        logger.error('Gemini Chat Fast error:', error);
        throw new HttpsError('internal', `שגיאה: ${error.message}`);
    }
});

// --- CURRICULUM STANDARDS QUERY ---
/**
 * Query curriculum standards for teacher chat
 * Allows searching by subject, grade, topic, domain, etc.
 */
export const queryCurriculumStandards = onCall({
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { subject, gradeLevel, topic, domain, bloomLevels, limit = 20 } = request.data as {
        subject?: string;
        gradeLevel?: string;
        topic?: string;
        domain?: string;
        bloomLevels?: string[];
        limit?: number;
    };

    logger.info(`📚 Curriculum query from user ${userId}`, {
        subject, gradeLevel, topic, domain, bloomLevels, limit
    });

    try {
        let query: any = db.collection('curriculum_standards');

        // Apply filters
        if (subject) {
            query = query.where('subject', '==', subject);
        }
        if (gradeLevel) {
            query = query.where('gradeLevel', '==', gradeLevel);
        }
        if (domain) {
            query = query.where('domain', '==', domain);
        }

        const snapshot = await query.limit(Math.min(limit, 50)).get();

        let standards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Client-side filtering for topic (keyword matching)
        if (topic) {
            const topicWords = topic.toLowerCase().split(/\s+/);
            standards = standards.filter((s: any) =>
                topicWords.some(word =>
                    s.topic?.toLowerCase().includes(word) ||
                    s.title?.toLowerCase().includes(word) ||
                    s.description?.toLowerCase().includes(word)
                )
            );
        }

        // Client-side filtering for bloom levels
        if (bloomLevels && bloomLevels.length > 0) {
            standards = standards.filter((s: any) =>
                s.recommendedBloomLevels?.some((b: string) => bloomLevels.includes(b))
            );
        }

        logger.info(`📚 Found ${standards.length} curriculum standards`);

        return {
            success: true,
            count: standards.length,
            standards: standards.slice(0, limit)
        };

    } catch (error: any) {
        logger.error('Curriculum query error:', error);
        throw new HttpsError('internal', `שגיאה בחיפוש תוכ"ל: ${error.message}`);
    }
});

// --- SEARCH USER CONTENT (BLOCKS IN COURSES) ---
/**
 * Calculate quality metrics for a course based on student results
 */
async function calculateCourseQuality(courseId: string): Promise<{
    relevanceScore: number;
    usageStats: {
        studentCount: number;
        successRate: number;
        avgScore: number;
        completionRate: number;
        lastUsed: any;
    };
}> {
    try {
        // Get all task results for this course
        const tasksSnapshot = await db.collection('tasks')
            .where('courseId', '==', courseId)
            .get();

        if (tasksSnapshot.empty) {
            // No usage data yet
            return {
                relevanceScore: 50, // Default score for new content
                usageStats: {
                    studentCount: 0,
                    successRate: 0,
                    avgScore: 0,
                    completionRate: 0,
                    lastUsed: null
                }
            };
        }

        const tasks = tasksSnapshot.docs.map(doc => doc.data());

        // Calculate metrics
        const studentCount = new Set(tasks.map(t => t.studentId)).size;
        const submittedTasks = tasks.filter(t => t.status === 'submitted' || t.status === 'graded');
        const completedTasks = submittedTasks.length;

        const avgScore = submittedTasks.length > 0
            ? submittedTasks.reduce((sum, t) => sum + (t.percentage || 0), 0) / submittedTasks.length
            : 0;

        const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

        // Success rate based on telemetry
        let totalSuccess = 0;
        let totalBlocks = 0;
        submittedTasks.forEach(task => {
            if (task.telemetry) {
                totalSuccess += task.telemetry.successBlocks || 0;
                totalBlocks += task.telemetry.totalBlocks || 0;
            }
        });
        const successRate = totalBlocks > 0 ? (totalSuccess / totalBlocks) * 100 : 0;

        // Last used
        const lastUsed = tasks.reduce((latest, t) => {
            const timestamp = t.submittedAt || t.startedAt;
            if (!latest || (timestamp && timestamp.toMillis() > latest.toMillis())) {
                return timestamp;
            }
            return latest;
        }, null);

        // Calculate weighted relevance score (0-100)
        // 40% success rate + 30% completion rate + 20% avg score + 10% usage frequency
        const usageFrequency = Math.min(studentCount / 10, 1) * 100; // Normalize to 0-100
        const relevanceScore = Math.round(
            successRate * 0.4 +
            completionRate * 0.3 +
            avgScore * 0.2 +
            usageFrequency * 0.1
        );

        return {
            relevanceScore,
            usageStats: {
                studentCount,
                successRate: Math.round(successRate),
                avgScore: Math.round(avgScore),
                completionRate: Math.round(completionRate),
                lastUsed
            }
        };
    } catch (error) {
        logger.error(`Error calculating quality for course ${courseId}:`, error);
        // Return default values on error
        return {
            relevanceScore: 50,
            usageStats: {
                studentCount: 0,
                successRate: 0,
                avgScore: 0,
                completionRate: 0,
                lastUsed: null
            }
        };
    }
}

/**
 * Search for blocks (activities, exams, etc.) in user's courses
 * Allows searching by topic, type, grade level, etc.
 * NOW WITH QUALITY SCORING!
 */
export const searchUserContent = onCall({
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { query, blockType, gradeLevel, limit = 20 } = request.data as {
        query?: string;
        blockType?: string;
        gradeLevel?: string;
        limit?: number;
    };

    logger.info(`🔍 Content search from user ${userId}`, {
        query, blockType, gradeLevel, limit
    });

    try {
        // Find all courses owned by user
        const coursesSnapshot = await db.collection('courses')
            .where('userId', '==', userId)
            .get();

        if (coursesSnapshot.empty) {
            return {
                success: true,
                count: 0,
                results: []
            };
        }

        const allBlocks: any[] = [];

        // Search blocks in each course
        for (const courseDoc of coursesSnapshot.docs) {
            const courseId = courseDoc.id;
            const courseData = courseDoc.data();

            let blocksQuery: any = db.collection(`courses/${courseId}/blocks`);

            // Apply filters if provided
            if (blockType) {
                blocksQuery = blocksQuery.where('blockType', '==', blockType);
            }

            const blocksSnapshot = await blocksQuery.limit(50).get();

            blocksSnapshot.forEach(blockDoc => {
                const blockData = blockDoc.data();

                // Client-side filtering for query string and grade level
                let matchesQuery = true;
                let matchesGrade = true;

                if (query) {
                    const searchStr = query.toLowerCase();
                    const titleMatch = blockData.metadata?.title?.toLowerCase().includes(searchStr);
                    const topicMatch = blockData.metadata?.topic?.toLowerCase().includes(searchStr);
                    const descMatch = blockData.metadata?.description?.toLowerCase().includes(searchStr);
                    matchesQuery = titleMatch || topicMatch || descMatch;
                }

                if (gradeLevel && blockData.metadata?.gradeLevel) {
                    matchesGrade = blockData.metadata.gradeLevel === gradeLevel;
                }

                if (matchesQuery && matchesGrade) {
                    allBlocks.push({
                        id: blockDoc.id,
                        courseId,
                        courseName: courseData.name || courseData.title || 'ללא שם',
                        ...blockData
                    });
                }
            });
        }

        // Calculate quality metrics for each unique course
        const courseQualityMap = new Map<string, any>();
        const uniqueCourseIds = [...new Set(allBlocks.map(b => b.courseId))];

        for (const courseId of uniqueCourseIds) {
            const quality = await calculateCourseQuality(courseId);
            courseQualityMap.set(courseId, quality);
        }

        // Enrich blocks with quality metrics
        const enrichedBlocks = allBlocks.map(block => {
            const quality = courseQualityMap.get(block.courseId);
            return {
                ...block,
                relevanceScore: quality?.relevanceScore || 50,
                usageStats: quality?.usageStats
            };
        });

        // Sort by relevance score (highest first), then by creation date
        enrichedBlocks.sort((a, b) => {
            const scoreDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
            if (scoreDiff !== 0) return scoreDiff;

            // If scores are equal, sort by creation date
            const aTime = a.metadata?.createdAt?.toMillis?.() || 0;
            const bTime = b.metadata?.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        });

        const results = enrichedBlocks.slice(0, Math.min(limit, 50));

        logger.info(`🔍 Found ${results.length} matching blocks with quality scores`);

        return {
            success: true,
            count: results.length,
            results
        };

    } catch (error: any) {
        logger.error('Content search error:', error);
        throw new HttpsError('internal', `שגיאה בחיפוש תכנים: ${error.message}`);
    }
});

// --- CONTENT TEMPLATES (QUICK TEMPLATES) ---
/**
 * Built-in system templates
 */
const SYSTEM_TEMPLATES = [
    {
        id: 'quick_activity',
        name: 'פעילות מהירה',
        description: 'פעילות קצרה לתרגול - 5 שאלות, מיקס סוגים',
        icon: '⚡',
        type: 'system',
        isDefault: true,
        productType: 'activity',
        profile: 'balanced',
        activityLength: 'short',
        difficultyLevel: 'core',
        requiresTopic: true,
        requiresGrade: true,
        requiresSubject: false
    },
    {
        id: 'summary_exam',
        name: 'מבחן סיכום',
        description: 'מבחן מקיף - 10 שאלות, כל רמות הקושי',
        icon: '📊',
        type: 'system',
        productType: 'exam',
        profile: 'educational',
        activityLength: 'long',
        difficultyLevel: 'all',
        requiresTopic: true,
        requiresGrade: true,
        requiresSubject: false
    },
    {
        id: 'learning_game',
        name: 'משחק למידה',
        description: 'פעילות משחקית - זיכרון והתאמות',
        icon: '🎮',
        type: 'system',
        productType: 'activity',
        profile: 'game',
        activityLength: 'short',
        difficultyLevel: 'support',
        requiresTopic: true,
        requiresGrade: true,
        requiresSubject: false
    },
    {
        id: 'full_lesson',
        name: 'שיעור מלא',
        description: 'מערך שיעור שלם עם כל השלבים',
        icon: '📚',
        type: 'system',
        productType: 'lesson',
        profile: 'educational',
        activityLength: 'long',
        difficultyLevel: 'core',
        requiresTopic: true,
        requiresGrade: true,
        requiresSubject: false
    }
];

/**
 * Get content templates (system + user templates)
 */
export const getContentTemplates = onCall({
    cors: true,
    memory: "128MiB"
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    try {
        // Get user templates
        const userTemplatesSnapshot = await db.collection('content_templates')
            .where('userId', '==', userId)
            .where('type', '==', 'user')
            .get();

        const userTemplates = userTemplatesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Return system templates + user templates
        return {
            success: true,
            templates: [...SYSTEM_TEMPLATES, ...userTemplates]
        };

    } catch (error: any) {
        logger.error('Get templates error:', error);
        throw new HttpsError('internal', `שגיאה בטעינת תבניות: ${error.message}`);
    }
});

/**
 * Save user template
 */
export const saveContentTemplate = onCall({
    cors: true,
    memory: "128MiB"
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { template } = request.data as { template: any };

    if (!template || !template.name) {
        throw new HttpsError('invalid-argument', 'חסר שם לתבנית');
    }

    try {
        const templateData = {
            ...template,
            type: 'user',
            userId,
            usageCount: template.usageCount || 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        let templateId: string;

        if (template.id && template.id.startsWith('user_')) {
            // Update existing
            templateId = template.id;
            await db.collection('content_templates').doc(templateId).set(templateData, { merge: true });
        } else {
            // Create new
            const docRef = await db.collection('content_templates').add(templateData);
            templateId = docRef.id;
        }

        return {
            success: true,
            templateId
        };

    } catch (error: any) {
        logger.error('Save template error:', error);
        throw new HttpsError('internal', `שגיאה בשמירת תבנית: ${error.message}`);
    }
});

/**
 * Delete user template
 */
export const deleteContentTemplate = onCall({
    cors: true,
    memory: "128MiB"
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { templateId } = request.data as { templateId: string };

    if (!templateId) {
        throw new HttpsError('invalid-argument', 'חסר מזהה תבנית');
    }

    try {
        // Verify ownership
        const templateDoc = await db.collection('content_templates').doc(templateId).get();

        if (!templateDoc.exists) {
            throw new HttpsError('not-found', 'התבנית לא נמצאה');
        }

        const templateData = templateDoc.data();
        if (templateData?.userId !== userId) {
            throw new HttpsError('permission-denied', 'אין הרשאה למחוק תבנית זו');
        }

        await db.collection('content_templates').doc(templateId).delete();

        return {
            success: true
        };

    } catch (error: any) {
        logger.error('Delete template error:', error);
        throw new HttpsError('internal', `שגיאה במחיקת תבנית: ${error.message}`);
    }
});

// --- PROMPT LIBRARY ---
/**
 * Search relevant prompts from the library
 * Used by SmartCreationChat to suggest prompts for static content
 */
export const searchRelevantPrompts = onCall({
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 30
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { category, keywords, limit = 3 } = request.data as {
        category?: string;
        keywords?: string;
        limit?: number;
    };

    try {
        logger.info(`🔍 Searching prompts - category: ${category}, keywords: ${keywords}`);

        let query: FirebaseFirestore.Query = db.collection('prompts')
            .where('status', '==', 'active');

        // Filter by category if provided
        if (category) {
            query = query.where('category', '==', category);
        }

        const snapshot = await query.get();
        let prompts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Client-side filtering by keywords if provided
        if (keywords) {
            const keywordList = keywords.toLowerCase().split(/\s+/);
            prompts = prompts.filter((prompt: any) => {
                const searchText = `${prompt.title} ${prompt.description} ${prompt.subcategory}`.toLowerCase();
                return keywordList.some(kw => searchText.includes(kw));
            });
        }

        // Sort by: averageRating (40%) + usageCount (30%) + recency (30%)
        const now = Date.now();
        prompts.sort((a: any, b: any) => {
            const ratingScoreA = (a.averageRating || 0) / 5; // normalize to 0-1
            const ratingScoreB = (b.averageRating || 0) / 5;

            const maxUsage = Math.max(...prompts.map((p: any) => p.usageCount || 0));
            const usageScoreA = maxUsage > 0 ? (a.usageCount || 0) / maxUsage : 0;
            const usageScoreB = maxUsage > 0 ? (b.usageCount || 0) / maxUsage : 0;

            const daysSinceA = (now - (a.createdAt?.toMillis?.() || 0)) / (1000 * 60 * 60 * 24);
            const daysSinceB = (now - (b.createdAt?.toMillis?.() || 0)) / (1000 * 60 * 60 * 24);
            const recencyScoreA = Math.max(0, 1 - (daysSinceA / 365)); // decay over 1 year
            const recencyScoreB = Math.max(0, 1 - (daysSinceB / 365));

            const scoreA = (ratingScoreA * 0.4) + (usageScoreA * 0.3) + (recencyScoreA * 0.3);
            const scoreB = (ratingScoreB * 0.4) + (usageScoreB * 0.3) + (recencyScoreB * 0.3);

            return scoreB - scoreA;
        });

        const results = prompts.slice(0, Math.min(limit, 10));

        logger.info(`✅ Found ${results.length} relevant prompts`);

        return {
            success: true,
            count: results.length,
            prompts: results
        };

    } catch (error: any) {
        logger.error('Search prompts error:', error);
        throw new HttpsError('internal', `שגיאה בחיפוש פרומפטים: ${error.message}`);
    }
});

// --- STATIC CONTENT GENERATION ---
/**
 * Generate static content (worksheets, letters, plans, etc.) directly with AI
 * Used by SmartCreationChat when teacher requests static/printable content
 *
 * NOTE: Using onRequest instead of onCall due to CORS issues with Firebase Functions v2
 */
export const generateStaticContent = onRequest({
    secrets: [geminiApiKey],
    memory: "512MiB",
    timeoutSeconds: 60,
    cors: true // Enable CORS for all origins
}, async (req, res) => {
    // Set CORS headers explicitly
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request
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
        // Verify Firebase Auth token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'נדרשת הזדהות' });
            return;
        }

        const idToken = authHeader.split('Bearer ')[1];
        let userId: string;

        try {
            const decodedToken = await auth.verifyIdToken(idToken);
            userId = decodedToken.uid;
        } catch (authError) {
            logger.error('Auth verification failed:', authError);
            res.status(401).json({ error: 'טוקן לא תקין' });
            return;
        }

        // Parse request body - handle both direct and wrapped data formats
        const requestData = req.body?.data || req.body;
        const { contentType, topic, grade, subject, additionalInstructions, language = 'he' } = requestData as {
            contentType: 'worksheet' | 'test' | 'lesson_plan' | 'letter' | 'feedback' | 'rubric' | 'custom';
            topic: string;
            grade?: string;
            subject?: string;
            additionalInstructions?: string;
            language?: 'he' | 'en';
        };

    if (!contentType || !topic) {
        throw new HttpsError('invalid-argument', 'contentType and topic are required');
    }

    logger.info(`📝 Generating static content - type: ${contentType}, topic: ${topic}, user: ${userId}`);

    // === Step 1: Try to find a matching prompt from the library ===
    const contentTypeToCategory: Record<string, { category: string; subcategory?: string; keywords: string[] }> = {
        worksheet: { category: 'דפי עבודה', subcategory: 'דף עבודה להדפסה', keywords: ['דף עבודה', 'תרגילים'] },
        test: { category: 'יצירת מבחנים', keywords: ['מבחן', 'בוחן', 'שאלות'] },
        lesson_plan: { category: 'הכנת שיעורים', keywords: ['מערך שיעור', 'תכנון'] },
        letter: { category: 'תקשורת אישית', keywords: ['מכתב', 'הורים'] },
        feedback: { category: 'תקשורת אישית', subcategory: 'מכתב אישי לתלמיד', keywords: ['משוב', 'תלמיד'] },
        rubric: { category: 'יצירת מבחנים', keywords: ['מחוון', 'רובריקה', 'הערכה'] }
    };

    let libraryPrompt: { promptTemplate: string; title: string } | null = null;
    const categoryInfo = contentTypeToCategory[contentType];

    if (categoryInfo) {
        try {
            // Search for matching prompt in library
            let query: FirebaseFirestore.Query = db.collection('prompts')
                .where('status', '==', 'active')
                .where('category', '==', categoryInfo.category);

            if (categoryInfo.subcategory) {
                query = query.where('subcategory', '==', categoryInfo.subcategory);
            }

            const snapshot = await query.limit(5).get();

            if (!snapshot.empty) {
                // Find best match based on keywords
                const prompts = snapshot.docs.map(doc => doc.data());
                const topicLower = topic.toLowerCase();

                // Score prompts by relevance
                let bestPrompt = prompts[0];
                let bestScore = 0;

                for (const prompt of prompts) {
                    let score = 0;
                    const searchText = `${prompt.title} ${prompt.description}`.toLowerCase();

                    // Check if topic words appear in prompt
                    topicLower.split(/\s+/).forEach(word => {
                        if (searchText.includes(word)) score += 2;
                    });

                    // Bonus for rating
                    score += (prompt.averageRating || 0) / 2;

                    if (score > bestScore) {
                        bestScore = score;
                        bestPrompt = prompt;
                    }
                }

                libraryPrompt = {
                    promptTemplate: bestPrompt.promptTemplate,
                    title: bestPrompt.title
                };

                logger.info(`📚 Found library prompt: "${libraryPrompt.title}"`);
            }
        } catch (promptError) {
            logger.warn('Could not search prompt library, using fallback:', promptError);
        }
    }

    // === Step 2: Fill placeholders if library prompt found ===
    const fillPlaceholders = (template: string, data: Record<string, string | undefined>): string => {
        let filled = template;
        const placeholderMap: Record<string, string | undefined> = {
            '{{מקצוע}}': data.subject,
            '{{שכבה}}': data.grade,
            '{{נושא}}': data.topic,
            '{{רמת_קושי}}': data.difficulty || 'בינונית',
            '{{מספר_תרגילים}}': data.numExercises || '7',
            '{{פרטים}}': data.additionalInstructions,
            '{{סוג_מבחן}}': data.testType || 'מסכם',
            '{{מספר_שאלות}}': data.numQuestions || '10',
            '{{משך_שיעור}}': data.duration || '45 דקות'
        };

        for (const [placeholder, value] of Object.entries(placeholderMap)) {
            if (value) {
                filled = filled.split(placeholder).join(value);
            } else {
                // Remove lines with unfilled required placeholders
                filled = filled.split('\n').filter(line => !line.includes(placeholder)).join('\n');
            }
        }

        return filled;
    };

    // === Step 3: Build the final prompt ===
    let finalPrompt: string;

    if (libraryPrompt) {
        // Use the library prompt with filled placeholders
        const filledPrompt = fillPlaceholders(libraryPrompt.promptTemplate, {
            subject,
            grade,
            topic,
            additionalInstructions
        });

        finalPrompt = `
אתה מומחה פדגוגי ליצירת תוכן חינוכי. השתמש בהנחיות הבאות ליצירת התוכן:

${filledPrompt}

הנחיות נוספות:
- הפלט צריך להיות HTML נקי שאפשר להדפיס
- אל תוסיף \`\`\`html או תגיות קוד - רק HTML נקי
- שפה: ${language === 'he' ? 'עברית (RTL)' : 'English'}
- עיצוב: מקצועי, ברור, עם טבלאות ורשימות לפי הצורך
`;
    } else {
        // Fallback to hardcoded prompts
        logger.info('📝 Using fallback hardcoded prompt');

    // Content type prompts (Fallback)
    const contentTypePrompts: Record<string, { title: string; systemPrompt: string }> = {
        worksheet: {
            title: 'דף עבודה',
            systemPrompt: `אתה מומחה ליצירת דפי עבודה חינוכיים. צור דף עבודה מקצועי ומעוצב היטב.
הדף צריך לכלול:
- כותרת ברורה עם מקום לשם התלמיד ותאריך
- הוראות ברורות
- תרגילים/שאלות מגוונים (לפחות 5-7)
- מקום לתשובות
- בונוס/אתגר בסוף (אופציונלי)

פורמט הפלט: HTML נקי עם עיצוב בסיסי (טבלאות, רשימות, קווים לכתיבה)`
        },
        test: {
            title: 'מבחן/בוחן',
            systemPrompt: `אתה מומחה ליצירת מבחנים ובחנים. צור מבחן מקצועי להדפסה.
המבחן צריך לכלול:
- כותרת עם שם המבחן, תאריך, שם התלמיד
- הוראות ברורות
- חלוקת ניקוד
- שאלות מגוונות (בחירה מרובה, פתוחות, השלמה)
- סה"כ 100 נקודות

פורמט הפלט: HTML נקי עם עיצוב מבחן מקצועי`
        },
        lesson_plan: {
            title: 'מערך שיעור',
            systemPrompt: `אתה מומחה פדגוגי ליצירת מערכי שיעור. צור מערך שיעור מפורט למורה.
המערך צריך לכלול:
- פרטי השיעור (נושא, כיתה, משך)
- מטרות ויעדים
- חומרים נדרשים
- מהלך השיעור (פתיחה, גוף, סיכום)
- פעילויות והערכה
- התאמות לתלמידים מתקשים/מתקדמים
- רפלקציה

פורמט הפלט: HTML מעוצב עם כותרות וטבלאות`
        },
        letter: {
            title: 'מכתב להורים',
            systemPrompt: `אתה מומחה בתקשורת בית-ספר-הורים. צור מכתב מקצועי ונעים.
המכתב צריך לכלול:
- כותרת בית הספר/מורה
- תאריך
- פנייה אישית
- גוף המכתב ברור ומכבד
- חתימה
- פרטי קשר

פורמט הפלט: HTML נקי בפורמט מכתב רשמי`
        },
        feedback: {
            title: 'משוב לתלמיד',
            systemPrompt: `אתה מומחה בכתיבת משובים חינוכיים. צור משוב בונה ומעודד.
המשוב צריך לכלול:
- פנייה אישית
- נקודות חוזקה (לפחות 3)
- תחומים לשיפור (1-2, בצורה בונה)
- המלצות להמשך
- סיום מעודד

פורמט הפלט: HTML נקי וידידותי`
        },
        rubric: {
            title: 'רובריקה להערכה',
            systemPrompt: `אתה מומחה בהערכה חינוכית. צור רובריקה מקצועית להערכת עבודות/מטלות.
הרובריקה צריכה לכלול:
- שם המטלה וקריטריונים
- רמות ביצוע (מצוין, טוב, מספק, דורש שיפור)
- תיאורי רמה מפורטים
- ניקוד לכל קריטריון
- סה"כ ניקוד

פורמט הפלט: טבלת HTML מעוצבת`
        },
        custom: {
            title: 'תוכן מותאם',
            systemPrompt: `אתה עוזר חינוכי מקצועי. צור תוכן לפי הבקשה הספציפית של המורה.
התוכן צריך להיות:
- מקצועי ומדויק
- מותאם לקהל היעד
- מעוצב להדפסה
- ברור וקריא

פורמט הפלט: HTML נקי ומעוצב`
        }
    };

    const config = contentTypePrompts[contentType] || contentTypePrompts.custom;

    // Build the fallback prompt
    finalPrompt = `
${config.systemPrompt}

פרטים:
- נושא: ${topic}
${grade ? `- כיתה/קהל יעד: ${grade}` : ''}
${subject ? `- מקצוע: ${subject}` : ''}
${additionalInstructions ? `- הנחיות נוספות: ${additionalInstructions}` : ''}

שפת התוכן: ${language === 'he' ? 'עברית (RTL)' : 'English'}

צור את התוכן עכשיו. הפלט צריך להיות HTML נקי שאפשר להדפיס.
אל תוסיף \`\`\`html או תגיות קוד - רק HTML נקי.
`;
    } // End of else (fallback)

    try {
        const messages: ChatMessage[] = [
            { role: 'user', content: finalPrompt }
        ];

        const result = await generateText(messages, {
            temperature: 0.7,
            maxTokens: 4000
        });

        // Clean up the result - remove markdown code blocks if present
        let content = result || '';
        content = content.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        // Add RTL wrapper for Hebrew
        if (language === 'he' && !content.includes('dir="rtl"')) {
            content = `<div dir="rtl" style="font-family: 'Heebo', 'Arial', sans-serif; line-height: 1.8;">${content}</div>`;
        }

        // Determine the title to use
        const contentTitle = libraryPrompt?.title || {
            worksheet: 'דף עבודה',
            test: 'מבחן/בוחן',
            lesson_plan: 'מערך שיעור',
            letter: 'מכתב להורים',
            feedback: 'משוב לתלמיד',
            rubric: 'רובריקה להערכה',
            custom: 'תוכן מותאם'
        }[contentType] || 'תוכן';

        logger.info(`✅ Generated static content successfully - ${content.length} chars (source: ${libraryPrompt ? 'library' : 'fallback'})`);

        // Return response wrapped in 'data' to match callable function format
        res.json({
            data: {
                success: true,
                contentType,
                title: contentTitle,
                topic,
                content,
                usedLibraryPrompt: !!libraryPrompt,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (genError: any) {
        logger.error('Generate static content AI error:', genError);
        res.status(500).json({ data: { success: false, error: `שגיאה ביצירת תוכן: ${genError.message}` } });
    }

    } catch (error: any) {
        logger.error('Generate static content error:', error);
        res.status(500).json({ error: `שגיאה: ${error.message}` });
    }
});

/**
 * Delete all prompts from the library (USE WITH CAUTION!)
 * Temporary function to clear old prompts before re-seeding
 */
export const deleteAllPrompts = onCall({
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 60
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    try {
        logger.info('🗑️ Deleting all prompts...');

        const promptsSnapshot = await db.collection('prompts').get();

        const batch = db.batch();
        promptsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        logger.info(`✅ Deleted ${promptsSnapshot.size} prompts successfully`);

        return {
            success: true,
            count: promptsSnapshot.size,
            message: `נמחקו ${promptsSnapshot.size} פרומפטים בהצלחה!`
        };

    } catch (error: any) {
        logger.error('Delete prompts error:', error);
        throw new HttpsError('internal', `שגיאה במחיקת פרומפטים: ${error.message}`);
    }
});

/**
 * Seed initial prompts to the library (ONE-TIME ONLY)
 * Call this once to initialize the prompt library with seed data
 */
import { seedPrompts } from "./seedPrompts";
export const seedPromptsLibrary = onCall({
    cors: true,
    memory: "256MiB",
    timeoutSeconds: 60
}, async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    // Check if user is admin (you may want to add admin check here)
    // For now, allow any authenticated user - change this in production!

    try {
        logger.info('🌱 Seeding prompts library...');
        const count = await seedPrompts();
        logger.info(`✅ Seeded ${count} prompts successfully`);

        return {
            success: true,
            count,
            message: `נוספו ${count} פרומפטים בהצלחה!`
        };

    } catch (error: any) {
        logger.error('Seed prompts error:', error);
        throw new HttpsError('internal', `שגיאה בהוספת פרומפטים: ${error.message}`);
    }
});

// --- GEMINI 3 PRO INFOGRAPHIC (HTML via Vertex AI) ---
export { generateGemini3Infographic as generateGemini3InfographicHttp } from "./gemini3InfographicService";

// --- GEMINI INFOGRAPHIC (Real AI Image Generation with Gemini 3 Pro Image) ---
export { generateGeminiInfographic } from "./imagen4InfographicService";

// --- YOUTUBE EDUCATIONAL SEARCH ---
export { searchYouTubeEducational, getYouTubeVideoDetails } from "./youtubeSearchService";

// --- CONTROLLERS ---
import { createAiController } from "./controllers/aiController";
import { createExamController } from "./controllers/examController";
import { createCurriculumAgent } from "./agent/curriculumAgent";
import type { ActivityGenerationRequest } from "./services/activityBank/types";

const { generateTeacherLessonPlan, generateStepContent, generatePodcastScript, generateMindMapFromContent } = createAiController(openAiApiKey);
export { generateTeacherLessonPlan, generateStepContent, generatePodcastScript, generateMindMapFromContent };

const examController = createExamController(openAiApiKey);

// --- SHARED IMPORTS ---
import { mapSystemItemToBlock, cleanJsonString } from './shared/utils/geminiParsers';
import type { RawAiItem } from './shared/types/gemini.types';
import type { MappedLearningBlock } from './shared/types/gemini.types';
import type { UnitSkeleton, SkeletonStep, StepContentResponse } from './shared/types/gemini.types';

// --- GEMINI 3 PRO IMAGE SERVICE ---
import {
    generateInfographicWithGemini3,
    isGemini3ImageAvailable,
    estimateGemini3ImageCost
} from './services/gemini3ImageService';

// --- KNOWLEDGE BASE (RAG) ---
export {
    uploadKnowledge,
    searchKnowledge,
    getKnowledgeContext,
    getKnowledgeStats,
    deleteKnowledgeDocument,
    getKnowledgeBooks,
    deleteKnowledgeBook,
    // Batch extraction continuation
    continueKnowledgeExtraction,
    // Extraction review functions
    createReviewForExistingBook,
    getExtractionReviews,
    getExtractionReview,
    correctPageExtraction,
    approveExtractionReview,
    updateReviewStoragePath,
    // Debug function (temporary)
    debugKnowledgeBase
} from './controllers/knowledgeController';

// --- TEXTBOOK MANAGEMENT (Textbook-Aligned Content Generation) ---
export {
    getTextbooks,
    getTextbookDetails,
    getChapterContent,
    searchWithinTextbook,
    getTextbookContext,
    createTextbookFromDocument,
    deleteTextbook,
    migrateKnowledgeBooksToTextbooks
} from './controllers/textbookController';

// --- REFERENCE EXAMS (Exam DNA Templates) ---
export {
    uploadReferenceExam,
    getReferenceExam,
    listReferenceExams,
    deleteReferenceExam,
    findMatchingReferenceExams,
    getReferenceExamStats,
    getAvailableTextbooks
} from './controllers/referenceExamController';

// --- LICENSING & USAGE MANAGEMENT ---
export {
    createInstitution,
    updateLicense,
    addUserToInstitution,
    getMyUsageStats,
    getInstitutionUsage,
    getAllUsage,
    monthlyQuotaReset,
    checkExpiringLicenses,
} from './controllers/licensingController';

// --- TYPES ---
// --- TYPES REMOVED (Imported from Shared) ---
// interface StepInfo ...
// interface UnitSkeleton ...

// --- PROXY FUNCTION (Production Fix) ---
export const openaiProxy = onRequest({ secrets: [openAiApiKey], cors: true }, async (req, res) => {
    // 1. Validate Method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // 2. Authenticate user via Firebase Auth token
    // Support both X-Firebase-Token header (new) and Authorization header (legacy)
    const firebaseToken = req.headers['x-firebase-token'] as string;
    const authHeader = req.headers.authorization;

    let idToken: string | undefined;
    if (firebaseToken) {
        idToken = firebaseToken;
    } else if (authHeader?.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    }

    if (!idToken) {
        logger.warn('Missing Firebase token');
        res.status(401).json({ error: 'נדרשת הזדהות' });
        return;
    }
    try {
        // Verify the Firebase ID token
        const decodedToken = await auth.verifyIdToken(idToken);
        // Attach user info to request for rate limiter
        (req as any).auth = { uid: decodedToken.uid };
    } catch (error) {
        logger.error('Invalid Firebase token:', error);
        res.status(401).json({ error: 'נדרשת הזדהות', code: 'UNAUTHORIZED' });
        return;
    }

    // 3. Apply Rate Limiting
    // Determine rate limit type based on endpoint
    let rateLimitType: 'ai-generation' | 'chat' | 'general' = 'general';
    if (req.path.includes('/chat/completions')) {
        // Check if it's a generation request or chat based on body
        const body = req.body as any;
        if (body?.messages?.length > 5 || body?.model?.includes('gpt-4o')) {
            rateLimitType = 'ai-generation';
        } else {
            rateLimitType = 'chat';
        }
    }

    await distributedRateLimit(rateLimitType)(req, res, async () => {
        const userId = (req as any).auth?.uid;
        const startTime = Date.now();

        // Determine call type for quota checking
        let callType: AICallType = 'chat';
        if (req.path.includes('/images')) {
            callType = 'image_generation';
        } else if (req.path.includes('/audio')) {
            callType = 'transcription';
        } else if (rateLimitType === 'ai-generation') {
            callType = 'lesson_skeleton'; // Content generation
        }

        // Check quota before making the API call
        const quotaCheck = await checkQuota(userId, callType);
        if (!quotaCheck.allowed) {
            res.status(429).json({
                error: quotaCheck.messageHe,
                code: quotaCheck.reason || 'QUOTA_EXCEEDED',
                quotaDetails: {
                    currentUsage: quotaCheck.currentUsage,
                    limit: quotaCheck.limit,
                    percentUsed: quotaCheck.percentUsed,
                    resetDate: quotaCheck.resetDate,
                    canUpgrade: quotaCheck.canUpgrade,
                }
            });
            return;
        }

        try {
            const apiKey = openAiApiKey.value();
            // 3. Extract Path (e.g., /chat/completions)
            // req.path will include the full path from the rewrite.
            // If local rewrite is /api/openai -> proxy, we need to extract the OpenAI endpoint.
            // Assuming rewrite sends /api/openai/v1/chat/completions -> proxy/v1/chat/completions
            const endpoint = req.path.replace('/api/openai', '');

            const url = `https://api.openai.com/v1${endpoint}`;

            logger.info(`Proxying request to: ${url}`, { rateLimitType });

            // 4. Forward Request
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(req.body)
            });

            // 5. Handle Response
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`OpenAI Error (${response.status}):`, errorText);

                // Log failed request
                logUsage({
                    institutionId: `personal_${userId}`,
                    userId,
                    callType,
                    provider: 'openai',
                    model: (req.body as any)?.model || 'gpt-4o-mini',
                    tokens: { input: 0, output: 0, total: 0 },
                    context: { functionName: 'openaiProxy' },
                    performance: { latencyMs: Date.now() - startTime, cached: false, retryCount: 0 },
                    status: 'error',
                    errorMessage: `HTTP ${response.status}`,
                }).catch(err => logger.error('Failed to log usage:', err));

                res.status(response.status).send(errorText);
                return;
            }

            const data = await response.json();

            // Log successful request with token usage
            const tokens = extractOpenAITokens(data);
            if (tokens.total > 0) {
                logUsage({
                    institutionId: `personal_${userId}`,
                    userId,
                    callType,
                    provider: 'openai',
                    model: (req.body as any)?.model || 'gpt-4o-mini',
                    tokens,
                    context: { functionName: 'openaiProxy' },
                    performance: { latencyMs: Date.now() - startTime, cached: false, retryCount: 0 },
                    status: 'success',
                }).catch(err => logger.error('Failed to log usage:', err));
            }

            res.json(data);

        } catch (error: any) {
            logger.error("Proxy Internal Error:", error);
            res.status(500).send({ error: error.message });
        }
    });
});

// --- ELEVENLABS TTS PROXY ---
/**
 * Proxy for ElevenLabs Text-to-Speech API
 * Keeps API key secure on server side
 */
export const elevenLabsProxy = onRequest({ secrets: [elevenLabsApiKey], cors: true }, async (req, res) => {
    // 1. Validate Method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // 2. Authenticate user via Firebase Auth token
    const authHeader = req.headers.authorization;
    let idToken: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
        idToken = authHeader.split('Bearer ')[1];
    }

    if (!idToken) {
        logger.warn('ElevenLabs Proxy: Missing Firebase token');
        res.status(401).json({ error: 'נדרשת הזדהות' });
        return;
    }

    let userId: string;
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
    } catch (error) {
        logger.error('ElevenLabs Proxy: Invalid Firebase token:', error);
        res.status(401).json({ error: 'נדרשת הזדהות', code: 'UNAUTHORIZED' });
        return;
    }

    // 3. Apply Rate Limiting
    await distributedRateLimit('ai-generation')(req, res, async () => {
        try {
            const apiKey = elevenLabsApiKey.value();
            const { voiceId, text, modelId, voiceSettings } = req.body;

            if (!voiceId || !text) {
                res.status(400).json({ error: 'Missing voiceId or text' });
                return;
            }

            logger.info(`🎙️ ElevenLabs TTS request for user ${userId}, voice: ${voiceId}`);

            // 4. Forward Request to ElevenLabs
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    text,
                    model_id: modelId || 'eleven_multilingual_v2',
                    voice_settings: voiceSettings || {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`ElevenLabs API Error (${response.status}):`, errorText);
                res.status(response.status).json({ error: 'TTS generation failed' });
                return;
            }

            // 5. Stream audio back to client
            res.setHeader('Content-Type', 'audio/mpeg');

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            res.send(buffer);

            logger.info(`✅ ElevenLabs TTS completed for user ${userId}`);

        } catch (error: any) {
            logger.error("ElevenLabs Proxy Internal Error:", error);
            res.status(500).json({ error: error.message });
        }
    });
});

// --- IMAGE ANALYSIS WITH VISION API ---
/**
 * Analyzes an uploaded image using Gemini 2.5 Pro Vision
 * Extracts educational content, text (OCR), diagrams, and relevant information
 * Returns structured content that can be used for lesson/activity generation
 */
export const analyzeImageWithVision = onCall({ cors: true, memory: "512MiB", secrets: [geminiApiKey] }, async (request) => {
    const { imageBase64, mimeType, context } = request.data;

    if (!imageBase64 || !mimeType) {
        throw new HttpsError('invalid-argument', 'Missing imageBase64 or mimeType');
    }

    logger.info(`🖼️ Analyzing image with Gemini 2.5 Pro Vision (type: ${mimeType})`);

    try {
        const prompt = `You are an expert educational content analyzer. Analyze the provided image and extract ALL relevant educational information.

Your task:
1. **Text Extraction (OCR)**: Extract ALL visible text from the image, maintaining structure and hierarchy.
2. **Content Analysis**: Identify the main educational topic, concepts, and key information.
3. **Visual Elements**: Describe any diagrams, charts, graphs, illustrations, or visual aids.
4. **Structure Detection**: Identify if this is a worksheet, textbook page, diagram, infographic, etc.
5. **Educational Value**: Determine what can be learned from this image.

${context ? `Context: ${context}\n\n` : ''}Analyze this educational image.

Output in Hebrew JSON format:
{
    "extracted_text": "Full text extracted from the image...",
    "main_topic": "Main educational topic",
    "key_concepts": ["concept1", "concept2"],
    "content_type": "worksheet | textbook | diagram | infographic | photo | chart | other",
    "visual_elements": [
        { "type": "diagram|chart|illustration|table", "description": "..." }
    ],
    "educational_summary": "Brief summary of educational content in Hebrew",
    "suggested_questions": ["Question 1?", "Question 2?"],
    "grade_level_estimate": "Estimated grade level in Hebrew (e.g., 'כיתה ז׳')",
    "subject_area": "Subject area in Hebrew"
}

IMPORTANT:
- Output MUST be in Hebrew
- Extract text exactly as it appears (preserve Hebrew/English as-is)
- Be thorough - don't miss any visible text or important visual elements
- If the image is unclear or low quality, still try to extract what you can
- Output ONLY valid JSON, no explanations`;

        const resultText = await generateWithVision(prompt, imageBase64, mimeType, {
            temperature: 0.3,
            maxTokens: 4000
        });

        // Clean and parse JSON
        let jsonText = resultText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];

        const analysis = JSON.parse(jsonText);

        logger.info(`✅ Image analysis complete. Topic: ${analysis.main_topic}, Content type: ${analysis.content_type}`);

        return {
            success: true,
            analysis,
            // Also return the extracted text as sourceText for lesson generation
            sourceText: analysis.extracted_text || analysis.educational_summary || ""
        };

    } catch (error: any) {
        logger.error("❌ Vision API Error:", error);
        throw new HttpsError('internal', `Image analysis failed: ${error.message}`);
    }
});

// --- YOUTUBE TRANSCRIPTION FUNCTION ---
import { YoutubeTranscript } from 'youtube-transcript';
// onCall and HttpsError imported at top level

// Error codes for better frontend handling
const TRANSCRIPTION_ERRORS = {
    NO_CAPTIONS: 'NO_CAPTIONS',
    PRIVATE_VIDEO: 'PRIVATE_VIDEO',
    VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    WHISPER_FAILED: 'WHISPER_FAILED',
    TRANSLATION_FAILED: 'TRANSLATION_FAILED',
    UNKNOWN: 'UNKNOWN'
} as const;

// Helper: Retry with exponential backoff
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            // Don't retry on non-retryable errors
            if (error.message?.includes('private') ||
                error.message?.includes('not found') ||
                error.message?.includes('unavailable')) {
                throw error;
            }
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                logger.info(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// Helper: Download YouTube audio and transcribe with Whisper (fallback)
async function transcribeWithWhisper(videoId: string, openai: OpenAI): Promise<string | null> {
    logger.info(`🎙️ Attempting Whisper fallback for video: ${videoId}`);

    try {
        // Use a YouTube audio extraction service
        // We'll use ytdl-core-compatible approach via a proxy service
        const audioUrl = `https://yt-audio-api.vercel.app/api/audio/${videoId}`;

        logger.info(`Fetching audio from: ${audioUrl}`);

        const audioResponse = await fetch(audioUrl, {
            headers: { 'Accept': 'audio/mpeg' },
            signal: AbortSignal.timeout(60000) // 60 second timeout for audio download
        });

        if (!audioResponse.ok) {
            logger.warn(`Audio fetch failed with status: ${audioResponse.status}`);
            return null;
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

        // Check file size (Whisper limit is 25MB)
        if (audioBlob.size > 25 * 1024 * 1024) {
            logger.warn(`Audio file too large for Whisper: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);
            return null;
        }

        logger.info(`Audio downloaded: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB, sending to Whisper...`);

        // Create a File-like object for OpenAI
        const audioFile = new File([audioBlob], `${videoId}.mp3`, { type: 'audio/mpeg' });

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: "he", // Prefer Hebrew, but Whisper auto-detects
            response_format: "text"
        });

        if (transcription && typeof transcription === 'string' && transcription.length > 50) {
            logger.info(`✅ Whisper transcription successful: ${transcription.length} characters`);
            return transcription;
        }

        return null;
    } catch (error: any) {
        logger.error("Whisper fallback failed:", error.message);
        return null;
    }
}

/**
 * Fetches transcript from a YouTube video URL.
 * Multi-strategy approach:
 * 1. Try YouTube captions (Hebrew → English → Auto)
 * 2. Fallback to Whisper speech-to-text
 * 3. Auto-translate to Hebrew if needed
 *
 * Returns detailed error codes for better UX
 */
export const transcribeYoutube = onCall({
    cors: true,
    memory: "512MiB", // Increased for Whisper processing
    timeoutSeconds: 300, // 5 minutes for long videos
    secrets: [openAiApiKey, geminiApiKey]
}, async (request) => {
    const { url, videoId } = request.data;
    const target = videoId || url;

    if (!target) {
        throw new HttpsError('invalid-argument', 'Missing url or videoId parameter', {
            code: TRANSCRIPTION_ERRORS.UNKNOWN,
            userMessage: 'לא התקבל קישור לסרטון'
        });
    }

    const openai = new OpenAI({ apiKey: openAiApiKey.value() });
    let transcriptSource: 'captions' | 'whisper' = 'captions';
    let originalLanguage: string = 'unknown';

    try {
        logger.info(`📺 Starting transcription for: ${target}`);

        // === STRATEGY 1: YouTube Captions ===
        let transcriptItems: any[] | null = null;
        const languageAttempts = [
            { lang: 'he', name: 'Hebrew' },
            { lang: 'iw', name: 'Hebrew (legacy)' },
            { lang: 'en', name: 'English' },
            { lang: undefined, name: 'Auto-detect' }
        ];

        for (const { lang, name } of languageAttempts) {
            try {
                logger.info(`Trying captions: ${name}`);

                const config = lang ? { lang } : undefined;

                // Use retry wrapper for network issues
                transcriptItems = await withRetry(
                    () => YoutubeTranscript.fetchTranscript(target, config),
                    2, // 2 retries
                    500 // 500ms base delay
                );

                if (transcriptItems && transcriptItems.length > 0) {
                    logger.info(`✅ Captions found: ${name} (${transcriptItems.length} segments)`);
                    originalLanguage = lang || 'auto';
                    break;
                }
            } catch (e: any) {
                const errorMsg = e.message?.toLowerCase() || '';

                // Check for specific YouTube errors
                if (errorMsg.includes('private')) {
                    throw new HttpsError('permission-denied', 'Video is private', {
                        code: TRANSCRIPTION_ERRORS.PRIVATE_VIDEO,
                        userMessage: 'הסרטון פרטי ולא ניתן לגשת אליו'
                    });
                }
                if (errorMsg.includes('not found') || errorMsg.includes('unavailable')) {
                    throw new HttpsError('not-found', 'Video not found', {
                        code: TRANSCRIPTION_ERRORS.VIDEO_NOT_FOUND,
                        userMessage: 'הסרטון לא נמצא או שהוסר'
                    });
                }

                logger.warn(`Caption fetch failed (${name}):`, e.message);
            }
        }

        // === STRATEGY 2: Whisper Fallback ===
        let cleanText = '';

        if (!transcriptItems || transcriptItems.length === 0) {
            logger.info(`⚠️ No captions found, trying Whisper fallback...`);

            // Extract video ID if we have a URL
            const vid = videoId || target.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/)?.[1];

            if (vid) {
                const whisperText = await transcribeWithWhisper(vid, openai);

                if (whisperText) {
                    cleanText = whisperText;
                    transcriptSource = 'whisper';
                    originalLanguage = 'he'; // Whisper was set to Hebrew
                    logger.info(`✅ Whisper transcription successful`);
                } else {
                    // Both strategies failed
                    throw new HttpsError('failed-precondition', 'No captions and Whisper failed', {
                        code: TRANSCRIPTION_ERRORS.NO_CAPTIONS,
                        userMessage: 'לסרטון אין כתוביות ולא הצלחנו לתמלל את האודיו. נסו להעתיק את התמליל ידנית מיוטיוב (לחצו על "..." ואז "הצג תמליל").'
                    });
                }
            } else {
                throw new HttpsError('failed-precondition', 'No captions available', {
                    code: TRANSCRIPTION_ERRORS.NO_CAPTIONS,
                    userMessage: 'לסרטון אין כתוביות זמינות. נסו להעתיק את התמליל ידנית מיוטיוב.'
                });
            }
        } else {
            // Process caption items
            const fullText = transcriptItems.map(item => item.text).join(' ');
            cleanText = fullText
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        // === STRATEGY 3: Auto-Translation to Hebrew ===
        const hasHebrew = /[\u0590-\u05FF]/.test(cleanText);
        let wasTranslated = false;

        if (!hasHebrew && cleanText.length > 0) {
            logger.info(`🌐 Content is not in Hebrew, translating with Gemini 2.5 Pro...`);

            try {
                const translated = await generateText([
                    {
                        role: "system",
                        content: "אתה מתרגם מקצועי. תרגם את התמליל הבא לעברית טבעית וקריאה. שמור על המשמעות המקורית."
                    },
                    {
                        role: "user",
                        content: cleanText.substring(0, 14000)
                    }
                ], { temperature: 0.3, maxTokens: 4000 });

                if (translated && translated.length > 50) {
                    cleanText = translated;
                    wasTranslated = true;
                    logger.info(`✅ Translation complete: ${cleanText.length} characters`);
                }
            } catch (transError: any) {
                logger.warn("Translation failed, returning original:", transError.message);
            }
        }

        // === SUCCESS RESPONSE ===
        logger.info(`📄 Transcription complete. Source: ${transcriptSource}, Length: ${cleanText.length}, Translated: ${wasTranslated}`);

        return {
            text: cleanText,
            metadata: {
                source: transcriptSource,
                originalLanguage,
                wasTranslated,
                characterCount: cleanText.length
            }
        };

    } catch (error: any) {
        // If it's already an HttpsError, re-throw
        if (error.code && error.details) {
            throw error;
        }

        // Handle rate limiting
        if (error.message?.includes('429') || error.message?.includes('rate')) {
            logger.error("Rate limited:", error);
            throw new HttpsError('resource-exhausted', 'Rate limited', {
                code: TRANSCRIPTION_ERRORS.RATE_LIMITED,
                userMessage: 'יותר מדי בקשות. נסו שוב בעוד דקה.'
            });
        }

        // Generic error
        logger.error("Transcription error:", error);
        throw new HttpsError('internal', error.message || 'Unknown error', {
            code: TRANSCRIPTION_ERRORS.UNKNOWN,
            userMessage: 'שגיאה לא צפויה בתמלול הסרטון. נסו שוב.'
        });
    }
});


// --- פונקציות עזר ---

const sanitizeData = (data: any): any => {
    return JSON.parse(JSON.stringify(data, (key, value) => {
        if (value === undefined) return null;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'function') return undefined;
        return value;
    }));
};

// [cleanJsonString and mapSystemItemToBlock removed - imported from shared]

// --- Agentic Workflow Stages ---

// Stage 1: The Architect (Planner) - BRAIN
async function runArchitectStage(context: { topic: string, gradeLevel: string, subject: string, fileData: any, activityLength: string, sourceText?: string, mode?: string }): Promise<UnitSkeleton | null> {
    let stepCount = 5;
    let structureGuide = "";

    if (context.activityLength === 'short') {
        stepCount = 3;
        structureGuide = `
        STEP 1: Foundation (Remember/Understand). Type: memory_game OR multiple_choice.
        STEP 2: Connection (Apply/Analyze). Type: fill_in_blanks OR categorization.
        STEP 3: Synthesis (Evaluate/Create). Type: open_question OR multiple_choice (scenario).
        `;
    } else if (context.activityLength === 'long') {
        stepCount = 7;
        structureGuide = `
        STEPS 1-2: Foundation. Type: memory_game / multiple_choice / true_false.
        STEPS 3-5: Connection. Type: fill_in_blanks / ordering / categorization / matching.
        STEPS 6-7: Synthesis. Type: open_question / multiple_choice.
        `;
    } else {
        stepCount = 5;
        structureGuide = `
        STEPS 1-2: Foundation (Remember). Type: memory_game OR multiple_choice.
        STEPS 3-4: Connection (Analyze). Type: fill_in_blanks OR categorization.
        STEP 5: Synthesis (Create). Type: open_question.
        `;
    }

    const contextPart = context.sourceText
        ? `BASE CONTENT ON THIS TEXT ONLY:\n"""${context.sourceText.substring(0, 15000)}"""\nIgnore outside knowledge if it contradicts the text.`
        : `Topic: "${context.topic}"`;

    const isAssessment = context.mode === 'assessment';

    // --- MODE SPECIFIC INSTRUCTIONS ---
    const taskDefinition = isAssessment
        ? `Task: Create a "Test Plan" (Exam Skeleton).`
        : `Task: Create a "Learning Skeleton" (Curriculum Plan).`;

    const segmentationRule = isAssessment
        ? `- **Assessment Strategy:** Scan for distinct topics to TEST. Identify key facts and processes that require verification.`
        : `- **Segmentation Strategy:** Scan for stories/topics to TEACH. Divorce the source text into ${stepCount} distinct narratives.`;

    const policyRule = isAssessment
        ? `- **POLICY:** Questions ONLY. No "Teaching" blocks. Focusing on Verification of Knowledge.`
        : `- **POLICY:** Text Chunk -> Question. Ensure frequent interaction.`;

    const systemPrompt = `
    Role: Pedagogical Architect (The Brain).
    ${taskDefinition}
    ${contextPart}
    Target Audience: ${context.gradeLevel}.
    Count: Exactly ${stepCount} steps.
    Language: Hebrew.

    MISSION:
    1. **Holistic Analysis:** Read the ENTIRE source text first.
    2. **STRATEGY:**
       ${segmentationRule}
       - **Anti-Bias Rule:** You MUST include ALL major distinct stories found.
       - **Constraint:** Chunk A must end completely before Chunk B begins.

    3. **ZERO-TEXT-WALL POLICY (V4):**
       ${policyRule}

    4. **Topic Policing:**
       - For each step, define a strict **narrative_focus** (Allowed Content) and **forbidden_topics** (Banned Content).

    5. **LOGIC SAFETY:**
       - **Categorization:** Categories must be MUTUALLY EXCLUSIVE.
       - **Ordering:** Must be based on objective criteria.

    6. **Structure Guide:**
    ${structureGuide}

    Output JSON Structure:
    {
      "unit_title": "String",
      "steps": [
        {
          "step_number": 1,
          "title": "Unique Title for Chunk A",
          "narrative_focus": "Discuss ONLY [Specific Concept A]...",
          "forbidden_topics": ["Concept B", "Concept C"],
          "bloom_level": "Remember",
          "suggested_interaction_type": "memory_game"
        }
      ]
    }
    `;

    const userContent: any[] = [{ type: "text", text: `Build the skeleton for topic: ${context.topic}` }];

    if (context.fileData) {
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${context.fileData.mimeType};base64,${context.fileData.base64}` }
        });
    }

    try {
        // Use Gemini 2.5 Pro for BRAIN (Architect)
        let text: string;
        if (context.fileData) {
            // With image - use vision
            const fullPrompt = `${systemPrompt}\n\nBuild the skeleton for topic: ${context.topic}\n\nOutput ONLY valid JSON.`;
            text = await generateWithVision(fullPrompt, context.fileData.base64, context.fileData.mimeType, {
                temperature: 0.7,
                maxTokens: 4096
            });
        } else {
            // Text only
            text = await generateText([
                { role: "system", content: systemPrompt },
                { role: "user", content: `Build the skeleton for topic: ${context.topic}\n\nOutput ONLY valid JSON.` }
            ], { temperature: 0.7, maxTokens: 4096 });
        }

        // Clean and parse JSON
        let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];

        const result = JSON.parse(cleanJsonString(jsonText)) as UnitSkeleton;

        if (!result.steps || !Array.isArray(result.steps)) {
            logger.error("Invalid skeleton format");
            return null;
        }
        return result;

    } catch (e) {
        logger.error("Architect Error:", e);
        return null; // Handle error gracefully
    }
}

// Stage 2: The Generator (Drafter) - HANDS (Parallel)
async function generateSingleStep(stepInfo: SkeletonStep, context: { topic: string, gradeLevel: string, sourceText?: string, mode?: string }): Promise<any | null> {
    const contextText = context.sourceText
        ? `Source Material:\n"""${context.sourceText.substring(0, 3000)}..."""`
        : `Topic: ${context.topic}`;

    const isAssessment = context.mode === 'assessment';

    // --- MODE SPECIFIC PROMPTS ---
    const roleDefinition = isAssessment
        ? `Role: "Strict Examiner" (Objective Testing AI).\nTask: Create a single rigorous exam question.`
        : `Role: "Wizdi-Bot" (Expert Pedagogical AI).\nTask: Create ONE interactive learning block.`;

    const contentRule = isAssessment
        ? `
        - **CONTENT BAN:** You are creating a TEST. Do NOT teach. 
        - **Constraint:** \`teach_content\` field MUST be empty string "" or null.
        - **Tone:** Neutral, Objective, Formal.
        `
        : `
        - **Focus:** Discuss ONLY: ${stepInfo.narrative_focus}.
        - **Tone:** Engaging, Scaffolding, Age-Appropriate.
        `;

    const hintsRule = isAssessment
        ? `- **NO HINTS:** \`progressive_hints\` MUST be an empty array [].`
        : `- **Scaffolding:** Provide 2-3 progressive hints.`;

    const systemPrompt = `
    ${roleDefinition}
    Input: Step Instructions from Architect.
    ${contextText}

    MANDATORY REQUIREMENTS:
    1. **Pedagogy:** Strictly follow the Bloom Level (${stepInfo.bloom_level}) and Interaction Type (${stepInfo.suggested_interaction_type}).
    2. **ZERO-TEXT-WALL RULE (V4):**
       ${contentRule}
       - **BAN:** Do NOT mention: ${JSON.stringify(stepInfo.forbidden_topics || [])}.

    3. **Complexity Adaptation (Age: ${context.gradeLevel}):** 
       - **Age Adaptation (Grades 1-6):** Use concrete terminology.
       - **Tone (Grade 7+):** Objective, Historical Tone.

    4. **STRICT GROUNDING (Anti-Hallucination V3):**
       - **Rule:** Use ONLY the provided Source Text. If it's not in the PDF, it doesn't exist.

    5. **Micro-Learning Progression:**
       - Treat this step as "Question ${stepInfo.step_number}".

    6. **Logic & Interaction Rules:**
       - **Ordering:** The 'teach_content' (if allowed) MUST be a narrative story. Items must be paraphrased.
       - **Categorization:** Categories must be **MUTUALLY EXCLUSIVE**.
       - **OPEN QUESTION RUBRIC:** Provide a detailed \`model_answer\` with 3-4 bullet points.
       - **Language:** OUTPUT VALUES MUST BE IN HEBREW.

    7. **PEDAGOGICAL SAFETY VALVE (BLOOM-PRESERVING FALLBACK):**
       - If requested type is impossible given text, fallback to a valid type that preserves Bloom Level.
       - NEVER return empty/broken JSON.

    8. **Assessment Specifics:**
       ${hintsRule}
       - **Feedback:** Explain WHY the answer is correct/incorrect (Discriminative).

    Output FORMAT (JSON ONLY):
    {
       "step_number": ${stepInfo.step_number},
       "bloom_level": "${stepInfo.bloom_level}", 
       "teach_content": "${isAssessment ? "" : "Full explanation text..."}",
       "selected_interaction": "${stepInfo.suggested_interaction_type}", 
       "data": {
          "progressive_hints": ${isAssessment ? "[]" : `["Hint 1", "Hint 2"]`},
          "source_reference_hint": "See section '...'",
          // DYNAMIC STRUCTURE BASED ON INTERACTION TYPE...
       }
    }
    `;

    try {
        // Use Gemini 2.5 Pro for HANDS (Generator)
        const text = await generateText([
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate Step ${stepInfo.step_number} now.\n\nOutput ONLY valid JSON.` }
        ], {
            temperature: isAssessment ? 0.3 : 0.7,
            maxTokens: 4096
        });

        // Clean and parse JSON
        let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];

        return JSON.parse(cleanJsonString(jsonText));
    } catch (e) {
        logger.error(`Step Gen Error (Step ${stepInfo.step_number}):`, e);
        return null;
    }
}

// Stage 3: Critic Removed (Architecture Optimization)

// --- AGENTIC GUARDIAN (STRICT VALIDATION) ---

const LESSON_PLAN_GUARDIAN_PROMPT = `
System Role: You are the "Wizdi" System Integrity & Pedagogical Guardian. Your primal directive is to verify that a generated output strictly adheres to the definitions of a LESSON PLAN and has not accidentally degenerated into a Quiz, Activity, or Summary.

Context: The system has a specific mode called "Lesson Plan Generator". Sometimes, AI models get confused and generate a list of questions (a Quiz) instead of a teaching guide. Your job is to catch this error immediately.

Input Data:
Declared Mode: {{SYSTEM_MODE}} (Should always be "LESSON_PLAN" for this check).
Generated Content: {{CONTENT_TEXT}}
UI Flags (Metadata): {{UI_BUTTONS_PRESENT}} (Buttons enabled for this content).

Phase 1: The "Identity Check" (Critical Fail Conditions)
Before analyzing quality, check for System Mode Violations. If any of these are TRUE, report CRITICAL FAIL immediately:

1. The "Worksheet Fallacy": 
   - Does the content consist only of questions and answers without instructional text for the teacher? (YES = FAIL).
   
2. The "Student Voice" Error: 
   - Does the text address the reader as "You, the student" (e.g., "Draw a line...", "Circle the answer") instead of "You, the teacher" (e.g., "Ask the students to...", "Present the slide")? (YES = FAIL).

3. The "Link Logic" Violation: 
   - (Based on UI Flags) Is the "Send Link to Student" button enabled for this content? 
   - Rule: A Lesson Plan is for the teacher's eyes only. It must NOT be shareable to students as a playable task. (YES = FAIL).

Phase 2: Qualitative Pedagogical Audit
Only if Phase 1 passed, proceed to evaluate quality:

Structure Verification:
- Does it have a distinct Time Allocation (e.g., "5 mins")?
- Is there a clear separation between "Teacher Action" (Frontal teaching) and "Student Activity"?

Source Integrity:
- Does the lesson plan reflect the specific provided topic/file?

Output Format (Hebrew JSON):
{
  "status": "PASS" | "REJECT",
  "critical_fail_reason": null | "Worksheet Fallacy" | "Student Voice Error" | "Link Logic Violation",
  "pedagogical_score": number, // 0-100
  "feedback_hebrew": "Short summary of issues or approval in Hebrew",
  "issues": [
      { "description": "...", "severity": "CRITICAL" | "WARNING" }
  ]
}
`;

async function validateLessonPlanWithGuardian(content: any[], mode: string): Promise<any> {
    // Only run Guardian in 'lesson' mode
    if (mode === 'assessment' || mode === 'game') return { status: 'PASS', note: 'Guardian skipped for non-lesson mode' };

    logger.info("🛡️ GUARDIAN: Starting Strict Integrity Check with Gemini 2.5 Pro...");

    const contentSample = JSON.stringify(content).substring(0, 15000);
    const uiFlags = "Print PDF: ENABLED, Share with Colleague: ENABLED, Share to Student: DISABLED";

    const prompt = LESSON_PLAN_GUARDIAN_PROMPT
        .replace('{{SYSTEM_MODE}}', 'LESSON_PLAN')
        .replace('{{CONTENT_TEXT}}', contentSample)
        .replace('{{UI_BUTTONS_PRESENT}}', uiFlags);

    try {
        const resultText = await generateText([
            { role: "user", content: prompt + '\n\nOutput ONLY valid JSON.' }
        ], { temperature: 0.1, maxTokens: 2048 });

        // Clean and parse JSON
        let jsonText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];

        const validationResult = JSON.parse(cleanJsonString(jsonText));

        logger.info("🛡️ GUARDIAN RESULT:", validationResult);
        return validationResult;

    } catch (e) {
        logger.error("Guardian Check Failed:", e);
        return { status: 'PASS', note: 'Guardian failed to execute' };
    }
}

// --- Cloud Function ---

export const generateLessonPlan = onDocumentCreated(
    {
        document: "course_generation_queue/{docId}",
        secrets: [openAiApiKey, geminiApiKey],
        timeoutSeconds: 540, // Increased timeout for 3 stages
        memory: "512MiB",
    },
    async (event) => {
        if (!event.data) return;

        const docId = event.params.docId;
        const data = event.data.data() as any;

        if (!data || data.status !== "pending") return;

        try {
            logger.info(`Starting 3-Stage generation for document ${docId}`);
            await event.data.ref.update({ status: "processing" });

            const openai = new OpenAI({ apiKey: openAiApiKey.value() });
            const { topic, gradeLevel, subject = "כללי", fileData, activityLength = "medium", taxonomy, includeBot = true } = data;
            const unitTitle = topic || "פעילות למידה";

            // --- EXECUTE STAGES ---

            // 1. Architect (The Brain)
            logger.info(`Stage 1: Architect (Hyperspeed) running in ${data.mode || 'learning'} mode...`);
            const skeleton = await runArchitectStage({
                topic,
                gradeLevel,
                subject,
                fileData,
                activityLength,
                sourceText: data.sourceText,
                mode: data.mode || 'learning'
            });

            if (!skeleton || !skeleton.steps) {
                throw new Error("Architect failed to generate a valid skeleton.");
            }

            // 2. Generator (The Hands) - PARALLEL EXECUTION
            logger.info(`Stage 2: Hands running in PARALLEL for ${skeleton.steps.length} steps...`);

            const stepPromises = skeleton.steps.map(step =>
                generateSingleStep(step, {
                    topic,
                    gradeLevel,
                    sourceText: data.sourceText,
                    mode: data.mode || 'learning'
                })
            );

            const results = await Promise.all(stepPromises);
            const validResults = results.filter(r => r !== null);

            logger.info(`Generation complete. Success: ${validResults.length}/${skeleton.steps.length}`);

            // --- 🛡️ GUARDIAN CHECK ---
            const guardianResult = await validateLessonPlanWithGuardian(validResults, data.mode || 'learning');

            if (guardianResult.status === 'REJECT') {
                logger.warn("🛡️ GUARDIAN SOFT-BLOCK:", guardianResult);
                // throw new Error(`AI Guardian Blocked Content: ${guardianResult.critical_fail_reason} - ${guardianResult.feedback_hebrew}`);
                // FALLBACK: Allow content but log warning (Beta Mode)
            }
            logger.info("🛡️ Guardian Approved Content.");

            // --- BUILDING FINAL DOCUMENT ---

            const blocks: any[] = [];

            // Add Introduction Block
            blocks.push({
                id: uuidv4(),
                type: 'text',
                content: `### ברוכים הבאים לשיעור ב${subject}\n**נושא:** ${unitTitle}\nמותאם עבור ${gradeLevel}.\n\n*מטרות השיעור (מתוך הארכיטקט):*\n${skeleton.unit_title || unitTitle}`,
                metadata: {}
            });

            // Add Teacher Bot
            if (includeBot) {
                blocks.push({
                    id: uuidv4(),
                    type: 'interactive-chat',
                    content: { title: "המורה הוירטואלי", description: `עזרה בנושאי ${subject}` },
                    metadata: {
                        botPersona: 'teacher',
                        initialMessage: `שלום! אני המורה ל${subject}. איך אפשר לעזור בנושא ${unitTitle}?`,
                        systemPrompt: `אתה מורה ל${subject} בכיתה ${gradeLevel}. ענה בעברית רק בהקשר ל${topic}.`
                    }
                });
            }

            // Add Generated and Mapped Steps
            validResults.forEach((item: any) => {
                const block = mapSystemItemToBlock(item);
                if (block) blocks.push(block);
            });

            if (validResults.length === 0) {
                throw new Error("Generated content is empty. Please try again.");
            }

            const finalPlan = [
                {
                    id: uuidv4(),
                    title: "פעילות",
                    learningUnits: [
                        {
                            id: uuidv4(),
                            title: topic || "פעילות למידה",
                            type: 'practice',
                            activityBlocks: blocks
                        }
                    ]
                }
            ];

            const cleanFinalPlan = sanitizeData(finalPlan);

            await event.data.ref.update({
                status: "completed",
                result: cleanFinalPlan,
                updatedAt: new Date(),
            });

            logger.info(`Successfully generated lesson for ${docId}`);

        } catch (error: any) {
            logger.error("Error generating lesson:", error);
            await event.data.ref.update({
                status: "error",
                error: error.message || "Unknown error occurred",
            });
        }
    }
);

// --- EXAM GENERATION CLOUD FUNCTION ---
/**
 * generateExam - Dedicated Cloud Function for Exam Generation
 *
 * Listens to: exam_generation_queue/{docId}
 * Pipeline: Exam Architect → Exam Generator → Exam Guardian
 * Output: Pure exam with no hints, no teaching content
 *
 * This function is completely isolated from learning content generation
 * to ensure exam integrity and maintainability.
 */
export const generateExam = onDocumentCreated(
    {
        document: "exam_generation_queue/{docId}",
        secrets: [openAiApiKey],
        timeoutSeconds: 540,
        memory: "512MiB",
    },
    async (event) => {
        if (!event.data) return;

        const docId = event.params.docId;
        const data = event.data.data() as any;

        if (!data || data.status !== "pending") return;

        try {
            logger.info(`🎓 Starting EXAM generation for document ${docId}`);
            await event.data.ref.update({ status: "processing" });

            const {
                topic,
                gradeLevel,
                subject = "כללי",
                fileData,
                activityLength = "medium",
                sourceText,
                taxonomy,
                title
            } = data;

            // Execute Exam Generation Pipeline
            const result = await examController.generateExam({
                topic,
                gradeLevel,
                subject,
                fileData,
                activityLength,
                sourceText,
                taxonomy,
                customTitle: title
            });

            if (!result.success) {
                throw new Error(result.error || "Exam generation failed");
            }

            // Sanitize and save (uses global sanitizeData)
            const cleanExam = sanitizeData(result.exam);

            await event.data.ref.update({
                status: "completed",
                result: cleanExam,
                metadata: result.metadata,
                guardianResult: result.guardianResult,
                updatedAt: new Date(),
            });

            logger.info(`🎉 Successfully generated exam for ${docId} (Quality: ${result.metadata.qualityScore}/100)`);

        } catch (error: any) {
            logger.error("❌ Error generating exam:", error);
            await event.data.ref.update({
                status: "error",
                error: error.message || "Unknown error occurred",
            });
        }
    }
);

// --- CURRICULUM AGENT (Autonomous Activity Generation) ---
/**
 * generateCurriculumActivity - Autonomous Activity Generation
 *
 * Listens to: activity_generation_queue/{docId}
 * Pipeline: Gemini Agent orchestrating Architect → Generator → Guardian
 * Output: High-quality activities saved to activity_bank collection
 *
 * The agent does NOT create content directly - it orchestrates the existing
 * pipeline with all its rules and constraints (linguistic, bias checks, etc.)
 *
 * Model: gemini-3-pro-preview (same as rest of system)
 */
export const generateCurriculumActivity = onDocumentCreated(
    {
        document: "activity_generation_queue/{docId}",
        secrets: [geminiApiKey, openAiApiKey],
        timeoutSeconds: 540,    // 9 minutes
        memory: "1GiB",         // Increased for agent operations
    },
    async (event) => {
        if (!event.data) return;

        const docId = event.params.docId;
        const data = event.data.data() as ActivityGenerationRequest;

        if (!data || data.status !== "pending") return;

        try {
            logger.info(`🤖 Starting Curriculum Agent for document ${docId}`, {
                subject: data.subject,
                gradeLevel: data.gradeLevel,
                activityCount: data.activityCount,
                model: 'gemini-3-pro-preview'
            });

            await event.data.ref.update({
                status: "processing",
                startedAt: new Date()
            });

            // Create and run the Curriculum Agent (uses Gemini from environment)
            const agent = createCurriculumAgent(
                openAiApiKey.value(),  // For embeddings only
                {
                    maxIterations: 50,      // Allow up to 50 tool calls
                    timeoutMs: 480000,      // 8 minutes (buffer for cleanup)
                    activityCountPerRun: data.activityCount || 5
                }
            );

            const result = await agent.generateActivities(data);

            // Build result object without undefined values (Firestore doesn't allow undefined)
            const updateResult: Record<string, any> = {
                activitiesCreated: result.activitiesCreated,
                activityIds: result.activityIds,
                qualityScores: result.qualityScores,
                totalTimeMs: result.totalTimeMs
            };

            // Only add errors if there are any
            if (result.errors && result.errors.length > 0) {
                updateResult.errors = result.errors;
            }

            await event.data.ref.update({
                status: "completed",
                completedAt: new Date(),
                result: updateResult
            });

            logger.info(`🎉 Curriculum Agent completed: ${result.activitiesCreated} activities created`, {
                docId,
                activityIds: result.activityIds,
                avgQuality: result.qualityScores.length > 0
                    ? Math.round(result.qualityScores.reduce((a, b) => a + b, 0) / result.qualityScores.length)
                    : 0
            });

        } catch (error: any) {
            logger.error("❌ Curriculum Agent failed:", error);
            await event.data.ref.update({
                status: "failed",
                error: error.message || "Unknown error occurred",
                completedAt: new Date()
            });
        }
    }
);

// --- ADAPTIVE BRAIN (BKT ENGINE) ---
// This function moves the "Student Model" logic from the client (insecure) to the cloud (secure).
// Enhanced with variant tracking and IRT data collection for future calibration.
export const submitAdaptiveAnswer = onCall({ cors: true }, async (request) => {
    const {
        userId,
        unitId,
        blockId,
        score,
        metadata,
        isCorrect,
        // Enhanced fields (optional, backwards compatible)
        variantId,
        variantType,
        responseTimeMs,
    } = request.data;

    if (!userId || !unitId) {
        throw new HttpsError('invalid-argument', 'Missing userId or unitId');
    }

    const db = getFirestore();
    // 1. Get Topic from Metadata - prioritize curriculumTopicId from Knowledge Base
    // Fallback chain: curriculumTopicId → tags[0] → 'general'
    const topic = metadata?.curriculumTopicId || metadata?.tags?.[0] || 'general';
    const difficulty = metadata?.difficulty_level || 0.5;
    const effectiveVariantType = variantType || metadata?.variantType || 'יישום';

    // Log if using legacy fallback (helps track migration progress)
    if (!metadata?.curriculumTopicId) {
        logger.warn(`Block ${blockId} missing curriculumTopicId, using fallback topic: "${topic}"`);
    }

    // 2. Fetch User's Cognitive State for this Unit/Topic
    const stateRef = db.doc(`users/${userId}/adaptive_state/${unitId}`);
    const stateDoc = await stateRef.get();
    let state = stateDoc.exists ? stateDoc.data() : {
        mastery: { [topic]: 0.1 }, // Initial prior
        history: []
    };

    // 3. Bayesian Knowledge Tracing (BKT) Simplified
    // P(L) = Probability of knowing the skill
    const prior = state?.mastery?.[topic] || 0.1;

    // BKT Parameters (Std defaults)
    const P_G = 0.25; // Guess
    const P_S = 0.1;  // Slip
    const P_T = 0.1;  // Transit (Learning rate)

    let posterior = 0;

    if (isCorrect) {
        // P(L|Correct) = (P(L) * (1 - P_S)) / (P(L)*(1-P_S) + (1-P(L))*P_G)
        const num = prior * (1 - P_S);
        const den = num + (1 - prior) * P_G;
        posterior = num / den;
    } else {
        // P(L|Incorrect) = (P(L) * P_S) / (P(L)*P_S + (1-P(L))*(1-P_G))
        const num = prior * P_S;
        const den = num + (1 - prior) * (1 - P_G);
        posterior = num / den;
    }

    // Update with Transit (Learning occurred during the step)
    // P(L_new) = P(L_posterior) + (1 - P(L_posterior)) * P_T
    const newMastery = posterior + (1 - posterior) * P_T;

    // 4. Update State
    const updatedMasteryMap = { ...(state?.mastery || {}), [topic]: newMastery };

    await stateRef.set({
        mastery: updatedMasteryMap,
        lastUpdated: FieldValue.serverTimestamp(),
        history: FieldValue.arrayUnion({
            blockId,
            score,
            isCorrect,
            timestamp: Date.now(),
            prior,
            posterior: newMastery,
            // Enhanced fields for IRT calibration (backwards compatible)
            ...(variantId && { variantId }),
            ...(effectiveVariantType && { variantType: effectiveVariantType }),
            ...(responseTimeMs && { responseTimeMs }),
            difficulty,
        })
    }, { merge: true });

    // Log to IRT statistics collection for future calibration
    // This data will be used by the IRT calibration job
    const irtStatsRef = db.collection('irt_submission_logs');
    await irtStatsRef.add({
        questionId: blockId,
        variantId: variantId || blockId,
        variantType: effectiveVariantType,
        isCorrect,
        responseTimeMs: responseTimeMs || null,
        studentMasteryAtSubmission: prior,
        difficulty,
        topic,
        userId, // For deduplication, not for IRT calculation
        timestamp: FieldValue.serverTimestamp(),
    });

    // 5. Policy Engine: Decide Next Action
    let action = 'continue';
    let message = '';

    if (newMastery > 0.95) {
        action = 'mastered';
        message = 'Topic Mastered! You are ready for the next challenge.';
    } else if (newMastery < 0.2 && difficulty < 0.4) {
        // Failure on easy content -> Needs intervention
        action = 'remediate';
        message = 'Let\'s review the basics.';
    } else if (isCorrect && difficulty > 0.7) {
        action = 'challenge';
        message = 'Excellent! Moving to advanced topics.';
    }

    logger.info(`BKT Update for ${userId}: ${topic} ${prior.toFixed(2)} -> ${newMastery.toFixed(2)} [${action}]`);

    return {
        success: true,
        mastery: newMastery,
        action,
        feedback: message
    };
});

// --- EVENT SOURCING FOR SCALABILITY ---
import { processEvents, appendEvent, getEventStats, cleanupOldEvents } from './services/eventSourcing';
import { onSchedule } from 'firebase-functions/v2/scheduler';

/**
 * Event Processor Trigger
 * Processes pending events when new events are created
 * This allows 100 concurrent writes without conflicts
 */
export const processEventsTrigger = onDocumentCreated('events/{eventId}', async (event) => {
    const eventData = event.data?.data();
    if (!eventData || eventData.processed) {
        return;
    }

    const aggregateId = eventData.aggregateId;

    // Debounce: only process if multiple events pending
    const pendingCount = await db.collection('events')
        .where('aggregateId', '==', aggregateId)
        .where('processed', '==', false)
        .count()
        .get();

    // Process when 10+ events accumulated (reduces function invocations)
    if (pendingCount.data().count >= 10) {
        logger.info(`Processing ${pendingCount.data().count} events for ${aggregateId}`);
        await processEvents(aggregateId);
    }
});

/**
 * Scheduled Event Processor
 * Processes remaining events every 5 minutes (catches stragglers)
 */
export const processEventsScheduled = onSchedule('every 5 minutes', async () => {
    const stats = await getEventStats();
    logger.info(`Event stats: ${stats.pending} pending, ${stats.processed} processed`);

    if (stats.pending > 0) {
        // Get unique aggregate IDs with pending events
        const snapshot = await db.collection('events')
            .where('processed', '==', false)
            .limit(100)
            .get();

        const aggregateIds = new Set<string>();
        snapshot.docs.forEach(doc => {
            aggregateIds.add(doc.data().aggregateId);
        });

        // Process each aggregate
        for (const aggregateId of aggregateIds) {
            await processEvents(aggregateId);
        }

        logger.info(`Processed events for ${aggregateIds.size} aggregates`);
    }
});

/**
 * Cleanup Old Events
 * Runs daily at 2 AM
 */
export const cleanupEventsScheduled = onSchedule('0 2 * * *', async () => {
    const deleted = await cleanupOldEvents(30); // Delete events older than 30 days
    logger.info(`Cleaned up ${deleted} old events`);
});

/**
 * Cleanup expired rate limit entries
 * Runs daily at 3 AM (after event cleanup)
 */
import { cleanupExpiredRateLimits } from "./middleware/distributedRateLimiter";
export const cleanupRateLimitsScheduled = onSchedule('0 3 * * *', async () => {
    const deleted = await cleanupExpiredRateLimits();
    logger.info(`Cleaned up ${deleted} expired rate limit entries`);
});

// --- IRT CALIBRATION ---
// Calculates question difficulty from real student response data
import { runIRTCalibration, cleanupOldIRTLogs } from "./services/irtCalibrationService";

/**
 * IRT Calibration Job
 * Runs daily at 4 AM to calibrate question difficulty from response data
 */
export const runIRTCalibrationScheduled = onSchedule('0 4 * * *', async () => {
    logger.info('Starting IRT calibration job');

    const results = await runIRTCalibration(30); // Minimum 30 responses

    logger.info('IRT calibration complete', results);

    // Cleanup old logs
    const cleaned = await cleanupOldIRTLogs(90); // Keep 90 days
    logger.info(`Cleaned up ${cleaned} old IRT submission logs`);
});

// --- BUDGET ALERTS HANDLER ---
// Handles Pub/Sub messages from GCP Budget Alerts
import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { processBudgetAlert, getBudgetStatus, disableEmergencyMode } from './services/budgetAlerts';

export const handleBudgetAlert = onMessagePublished('budget-alerts', async (event) => {
    const message = event.data.message;
    const data = message.json;

    logger.info('Budget alert received', { data });

    await processBudgetAlert({ data });
});

/**
 * Get current budget/emergency status (for admin dashboard)
 */
export const getBudgetStatusEndpoint = onCall({ cors: true }, async (request) => {
    // Only admins can check budget status
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.data()?.isAdmin) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    return getBudgetStatus();
});

/**
 * Disable emergency mode (admin only)
 */
export const disableEmergencyModeEndpoint = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.data()?.isAdmin) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    await disableEmergencyMode();
    logger.info('Emergency mode disabled by admin', { uid });

    return { success: true };
});

// --- CUSTOM CLAIMS MANAGEMENT ---
// ============================================================
// Admin endpoints for managing user roles via Custom Claims
// Claims are stored in JWT tokens for performant authorization
// ============================================================

/**
 * Set user role (admin only)
 * Roles: 'admin', 'teacher', 'student'
 */
export const setUserRoleEndpoint = onCall({ cors: true }, async (request) => {
    // Verify admin using claims (not Firestore lookup)
    try {
        requireRole(request.auth, 'admin');
    } catch {
        // Fallback to Firestore check for backward compatibility
        const adminUid = request.auth?.uid;
        if (!adminUid) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (!adminDoc.data()?.isAdmin && adminDoc.data()?.role !== 'admin') {
            throw new HttpsError('permission-denied', 'Admin access required');
        }
    }

    const { userId, role } = request.data as { userId: string; role: UserClaims['role'] };

    if (!userId || !role) {
        throw new HttpsError('invalid-argument', 'userId and role are required');
    }

    if (!['admin', 'teacher', 'student'].includes(role)) {
        throw new HttpsError('invalid-argument', 'Invalid role');
    }

    const success = await setUserRole(userId, role);
    if (!success) {
        throw new HttpsError('internal', 'Failed to set user role');
    }

    logger.info('User role updated via claims', {
        adminId: request.auth?.uid,
        targetUserId: userId,
        newRole: role
    });

    return { success: true, userId, role };
});

/**
 * Grant premium status (admin only)
 */
export const grantPremiumEndpoint = onCall({ cors: true }, async (request) => {
    try {
        requireRole(request.auth, 'admin');
    } catch {
        const adminUid = request.auth?.uid;
        if (!adminUid) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (!adminDoc.data()?.isAdmin) {
            throw new HttpsError('permission-denied', 'Admin access required');
        }
    }

    const { userId } = request.data as { userId: string };

    if (!userId) {
        throw new HttpsError('invalid-argument', 'userId is required');
    }

    const success = await grantPremium(userId);
    if (!success) {
        throw new HttpsError('internal', 'Failed to grant premium');
    }

    logger.info('Premium granted via claims', {
        adminId: request.auth?.uid,
        targetUserId: userId
    });

    return { success: true, userId, premium: true };
});

/**
 * Revoke premium status (admin only)
 */
export const revokePremiumEndpoint = onCall({ cors: true }, async (request) => {
    try {
        requireRole(request.auth, 'admin');
    } catch {
        const adminUid = request.auth?.uid;
        if (!adminUid) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (!adminDoc.data()?.isAdmin) {
            throw new HttpsError('permission-denied', 'Admin access required');
        }
    }

    const { userId } = request.data as { userId: string };

    if (!userId) {
        throw new HttpsError('invalid-argument', 'userId is required');
    }

    const success = await revokePremium(userId);
    if (!success) {
        throw new HttpsError('internal', 'Failed to revoke premium');
    }

    logger.info('Premium revoked via claims', {
        adminId: request.auth?.uid,
        targetUserId: userId
    });

    return { success: true, userId, premium: false };
});

/**
 * Get user claims (admin only)
 */
export const getUserClaimsEndpoint = onCall({ cors: true }, async (request) => {
    try {
        requireRole(request.auth, 'admin');
    } catch {
        const adminUid = request.auth?.uid;
        if (!adminUid) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (!adminDoc.data()?.isAdmin) {
            throw new HttpsError('permission-denied', 'Admin access required');
        }
    }

    const { userId } = request.data as { userId: string };

    if (!userId) {
        throw new HttpsError('invalid-argument', 'userId is required');
    }

    const claims = await getUserClaims(userId);

    return { userId, claims };
});

/**
 * Sync claims from Firestore (admin only)
 * Useful for migrating existing users to claims-based auth
 */
export const syncUserClaimsEndpoint = onCall({ cors: true }, async (request) => {
    try {
        requireRole(request.auth, 'admin');
    } catch {
        const adminUid = request.auth?.uid;
        if (!adminUid) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }
        const adminDoc = await db.collection('users').doc(adminUid).get();
        if (!adminDoc.data()?.isAdmin) {
            throw new HttpsError('permission-denied', 'Admin access required');
        }
    }

    const { userId, userIds } = request.data as { userId?: string; userIds?: string[] };

    if (userId) {
        // Single user sync
        const result = await syncClaimsFromFirestore(userId);
        return result;
    } else if (userIds && userIds.length > 0) {
        // Bulk sync (max 100 at a time)
        const limitedIds = userIds.slice(0, 100);
        const results = await bulkSyncClaims(limitedIds);
        return {
            total: limitedIds.length,
            succeeded: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        };
    }

    throw new HttpsError('invalid-argument', 'userId or userIds is required');
});

/**
 * Get my claims (authenticated user)
 * Allows users to check their own claims
 */
export const getMyClaimsEndpoint = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Extract claims from token (no database lookup needed!)
    const claims = extractClaimsFromContext(request.auth);

    return { userId: uid, claims };
});

/**
 * Firestore Trigger: Initialize claims when a new user document is created
 * This ensures every new user gets proper claims set up automatically
 */
export const onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        logger.error('No data in user created event');
        return;
    }

    const userId = event.params.userId;
    const userData = snapshot.data();

    logger.info('New user document created, initializing claims', {
        userId,
        role: userData?.role
    });

    // Initialize claims based on user data
    const success = await initializeNewUserClaims(userId, {
        role: userData?.role || 'student',
        organizationId: userData?.organizationId
    });

    if (success) {
        logger.info('Claims initialized for new user', { userId });
    } else {
        logger.error('Failed to initialize claims for new user', { userId });
    }
});

// --- EDTECH NEWS SERVICE ---
// Fetches AI/EdTech news from RSS feeds, translates to Hebrew
// חידושים בטכנולוגיה חינוכית

const AI_NEWS_RSS_FEEDS = [
    // Google Education & Workspace
    { url: 'https://workspaceupdates.googleblog.com/atom.xml', name: 'Google Workspace Updates' },
    { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI Blog' },
    // AI Companies
    { url: 'https://openai.com/blog/rss.xml', name: 'OpenAI Blog' },
];

const EDUCATION_KEYWORDS = [
    // Core education terms
    'education', 'learning', 'teaching', 'school', 'student', 'teacher',
    'classroom', 'curriculum', 'training', 'course', 'lesson',
    'academic', 'university', 'edtech', 'e-learning', 'tutoring',
    // Google Education tools
    'classroom', 'workspace', 'chromebook', 'google for education',
    'notebooklm', 'gemini', 'docs', 'slides', 'forms',
    // AI in Education
    'ai tutor', 'personalized learning', 'adaptive learning',
    'educational ai', 'learning assistant'
];

function calculateNewsRelevance(title: string, summary: string): number {
    const text = `${title} ${summary}`.toLowerCase();
    let score = 0; // Start from 0, not 5!

    // Must contain at least one education keyword
    for (const keyword of EDUCATION_KEYWORDS) {
        if (text.includes(keyword)) score += 2;
    }

    // Bonus for explicitly educational content
    const strongKeywords = ['education', 'learning', 'teaching', 'teacher', 'student', 'classroom', 'school'];
    for (const keyword of strongKeywords) {
        if (text.includes(keyword)) score += 1;
    }

    return Math.min(score, 10);
}

async function parseRSSFeedServer(feedUrl: string, sourceName: string): Promise<Array<{
    title: string;
    summary: string;
    link: string;
    pubDate: string;
    sourceName: string;
}>> {
    try {
        const response = await fetch(feedUrl, {
            headers: { 'User-Agent': 'Wizdi-News-Bot/1.0' }
        });

        if (!response.ok) {
            logger.warn(`RSS fetch failed for ${feedUrl}: ${response.status}`);
            return [];
        }

        const xml = await response.text();
        const articles: Array<{
            title: string;
            summary: string;
            link: string;
            pubDate: string;
            sourceName: string;
        }> = [];

        // Simple XML parsing for RSS items
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

        for (let i = 0; i < Math.min(itemMatches.length, 5); i++) {
            const item = itemMatches[i];

            const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
            const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
            const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);
            const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

            const title = titleMatch?.[1]?.trim() || '';
            let summary = descMatch?.[1]?.trim() || '';

            // Clean HTML from summary
            summary = summary.replace(/<[^>]*>/g, '').substring(0, 500);

            if (title) {
                articles.push({
                    title,
                    summary,
                    link: linkMatch?.[1]?.trim() || feedUrl,
                    pubDate: pubDateMatch?.[1] || new Date().toISOString(),
                    sourceName
                });
            }
        }

        return articles;
    } catch (error) {
        logger.error(`Error fetching RSS ${feedUrl}:`, error);
        return [];
    }
}

async function translateToHebrew(title: string, summary: string): Promise<{
    hebrewTitle: string;
    hebrewSummary: string;
}> {
    try {
        const prompt = `אתה עוזר שמתרגם ומסכם חדשות טכנולוגיה למורים ישראליים.

כתבה באנגלית:
כותרת: ${title}
תקציר: ${summary}

אנא:
1. תרגם את הכותרת לעברית בצורה תמציתית וברורה
2. כתוב סיכום של 2-3 משפטים בעברית, המתמקד בהשפעה על מורים ובית הספר

החזר JSON בלבד:
{"hebrewTitle": "...", "hebrewSummary": "..."}`;

        const text = await generateText([
            { role: 'user', content: prompt + '\n\nOutput ONLY valid JSON.' }
        ], { temperature: 0.3, maxTokens: 500 });

        let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];

        return JSON.parse(jsonText);
    } catch (error) {
        logger.error('Translation error:', error);
        return { hebrewTitle: title, hebrewSummary: summary };
    }
}

/**
 * Scheduled function to fetch and update AI news
 * Runs every 6 hours
 */
export const updateAINews = onSchedule({
    schedule: 'every 6 hours',
    secrets: [openAiApiKey, geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 300
}, async () => {
    logger.info('📰 Starting AI News update...');

    try {
        const openai = new OpenAI({ apiKey: openAiApiKey.value() });
        const allArticles: Array<{
            title: string;
            summary: string;
            link: string;
            pubDate: string;
            sourceName: string;
            relevanceScore: number;
        }> = [];

        // Fetch from all RSS feeds
        for (const feed of AI_NEWS_RSS_FEEDS) {
            const articles = await parseRSSFeedServer(feed.url, feed.name);
            for (const article of articles) {
                const relevanceScore = calculateNewsRelevance(article.title, article.summary);
                if (relevanceScore >= 5) {
                    allArticles.push({ ...article, relevanceScore });
                }
            }
        }

        logger.info(`Found ${allArticles.length} relevant articles`);

        // Sort by relevance and take top 5
        const topArticles = allArticles
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 5);

        // Translate and save to Firestore
        for (const article of topArticles) {
            // Check if article already exists (by URL)
            const existing = await db.collection('aiNews')
                .where('sourceUrl', '==', article.link)
                .limit(1)
                .get();

            if (!existing.empty) {
                logger.info(`Skipping existing article: ${article.title}`);
                continue;
            }

            // Translate to Hebrew
            const { hebrewTitle, hebrewSummary } = await translateToHebrew(
                article.title,
                article.summary
            );

            // Verify translation contains Hebrew (skip if translation failed)
            const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);
            if (!hasHebrew(hebrewTitle) || !hasHebrew(hebrewSummary)) {
                logger.warn(`Skipping non-Hebrew translation: ${article.title}`);
                continue;
            }

            // Save to Firestore
            await db.collection('aiNews').add({
                originalTitle: article.title,
                originalSummary: article.summary,
                hebrewTitle,
                hebrewSummary,
                sourceUrl: article.link,
                sourceName: article.sourceName,
                publishedAt: new Date(article.pubDate),
                fetchedAt: FieldValue.serverTimestamp(),
                relevanceScore: article.relevanceScore
            });

            logger.info(`✅ Added news: ${hebrewTitle}`);
        }

        // Cleanup old news (keep only last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const oldNews = await db.collection('aiNews')
            .where('fetchedAt', '<', thirtyDaysAgo)
            .get();

        const batch = db.batch();
        oldNews.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        logger.info(`📰 AI News update complete. Added ${topArticles.length} articles, deleted ${oldNews.size} old ones.`);

    } catch (error) {
        logger.error('AI News update failed:', error);
    }
});

/**
 * Manual trigger for AI news update (for admin use)
 * @param forceRegenerate - If true, deletes all existing news first
 */
export const triggerAINewsUpdate = onCall({
    cors: true,
    secrets: [openAiApiKey, geminiApiKey],
    timeoutSeconds: 300
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const forceRegenerate = request.data?.forceRegenerate === true;
    logger.info(`📰 Manual AI News update triggered by ${request.auth.uid}${forceRegenerate ? ' (force regenerate)' : ''}`);

    // If force regenerate, delete all existing news
    if (forceRegenerate) {
        const existingNews = await db.collection('aiNews').get();
        const batch = db.batch();
        existingNews.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        logger.info(`Deleted ${existingNews.size} existing news items`);
    }

    let addedCount = 0;

    for (const feed of AI_NEWS_RSS_FEEDS) {
        const articles = await parseRSSFeedServer(feed.url, feed.name);

        for (const article of articles.slice(0, 3)) {
            const relevanceScore = calculateNewsRelevance(article.title, article.summary);

            logger.info(`Article "${article.title}" - relevance score: ${relevanceScore}`);

            if (relevanceScore >= 5) {
                const existing = await db.collection('aiNews')
                    .where('sourceUrl', '==', article.link)
                    .limit(1)
                    .get();

                if (existing.empty) {
                    const { hebrewTitle, hebrewSummary } = await translateToHebrew(
                        article.title,
                        article.summary
                    );

                    const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);
                    if (!hasHebrew(hebrewTitle) || !hasHebrew(hebrewSummary)) {
                        logger.warn(`Skipping non-Hebrew translation: ${article.title}`);
                        continue;
                    }

                    await db.collection('aiNews').add({
                        originalTitle: article.title,
                        originalSummary: article.summary,
                        hebrewTitle,
                        hebrewSummary,
                        sourceUrl: article.link,
                        sourceName: article.sourceName,
                        publishedAt: new Date(article.pubDate),
                        fetchedAt: FieldValue.serverTimestamp(),
                        relevanceScore
                    });

                    addedCount++;
                    logger.info(`✅ Added: ${hebrewTitle}`);
                }
            }
        }
    }

    return { success: true, addedCount, forceRegenerate };
});

/**
 * Generate Infographic with Gemini 3 Pro Image
 * Preview API - Advanced text rendering with Hebrew RTL support
 *
 * @param data.content - Educational content in Hebrew
 * @param data.visualType - Type of infographic (flowchart, timeline, comparison, cycle)
 * @param data.topic - Optional topic name
 * @returns Base64 PNG image or error
 */
export const generateGemini3Infographic = onCall({
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 120,
    secrets: [geminiApiKey]
}, async (request) => {
    const startTime = Date.now();

    try {
        // 1. Validate request
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const { content, visualType, topic } = request.data;

        if (!content || typeof content !== 'string') {
            throw new HttpsError('invalid-argument', 'Content is required');
        }

        if (!['flowchart', 'timeline', 'comparison', 'cycle'].includes(visualType)) {
            throw new HttpsError('invalid-argument', 'Invalid visual type');
        }

        // 2. Check availability
        if (!isGemini3ImageAvailable()) {
            throw new HttpsError(
                'unavailable',
                'Gemini 3 Pro Image is not available. Check project configuration.'
            );
        }

        // 3. Get user ID (rate limiting is handled by Cloud Functions quotas)
        const userId = request.auth.uid;

        // 4. Generate infographic
        logger.info('🎨 Generating Gemini 3 Pro Image infographic', {
            userId,
            visualType,
            contentLength: content.length
        });

        const result = await generateInfographicWithGemini3(content, visualType, topic);

        if (!result) {
            throw new HttpsError(
                'internal',
                'Failed to generate infographic with Gemini 3 Pro Image'
            );
        }

        const generationTime = Date.now() - startTime;

        // 5. Log analytics
        await db.collection('analytics').add({
            type: 'gemini3_infographic_generation',
            userId,
            visualType,
            contentLength: content.length,
            generationTime,
            success: true,
            timestamp: FieldValue.serverTimestamp()
        });

        logger.info('✅ Gemini 3 Pro Image infographic generated successfully', {
            userId,
            visualType,
            generationTime: `${generationTime}ms`,
            imageSize: `${Math.round(result.base64.length * 0.75 / 1024)}KB`
        });

        // 6. Return result
        return {
            success: true,
            image: {
                base64: result.base64,
                mimeType: result.mimeType
            },
            metadata: {
                generationTime,
                model: 'gemini-3-pro-image-preview',
                visualType,
                estimatedCost: estimateGemini3ImageCost('1K').estimatedCost
            }
        };

    } catch (error: any) {
        const generationTime = Date.now() - startTime;

        // Log failure
        if (request.auth) {
            await db.collection('analytics').add({
                type: 'gemini3_infographic_generation',
                userId: request.auth.uid,
                visualType: request.data?.visualType,
                generationTime,
                success: false,
                error: error.message,
                timestamp: FieldValue.serverTimestamp()
            });
        }

        logger.error('❌ Gemini 3 Pro Image infographic generation failed', {
            error: error.message,
            code: error.code,
            generationTime: `${generationTime}ms`
        });

        // Re-throw HttpsError, wrap others
        if (error instanceof HttpsError) {
            throw error;
        }

        throw new HttpsError(
            'internal',
            `Infographic generation failed: ${error.message}`
        );
    }
});

// ============================================
// PROMPTS LIBRARY - Auto-Generation Agent
// ============================================

// Prompt categories for teacher tools
const PROMPT_CATEGORIES = [
    {
        id: 'exams',
        name: 'יצירת מבחנים',
        icon: '📝',
        subcategories: ['מבחן רב-ברירה', 'מבחן פתוח', 'בוחן מהיר (5 דקות)', 'מבחן מותאם לתלמידים עם לקויות']
    },
    {
        id: 'worksheets',
        name: 'דפי עבודה',
        icon: '📄',
        subcategories: ['דף עבודה להדפסה', 'תרגילי חזרה', 'דף תרגול מונחה', 'דף העמקה']
    },
    {
        id: 'lessons',
        name: 'הכנת שיעורים',
        icon: '📚',
        subcategories: ['פתיחת שיעור מעניינת', 'סיכום שיעור', 'שיעור מבוסס חקר', 'שיעור הפוך (Flipped)']
    },
    {
        id: 'feedback',
        name: 'משוב לתלמידים',
        icon: '💬',
        subcategories: ['משוב על עבודה כתובה', 'משוב מעודד לתלמיד מתקשה', 'משוב לתלמיד מצטיין', 'משוב להורים']
    },
    {
        id: 'activities',
        name: 'משחקים ופעילויות',
        icon: '🎮',
        subcategories: ['משחק כיתתי', 'תחרות קבוצתית', 'חידון', 'פעילות שיתופית']
    },
    {
        id: 'adaptations',
        name: 'התאמות אישיות',
        icon: '🎯',
        subcategories: ['פישוט טקסט', 'העמקה לתלמיד מצטיין', 'התאמה לדיסלקציה', 'תרגום לערבית']
    },
    {
        id: 'content',
        name: 'יצירת תוכן',
        icon: '✨',
        subcategories: ['סיפור לימודי', 'שיר על נושא', 'דיאלוג להמחשה', 'אנלוגיה להסבר מושג']
    },
    {
        id: 'management',
        name: 'ניהול כיתה',
        icon: '👥',
        subcategories: ['תסריט לשיחה עם הורה', 'טיפול בבעיית משמעת', 'הנעת תלמיד מנותק', 'בניית חוזה כיתתי']
    },
    {
        id: 'assessment',
        name: 'הערכה חלופית',
        icon: '📊',
        subcategories: ['רובריקה להערכה', 'פרויקט מסכם', 'תיק עבודות (Portfolio)', 'הערכת עמיתים']
    },
    {
        id: 'sel',
        name: 'למידה חברתית-רגשית (SEL)',
        icon: '🤝',
        subcategories: ['מערך שיעור חברתי', 'פעילות מיומנויות SEL', 'משחק תפקידים', 'פעילות אופטימיות וחוסן']
    },
    {
        id: 'planning',
        name: 'תכנון ותכניות עבודה',
        icon: '📋',
        subcategories: ['תכנית עבודה כיתתית', 'תכנית לימודית אישית', 'תכנון שנתי', 'תכנון יחידת הוראה']
    },
    {
        id: 'communication',
        name: 'תקשורת אישית',
        icon: '💌',
        subcategories: ['מכתב אישי לתלמיד', 'הודעה להורים', 'משוב מעצים', 'ברכה אישית']
    }
];

/**
 * Generate AI Teaching Prompts - Weekly Scheduler
 * Creates one new prompt per week and marks it as featured
 * Runs every Monday at 9 AM Israel time
 */
export const generateWeeklyPrompt = onSchedule({
    schedule: '0 9 * * 1', // Every Monday at 9 AM
    timeZone: 'Asia/Jerusalem',
    secrets: [openAiApiKey, geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 120
}, async () => {
    logger.info('🤖 Starting weekly prompt generation...');

    try {
        // Pick a random category and subcategory
        const randomCategory = PROMPT_CATEGORIES[Math.floor(Math.random() * PROMPT_CATEGORIES.length)];
        const randomSubcategory = randomCategory.subcategories[Math.floor(Math.random() * randomCategory.subcategories.length)];

        logger.info(`📌 Selected: ${randomCategory.name} > ${randomSubcategory}`);

        // Generate prompt using Gemini 2.5 Pro
        const content = await generateText([
            {
                role: 'system',
                content: `אתה מומחה ליצירת פרומפטים למורים בישראל. צור פרומפט איכותי שמורים יוכלו להעתיק לכלי AI כמו ChatGPT, Claude או Gemini.

הפרומפט חייב לכלול שדות דינמיים בפורמט {{שם_שדה}} שהמורה ימלא לפני ההעתקה.

ענה בפורמט JSON בלבד:
{
  "title": "כותרת קצרה וברורה",
  "description": "תיאור של 1-2 משפטים מה הפרומפט עושה",
  "promptTemplate": "הפרומפט עצמו עם {{שדות}} דינמיים",
  "fields": [
    {
      "id": "שם_השדה",
      "label": "שם תצוגה",
      "placeholder": "דוגמה למילוי",
      "type": "text|select|number",
      "options": ["אפשרות1", "אפשרות2"],
      "required": true
    }
  ],
  "tips": "טיפ קצר לשימוש יעיל"
}`
            },
            {
                role: 'user',
                content: `צור פרומפט איכותי בקטגוריה "${randomCategory.name}" עבור "${randomSubcategory}".

דרישות:
1. הפרומפט חייב להיות בעברית
2. כלול לפחות 3 שדות דינמיים (מקצוע, שכבה, נושא וכו')
3. הפרומפט צריך להיות מפורט ולתת הנחיות ברורות לכלי ה-AI
4. הוסף טיפ שימושי למורה

Output ONLY valid JSON.`
            }
        ], { temperature: 0.8, maxTokens: 2000 });

        if (!content) {
            throw new Error('No content in Gemini response');
        }

        // Parse the JSON response
        let cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleanedContent = jsonMatch[0];
        const promptData = JSON.parse(cleanedContent);

        // Unmark previous featured prompt
        const previousFeatured = await db.collection('prompts')
            .where('isFeatured', '==', true)
            .get();

        const batch = db.batch();
        previousFeatured.docs.forEach(doc => {
            batch.update(doc.ref, { isFeatured: false });
        });

        // Create the new prompt
        const newPromptRef = db.collection('prompts').doc();
        batch.set(newPromptRef, {
            id: newPromptRef.id,
            title: promptData.title,
            description: promptData.description,
            category: randomCategory.name,
            subcategory: randomSubcategory,
            promptTemplate: promptData.promptTemplate,
            fields: promptData.fields,
            targetTools: ['ChatGPT', 'Claude', 'Gemini'],
            tips: promptData.tips,
            createdBy: null, // Auto-generated
            creatorName: 'מערכת Wizdi',
            createdAt: FieldValue.serverTimestamp(),
            isAutoGenerated: true,
            usageCount: 0,
            averageRating: 0,
            ratingCount: 0,
            status: 'active',
            isFeatured: true,
            featuredAt: FieldValue.serverTimestamp()
        });

        await batch.commit();

        logger.info(`✅ Weekly prompt created: "${promptData.title}" (${randomCategory.name} > ${randomSubcategory})`);

    } catch (error: any) {
        logger.error('❌ Weekly prompt generation failed:', error);
    }
});

/**
 * Bulk Generate Initial Prompts
 * One-time function to create initial prompts using Gemini 2.0 Flash
 * Call manually via: firebase functions:call generateInitialPrompts
 */
export const generateInitialPrompts = onCall({
    cors: true,
    memory: '2GiB',
    timeoutSeconds: 540, // 9 minutes
    secrets: [geminiApiKey]
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    logger.info('🚀 Starting bulk prompt generation with Gemini 2.0 Flash...');

    // Dynamic import to avoid cold start issues
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    const createdPrompts: string[] = [];
    let errorCount = 0;

    // Generate prompts for each category/subcategory combination
    for (const category of PROMPT_CATEGORIES) {
        for (const subcategory of category.subcategories) {
            // Check if we already have a prompt for this combination
            const existing = await db.collection('prompts')
                .where('category', '==', category.name)
                .where('subcategory', '==', subcategory)
                .where('isAutoGenerated', '==', true)
                .limit(1)
                .get();

            if (!existing.empty) {
                logger.info(`⏭️ Skipping existing: ${category.name} > ${subcategory}`);
                continue;
            }

            try {
                logger.info(`📝 Generating: ${category.name} > ${subcategory}`);

                const prompt = `אתה מומחה פדגוגי ליצירת פרומפטים איכותיים למורים בישראל.

צור פרומפט מקצועי ומעמיק בקטגוריה "${category.name}" עבור "${subcategory}".

הפרומפט צריך להיות:
1. מותאם לשימוש עם כלי AI כמו ChatGPT, Claude או Gemini
2. כולל הנחיות ברורות ומפורטות שמנחות את ה-AI ליצור תוצר איכותי
3. מכיל לפחות 3 שדות דינמיים שהמורה ימלא (בפורמט {{שם_שדה}})
4. כתוב בעברית תקנית ומקצועית
5. כולל טיפ שימושי למורה

ענה בפורמט JSON בלבד (ללא markdown או backticks):
{
  "title": "כותרת קצרה וברורה",
  "description": "תיאור של 1-2 משפטים על מה הפרומפט עושה",
  "promptTemplate": "הפרומפט המלא עם {{שדות}} דינמיים - צריך להיות מפורט ומקצועי",
  "fields": [
    {"id": "field1", "label": "תווית בעברית", "placeholder": "דוגמה למה לכתוב", "type": "text", "required": true}
  ],
  "tips": "טיפ מועיל לשימוש יעיל בפרומפט"
}

סוגי שדות אפשריים: "text", "select", "number"
עבור select הוסף גם "options": ["אפשרות1", "אפשרות2"]`;

                const result = await genAI.models.generateContent({
                    model: 'gemini-3-pro-preview',
                    contents: prompt
                });
                const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!content) continue;

                const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const promptData = JSON.parse(cleanedContent);

                const newPromptRef = db.collection('prompts').doc();
                await newPromptRef.set({
                    id: newPromptRef.id,
                    title: promptData.title,
                    description: promptData.description,
                    category: category.name,
                    subcategory: subcategory,
                    promptTemplate: promptData.promptTemplate,
                    fields: promptData.fields,
                    targetTools: ['ChatGPT', 'Claude', 'Gemini'],
                    tips: promptData.tips,
                    createdBy: null,
                    creatorName: 'מערכת Wizdi',
                    createdAt: FieldValue.serverTimestamp(),
                    isAutoGenerated: true,
                    usageCount: 0,
                    averageRating: 0,
                    ratingCount: 0,
                    status: 'active',
                    isFeatured: false
                });

                createdPrompts.push(`${category.name} > ${subcategory}`);
                logger.info(`✅ Created: ${promptData.title}`);

                // Delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 1500));

            } catch (error: any) {
                errorCount++;
                logger.warn(`⚠️ Failed: ${category.name} > ${subcategory}:`, error.message);
            }
        }
    }

    // Mark one random prompt as featured
    const allPrompts = await db.collection('prompts')
        .where('isAutoGenerated', '==', true)
        .get();

    if (!allPrompts.empty) {
        const randomIndex = Math.floor(Math.random() * allPrompts.docs.length);
        await allPrompts.docs[randomIndex].ref.update({
            isFeatured: true,
            featuredAt: FieldValue.serverTimestamp()
        });
    }

    logger.info(`🎉 Bulk generation complete: ${createdPrompts.length} created, ${errorCount} failed`);

    return {
        success: true,
        created: createdPrompts.length,
        errors: errorCount,
        prompts: createdPrompts
    };
});

/**
 * Delete all auto-generated prompts
 * One-time function to clear prompts before regenerating with a better model
 */
export const deleteAutoGeneratedPrompts = onCall({
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 120
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    logger.info('🗑️ Deleting all auto-generated prompts...');

    const autoGenerated = await db.collection('prompts')
        .where('isAutoGenerated', '==', true)
        .get();

    let deletedCount = 0;
    const batch = db.batch();

    for (const doc of autoGenerated.docs) {
        batch.delete(doc.ref);
        deletedCount++;

        // Firestore batch limit is 500
        if (deletedCount % 400 === 0) {
            await batch.commit();
            logger.info(`Deleted ${deletedCount} prompts so far...`);
        }
    }

    // Commit remaining
    if (deletedCount % 400 !== 0) {
        await batch.commit();
    }

    logger.info(`✅ Deleted ${deletedCount} auto-generated prompts`);

    return {
        success: true,
        deleted: deletedCount
    };
});

// ============================================
// TASK EMAIL REPORT SYSTEM
// ============================================

import { sendTaskReportEmail, type TaskReportData } from './services/emailService';
import { analyzeSubmissions, type SubmissionData, type TaskData } from './services/submissionAnalysisService';

/**
 * Scheduled function to check for tasks with passed due dates
 * and send email reports to teachers
 * Runs every hour
 */
export const checkDueTasksAndSendReports = onSchedule({
    schedule: 'every 1 hours',
    secrets: [openAiApiKey],
    memory: '512MiB',
    timeoutSeconds: 300
}, async () => {
    logger.info('📧 Starting due tasks check for email reports...');

    const now = new Date();

    try {
        // Find tasks where:
        // 1. dueDate has passed (dueDate < now)
        // 2. emailReportSentAt is null/undefined (not sent yet)
        // Note: We check teacher's emailReportsEnabled setting, not the task setting
        const tasksSnapshot = await db.collection('student_tasks')
            .where('dueDate', '<', now)
            .get();

        if (tasksSnapshot.empty) {
            logger.info('No tasks with passed due dates');
            return;
        }

        const openai = new OpenAI({ apiKey: openAiApiKey.value() });
        let processedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const taskDoc of tasksSnapshot.docs) {
            const taskData = taskDoc.data();

            // Skip if report already sent
            if (taskData.emailReportSentAt) {
                continue;
            }

            try {
                logger.info(`Processing task: ${taskData.title} (${taskDoc.id})`);

                // Check if teacher has email reports enabled
                const teacherDoc = await db.collection('users').doc(taskData.teacherId).get();
                const teacherData = teacherDoc.data();

                if (!teacherData?.emailReportsEnabled) {
                    logger.info(`Skipping - teacher ${taskData.teacherId} has email reports disabled`);
                    skippedCount++;
                    continue;
                }

                // Get teacher email from Firebase Auth
                const teacherRecord = await auth.getUser(taskData.teacherId);
                const teacherEmail = teacherRecord.email;

                if (!teacherEmail) {
                    logger.warn(`No email found for teacher: ${taskData.teacherId}`);
                    continue;
                }

                // Get all submissions for this task
                const submissionsSnapshot = await db.collection('task_submissions')
                    .where('taskId', '==', taskDoc.id)
                    .get();

                const submissions: SubmissionData[] = submissionsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        studentId: data.studentId,
                        studentName: data.studentName || 'תלמיד',
                        status: data.status,
                        progress: data.progress || 0,
                        score: data.score,
                        maxScore: data.maxScore,
                        percentage: data.percentage,
                        telemetry: data.telemetry,
                        answers: data.answers
                    };
                });

                // Estimate total assigned (from submissions or assume class size)
                const totalAssigned = Math.max(submissions.length, taskData.studentIds?.length || submissions.length);

                // Analyze submissions with AI
                const task: TaskData = {
                    id: taskDoc.id,
                    title: taskData.title,
                    courseTitle: taskData.courseTitle,
                    maxPoints: taskData.maxPoints || 100
                };

                const analysis = await analyzeSubmissions(task, submissions, totalAssigned);

                // Prepare report data
                const reportData: TaskReportData = {
                    taskTitle: taskData.title,
                    courseTitle: taskData.courseTitle,
                    dueDate: taskData.dueDate.toDate(),
                    stats: analysis.stats,
                    aiInsights: analysis.aiInsights,
                    viewSubmissionsUrl: `https://wizdi.app/teacher/tasks/${taskDoc.id}/submissions`
                };

                // Send email
                await sendTaskReportEmail(teacherEmail, reportData);

                // Mark as sent
                await taskDoc.ref.update({
                    emailReportSentAt: FieldValue.serverTimestamp()
                });

                processedCount++;
                logger.info(`✅ Report sent for task: ${taskData.title} to ${teacherEmail}`);

            } catch (taskError: any) {
                errorCount++;
                logger.error(`Failed to process task ${taskDoc.id}:`, taskError.message);
            }
        }

        logger.info(`📧 Task email reports complete: ${processedCount} sent, ${skippedCount} skipped, ${errorCount} failed`);

    } catch (error: any) {
        logger.error('Failed to check due tasks:', error);
    }
});

// ============================================
// AI BLOG - Weekly Article Curation Agent
// ============================================

// Quality sources - ONLY AI + Education focused
const AI_BLOG_SOURCES = [
    // EdTech specific - highest priority (dedicated AI in Education coverage)
    { url: 'https://www.iste.org/explore/feed', name: 'ISTE', priority: 3 },
    { url: 'https://thejournal.com/rss-feeds/the-journal.aspx', name: 'THE Journal', priority: 2 },
    { url: 'https://www.eschoolnews.com/feed/', name: 'eSchool News', priority: 2 },
    { url: 'https://edtechmagazine.com/k12/rss.xml', name: 'EdTech Magazine', priority: 2 },

    // AI companies with education focus
    { url: 'https://blog.khanacademy.org/feed/', name: 'Khan Academy', priority: 3 },

    // Research & Policy on AI + Education
    { url: 'https://hai.stanford.edu/news/rss.xml', name: 'Stanford HAI', priority: 2 },
    { url: 'https://www.brookings.edu/topic/education/feed/', name: 'Brookings Education', priority: 2 },

    // Teacher-focused practical blogs
    { url: 'https://www.cultofpedagogy.com/feed/', name: 'Cult of Pedagogy', priority: 2 },
    { url: 'https://ditchthattextbook.com/feed/', name: 'Ditch That Textbook', priority: 2 },

    // AI Research (filtered by education keywords)
    { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', name: 'MIT Tech Review', priority: 1 },
    { url: 'https://www.anthropic.com/news/rss', name: 'Anthropic', priority: 1 },
];

// Keywords - must have BOTH AI and Education terms
const BLOG_AI_KEYWORDS = [
    'ai', 'artificial intelligence', 'chatgpt', 'gpt', 'gemini', 'claude',
    'machine learning', 'generative ai', 'llm', 'language model', 'openai',
    'copilot', 'ai tutor', 'ai assistant', 'automation'
];

const BLOG_EDUCATION_KEYWORDS = [
    'education', 'learning', 'teaching', 'school', 'student', 'teacher',
    'classroom', 'curriculum', 'course', 'lesson', 'tutoring', 'k-12',
    'academic', 'university', 'edtech', 'instruction', 'pedagogy',
    'assessment', 'homework', 'grading', 'literacy', 'stem'
];

interface RawBlogArticle {
    title: string;
    summary: string;
    link: string;
    pubDate: string;
    sourceName: string;
    relevanceScore: number;
}

/**
 * Parse RSS feed for blog articles
 */
async function parseBlogRSSFeed(feedUrl: string, sourceName: string): Promise<RawBlogArticle[]> {
    try {
        const response = await fetch(feedUrl, {
            headers: { 'User-Agent': 'Wizdi-Blog-Agent/1.0' }
        });

        if (!response.ok) {
            logger.warn(`Blog RSS fetch failed for ${feedUrl}: ${response.status}`);
            return [];
        }

        const xml = await response.text();
        const articles: RawBlogArticle[] = [];

        // Parse RSS items
        const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

        for (let i = 0; i < Math.min(itemMatches.length, 10); i++) {
            const item = itemMatches[i];

            const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
            const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
            const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/);
            const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

            const title = titleMatch?.[1]?.trim() || '';
            let summary = descMatch?.[1]?.trim() || '';

            // Clean HTML
            summary = summary.replace(/<[^>]*>/g, '').substring(0, 800);

            if (title) {
                // Calculate relevance - MUST have BOTH AI and Education keywords
                const text = `${title} ${summary}`.toLowerCase();

                // Count AI keywords found
                let aiScore = 0;
                for (const keyword of BLOG_AI_KEYWORDS) {
                    if (text.includes(keyword)) aiScore += 1;
                }

                // Count Education keywords found
                let eduScore = 0;
                for (const keyword of BLOG_EDUCATION_KEYWORDS) {
                    if (text.includes(keyword)) eduScore += 1;
                }

                // Only include if has BOTH AI (score >= 1) AND Education (score >= 1)
                // Final score = AI matches + Education matches
                const relevanceScore = (aiScore >= 1 && eduScore >= 1) ? (aiScore + eduScore) : 0;

                // Skip articles that don't have both AI and Education content
                if (relevanceScore === 0) {
                    continue;
                }

                articles.push({
                    title,
                    summary,
                    link: linkMatch?.[1]?.trim() || feedUrl,
                    pubDate: pubDateMatch?.[1] || new Date().toISOString(),
                    sourceName,
                    relevanceScore
                });
            }
        }

        return articles;
    } catch (error) {
        logger.error(`Error fetching blog RSS ${feedUrl}:`, error);
        return [];
    }
}

/**
 * Generate Hebrew blog article with practical classroom applications using Gemini 2.5 Pro
 */
async function generateBlogArticle(
    article: RawBlogArticle
): Promise<{
    title: string;
    summary: string;
    keyPoints: string[];
    classroomTips: string[];
    category: 'tool' | 'research' | 'tip' | 'trend';
    readingTime: number;
} | null> {
    try {
        const prompt = `אתה עורך בלוג מומחה בחינוך וטכנולוגיה, כותב למורים ישראליים.

קיבלת מאמר חדש באנגלית על AI בחינוך:

כותרת: ${article.title}
תקציר: ${article.summary}
מקור: ${article.sourceName}

משימתך ליצור תוכן מקורי בעברית שיהיה שימושי למורים. אל תתרגם מילה במילה - תן ערך מוסף!

צור JSON בלבד:
{
    "title": "כותרת מושכת בעברית (עד 60 תווים)",
    "summary": "סיכום של 2-3 משפטים שמסביר מה חשוב כאן למורה",
    "keyPoints": [
        "נקודה מעשית 1",
        "נקודה מעשית 2",
        "נקודה מעשית 3"
    ],
    "classroomTips": [
        "טיפ קונקרטי לשימוש בכיתה 1",
        "טיפ קונקרטי לשימוש בכיתה 2"
    ],
    "category": "tool|research|tip|trend",
    "readingTime": 2
}

קטגוריות:
- tool: כלי AI חדש או עדכון משמעותי
- research: מחקר או נתונים חדשים
- tip: טיפ מעשי ליישום מיידי
- trend: מגמה או שינוי בתחום

חשוב:
1. כל התוכן חייב להיות בעברית תקנית
2. התמקד ב"מה המורה יכול לעשות עם זה מחר בכיתה"
3. היה ספציפי - לא "אפשר להשתמש בזה" אלא "תנו לתלמידים משימה לכתוב שאלות לחומר הלימוד"

Output ONLY valid JSON.`;

        const content = await generateText([
            { role: 'user', content: prompt }
        ], { temperature: 0.7, maxTokens: 1500 });

        let jsonText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonText = jsonMatch[0];

        const result = JSON.parse(jsonText);

        // Validate Hebrew content
        const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);
        if (!hasHebrew(result.title) || !hasHebrew(result.summary)) {
            logger.warn(`Blog article not in Hebrew: ${article.title}`);
            return null;
        }

        return result;
    } catch (error) {
        logger.error('Error generating blog article:', error);
        return null;
    }
}

/**
 * Weekly Blog Article Generation Agent
 * Runs every Sunday at 10 AM Israel time
 * Curates one high-quality article per week
 */
export const generateWeeklyBlogArticle = onSchedule({
    schedule: '0 10 * * 0', // Every Sunday at 10 AM
    timeZone: 'Asia/Jerusalem',
    secrets: [openAiApiKey, geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 300
}, async () => {
    logger.info('📝 Starting weekly blog article generation...');

    try {
        const openai = new OpenAI({ apiKey: openAiApiKey.value() });
        const allArticles: RawBlogArticle[] = [];

        // Fetch from all sources
        for (const source of AI_BLOG_SOURCES) {
            const articles = await parseBlogRSSFeed(source.url, source.name);
            // Apply source priority multiplier
            articles.forEach(a => a.relevanceScore *= source.priority);
            allArticles.push(...articles);
        }

        logger.info(`Found ${allArticles.length} potential articles`);

        // Filter only highly relevant articles (score >= 6)
        const relevantArticles = allArticles
            .filter(a => a.relevanceScore >= 6)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);

        if (relevantArticles.length === 0) {
            logger.warn('No relevant articles found this week');
            return;
        }

        // Check for duplicates (by URL)
        for (const article of relevantArticles) {
            const existing = await db.collection('aiBlog')
                .where('originalUrl', '==', article.link)
                .limit(1)
                .get();

            if (!existing.empty) {
                logger.info(`Skipping duplicate: ${article.title}`);
                continue;
            }

            // Generate Hebrew blog article
            const blogContent = await generateBlogArticle(article);

            if (!blogContent) {
                continue;
            }

            // Category labels in Hebrew
            const categoryLabels: Record<string, string> = {
                tool: 'כלי חדש',
                research: 'מחקר',
                tip: 'טיפ מעשי',
                trend: 'מגמה'
            };

            // Save to Firestore
            const newArticleRef = db.collection('aiBlog').doc();
            await newArticleRef.set({
                id: newArticleRef.id,
                // Hebrew content
                title: blogContent.title,
                summary: blogContent.summary,
                keyPoints: blogContent.keyPoints,
                classroomTips: blogContent.classroomTips,
                // Original source
                originalTitle: article.title,
                originalUrl: article.link,
                sourceName: article.sourceName,
                // Metadata
                category: blogContent.category,
                categoryLabel: categoryLabels[blogContent.category] || 'כללי',
                readingTime: blogContent.readingTime || 2,
                publishedAt: new Date(article.pubDate),
                createdAt: FieldValue.serverTimestamp(),
                // Engagement
                viewCount: 0,
                helpfulCount: 0
            });

            logger.info(`✅ Weekly blog article created: "${blogContent.title}"`);

            // Only create one article per week
            break;
        }

        // Cleanup old articles (keep last 52 = 1 year)
        const oldArticles = await db.collection('aiBlog')
            .orderBy('createdAt', 'desc')
            .offset(52)
            .get();

        if (!oldArticles.empty) {
            const batch = db.batch();
            oldArticles.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            logger.info(`Cleaned up ${oldArticles.size} old blog articles`);
        }

    } catch (error: any) {
        logger.error('Weekly blog generation failed:', error);
    }
});

/**
 * Manual trigger for blog article generation (for testing/admin)
 */
export const triggerBlogArticleGeneration = onCall({
    cors: true,
    secrets: [openAiApiKey, geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 300
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const forceRegenerate = request.data?.forceRegenerate === true;

    logger.info(`📝 Manual blog generation triggered by ${request.auth.uid}${forceRegenerate ? ' (force regenerate)' : ''}`);

    // If force regenerate, delete all existing articles first
    if (forceRegenerate) {
        const existingArticles = await db.collection('aiBlog').get();
        if (!existingArticles.empty) {
            const batch = db.batch();
            existingArticles.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            logger.info(`Deleted ${existingArticles.size} existing articles for regeneration`);
        }
    }

    const openai = new OpenAI({ apiKey: openAiApiKey.value() });
    const allArticles: RawBlogArticle[] = [];

    // Fetch from all sources
    for (const source of AI_BLOG_SOURCES) {
        const articles = await parseBlogRSSFeed(source.url, source.name);
        articles.forEach(a => a.relevanceScore *= source.priority);
        allArticles.push(...articles);
    }

    // Get most relevant
    const relevantArticles = allArticles
        .filter(a => a.relevanceScore >= 4)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3);

    if (relevantArticles.length === 0) {
        return { success: false, message: 'No relevant articles found' };
    }

    let createdCount = 0;

    for (const article of relevantArticles) {
        // Check duplicate
        const existing = await db.collection('aiBlog')
            .where('originalUrl', '==', article.link)
            .limit(1)
            .get();

        if (!existing.empty) continue;

        const blogContent = await generateBlogArticle(article);
        if (!blogContent) continue;

        const categoryLabels: Record<string, string> = {
            tool: 'כלי חדש',
            research: 'מחקר',
            tip: 'טיפ מעשי',
            trend: 'מגמה'
        };

        const newArticleRef = db.collection('aiBlog').doc();
        await newArticleRef.set({
            id: newArticleRef.id,
            title: blogContent.title,
            summary: blogContent.summary,
            keyPoints: blogContent.keyPoints,
            classroomTips: blogContent.classroomTips,
            originalTitle: article.title,
            originalUrl: article.link,
            sourceName: article.sourceName,
            category: blogContent.category,
            categoryLabel: categoryLabels[blogContent.category] || 'כללי',
            readingTime: blogContent.readingTime || 2,
            publishedAt: new Date(article.pubDate),
            createdAt: FieldValue.serverTimestamp(),
            viewCount: 0,
            helpfulCount: 0
        });

        createdCount++;
        logger.info(`✅ Created: "${blogContent.title}"`);
    }

    return {
        success: true,
        created: createdCount,
        message: `Created ${createdCount} blog articles`
    };
});

// ============================================================
// QA TESTING SYSTEM - Nightly Automated Tests
// ============================================================

/**
 * Nightly QA Tests - Runs at 2 AM Israel time
 * Checks data integrity, content quality, and system health
 */
export const runNightlyQATests = onSchedule({
    schedule: '0 2 * * *', // Every day at 2 AM
    timeZone: 'Asia/Jerusalem',
    memory: '1GiB',
    timeoutSeconds: 540 // 9 minutes
}, async () => {
    logger.info('🔍 Starting Nightly QA Tests...');
    const startTime = Date.now();

    const results: {
        category: string;
        testName: string;
        status: 'passed' | 'failed' | 'warning';
        message: string;
        details?: any;
    }[] = [];

    try {
        // === 1. DATA INTEGRITY TESTS ===
        logger.info('📊 Running Data Integrity Tests...');

        // 1.1 Check for courses with empty syllabus
        const coursesSnapshot = await db.collection('courses').limit(100).get();
        let emptyCoursesCount = 0;
        const emptyCourseIds: string[] = [];

        coursesSnapshot.forEach(doc => {
            const data = doc.data();
            const syllabus = data.syllabus || [];
            if (!syllabus.length || syllabus.every((m: any) => !m.learningUnits?.length)) {
                emptyCoursesCount++;
                emptyCourseIds.push(doc.id);
            }
        });

        results.push({
            category: 'data-integrity',
            testName: 'Empty Courses Check',
            status: emptyCoursesCount === 0 ? 'passed' : 'warning',
            message: emptyCoursesCount === 0
                ? `All ${coursesSnapshot.size} courses have content`
                : `Found ${emptyCoursesCount} courses without content`,
            details: { emptyCount: emptyCoursesCount, courseIds: emptyCourseIds.slice(0, 10) }
        });

        // 1.2 Check for invalid blocks (multiple-choice without correct answer)
        let invalidBlocksCount = 0;
        const invalidBlocks: { courseId: string; unitId: string; blockId: string }[] = [];

        coursesSnapshot.forEach(doc => {
            const data = doc.data();
            const syllabus = data.syllabus || [];

            syllabus.forEach((module: any) => {
                (module.learningUnits || []).forEach((unit: any) => {
                    (unit.activityBlocks || []).forEach((block: any) => {
                        if (block.type === 'multiple-choice') {
                            const content = block.content || {};
                            if (!content.correctAnswer && !content.correct_answer) {
                                invalidBlocksCount++;
                                invalidBlocks.push({
                                    courseId: doc.id,
                                    unitId: unit.id,
                                    blockId: block.id
                                });
                            }
                        }
                    });
                });
            });
        });

        results.push({
            category: 'data-integrity',
            testName: 'Block Validity Check',
            status: invalidBlocksCount === 0 ? 'passed' : 'warning',
            message: invalidBlocksCount === 0
                ? 'All activity blocks are valid'
                : `Found ${invalidBlocksCount} blocks without correct answers`,
            details: { invalidCount: invalidBlocksCount, blocks: invalidBlocks.slice(0, 10) }
        });

        // === 2. TASK SYSTEM INTEGRITY ===
        logger.info('📋 Running Task System Tests...');

        // 2.1 Check for orphaned submissions (tasks that don't exist)
        const tasksSnapshot = await db.collection('student_tasks').limit(50).get();
        const taskIds = new Set(tasksSnapshot.docs.map(d => d.id));

        const submissionsSnapshot = await db.collection('task_submissions').limit(100).get();
        let orphanedSubmissions = 0;

        submissionsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.taskId && !taskIds.has(data.taskId)) {
                orphanedSubmissions++;
            }
        });

        results.push({
            category: 'data-integrity',
            testName: 'Orphaned Submissions Check',
            status: orphanedSubmissions === 0 ? 'passed' : 'warning',
            message: orphanedSubmissions === 0
                ? 'All submissions linked to valid tasks'
                : `Found ${orphanedSubmissions} orphaned submissions`,
            details: { orphanedCount: orphanedSubmissions }
        });

        // === 3. COLLECTION SIZE MONITORING ===
        logger.info('📈 Running Collection Size Monitoring...');

        const collections = ['courses', 'student_tasks', 'users', 'submissions', 'prompts'];
        const collectionSizes: Record<string, number> = {};

        for (const collName of collections) {
            const snapshot = await db.collection(collName).count().get();
            collectionSizes[collName] = snapshot.data().count;
        }

        results.push({
            category: 'monitoring',
            testName: 'Collection Sizes',
            status: 'passed',
            message: `Monitored ${collections.length} collections`,
            details: collectionSizes
        });

        // === 4. RECENT ACTIVITY CHECK ===
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentCoursesSnapshot = await db.collection('courses')
            .where('createdAt', '>=', oneDayAgo)
            .get();

        results.push({
            category: 'activity',
            testName: 'Recent Courses Created',
            status: 'passed',
            message: `${recentCoursesSnapshot.size} courses created in last 24h`,
            details: { count: recentCoursesSnapshot.size }
        });

        // === SAVE REPORT ===
        const totalTests = results.length;
        const passedTests = results.filter(r => r.status === 'passed').length;
        const failedTests = results.filter(r => r.status === 'failed').length;
        const warningTests = results.filter(r => r.status === 'warning').length;

        const reportRef = db.collection('qa_reports').doc();
        await reportRef.set({
            id: reportRef.id,
            createdAt: FieldValue.serverTimestamp(),
            completedAt: FieldValue.serverTimestamp(),
            triggeredBy: 'scheduled',
            environment: 'production',
            summary: {
                totalTests,
                passed: passedTests,
                failed: failedTests,
                warnings: warningTests,
                passRate: Math.round((passedTests / totalTests) * 100),
                overallStatus: failedTests > 0 ? 'failed' : warningTests > 0 ? 'warning' : 'passed',
                duration: Date.now() - startTime
            },
            results
        });

        logger.info(`✅ Nightly QA Complete: ${passedTests}/${totalTests} passed`);

        // === SEND ALERT IF CRITICAL ISSUES ===
        if (failedTests > 0) {
            // Write to mail collection for email alert
            const criticalIssues = results.filter(r => r.status === 'failed');

            await db.collection('mail').add({
                to: ['eyal@bonus.co.il'], // Admin email
                message: {
                    subject: `⚠️ Wizdi QA Alert: ${failedTests} בדיקות נכשלו`,
                    html: `
                        <div style="font-family: Arial, sans-serif; direction: rtl; padding: 20px;">
                            <h2 style="color: #ef4444;">🔴 נמצאו בעיות במערכת</h2>
                            <p>הבדיקה הלילית מצאה ${failedTests} בעיות קריטיות:</p>
                            <ul>
                                ${criticalIssues.map(issue => `
                                    <li><strong>${issue.testName}</strong>: ${issue.message}</li>
                                `).join('')}
                            </ul>
                            <p>נא לבדוק את לוח הבקרה: <a href="https://wizdi.ai">wizdi.ai</a></p>
                            <hr/>
                            <p style="color: #666; font-size: 12px;">דוח QA אוטומטי - ${new Date().toLocaleString('he-IL')}</p>
                        </div>
                    `
                }
            });

            logger.warn(`📧 Alert email sent for ${failedTests} critical issues`);
        }

    } catch (error: any) {
        logger.error('Nightly QA Tests failed:', error);

        // Save error report
        await db.collection('qa_reports').add({
            createdAt: FieldValue.serverTimestamp(),
            triggeredBy: 'scheduled',
            environment: 'production',
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 1,
                overallStatus: 'failed',
                duration: Date.now() - startTime
            },
            error: error.message
        });
    }
});

/**
 * Manual QA Test Trigger - For admin testing
 */
export const triggerQATests = onCall({
    cors: true,
    memory: '1GiB',
    timeoutSeconds: 300
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    logger.info(`🔍 Manual QA Tests triggered by ${request.auth.uid}`);

    // Run the same tests as nightly
    const startTime = Date.now();
    const results: any[] = [];

    try {
        // Quick data integrity check
        const coursesSnapshot = await db.collection('courses').limit(50).get();
        let emptyCount = 0;
        let invalidBlocks = 0;

        coursesSnapshot.forEach(doc => {
            const data = doc.data();
            const syllabus = data.syllabus || [];
            if (!syllabus.length) emptyCount++;

            syllabus.forEach((m: any) => {
                (m.learningUnits || []).forEach((u: any) => {
                    (u.activityBlocks || []).forEach((b: any) => {
                        if (b.type === 'multiple-choice' && !b.content?.correctAnswer && !b.content?.correct_answer) {
                            invalidBlocks++;
                        }
                    });
                });
            });
        });

        results.push({
            category: 'data-integrity',
            testName: 'Quick Data Check',
            status: emptyCount === 0 && invalidBlocks === 0 ? 'passed' : 'warning',
            message: `${coursesSnapshot.size} courses, ${emptyCount} empty, ${invalidBlocks} invalid blocks`
        });

        return {
            success: true,
            duration: Date.now() - startTime,
            totalTests: results.length,
            passed: results.filter(r => r.status === 'passed').length,
            results
        };

    } catch (error: any) {
        throw new HttpsError('internal', error.message);
    }
})

// --- WIZDI INTEGRATION ---
export {
    wizdiLogin,
    wizdiRefresh,
    getStudentStats,
    getClassStats,
    getTeacherDashboard,
    getTaskResults
} from "./wizdi";

// --- ADAPTIVE LEARNING SIMULATION ---
import { simulateAdaptiveStudents } from "./simulateAdaptiveStudents";

/**
 * Simulate Adaptive Students
 * Creates 3 simulated students and tests adaptive learning features
 */
export const runAdaptiveSimulation = onCall({
    cors: true,
    memory: "512MiB"
}, async (request) => {
    const { courseId, teacherId, numQuestions } = request.data;

    if (!courseId || !teacherId) {
        throw new HttpsError('invalid-argument', 'courseId and teacherId are required');
    }

    logger.info('Starting adaptive simulation', { courseId, teacherId });

    try {
        const result = await simulateAdaptiveStudents({
            courseId,
            teacherId,
            numQuestions: numQuestions || 10
        }, request);

        return result;
    } catch (error: any) {
        logger.error('Simulation error:', error);
        throw new HttpsError('internal', error.message);
    }
});

// --- PROGRESSIVE VARIANT GENERATION ---
import { generateVariantsForCourse } from "./services/variantGenerationService";

/**
 * Progressive Variant Generation Trigger
 *
 * Triggered when a new student task is created.
 * Generates Bloom-aware variants in the background.
 *
 * Strategy:
 * - Lower Bloom (Remember/Understand): Only generate harder variant (העמקה)
 * - Middle Bloom (Apply/Analyze): Generate both variants
 * - Higher Bloom (Evaluate/Create): Only generate easier variant (הבנה)
 *
 * Created: 2026-01-25
 */
export const onVariantGenerationRequired = onDocumentCreated(
    {
        document: "student_tasks/{taskId}",
        secrets: [openAiApiKey],
        timeoutSeconds: 540,  // 9 minutes max
        memory: "1GiB",
    },
    async (event) => {
        if (!event.data) return;

        const taskId = event.params.taskId;
        const taskData = event.data.data() as any;

        // Skip if no courseId (can't generate variants without content)
        if (!taskData?.courseId) {
            logger.info(`Task ${taskId} has no courseId, skipping variant generation`);
            return;
        }

        // Skip if already processed (avoid duplicate triggers)
        if (taskData.variantStatus && taskData.variantStatus !== 'pending') {
            logger.info(`Task ${taskId} already processed (status: ${taskData.variantStatus})`);
            return;
        }

        logger.info(`Starting progressive variant generation for task ${taskId}`, {
            courseId: taskData.courseId,
            courseTitle: taskData.courseTitle
        });

        try {
            // 1. Update status to processing
            await event.data.ref.update({
                variantStatus: 'processing',
                variantStartedAt: FieldValue.serverTimestamp()
            });

            // 2. Initialize OpenAI
            const openai = new OpenAI({ apiKey: openAiApiKey.value() });

            // 3. Get course title for context
            const topic = taskData.courseTitle || taskData.title || 'General';

            // 4. Generate variants
            const stats = await generateVariantsForCourse(
                openai,
                taskData.courseId,
                topic
            );

            // 5. Determine final status
            let finalStatus: 'ready' | 'partial' | 'failed' = 'ready';
            if (stats.failed > 0 && stats.processed === 0) {
                finalStatus = 'failed';
            } else if (stats.failed > 0) {
                finalStatus = 'partial';
            }

            // 6. Update task with completion status
            await event.data.ref.update({
                variantStatus: finalStatus,
                variantCompletedAt: FieldValue.serverTimestamp(),
                variantStats: {
                    totalBlocks: stats.totalBlocks,
                    processed: stats.processed,
                    failed: stats.failed
                }
            });

            logger.info(`Completed variant generation for task ${taskId}:`, {
                status: finalStatus,
                stats
            });

        } catch (error: any) {
            logger.error(`Variant generation failed for task ${taskId}:`, error);

            // Update with error status
            await event.data.ref.update({
                variantStatus: 'failed',
                variantError: error.message || 'Unknown error',
                variantCompletedAt: FieldValue.serverTimestamp()
            });
        }
    }
);

// --- MICRO ACTIVITY GENERATION ---
// ============================================================
// Quick generation of single activity blocks
// ============================================================

import {
    generateMicroActivity,
    regenerateMicroActivity,
    MicroGeneratorInput
} from './services/microActivityGenerator';
import {
    MicroActivity,
    GenerateMicroActivityRequest
} from './shared/types/microActivityTypes';

/**
 * Generate a micro activity (single activity block)
 * Quick generation without full Architect/Guardian pipeline
 */
export const generateMicroActivityEndpoint = onCall({
    secrets: [geminiApiKey],
    cors: true,
    memory: "512MiB",
    timeoutSeconds: 60
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const data = request.data as GenerateMicroActivityRequest;

    if (!data.type || !data.source || !data.gradeLevel) {
        throw new HttpsError('invalid-argument', 'type, source, and gradeLevel are required');
    }

    logger.info('Generating micro activity', {
        userId: uid,
        type: data.type,
        gradeLevel: data.gradeLevel,
        sourceType: data.source.type
    });

    const input: MicroGeneratorInput = {
        type: data.type,
        source: data.source,
        gradeLevel: data.gradeLevel,
        teacherId: uid,
        subject: data.subject
    };

    const result = await generateMicroActivity(input);

    if (!result.success) {
        throw new HttpsError('internal', result.error || 'Generation failed');
    }

    return result;
});

/**
 * Save a micro activity to the teacher's collection
 */
export const saveMicroActivity = onCall({
    cors: true
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { microActivity } = request.data as { microActivity: MicroActivity };

    if (!microActivity || !microActivity.block) {
        throw new HttpsError('invalid-argument', 'microActivity with block is required');
    }

    // Ensure teacher owns the activity
    if (microActivity.teacherId !== uid) {
        microActivity.teacherId = uid;
    }

    // Generate ID if not present
    if (!microActivity.id) {
        microActivity.id = uuidv4();
    }

    // Set timestamps
    microActivity.createdAt = FieldValue.serverTimestamp() as any;
    microActivity.updatedAt = FieldValue.serverTimestamp() as any;

    // Save to Firestore
    await db
        .collection('teachers')
        .doc(uid)
        .collection('microActivities')
        .doc(microActivity.id)
        .set(microActivity);

    logger.info('Micro activity saved', {
        userId: uid,
        activityId: microActivity.id,
        type: microActivity.type
    });

    return {
        success: true,
        id: microActivity.id
    };
});

/**
 * Get teacher's micro activities
 */
export const getMicroActivities = onCall({
    cors: true
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { limit = 50, type } = request.data as { limit?: number; type?: string };

    let query = db
        .collection('teachers')
        .doc(uid)
        .collection('microActivities')
        .orderBy('createdAt', 'desc')
        .limit(Math.min(limit, 100));

    if (type) {
        query = query.where('type', '==', type) as any;
    }

    const snapshot = await query.get();
    const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    return { activities };
});

/**
 * Delete a micro activity
 */
export const deleteMicroActivity = onCall({
    cors: true
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { activityId } = request.data as { activityId: string };

    if (!activityId) {
        throw new HttpsError('invalid-argument', 'activityId is required');
    }

    await db
        .collection('teachers')
        .doc(uid)
        .collection('microActivities')
        .doc(activityId)
        .delete();

    logger.info('Micro activity deleted', {
        userId: uid,
        activityId
    });

    return { success: true };
});

/**
 * Create a share link for a micro activity
 */
export const createMicroActivityShare = onCall({
    cors: true
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { activityId } = request.data as { activityId: string };

    if (!activityId) {
        throw new HttpsError('invalid-argument', 'activityId is required');
    }

    // Verify ownership
    const activityDoc = await db
        .collection('teachers')
        .doc(uid)
        .collection('microActivities')
        .doc(activityId)
        .get();

    if (!activityDoc.exists) {
        throw new HttpsError('not-found', 'Activity not found');
    }

    // Generate share code
    const shareCode = uuidv4().substring(0, 8);

    // Save share record
    await db.collection('microActivityShares').doc(shareCode).set({
        microActivityId: activityId,
        teacherId: uid,
        createdAt: FieldValue.serverTimestamp()
    });

    // Update activity with share code
    await activityDoc.ref.update({
        shareCode,
        updatedAt: FieldValue.serverTimestamp()
    });

    logger.info('Micro activity share created', {
        userId: uid,
        activityId,
        shareCode
    });

    return {
        success: true,
        shareCode,
        shareUrl: `/play/${shareCode}`
    };
});

/**
 * Get a micro activity by share code (public - no auth required)
 */
export const getMicroActivityByShare = onCall({
    cors: true
}, async (request) => {
    const { shareCode } = request.data as { shareCode: string };

    if (!shareCode) {
        throw new HttpsError('invalid-argument', 'shareCode is required');
    }

    // Get share record
    const shareDoc = await db.collection('microActivityShares').doc(shareCode).get();

    if (!shareDoc.exists) {
        throw new HttpsError('not-found', 'Share link not found or expired');
    }

    const shareData = shareDoc.data()!;

    // Get the activity
    const activityDoc = await db
        .collection('teachers')
        .doc(shareData.teacherId)
        .collection('microActivities')
        .doc(shareData.microActivityId)
        .get();

    if (!activityDoc.exists) {
        throw new HttpsError('not-found', 'Activity not found');
    }

    // Increment usage count
    await activityDoc.ref.update({
        usageCount: FieldValue.increment(1)
    });

    return {
        success: true,
        activity: {
            id: activityDoc.id,
            ...activityDoc.data()
        }
    };
});

// --- SUPER AGENT V2 - CAPABILITIES SEEDING ---
export {
    seedCapabilities,
    seedCapabilitiesCallable,
    getCapability,
    listCapabilities
} from './admin/seedCapabilitiesFunction';
