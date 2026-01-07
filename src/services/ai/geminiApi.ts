
import { callAI } from "../ProxyService";
import { withDeduplication, generateRequestKey } from "../../utils/requestDeduplication";
import {
    getValidationPrompt,
    getTutorPrompt,
    getRefinementPrompt,
    getCategorizationPrompt,
    getOrderingPrompt,
    getFillInBlanksPrompt,
    getMemoryGamePrompt,
    getStudentAnalysisPrompt,
    getClassAnalysisPrompt,
    getSingleMCQPrompt,
    getSingleOpenQuestionPrompt,
    getStudentReportPrompt,
    getAutoFixPrompt,
    getGradingPrompt,
    BOT_PERSONAS
} from "./prompts";
import type { UnitSkeleton, StepContentResponse, DialogueScript } from "../../shared/types/gemini.types";
import { v4 as uuidv4 } from 'uuid';
import type { ValidationResult } from "../../shared/types/courseTypes";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";

export const MODEL_NAME = "gpt-4o-mini";

// Internal OpenAI Client Wrapper ensuring Proxy usage
export const openai = {
    chat: {
        completions: {
            create: async (params: any) => {
                // Determine endpoint based on what we are doing? 
                // Using standard chat completions endpoint
                return await callAI("/chat/completions", params);
            }
        }
    },
    images: {
        generate: async (params: any) => {
            // START EXPERIMENTAL PROXY SUPPORT FOR IMAGES
            // Requires Backend Proxy Update if simple forwarding isn't enough. 
            // Assuming Backend Proxy forwards path /v1/images/generations
            return await callAI("/images/generations", params);
        }
    }
};

const openaiClient = openai; // Alias for internal use

// --- API FUNCTIONS ---

export const generateUnitSkeleton = async (
    topic: string,
    gradeLevel: string,
    activityLength: 'short' | 'medium' | 'long',
    sourceText?: string,
    mode: 'learning' | 'exam' = 'learning',
    bloomPreferences?: Record<string, number>,
    productType: 'lesson' | 'game' | 'exam' = 'lesson',
    studentProfile?: any
): Promise<UnitSkeleton | null> => {
    // VAULT MIGRATION: Logic moved to Backend (Fixed Split Brain)

    // Generate deduplication key (skip if custom sourceText or bloomPreferences)
    const shouldDeduplicate = !sourceText && !bloomPreferences && !studentProfile;
    const requestKey = shouldDeduplicate
        ? generateRequestKey('generateUnitSkeleton', { topic, gradeLevel, activityLength, mode, productType })
        : null;

    const executeFn = async () => {
        try {
            // Mapped to 'generateStudentUnitSkeleton' to ensure it generates a Interactive Unit
            const generateStudentUnitFn = httpsCallable(functions, 'generateStudentUnitSkeleton');
            const response = await generateStudentUnitFn({
                topic,
                gradeLevel,
                activityLength,
                sourceText,
                mode,
                productType,
                bloomPreferences, // Optional
                studentProfile    // Optional
            });

            const result = response.data as any; // Cast as needed

            // Ensure structure matches expectation (Frontend expects JSON with 'steps')
            if (result && result.steps) {
                return result as UnitSkeleton;
            }
            return null;

        } catch (error) {
            console.error("Vault Error (Backend Student Generation Failed):", error);
            return null;
        }
    };

    // Use deduplication if applicable
    if (requestKey) {
        return withDeduplication(requestKey, executeFn, { ttl: 5000 });
    }

    return executeFn();
};

export const generateTeacherLessonPlan = async (
    topic: string,
    gradeLevel: string,
    activityLength: 'short' | 'medium' | 'long',
    sourceText?: string,
    mode: 'learning' | 'exam' = 'learning',
    productType: 'lesson' | 'game' | 'exam' = 'lesson'
): Promise<any | null> => {
    // New Teacher Flow
    try {
        const generateTeacherLessonPlanFn = httpsCallable(functions, 'generateTeacherLessonPlan');
        const response = await generateTeacherLessonPlanFn({
            topic,
            gradeLevel,
            activityLength,
            sourceText,
            mode,
            productType
        });
        return response.data;
    } catch (error) {
        console.error("Vault Error (Backend Teacher Plan Failed):", error);
        return null;
    }
};

