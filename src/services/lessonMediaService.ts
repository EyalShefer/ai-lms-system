/**
 * Lesson Media Service
 * Handles automatic media generation for AI-generated lessons
 *
 * Flow:
 * 1. Receives media_plan from AI Architect
 * 2. Generates YouTube video block for Hook (if query provided)
 * 3. Generates Infographic block for Summary
 * 4. Returns blocks ready to insert into lesson
 */

import { generateInfographicFromText, type InfographicType } from './ai/geminiApi';
import { searchYouTubeVideos, type YouTubeVideoResult } from './youtubeService';
import type { MediaPlan } from '../utils/mediaBudget';

// --- Types ---

export interface GeneratedMediaBlock {
    type: 'youtube' | 'infographic';
    placement: 'hook' | 'summary';
    content: string; // URL for YouTube, base64 for infographic
    metadata: {
        title?: string;
        description?: string;
        infographicType?: InfographicType;
        videoId?: string;
        generationTime?: number;
    };
}

export interface MediaGenerationResult {
    success: boolean;
    blocks: GeneratedMediaBlock[];
    errors: string[];
    stats: {
        youtubeGenerated: boolean;
        infographicGenerated: boolean;
        totalTime: number;
    };
}

// --- Main Function ---

/**
 * Generate all media for a lesson based on media_plan
 */
export const generateLessonMedia = async (
    mediaPlan: MediaPlan,
    lessonContent: string,
    lessonTitle: string
): Promise<MediaGenerationResult> => {
    const startTime = Date.now();
    const blocks: GeneratedMediaBlock[] = [];
    const errors: string[] = [];

    let youtubeGenerated = false;
    let infographicGenerated = false;

    // 1. Generate YouTube video for Hook (if query provided)
    if (mediaPlan.hook_video_query) {
        try {
            console.log('🎬 Searching for Hook video:', mediaPlan.hook_video_query);

            const response = await searchYouTubeVideos({
                topic: mediaPlan.hook_video_query,
                gradeLevel: 'כיתה ד-ו', // Default grade level
                language: 'he',
                maxResults: 3,
                requireCaptions: true,
                educationalOnly: true
            });

            if (response.success && response.videos.length > 0) {
                const bestVideo = response.videos[0]; // Already sorted by relevance

                blocks.push({
                    type: 'youtube',
                    placement: 'hook',
                    content: `https://www.youtube.com/watch?v=${bestVideo.videoId}`,
                    metadata: {
                        title: bestVideo.title,
                        description: bestVideo.description,
                        videoId: bestVideo.videoId
                    }
                });

                youtubeGenerated = true;
                console.log('✅ Hook video found:', bestVideo.title);
            } else {
                console.log('⚠️ No suitable video found for Hook');
            }
        } catch (error) {
            console.error('❌ YouTube search failed:', error);
            errors.push(`YouTube search failed: ${error}`);
        }
    }

    // 2. Generate Infographic for Summary
    if (mediaPlan.summary_infographic_type && mediaPlan.summary_infographic_description) {
        try {
            console.log('📊 Generating Summary infographic:', mediaPlan.summary_infographic_type);

            const infographicBlob = await generateInfographicFromText(
                lessonContent,
                mediaPlan.summary_infographic_type,
                lessonTitle
            );

            if (infographicBlob) {
                // Convert blob to base64
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                });
                reader.readAsDataURL(infographicBlob);

                const base64 = await base64Promise;

                blocks.push({
                    type: 'infographic',
                    placement: 'summary',
                    content: base64,
                    metadata: {
                        infographicType: mediaPlan.summary_infographic_type,
                        description: mediaPlan.summary_infographic_description,
                        generationTime: Date.now() - startTime
                    }
                });

                infographicGenerated = true;
                console.log('✅ Summary infographic generated');
            } else {
                console.log('⚠️ Infographic generation returned null');
                errors.push('Infographic generation failed');
            }
        } catch (error) {
            console.error('❌ Infographic generation failed:', error);
            errors.push(`Infographic generation failed: ${error}`);
        }
    }

    const totalTime = Date.now() - startTime;

    return {
        success: errors.length === 0,
        blocks,
        errors,
        stats: {
            youtubeGenerated,
            infographicGenerated,
            totalTime
        }
    };
};

/**
 * Insert generated media blocks into lesson steps
 */
export const insertMediaIntoLesson = (
    steps: any[],
    mediaBlocks: GeneratedMediaBlock[]
): any[] => {
    const updatedSteps = [...steps];

    for (const block of mediaBlocks) {
        if (block.placement === 'hook') {
            // Find first step (Hook) and add video
            if (updatedSteps.length > 0) {
                updatedSteps[0] = {
                    ...updatedSteps[0],
                    media: {
                        type: 'youtube',
                        url: block.content,
                        title: block.metadata.title,
                        videoId: block.metadata.videoId
                    }
                };
                console.log('📺 Inserted YouTube video into Hook step');
            }
        } else if (block.placement === 'summary') {
            // Find last step (Summary) and add infographic
            if (updatedSteps.length > 0) {
                const lastIndex = updatedSteps.length - 1;
                updatedSteps[lastIndex] = {
                    ...updatedSteps[lastIndex],
                    media: {
                        type: 'infographic',
                        imageData: block.content,
                        infographicType: block.metadata.infographicType,
                        description: block.metadata.description
                    }
                };
                console.log('📊 Inserted infographic into Summary step');
            }
        }
    }

    return updatedSteps;
};

/**
 * Quick helper: Generate only summary infographic
 */
export const generateSummaryInfographic = async (
    content: string,
    infographicType: InfographicType,
    title: string
): Promise<string | null> => {
    try {
        const blob = await generateInfographicFromText(content, infographicType, title);
        if (!blob) return null;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Summary infographic generation failed:', error);
        return null;
    }
};
