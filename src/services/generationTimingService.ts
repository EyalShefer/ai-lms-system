/**
 * Generation Timing Service
 * Tracks and stores timing data for content generation analytics
 */

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface GenerationTimingData {
    userId: string;
    userEmail?: string;
    courseId: string;
    unitId: string;
    productType: 'lesson' | 'activity' | 'exam' | 'podcast';
    sourceType: 'text' | 'youtube' | 'pdf' | 'url' | 'manual';
    sourceLength: number;
    stepCount: number;
    timings: {
        total: number;
        skeleton: number;
        contentGeneration: number;
        perStepAverage: number;
        imageGeneration?: number;
        enrichment?: number;
    };
    success: boolean;
    errorMessage?: string;
    model?: string;
}

/**
 * Detect source type from course/wizard data
 */
export const detectSourceType = (course: any): 'text' | 'youtube' | 'pdf' | 'url' | 'manual' => {
    const wizardData = course?.wizardData;

    if (wizardData?.youtubeUrl || wizardData?.youtubeVideoId) {
        return 'youtube';
    }

    if (wizardData?.uploadedFileName?.toLowerCase().endsWith('.pdf') || course?.sourceFileName?.toLowerCase().endsWith('.pdf')) {
        return 'pdf';
    }

    if (wizardData?.sourceUrl || wizardData?.webUrl) {
        return 'url';
    }

    if (wizardData?.pastedText || course?.fullBookContent) {
        return 'text';
    }

    return 'manual';
};

/**
 * Get source content length
 */
export const getSourceLength = (course: any): number => {
    const wizardData = course?.wizardData;

    // For YouTube, return video duration if available (in seconds)
    if (wizardData?.videoDuration) {
        return wizardData.videoDuration;
    }

    // For text content, return character count
    const textContent = course?.fullBookContent || wizardData?.pastedText || '';
    return textContent.length;
};

/**
 * Save generation timing data to Firestore
 */
export const saveGenerationTiming = async (data: GenerationTimingData): Promise<void> => {
    try {
        const timingsRef = collection(db, 'generationTimings');

        await addDoc(timingsRef, {
            ...data,
            createdAt: Timestamp.now(),
            model: data.model || 'gemini-3-pro-preview',
        });

        console.log('⏱️ [Timing] Saved generation timing:', {
            productType: data.productType,
            total: `${(data.timings.total / 1000).toFixed(1)}s`,
            skeleton: `${(data.timings.skeleton / 1000).toFixed(1)}s`,
            content: `${(data.timings.contentGeneration / 1000).toFixed(1)}s`,
        });
    } catch (error) {
        // Don't throw - timing is non-critical
        console.warn('⏱️ [Timing] Failed to save timing data:', error);
    }
};

/**
 * Helper class to track timing during generation
 */
export class GenerationTimer {
    private startTime: number;
    private marks: Record<string, number> = {};
    private courseId: string;
    private unitId: string;
    private productType: 'lesson' | 'activity' | 'exam' | 'podcast';
    private sourceType: 'text' | 'youtube' | 'pdf' | 'url' | 'manual';
    private sourceLength: number;
    private stepCount: number = 0;

    constructor(
        courseId: string,
        unitId: string,
        productType: 'lesson' | 'activity' | 'exam' | 'podcast',
        course: any
    ) {
        this.startTime = performance.now();
        this.courseId = courseId;
        this.unitId = unitId;
        this.productType = productType;
        this.sourceType = detectSourceType(course);
        this.sourceLength = getSourceLength(course);

        console.log(`⏱️ [Timing] Started timer for ${productType} generation`);
    }

    /**
     * Mark a checkpoint
     */
    mark(name: string): void {
        this.marks[name] = performance.now();
        const elapsed = this.marks[name] - this.startTime;
        console.log(`⏱️ [Timing] ${name}: ${(elapsed / 1000).toFixed(2)}s`);
    }

    /**
     * Get duration between two marks (or from start)
     */
    getDuration(fromMark?: string, toMark?: string): number {
        const from = fromMark ? this.marks[fromMark] : this.startTime;
        const to = toMark ? this.marks[toMark] : performance.now();
        return to - from;
    }

    /**
     * Set step count
     */
    setStepCount(count: number): void {
        this.stepCount = count;
    }

    /**
     * Finish and save timing data
     */
    async finish(success: boolean, errorMessage?: string): Promise<void> {
        const endTime = performance.now();
        const total = endTime - this.startTime;

        const skeletonEnd = this.marks['skeleton_complete'] || this.marks['placeholders_ready'] || this.startTime;
        const contentEnd = this.marks['content_complete'] || endTime;

        const skeleton = skeletonEnd - this.startTime;
        const contentGeneration = contentEnd - skeletonEnd;
        const imageGeneration = this.marks['image_complete'] ?
            this.marks['image_complete'] - (this.marks['image_start'] || skeletonEnd) : undefined;

        const user = auth.currentUser;

        const timingData: GenerationTimingData = {
            userId: user?.uid || 'anonymous',
            userEmail: user?.email || undefined,
            courseId: this.courseId,
            unitId: this.unitId,
            productType: this.productType,
            sourceType: this.sourceType,
            sourceLength: this.sourceLength,
            stepCount: this.stepCount,
            timings: {
                total,
                skeleton,
                contentGeneration,
                perStepAverage: this.stepCount > 0 ? contentGeneration / this.stepCount : 0,
                imageGeneration,
            },
            success,
            errorMessage,
        };

        // Log summary to console
        console.log(`⏱️ [Timing] === Generation Complete ===`);
        console.log(`⏱️ [Timing] Product: ${this.productType}`);
        console.log(`⏱️ [Timing] Source: ${this.sourceType} (${this.sourceLength} chars)`);
        console.log(`⏱️ [Timing] Steps: ${this.stepCount}`);
        console.log(`⏱️ [Timing] Total: ${(total / 1000).toFixed(2)}s`);
        console.log(`⏱️ [Timing] - Skeleton: ${(skeleton / 1000).toFixed(2)}s`);
        console.log(`⏱️ [Timing] - Content: ${(contentGeneration / 1000).toFixed(2)}s`);
        if (imageGeneration) {
            console.log(`⏱️ [Timing] - Images: ${(imageGeneration / 1000).toFixed(2)}s`);
        }
        console.log(`⏱️ [Timing] - Per Step Avg: ${(timingData.timings.perStepAverage / 1000).toFixed(2)}s`);
        console.log(`⏱️ [Timing] Success: ${success}`);
        console.log(`⏱️ [Timing] ========================`);

        // Save to Firestore
        await saveGenerationTiming(timingData);
    }
}