export const generateStepContent = async (
    topic: string,
    stepInfo: any,
    gradeLevel: string,
    sourceText?: string,
    fileData?: any,
    mode: 'learning' | 'exam' = 'learning'
): Promise<StepContentResponse | null> => {
    // VAULT MIGRATION: Logic moved to Backend
    try {
        const generateStepContentFn = httpsCallable(functions, 'generateStepContent');
        const response = await generateStepContentFn({
            topic,
            stepInfo,
            gradeLevel,
            sourceText,
            fileData,
            mode
        });

        const result = response.data as any;
        return result as StepContentResponse;
    } catch (e) {
        console.error("Vault Step Error:", e);
        return null;
    }
};

export const generatePodcastScript = async (sourceText: string, topic?: string): Promise<DialogueScript | null> => {
    // VAULT MIGRATION: Logic moved to Backend
    try {
        const generatePodcastScriptFn = httpsCallable(functions, 'generatePodcastScript');
        const response = await generatePodcastScriptFn({
            sourceText,
            topic
        });

        return response.data as DialogueScript;
    } catch (e) {
        console.error("Vault Podcast Error:", e);
        return null;
    }
};

export const validateContent = async (lessonJson: any, targetAudience: string): Promise<ValidationResult> => {
    const prompt = getValidationPrompt(targetAudience, lessonJson);
    try {
        const completion = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1
        });
        return JSON.parse(completion.choices[0].message.content || "{}");
    } catch (e) {
        return { status: 'REJECT' } as any;
    }
};

export const checkOpenQuestionAnswer = async (
    question: string, userAnswer: string, modelAnswer: string, sourceText: string, mode: 'learning' | 'exam' = 'learning'
) => {
    const prompt = getTutorPrompt(mode, sourceText, question, modelAnswer, userAnswer);
    try {
        const completion = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        const res = JSON.parse(completion.choices[0].message.content || "{}");
        return { status: res.status || "partial", feedback: res.feedback_to_student || "Thank you." };
    } catch (e) {
        return { status: "partial", feedback: "Error checking answer." };
    }
};

export const refineContentWithPedagogy = async (content: string, instruction: string) => {
    const prompt = getRefinementPrompt(content, instruction);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }]
        });
        return res.choices[0].message.content || content;
    } catch (e) { return content; }
};


export const generateAiImage = async (
    prompt: string,
    preferredProvider: 'dall-e' | 'imagen' | 'gemini3' | 'auto' = 'auto'
): Promise<Blob | null> => {
    // Dynamic import of Imagen service
    const { isImagenAvailable, generateImagenImage } = await import('./imagenService');

    // Auto-select provider based on availability and cost
    let provider: 'dall-e' | 'imagen' | 'gemini3' = 'dall-e';
    if (preferredProvider === 'gemini3') {
        provider = 'gemini3';
    } else if (preferredProvider === 'imagen' || (preferredProvider === 'auto' && isImagenAvailable())) {
        provider = 'imagen';
    }

    // Try Gemini 3 Pro Image first if selected (NOT in auto mode - Preview only!)
    if (provider === 'gemini3') {
        console.log('🎨 Attempting Gemini 3 Pro Image generation (Preview)...');
        // Note: Gemini 3 is called separately via generateGemini3InfographicFromText
        // This is just a placeholder for future direct calls
        console.warn('⚠️ Gemini 3 should be called via specific infographic function');
    }

    // Try Imagen if selected/available
    if (provider === 'imagen') {
        console.log('🎨 Attempting Imagen 3 generation (cost-effective)...');
        const imagenResult = await generateImagenImage(prompt);
        if (imagenResult) {
            console.log('✅ Imagen 3 generation successful');
            return imagenResult;
        }
        console.warn('⚠️ Imagen 3 failed, falling back to DALL-E 3');
    }

    // DALL-E 3 (primary or fallback)
    try {
        console.log('🎨 Generating with DALL-E 3...');
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
        });

        const base64Data = response.data?.[0]?.b64_json;
        if (base64Data) {
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            console.log('✅ DALL-E 3 generation successful');
            return new Blob([byteArray], { type: "image/png" });
        }
        return null;
    } catch (e) {
        console.error("❌ DALL-E 3 generation failed:", e);
        return null;
    }
};

/**
 * Infographic visual types
 */
export type InfographicType = 'flowchart' | 'timeline' | 'comparison' | 'cycle';

/**
 * Generate infographic using Gemini 3 Pro Image (Preview)
 * Calls Cloud Function for server-side generation
 *
 * @param text - Educational content in Hebrew
 * @param visualType - Type of infographic
 * @param topic - Optional topic name
 * @returns Promise<Blob | null> - PNG image blob or null on failure
 */
export const generateGemini3InfographicFromText = async (
    text: string,
    visualType: InfographicType,
    topic?: string
): Promise<Blob | null> => {
    try {
        console.log('🎨 Calling Gemini Image Cloud Function (generateGeminiImage)...');
        const startTime = Date.now();

        // Build infographic-specific prompt
        const promptTemplates: Record<InfographicType, string> = {
            flowchart: `Create a clean educational flowchart infographic in Hebrew (RTL).
Style: Minimalist, clear arrows, colorful boxes.
${topic ? `Topic: ${topic}` : ''}
Content: ${text.substring(0, 1500)}
Requirements: Large Hebrew text, high contrast, numbered steps.`,

            timeline: `Create a horizontal timeline infographic in Hebrew (RTL).
Style: Modern, colorful milestone markers.
${topic ? `Topic: ${topic}` : ''}
Content: ${text.substring(0, 1500)}
Requirements: Clear timeline axis, readable Hebrew text, distinct markers.`,

            comparison: `Create a side-by-side comparison infographic in Hebrew (RTL).
Style: Clean, balanced layout, color-coded categories.
${topic ? `Topic: ${topic}` : ''}
Content: ${text.substring(0, 1500)}
Requirements: Visual separation, large Hebrew text, symmetrical layout.`,

            cycle: `Create a circular cycle diagram infographic in Hebrew (RTL).
Style: Circular flow with arrows, colorful segments.
${topic ? `Topic: ${topic}` : ''}
Content: ${text.substring(0, 1500)}
Requirements: Circular arrangement, directional arrows, clear Hebrew text.`
        };

        const prompt = promptTemplates[visualType];

        // Import and use the generateGeminiImage service (uses deployed generateGeminiImage Cloud Function)
        const { generateGeminiImage, isGeminiImageAvailable } = await import('./imagenService');

        if (!isGeminiImageAvailable()) {
            console.warn('⚠️ Gemini Image not enabled, skipping...');
            return null;
        }

        const blob = await generateGeminiImage(prompt, 'pro');

        if (blob) {
            const generationTime = Date.now() - startTime;
            console.log(`✅ Gemini Image generation successful (${generationTime}ms)`);
            return blob;
        }

        return null;

    } catch (error: any) {
        console.error('❌ Gemini Image generation failed:', error);
        return null;
    }
};

/**
 * Generates an educational infographic from text content using DALL-E 3
 * Optimized prompts for Hebrew educational content
 * Includes smart caching to prevent duplicate generation
 *
 * @param text - The educational content to visualize
 * @param visualType - Type of infographic (flowchart, timeline, comparison, cycle)
 * @param topic - Optional topic name for context
 * @param skipCache - Optional flag to bypass cache
 * @returns Promise<Blob | null> - PNG image blob or null on failure
 */
