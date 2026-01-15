/**
 * Motivation Meter Component
 * מד מוטיבציה ויזואלי (High/Medium/Low)
 */

import React, { useMemo } from 'react';
import type { StudentAnalytics } from '../../services/analyticsService';
import {
    IconFlame,
    IconBattery4,
    IconBattery2,
    IconBatteryOff,
    IconTrendingUp,
    IconTrendingDown,
    IconMinus
} from '@tabler/icons-react';

interface MotivationMeterProps {
    student: StudentAnalytics;
    size?: 'sm' | 'md' | 'lg';
    showDetails?: boolean;
    className?: string;
}

type MotivationLevel = 'high' | 'medium' | 'low';

interface MotivationData {
    level: MotivationLevel;
    score: number;
    factors: {
        name: string;
        value: number;
        maxValue: number;
        trend?: 'up' | 'down' | 'stable';
    }[];
}

// Configuration for each level
const LEVEL_CONFIG: Record<MotivationLevel, {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
    description: string;
}> = {
    high: {
        label: 'מוטיבציה גבוהה',
        color: '#22c55e',
        bgColor: '#dcfce7',
        icon: <IconFlame className="w-full h-full" />,
        description: 'התלמיד מגלה מעורבות גבוהה והתמדה'
    },
    medium: {
        label: 'מוטיבציה בינונית',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        icon: <IconBattery2 className="w-full h-full" />,
        description: 'התלמיד פעיל אך יש מקום לשיפור'
    },
    low: {
        label: 'מוטיבציה נמוכה',
        color: '#ef4444',
        bgColor: '#fee2e2',
        icon: <IconBatteryOff className="w-full h-full" />,
        description: 'התלמיד זקוק לעידוד ותמיכה'
    }
};

// Size configurations
const SIZE_CONFIG = {
    sm: {
        gauge: 'w-16 h-16',
        icon: 'w-6 h-6',
        text: 'text-xs',
        padding: 'p-2'
    },
    md: {
        gauge: 'w-24 h-24',
        icon: 'w-8 h-8',
        text: 'text-sm',
        padding: 'p-3'
    },
    lg: {
        gauge: 'w-32 h-32',
        icon: 'w-10 h-10',
        text: 'text-base',
        padding: 'p-4'
    }
};

/**
 * חישוב ציון מוטיבציה
 */
const calculateMotivation = (student: StudentAnalytics): MotivationData => {
    const factors: MotivationData['factors'] = [];

    // Factor 1: Accuracy (0-30 points)
    const accuracy = (student.performance?.accuracy || 0) * 100;
    const accuracyScore = Math.min(30, accuracy * 0.3);
    factors.push({
        name: 'דיוק',
        value: Math.round(accuracyScore),
        maxValue: 30,
        trend: accuracy > 70 ? 'up' : accuracy < 50 ? 'down' : 'stable'
    });

    // Factor 2: Low hint dependency (0-25 points)
    const hintDep = student.performance?.hintDependency || 0;
    const hintScore = Math.min(25, (1 - hintDep) * 25);
    factors.push({
        name: 'עצמאות',
        value: Math.round(hintScore),
        maxValue: 25,
        trend: hintDep < 0.3 ? 'up' : hintDep > 0.6 ? 'down' : 'stable'
    });

    // Factor 3: Journey success rate (0-25 points)
    const journeySuccess = student.journey
        ? student.journey.filter(n => n.status === 'success').length / (student.journey.length || 1)
        : 0;
    const journeyScore = Math.min(25, journeySuccess * 25);
    factors.push({
        name: 'התקדמות',
        value: Math.round(journeyScore),
        maxValue: 25,
        trend: journeySuccess > 0.7 ? 'up' : journeySuccess < 0.4 ? 'down' : 'stable'
    });

    // Factor 4: Engagement - questions attempted (0-20 points)
    const questionsAttempted = student.performance?.totalQuestions || 0;
    const engagementScore = Math.min(20, questionsAttempted * 2);
    factors.push({
        name: 'מעורבות',
        value: Math.round(engagementScore),
        maxValue: 20,
        trend: questionsAttempted > 5 ? 'up' : 'stable'
    });

    // Calculate total score
    const totalScore = Math.round(factors.reduce((sum, f) => sum + f.value, 0));

    // Determine level
    let level: MotivationLevel;
    if (totalScore >= 70) {
        level = 'high';
    } else if (totalScore >= 40) {
        level = 'medium';
    } else {
        level = 'low';
    }

    return { level, score: totalScore, factors };
};

