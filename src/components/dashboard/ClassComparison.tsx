/**
 * Class Comparison Component
 * השוואה בין כיתות/קבוצות שונות
 */

import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar
} from 'recharts';
import {
    IconUsers,
    IconTrendingUp,
    IconTrendingDown,
    IconEqual,
    IconChartBar
} from '@tabler/icons-react';
import type { StudentAnalytics } from '../../services/analyticsService';

export interface ClassData {
    id: string;
    name: string;
    students: StudentAnalytics[];
    color: string;
}

interface ClassComparisonProps {
    classes: ClassData[];
    className?: string;
}

interface ClassStats {
    id: string;
    name: string;
    color: string;
    studentCount: number;
    avgAccuracy: number;
    avgHintDependency: number;
    avgTimePerQuestion: number;
    completionRate: number;
    riskDistribution: {
        low: number;
        medium: number;
        high: number;
    };
}

// Calculate stats for a class
const calculateClassStats = (classData: ClassData): ClassStats => {
    const students = classData.students;
    const count = students.length;

    if (count === 0) {
        return {
            id: classData.id,
            name: classData.name,
            color: classData.color,
            studentCount: 0,
            avgAccuracy: 0,
            avgHintDependency: 0,
            avgTimePerQuestion: 0,
            completionRate: 0,
            riskDistribution: { low: 0, medium: 0, high: 0 }
        };
    }

    const totalAccuracy = students.reduce((sum, s) => sum + (s.performance?.accuracy || 0), 0);
    const totalHintDep = students.reduce((sum, s) => sum + (s.performance?.hintDependency || 0), 0);

    // Completion rate based on journey
    const completedStudents = students.filter(s =>
        s.journey && s.journey.length > 0 &&
        s.journey[s.journey.length - 1]?.status === 'success'
    ).length;

    // Risk distribution
    const riskDist = {
        low: students.filter(s => s.riskLevel === 'low').length,
        medium: students.filter(s => s.riskLevel === 'medium').length,
        high: students.filter(s => s.riskLevel === 'high').length
    };

    return {
        id: classData.id,
        name: classData.name,
        color: classData.color,
        studentCount: count,
        avgAccuracy: Math.round((totalAccuracy / count) * 100),
        avgHintDependency: Math.round((totalHintDep / count) * 100),
        avgTimePerQuestion: 45, // Placeholder - would need actual time data
        completionRate: Math.round((completedStudents / count) * 100),
        riskDistribution: riskDist
    };
};