export const generateInfographicFromText = async (
    text: string,
    visualType: InfographicType,
    topic?: string,
    skipCache: boolean = false,
    preferredMethod: 'gemini3' | 'code-to-image' | 'dall-e' | 'auto' = 'gemini3'
): Promise<Blob | null> => {
    // Import cache utilities dynamically
    const { generateInfographicHash, getCachedInfographic, setCachedInfographic } = await import('../../utils/infographicCache');

    // Import analytics utilities
    const { trackGenerationStart, trackCacheHit, trackCacheMiss, trackGenerationComplete, trackGenerationFailed } =
        await import('../infographicAnalytics');

    // Truncate text if too long (DALL-E prompt limit ~4000 chars)
    const truncatedText = text.length > 2000 ? text.substring(0, 2000) + "..." : text;

    // Track generation start
    trackGenerationStart(visualType, text.length);

    // Check cache first (unless explicitly skipped)
    if (!skipCache) {
        const cacheHash = await generateInfographicHash(truncatedText, visualType);

        // 1. Check memory cache (fastest)
        const cachedDataUrl = getCachedInfographic(cacheHash);
        if (cachedDataUrl) {
            console.log(`🎯 Memory Cache HIT for ${visualType} infographic (hash: ${cacheHash.substring(0, 8)}...)`);

            // Track cache hit
            trackCacheHit(visualType, 'memory');

            // Convert data URL back to Blob
            const base64Data = cachedDataUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: "image/png" });
        }

        // 2. Check Firebase Storage (persistent)
        const { getFromFirebaseCache } = await import('../../utils/infographicCache');
        const firebaseUrl = await getFromFirebaseCache(cacheHash);
        if (firebaseUrl) {
            console.log(`☁️ Firebase Storage Cache HIT for ${visualType} infographic`);

            // Track cache hit
            trackCacheHit(visualType, 'firebase-storage');

            // Download and convert to Blob
            const response = await fetch(firebaseUrl);
            const blob = await response.blob();

            // Also save to memory cache for next time
            const reader = new FileReader();
            reader.onloadend = () => {
                setCachedInfographic(cacheHash, reader.result as string);
            };
            reader.readAsDataURL(blob);

            return blob;
        }

        console.log(`🔍 Cache MISS for ${visualType} infographic - generating new image...`);

        // Track cache miss
        trackCacheMiss(visualType);
    }

    // Type-specific prompt templates optimized for educational clarity
    const promptTemplates: Record<InfographicType, string> = {
        flowchart: `Create a clean educational flowchart infographic showing the process described below.
        Style: Minimalist, clear arrows, colorful boxes, suitable for classroom presentation.
        Include Hebrew text labels extracted from the content.
        Layout: Top-to-bottom or left-to-right flow with decision diamonds where applicable.
        ${topic ? `Topic: ${topic}` : ''}

        Content to visualize:
        ${truncatedText}

        Requirements:
        - Clear, large Hebrew text (RTL support)
        - High contrast colors (educational palette)
        - Numbered steps if sequential
        - Professional diagram style`,

        timeline: `Create a horizontal timeline infographic showing the chronological sequence or historical progression described below.
        Style: Clean, modern, colorful milestone markers, suitable for educational use.
        Include Hebrew text labels for each event/stage.
        ${topic ? `Topic: ${topic}` : ''}

        Content to visualize:
        ${truncatedText}

        Requirements:
        - Clear timeline axis with date/stage markers
        - Large, readable Hebrew text (RTL)
        - Distinct visual markers for each milestone
        - Educational color scheme`,

        comparison: `Create a side-by-side comparison table or Venn diagram infographic showing the contrasts/similarities described below.
        Style: Clean, balanced layout, color-coded categories, suitable for classroom teaching.
        Include Hebrew text labels for compared items.
        ${topic ? `Topic: ${topic}` : ''}

        Content to visualize:
        ${truncatedText}

        Requirements:
        - Clear visual separation between compared items
        - Large Hebrew text (RTL support)
        - Color coding for different categories
        - Balanced, symmetrical layout`,

        cycle: `Create a circular cycle/loop diagram infographic showing the cyclical process described below.
        Style: Circular flow with arrows, colorful segments, suitable for educational presentation.
        Include Hebrew text labels for each stage of the cycle.
        ${topic ? `Topic: ${topic}` : ''}

        Content to visualize:
        ${truncatedText}

        Requirements:
        - Circular arrangement with directional arrows
        - Large, clear Hebrew text (RTL)
        - Distinct colors for each cycle stage
        - Professional educational style`
    };

    const enhancedPrompt = promptTemplates[visualType];

    try {
        console.log(`🎨 Generating ${visualType} infographic with method: ${preferredMethod}...`);
        const startTime = Date.now();
        let imageBlob: Blob | null = null;
        let usedProvider: 'gemini3' | 'code-to-image' | 'dall-e' | 'imagen' = 'dall-e';
        let actualCost = 0.040;

        // STRATEGY: Gemini 3 → Code-to-Image → DALL-E fallback chain
        if (preferredMethod === 'gemini3' || preferredMethod === 'auto') {
            console.log('🎯 Trying Gemini 3 Pro Image (Preview)...');
            imageBlob = await generateGemini3InfographicFromText(truncatedText, visualType, topic);

            if (imageBlob) {
                usedProvider = 'gemini3';
                actualCost = 0.015; // Estimated
                console.log('✅ Gemini 3 Pro Image successful!');
            } else {
                console.warn('⚠️ Gemini 3 Pro Image failed, trying Code-to-Image fallback...');
            }
        }

        // Fallback 1: Code-to-Image (if Gemini 3 failed or code-to-image was requested)
        if (!imageBlob && (preferredMethod === 'code-to-image' || preferredMethod === 'auto' || preferredMethod === 'gemini3')) {
            try {
                console.log('🎯 Trying Code-to-Image (HTML/CSS)...');
                const { getInfographicHTMLPrompt } = await import('../../utils/infographicHTMLTemplates');
                const { convertHTMLToImage } = await import('../../utils/htmlToImage');

                // Generate HTML with LLM
                const htmlPrompt = getInfographicHTMLPrompt(truncatedText, visualType, topic);
                const response = await openaiClient.chat.completions.create({
                    model: MODEL_NAME,
                    messages: [
                        { role: "system", content: "You are an expert HTML/CSS developer. Output ONLY valid HTML code." },
                        { role: "user", content: htmlPrompt }
                    ],
                    temperature: 0.7
                });

                const htmlCode = response.choices[0].message.content
                    ?.replace(/```html\n?/g, '')
                    ?.replace(/```\n?/g, '')
                    ?.trim();

                if (htmlCode) {
                    imageBlob = await convertHTMLToImage(htmlCode);
                    if (imageBlob) {
                        usedProvider = 'code-to-image';
                        actualCost = 0.001; // LLM only
                        console.log('✅ Code-to-Image successful!');
                    }
                }
            } catch (codeToImageError) {
                console.warn('⚠️ Code-to-Image failed:', codeToImageError);
            }
        }

        // Fallback 2: DALL-E (if everything else failed)
        if (!imageBlob) {
            console.log('🎯 Falling back to DALL-E 3...');
            imageBlob = await generateAiImage(enhancedPrompt);
            if (imageBlob) {
                usedProvider = 'dall-e';
                actualCost = 0.040;
            }
        }

        const generationTime = Date.now() - startTime;

        if (imageBlob) {
            console.log(`✅ ${visualType} infographic generated successfully with ${usedProvider}`);

            // Track successful generation
            trackGenerationComplete(visualType, usedProvider as any, generationTime, actualCost);

            // Cache the result for future use (two-tier: memory + Firebase Storage)
            if (!skipCache) {
                const cacheHash = await generateInfographicHash(truncatedText, visualType);

                // 1. Save to memory cache (fast, session-only)
                const reader = new FileReader();
                reader.onloadend = () => {
                    const dataUrl = reader.result as string;
                    setCachedInfographic(cacheHash, dataUrl);
                    console.log(`💾 Memory cache saved (hash: ${cacheHash.substring(0, 8)}...)`);
                };
                reader.readAsDataURL(imageBlob);

                // 2. Save to Firebase Storage (persistent, cross-session)
                try {
                    const { saveToFirebaseCache } = await import('../../utils/infographicCache');
                    await saveToFirebaseCache(cacheHash, imageBlob);
                    console.log(`☁️ Firebase Storage cache saved (persistent)`);
                } catch (error) {
                    console.warn('⚠️ Firebase Storage save failed (memory cache still active):', error);
                    // Continue anyway - memory cache still works
                }
            }
        } else {
            console.warn(`⚠️ ${visualType} infographic generation returned null`);

            // Track failed generation
            trackGenerationFailed(visualType, 'dall-e');
        }

        return imageBlob;
    } catch (e) {
        console.error(`Error generating ${visualType} infographic:`, e);

        // Track failed generation
        trackGenerationFailed(visualType, 'dall-e');

        return null;
    }
};

