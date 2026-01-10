/**
 * AI Blog Widget
 * Displays curated AI/EdTech articles with practical classroom tips
 */

import { useState, useEffect } from 'react';
import {
    IconExternalLink,
    IconClock,
    IconBulb,
    IconChevronLeft,
    IconCheck,
    IconBookmark,
    IconRefresh
} from '@tabler/icons-react';
import { getBlogArticles, getFeaturedArticle, triggerBlogGeneration, BLOG_CATEGORIES, type AIBlogArticle } from '../services/aiBlogService';

interface AIBlogWidgetProps {
    maxItems?: number;
    showFeatured?: boolean;
    compact?: boolean;
}

const AIBlogWidget: React.FC<AIBlogWidgetProps> = ({
    maxItems = 3,
    showFeatured = true,
    compact = false
}) => {
    const [articles, setArticles] = useState<AIBlogArticle[]>([]);
    const [featuredArticle, setFeaturedArticle] = useState<AIBlogArticle | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);

    const handleGenerateArticles = async () => {
        setGenerating(true);
        try {
            // Force regenerate to get fresh articles with complete content
            const result = await triggerBlogGeneration(true);
            console.log('Blog generation result:', result);
            // Refresh articles after generation
            const items = await getBlogArticles(maxItems);
            setArticles(items);
            if (showFeatured) {
                const featured = await getFeaturedArticle();
                setFeaturedArticle(featured);
            }
        } catch (err) {
            console.error('Error generating articles:', err);
        } finally {
            setGenerating(false);
        }
    };

    useEffect(() => {
        const fetchArticles = async () => {
            setLoading(true);
            try {
                if (showFeatured) {
                    const featured = await getFeaturedArticle();
                    setFeaturedArticle(featured);
                }
                const items = await getBlogArticles(maxItems);
                // Filter out featured from regular list if showing featured separately
                const filteredItems = showFeatured && featuredArticle
                    ? items.filter(a => a.id !== featuredArticle?.id)
                    : items;
                setArticles(filteredItems.slice(0, maxItems));
            } catch (err) {
                console.error('Error fetching blog articles:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, [maxItems, showFeatured]);

    const formatDate = (timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
    };

    const getCategoryStyle = (category: AIBlogArticle['category']) => {
        return BLOG_CATEGORIES[category] || BLOG_CATEGORIES.tip;
    };

    if (loading) {
        return (
            <div className="card-glass rounded-3xl p-6 h-full">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-32 bg-slate-100 rounded-xl"></div>
                    <div className="h-20 bg-slate-100 rounded-xl"></div>
                </div>
            </div>
        );
    }

    // No articles yet
    if (!featuredArticle && articles.length === 0) {
        return (
            <div className="card-glass rounded-3xl p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                        <IconBulb className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">תובנות AI למורים</h3>
                        <p className="text-xs text-slate-500">מאמרים מעשיים לכיתה</p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <IconBookmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">מאמרים בקרוב</p>
                    <p className="text-slate-400 text-xs mb-4">מאמר חדש כל שבוע</p>

                    {/* Admin button to generate first articles */}
                    <button
                        onClick={handleGenerateArticles}
                        disabled={generating}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
                    >
                        <IconRefresh className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                        {generating ? 'מייצר מאמרים...' : 'צור מאמרים עכשיו'}
                    </button>
                </div>
            </div>
        );
    }

    const articleToShow = featuredArticle || articles[0];

    // Compact mode - single article card (expanded view)
    if (compact) {
        return (
            <div className="card-glass rounded-3xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-wizdi-royal to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                            <IconBulb className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white">תובנות AI למורים</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">מאמר השבוע • מתעדכן כל יום ראשון</p>
                        </div>
                    </div>
                </div>

                {articleToShow && (
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                        {/* Category badge & meta */}
                        <div className="flex items-center justify-between mb-3">
                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${getCategoryStyle(articleToShow.category).color}`}>
                                {getCategoryStyle(articleToShow.category).icon} {articleToShow.categoryLabel}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                                <IconClock className="w-3.5 h-3.5" />
                                {articleToShow.readingTime} דק׳ קריאה
                            </span>
                        </div>

                        {/* Title */}
                        <h4 className="font-bold text-slate-800 text-lg mb-3 leading-tight">
                            {articleToShow.title}
                        </h4>

                        {/* Summary - full text */}
                        <p className="text-slate-600 text-sm leading-relaxed mb-4">
                            {articleToShow.summary}
                        </p>

                        {/* Key Points */}
                        {articleToShow.keyPoints && articleToShow.keyPoints.length > 0 && (
                            <div className="bg-white/80 rounded-xl p-4 mb-4">
                                <h5 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                    📌 נקודות מפתח
                                </h5>
                                <ul className="space-y-2">
                                    {articleToShow.keyPoints.map((point, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                            <IconCheck className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Classroom Tips */}
                        {articleToShow.classroomTips && articleToShow.classroomTips.length > 0 && (
                            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
                                <h5 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                    💡 איך להשתמש בזה בכיתה
                                </h5>
                                <ul className="space-y-2">
                                    {articleToShow.classroomTips.map((tip, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                            <span className="text-slate-600 font-bold min-w-[20px]">{idx + 1}.</span>
                                            <span>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Footer with source */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                            <span className="text-xs text-slate-500">
                                מקור: <span className="font-medium">{articleToShow.sourceName}</span>
                            </span>
                            <a
                                href={articleToShow.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-wizdi-royal text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                קראו את המאמר המקורי
                                <IconExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Full mode - multiple articles with expandable details
    return (
        <div className="card-glass rounded-3xl p-6 h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <IconBulb className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">תובנות AI למורים</h2>
                        <p className="text-sm text-slate-500">מאמרים מעשיים לכיתה • מתעדכן שבועית</p>
                    </div>
                </div>
            </div>

            {/* Featured Article */}
            {articleToShow && (
                <div
                    className={`bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 mb-4 cursor-pointer transition-all ${
                        expandedArticle === articleToShow.id ? 'ring-2 ring-purple-300' : 'hover:shadow-md'
                    }`}
                    onClick={() => setExpandedArticle(
                        expandedArticle === articleToShow.id ? null : articleToShow.id
                    )}
                >
                    {/* Category & Meta */}
                    <div className="flex items-center justify-between mb-3">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getCategoryStyle(articleToShow.category).color}`}>
                            {getCategoryStyle(articleToShow.category).icon} {articleToShow.categoryLabel}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                                <IconClock className="w-3.5 h-3.5" />
                                {articleToShow.readingTime} דק׳ קריאה
                            </span>
                            <span>{formatDate(articleToShow.createdAt)}</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-lg text-slate-800 mb-2 leading-tight">
                        {articleToShow.title}
                    </h3>

                    {/* Summary */}
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                        {articleToShow.summary}
                    </p>

                    {/* Expanded Content */}
                    {expandedArticle === articleToShow.id && (
                        <div className="space-y-4 animate-fadeIn">
                            {/* Key Points */}
                            {articleToShow.keyPoints && articleToShow.keyPoints.length > 0 && (
                                <div className="bg-white/70 rounded-xl p-4">
                                    <h4 className="font-bold text-purple-700 text-sm mb-2">
                                        📌 נקודות מפתח
                                    </h4>
                                    <ul className="space-y-2">
                                        {articleToShow.keyPoints.map((point, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                                <IconCheck className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Classroom Tips */}
                            {articleToShow.classroomTips && articleToShow.classroomTips.length > 0 && (
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                    <h4 className="font-bold text-amber-700 text-sm mb-2">
                                        💡 איך להשתמש בזה בכיתה
                                    </h4>
                                    <ul className="space-y-2">
                                        {articleToShow.classroomTips.map((tip, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                                <span className="text-amber-500 font-bold">{idx + 1}.</span>
                                                {tip}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Source link */}
                            <div className="flex items-center justify-between pt-2 border-t border-purple-100">
                                <span className="text-xs text-slate-500">
                                    מקור: {articleToShow.sourceName}
                                </span>
                                <a
                                    href={articleToShow.originalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    קראו את המאמר המקורי
                                    <IconExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Collapse/Expand indicator */}
                    {expandedArticle !== articleToShow.id && (
                        <div className="flex items-center justify-center text-purple-500 text-sm font-medium">
                            <span>לחצו לפרטים מלאים</span>
                            <IconChevronLeft className="w-4 h-4 rotate-90" />
                        </div>
                    )}
                </div>
            )}

            {/* More Articles (if any) */}
            {articles.length > 1 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 mb-2">מאמרים נוספים</h4>
                    {articles.slice(1).map((article) => (
                        <div
                            key={article.id}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() => setExpandedArticle(
                                expandedArticle === article.id ? null : article.id
                            )}
                        >
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${getCategoryStyle(article.category).color}`}>
                                {getCategoryStyle(article.category).icon}
                            </span>
                            <div className="flex-grow min-w-0">
                                <p className="text-sm font-medium text-slate-700 truncate">
                                    {article.title}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {article.sourceName} • {formatDate(article.createdAt)}
                                </p>
                            </div>
                            <IconChevronLeft className="w-4 h-4 text-slate-400" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIBlogWidget;