export const ClassComparison: React.FC<ClassComparisonProps> = ({
    classes,
    className = ''
}) => {
    const classStats = useMemo(() =>
        classes.map(calculateClassStats),
        [classes]
    );

    // Prepare data for bar chart
    const barChartData = useMemo(() => [
        {
            metric: 'דיוק ממוצע',
            ...Object.fromEntries(classStats.map(c => [c.name, c.avgAccuracy]))
        },
        {
            metric: 'אחוז השלמה',
            ...Object.fromEntries(classStats.map(c => [c.name, c.completionRate]))
        },
        {
            metric: 'עצמאות',
            ...Object.fromEntries(classStats.map(c => [c.name, 100 - c.avgHintDependency]))
        }
    ], [classStats]);

    // Prepare data for radar chart
    const radarData = useMemo(() => [
        { subject: 'דיוק', ...Object.fromEntries(classStats.map(c => [c.name, c.avgAccuracy])), fullMark: 100 },
        { subject: 'השלמה', ...Object.fromEntries(classStats.map(c => [c.name, c.completionRate])), fullMark: 100 },
        { subject: 'עצמאות', ...Object.fromEntries(classStats.map(c => [c.name, 100 - c.avgHintDependency])), fullMark: 100 },
        { subject: 'סיכון נמוך', ...Object.fromEntries(classStats.map(c => [c.name, Math.round((c.riskDistribution.low / c.studentCount) * 100) || 0])), fullMark: 100 }
    ], [classStats]);

    if (classes.length < 2) {
        return (
            <div className={`bg-white rounded-[24px] border border-slate-200 p-8 text-center ${className}`}>
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <IconUsers className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="font-bold text-slate-700">נדרשות לפחות 2 כיתות</h4>
                <p className="text-sm text-slate-500 mt-1">בחר כיתות נוספות להשוואה</p>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-blue-50 to-white">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <IconChartBar className="w-5 h-5 text-blue-500" />
                    השוואת כיתות
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                    השוואה בין {classes.length} כיתות
                </p>
            </div>

            {/* Summary Cards */}
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                {classStats.map((stats) => (
                    <div
                        key={stats.id}
                        className="rounded-xl p-4 border-2"
                        style={{ borderColor: stats.color + '40', backgroundColor: stats.color + '10' }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stats.color }}
                            />
                            <span className="font-bold text-slate-700 text-sm truncate">
                                {stats.name}
                            </span>
                        </div>
                        <div className="text-3xl font-black" style={{ color: stats.color }}>
                            {stats.avgAccuracy}%
                        </div>
                        <div className="text-xs text-slate-500">
                            {stats.studentCount} תלמידים
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <div className="bg-slate-50 rounded-2xl p-4">
                    <h4 className="font-bold text-slate-700 mb-4 text-center">השוואת מדדים</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={barChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                            <YAxis dataKey="metric" type="category" width={80} tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px'
                                }}
                            />
                            <Legend />
                            {classStats.map((stats) => (
                                <Bar
                                    key={stats.id}
                                    dataKey={stats.name}
                                    fill={stats.color}
                                    radius={[0, 4, 4, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Radar Chart */}
                <div className="bg-slate-50 rounded-2xl p-4">
                    <h4 className="font-bold text-slate-700 mb-4 text-center">פרופיל כיתה</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                            {classStats.map((stats) => (
                                <Radar
                                    key={stats.id}
                                    name={stats.name}
                                    dataKey={stats.name}
                                    stroke={stats.color}
                                    fill={stats.color}
                                    fillOpacity={0.2}
                                />
                            ))}
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="p-5 border-t border-slate-100">
                <h4 className="font-bold text-slate-700 mb-4">טבלת השוואה מפורטת</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="py-3 px-4 text-right font-bold text-slate-600">כיתה</th>
                                <th className="py-3 px-4 text-center font-bold text-slate-600">תלמידים</th>
                                <th className="py-3 px-4 text-center font-bold text-slate-600">ממוצע</th>
                                <th className="py-3 px-4 text-center font-bold text-slate-600">השלמה</th>
                                <th className="py-3 px-4 text-center font-bold text-slate-600">עצמאות</th>
                                <th className="py-3 px-4 text-center font-bold text-slate-600">בסיכון</th>
                            </tr>
                        </thead>
                        <tbody>
                            {classStats.map((stats) => {
                                // Find best/worst for highlighting
                                const isHighestAccuracy = stats.avgAccuracy === Math.max(...classStats.map(s => s.avgAccuracy));
                                const isLowestAccuracy = stats.avgAccuracy === Math.min(...classStats.map(s => s.avgAccuracy));

                                return (
                                    <tr key={stats.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: stats.color }}
                                                />
                                                <span className="font-bold text-slate-700">{stats.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-slate-600">
                                            {stats.studentCount}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`
                                                inline-flex items-center gap-1 font-bold
                                                ${isHighestAccuracy ? 'text-green-600' : isLowestAccuracy ? 'text-red-600' : 'text-slate-700'}
                                            `}>
                                                {stats.avgAccuracy}%
                                                {isHighestAccuracy && <IconTrendingUp className="w-4 h-4" />}
                                                {isLowestAccuracy && <IconTrendingDown className="w-4 h-4" />}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-slate-600">
                                            {stats.completionRate}%
                                        </td>
                                        <td className="py-3 px-4 text-center text-slate-600">
                                            {100 - stats.avgHintDependency}%
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`
                                                px-2 py-0.5 rounded-full text-xs font-bold
                                                ${stats.riskDistribution.high > stats.studentCount * 0.2
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-green-100 text-green-700'
                                                }
                                            `}>
                                                {stats.riskDistribution.high} ({Math.round((stats.riskDistribution.high / stats.studentCount) * 100) || 0}%)
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Insights */}
            <div className="p-5 bg-blue-50 border-t border-blue-100">
                <h4 className="font-bold text-blue-800 mb-3">תובנות</h4>
                <ul className="space-y-2 text-sm text-blue-700">
                    {(() => {
                        const best = classStats.reduce((a, b) => a.avgAccuracy > b.avgAccuracy ? a : b);
                        const worst = classStats.reduce((a, b) => a.avgAccuracy < b.avgAccuracy ? a : b);
                        const gap = best.avgAccuracy - worst.avgAccuracy;

                        return (
                            <>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-600">•</span>
                                    <strong>{best.name}</strong> מובילה עם ממוצע {best.avgAccuracy}%
                                </li>
                                {gap > 10 && (
                                    <li className="flex items-start gap-2">
                                        <span className="text-amber-600">•</span>
                                        פער של {gap} נקודות בין הכיתות - מומלץ לבדוק את <strong>{worst.name}</strong>
                                    </li>
                                )}
                                {worst.riskDistribution.high > worst.studentCount * 0.3 && (
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-600">•</span>
                                        ב-<strong>{worst.name}</strong> יותר מ-30% מהתלמידים בסיכון - נדרשת התערבות
                                    </li>
                                )}
                            </>
                        );
                    })()}
                </ul>
            </div>
        </div>
    );
};

// Compact comparison badge
interface ComparisonBadgeProps {
    currentValue: number;
    comparisonValue: number;
    label: string;
}

export const ComparisonBadge: React.FC<ComparisonBadgeProps> = ({
    currentValue,
    comparisonValue,
    label
}) => {
    const diff = currentValue - comparisonValue;
    const isAbove = diff > 0;
    const isEqual = diff === 0;

    return (
        <div className="inline-flex items-center gap-2">
            <span className="font-bold text-slate-700">{currentValue}%</span>
            <span className={`
                flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full
                ${isEqual
                    ? 'bg-slate-100 text-slate-600'
                    : isAbove
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                }
            `}>
                {isEqual ? (
                    <>
                        <IconEqual className="w-3 h-3" />
                        כממוצע
                    </>
                ) : isAbove ? (
                    <>
                        <IconTrendingUp className="w-3 h-3" />
                        +{diff} מ{label}
                    </>
                ) : (
                    <>
                        <IconTrendingDown className="w-3 h-3" />
                        {diff} מ{label}
                    </>
                )}
            </span>
        </div>
    );
};

export default ClassComparison;
