/**
 * AI News Widget
 * Displays AI/EdTech news in Hebrew for teachers
 */

import { useState, useEffect } from 'react';
import { IconNews, IconExternalLink, IconRefresh, IconSparkles } from '@tabler/icons-react';
import { getAINews, type AINewsItem } from '../services/aiNewsService';

interface AINewsWidgetProps {
    maxItems?: number;
    showRefreshButton?: boolean;
}

const AINewsWidget: React.FC<AINewsWidgetProps> = ({
    maxItems = 3,
    showRefreshButton = true
}) => {
    const [news, setNews] = useState<AINewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Helper: Check if text contains Hebrew characters
    const hasHebrew = (text: string): boolean => {
        return /[\u0590-\u05FF]/.test(text);
    };

    // Filter to only show items with Hebrew content
    const filterHebrewOnly = (items: AINewsItem[]): AINewsItem[] => {
        return items.filter(item =>
            hasHebrew(item.hebrewTitle) && hasHebrew(item.hebrewSummary)
        );
    };

    const fetchNews = async () => {
        setLoading(true);
        setError(null);

        try {
            const newsItems = await getAINews(maxItems + 5); // Fetch extra in case some are filtered out

            // Filter only Hebrew content
            const hebrewNews = filterHebrewOnly(newsItems).slice(0, maxItems);
            setNews(hebrewNews);
        } catch (err) {
            console.error('Error fetching news:', err);
            setNews([]);
            setError('שגיאה בטעינת חדשות');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, [maxItems]);

    const formatTimeAgo = (timestamp: any): string => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'עכשיו';
        if (diffHours < 24) return `לפני ${diffHours} שעות`;
        if (diffDays === 1) return 'אתמול';
        if (diffDays < 7) return `לפני ${diffDays} ימים`;
        return date.toLocaleDateString('he-IL');
    };

    const getRelevanceBadge = (score: number) => {
        if (score >= 9) {
            return (
                <span className="px-2 py-0.5 bg-wizdi-lime/20 text-lime-700 text-[10px] font-bold rounded-full">
                    רלוונטי מאוד
                </span>
            );
        }
        if (score >= 7) {
            return (
                <span className="px-2 py-0.5 bg-wizdi-cyan/20 text-wizdi-cyan text-[10px] font-bold rounded-full">
                    רלוונטי
                </span>
            );
        }
        return null;
    };

    return (
        <div className="card-glass rounded-3xl p-6 h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                        <IconNews className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            חדשות AI
                            <IconSparkles className="w-4 h-4 text-wizdi-gold" />
                        </h3>
                        <p className="text-xs text-slate-500">עדכונים שימושיים למורים</p>
                    </div>
                </div>

                {showRefreshButton && (
                    <button
                        onClick={fetchNews}
                        disabled={loading}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                        title="רענן חדשות"
                    >
                        <IconRefresh className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="space-y-3">
                {loading ? (
                    // Loading skeleton
                    Array.from({ length: maxItems }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-slate-100 rounded w-full mb-1"></div>
                            <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                        </div>
                    ))
                ) : news.length === 0 ? (
                    // Empty state
                    <div className="text-center py-8">
                        <IconNews className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">אין חדשות כרגע</p>
                        <p className="text-slate-400 text-xs">נסה שוב מאוחר יותר</p>
                    </div>
                ) : (
                    // News items
                    news.map((item, index) => (
                        <a
                            key={item.id}
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 bg-slate-50 hover:bg-wizdi-cloud rounded-xl transition-all hover:shadow-md group"
                        >
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2 group-hover:text-wizdi-royal transition-colors">
                                    {item.hebrewTitle}
                                </h4>
                                <IconExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <p className="text-slate-600 text-xs leading-relaxed line-clamp-2 mb-2">
                                {item.hebrewSummary}
                            </p>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400">{item.sourceName}</span>
                                    <span className="text-[10px] text-slate-300">•</span>
                                    <span className="text-[10px] text-slate-400">{formatTimeAgo(item.publishedAt)}</span>
                                </div>
                                {getRelevanceBadge(item.relevanceScore)}
                            </div>
                        </a>
                    ))
                )}
            </div>

            {/* Footer - only show if we have news */}
            {news.length > 0 && !loading && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 text-center">
                        מתעדכן אוטומטית
                    </p>
                </div>
            )}
        </div>
    );
};

export default AINewsWidget;
