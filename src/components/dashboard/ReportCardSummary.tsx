/**
 * Report Card Summary Component
 * סיכום מילולי לתעודה עם אפשרות העתקה
 */

import React, { useState, useCallback } from 'react';
import type { StudentAnalytics } from '../../services/analyticsService';
import { BLOOM_LABELS_HE, type StudentBloomProfile } from '../../services/bloomAnalyticsService';
import {
    IconCopy,
    IconCheck,
    IconRefresh,
    IconSparkles,
    IconDownload,
    IconEdit
} from '@tabler/icons-react';

interface ReportCardSummaryProps {
    student: StudentAnalytics;
    courseTitle: string;
    bloomProfile?: StudentBloomProfile;
    onGenerateAI?: () => Promise<string>;
    className?: string;
}

/**
 * יצירת סיכום מילולי אוטומטי (ללא AI)
 */
const generateAutomaticSummary = (
    student: StudentAnalytics,
    courseTitle: string,
    bloomProfile?: StudentBloomProfile
): string => {
    const accuracy = Math.round((student.performance?.accuracy || 0) * 100);
    const hintDep = Math.round((student.performance?.hintDependency || 0) * 100);
    const totalQuestions = student.performance?.totalQuestions || 0;

    let summary = '';

    // Opening based on performance level
    if (accuracy >= 80) {
        summary = `${student.name} הפגין/ה שליטה מצוינת בנושא "${courseTitle}" עם ציון ${accuracy}%. `;
    } else if (accuracy >= 60) {
        summary = `${student.name} הציג/ה התקדמות טובה בנושא "${courseTitle}" עם ציון ${accuracy}%. `;
    } else if (accuracy >= 40) {
        summary = `${student.name} התמודד/ה עם נושא "${courseTitle}" והשיג/ה ציון ${accuracy}%. `;
    } else {
        summary = `${student.name} עבד/ה על נושא "${courseTitle}" והשיג/ה ציון ${accuracy}%. נדרשת תמיכה נוספת. `;
    }

    // Questions attempted
    summary += `במהלך הלמידה ענה/תה על ${totalQuestions} שאלות. `;

    // Hint usage
    if (hintDep < 20) {
        summary += `הפגין/ה עצמאות גבוהה בלמידה. `;
    } else if (hintDep > 50) {
        summary += `נעזר/ה ברמזים באופן תכוף - מומלץ לעודד עצמאות. `;
    }

    // Bloom strengths/weaknesses if available
    if (bloomProfile) {
        if (bloomProfile.strongestLevel) {
            summary += `חוזק בולט ברמת ${BLOOM_LABELS_HE[bloomProfile.strongestLevel]}. `;
        }
        if (bloomProfile.weakestLevel && bloomProfile.weakestLevel !== bloomProfile.strongestLevel) {
            summary += `נדרש חיזוק ברמת ${BLOOM_LABELS_HE[bloomProfile.weakestLevel]}. `;
        }
    }

    // Closing recommendation
    if (student.riskLevel === 'high') {
        summary += `מומלץ לקיים שיחה אישית ולספק תמיכה מותאמת.`;
    } else if (student.riskLevel === 'low') {
        summary += `התלמיד/ה מוכן/ה לאתגרים נוספים ומשימות העשרה.`;
    } else {
        summary += `ממשיך/ה להתקדם בקצב טוב.`;
    }

    return summary;
};

export const ReportCardSummary: React.FC<ReportCardSummaryProps> = ({
    student,
    courseTitle,
    bloomProfile,
    onGenerateAI,
    className = ''
}) => {
    const [summary, setSummary] = useState(() =>
        generateAutomaticSummary(student, courseTitle, bloomProfile)
    );
    const [isEditing, setIsEditing] = useState(false);
    const [editedSummary, setEditedSummary] = useState(summary);
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Copy to clipboard
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [summary]);

    // Regenerate automatic summary
    const handleRegenerate = useCallback(() => {
        const newSummary = generateAutomaticSummary(student, courseTitle, bloomProfile);
        setSummary(newSummary);
        setEditedSummary(newSummary);
    }, [student, courseTitle, bloomProfile]);

    // Generate AI summary
    const handleGenerateAI = useCallback(async () => {
        if (!onGenerateAI) return;

        setIsGenerating(true);
        try {
            const aiSummary = await onGenerateAI();
            setSummary(aiSummary);
            setEditedSummary(aiSummary);
        } catch (err) {
            console.error('Failed to generate AI summary:', err);
        } finally {
            setIsGenerating(false);
        }
    }, [onGenerateAI]);

    // Save edited summary
    const handleSaveEdit = () => {
        setSummary(editedSummary);
        setIsEditing(false);
    };

    return (
        <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-amber-50 to-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
                            סיכום מילולי לתעודה
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            {student.name} | {courseTitle}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {onGenerateAI && (
                            <button
                                onClick={handleGenerateAI}
                                disabled={isGenerating}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-200 transition-colors disabled:opacity-50"
                            >
                                <IconSparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                {isGenerating ? 'יוצר...' : 'צור עם AI'}
                            </button>
                        )}

                        <button
                            onClick={handleRegenerate}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            title="צור מחדש"
                        >
                            <IconRefresh className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Content */}
            <div className="p-5">
                {isEditing ? (
                    <div className="space-y-3">
                        <textarea
                            value={editedSummary}
                            onChange={(e) => setEditedSummary(e.target.value)}
                            className="w-full h-32 p-4 border border-slate-200 rounded-xl text-slate-700 leading-relaxed resize-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                            dir="rtl"
                        />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSaveEdit}
                                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors"
                            >
                                שמור
                            </button>
                            <button
                                onClick={() => {
                                    setEditedSummary(summary);
                                    setIsEditing(false);
                                }}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
                            >
                                ביטול
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="bg-amber-50 border border-amber-100 rounded-xl p-5 text-slate-700 leading-relaxed cursor-pointer hover:bg-amber-100 transition-colors group"
                        onClick={() => setIsEditing(true)}
                    >
                        <p className="whitespace-pre-wrap">{summary}</p>
                        <div className="mt-2 text-xs text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            לחץ לעריכה
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                    {summary.length} תווים
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm transition-colors"
                    >
                        <IconEdit className="w-4 h-4" />
                        ערוך
                    </button>

                    <button
                        onClick={handleCopy}
                        className={`
                            flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-bold transition-all
                            ${copied
                                ? 'bg-green-500 text-white'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }
                        `}
                    >
                        {copied ? (
                            <>
                                <IconCheck className="w-4 h-4" />
                                הועתק!
                            </>
                        ) : (
                            <>
                                <IconCopy className="w-4 h-4" />
                                העתק ללוח
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Compact version for inline use
interface ReportCardSummaryCompactProps {
    student: StudentAnalytics;
    courseTitle: string;
}

export const ReportCardSummaryCompact: React.FC<ReportCardSummaryCompactProps> = ({
    student,
    courseTitle
}) => {
    const [copied, setCopied] = useState(false);
    const summary = generateAutomaticSummary(student, courseTitle);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <p className="text-sm text-slate-700 leading-relaxed line-clamp-3 mb-3">
                {summary}
            </p>
            <button
                onClick={handleCopy}
                className={`
                    w-full py-2 rounded-lg text-sm font-bold transition-all
                    ${copied
                        ? 'bg-green-500 text-white'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                    }
                `}
            >
                {copied ? '✓ הועתק!' : 'העתק לתעודה'}
            </button>
        </div>
    );
};

export default ReportCardSummary;
