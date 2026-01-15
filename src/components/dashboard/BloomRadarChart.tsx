/**
 * Bloom's Taxonomy Radar Chart
 * גרף רדאר להשוואת ביצועי תלמיד מול ממוצע כיתתי
 */

import React from 'react';
import {
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Legend,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { BLOOM_LABELS_HE, BLOOM_LEVELS_ORDERED } from '../../services/bloomAnalyticsService';
import type { BloomLevel } from '../../shared/types/courseTypes';

interface BloomRadarChartProps {
    studentData: Record<BloomLevel, number>;
    classAverage: Record<BloomLevel, number>;
    studentName: string;
    height?: number;
    showLegend?: boolean;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-right" dir="rtl">
                <p className="font-bold text-slate-700 mb-1">{payload[0]?.payload?.level}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {entry.value}%
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export const BloomRadarChart: React.FC<BloomRadarChartProps> = ({
    studentData,
    classAverage,
    studentName,
    height = 350,
    showLegend = true
}) => {
    // Prepare data for the chart
    const chartData = BLOOM_LEVELS_ORDERED.map(level => ({
        level: BLOOM_LABELS_HE[level],
        levelKey: level,
        student: studentData[level] || 0,
        class: classAverage[level] || 0
    }));

    // Calculate differences
    const aboveAverage = BLOOM_LEVELS_ORDERED.filter(
        level => (studentData[level] || 0) > (classAverage[level] || 0)
    );
    const belowAverage = BLOOM_LEVELS_ORDERED.filter(
        level => (studentData[level] || 0) < (classAverage[level] || 0)
    );

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-purple-50 to-white">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                    גרף רדאר - {studentName}
                </h3>
                <p className="text-sm text-slate-500 mt-1">השוואה לממוצע כיתתי</p>
            </div>

            {/* Chart */}
            <div className="p-4" dir="ltr">
                <ResponsiveContainer width="100%" height={height}>
                    <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <PolarGrid
                            gridType="polygon"
                            stroke="#e2e8f0"
                        />
                        <PolarAngleAxis
                            dataKey="level"
                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                            tickLine={false}
                        />
                        <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            tickCount={5}
                        />

                        {/* Class Average - Background */}
                        <Radar
                            name="ממוצע כיתתי"
                            dataKey="class"
                            stroke="#94a3b8"
                            fill="#94a3b8"
                            fillOpacity={0.2}
                            strokeWidth={2}
                            dot={{ fill: '#94a3b8', r: 3 }}
                        />

                        {/* Student - Foreground */}
                        <Radar
                            name={studentName}
                            dataKey="student"
                            stroke="#8b5cf6"
                            fill="#8b5cf6"
                            fillOpacity={0.4}
                            strokeWidth={3}
                            dot={{ fill: '#8b5cf6', r: 4 }}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        {showLegend && (
                            <Legend
                                wrapperStyle={{ paddingTop: 20 }}
                                formatter={(value) => (
                                    <span className="text-sm font-medium text-slate-600">{value}</span>
                                )}
                            />
                        )}
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            {/* Insights */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 space-y-3" dir="rtl">
                {/* Above average */}
                {aboveAverage.length > 0 && (
                    <div className="flex items-start gap-2">
                        <span className="text-green-500 text-lg">↑</span>
                        <div>
                            <span className="text-xs font-bold text-green-600">מעל הממוצע:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {aboveAverage.map(level => {
                                    const diff = (studentData[level] || 0) - (classAverage[level] || 0);
                                    return (
                                        <span
                                            key={level}
                                            className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"
                                        >
                                            {BLOOM_LABELS_HE[level]} (+{Math.round(diff)}%)
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Below average */}
                {belowAverage.length > 0 && (
                    <div className="flex items-start gap-2">
                        <span className="text-red-500 text-lg">↓</span>
                        <div>
                            <span className="text-xs font-bold text-red-600">מתחת לממוצע:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {belowAverage.map(level => {
                                    const diff = (classAverage[level] || 0) - (studentData[level] || 0);
                                    return (
                                        <span
                                            key={level}
                                            className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full"
                                        >
                                            {BLOOM_LABELS_HE[level]} (-{Math.round(diff)}%)
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Equal or no data */}
                {aboveAverage.length === 0 && belowAverage.length === 0 && (
                    <div className="text-xs text-slate-500 text-center">
                        ביצועים ברמת הממוצע הכיתתי
                    </div>
                )}
            </div>
        </div>
    );
};

// Compact version for inline use
export const BloomRadarChartCompact: React.FC<BloomRadarChartProps> = (props) => (
    <BloomRadarChart {...props} height={250} showLegend={false} />
);

export default BloomRadarChart;
