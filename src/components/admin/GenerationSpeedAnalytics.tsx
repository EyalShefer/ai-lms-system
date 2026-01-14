import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
    IconChartBar,
    IconClock,
    IconRefresh,
    IconChevronDown,
    IconChevronUp,
    IconFileText,
    IconVideo,
    IconBook,
    IconClipboard,
    IconPlayerPlay,
    IconFilter,
    IconCalendar,
} from '@tabler/icons-react';

// Types for generation timing data
export interface GenerationTiming {
    id: string;
    userId: string;
    userEmail?: string;
    courseId: string;
    unitId: string;
    productType: 'lesson' | 'activity' | 'exam' | 'podcast';
    sourceType: 'text' | 'youtube' | 'pdf' | 'url' | 'manual';
    sourceLength: number; // characters or duration
    stepCount: number;

    // Timing breakdown (in milliseconds)
    timings: {
        total: number;
        skeleton: number;
        contentGeneration: number; // All steps combined (parallel)
        perStepAverage: number;
        imageGeneration?: number;
        enrichment?: number;
    };

    // Metadata
    createdAt: Timestamp;
    success: boolean;
    errorMessage?: string;
    model?: string; // e.g., 'gemini-3-pro-preview'
}

interface GenerationSpeedAnalyticsProps {
    className?: string;
}

// Product type labels and colors
const PRODUCT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    lesson: { label: 'מערך שיעור', color: 'bg-blue-100 text-blue-700', icon: <IconBook size={16} /> },
    activity: { label: 'פעילות לתלמיד', color: 'bg-green-100 text-green-700', icon: <IconPlayerPlay size={16} /> },
    exam: { label: 'מבחן', color: 'bg-purple-100 text-purple-700', icon: <IconClipboard size={16} /> },
    podcast: { label: 'פודקאסט', color: 'bg-amber-100 text-amber-700', icon: <IconPlayerPlay size={16} /> },
};

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    text: { label: 'טקסט', color: 'bg-slate-100 text-slate-700', icon: <IconFileText size={16} /> },
    youtube: { label: 'YouTube', color: 'bg-red-100 text-red-700', icon: <IconVideo size={16} /> },
    pdf: { label: 'PDF', color: 'bg-orange-100 text-orange-700', icon: <IconFileText size={16} /> },
    url: { label: 'URL', color: 'bg-cyan-100 text-cyan-700', icon: <IconFileText size={16} /> },
    manual: { label: 'ידני', color: 'bg-gray-100 text-gray-700', icon: <IconFileText size={16} /> },
};

