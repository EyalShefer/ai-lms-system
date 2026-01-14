/**
 * YouTube Search Service for Educational Content
 *
 * Features:
 * - Search YouTube videos by topic
 * - Filter by language (Hebrew captions priority)
 * - Filter by age-appropriate content (Safe Search)
 * - Analyze video metadata for educational relevance
 * - AI-powered content verification
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { generateJSON, ChatMessage } from "./services/geminiService";

// Secrets - with fallback to environment variables for local development
const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");

// Helper to get API key (secret or env fallback)
const getYouTubeApiKey = (): string => {
    try {
        return youtubeApiKey.value();
    } catch {
        return process.env.YOUTUBE_API_KEY || '';
    }
};

// Types
export interface YouTubeSearchParams {
    topic: string;
    gradeLevel: string;
    language?: 'he' | 'en' | 'any';
    maxResults?: number;
    requireCaptions?: boolean;
    educationalOnly?: boolean;
}

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

// Grade level to age mapping for YouTube safe search
const GRADE_TO_AGE_RANGE: Record<string, { min: number; max: number }> = {
    'כיתה א': { min: 6, max: 7 },
    'כיתה ב': { min: 7, max: 8 },
    'כיתה ג': { min: 8, max: 9 },
    'כיתה ד': { min: 9, max: 10 },
    'כיתה ה': { min: 10, max: 11 },
    'כיתה ו': { min: 11, max: 12 },
    'כיתה ז': { min: 12, max: 13 },
    'כיתה ח': { min: 13, max: 14 },
    'כיתה ט': { min: 14, max: 15 },
    'כיתה י': { min: 15, max: 16 },
    'כיתה יא': { min: 16, max: 17 },
    'כיתה יב': { min: 17, max: 18 },
};

// Duration parsing (ISO 8601 to readable)
function parseDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 'Unknown';

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Get duration in minutes for filtering
function getDurationMinutes(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 60 + minutes + seconds / 60;
}

/**
 * Search YouTube for educational videos
 */
