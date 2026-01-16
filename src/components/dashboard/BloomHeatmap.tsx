/**
 * Bloom's Taxonomy Components
 * הצגת ביצועים לפי 6 רמות בלום
 */

import React, { useMemo } from 'react';
import {
    BLOOM_LABELS_HE,
    BLOOM_LEVELS_ORDERED,
    getBloomColor,
    type StudentBloomProfile,
    type ClassBloomSummary
} from '../../services/bloomAnalyticsService';
import type { BloomLevel } from '../../shared/types/courseTypes';
import { IconInfoCircle, IconAlertTriangle, IconTrophy } from '@tabler/icons-react';

// ============ CLASS LEVEL - SIMPLE SUMMARY ============

interface BloomClassSummaryProps {
    summary: ClassBloomSummary;
    showLegend?: boolean;
}

/**
 * תצוגה פשוטה של ממוצע כיתתי ברמות בלום
 */
export const BloomClassSummary: React.FC<BloomClassSummaryProps> = ({
    summary,
    showLegend = true
}) => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Compact Header with inline levels */}
            <div className="p-4 flex items-center gap-4">
                {/* Title */}
                <div className="flex items-center gap-2 min-w-fit">
                    <span className="w-1.5 h-5 bg-indigo-500 rounded-full"></span>
                    <span className="text-sm font-bold text-slate-700">בלום</span>
                </div>

                {/* Levels - Inline compact */}
                <div className="flex-1 flex items-center gap-2">
                    {BLOOM_LEVELS_ORDERED.map(level => {
                        const avg = summary.averageByLevel[level];
                        const isWeakest = summary.commonWeakness === level;
                        const isStrongest = summary.commonStrength === level;

                        return (
                            <div
                                key={level}
                                className={`
                                    flex-1 text-center py-2 px-1 rounded-lg transition-all
                                    ${isWeakest ? 'ring-1 ring-red-300' : ''}
                                    ${isStrongest ? 'ring-1 ring-green-300' : ''}
                                `}
                                style={{ backgroundColor: getBloomColor(avg) + '20' }}
                                title={BLOOM_LABELS_HE[level]}
                            >
                                <div
                                    className="text-sm font-black"
                                    style={{ color: getBloomColor(avg) }}
                                >
                                    {avg}%
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                    {BLOOM_LABELS_HE[level]}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Insights - compact */}
                {showLegend && (summary.commonWeakness || summary.commonStrength) && (
                    <div className="flex items-center gap-2 text-xs">
                        {summary.commonWeakness && (
                            <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg whitespace-nowrap">
                                <IconAlertTriangle className="w-3 h-3" />
                                {BLOOM_LABELS_HE[summary.commonWeakness]}
                            </span>
                        )}
                        {summary.commonStrength && (
                            <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg whitespace-nowrap">
                                <IconTrophy className="w-3 h-3" />
                                {BLOOM_LABELS_HE[summary.commonStrength]}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ============ STUDENT LEVEL - PROGRESS BARS ============

interface BloomStudentBarsProps {
    profile: StudentBloomProfile;
    classAverage?: Record<BloomLevel, number>;
    compact?: boolean;
}

/**
 * תצוגת Progress Bars לתלמיד בודד
 */
export const BloomStudentBars: React.FC<BloomStudentBarsProps> = ({
    profile,
    classAverage,
    compact = false
}) => {
    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-l from-purple-50 to-white">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-5 bg-purple-500 rounded-full"></span>
                    ניתוח רמות בלום
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">ציון כולל: {profile.overallScore}%</p>
            </div>

            {/* Progress Bars */}
            <div className={`p-4 space-y-3 ${compact ? '' : 'space-y-4'}`}>
                {BLOOM_LEVELS_ORDERED.map(level => {
                    const score = profile.scores[level];
                    const percentage = score?.percentage || 0;
                    const classAvg = classAverage?.[level];
                    const isWeakest = profile.weakestLevel === level;
                    const isStrongest = profile.strongestLevel === level;

                    return (
                        <div key={level} className="space-y-1">
                            {/* Label Row */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                    {isWeakest && <IconAlertTriangle className="w-3 h-3 text-red-500" />}
                                    {isStrongest && <IconTrophy className="w-3 h-3 text-green-500" />}
                                    {BLOOM_LABELS_HE[level]}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-sm font-black"
                                        style={{ color: getBloomColor(percentage) }}
                                    >
                                        {percentage}%
                                    </span>
                                    {classAvg !== undefined && (
                                        <span className="text-xs text-slate-400">
                                            (כיתה: {classAvg}%)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                                {/* Student Bar */}
                                <div
                                    className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: getBloomColor(percentage)
                                    }}
                                />

                                {/* Class Average Marker */}
                                {classAvg !== undefined && (
                                    <div
                                        className="absolute top-0 w-0.5 h-full bg-slate-400"
                                        style={{ left: `${classAvg}%` }}
                                        title={`ממוצע כיתה: ${classAvg}%`}
                                    />
                                )}
                            </div>

                            {/* Score details */}
                            {!compact && score?.total > 0 && (
                                <div className="text-xs text-slate-400">
                                    {score.correct}/{score.total} תשובות נכונות
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                {profile.strongestLevel && (
                    <span className="flex items-center gap-1 text-green-600">
                        <IconTrophy className="w-3 h-3" />
                        חזק ב{BLOOM_LABELS_HE[profile.strongestLevel]}
                    </span>
                )}
                {profile.weakestLevel && (
                    <span className="flex items-center gap-1 text-red-600">
                        <IconAlertTriangle className="w-3 h-3" />
                        לחזק: {BLOOM_LABELS_HE[profile.weakestLevel]}
                    </span>
                )}
            </div>
        </div>
    );
};

// ============ LEGACY HEATMAP (for backwards compatibility) ============

interface BloomHeatmapProps {
    students: StudentBloomProfile[];
    onStudentClick?: (studentId: string) => void;
    showLegend?: boolean;
    compact?: boolean;
}

// Hebrew descriptions for each Bloom level
const BLOOM_DESCRIPTIONS: Record<BloomLevel, string> = {
    knowledge: 'זכירה והכרה של מידע',
    comprehension: 'הבנה והסבר של מושגים',
    application: 'יישום ידע במצבים חדשים',
    analysis: 'פירוק לחלקים והבנת קשרים',
    synthesis: 'יצירה וחיבור של רעיונות',
    evaluation: 'שיפוט והערכה ביקורתית'
};

export const BloomHeatmap: React.FC<BloomHeatmapProps> = ({
    students,
    onStudentClick,
    showLegend = true,
    compact = false
}) => {
    // Calculate class averages for each Bloom level
    const classAverages = useMemo(() => {
        const averages: Record<BloomLevel, number> = {
            knowledge: 0,
            comprehension: 0,
            application: 0,
            analysis: 0,
            synthesis: 0,
            evaluation: 0
        };

        if (students.length === 0) return averages;

        BLOOM_LEVELS_ORDERED.forEach(level => {
            const sum = students.reduce((acc, s) => acc + (s.scores[level]?.percentage || 0), 0);
            averages[level] = Math.round(sum / students.length);
        });

        return averages;
    }, [students]);

    // Find weakest and strongest levels
    const { weakestLevel, strongestLevel } = useMemo(() => {
        let weakest: BloomLevel | null = null;
        let strongest: BloomLevel | null = null;
        let minAvg = 100;
        let maxAvg = 0;

        BLOOM_LEVELS_ORDERED.forEach(level => {
            const avg = classAverages[level];
            if (avg < minAvg) {
                minAvg = avg;
                weakest = level;
            }
            if (avg > maxAvg) {
                maxAvg = avg;
                strongest = level;
            }
        });

        return { weakestLevel: weakest, strongestLevel: strongest };
    }, [classAverages]);

    if (students.length === 0) {
        return (
            <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400">
                <IconInfoCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>אין נתונים להצגה</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-indigo-50 to-white">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                    ניתוח טקסונומיית בלום
                </h3>
                <p className="text-sm text-slate-500 mt-1">ביצועים לפי 6 רמות קוגניטיביות</p>
            </div>

            {/* Class Average Row */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 w-24 shrink-0">ממוצע כיתתי</span>
                    <div className="flex-1 grid grid-cols-6 gap-2">
                        {BLOOM_LEVELS_ORDERED.map(level => (
                            <div
                                key={level}
                                className="text-center p-2 rounded-lg"
                                style={{ backgroundColor: getBloomColor(classAverages[level]) + '20' }}
                            >
                                <div
                                    className="text-sm font-black"
                                    style={{ color: getBloomColor(classAverages[level]) }}
                                >
                                    {classAverages[level]}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Column Headers */}
            <div className="px-5 py-3 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-400 uppercase w-24 shrink-0">תלמיד/ה</span>
                    <div className="flex-1 grid grid-cols-6 gap-2">
                        {BLOOM_LEVELS_ORDERED.map(level => (
                            <div
                                key={level}
                                className={`text-center group relative ${level === weakestLevel ? 'ring-2 ring-red-200 rounded-lg' : ''
                                    } ${level === strongestLevel ? 'ring-2 ring-green-200 rounded-lg' : ''}`}
                            >
                                <div className="text-xs font-bold text-slate-600 flex items-center justify-center gap-1">
                                    {level === weakestLevel && <IconAlertTriangle className="w-3 h-3 text-red-500" />}
                                    {level === strongestLevel && <IconTrophy className="w-3 h-3 text-green-500" />}
                                    {BLOOM_LABELS_HE[level]}
                                </div>

                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    <div className="bg-slate-800 text-white text-xs p-2 rounded-lg shadow-lg whitespace-nowrap">
                                        {BLOOM_DESCRIPTIONS[level]}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Student Rows */}
            <div className={`divide-y divide-slate-50 ${compact ? 'max-h-[300px]' : 'max-h-[400px]'} overflow-y-auto`}>
                {students.map(student => (
                    <div
                        key={student.studentId}
                        onClick={() => onStudentClick?.(student.studentId)}
                        className={`px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors ${onStudentClick ? 'cursor-pointer' : ''
                            }`}
                    >
                        {/* Student Name */}
                        <div className="w-24 shrink-0">
                            <div className="text-sm font-bold text-slate-700 truncate">
                                {student.studentName}
                            </div>
                            <div className="text-xs text-slate-400">
                                סה״כ: {student.overallScore}%
                            </div>
                        </div>

                        {/* Bloom Scores */}
                        <div className="flex-1 grid grid-cols-6 gap-2">
                            {BLOOM_LEVELS_ORDERED.map(level => {
                                const score = student.scores[level];
                                const percentage = score?.percentage || 0;
                                const hasData = score?.total > 0;

                                return (
                                    <div
                                        key={level}
                                        className={`
                                            relative text-center py-2 rounded-lg transition-all
                                            ${hasData ? '' : 'bg-slate-100'}
                                            ${student.weakestLevel === level ? 'ring-1 ring-red-300' : ''}
                                            ${student.strongestLevel === level ? 'ring-1 ring-green-300' : ''}
                                        `}
                                        style={{
                                            backgroundColor: hasData ? getBloomColor(percentage) + '20' : undefined
                                        }}
                                    >
                                        {hasData ? (
                                            <>
                                                <div
                                                    className="text-sm font-black"
                                                    style={{ color: getBloomColor(percentage) }}
                                                >
                                                    {percentage}%
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {score.correct}/{score.total}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-xs text-slate-400">-</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            {showLegend && (
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">מקרא צבעים:</span>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></span>
                                חלש (&lt;40%)
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></span>
                                בינוני (40-60%)
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }}></span>
                                טוב (60-80%)
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded" style={{ backgroundColor: '#059669' }}></span>
                                מצוין (&gt;80%)
                            </span>
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="mt-3 flex items-center gap-4 text-xs">
                        {weakestLevel && (
                            <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                <IconAlertTriangle className="w-3 h-3" />
                                נושא לחיזוק: {BLOOM_LABELS_HE[weakestLevel]}
                            </span>
                        )}
                        {strongestLevel && (
                            <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                                <IconTrophy className="w-3 h-3" />
                                נושא חזק: {BLOOM_LABELS_HE[strongestLevel]}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BloomHeatmap;
