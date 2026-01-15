/**
 * Activity Media Service
 *
 * Handles image generation for standalone student activities.
 * Strategy: Images provide "the why" (meaning), UI provides "the fun" (stars)
 *
 * Budget: 1 context image (opening) + 0-2 scenario images (in questions)
 * Total max: 3 images per activity
 */

import { v4 as uuidv4 } from 'uuid';
import { generateGeminiImage } from './ai/imagenService';
import { uploadGeneratedImage } from './storageService';
import {
    createActivityMediaPlan,
    shouldAddScenarioImage,
    type ActivityMediaPlan,
    type ActivityMediaUsage
} from '../utils/mediaBudget';
import type { ActivityBlock, ActivityIntroContent, ScenarioImageContent, LearningUnit } from '../shared/types/courseTypes';

// Progress callback for UI feedback
export type MediaProgressCallback = (step: string, current: number, total: number) => void;

/**
 * Enriches an activity with context and scenario images
 * Call this after activity generation is complete
 */
export const enrichActivityWithImages = async (
    unit: LearningUnit,
    topic: string,
    subject: string,
    gradeLevel: string,
    onProgress?: MediaProgressCallback
): Promise<LearningUnit> => {
    const blocks = unit.activityBlocks || [];
    if (blocks.length === 0) return unit;

    // Extract questions for media planning
    // Include question type so we can filter appropriately (e.g., skip categorization)
    const questions = blocks
        .filter(b => ['multiple-choice', 'open-question', 'categorization'].includes(b.type))
        .map(b => {
            const content = b.content as any;
            return {
                id: b.id,
                text: content?.question || content?.text || '',
                taxonomy: b.metadata?.bloomLevel,
                type: b.type
            };
        });

    // Create media plan
    const mediaPlan = createActivityMediaPlan(topic, subject, gradeLevel, questions);

    const totalImages = 1 + mediaPlan.scenarioImages.length;
    let currentImage = 0;

    const newBlocks: ActivityBlock[] = [];

    // 1. Generate and add context (intro) image as first block
    onProgress?.('יוצר תמונת פתיחה...', ++currentImage, totalImages);

    try {
        const contextImageUrl = await generateAndUploadImage(
            mediaPlan.contextImage.prompt,
            'ai-image'
        );

        if (contextImageUrl) {
            const introBlock: ActivityBlock = {
                id: uuidv4(),
                type: 'activity-intro',
                content: {
                    imageUrl: contextImageUrl,
                    title: getContextTitle(subject, topic),
                    description: mediaPlan.contextImage.description,
                    imagePrompt: mediaPlan.contextImage.prompt
                } as ActivityIntroContent
            };
            newBlocks.push(introBlock);
        }
    } catch (error) {
        console.warn('Failed to generate context image:', error);
        // Continue without context image
    }

    // 2. Process existing blocks, inserting scenario images where needed
    const scenarioImageMap = new Map(
        mediaPlan.scenarioImages.map(s => [s.blockId, s])
    );

    for (const block of blocks) {
        // Check if this block needs a scenario image
        const scenarioImage = scenarioImageMap.get(block.id);

        if (scenarioImage) {
            onProgress?.('יוצר תמונת דילמה...', ++currentImage, totalImages);

            try {
                const scenarioImageUrl = await generateAndUploadImage(
                    scenarioImage.prompt,
                    'ai-image'
                );

                if (scenarioImageUrl) {
                    // Insert scenario image block BEFORE the question
                    const scenarioBlock: ActivityBlock = {
                        id: uuidv4(),
                        type: 'scenario-image',
                        content: {
                            imageUrl: scenarioImageUrl,
                            caption: getScenarioCaption(block),
                            imagePrompt: scenarioImage.prompt,
                            relatedBlockId: block.id
                        } as ScenarioImageContent
                    };
                    newBlocks.push(scenarioBlock);
                }
            } catch (error) {
                console.warn('Failed to generate scenario image:', error);
                // Continue without scenario image
            }
        }

        // Add the original block
        newBlocks.push(block);
    }

    return {
        ...unit,
        activityBlocks: newBlocks
    };
};

/**
 * Generates an image using Gemini and uploads to Storage
 */
