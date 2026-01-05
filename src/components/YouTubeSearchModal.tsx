/**
 * YouTube Educational Video Search Modal
 *
 * Allows teachers to search and select educational YouTube videos
 * with filtering for Hebrew content and age-appropriate material.
 */

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { searchYouTubeVideos, YouTubeVideoResult } from '../services/youtubeService';

// Icons
const IconSearch = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const IconX = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconPlay = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

const IconClock = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const IconSubtitles = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
    </svg>
);

const IconStar = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const IconLoader = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
);

interface YouTubeSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectVideo: (video: YouTubeVideoResult) => void;
    gradeLevel: string;
    subject?: string;
    initialQuery?: string;
}

const YouTubeSearchModal: React.FC<YouTubeSearchModalProps> = ({
    isOpen,
    onClose,
    onSelectVideo,
    gradeLevel,
    subject,
    initialQuery = ''
}) => {
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [videos, setVideos] = useState<YouTubeVideoResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
    const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await searchYouTubeVideos({
                topic: searchQuery,
                gradeLevel,
                language: 'he',
                maxResults: 6,
                requireCaptions: true,
                educationalOnly: true
            });

            if (response.success) {
                setVideos(response.videos);
                if (response.videos.length === 0) {
                    setError('לא נמצאו סרטונים מתאימים. נסה מילות חיפוש אחרות.');
                }
            } else {
                setError('חיפוש נכשל. אנא נסה שנית.');
            }
        } catch (err: any) {
            setError(err.message || 'שגיאה בחיפוש');
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, gradeLevel]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSelectVideo = (video: YouTubeVideoResult) => {
        setSelectedVideoId(video.videoId);
        onSelectVideo(video);
        onClose();
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    const formatViewCount = (count: string) => {
        const num = parseInt(count);
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
        return count;
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-l from-red-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                            <IconPlay className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">חיפוש סרטון YouTube</h2>
                            <p className="text-sm text-gray-500">סרטונים חינוכיים מותאמים ל{gradeLevel}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <IconX className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={`חפש סרטון בנושא ${subject || 'הנושא'}...`}
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                                autoFocus
                            />
                            <IconSearch className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading || !searchQuery.trim()}
                            className="px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <IconLoader className="w-5 h-5 animate-spin" />
                                    מחפש...
                                </>
                            ) : (
                                <>
                                    <IconSearch className="w-5 h-5" />
                                    חפש
                                </>
                            )}
                        </button>
                    </div>

                    {/* Filters Info */}
                    <div className="flex gap-2 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-gray-200">
                            <IconSubtitles className="w-3 h-3" /> עברית/כתוביות
                        </span>
                        <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-gray-200">
                            <IconCheck className="w-3 h-3 text-green-500" /> חיפוש בטוח
                        </span>
                        <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-gray-200">
                            <IconClock className="w-3 h-3" /> 1-20 דקות
                        </span>
                    </div>
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-y-auto p-4">
                    {error && (
                        <div className="text-center py-8 text-gray-500">
                            <p className="text-red-500 mb-2">{error}</p>
                            <p className="text-sm">טיפ: נסה לחפש במילים פשוטות יותר או בעברית</p>
                        </div>
                    )}

                    {!isLoading && videos.length === 0 && !error && (
                        <div className="text-center py-16 text-gray-500">
                            <IconPlay className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">חפש סרטון חינוכי</p>
                            <p className="text-sm mt-2">הקלד נושא והמערכת תמצא סרטונים מתאימים לשכבת הגיל</p>
                        </div>
                    )}

                    {/* Video Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {videos.map((video) => (
                            <div
                                key={video.videoId}
                                className={`bg-white rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg cursor-pointer ${selectedVideoId === video.videoId
                                        ? 'border-red-500 ring-2 ring-red-200'
                                        : 'border-gray-200 hover:border-red-300'
                                    }`}
                                onClick={() => setPreviewVideoId(previewVideoId === video.videoId ? null : video.videoId)}
                            >
                                {/* Thumbnail / Preview */}
                                <div className="relative aspect-video bg-gray-100">
                                    {previewVideoId === video.videoId ? (
                                        <iframe
                                            src={`${video.embedUrl}?autoplay=1&rel=0`}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    ) : (
                                        <>
                                            <img
                                                src={video.thumbnailUrl}
                                                alt={video.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                                                <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                                                    <IconPlay className="w-6 h-6 text-white mr-[-2px]" />
                                                </div>
                                            </div>
                                            {/* Duration Badge */}
                                            <span className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                                                {video.duration}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="font-medium text-gray-800 line-clamp-2 text-sm mb-1">
                                        {video.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-2">{video.channelTitle}</p>

                                    {/* Scores & Meta */}
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className={`flex items-center gap-1 ${getScoreColor(video.relevanceScore)}`}>
                                                <IconStar className="w-3 h-3" />
                                                {video.relevanceScore}%
                                            </span>
                                            {video.hasCaptions && (
                                                <span className="flex items-center gap-1 text-blue-600">
                                                    <IconSubtitles className="w-3 h-3" />
                                                    כתוביות
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-gray-400">{formatViewCount(video.viewCount)} צפיות</span>
                                    </div>

                                    {/* Select Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectVideo(video);
                                        }}
                                        className="w-full mt-3 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <IconCheck className="w-4 h-4" />
                                        בחר סרטון זה
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 text-center text-xs text-gray-500">
                    הסרטונים עברו סינון אוטומטי לתוכן בטוח וחינוכי בלבד
                </div>
            </div>
        </div>,
        document.body
    );
};

export default YouTubeSearchModal;
