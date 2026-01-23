/**
 * ActivityBankBrowser - Browse and filter activities from the Activity Bank
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    IconSearch,
    IconFilter,
    IconX,
    IconRefresh,
    IconSparkles,
    IconBook,
    IconFlask,
    IconChevronDown
} from '@tabler/icons-react';
import ActivityCard from './ActivityCard';
import { getActivities, searchActivities, type BankActivity, type ActivityFilters } from '../../services/activityBankService';
import type { BloomLevel, ActivityBlockType } from '../../courseTypes';

const SUBJECTS = [
    { value: '', label: 'כל המקצועות' },
    { value: 'hebrew', label: 'עברית' },
    { value: 'science', label: 'מדעים' }
];

const GRADE_LEVELS = [
    { value: '', label: 'כל הכיתות' },
    { value: 'ה', label: "כיתה ה'" },
    { value: 'ו', label: "כיתה ו'" }
];

const BLOOM_LEVELS: { value: BloomLevel | ''; label: string }[] = [
    { value: '', label: 'כל הרמות' },
    { value: 'remember', label: 'זכירה' },
    { value: 'understand', label: 'הבנה' },
    { value: 'apply', label: 'יישום' },
    { value: 'analyze', label: 'ניתוח' },
    { value: 'evaluate', label: 'הערכה' },
    { value: 'create', label: 'יצירה' }
];

const ACTIVITY_TYPES: { value: ActivityBlockType | ''; label: string }[] = [
    { value: '', label: 'כל הסוגים' },
    { value: 'multiple-choice', label: 'רב-ברירה' },
    { value: 'fill_in_blanks', label: 'השלמת חסר' },
    { value: 'ordering', label: 'סידור' },
    { value: 'categorization', label: 'מיון' },
    { value: 'matching', label: 'התאמה' },
    { value: 'true_false', label: 'נכון/לא נכון' }
];

const QUALITY_OPTIONS = [
    { value: 0, label: 'כל הציונים' },
    { value: 80, label: 'מעולה (80+)' },
    { value: 70, label: 'טוב מאוד (70+)' },
    { value: 60, label: 'טוב (60+)' }
];

interface ActivityBankBrowserProps {
    onSelectActivity?: (activity: BankActivity) => void;
    onCopyToLesson?: (activity: BankActivity) => void;
    embedded?: boolean;
}

export default function ActivityBankBrowser({
    onSelectActivity,
    onCopyToLesson,
    embedded = false
}: ActivityBankBrowserProps) {
    const [activities, setActivities] = useState<BankActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<BankActivity | null>(null);

    // Filters
    const [filters, setFilters] = useState<ActivityFilters>({
        subject: undefined,
        gradeLevel: undefined,
        bloomLevel: undefined,
        activityType: undefined,
        minQualityScore: undefined
    });

    // Load activities
    const loadActivities = useCallback(async () => {
        setLoading(true);
        try {
            const cleanFilters: ActivityFilters = {};
            if (filters.subject) cleanFilters.subject = filters.subject;
            if (filters.gradeLevel) cleanFilters.gradeLevel = filters.gradeLevel;
            if (filters.bloomLevel) cleanFilters.bloomLevel = filters.bloomLevel;
            if (filters.activityType) cleanFilters.activityType = filters.activityType;
            if (filters.minQualityScore) cleanFilters.minQualityScore = filters.minQualityScore;

            const result = await getActivities(cleanFilters, 50);
            setActivities(result);
        } catch (error) {
            console.error('Error loading activities:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadActivities();
    }, [loadActivities]);

    // Search
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            loadActivities();
            return;
        }
        setLoading(true);
        try {
            const result = await searchActivities(searchQuery);
            setActivities(result);
        } catch (error) {
            console.error('Error searching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        setFilters({});
        setSearchQuery('');
    };

    const hasActiveFilters = Object.values(filters).some(v => v) || searchQuery;

    const handlePreview = (activity: BankActivity) => {
        setSelectedActivity(activity);
        onSelectActivity?.(activity);
    };

    return (
        <div className={`${embedded ? '' : 'max-w-7xl mx-auto p-6'}`}>
            {/* Header */}
            {!embedded && (
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                            <IconSparkles size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">מאגר פעילויות</h1>
                            <p className="text-gray-500">פעילויות איכותיות שנוצרו אוטומטית לפי תוכנית הלימודים</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                {/* Search Bar */}
                <div className="flex gap-3 mb-4">
                    <div className="flex-1 relative">
                        <IconSearch size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="חיפוש פעילויות..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                        חיפוש
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2.5 border rounded-lg transition-colors font-medium flex items-center gap-2 ${
                            showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <IconFilter size={18} />
                        סינון
                        <IconChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="border-t border-gray-200 pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {/* Subject */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">מקצוע</label>
                                <select
                                    value={filters.subject || ''}
                                    onChange={(e) => setFilters({ ...filters, subject: e.target.value as any || undefined })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {SUBJECTS.map(s => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Grade Level */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">כיתה</label>
                                <select
                                    value={filters.gradeLevel || ''}
                                    onChange={(e) => setFilters({ ...filters, gradeLevel: e.target.value as any || undefined })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {GRADE_LEVELS.map(g => (
                                        <option key={g.value} value={g.value}>{g.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Bloom Level */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">רמת בלום</label>
                                <select
                                    value={filters.bloomLevel || ''}
                                    onChange={(e) => setFilters({ ...filters, bloomLevel: e.target.value as any || undefined })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {BLOOM_LEVELS.map(b => (
                                        <option key={b.value} value={b.value}>{b.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Activity Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">סוג פעילות</label>
                                <select
                                    value={filters.activityType || ''}
                                    onChange={(e) => setFilters({ ...filters, activityType: e.target.value as any || undefined })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {ACTIVITY_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Quality Score */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ציון איכות</label>
                                <select
                                    value={filters.minQualityScore || 0}
                                    onChange={(e) => setFilters({ ...filters, minQualityScore: Number(e.target.value) || undefined })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                >
                                    {QUALITY_OPTIONS.map(q => (
                                        <option key={q.value} value={q.value}>{q.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Clear Filters */}
                        {hasActiveFilters && (
                            <div className="mt-4 flex items-center gap-2">
                                <button
                                    onClick={clearFilters}
                                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                                >
                                    <IconX size={16} />
                                    נקה את כל הסינונים
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-gray-600">
                    {loading ? 'טוען...' : `${activities.length} פעילויות נמצאו`}
                </p>
                <button
                    onClick={loadActivities}
                    disabled={loading}
                    className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 text-sm"
                >
                    <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
                    רענון
                </button>
            </div>

            {/* Activities Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                            <div className="h-6 bg-gray-200 rounded w-2/3 mb-4" />
                            <div className="flex gap-2 mb-3">
                                <div className="h-6 bg-gray-200 rounded-full w-16" />
                                <div className="h-6 bg-gray-200 rounded-full w-20" />
                            </div>
                            <div className="h-16 bg-gray-100 rounded" />
                        </div>
                    ))}
                </div>
            ) : activities.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IconSearch size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">לא נמצאו פעילויות</h3>
                    <p className="text-gray-500 mb-4">נסה לשנות את הסינון או לחפש משהו אחר</p>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            נקה סינונים
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activities.map(activity => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onPreview={handlePreview}
                            onCopyToLesson={onCopyToLesson}
                        />
                    ))}
                </div>
            )}

            {/* Activity Preview Modal */}
            {selectedActivity && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">תצוגה מקדימה</h2>
                            <button
                                onClick={() => setSelectedActivity(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <IconX size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <ActivityCard
                                activity={selectedActivity}
                                onCopyToLesson={(activity) => {
                                    onCopyToLesson?.(activity);
                                    setSelectedActivity(null);
                                }}
                            />
                            {/* Activity Content Preview */}
                            <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                                <h4 className="font-medium text-gray-900 mb-3">תוכן הפעילות:</h4>
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                                    {JSON.stringify(selectedActivity.content, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
