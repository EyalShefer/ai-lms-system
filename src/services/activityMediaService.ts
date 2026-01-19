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

/**
 * Processes suggested_media from AI-generated steps and creates media blocks
 * This should be called after content generation to add scenario images/infographics
 *
 * @param steps - Array of AI-generated steps with suggested_media field
 * @param topic - The activity topic
 * @param onProgress - Progress callback
 * @returns Array of media blocks to insert
 */
export const processSuggestedMedia = async (
    steps: Array<{
        step_number: number;
        suggested_media?: {
            needed: boolean;
            type?: 'scenario_image' | 'infographic';
            infographic_type?: 'flowchart' | 'timeline' | 'comparison' | 'cycle';
            prompt_hint?: string;
        };
        teach_content?: string;
    }>,
    topic: string,
    onProgress?: MediaProgressCallback
): Promise<Map<number, ActivityBlock>> => {
    const mediaBlocks = new Map<number, ActivityBlock>();

    // Filter steps that need SCENARIO IMAGES only
    // IMPORTANT: Infographics are for LESSON PLANS, not student activities
    // Student activities should only have scenario images (dilemmas, real-world situations)
    const stepsNeedingMedia = steps.filter(s =>
        s.suggested_media?.needed &&
        s.suggested_media?.type === 'scenario_image'  // Exclude infographics
    );

    if (stepsNeedingMedia.length === 0) {
        console.log('📷 [SuggestedMedia] No steps need scenario images');
        return mediaBlocks;
    }

    // Limit to 2 scenario images (budget constraint)
    const stepsToProcess = stepsNeedingMedia.slice(0, 2);
    console.log(`📷 [SuggestedMedia] Processing ${stepsToProcess.length} media requests`);

    let current = 0;
    const total = stepsToProcess.length;

    for (const step of stepsToProcess) {
        const media = step.suggested_media!;
        current++;
        onProgress?.(`יוצר מדיה לצעד ${step.step_number}...`, current, total);

        try {
            if (media.type === 'scenario_image') {
                // Generate scenario image
                const prompt = media.prompt_hint
                    ? `Create an educational illustration: ${media.prompt_hint}.
                       Style: Semi-realistic, warm colors.
                       CRITICAL: NO TEXT AT ALL in the image.`
                    : `Create an educational problem-solving scenario image related to "${topic}".
                       Show a moment that requires student decision-making.
                       Style: Semi-realistic, warm colors.
                       CRITICAL: NO TEXT AT ALL in the image.`;

                console.log(`🖼️ [SuggestedMedia] Generating scenario image for step ${step.step_number}`);
                const imageUrl = await generateAndUploadImage(prompt, 'ai-image');

                if (imageUrl) {
                    const scenarioBlock: ActivityBlock = {
                        id: uuidv4(),
                        type: 'scenario-image',
                        content: {
                            imageUrl,
                            caption: 'התבונן בתמונה ובחר את התשובה הנכונה',
                            imagePrompt: prompt,
                            relatedBlockId: `step-${step.step_number}`
                        } as ScenarioImageContent
                    };
                    mediaBlocks.set(step.step_number, scenarioBlock);
                    console.log(`✅ [SuggestedMedia] Scenario image ready for step ${step.step_number}`);
                }
            } else if (media.type === 'infographic') {
                // Generate infographic using the infographic service
                const infographicPrompt = buildInfographicPrompt(
                    step.teach_content || topic,
                    media.infographic_type || 'flowchart',
                    media.prompt_hint
                );

                console.log(`📊 [SuggestedMedia] Generating ${media.infographic_type} infographic for step ${step.step_number}`);
                const imageUrl = await generateAndUploadImage(infographicPrompt, 'infographic');

                if (imageUrl) {
                    const infographicBlock: ActivityBlock = {
                        id: uuidv4(),
                        type: 'scenario-image', // Use same type for rendering
                        content: {
                            imageUrl,
                            caption: getInfographicCaption(media.infographic_type),
                            imagePrompt: infographicPrompt,
                            relatedBlockId: `step-${step.step_number}`
                        } as ScenarioImageContent
                    };
                    mediaBlocks.set(step.step_number, infographicBlock);
                    console.log(`✅ [SuggestedMedia] Infographic ready for step ${step.step_number}`);
                }
            }
        } catch (error) {
            console.warn(`⚠️ [SuggestedMedia] Failed to generate media for step ${step.step_number}:`, error);
            // Continue without this media
        }
    }

    return mediaBlocks;
};

/**
 * Builds an infographic generation prompt based on type
 */
const buildInfographicPrompt = (
    content: string,
    type: 'flowchart' | 'timeline' | 'comparison' | 'cycle',
    promptHint?: string
): string => {
    const typeInstructions: Record<string, string> = {
        flowchart: 'Create a clean flowchart diagram showing the process steps with arrows connecting them.',
        timeline: 'Create a horizontal timeline showing events/stages in chronological order.',
        comparison: 'Create a side-by-side comparison diagram with clear visual differences.',
        cycle: 'Create a circular diagram showing a recurring process with arrows indicating flow.'
    };

    return `Create an educational infographic in Hebrew.
${typeInstructions[type]}
Content to visualize: ${promptHint || content.substring(0, 500)}
Style: Clean, professional, educational. Use warm colors.
CRITICAL: Include Hebrew text labels. Make it easy to read.
Age-appropriate for students.`;
};

/**
 * Gets caption for infographic based on type
 */
const getInfographicCaption = (type?: string): string => {
    const captions: Record<string, string> = {
        flowchart: 'תרשים זרימה של התהליך',
        timeline: 'ציר זמן של האירועים',
        comparison: 'השוואה בין המושגים',
        cycle: 'מחזור התהליך'
    };
    return captions[type || 'flowchart'] || 'תרשים להמחשה';
};