export const generateCategorizationQuestion = async (topic: string, gradeLevel: string, sourceText?: string) => {
    const prompt = getCategorizationPrompt(topic, gradeLevel, sourceText);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(res.choices[0].message.content || "{}");
        if (!result.categories || result.categories.length < 2) return null;
        if (!result.items || result.items.length < 2) return null;
        return result;
    } catch (e) { return null; }
};

export const generateOrderingQuestion = async (topic: string, gradeLevel: string, sourceText?: string) => {
    const prompt = getOrderingPrompt(topic, gradeLevel, sourceText);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(res.choices[0].message.content || "{}");
        if (!result.correct_order || result.correct_order.length < 2) return null;
        return result;
    } catch (e) { return null; }
};

export const generateFillInBlanksQuestion = async (topic: string, gradeLevel: string, sourceText?: string) => {
    const prompt = getFillInBlanksPrompt(topic, gradeLevel, sourceText);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(res.choices[0].message.content || "{}");
        if (!parsed.text || !parsed.text.includes('[') || !parsed.text.includes(']')) return null;
        return parsed.text;
    } catch (e) { return null; }
};

export const generateMemoryGame = async (topic: string, gradeLevel: string, sourceText?: string) => {
    const prompt = getMemoryGamePrompt(topic, gradeLevel, sourceText);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const result = JSON.parse(res.choices[0].message.content || "{}");
        if (!result.pairs || result.pairs.length < 3) return null;
        return result;
    } catch (e) { return null; }
};