async function searchYouTubeVideos(
    apiKey: string,
    params: YouTubeSearchParams
): Promise<any[]> {
    const { topic, gradeLevel, language = 'he', maxResults = 10, requireCaptions = true } = params;

    // Build search query with educational context
    const ageRange = GRADE_TO_AGE_RANGE[gradeLevel];
    let searchQuery = topic;

    // Add Hebrew language hint if needed
    if (language === 'he') {
        searchQuery = `${topic} בעברית`;
    }

    // Add educational keywords
    if (params.educationalOnly) {
        searchQuery += ' הסבר לימוד';
    }

    // YouTube Data API v3 - Search
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('maxResults', String(Math.min(maxResults * 2, 50))); // Get more to filter
    searchUrl.searchParams.set('safeSearch', 'strict'); // Always safe for education
    searchUrl.searchParams.set('videoEmbeddable', 'true');
    searchUrl.searchParams.set('key', apiKey);

    // Language/Region hints
    if (language === 'he') {
        searchUrl.searchParams.set('relevanceLanguage', 'he');
        searchUrl.searchParams.set('regionCode', 'IL');
    }

    // Prefer videos with captions
    if (requireCaptions) {
        searchUrl.searchParams.set('videoCaption', 'closedCaption');
    }

    logger.info(`YouTube Search URL: ${searchUrl.toString().replace(apiKey, 'REDACTED')}`);

    const searchResponse = await fetch(searchUrl.toString());

    if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        logger.error('YouTube Search API Error:', errorText);
        throw new Error(`YouTube API Error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json() as { items?: any[] };

    if (!searchData.items || searchData.items.length === 0) {
        return [];
    }

    // Get video IDs for detailed info
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

    // YouTube Data API v3 - Video Details
    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
    detailsUrl.searchParams.set('id', videoIds);
    detailsUrl.searchParams.set('key', apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());

    if (!detailsResponse.ok) {
        throw new Error(`YouTube Details API Error: ${detailsResponse.status}`);
    }

    const detailsData = await detailsResponse.json() as { items?: any[] };

    return detailsData.items || [];
}

/**
 * Get caption info for a video
 */
async function getVideoCaptions(apiKey: string, videoId: string): Promise<string[]> {
    try {
        const captionUrl = new URL('https://www.googleapis.com/youtube/v3/captions');
        captionUrl.searchParams.set('part', 'snippet');
        captionUrl.searchParams.set('videoId', videoId);
        captionUrl.searchParams.set('key', apiKey);

        const response = await fetch(captionUrl.toString());

        if (!response.ok) {
            return [];
        }

        const data = await response.json() as { items?: any[] };

        if (!data.items) return [];

        return data.items.map((item: any) => item.snippet.language);
    } catch (e) {
        logger.warn(`Failed to get captions for ${videoId}:`, e);
        return [];
    }
}

/**
 * AI-powered educational relevance scoring using Gemini 2.5 Pro
 */
async function scoreVideoRelevance(
    video: any,
    topic: string,
    gradeLevel: string
): Promise<{ educationalScore: number; ageAppropriate: boolean; relevanceScore: number }> {
    try {
        const prompt = `
Analyze this YouTube video for educational use in a ${gradeLevel} classroom.

Video Title: ${video.snippet.title}
Channel: ${video.snippet.channelTitle}
Description: ${video.snippet.description?.substring(0, 500) || 'No description'}
Duration: ${video.contentDetails?.duration || 'Unknown'}
Views: ${video.statistics?.viewCount || 'Unknown'}

Target Topic: ${topic}
Target Grade Level: ${gradeLevel}

Evaluate and return JSON:
{
  "educationalScore": number (0-100, how educational/informative is this video),
  "ageAppropriate": boolean (suitable for the grade level),
  "relevanceScore": number (0-100, how relevant to the specific topic),
  "reasoning": "Brief Hebrew explanation"
}

Consider:
- Is this from an educational channel?
- Does the title/description match the topic?
- Is the duration appropriate for classroom use (2-15 minutes ideal)?
- Is the content level appropriate for the grade?
`;

        const messages: ChatMessage[] = [{ role: "user", content: prompt }];
        const result = await generateJSON<{
            educationalScore: number;
            ageAppropriate: boolean;
            relevanceScore: number;
            reasoning: string;
        }>(messages, { temperature: 0.3 });

        return {
            educationalScore: result.educationalScore || 50,
            ageAppropriate: result.ageAppropriate !== false,
            relevanceScore: result.relevanceScore || 50
        };
    } catch (e) {
        logger.warn('AI scoring failed, using defaults:', e);
        return {
            educationalScore: 50,
            ageAppropriate: true,
            relevanceScore: 50
        };
    }
}

/**
 * Main Cloud Function: Search YouTube for Educational Videos
 */
export const searchYouTubeEducational = onCall(
    {
        cors: true,
        memory: "512MiB",
        timeoutSeconds: 60,
        secrets: [youtubeApiKey]
    },
    async (request): Promise<YouTubeSearchResponse> => {
        const { topic, gradeLevel, language = 'he', maxResults = 5, requireCaptions = true, educationalOnly = true } = request.data as YouTubeSearchParams;

        if (!topic || !gradeLevel) {
            throw new HttpsError('invalid-argument', 'Missing required parameters: topic, gradeLevel');
        }

        logger.info(`YouTube Educational Search: "${topic}" for ${gradeLevel}`);

        try {
            const ytApiKey = getYouTubeApiKey();

            // 1. Search YouTube
            const rawVideos = await searchYouTubeVideos(ytApiKey, {
                topic,
                gradeLevel,
                language,
                maxResults: maxResults * 3, // Get more to filter
                requireCaptions,
                educationalOnly
            });

            if (rawVideos.length === 0) {
                return {
                    success: true,
                    videos: [],
                    totalResults: 0,
                    query: topic,
                    filters: { language, gradeLevel, safeSearch: true }
                };
            }

            // 2. Process and score each video
            const processedVideos: YouTubeVideoResult[] = [];

            for (const video of rawVideos) {
                // Skip videos that are too long (>20 min) or too short (<1 min)
                const durationMinutes = getDurationMinutes(video.contentDetails?.duration || 'PT0S');
                if (durationMinutes > 20 || durationMinutes < 1) {
                    continue;
                }

                // Get caption languages
                const captionLanguages = await getVideoCaptions(ytApiKey, video.id);

                // Check for Hebrew or subtitled content
                const hasHebrewCaptions = captionLanguages.some(lang =>
                    lang === 'he' || lang === 'iw' || lang === 'he-IL'
                );

                // Check if title/description contains Hebrew
                const hasHebrewContent = /[\u0590-\u05FF]/.test(video.snippet.title + video.snippet.description);

                // Skip if Hebrew required but not available
                if (language === 'he' && !hasHebrewContent && !hasHebrewCaptions) {
                    // Allow if English with captions (can be translated)
                    const hasEnglishCaptions = captionLanguages.some(lang => lang === 'en' || lang === 'en-US');
                    if (!hasEnglishCaptions) {
                        continue;
                    }
                }

                // AI Scoring using Gemini 2.5 Pro
                const scores = await scoreVideoRelevance(video, topic, gradeLevel);

                // Skip low-quality matches
                if (scores.relevanceScore < 40 || !scores.ageAppropriate) {
                    continue;
                }

                processedVideos.push({
                    videoId: video.id,
                    title: video.snippet.title,
                    description: video.snippet.description?.substring(0, 300) || '',
                    thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
                    channelTitle: video.snippet.channelTitle,
                    publishedAt: video.snippet.publishedAt,
                    duration: parseDuration(video.contentDetails?.duration || 'PT0S'),
                    viewCount: video.statistics?.viewCount || '0',
                    hasCaptions: captionLanguages.length > 0,
                    captionLanguages,
                    educationalScore: scores.educationalScore,
                    ageAppropriate: scores.ageAppropriate,
                    relevanceScore: scores.relevanceScore,
                    embedUrl: `https://www.youtube.com/embed/${video.id}`,
                    watchUrl: `https://www.youtube.com/watch?v=${video.id}`
                });

                // Stop when we have enough good results
                if (processedVideos.length >= maxResults) {
                    break;
                }
            }

            // Sort by combined score
            processedVideos.sort((a, b) => {
                const scoreA = a.relevanceScore * 0.6 + a.educationalScore * 0.4;
                const scoreB = b.relevanceScore * 0.6 + b.educationalScore * 0.4;
                return scoreB - scoreA;
            });

            logger.info(`Found ${processedVideos.length} suitable videos for "${topic}"`);

            return {
                success: true,
                videos: processedVideos.slice(0, maxResults),
                totalResults: processedVideos.length,
                query: topic,
                filters: { language, gradeLevel, safeSearch: true }
            };

        } catch (error: any) {
            logger.error('YouTube Search Error:', error);
            throw new HttpsError('internal', `YouTube search failed: ${error.message}`);
        }
    }
);

