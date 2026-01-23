/**
 * ActivityCard - Display a single activity from the Activity Bank
 */
import React, { useState } from 'react';
import {
    IconStar,
    IconStarFilled,
    IconCopy,
    IconCheck,
    IconEye,
    IconBookmark,
    IconSparkles
} from '@tabler/icons-react';
import type { BankActivity } from '../../services/activityBankService';

// Bloom level colors and Hebrew names
const BLOOM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'remember': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    'understand': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    'apply': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
    'analyze': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
    'evaluate': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    'create': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' }
};

const BLOOM_HEBREW: Record<string, string> = {
    'remember': 'זכירה',
    'understand': 'הבנה',
    'apply': 'יישום',
    'analyze': 'ניתוח',
    'evaluate': 'הערכה',
    'create': 'יצירה'
};

const ACTIVITY_TYPE_HEBREW: Record<string, string> = {
    'multiple-choice': 'רב-ברירה',
    'fill_in_blanks': 'השלמת חסר',
    'ordering': 'סידור',
    'categorization': 'מיון',
    'matching': 'התאמה',
    'true_false': 'נכון/לא נכון',
    'open_question': 'שאלה פתוחה'
};

const SUBJECT_HEBREW: Record<string, string> = {
    'hebrew': 'עברית',
    'science': 'מדעים'
};

interface ActivityCardProps {
    activity: BankActivity;
    onPreview?: (activity: BankActivity) => void;
    onCopyToLesson?: (activity: BankActivity) => void;
    onRate?: (activity: BankActivity) => void;
    compact?: boolean;
}

export default function ActivityCard({
    activity,
    onPreview,
    onCopyToLesson,
    onRate,
    compact = false
}: ActivityCardProps) {
    const [copied, setCopied] = useState(false);

    const bloomColor = BLOOM_COLORS[activity.bloomLevel] || BLOOM_COLORS['understand'];
    const bloomHebrew = BLOOM_HEBREW[activity.bloomLevel] || activity.bloomLevel;
    const typeHebrew = ACTIVITY_TYPE_HEBREW[activity.activityType] || activity.activityType;
    const subjectHebrew = SUBJECT_HEBREW[activity.subject] || activity.subject;

    const handleCopy = () => {
        if (onCopyToLesson) {
            onCopyToLesson(activity);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Calculate star rating display
    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars.push(<IconStarFilled key={i} size={14} className="text-yellow-500" />);
            } else {
                stars.push(<IconStar key={i} size={14} className="text-gray-300" />);
            }
        }
        return stars;
    };

    // Quality badge color
    const getQualityBadge = (score: number) => {
        if (score >= 90) return { color: 'bg-green-500', text: 'מעולה' };
        if (score >= 80) return { color: 'bg-blue-500', text: 'טוב מאוד' };
        if (score >= 70) return { color: 'bg-yellow-500', text: 'טוב' };
        return { color: 'bg-gray-500', text: 'סביר' };
    };

    const qualityBadge = getQualityBadge(activity.qualityScore);

    if (compact) {
        // Compact view for lists
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
                 onClick={() => onPreview?.(activity)}>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate text-sm">
                            {activity.topic}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${bloomColor.bg} ${bloomColor.text}`}>
                                {bloomHebrew}
                            </span>
                            <span className="text-xs text-gray-500">{typeHebrew}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {renderStars(activity.averageRating)}
                    </div>
                </div>
            </div>
        );
    }

    // Full card view
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
            {/* Header with quality score */}
            <div className="relative bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-gray-100">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500">{subjectHebrew}</span>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-xs text-gray-500">כיתה {activity.gradeLevel}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">
                            {activity.topic}
                        </h3>
                    </div>
                    <div className={`${qualityBadge.color} text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
                        <IconSparkles size={12} />
                        {activity.qualityScore}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`text-xs px-3 py-1 rounded-full border ${bloomColor.bg} ${bloomColor.text} ${bloomColor.border}`}>
                        {bloomHebrew}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                        {typeHebrew}
                    </span>
                </div>

                {/* Learning Objectives Preview */}
                {activity.learningObjectives && activity.learningObjectives.length > 0 && (
                    <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">מטרות למידה:</p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                            {activity.learningObjectives[0]}
                        </p>
                    </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-100 pt-3 mt-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            {renderStars(activity.averageRating)}
                            <span className="text-xs mr-1">({activity.ratingCount})</span>
                        </div>
                        <span className="text-xs">
                            <IconBookmark size={14} className="inline ml-1" />
                            {activity.usageCount} שימושים
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex border-t border-gray-100">
                <button
                    onClick={() => onPreview?.(activity)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                    <IconEye size={18} />
                    תצוגה מקדימה
                </button>
                <div className="w-px bg-gray-100" />
                <button
                    onClick={handleCopy}
                    disabled={copied}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-indigo-600 hover:bg-indigo-50 transition-colors text-sm font-medium"
                >
                    {copied ? (
                        <>
                            <IconCheck size={18} className="text-green-500" />
                            <span className="text-green-500">הועתק!</span>
                        </>
                    ) : (
                        <>
                            <IconCopy size={18} />
                            העתק לשיעור
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