const generateAndUploadImage = async (
    prompt: string,
    type: 'ai-image' | 'infographic'
): Promise<string | null> => {
    try {
        console.log(`🎨 [ActivityMedia] Generating image... (prompt: ${prompt.substring(0, 50)}...)`);
        const imageBlob = await generateGeminiImage(prompt);
        if (!imageBlob) {
            console.warn('🎨 [ActivityMedia] Gemini returned no image blob');
            return null;
        }
        console.log(`🎨 [ActivityMedia] Image generated, size: ${(imageBlob.size / 1024).toFixed(1)}KB`);

        console.log(`📤 [ActivityMedia] Uploading to Firebase Storage...`);
        const imageUrl = await uploadGeneratedImage(imageBlob, type);
        console.log(`✅ [ActivityMedia] Image uploaded successfully: ${imageUrl.substring(0, 80)}...`);
        return imageUrl;
    } catch (error) {
        console.error('❌ [ActivityMedia] Image generation/upload failed:', error);
        return null;
    }
};

/**
 * Creates an engaging context title based on subject
 */
const getContextTitle = (subject: string, topic: string): string => {
    const subjectTitles: Record<string, string> = {
        'מתמטיקה': 'אתה המהנדס!',
        'לשון': 'אתה העיתונאי!',
        'מדעים': 'אתה המדען!',
        'היסטוריה': 'אתה החוקר!',
        'אנגלית': 'אתה השגריר!',
        'גיאוגרפיה': 'אתה הנווט!',
        'אזרחות': 'אתה עורך הדין!',
        'תנ"ך': 'אתה הארכיאולוג!'
    };

    return subjectTitles[subject] || `משימה: ${topic}`;
};

/**
 * Creates a caption for scenario images
 */
const getScenarioCaption = (block: ActivityBlock): string => {
    const content = block.content as any;
    const question = content?.question || content?.text || '';

    // Extract key action words
    if (question.includes('מה יקרה')) return 'מה לדעתך יקרה כאן?';
    if (question.includes('איך נפתור')) return 'איך תפתור את הבעיה?';
    if (question.includes('מה הבעיה')) return 'מצא את הבעיה בתמונה';
    if (question.includes('למה')) return 'הסתכל בתמונה - מה ההסבר?';

    return 'התבונן בתמונה ובחר את התשובה הנכונה';
};

/**
 * Checks if an activity already has media enrichment
 */
export const isActivityEnriched = (unit: LearningUnit): boolean => {
    const blocks = unit.activityBlocks || [];
    return blocks.some(b => b.type === 'activity-intro' || b.type === 'scenario-image');
};

/**
 * Gets media usage statistics for an activity
 */
export const getActivityMediaStats = (unit: LearningUnit): ActivityMediaUsage => {
    const blocks = unit.activityBlocks || [];
    return {
        contextImages: blocks.filter(b => b.type === 'activity-intro').length,
        scenarioImages: blocks.filter(b => b.type === 'scenario-image').length
    };
};

/**
 * Generates ONLY the context (opening) image for an activity
 * Can be called in parallel with content generation for better performance
 *
 * @param topic - The activity topic (used as fallback if no custom prompt)
 * @param subject - The subject area
 * @param gradeLevel - Target grade level
 * @param customImagePrompt - AI-generated prompt from skeleton (preferred)
 * @param onProgress - Progress callback
 * @returns ActivityBlock of type 'activity-intro' or null if generation fails
 */
export const generateContextImageBlock = async (
    topic: string,
    subject: string,
    gradeLevel: string,
    customImagePrompt?: string,
    onProgress?: MediaProgressCallback
): Promise<ActivityBlock | null> => {
    const { createContextImagePrompt } = await import('../utils/mediaBudget');

    // Use AI-generated prompt if available, otherwise fall back to generic prompt
    const prompt = customImagePrompt || createContextImagePrompt(topic, subject, gradeLevel);
    onProgress?.('יוצר תמונת פתיחה...', 1, 1);

    console.log(`🖼️ [Parallel] Starting context image generation for: ${topic}`);
    if (customImagePrompt) {
        console.log(`🎯 [Parallel] Using AI-generated prompt from skeleton`);
    }
    const startTime = Date.now();

    try {
        const imageUrl = await generateAndUploadImage(prompt, 'ai-image');

        if (imageUrl) {
            const elapsed = Date.now() - startTime;
            console.log(`✅ [Parallel] Context image ready in ${(elapsed / 1000).toFixed(1)}s`);

            return {
                id: uuidv4(),
                type: 'activity-intro',
                content: {
                    imageUrl,
                    title: getContextTitle(subject, topic),
                    description: `תמונת פתיחה: ${subject} - ${topic}`,
                    imagePrompt: prompt
                } as ActivityIntroContent
            };
        }
    } catch (error) {
        console.warn('❌ [Parallel] Context image generation failed:', error);
    }

    return null;
};