/**
 * Get detailed info about a specific video for embedding
 */
export const getYouTubeVideoDetails = onCall(
    {
        cors: true,
        memory: "256MiB",
        secrets: [youtubeApiKey]
    },
    async (request) => {
        const { videoId } = request.data;

        if (!videoId) {
            throw new HttpsError('invalid-argument', 'Missing videoId');
        }

        try {
            const ytApiKey = getYouTubeApiKey();

            // Get video details
            const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
            detailsUrl.searchParams.set('part', 'snippet,contentDetails,statistics,status');
            detailsUrl.searchParams.set('id', videoId);
            detailsUrl.searchParams.set('key', ytApiKey);

            const response = await fetch(detailsUrl.toString());
            const data = await response.json() as { items?: any[] };

            if (!data.items || data.items.length === 0) {
                throw new HttpsError('not-found', 'Video not found');
            }

            const video = data.items[0];

            // Check embeddability
            if (!video.status?.embeddable) {
                throw new HttpsError('failed-precondition', 'Video cannot be embedded');
            }

            // Get captions
            const captionLanguages = await getVideoCaptions(ytApiKey, videoId);

            return {
                success: true,
                video: {
                    videoId: video.id,
                    title: video.snippet.title,
                    description: video.snippet.description,
                    thumbnailUrl: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url,
                    channelTitle: video.snippet.channelTitle,
                    duration: parseDuration(video.contentDetails?.duration || 'PT0S'),
                    viewCount: video.statistics?.viewCount,
                    hasCaptions: captionLanguages.length > 0,
                    captionLanguages,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`,
                    embeddable: video.status?.embeddable
                }
            };

        } catch (error: any) {
            logger.error('Video Details Error:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);