export const generateStudentAnalysis = async (studentName: string, submissionData: any, courseTopic: string) => {
    const prompt = getStudentAnalysisPrompt(studentName, courseTopic, JSON.stringify(submissionData, null, 2));
    try {
        const completion = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.5
        });
        return JSON.parse(completion.choices[0].message.content || "{}");
    } catch (e) { return null; }
};

export const generateClassAnalysis = async (students: any[]) => {
    const prompt = getClassAnalysisPrompt(JSON.stringify(students.slice(0, 15).map(s => ({ score: s.score, analytics: s.analytics })), null, 2));
    try {
        const completion = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.6
        });
        return JSON.parse(completion.choices[0].message.content || "{}");
    } catch (e) { return null; }
};

export const generateSingleMultipleChoiceQuestion = async (_topic: string, gradeLevel: string, _taxonomy: any, sourceText: string) => {
    const prompt = getSingleMCQPrompt(sourceText, gradeLevel);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(res.choices[0].message.content || "{}");
        if (!parsed.question || !parsed.options || !parsed.correct_answer) return null;
        return {
            id: uuidv4(),
            type: 'multiple-choice',
            content: { question: parsed.question, options: parsed.options, correctAnswer: parsed.correct_answer },
            metadata: { score: 10, difficulty: 1 }
        };
    } catch (e) { return null; }
};

