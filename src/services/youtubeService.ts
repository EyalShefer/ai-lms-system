/**
 * YouTube Educational Video Service
 *
 * Frontend service for searching and embedding YouTube videos in lessons
 */

import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

// Types
export interface YouTubeVideoResult {
    videoId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    channelTitle: string;
    publishedAt: string;
    duration: string;
    viewCount: string;
    hasCaptions: boolean;
    captionLanguages: string[];
    educationalScore: number;
    ageAppropriate: boolean;
    relevanceScore: number;
    embedUrl: string;
    watchUrl: string;
}

export interface YouTubeSearchParams {
    topic: string;
    gradeLevel: string;
    language?: 'he' | 'en' | 'any';
    maxResults?: number;
    requireCaptions?: boolean;
    educationalOnly?: boolean;
}

export interface YouTubeSearchResponse {
    success: boolean;
    videos: YouTubeVideoResult[];
    totalResults: number;
    query: string;
    filters: {
        language: string;
        gradeLevel: string;
        safeSearch: boolean;
    };
}

// Cache for search results
const searchCache = new Map<string, { data: YouTubeSearchResponse; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key from search params
 */
function getCacheKey(params: YouTubeSearchParams): string {
    return `${params.topic}|${params.gradeLevel}|${params.language || 'he'}|${params.maxResults || 5}`;
}

/**
 * Search for educational YouTube videos
 */
export async function searchYouTubeVideos(params: YouTubeSearchParams): Promise<YouTubeSearchResponse> {
    const cacheKey = getCacheKey(params);

    // Check cache
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('[YouTube] Cache hit for:', params.topic);
        return cached.data;
    }

    try {
        const searchFn = httpsCallable(functions, 'searchYouTubeEducational');
        const result = await searchFn(params);

        const data = result.data as YouTubeSearchResponse;

        // Cache successful results
        if (data.success) {
            searchCache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data;
    } catch (error: any) {
        console.error('[YouTube] Search failed:', error);
        throw new Error(`חיפוש YouTube נכשל: ${error.message}`);
    }
}

/**
 * Get detailed info about a specific video
 */
export async function getVideoDetails(videoId: string): Promise<YouTubeVideoResult | null> {
    try {
        const detailsFn = httpsCallable(functions, 'getYouTubeVideoDetails');
        const result = await detailsFn({ videoId });

        const data = result.data as { success: boolean; video: YouTubeVideoResult };
        return data.success ? data.video : null;
    } catch (error: any) {
        console.error('[YouTube] Get details failed:', error);
        return null;
    }
}

/**
 * Generate embed HTML for a YouTube video
 */
export function generateEmbedHtml(videoId: string, options?: {
    width?: number;
    height?: number;
    autoplay?: boolean;
    showControls?: boolean;
}): string {
    const { width = 560, height = 315, autoplay = false, showControls = true } = options || {};

    const params = new URLSearchParams({
        rel: '0', // Don't show related videos
        modestbranding: '1', // Minimal YouTube branding
        fs: '1', // Allow fullscreen
    });

    if (autoplay) params.set('autoplay', '1');
    if (!showControls) params.set('controls', '0');

    return `<iframe
        width="${width}"
        height="${height}"
        src="https://www.youtube.com/embed/${videoId}?${params.toString()}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
    ></iframe>`;
}

/**
 * Validate a YouTube URL and extract video ID
 */
export function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^#&?]*)/,
        /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1].length === 11) {
            return match[1];
        }
    }

    return null;
}

/**
 * Create a video block for the lesson plan
 */
export function createVideoBlock(video: YouTubeVideoResult): {
    type: 'video';
    content: string;
    metadata: Record<string, any>;
} {
    return {
        type: 'video',
        content: video.embedUrl,
        metadata: {
            videoId: video.videoId,
            title: video.title,
            channelTitle: video.channelTitle,
            duration: video.duration,
            thumbnailUrl: video.thumbnailUrl,
            hasCaptions: video.hasCaptions,
            captionLanguages: video.captionLanguages,
            educationalScore: video.educationalScore,
            source: 'youtube-search',
            watchUrl: video.watchUrl
        }
    };
}

/**
 * Search for videos and return as ready-to-use blocks
 */
export async function searchAndCreateVideoBlocks(
    topic: string,
    gradeLevel: string,
    maxResults: number = 3
): Promise<Array<{ type: 'video'; content: string; metadata: Record<string, any> }>> {
    try {
        const response = await searchYouTubeVideos({
            topic,
            gradeLevel,
            language: 'he',
            maxResults,
            requireCaptions: true,
            educationalOnly: true
        });

        if (!response.success || response.videos.length === 0) {
            return [];
        }

        return response.videos.map(video => createVideoBlock(video));
    } catch (error) {
        console.error('[YouTube] Failed to create video blocks:', error);
        return [];
    }
}

// Export types
export type { YouTubeSearchResponse, YouTubeVideoResult, YouTubeSearchParams };
