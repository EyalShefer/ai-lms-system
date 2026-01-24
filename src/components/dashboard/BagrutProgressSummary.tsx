/**
 * BagrutProgressSummary Component
 * Displays Bagrut practice progress summary for teachers
 */

import React, { useState, useEffect } from 'react';
import { IconSchool, IconChartBar, IconAlertTriangle, IconCheck, IconSend } from '@tabler/icons-react';
import * as bagrutService from '../../services/bagrutService';
import type { BagrutSubject } from '../../shared/types/bagrutTypes';
import { BAGRUT_SUBJECT_LABELS } from '../../shared/types/bagrutTypes';
import BagrutAssignmentModal from '../BagrutAssignmentModal';

interface BagrutProgressSummaryProps {
    teacherId: string;
    teacherName?: string;
    onViewDetails?: (subject: BagrutSubject) => void;
}

export function BagrutProgressSummary({ teacherId, teacherName, onViewDetails }: BagrutProgressSummaryProps) {
    const [loading, setLoading] = useState(true);
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [data, setData] = useState<{
        students: any[];
        subjectStats: Record<BagrutSubject, {
            studentsCount: number;
            avgScore: number;
            commonWeakTopics: string[];
        }>;
    } | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const result = await bagrutService.getTeacherBagrutProgress(teacherId);
                setData(result);
            } catch (error) {
                console.error('Error loading Bagrut progress:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [teacherId]);

    if (loading) {
        return (
            <div className="card-glass p-6 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
                <div className="space-y-3">
                    <div className="h-16 bg-slate-100 rounded" />
                    <div className="h-16 bg-slate-100 rounded" />
                </div>
            </div>
        );
    }

    if (!data || Object.keys(data.subjectStats).length === 0) {
        return (
            <>
                <div className="card-glass p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
                                <IconSchool size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">תרגול בגרויות</h3>
                        </div>
                        <button
                            onClick={() => setShowAssignmentModal(true)}
                            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors"
                        >
                            <IconSend size={18} />
                            שלח משימה
                        </button>
                    </div>
                    <p className="text-slate-500 text-center py-4">
                        אין עדיין נתוני תרגול בגרויות
                    </p>
                </div>

                {showAssignmentModal && (
                    <BagrutAssignmentModal
                        teacherId={teacherId}
                        teacherName={teacherName}
                        onClose={() => setShowAssignmentModal(false)}
                    />
                )}
            </>
        );
    }

    const subjects = Object.entries(data.subjectStats) as [BagrutSubject, typeof data.subjectStats[BagrutSubject]][];

    return (
        <>
        <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
                        <IconSchool size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">תרגול בגרויות</h3>
                        <p className="text-sm text-slate-500">{data.students.length} תלמידים מתרגלים</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAssignmentModal(true)}
                    className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors"
                >
                    <IconSend size={18} />
                    שלח משימה
                </button>
            </div>

            <div className="space-y-3">
                {subjects.map(([subject, stats]) => (
                    <div
                        key={subject}
                        className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                        onClick={() => onViewDetails?.(subject)}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-700">
                                {BAGRUT_SUBJECT_LABELS[subject]}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">
                                    {stats.studentsCount} תלמידים
                                </span>
                                <span className={`px-2 py-1 rounded-full text-sm font-bold ${
                                    stats.avgScore >= 56
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {Math.round(stats.avgScore)}%
                                </span>
                            </div>
                        </div>

                        {stats.commonWeakTopics.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-amber-600">
                                <IconAlertTriangle size={16} />
                                <span>נושאים לחיזוק: {stats.commonWeakTopics.slice(0, 2).join(', ')}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Summary stats */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex gap-4">
                <div className="flex-1 text-center">
                    <div className="text-2xl font-bold text-[#8B5CF6]">
                        {subjects.length}
                    </div>
                    <div className="text-xs text-slate-500">מקצועות פעילים</div>
                </div>
                <div className="flex-1 text-center">
                    <div className="text-2xl font-bold text-[#2B59C3]">
                        {data.students.length}
                    </div>
                    <div className="text-xs text-slate-500">תלמידים מתרגלים</div>
                </div>
                <div className="flex-1 text-center">
                    <div className={`text-2xl font-bold ${
                        subjects.reduce((sum, [, s]) => sum + s.avgScore, 0) / subjects.length >= 56
                            ? 'text-emerald-500'
                            : 'text-amber-500'
                    }`}>
                        {Math.round(subjects.reduce((sum, [, s]) => sum + s.avgScore, 0) / subjects.length) || 0}%
                    </div>
                    <div className="text-xs text-slate-500">ממוצע כללי</div>
                </div>
            </div>
        </div>

        {showAssignmentModal && (
            <BagrutAssignmentModal
                teacherId={teacherId}
                teacherName={teacherName}
                onClose={() => setShowAssignmentModal(false)}
            />
        )}
        </>
    );
}

export default BagrutProgressSummary;