export const generateSingleOpenQuestion = async (_topic: string, gradeLevel: string, _taxonomy: any, sourceText: string) => {
    const prompt = getSingleOpenQuestionPrompt(sourceText, gradeLevel);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const parsed = JSON.parse(res.choices[0].message.content || "{}");
        if (!parsed.question) return null;
        return {
            id: uuidv4(),
            type: 'open-question',
            content: { question: parsed.question },
            metadata: { score: 20, modelAnswer: parsed.model_answer || "תשובה פתוחה." }
        };
    } catch (e) { return null; }
};


// --- REMAINING FUNCTIONS MIGRATED FROM gemini.ts ---

// OPENAI_API_KEY removed. Using ProxyService.

export const generateStudentReport = async (studentData: any) => {
    const prompt = getStudentReportPrompt(JSON.stringify(studentData));
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        return JSON.parse(res.choices[0].message.content || "{}");
    } catch (e) {
        console.error("Student Report Error:", e);
        return null;
    }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "he");

    try {
        // SENTINEL FIX: Use ProxyService
        const data = await callAI("/audio/transcriptions", formData);
        return data.text || null;
    } catch (e) {
        console.error("Transcription Error:", e);
        return null;
    }
};

export const refineBlockContent = async (_blockType: string, content: any, instruction: string) => {
    const prompt = getRefinementPrompt(JSON.stringify(content, null, 2), instruction);
    try {
        console.log(`🎯 AI Refine - Block type: ${_blockType}, Instruction: ${instruction}`);
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const rawResponse = res.choices[0].message.content || "{}";
        console.log(`✅ AI Refine Response:`, rawResponse.substring(0, 200) + '...');
        const parsed = JSON.parse(rawResponse);
        // Validate that we got back a proper object, not an empty one
        if (Object.keys(parsed).length === 0) {
            console.warn('⚠️ AI returned empty object, keeping original content');
            return content;
        }
        return parsed;
    } catch (e) {
        console.error('❌ AI Refine Error:', e);
        return content;
    }
};

export const attemptAutoFix = async (originalJson: any, validationResult: ValidationResult): Promise<any> => {
    const prompt = getAutoFixPrompt(JSON.stringify(validationResult.issues), JSON.stringify(originalJson));
    try {
        const completion = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.3
        });
        return JSON.parse(completion.choices[0].message.content || "{}");
    } catch (e) { return originalJson; }
};

export const safeGenerationWorkflow = async (
    generationFn: () => Promise<any>,
    targetAudience: string,
    maxRetries: number = 2
): Promise<any> => {
    let content = await generationFn();
    let attempts = 0;
    while (attempts <= maxRetries) {
        const validation = await validateContent(content, targetAudience);
        if (validation.status === 'PASS') {
            if (content && typeof content === 'object') {
                if (!content.metadata) content.metadata = {};
                content.metadata.aiValidation = validation.metrics;
            }
            return content;
        }
        if (attempts < maxRetries) {
            content = await attemptAutoFix(content, validation);
        } else {
            throw new Error("Pedagogical Validation Failed.");
        }
        attempts++;
    }
};

export { BOT_PERSONAS };


export const generateGrading = async (question: string, rubric: string, studentAnswers: string) => {
    const prompt = getGradingPrompt(question, rubric, studentAnswers);
    try {
        const res = await openaiClient.chat.completions.create({
            model: MODEL_NAME,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.2
        });
        const text = res.choices[0].message.content || "[]";
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : (parsed.results || []);
    } catch (e) {
        console.error("Grading Generation Error", e);
        return [];
    }
};
