/**
 * Scaffolding Patterns Summary Component
 *
 * Displays scaffolding behavior analytics for a student:
 * - Acceptance rate (how often they accept scaffolding offers)
 * - Total offers, acceptances, and declines
 * - Mastery context (average mastery when scaffolding was offered)
 * - Variant preferences (הבנה vs העמקה)
 *
 * Data source: users/{userId}/profile/scaffolding_patterns
 * Created: 2026-01-23
 */

import React, { useState, useEffect } from 'react';
import { IconSparkles, IconCheck, IconX, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import { getScaffoldingPatterns, type ScaffoldingProfileDoc } from '../../services/adaptiveIntegrationService';

interface ScaffoldingPatternsSummaryProps {
    userId: string;
}

export const ScaffoldingPatternsSummary: React.FC<ScaffoldingPatternsSummaryProps> = ({ userId }) => {
    const [patterns, setPatterns] = useState<ScaffoldingProfileDoc | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadPatterns = async () => {
            if (!userId) return;

            setLoading(true);
            try {
                const data = await getScaffoldingPatterns(userId);
                setPatterns(data);
            } catch (error) {
                console.error('Error loading scaffolding patterns:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPatterns();
    }, [userId]);

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-amber-50 to-purple-50 rounded-2xl p-5 border border-amber-200 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-slate-200 rounded"></div>
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                </div>
            </div>
        );
    }

    // No scaffolding data yet
    if (!patterns || patterns.totalOffered === 0) {
        return (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200 text-center">
                <div className="w-12 h-12 bg-slate-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <IconSparkles className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm font-medium">
                    אין נתוני התאמה אישית עדיין
                </p>
                <p className="text-slate-400 text-xs mt-1">
                    כשהמערכת תציע שאלות מותאמות, הסטטיסטיקה תופיע כאן
                </p>
            </div>
        );
    }

    // Calculate insights
    const acceptanceRate = patterns.acceptanceRate;
    const isHighAcceptance = acceptanceRate > 0.7;
    const isLowAcceptance = acceptanceRate < 0.3;

    const masteryWhenOffered = patterns.avgMasteryWhenOffered;
    const isStrugglingWhenOffered = masteryWhenOffered < 0.3;

    return (
        <div className="bg-gradient-to-br from-amber-50 via-purple-50 to-pink-50 rounded-2xl p-5 border-2 border-amber-200 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <IconSparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        סטטיסטיקת התאמה אישית
                    </h4>
                    <p className="text-xs text-slate-500">
                        איך התלמיד מגיב להצעות שאלות מותאמות
                    </p>
                </div>
            </div>

            {/* Acceptance Rate Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-600 font-medium">אחוז קבלה</span>
                    <span className="text-lg font-black text-purple-700">
                        {(acceptanceRate * 100).toFixed(0)}%
                    </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                            isHighAcceptance
                                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                                : isLowAcceptance
                                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                : 'bg-gradient-to-r from-cyan-400 to-purple-500'
                        }`}
                        style={{ width: `${acceptanceRate * 100}%` }}
                    />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                    {isHighAcceptance
                        ? 'תלמיד פתוח ללמידה מותאמת ✨'
                        : isLowAcceptance
                        ? 'תלמיד מעדיף לראות תשובות'
                        : 'שימוש מאוזן בהתאמה אישית'}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Total Offered */}
                <div className="bg-white rounded-xl p-3 text-center border border-purple-100 shadow-sm">
                    <div className="text-2xl font-black text-purple-600">
                        {patterns.totalOffered}
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-1">הוצעו</div>
                </div>

                {/* Accepted */}
                <div className="bg-white rounded-xl p-3 text-center border border-green-100 shadow-sm">
                    <div className="flex items-center justify-center gap-1">
                        <IconCheck size={18} className="text-green-600" />
                        <div className="text-2xl font-black text-green-600">
                            {patterns.totalAccepted}
                        </div>
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-1">התקבלו</div>
                </div>

                {/* Declined */}
                <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-center gap-1">
                        <IconX size={18} className="text-slate-500" />
                        <div className="text-2xl font-black text-slate-600">
                            {patterns.totalDeclined}
                        </div>
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-1">נדחו</div>
                </div>
            </div>

            {/* Mastery Context */}
            <div className="bg-white rounded-xl p-3 border border-indigo-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 font-medium">רמת שליטה בזמן הצעה:</span>
                    <div className="flex items-center gap-1">
                        {isStrugglingWhenOffered ? (
                            <IconTrendingDown size={14} className="text-red-500" />
                        ) : (
                            <IconTrendingUp size={14} className="text-green-500" />
                        )}
                        <span className={`text-lg font-black ${
                            isStrugglingWhenOffered ? 'text-red-600' : 'text-indigo-600'
                        }`}>
                            {(masteryWhenOffered * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
                <p className="text-xs text-slate-500">
                    {isStrugglingWhenOffered
                        ? 'המערכת מזהה קשיים ומציעה עזרה בזמן 👍'
                        : 'רמת שליטה סבירה בזמן הצעות'}
                </p>
            </div>

            {/* Variant Breakdown (if there's enrichment data) */}
            {(patterns.הבנהOffered > 0 || patterns.העמקהOffered > 0) && (
                <div className="mt-4 pt-4 border-t border-purple-100">
                    <div className="text-xs text-slate-500 font-bold mb-2">סוגי שאלות שהוצעו:</div>
                    <div className="flex gap-2">
                        {patterns.הבנהOffered > 0 && (
                            <div className="flex-1 bg-amber-100 rounded-lg p-2 text-center border border-amber-200">
                                <div className="text-lg font-black text-amber-700">
                                    {patterns.הבנהAccepted}/{patterns.הבנהOffered}
                                </div>
                                <div className="text-xs text-amber-600 font-medium">הבנה</div>
                            </div>
                        )}
                        {patterns.העמקהOffered > 0 && (
                            <div className="flex-1 bg-purple-100 rounded-lg p-2 text-center border border-purple-200">
                                <div className="text-lg font-black text-purple-700">
                                    {patterns.העמקהAccepted}/{patterns.העמקהOffered}
                                </div>
                                <div className="text-xs text-purple-600 font-medium">העמקה</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Insight Box */}
            <div className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-3 border border-indigo-100">
                <div className="flex items-start gap-2">
                    <div className="bg-indigo-100 p-1.5 rounded-lg shrink-0">
                        <IconSparkles className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-indigo-900 mb-1">תובנה:</div>
                        <p className="text-xs text-indigo-700 leading-relaxed">
                            {isHighAcceptance && isStrugglingWhenOffered
                                ? 'תלמיד שמכיר במגבלות שלו ופתוח לעזרה - מצוין!'
                                : isLowAcceptance && !isStrugglingWhenOffered
                                ? 'תלמיד בעל ביטחון עצמי, מעדיף ללמוד מטעויות'
                                : isHighAcceptance
                                ? 'תלמיד שמעריך התאמה אישית ומשתמש בה ביעילות'
                                : 'תלמיד עצמאי שמעדיף לפתור בכוחות עצמו'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScaffoldingPatternsSummary;
