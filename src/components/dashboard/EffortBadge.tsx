/**
 * Effort Badge Component
 * תג המציג את סוג המאמץ של התלמיד: מאמץ גבוה / ניחוש מהיר / רגיל
 */

import React from 'react';
import {
    calculateEffortType,
    EFFORT_LABELS_HE,
    EFFORT_COLORS,
    type EffortType
} from '../../services/gamingDetectionService';
import type { StudentTaskSubmission } from '../../shared/types/courseTypes';
import {
    IconFlame,
    IconBolt,
    IconMinus,
    IconClock,
    IconBulb
} from '@tabler/icons-react';

interface EffortBadgeProps {
    submission?: StudentTaskSubmission;
    effortType?: EffortType;
    size?: 'sm' | 'md' | 'lg';
    showTooltip?: boolean;
    className?: string;
}

// Icons for each effort type
const EFFORT_ICONS: Record<EffortType, React.ReactNode> = {
    high_effort: <IconFlame className="w-full h-full" />,
    quick_guess: <IconBolt className="w-full h-full" />,
    normal: <IconMinus className="w-full h-full" />
};

// Descriptions for tooltips
const EFFORT_DESCRIPTIONS: Record<EffortType, string> = {
    high_effort: 'התלמיד השקיע זמן, קרא את החומר והשתמש ברמזים כשנדרש',
    quick_guess: 'תשובות מהירות מאוד עם מעט מחשבה - ייתכן ניחוש',
    normal: 'קצב עבודה סביר'
};

// Size configurations
const SIZE_CONFIG = {
    sm: {
        badge: 'px-2 py-0.5 text-[10px]',
        icon: 'w-3 h-3',
        gap: 'gap-1'
    },
    md: {
        badge: 'px-3 py-1 text-xs',
        icon: 'w-4 h-4',
        gap: 'gap-1.5'
    },
    lg: {
        badge: 'px-4 py-2 text-sm',
        icon: 'w-5 h-5',
        gap: 'gap-2'
    }
};

export const EffortBadge: React.FC<EffortBadgeProps> = ({
    submission,
    effortType: providedType,
    size = 'md',
    showTooltip = true,
    className = ''
}) => {
    // Calculate effort type if not provided
    const effortType = providedType || (submission ? calculateEffortType(submission) : 'normal');

    const config = SIZE_CONFIG[size];
    const color = EFFORT_COLORS[effortType];

    return (
        <div className={`relative group inline-flex ${className}`}>
            <span
                className={`
                    inline-flex items-center ${config.gap} ${config.badge}
                    rounded-full font-bold border transition-all
                    hover:scale-105 cursor-default
                `}
                style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}40`,
                    color: color
                }}
            >
                <span className={config.icon}>
                    {EFFORT_ICONS[effortType]}
                </span>
                {EFFORT_LABELS_HE[effortType]}
            </span>

            {/* Tooltip */}
            {showTooltip && (
                <div className="
                    absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                    opacity-0 group-hover:opacity-100 transition-opacity
                    pointer-events-none z-20
                ">
                    <div className="bg-slate-800 text-white text-xs p-3 rounded-xl shadow-lg max-w-[200px] text-right" dir="rtl">
                        <p className="font-bold mb-1">{EFFORT_LABELS_HE[effortType]}</p>
                        <p className="text-slate-300">{EFFORT_DESCRIPTIONS[effortType]}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// Detailed Effort Card with more information
interface EffortCardProps {
    submission: StudentTaskSubmission;
    className?: string;
}

export const EffortCard: React.FC<EffortCardProps> = ({ submission, className = '' }) => {
    const effortType = calculateEffortType(submission);
    const telemetry = submission.telemetry;

    // Calculate metrics
    const avgTimePerBlock = telemetry
        ? Math.round((telemetry.timeSpentSeconds || 0) / (telemetry.totalBlocks || 1))
        : 0;

    const totalHints = telemetry
        ? Object.values(telemetry.hintsUsed || {}).reduce((a: number, b: any) => a + (b as number), 0)
        : 0;

    const accuracy = telemetry
        ? Math.round((telemetry.successBlocks / (telemetry.totalBlocks || 1)) * 100)
        : 0;

    const color = EFFORT_COLORS[effortType];

    return (
        <div
            className={`rounded-2xl p-4 border ${className}`}
            style={{
                backgroundColor: `${color}08`,
                borderColor: `${color}30`
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${color}20`, color }}
                    >
                        {EFFORT_ICONS[effortType]}
                    </span>
                    <div>
                        <div className="font-bold text-slate-800">{EFFORT_LABELS_HE[effortType]}</div>
                        <div className="text-xs text-slate-500">{EFFORT_DESCRIPTIONS[effortType]}</div>
                    </div>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <IconClock className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                    <div className="text-lg font-black text-slate-700">{avgTimePerBlock}s</div>
                    <div className="text-[10px] text-slate-400">זמן ממוצע לשאלה</div>
                </div>

                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <IconBulb className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                    <div className="text-lg font-black text-slate-700">{totalHints}</div>
                    <div className="text-[10px] text-slate-400">רמזים בשימוש</div>
                </div>

                <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <div className="w-4 h-4 mx-auto text-slate-400 mb-1 font-bold text-xs">%</div>
                    <div className="text-lg font-black text-slate-700">{accuracy}%</div>
                    <div className="text-[10px] text-slate-400">דיוק</div>
                </div>
            </div>

            {/* Recommendation */}
            {effortType === 'quick_guess' && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700">
                    💡 <strong>המלצה:</strong> מומלץ לשוחח עם התלמיד על חשיבות הקריאה והמחשבה לפני מענה
                </div>
            )}

            {effortType === 'high_effort' && (
                <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200 text-xs text-green-700">
                    ⭐ <strong>מצוין!</strong> התלמיד מגלה מאמץ והתמדה בלמידה
                </div>
            )}
        </div>
    );
};

// List of effort badges for multiple students
interface EffortBadgeListProps {
    students: { id: string; name: string; submission: StudentTaskSubmission }[];
    onStudentClick?: (studentId: string) => void;
}

export const EffortBadgeList: React.FC<EffortBadgeListProps> = ({
    students,
    onStudentClick
}) => {
    // Group by effort type
    const grouped = {
        high_effort: students.filter(s => calculateEffortType(s.submission) === 'high_effort'),
        quick_guess: students.filter(s => calculateEffortType(s.submission) === 'quick_guess'),
        normal: students.filter(s => calculateEffortType(s.submission) === 'normal')
    };

    return (
        <div className="space-y-4">
            {/* Quick Guess Warning */}
            {grouped.quick_guess.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                        <EffortBadge effortType="quick_guess" showTooltip={false} />
                        <span className="text-sm text-amber-700">
                            ({grouped.quick_guess.length} תלמידים)
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {grouped.quick_guess.map(s => (
                            <button
                                key={s.id}
                                onClick={() => onStudentClick?.(s.id)}
                                className="text-xs bg-white px-2 py-1 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* High Effort */}
            {grouped.high_effort.length > 0 && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                        <EffortBadge effortType="high_effort" showTooltip={false} />
                        <span className="text-sm text-green-700">
                            ({grouped.high_effort.length} תלמידים)
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {grouped.high_effort.map(s => (
                            <button
                                key={s.id}
                                onClick={() => onStudentClick?.(s.id)}
                                className="text-xs bg-white px-2 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-100 transition-colors"
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EffortBadge;
