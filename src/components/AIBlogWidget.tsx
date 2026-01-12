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
    IconRefresh,
    IconLanguage
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
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-14 h-14 min-w-[56px] min-h-[56px] bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <IconBulb className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">חדשות AI</h3>
                        <p className="text-xs text-slate-400">מתעדכן שבועית</p>
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

    // Compact mode - single article card (newsletter style)
    if (compact) {
        return (
            <div className="card-glass rounded-2xl p-5">
                {/* Header - Subtle */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-14 h-14 min-w-[56px] min-h-[56px] bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <IconBulb className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">חדשות AI</h3>
                        <p className="text-xs text-slate-400">מתעדכן שבועית</p>
                    </div>
                </div>

                {articleToShow && (
                    <div className="space-y-3">
                        {/* Article Image - Smaller */}
                        {articleToShow.imageUrl && (
                            <div className="relative rounded-xl overflow-hidden">
                                <img
                                    src={articleToShow.imageUrl}
                                    alt={articleToShow.title}
                                    className="w-full h-32 object-cover"
                                />
                                <div className="absolute top-2 right-2">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryStyle(articleToShow.category).color}`}>
                                        {getCategoryStyle(articleToShow.category).icon} {articleToShow.categoryLabel}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* No image - compact category */}
                        {!articleToShow.imageUrl && (
                            <div className="flex items-center justify-between">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryStyle(articleToShow.category).color}`}>
                                    {getCategoryStyle(articleToShow.category).icon} {articleToShow.categoryLabel}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                    <IconClock className="w-3 h-3" />
                                    {articleToShow.readingTime} דק׳
                                </span>
                            </div>
                        )}

                        {/* Title */}
                        <h4 className="font-bold text-slate-800 text-base leading-snug">
                            {articleToShow.title}
                        </h4>

                        {/* Key Insights - 2-3 compact insights */}
                        {articleToShow.keyPoints && articleToShow.keyPoints.length > 0 && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                <h5 className="font-semibold text-slate-600 text-xs mb-2">תובנות מרכזיות</h5>
                                <ul className="space-y-1.5">
                                    {articleToShow.keyPoints.slice(0, 3).map((point, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                            <span className="flex-shrink-0 w-5 h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-medium text-xs">
                                                {idx + 1}
                                            </span>
                                            <span className="leading-snug">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Summary - smaller */}
                        <p className="text-slate-500 text-sm leading-relaxed">
                            {articleToShow.summary}
                        </p>

                        {/* Classroom Tips - compact */}
                        {articleToShow.classroomTips && articleToShow.classroomTips.length > 0 && (
                            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
                                <h5 className="font-semibold text-blue-700 text-xs mb-2">💡 לכיתה</h5>
                                <ul className="space-y-1">
                                    {articleToShow.classroomTips.slice(0, 2).map((tip, idx) => (
                                        <li key={idx} className="text-sm text-slate-600">
                                            {idx + 1}. {tip}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Footer - compact */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <span className="text-xs text-slate-400">
                                {articleToShow.sourceName}
                            </span>
                            <div className="flex items-center gap-2">
                                <a
                                    href={`https://translate.google.com/translate?sl=en&tl=he&u=${encodeURIComponent(articleToShow.originalUrl)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-xs"
                                    title="תרגום לעברית"
                                >
                                    <IconLanguage className="w-4 h-4" />
                                </a>
                                <a
                                    href={articleToShow.originalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                >
                                    קראו עוד
                                    <IconExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Full mode - multiple articles with expandable details
    return (
        <div className="card-glass rounded-2xl p-5 h-full">
            {/* Header - Subtle */}
            <div className="flex items-center gap-2 mb-4">
                <div className="w-14 h-14 min-w-[56px] min-h-[56px] bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg">
                    <IconBulb className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h2 className="font-bold text-slate-800 dark:text-white">חדשות AI</h2>
                    <p className="text-xs text-slate-400">מתעדכן שבועית</p>
                </div>
            </div>

            {/* Featured Article */}
            {articleToShow && (
                <div
                    className={`bg-slate-50 rounded-xl overflow-hidden mb-3 cursor-pointer transition-all ${
                        expandedArticle === articleToShow.id ? 'ring-1 ring-slate-300' : 'hover:bg-slate-100'
                    }`}
                    onClick={() => setExpandedArticle(
                        expandedArticle === articleToShow.id ? null : articleToShow.id
                    )}
                >
                    {/* Article Image */}
                    {articleToShow.imageUrl && (
                        <div className="relative">
                            <img
                                src={articleToShow.imageUrl}
                                alt={articleToShow.title}
                                className="w-full h-28 object-cover"
                            />
                            <div className="absolute top-2 right-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryStyle(articleToShow.category).color}`}>
                                    {getCategoryStyle(articleToShow.category).icon} {articleToShow.categoryLabel}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="p-3">
                        {/* Category & Meta (when no image) */}
                        {!articleToShow.imageUrl && (
                            <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryStyle(articleToShow.category).color}`}>
                                    {getCategoryStyle(articleToShow.category).icon} {articleToShow.categoryLabel}
                                </span>
                                <span className="text-xs text-slate-400">{formatDate(articleToShow.createdAt)}</span>
                            </div>
                        )}

                        {/* Title */}
                        <h3 className="font-bold text-sm text-slate-800 mb-2 leading-snug">
                            {articleToShow.title}
                        </h3>

                        {/* Key Insights Preview */}
                        {articleToShow.keyPoints && articleToShow.keyPoints.length > 0 && (
                            <div className="bg-white rounded-lg p-2 mb-2 border border-slate-100">
                                <ul className="space-y-1">
                                    {articleToShow.keyPoints.slice(0, 2).map((point, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                            <span className="flex-shrink-0 w-4 h-4 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center font-medium text-[10px]">
                                                {idx + 1}
                                            </span>
                                            <span className="leading-snug">{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Expanded Content */}
                        {expandedArticle === articleToShow.id && (
                            <div className="space-y-2 animate-fadeIn">
                                {/* Summary */}
                                <p className="text-slate-500 text-xs leading-relaxed">
                                    {articleToShow.summary}
                                </p>

                                {/* Remaining Key Points */}
                                {articleToShow.keyPoints && articleToShow.keyPoints.length > 2 && (
                                    <ul className="space-y-1">
                                        {articleToShow.keyPoints.slice(2).map((point, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                                <IconCheck className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {/* Classroom Tips */}
                                {articleToShow.classroomTips && articleToShow.classroomTips.length > 0 && (
                                    <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100">
                                        <h4 className="font-semibold text-blue-700 text-xs mb-1">💡 לכיתה</h4>
                                        <ul className="space-y-0.5">
                                            {articleToShow.classroomTips.slice(0, 2).map((tip, idx) => (
                                                <li key={idx} className="text-xs text-slate-600">
                                                    {idx + 1}. {tip}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <span className="text-xs text-slate-400">{articleToShow.sourceName}</span>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={`https://translate.google.com/translate?sl=en&tl=he&u=${encodeURIComponent(articleToShow.originalUrl)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-400 hover:text-slate-600"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <IconLanguage className="w-4 h-4" />
                                        </a>
                                        <a
                                            href={articleToShow.originalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 bg-slate-700 text-white px-2 py-1 rounded text-xs font-medium hover:bg-slate-800"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            קראו עוד
                                            <IconExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Collapse/Expand indicator */}
                        {expandedArticle !== articleToShow.id && (
                            <div className="flex items-center justify-center text-slate-400 text-xs mt-1">
                                <span>לחצו לפרטים</span>
                                <IconChevronLeft className="w-3 h-3 rotate-90" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* More Articles (if any) */}
            {articles.length > 1 && (
                <div className="space-y-2">
                    {articles.slice(1).map((article) => (
                        <div
                            key={article.id}
                            className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() => setExpandedArticle(
                                expandedArticle === article.id ? null : article.id
                            )}
                        >
                            {article.imageUrl ? (
                                <img src={article.imageUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                            ) : (
                                <span className={`w-8 h-8 rounded flex items-center justify-center text-sm ${getCategoryStyle(article.category).color}`}>
                                    {getCategoryStyle(article.category).icon}
                                </span>
                            )}
                            <div className="flex-grow min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{article.title}</p>
                                <p className="text-[10px] text-slate-400">{article.sourceName}</p>
                            </div>
                            <IconChevronLeft className="w-3 h-3 text-slate-300" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIBlogWidget;