// Helper to format duration
const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toFixed(0).padStart(2, '0')}`;
};

// Helper to get speed rating
const getSpeedRating = (totalMs: number, productType: string): { label: string; color: string } => {
    // Different thresholds per product type (in seconds)
    const thresholds: Record<string, { fast: number; medium: number }> = {
        lesson: { fast: 30, medium: 60 },
        activity: { fast: 25, medium: 45 },
        exam: { fast: 40, medium: 70 },
        podcast: { fast: 20, medium: 40 },
    };

    const threshold = thresholds[productType] || thresholds.lesson;
    const seconds = totalMs / 1000;

    if (seconds <= threshold.fast) return { label: 'מהיר', color: 'bg-green-100 text-green-700' };
    if (seconds <= threshold.medium) return { label: 'סביר', color: 'bg-amber-100 text-amber-700' };
    return { label: 'איטי', color: 'bg-red-100 text-red-700' };
};

export const GenerationSpeedAnalytics: React.FC<GenerationSpeedAnalyticsProps> = ({ className = '' }) => {
    const { isAdmin } = useAuth();
    const [timings, setTimings] = useState<GenerationTiming[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterProductType, setFilterProductType] = useState<string>('all');
    const [filterSourceType, setFilterSourceType] = useState<string>('all');
    const [filterDays, setFilterDays] = useState<number>(7);

    // Sorting
    const [sortField, setSortField] = useState<'createdAt' | 'total' | 'productType'>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const fetchData = async () => {
        if (!isAdmin) return;

        setLoading(true);
        setError(null);

        try {
            const timingsRef = collection(db, 'generationTimings');
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - filterDays);

            const q = query(
                timingsRef,
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                orderBy('createdAt', 'desc'),
                limit(500)
            );

            const snapshot = await getDocs(q);
            const data: GenerationTiming[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as GenerationTiming));

            setTimings(data);
        } catch (err: any) {
            console.error('Error fetching timing data:', err);
            setError(err.message || 'שגיאה בטעינת נתונים');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isAdmin, filterDays]);

    // Filter and sort data
    const filteredTimings = useMemo(() => {
        let result = [...timings];

        if (filterProductType !== 'all') {
            result = result.filter(t => t.productType === filterProductType);
        }

        if (filterSourceType !== 'all') {
            result = result.filter(t => t.sourceType === filterSourceType);
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'createdAt') {
                comparison = a.createdAt.seconds - b.createdAt.seconds;
            } else if (sortField === 'total') {
                comparison = a.timings.total - b.timings.total;
            } else if (sortField === 'productType') {
                comparison = a.productType.localeCompare(b.productType);
            }
            return sortDirection === 'desc' ? -comparison : comparison;
        });

        return result;
    }, [timings, filterProductType, filterSourceType, sortField, sortDirection]);

    // Calculate statistics per product type
    const statistics = useMemo(() => {
        const stats: Record<string, {
            count: number;
            avgTotal: number;
            avgSkeleton: number;
            avgContent: number;
            minTotal: number;
            maxTotal: number;
            successRate: number;
        }> = {};

        const productTypes = ['lesson', 'activity', 'exam', 'podcast'];

        productTypes.forEach(type => {
            const typeTimings = timings.filter(t => t.productType === type);
            if (typeTimings.length === 0) {
                stats[type] = {
                    count: 0,
                    avgTotal: 0,
                    avgSkeleton: 0,
                    avgContent: 0,
                    minTotal: 0,
                    maxTotal: 0,
                    successRate: 0,
                };
                return;
            }

            const totals = typeTimings.map(t => t.timings.total);
            const skeletons = typeTimings.map(t => t.timings.skeleton);
            const contents = typeTimings.map(t => t.timings.contentGeneration);
            const successCount = typeTimings.filter(t => t.success).length;

            stats[type] = {
                count: typeTimings.length,
                avgTotal: totals.reduce((a, b) => a + b, 0) / totals.length,
                avgSkeleton: skeletons.reduce((a, b) => a + b, 0) / skeletons.length,
                avgContent: contents.reduce((a, b) => a + b, 0) / contents.length,
                minTotal: Math.min(...totals),
                maxTotal: Math.max(...totals),
                successRate: (successCount / typeTimings.length) * 100,
            };
        });

        return stats;
    }, [timings]);

    // Statistics by source type
    const sourceStatistics = useMemo(() => {
        const stats: Record<string, { count: number; avgTotal: number }> = {};

        const sourceTypes = ['text', 'youtube', 'pdf', 'url', 'manual'];

        sourceTypes.forEach(type => {
            const typeTimings = timings.filter(t => t.sourceType === type);
            if (typeTimings.length === 0) {
                stats[type] = { count: 0, avgTotal: 0 };
                return;
            }

            const totals = typeTimings.map(t => t.timings.total);
            stats[type] = {
                count: typeTimings.length,
                avgTotal: totals.reduce((a, b) => a + b, 0) / totals.length,
            };
        });

        return stats;
    }, [timings]);

    const handleSort = (field: 'createdAt' | 'total' | 'productType') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    if (!isAdmin) {
        return (
            <div className="p-8 text-center" dir="rtl">
                <IconChartBar size={48} className="mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-bold text-gray-700">גישה מוגבלת</h2>
                <p className="text-gray-500">עמוד זה זמין למנהלי מערכת בלבד</p>
            </div>
        );
    }

    return (
        <div className={`p-6 ${className}`} dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <IconClock size={28} />
                        ניתוח מהירות יצירת תוכן
                    </h1>
                    <p className="text-gray-500 mt-1">מעקב אחר זמני יצירת תכנים לפי סוג מוצר ומקור</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                    <IconRefresh size={18} className={loading ? 'animate-spin' : ''} />
                    רענן
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <IconFilter size={18} className="text-gray-500" />
                    <span className="text-gray-600 font-medium">סינון:</span>
                </div>

                <select
                    value={filterProductType}
                    onChange={(e) => setFilterProductType(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white text-gray-700"
                >
                    <option value="all">כל סוגי התוצרים</option>
                    <option value="lesson">מערך שיעור</option>
                    <option value="activity">פעילות לתלמיד</option>
                    <option value="exam">מבחן</option>
                    <option value="podcast">פודקאסט</option>
                </select>

                <select
                    value={filterSourceType}
                    onChange={(e) => setFilterSourceType(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white text-gray-700"
                >
                    <option value="all">כל סוגי המקורות</option>
                    <option value="text">טקסט</option>
                    <option value="youtube">YouTube</option>
                    <option value="pdf">PDF</option>
                    <option value="url">URL</option>
                    <option value="manual">ידני</option>
                </select>

                <div className="flex items-center gap-2">
                    <IconCalendar size={18} className="text-gray-500" />
                    <select
                        value={filterDays}
                        onChange={(e) => setFilterDays(Number(e.target.value))}
                        className="px-3 py-2 border rounded-lg bg-white text-gray-700"
                    >
                        <option value={1}>יום אחרון</option>
                        <option value={7}>7 ימים אחרונים</option>
                        <option value={30}>30 ימים אחרונים</option>
                        <option value={90}>90 ימים אחרונים</option>
                    </select>
                </div>
            </div>

            {/* Statistics Cards - By Product Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {Object.entries(PRODUCT_TYPE_CONFIG).map(([type, config]) => {
                    const stat = statistics[type];
                    if (!stat) return null;

                    return (
                        <div key={type} className="bg-white rounded-xl shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className={`p-2 rounded-lg ${config.color}`}>
                                    {config.icon}
                                </div>
                                <h3 className="font-semibold text-gray-700">{config.label}</h3>
                            </div>

                            {stat.count > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 text-sm">כמות:</span>
                                        <span className="font-medium">{stat.count}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 text-sm">ממוצע:</span>
                                        <span className="font-medium text-indigo-600">{formatDuration(stat.avgTotal)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 text-sm">טווח:</span>
                                        <span className="font-medium text-xs">
                                            {formatDuration(stat.minTotal)} - {formatDuration(stat.maxTotal)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 text-sm">הצלחה:</span>
                                        <span className={`font-medium ${stat.successRate >= 90 ? 'text-green-600' : 'text-amber-600'}`}>
                                            {stat.successRate.toFixed(0)}%
                                        </span>
                                    </div>

                                    {/* Timing breakdown bar */}
                                    <div className="mt-3 pt-3 border-t">
                                        <div className="text-xs text-gray-500 mb-1">פירוט זמנים:</div>
                                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                                            <div
                                                className="bg-blue-500 h-full"
                                                style={{ width: `${(stat.avgSkeleton / stat.avgTotal) * 100}%` }}
                                                title={`שלד: ${formatDuration(stat.avgSkeleton)}`}
                                            />
                                            <div
                                                className="bg-green-500 h-full"
                                                style={{ width: `${(stat.avgContent / stat.avgTotal) * 100}%` }}
                                                title={`תוכן: ${formatDuration(stat.avgContent)}`}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-blue-600">שלד</span>
                                            <span className="text-green-600">תוכן</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400 text-sm">אין נתונים</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Statistics by Source Type */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">זמנים לפי סוג מקור</h3>
                <div className="flex flex-wrap gap-4">
                    {Object.entries(SOURCE_TYPE_CONFIG).map(([type, config]) => {
                        const stat = sourceStatistics[type];
                        if (!stat || stat.count === 0) return null;

                        return (
                            <div key={type} className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
                                <div className={`p-1.5 rounded ${config.color}`}>
                                    {config.icon}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-700">{config.label}</div>
                                    <div className="text-xs text-gray-500">
                                        {stat.count} יצירות | ממוצע: {formatDuration(stat.avgTotal)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">
                    {error}
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th
                                    className="px-4 py-3 text-right text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('createdAt')}
                                >
                                    <div className="flex items-center gap-1">
                                        תאריך
                                        {sortField === 'createdAt' && (
                                            sortDirection === 'desc' ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('productType')}
                                >
                                    <div className="flex items-center gap-1">
                                        סוג תוצר
                                        {sortField === 'productType' && (
                                            sortDirection === 'desc' ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                                    מקור
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                                    שלבים
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-sm font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('total')}
                                >
                                    <div className="flex items-center gap-1">
                                        זמן כולל
                                        {sortField === 'total' && (
                                            sortDirection === 'desc' ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                                    שלד
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                                    תוכן
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                                    דירוג
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">
                                    סטטוס
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                        <IconRefresh size={24} className="animate-spin mx-auto mb-2" />
                                        טוען נתונים...
                                    </td>
                                </tr>
                            ) : filteredTimings.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                                        <IconChartBar size={32} className="mx-auto mb-2 text-gray-300" />
                                        אין נתונים להצגה
                                        <p className="text-sm mt-1">נתוני הזמנים יתחילו להיאסף לאחר יצירת תכנים חדשים</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTimings.map((timing) => {
                                    const productConfig = PRODUCT_TYPE_CONFIG[timing.productType] || PRODUCT_TYPE_CONFIG.lesson;
                                    const sourceConfig = SOURCE_TYPE_CONFIG[timing.sourceType] || SOURCE_TYPE_CONFIG.text;
                                    const speedRating = getSpeedRating(timing.timings.total, timing.productType);

                                    return (
                                        <tr key={timing.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {timing.createdAt?.toDate?.()?.toLocaleDateString('he-IL', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                }) || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${productConfig.color}`}>
                                                    {productConfig.icon}
                                                    {productConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${sourceConfig.color}`}>
                                                    {sourceConfig.icon}
                                                    {sourceConfig.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {timing.stepCount}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-indigo-600">
                                                {formatDuration(timing.timings.total)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {formatDuration(timing.timings.skeleton)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {formatDuration(timing.timings.contentGeneration)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${speedRating.color}`}>
                                                    {speedRating.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {timing.success ? (
                                                    <span className="text-green-600">✓</span>
                                                ) : (
                                                    <span className="text-red-600" title={timing.errorMessage}>✗</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer with count */}
                <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
                    מציג {filteredTimings.length} מתוך {timings.length} רשומות
                </div>
            </div>

            {/* Gemini Model Info */}
            <div className="mt-6 bg-indigo-50 rounded-xl p-4">
                <h3 className="font-semibold text-indigo-800 mb-2">מידע על המודל</h3>
                <p className="text-sm text-indigo-700">
                    המערכת משתמשת ב-<strong>Gemini 3 Pro</strong> (<code>gemini-3-pro-preview</code>) ליצירת טקסט.
                </p>
                <p className="text-sm text-indigo-600 mt-1">
                    תמונות: <code>gemini-3-pro-image-preview</code>
                </p>
            </div>
        </div>
    );
};

export default GenerationSpeedAnalytics;