export const MotivationMeter: React.FC<MotivationMeterProps> = ({
    student,
    size = 'md',
    showDetails = false,
    className = ''
}) => {
    const motivation = useMemo(() => calculateMotivation(student), [student]);
    const config = LEVEL_CONFIG[motivation.level];
    const sizeConfig = SIZE_CONFIG[size];

    return (
        <div className={`${className}`}>
            {/* Gauge */}
            <div className="flex items-center gap-4">
                {/* Visual Meter */}
                <div
                    className={`${sizeConfig.gauge} relative rounded-full flex items-center justify-center`}
                    style={{ backgroundColor: config.bgColor }}
                >
                    {/* Progress Ring */}
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                            cx="50%"
                            cy="50%"
                            r="45%"
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="8%"
                        />
                        <circle
                            cx="50%"
                            cy="50%"
                            r="45%"
                            fill="none"
                            stroke={config.color}
                            strokeWidth="8%"
                            strokeLinecap="round"
                            strokeDasharray={`${motivation.score * 2.83} 283`}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>

                    {/* Center Content */}
                    <div className="relative z-10 text-center">
                        <span
                            className={`${sizeConfig.icon} block mx-auto`}
                            style={{ color: config.color }}
                        >
                            {config.icon}
                        </span>
                        <span
                            className="font-black text-lg"
                            style={{ color: config.color }}
                        >
                            {motivation.score}
                        </span>
                    </div>
                </div>

                {/* Label */}
                <div>
                    <div className={`font-bold ${sizeConfig.text}`} style={{ color: config.color }}>
                        {config.label}
                    </div>
                    <div className="text-xs text-slate-500">
                        {config.description}
                    </div>
                </div>
            </div>

            {/* Details */}
            {showDetails && (
                <div className="mt-4 space-y-2">
                    {motivation.factors.map((factor, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-slate-500 w-16">{factor.name}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${(factor.value / factor.maxValue) * 100}%`,
                                        backgroundColor: config.color
                                    }}
                                />
                            </div>
                            <span className="text-xs font-bold text-slate-600 w-12 text-left">
                                {factor.value}/{factor.maxValue}
                            </span>
                            {factor.trend && (
                                <span className={`w-4 h-4 ${factor.trend === 'up' ? 'text-green-500' :
                                        factor.trend === 'down' ? 'text-red-500' : 'text-slate-400'
                                    }`}>
                                    {factor.trend === 'up' ? <IconTrendingUp className="w-4 h-4" /> :
                                        factor.trend === 'down' ? <IconTrendingDown className="w-4 h-4" /> :
                                            <IconMinus className="w-4 h-4" />}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Compact badge version
interface MotivationBadgeProps {
    student: StudentAnalytics;
    showScore?: boolean;
}

export const MotivationBadge: React.FC<MotivationBadgeProps> = ({
    student,
    showScore = false
}) => {
    const motivation = useMemo(() => calculateMotivation(student), [student]);
    const config = LEVEL_CONFIG[motivation.level];

    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
            style={{
                backgroundColor: config.bgColor,
                color: config.color
            }}
        >
            <span className="w-4 h-4">{config.icon}</span>
            {showScore ? `${motivation.score}%` : config.label}
        </span>
    );
};

// Card version with full details
interface MotivationCardProps {
    student: StudentAnalytics;
    onAction?: () => void;
}

export const MotivationCard: React.FC<MotivationCardProps> = ({
    student,
    onAction
}) => {
    const motivation = useMemo(() => calculateMotivation(student), [student]);
    const config = LEVEL_CONFIG[motivation.level];

    return (
        <div
            className="rounded-2xl p-5 border transition-all hover:shadow-lg"
            style={{
                backgroundColor: `${config.bgColor}50`,
                borderColor: config.color + '40'
            }}
        >
            <MotivationMeter student={student} size="lg" showDetails />

            {/* Recommendation */}
            <div className="mt-4 p-3 bg-white rounded-xl text-sm text-slate-600">
                {motivation.level === 'high' && (
                    <p>💪 התלמיד מגלה מוטיבציה מצוינת! שקול לתת משימות מאתגרות יותר.</p>
                )}
                {motivation.level === 'medium' && (
                    <p>📈 יש פוטנציאל לשיפור. נסה לתת משוב חיובי ותמיכה.</p>
                )}
                {motivation.level === 'low' && (
                    <p>🤝 התלמיד זקוק לעידוד. שקול שיחה אישית ומשימות מותאמות.</p>
                )}
            </div>

            {onAction && (
                <button
                    onClick={onAction}
                    className="mt-3 w-full py-2 rounded-xl text-sm font-bold transition-colors"
                    style={{
                        backgroundColor: config.color,
                        color: 'white'
                    }}
                >
                    {motivation.level === 'low' ? 'צור תכנית תגבור' : 'צפה בפרטים'}
                </button>
            )}
        </div>
    );
};

export default MotivationMeter;
