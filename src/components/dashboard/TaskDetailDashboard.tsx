import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { AIStarsSpinner } from '../ui/Loading/AIStarsSpinner';
import {
    getSmartCourseAnalytics,
    type StudentAnalytics,
    type JourneyNode
} from '../../services/analyticsService';
import {
    IconArrowRight,
    IconArrowLeft,
    IconUsers,
    IconChartBar,
    IconClock,
    IconAlertTriangle,
    IconCheck,
    IconX,
    IconActivity,
    IconBrain,
    IconDownload,
    IconMail,
    IconEye,
    IconTrendingUp,
    IconTrendingDown,
    IconRefresh,
    IconChevronLeft,
    IconChevronRight,
    IconSparkles,
    IconBook,
    IconClipboardCheck,
    IconPresentation,
    IconHelpCircle,
    IconEdit,
    IconList,
    IconKey,
    IconTrophy,
    IconBulb
} from '@tabler/icons-react';
import type { Course } from '../../shared/types/courseTypes';

// New Dashboard Components
import { SafetyBanner, type SafetyAlert } from './SafetyBanner';
import { OnlineIndicator } from './OnlineIndicator';
import { ExportDropdown } from './ExportPanel';
import { BloomHeatmap, BloomStudentBars } from './BloomHeatmap';
import { BloomRadarChart } from './BloomRadarChart';
import { GradeOverrideModal } from './GradeOverride';
import { MotivationBadge, MotivationMeter } from './MotivationMeter';
import { ReportCardSummaryCompact } from './ReportCardSummary';
import { AiAssistantBanner } from './AiAssistantBanner';
import { StudentConversationPanel } from './StudentConversationPanel';
import { GamingAlertPanel, GamingAlertBadge } from './GamingAlertPanel';

// Bloom Analytics
import {
    analyzeStudentBloom,
    analyzeClassBloom,
    type StudentBloomProfile,
    type ClassBloomSummary,
    BLOOM_LEVELS_ORDERED,
    BLOOM_LABELS_HE
} from '../../services/bloomAnalyticsService';
import type { BloomLevel } from '../../shared/types/courseTypes';

// Access Codes
import { AccessCodeModal } from '../teacher/AccessCodeModal';

// Class Comparison
import { ClassComparison } from './ClassComparison';

// ============ TYPES ============

interface TaskDetailDashboardProps {
    courseId: string;
    onBack: () => void;
    onViewStudent?: (studentId: string) => void;
    onViewLessonPlan?: (courseId: string) => void;
    onEditCourse?: (courseId: string) => void;
    onCreateRemediation?: (studentId?: string, type?: string) => void;
}

// ============ HELPER FUNCTIONS ============

const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} דקות`;
    return `${Math.round(seconds / 3600)} שעות`;
};

// ============ SUB-COMPONENTS ============

// At Risk Students Count Card
const AtRiskCard: React.FC<{ count: number }> = ({ count }) => (
    <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/80 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${count > 0 ? 'bg-gradient-to-br from-wizdi-action to-red-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
            <IconAlertTriangle className="w-7 h-7" />
        </div>
        <div>
            <div className={`text-4xl font-black ${count > 0 ? 'text-wizdi-action' : 'text-slate-800'}`}>{count}</div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">תלמידים בסיכון</div>
        </div>
    </div>
);

// Journey Summary Card (Compact) + Modal for full view
const JourneySummary: React.FC<{ student: StudentAnalytics }> = ({ student }) => {
    const [showModal, setShowModal] = useState(false);

    // Calculate journey stats
    const stats = useMemo(() => {
        if (!student.journey || student.journey.length === 0) {
            return { success: 0, failure: 0, remediation: 0, total: 0, completionRate: 0 };
        }

        const success = student.journey.filter(n => n.status === 'success').length;
        const failure = student.journey.filter(n => n.status === 'failure').length;
        const remediation = student.journey.filter(n => n.type === 'remediation').length;
        const total = student.journey.length;
        const completionRate = total > 0 ? Math.round((success / (success + failure || 1)) * 100) : 0;

        return { success, failure, remediation, total, completionRate };
    }, [student.journey]);

    const hintsUsed = student.performance?.hintDependency
        ? Math.round(student.performance.hintDependency * (student.performance.totalQuestions || 0))
        : 0;

    if (!student.journey || student.journey.length === 0) {
        return (
            <div className="bg-slate-50 rounded-2xl p-4 text-center text-slate-400 text-sm">
                אין נתוני מסלול עדיין
            </div>
        );
    }

    return (
        <>
            {/* Compact Summary Card */}
            <div className="bg-gradient-to-l from-slate-50 to-white rounded-2xl p-5 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <IconActivity className="w-5 h-5 text-indigo-600" />
                        סיכום מסלול למידה
                    </h4>
                    <button
                        onClick={() => setShowModal(true)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                    >
                        <IconEye size={14} />
                        צפה במסלול המלא
                    </button>
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl">
                        <IconCheck size={16} />
                        <span className="font-black text-lg">{stats.success}</span>
                        <span className="text-xs">הצלחות</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-2 rounded-xl">
                        <IconX size={16} />
                        <span className="font-black text-lg">{stats.failure}</span>
                        <span className="text-xs">כישלונות</span>
                    </div>
                    <div className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl">
                        <IconRefresh size={16} />
                        <span className="font-black text-lg">{stats.remediation}</span>
                        <span className="text-xs">תגבורים</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>אחוז הצלחה</span>
                        <span className="font-bold">{stats.completionRate}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all bg-indigo-500"
                            style={{ width: `${stats.completionRate}%` }}
                        />
                    </div>
                </div>

                {/* Additional Info */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                        <IconBulb size={14} className="text-amber-500" /> רמזים: <strong className="text-slate-700">{hintsUsed} שימושים</strong>
                    </span>
                    <span className="flex items-center gap-1">
                        <IconClock size={14} className="text-slate-400" /> זמן ממוצע: <strong className="text-slate-700">{student.performance?.avgResponseTime || 0}s</strong>
                    </span>
                </div>
            </div>

            {/* Full Journey Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-l from-indigo-600 to-purple-600 p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold flex items-center gap-2">
                                        <IconActivity className="w-7 h-7" />
                                        מסלול למידה: {student.name}
                                    </h3>
                                    <p className="text-indigo-200 mt-1">צפייה מפורטת בכל שלבי הלמידה</p>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <IconX size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4 text-sm">
                            <span className="font-bold text-slate-600">מקרא:</span>
                            <span className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full bg-indigo-500 border-2 border-indigo-600"></span>
                                הצלחה
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full bg-slate-400 border-2 border-slate-500"></span>
                                כישלון
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full bg-indigo-200 border-2 border-indigo-300"></span>
                                תגבור
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full bg-slate-200 border-2 border-slate-300"></span>
                                צפייה בתוכן
                            </span>
                            <span className="flex items-center gap-1 text-indigo-500">
                                - - - קו מקווקו = לולאת חיזוק
                            </span>
                        </div>

                        {/* Journey Visual */}
                        <div className="p-6 overflow-x-auto" dir="rtl">
                            <div className="flex items-center gap-0 w-max px-4 min-w-full" dir="ltr">
                                {student.journey.map((node, idx) => {
                                    const isRemediation = node.type === 'remediation';

                                    return (
                                        <div key={idx} className="flex items-center">
                                            <div className="relative flex flex-col items-center group">
                                                {isRemediation && <div className="absolute inset-0 bg-indigo-300 blur-md opacity-50 animate-pulse rounded-full" />}

                                                <div className={`w-14 h-14 rounded-full border-4 z-10 flex items-center justify-center shadow-lg relative
                                                    ${node.status === 'success' ? 'bg-indigo-500 border-indigo-600' :
                                                        node.status === 'failure' ? 'bg-slate-400 border-slate-500' :
                                                            node.type === 'remediation' ? 'bg-indigo-200 border-indigo-300' : 'bg-slate-200 border-slate-300'}
                                                    transition-transform hover:scale-110 cursor-pointer shrink-0
                                                `}>
                                                    {isRemediation ? <IconRefresh size={24} className="text-indigo-600" stroke={2} /> : node.status === 'success' ? <IconCheck size={24} className="text-white" stroke={3} /> : <IconX size={24} className="text-white" stroke={3} />}
                                                </div>

                                                {/* Step number */}
                                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                                                    {idx + 1}
                                                </div>

                                                {/* Tooltip */}
                                                <div className="absolute top-full mt-3 text-center w-36 -left-12 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="bg-white px-3 py-2 rounded-xl shadow-xl border border-slate-200 text-right">
                                                        <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                                            {node.type === 'question' ? <><IconHelpCircle size={12} /> שאלה</> :
                                                                node.type === 'content' ? <><IconBook size={12} /> תוכן</> :
                                                                    node.type === 'remediation' ? <><IconRefresh size={12} /> תגבור</> : node.type}
                                                        </div>
                                                        <div className={`text-xs mt-1 ${node.status === 'success' ? 'text-indigo-600' : node.status === 'failure' ? 'text-slate-500' : 'text-slate-500'}`}>
                                                            {node.status === 'success' ? '✓ הצליח' : node.status === 'failure' ? '✗ נכשל' : 'צפה'}
                                                        </div>
                                                        {node.connection === 'branched' && (
                                                            <div className="text-[10px] text-indigo-500 font-bold mt-1">לולאת חיזוק</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {idx < student.journey.length - 1 && (
                                                <div className={`h-1.5 w-12 mx-2 rounded-full shrink-0
                                                    ${node.connection === 'branched' ? 'border-t-2 border-dashed border-indigo-400 bg-transparent' : 'bg-slate-300'}
                                                `} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Journey Table */}
                        <div className="px-6 pb-6">
                            <h4 className="font-bold text-slate-700 mb-3">פירוט שלבים</h4>
                            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-right">#</th>
                                            <th className="px-4 py-2 text-right">סוג</th>
                                            <th className="px-4 py-2 text-right">תוצאה</th>
                                            <th className="px-4 py-2 text-right">הערות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {student.journey.map((node, idx) => (
                                            <tr key={idx} className="hover:bg-white">
                                                <td className="px-4 py-2 font-bold text-slate-500">{idx + 1}</td>
                                                <td className="px-4 py-2">
                                                    <span className="flex items-center gap-1">
                                                        {node.type === 'question' ? <><IconHelpCircle size={14} className="text-slate-500" /> שאלה</> :
                                                            node.type === 'content' ? <><IconBook size={14} className="text-slate-500" /> תוכן</> :
                                                                node.type === 'remediation' ? <><IconRefresh size={14} className="text-indigo-500" /> תגבור</> : node.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold
                                                        ${node.status === 'success' ? 'bg-indigo-100 text-indigo-700' :
                                                            node.status === 'failure' ? 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600'}
                                                    `}>
                                                        {node.status === 'success' ? 'הצלחה' : node.status === 'failure' ? 'כישלון' : 'צפייה'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-slate-500 text-xs">
                                                    {node.connection === 'branched' ? 'לולאת חיזוק' : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Class Analytics Overview - Bird's Eye View
const ClassAnalyticsOverview: React.FC<{
    students: StudentAnalytics[];
    onCreateGroupRemediation: (groupType: string) => void;
    classBloomSummary?: ClassBloomSummary | null;
    bloomLoading?: boolean;
}> = ({ students, onCreateGroupRemediation, classBloomSummary, bloomLoading }) => {

    // Calculate class-wide statistics
    const classStats = useMemo(() => {
        if (students.length === 0) return null;

        // Group counts
        const struggling = students.filter(s => s.riskLevel === 'high');
        const average = students.filter(s => s.riskLevel === 'medium');
        const advanced = students.filter(s => s.riskLevel === 'low');

        // Average scores
        const avgAccuracy = students.reduce((sum, s) => sum + (s.performance?.accuracy || 0), 0) / students.length;
        const avgResponseTime = students.reduce((sum, s) => sum + (s.performance?.avgResponseTime || 0), 0) / students.length;
        const avgHintUsage = students.reduce((sum, s) => sum + (s.performance?.hintDependency || 0), 0) / students.length;

        // Common error patterns across class
        const errorCounts: Record<string, number> = {};
        students.forEach(s => {
            Object.entries(s.errorPatterns || {}).forEach(([pattern, count]) => {
                errorCounts[pattern] = (errorCounts[pattern] || 0) + count;
            });
        });
        const topErrors = Object.entries(errorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);

        // Topic mastery analysis
        const topicScores: Record<string, number[]> = {};
        students.forEach(s => {
            Object.entries(s.mastery || {}).forEach(([topic, score]) => {
                if (!topicScores[topic]) topicScores[topic] = [];
                topicScores[topic].push(score);
            });
        });
        const topicAverages = Object.entries(topicScores).map(([topic, scores]) => ({
            topic,
            avg: scores.reduce((a, b) => a + b, 0) / scores.length,
            struggling: scores.filter(s => s < 0.5).length
        })).sort((a, b) => a.avg - b.avg);

        const weakestTopic = topicAverages[0];
        const strongestTopic = topicAverages[topicAverages.length - 1];

        return {
            total: students.length,
            struggling,
            average,
            advanced,
            avgAccuracy: Math.round(avgAccuracy * 100),
            avgResponseTime: Math.round(avgResponseTime),
            avgHintUsage: Math.round(avgHintUsage * 100),
            topErrors,
            weakestTopic,
            strongestTopic,
            topicAverages
        };
    }, [students]);

    if (!classStats) return null;

    return (
        <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden mb-8">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-wizdi-royal/5 to-white">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg">
                        <IconChartBar className="w-6 h-6 text-white" />
                    </div>
                    תובנות כיתתיות - מבט על
                    <span className="text-sm font-normal text-slate-400 mr-auto">({classStats.total} תלמידים)</span>
                </h2>
            </div>

            <div className="p-6">
                {/* Top Row - Task-Specific Insights (Score, Completion, Alerts) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    {/* Class Average Score */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <IconChartBar className="w-5 h-5 text-wizdi-royal" />
                            ציון כיתתי ממוצע
                        </h4>
                        <div className="flex items-center gap-4">
                            <div className="text-4xl font-black text-wizdi-royal">{classStats.avgAccuracy}%</div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-xs mb-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    <span className="text-slate-600">עברו ({classStats.advanced.length + classStats.average.length})</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                    <span className="text-slate-600">נכשלו ({classStats.struggling.length})</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-wizdi-royal rounded-full transition-all"
                                style={{ width: `${classStats.avgAccuracy}%` }}
                            />
                        </div>
                    </div>

                    {/* Completion Status */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <IconUsers className="w-5 h-5 text-slate-500" />
                            סטטוס השלמה
                        </h4>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    סיימו
                                </span>
                                <span className="font-bold text-green-600">{students.filter(s => (s.performance?.accuracy || 0) > 0).length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    בתהליך
                                </span>
                                <span className="font-bold text-blue-600">0</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-600 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                                    לא התחילו
                                </span>
                                <span className="font-bold text-slate-500">{classStats.total - students.filter(s => (s.performance?.accuracy || 0) > 0).length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Alerts - Students requiring attention */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <IconAlertTriangle className={`w-5 h-5 ${classStats.struggling.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                            דורשים תשומת לב
                        </h4>
                        {classStats.struggling.length > 0 ? (
                            <div className="space-y-2">
                                {classStats.struggling.slice(0, 3).map(student => (
                                    <div key={student.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                                        <span className="text-sm text-slate-700 font-medium">{student.name}</span>
                                        <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                                            {Math.round((student.performance?.accuracy || 0) * 100)}%
                                        </span>
                                    </div>
                                ))}
                                {classStats.struggling.length > 3 && (
                                    <p className="text-xs text-slate-500 text-center">+{classStats.struggling.length - 3} נוספים</p>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <IconCheck className="w-5 h-5 text-green-500" />
                                </div>
                                <p className="text-sm text-slate-500">אין תלמידים בסיכון</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bloom Taxonomy Row - Integrated */}
                {bloomLoading ? (
                    <div className="mb-6 bg-white rounded-2xl p-4 border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center animate-pulse">
                                <IconBrain className="w-4 h-4 text-purple-500" />
                            </div>
                            <span className="text-sm text-slate-500">טוען נתוני בלום...</span>
                        </div>
                    </div>
                ) : classBloomSummary ? (
                    <div className="mb-6 bg-white rounded-2xl p-4 border border-slate-200">
                        <div className="flex items-center gap-4">
                            {/* Title */}
                            <div className="flex items-center gap-2 min-w-fit">
                                <IconBrain className="w-5 h-5 text-purple-500" />
                                <span className="text-sm font-bold text-slate-700">בלום</span>
                            </div>

                            {/* Levels - Inline compact */}
                            <div className="flex-1 flex items-center gap-2">
                                {BLOOM_LEVELS_ORDERED.map(level => {
                                    const avg = classBloomSummary.averageByLevel[level];
                                    const isWeakest = classBloomSummary.commonWeakness === level;
                                    const isStrongest = classBloomSummary.commonStrength === level;

                                    return (
                                        <div
                                            key={level}
                                            className={`
                                                flex-1 text-center py-2 px-1 rounded-lg transition-all bg-slate-50
                                                ${isWeakest ? 'ring-1 ring-red-300' : ''}
                                                ${isStrongest ? 'ring-1 ring-green-300' : ''}
                                            `}
                                            title={BLOOM_LABELS_HE[level]}
                                        >
                                            <div
                                                className="text-sm font-black"
                                                style={{ color: avg >= 70 ? '#059669' : avg >= 50 ? '#f59e0b' : '#ef4444' }}
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
                            {(classBloomSummary.commonWeakness || classBloomSummary.commonStrength) && (
                                <div className="flex items-center gap-2 text-xs">
                                    {classBloomSummary.commonWeakness && (
                                        <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg whitespace-nowrap">
                                            <IconAlertTriangle className="w-3 h-3" />
                                            {BLOOM_LABELS_HE[classBloomSummary.commonWeakness]}
                                        </span>
                                    )}
                                    {classBloomSummary.commonStrength && (
                                        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg whitespace-nowrap">
                                            <IconTrophy className="w-3 h-3" />
                                            {BLOOM_LABELS_HE[classBloomSummary.commonStrength]}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* Bottom Row - Groups Distribution + Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Struggling Group */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                    <IconTrendingDown className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">מתקשים</div>
                                    <div className="text-xs text-slate-500">צריכים תגבור</div>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-amber-500">{classStats.struggling.length}</div>
                        </div>
                        <div className="text-xs text-slate-500 mb-3 max-h-16 overflow-y-auto">
                            {classStats.struggling.slice(0, 4).map(s => s.name).join(', ')}
                            {classStats.struggling.length > 4 && ` +${classStats.struggling.length - 4}`}
                        </div>
                        {classStats.struggling.length > 0 && (
                            <button
                                onClick={() => onCreateGroupRemediation('scaffolding')}
                                className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <IconSparkles size={14} className="text-amber-500" />
                                צור משימת תגבור לקבוצה
                            </button>
                        )}
                    </div>

                    {/* Average Group */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                    <IconUsers className="w-5 h-5 text-slate-500" />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">רמת כיתה</div>
                                    <div className="text-xs text-slate-500">מסלול סטנדרטי</div>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-600">{classStats.average.length}</div>
                        </div>
                        <div className="text-xs text-slate-500 mb-3 max-h-16 overflow-y-auto">
                            {classStats.average.slice(0, 4).map(s => s.name).join(', ')}
                            {classStats.average.length > 4 && ` +${classStats.average.length - 4}`}
                        </div>
                        {classStats.average.length > 0 && (
                            <button
                                onClick={() => onCreateGroupRemediation('standard')}
                                className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <IconSparkles size={14} className="text-slate-500" />
                                צור משימה מותאמת לקבוצה
                            </button>
                        )}
                    </div>

                    {/* Advanced Group */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                    <IconTrendingUp className="w-5 h-5 text-wizdi-action" />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">מתקדמים</div>
                                    <div className="text-xs text-slate-500">מוכנים להעשרה</div>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-wizdi-action">{classStats.advanced.length}</div>
                        </div>
                        <div className="text-xs text-slate-500 mb-3 max-h-16 overflow-y-auto">
                            {classStats.advanced.slice(0, 4).map(s => s.name).join(', ')}
                            {classStats.advanced.length > 4 && ` +${classStats.advanced.length - 4}`}
                        </div>
                        {classStats.advanced.length > 0 && (
                            <button
                                onClick={() => onCreateGroupRemediation('enrichment')}
                                className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <IconSparkles size={14} className="text-wizdi-action" />
                                צור משימת העשרה לקבוצה
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Student List with Full Details
const StudentListPanel: React.FC<{
    students: StudentAnalytics[];
    selectedStudentId: string | null;
    onSelectStudent: (id: string) => void;
}> = ({ students, selectedStudentId, onSelectStudent }) => {

    const getLevelLabel = (riskLevel: string) => {
        switch (riskLevel) {
            case 'high': return { label: 'מתקשה', color: 'bg-amber-100 text-amber-600 border-amber-200', icon: <IconTrendingDown className="w-3.5 h-3.5" /> };
            case 'medium': return { label: 'רמת כיתה', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <IconUsers className="w-3.5 h-3.5" /> };
            case 'low': return { label: 'מתקדם', color: 'bg-wizdi-action/10 text-wizdi-action border-wizdi-action/20', icon: <IconTrendingUp className="w-3.5 h-3.5" /> };
            default: return { label: 'לא ידוע', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <IconHelpCircle className="w-3.5 h-3.5" /> };
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch {
            return '-';
        }
    };

    if (students.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm text-center text-slate-400">
                אין נתוני תלמידים
            </div>
        );
    }

    return (
        <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden h-full">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-wizdi-royal/5 to-white">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg">
                        <IconUsers className="w-6 h-6 text-white" />
                    </div>
                    רשימת תלמידים
                    <span className="text-sm font-normal text-slate-400">({students.length})</span>
                </h2>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <div className="col-span-3">תלמיד/ה</div>
                <div className="col-span-2 text-center">ציון</div>
                <div className="col-span-2 text-center">סטטוס</div>
                <div className="col-span-2 text-center">רמה</div>
                <div className="col-span-2 text-center">מוטיבציה</div>
                <div className="col-span-1 text-center">התראות</div>
            </div>

            {/* Student List - Scrollable */}
            <div className="max-h-[600px] overflow-y-auto">
                {students.map(s => {
                    const level = getLevelLabel(s.riskLevel);
                    const avgMastery = Object.values(s.mastery || {}).length > 0
                        ? Math.round((Object.values(s.mastery).reduce((a, b) => a + b, 0) / Object.values(s.mastery).length) * 100)
                        : 0;
                    const accuracy = Math.round((s.performance?.accuracy || 0) * 100);

                    // Calculate submission status
                    const totalQuestions = s.performance?.totalQuestions || 0;
                    const completedQuestions = s.performance?.correctAnswers !== undefined
                        ? s.performance.correctAnswers + (s.performance.totalQuestions || 0) - (s.performance.correctAnswers || 0)
                        : 0;
                    const hasStarted = totalQuestions > 0 || s.journey?.length > 0;
                    const isComplete = s.journey?.length > 0 && s.journey.every(j => j.status === 'success' || j.status === 'failure');
                    const lastActiveDate = s.lastActive ? new Date(s.lastActive) : null;
                    const isLate = lastActiveDate && lastActiveDate < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

                    const getSubmissionStatus = () => {
                        if (isComplete) {
                            return { label: 'הוגש', color: 'bg-green-100 text-green-700', icon: <IconCheck className="w-3.5 h-3.5" /> };
                        }
                        if (hasStarted && !isComplete) {
                            return { label: 'בתהליך', color: 'bg-blue-100 text-blue-700', icon: <IconClock className="w-3.5 h-3.5" /> };
                        }
                        if (isLate) {
                            return { label: 'איחור', color: 'bg-red-100 text-red-700', icon: <IconAlertTriangle className="w-3.5 h-3.5" /> };
                        }
                        return { label: 'לא התחיל', color: 'bg-slate-100 text-slate-500', icon: <IconClock className="w-3.5 h-3.5" /> };
                    };

                    const submissionStatus = getSubmissionStatus();

                    return (
                        <div
                            key={s.id}
                            onClick={() => onSelectStudent(s.id)}
                            className={`grid grid-cols-12 gap-2 px-5 py-4 items-center cursor-pointer transition-all border-b border-slate-50
                                ${selectedStudentId === s.id
                                    ? 'bg-wizdi-royal/5 border-r-4 border-r-wizdi-royal'
                                    : 'hover:bg-slate-50'}
                            `}
                        >
                            {/* Student Info */}
                            <div className="col-span-3 flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                        <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                    </div>
                                    {/* Online Indicator */}
                                    <span className="absolute -bottom-0.5 -right-0.5">
                                        <OnlineIndicator isOnline={Math.random() > 0.5} size="sm" />
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 text-sm truncate">{s.name}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{s.email || `ID: ${s.id.substring(0, 8)}`}</div>
                                </div>
                            </div>

                            {/* Score */}
                            <div className="col-span-2 text-center">
                                <div className={`text-lg font-black ${avgMastery >= 70 ? 'text-wizdi-royal' : 'text-slate-600'}`}>
                                    {avgMastery}%
                                </div>
                                <div className="text-[10px] text-slate-400">ממוצע</div>
                            </div>

                            {/* Submission Status */}
                            <div className="col-span-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${submissionStatus.color}`}>
                                    {submissionStatus.icon}
                                    <span>{submissionStatus.label}</span>
                                </span>
                                {lastActiveDate && (
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        {formatDate(s.lastActive)}
                                    </div>
                                )}
                            </div>

                            {/* Level */}
                            <div className="col-span-2 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${level.color}`}>
                                    {level.icon}
                                    <span>{level.label}</span>
                                </span>
                            </div>

                            {/* Motivation */}
                            <div className="col-span-2 text-center">
                                <MotivationBadge student={s} />
                            </div>

                            {/* Gaming Alerts */}
                            <div className="col-span-1 text-center">
                                {s.performance?.avgResponseTime && s.performance.avgResponseTime < 5 && accuracy < 50 ? (
                                    <GamingAlertBadge
                                        analysis={{
                                            hasGaming: true,
                                            overallRisk: 'medium',
                                            alerts: [{ type: 'quick_skip', confidence: 0.7, evidence: [], severity: 'medium', timestamp: Date.now() }],
                                            summary: 'זוהו דפוסים חשודים'
                                        }}
                                        size="sm"
                                    />
                                ) : (
                                    <span className="text-xs text-slate-300">-</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Summary */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="flex justify-between text-xs text-slate-500">
                    <span>
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1"></span>
                        מתקשים: {students.filter(s => s.riskLevel === 'high').length}
                    </span>
                    <span>
                        <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1"></span>
                        רמת כיתה: {students.filter(s => s.riskLevel === 'medium').length}
                    </span>
                    <span>
                        <span className="inline-block w-2 h-2 rounded-full bg-wizdi-action mr-1"></span>
                        מתקדמים: {students.filter(s => s.riskLevel === 'low').length}
                    </span>
                </div>
            </div>
        </div>
    );
};

// Student Detail Panel - Full Width with Navigation
const StudentDetailPanel: React.FC<{
    student: StudentAnalytics;
    courseId: string;
    courseTitle?: string;
    onCreateRemediation: (type: string) => void;
    onGradeOverride?: () => void;
    onBack: () => void;
    onPrevStudent?: () => void;
    onNextStudent?: () => void;
    currentIndex: number;
    totalStudents: number;
    bloomProfile?: StudentBloomProfile;
    classBloomAverage?: Record<BloomLevel, number>;
}> = ({ student, courseId, courseTitle, onCreateRemediation, onGradeOverride, onBack, onPrevStudent, onNextStudent, currentIndex, totalStudents, bloomProfile, classBloomAverage }) => {
    const avgMastery = useMemo(() => {
        const values = Object.values(student.mastery || {});
        if (values.length === 0) return 0;
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100);
    }, [student.mastery]);

    const getActionConfig = () => {
        if (student.riskLevel === 'high') {
            return {
                label: 'צור יחידת חיזוק אישית',
                icon: <IconAlertTriangle className="w-5 h-5" />,
                color: 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200',
                type: 'Scaffolding'
            };
        } else if (student.riskLevel === 'low') {
            return {
                label: 'צור יחידת אתגר',
                icon: <IconActivity className="w-5 h-5" />,
                color: 'bg-wizdi-action/10 text-wizdi-action border-wizdi-action/20 hover:bg-wizdi-action/20',
                type: 'Enrichment'
            };
        }
        return {
            label: 'צור יחידה מותאמת',
            icon: <IconBrain className="w-5 h-5" />,
            color: 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200',
            type: 'Adaptive'
        };
    };

    const actionConfig = getActionConfig();

    return (
        <div className="animate-in fade-in duration-300">
            {/* Navigation Bar */}
            <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-6 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 hover:text-wizdi-royal font-bold transition-colors"
                >
                    <IconList className="w-5 h-5" />
                    חזרה לרשימת התלמידים
                </button>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">
                        תלמיד {currentIndex + 1} מתוך {totalStudents}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onPrevStudent}
                            disabled={!onPrevStudent}
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="תלמיד קודם"
                        >
                            <IconChevronRight className="w-5 h-5 text-slate-600" />
                        </button>
                        <button
                            onClick={onNextStudent}
                            disabled={!onNextStudent}
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="תלמיד הבא"
                        >
                            <IconChevronLeft className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content - Two Column Layout for Wide Screens */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Student Info & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Student Profile Card */}
                    <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                        <div className="text-center mb-6">
                            <img src={student.avatar} alt={student.name} className="w-24 h-24 rounded-3xl border-4 border-white shadow-lg mx-auto" loading="lazy" decoding="async" />
                            <h2 className="text-2xl font-black text-slate-800 mt-4">{student.name}</h2>
                            <div className="text-sm text-slate-500 mt-1">
                                פעילות אחרונה: {new Date(student.lastActive).toLocaleTimeString('he-IL')}
                            </div>
                            <div className="text-xs text-wizdi-royal font-mono bg-wizdi-royal/10 px-2 py-1 rounded-lg inline-block mt-2">
                                ID: {student.id.substring(0, 12)}
                            </div>
                        </div>

                        {/* Score */}
                        <div className="bg-gradient-to-br from-wizdi-royal/10 to-wizdi-cyan/10 p-5 rounded-2xl border border-wizdi-royal/20 text-center mb-4">
                            <div className="text-4xl font-black font-mono text-wizdi-royal">
                                {avgMastery}%
                            </div>
                            <div className="text-wizdi-royal/70 uppercase font-bold text-xs tracking-wider mt-1">שליטה ממוצעת</div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            <button
                                onClick={() => onCreateRemediation(actionConfig.type)}
                                className={`w-full py-3 px-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${actionConfig.color}`}
                            >
                                {actionConfig.icon}
                                {actionConfig.label}
                            </button>

                            {onGradeOverride && (
                                <button
                                    onClick={onGradeOverride}
                                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm border border-slate-200 bg-slate-50 text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                                >
                                    <IconEdit className="w-4 h-4" />
                                    עדכן ציון ידנית
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Performance Metrics */}
                    {student.performance && (
                        <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <IconChartBar className="w-5 h-5 text-wizdi-royal" />
                                מדדי ביצוע
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-wizdi-royal/10 p-3 rounded-xl text-center">
                                    <div className="text-xl font-black text-wizdi-royal">
                                        {Math.round(student.performance.accuracy * 100)}%
                                    </div>
                                    <div className="text-[10px] text-wizdi-royal/70 font-bold uppercase">דיוק</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl text-center">
                                    <div className="text-xl font-black text-slate-700">
                                        {student.performance.avgResponseTime}s
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">זמן תגובה</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl text-center">
                                    <div className="text-xl font-black text-slate-700">
                                        {student.performance.totalQuestions}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">שאלות</div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl text-center">
                                    <div className="text-xl font-black text-slate-700">
                                        {Math.round(student.performance.hintDependency * 100)}%
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-bold uppercase">רמזים</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Report Card Summary */}
                    <ReportCardSummaryCompact
                        student={student}
                        courseTitle={courseTitle || "פעילות לימודית"}
                    />
                </div>

                {/* Right Column - Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Error Patterns */}
                    {student.errorPatterns && Object.keys(student.errorPatterns).length > 0 && (
                        <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-3xl p-6 border border-slate-200/80 shadow-sm">
                            <h4 className="text-slate-700 font-bold mb-4 flex items-center gap-2">
                                <IconAlertTriangle className="w-5 h-5 text-wizdi-action" />
                                דפוסי שגיאות נפוצים
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(student.errorPatterns).map(([pattern, count]) => (
                                    <span key={pattern} className="bg-slate-50 px-4 py-2 rounded-xl text-sm border border-slate-200 flex items-center gap-2">
                                        <span className="font-medium text-slate-700">{pattern}</span>
                                        <span className="bg-wizdi-royal/10 text-wizdi-royal px-2 py-0.5 rounded-full text-xs font-bold">{count}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bloom & Motivation - Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Bloom Progress Bars - Individual Student */}
                        {bloomProfile ? (
                            <BloomStudentBars
                                profile={bloomProfile}
                                classAverage={classBloomAverage}
                                compact={true}
                            />
                        ) : (
                            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-100 bg-gradient-to-l from-purple-50 to-white">
                                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                        <span className="w-2 h-5 bg-purple-500 rounded-full"></span>
                                        ניתוח רמות בלום
                                    </h3>
                                </div>
                                <div className="p-6 text-center">
                                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <IconBrain className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <p className="text-sm text-slate-500">אין נתוני בלום זמינים</p>
                                </div>
                            </div>
                        )}

                        {/* Motivation Meter - Compact */}
                        <div className="bg-white rounded-[24px] p-5 border border-slate-200 shadow-sm">
                            <h4 className="text-slate-700 font-bold mb-3 flex items-center gap-2 text-base">
                                <IconActivity className="w-5 h-5 text-amber-500" />
                                מד מוטיבציה
                            </h4>
                            <MotivationMeter student={student} size="md" />
                        </div>
                    </div>

                    {/* AI Insights Section */}
                    <div className="bg-gradient-to-br from-wizdi-royal/5 to-wizdi-cyan/5 border border-wizdi-royal/20 p-6 rounded-3xl flex gap-4">
                        <div className="bg-gradient-to-br from-wizdi-royal to-wizdi-cyan p-3 rounded-xl h-fit text-white shadow-lg shrink-0">
                            <IconBrain className="w-7 h-7" />
                        </div>
                        <div>
                            <strong className="block text-lg font-bold mb-2 text-wizdi-royal">תובנות המערכת (AI)</strong>
                            <p className="leading-relaxed text-slate-700">
                                {student.riskLevel === 'high'
                                    ? `התלמיד מגלה קושי (דיוק ${Math.round((student.performance?.accuracy || 0) * 100)}%). ${student.performance?.hintDependency && student.performance.hintDependency > 0.5 ? 'תלות גבוהה ברמזים.' : ''} מומלץ: תוכן מותאם עם פיגומים. ${Object.keys(student.errorPatterns || {}).length > 0 ? `שגיאות נפוצות: ${Object.keys(student.errorPatterns || {}).slice(0, 2).join(', ')}.` : ''}`
                                    : student.riskLevel === 'low'
                                        ? `התלמיד מצטיין! דיוק ${Math.round((student.performance?.accuracy || 0) * 100)}%, זמן תגובה מהיר (${student.performance?.avgResponseTime || 0}s). מומלץ: תוכן מועשר עם אתגרים נוספים.`
                                        : `התלמיד מתקדם בצורה יציבה (דיוק ${Math.round((student.performance?.accuracy || 0) * 100)}%). מקבל תוכן במסלול הסטנדרטי. ${student.performance?.hintDependency && student.performance.hintDependency > 0.3 ? 'שימוש מתון ברמזים.' : ''}`
                                }
                            </p>
                            <div className="mt-4 flex items-center gap-3">
                                <span className="text-sm font-bold text-wizdi-royal">מסלול מומלץ:</span>
                                <span className={`px-3 py-1.5 rounded-xl font-bold text-sm flex items-center gap-1.5 ${student.riskLevel === 'high' ? 'bg-amber-100 text-amber-600' :
                                        student.riskLevel === 'low' ? 'bg-wizdi-action/10 text-wizdi-action' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    {student.riskLevel === 'high' ? <><IconTrendingDown className="w-4 h-4" /> Scaffolding</> :
                                        student.riskLevel === 'low' ? <><IconTrendingUp className="w-4 h-4" /> Enrichment</> : <><IconUsers className="w-4 h-4" /> Original</>}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Journey Trace */}
                    <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="p-6">
                            <JourneySummary student={student} />
                        </div>
                    </div>

                    {/* Student Conversations with Teaching Agent */}
                    <StudentConversationPanel
                        studentId={student.id}
                        courseId={courseId}
                        studentName={student.name}
                    />
                </div>
            </div>
        </div>
    );
};

// ============ MAIN COMPONENT ============

export const TaskDetailDashboard: React.FC<TaskDetailDashboardProps> = ({
    courseId,
    onBack,
    onViewStudent,
    onViewLessonPlan,
    onEditCourse,
    onCreateRemediation
}) => {
    const [course, setCourse] = useState<Course | null>(null);
    const [students, setStudents] = useState<StudentAnalytics[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Bloom Analytics State
    const [bloomProfiles, setBloomProfiles] = useState<StudentBloomProfile[]>([]);
    const [classBloomSummary, setClassBloomSummary] = useState<ClassBloomSummary | null>(null);
    const [bloomLoading, setBloomLoading] = useState(false);

    // Fetch course and student analytics
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch course
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                if (courseDoc.exists()) {
                    setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
                }

                // Fetch student analytics
                const analyticsData = await getSmartCourseAnalytics(courseId);
                setStudents(analyticsData);
            } catch (error) {
                console.error('Error fetching task detail data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId]);

    const handleRefresh = async () => {
        setRefreshing(true);
        const analyticsData = await getSmartCourseAnalytics(courseId);
        setStudents(analyticsData);
        setRefreshing(false);
    };

    // Fetch Bloom analytics when students are loaded
    useEffect(() => {
        const fetchBloomData = async () => {
            if (students.length === 0) return;

            setBloomLoading(true);
            console.log('[Bloom] Starting fetch for', students.length, 'students, courseId:', courseId);
            try {
                // Fetch class summary
                const classSummary = await analyzeClassBloom(courseId);
                console.log('[Bloom] Class summary:', classSummary);
                setClassBloomSummary(classSummary);

                // Fetch individual student profiles
                const profiles = await Promise.all(
                    students.map(s => analyzeStudentBloom(s.id, courseId))
                );
                const validProfiles = profiles.filter((p): p is StudentBloomProfile => p !== null);
                console.log('[Bloom] Profiles:', validProfiles.length, 'valid out of', profiles.length);
                setBloomProfiles(validProfiles);
            } catch (error) {
                console.error('Error fetching Bloom data:', error);
            } finally {
                setBloomLoading(false);
            }
        };

        fetchBloomData();
    }, [students, courseId]);

    // Safety alerts state (mock data - in production would come from securityService)
    const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);

    // Grade override modal state
    const [gradeOverrideOpen, setGradeOverrideOpen] = useState(false);
    const [gradeOverrideStudent, setGradeOverrideStudent] = useState<StudentAnalytics | null>(null);

    // Access code modal state
    const [accessCodeOpen, setAccessCodeOpen] = useState(false);

    const handleDismissSafetyAlert = (alertId: string) => {
        setSafetyAlerts(prev => prev.filter(a => a.id !== alertId));
    };

    const handleGradeOverride = async (newScore: number, reason: string) => {
        // In production, would save to Firestore
        console.log('Grade override:', { studentId: gradeOverrideStudent?.id, newScore, reason });
        setGradeOverrideOpen(false);
        setGradeOverrideStudent(null);
    };

    const handleCreateGroupRemediation = (groupType: string) => {
        if (onCreateRemediation) {
            onCreateRemediation(undefined, groupType);
        } else {
            const typeLabels: Record<string, string> = {
                'scaffolding': 'תגבור למתקשים',
                'standard': 'מותאמת לרמת כיתה',
                'enrichment': 'העשרה למתקדמים'
            };
            alert(`יצירת משימת ${typeLabels[groupType] || groupType} - יתווסף בקרוב`);
        }
    };

    const handleCreateStudentRemediation = (type: string) => {
        if (onCreateRemediation && selectedStudentId) {
            onCreateRemediation(selectedStudentId, type);
        } else {
            alert(`יצירת יחידת ${type} עבור תלמיד - יתווסף בקרוב`);
        }
    };

    const selectedStudent = students.find(s => s.id === selectedStudentId);
    const selectedStudentIndex = students.findIndex(s => s.id === selectedStudentId);
    const atRiskCount = students.filter(s => s.riskLevel === 'high').length;

    // Navigation handlers for student detail view
    const handleSelectStudent = (studentId: string) => {
        setSelectedStudentId(studentId);
        setViewMode('detail');
    };

    const handleBackToList = () => {
        setViewMode('list');
    };

    const handlePrevStudent = () => {
        if (selectedStudentIndex > 0) {
            setSelectedStudentId(students[selectedStudentIndex - 1].id);
        }
    };

    const handleNextStudent = () => {
        if (selectedStudentIndex < students.length - 1) {
            setSelectedStudentId(students[selectedStudentIndex + 1].id);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <AIStarsSpinner size="xl" color="primary" className="mx-auto mb-4" />
                    <p className="text-slate-500">טוען לוח משימה...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans overflow-x-hidden" dir="rtl">
            {/* Safety Banner - Top of page */}
            {safetyAlerts.length > 0 && (
                <div className="max-w-7xl mx-auto mb-6">
                    <SafetyBanner
                        alerts={safetyAlerts}
                        onDismiss={handleDismissSafetyAlert}
                        onViewDetails={(alert) => {
                            const student = students.find(s => s.id === alert.studentId);
                            if (student) setSelectedStudentId(student.id);
                        }}
                        onMarkResolved={handleDismissSafetyAlert}
                    />
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 border-b border-slate-200 pb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                    <div>
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors"
                        >
                            <IconArrowRight size={20} />
                            חזרה לדשבורד
                        </button>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 flex items-center gap-3">
                            <div className="w-14 h-14 bg-gradient-to-br from-wizdi-royal to-wizdi-cyan rounded-2xl flex items-center justify-center shadow-lg">
                                <IconClipboardCheck className="w-7 h-7 text-white" />
                            </div>
                            לוח משימה
                        </h1>
                        <p className="text-slate-500 text-lg">
                            {course?.title ? (
                                <span className="font-semibold text-wizdi-royal">{course.title}</span>
                            ) : 'מבט על כיתתי בזמן אמת'}
                            {' • '}
                            <span>ביצועים, מסלולי למידה וזיהוי פערים</span>
                        </p>
                        {/* Class/Group Tags */}
                        {course && (course.gradeLevel || course.subject || course.targetAudience) && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {course.gradeLevel && (
                                    <span className="px-3 py-1 bg-wizdi-royal/10 text-wizdi-royal rounded-full text-sm font-bold">
                                        {course.gradeLevel}
                                    </span>
                                )}
                                {course.subject && (
                                    <span className="px-3 py-1 bg-wizdi-cyan/10 text-wizdi-cyan rounded-full text-sm font-bold">
                                        {course.subject}
                                    </span>
                                )}
                                {course.targetAudience && course.targetAudience !== course.gradeLevel && (
                                    <span className="px-3 py-1 bg-wizdi-action/10 text-wizdi-action rounded-full text-sm font-bold">
                                        {course.targetAudience}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* KPI Cards & Actions */}
                    <div className="flex gap-4 items-center">
                        <AtRiskCard count={atRiskCount} />

                        <div className="flex items-center gap-2">
                            {/* Access Code Button */}
                            <button
                                onClick={() => setAccessCodeOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-colors"
                                title="קוד גישה"
                            >
                                <IconKey size={18} />
                                <span className="hidden sm:inline">קוד גישה</span>
                            </button>
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                                title="רענן נתונים"
                            >
                                <IconRefresh size={20} className={`text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <ExportDropdown
                                students={students}
                                courseTitle={course?.title || 'פעילות'}
                            />
                        </div>
                    </div>
                </div>

                {/* AI Assistant Banner - Under header and tags */}
                <div className="mb-8">
                    <AiAssistantBanner
                        context={{
                            courseTitle: course?.title,
                            studentCount: students.length,
                            avgAccuracy: students.length > 0
                                ? Math.round(students.reduce((sum, s) => sum + (s.performance?.accuracy || 0), 0) / students.length * 100)
                                : 0,
                            atRiskStudents: students.filter(s => s.riskLevel === 'high').map(s => s.name)
                        }}
                    />
                </div>

                {/* View Mode: List or Detail */}
                {viewMode === 'list' ? (
                    <>
                        {/* Class Analytics Overview - Bird's Eye View (includes Bloom) */}
                        <ClassAnalyticsOverview
                            students={students}
                            onCreateGroupRemediation={handleCreateGroupRemediation}
                            classBloomSummary={classBloomSummary}
                            bloomLoading={bloomLoading}
                        />

                        {/* Student List - Full Width */}
                        <StudentListPanel
                            students={students}
                            selectedStudentId={selectedStudentId}
                            onSelectStudent={handleSelectStudent}
                        />
                    </>
                ) : (
                    /* Student Detail View - Full Width with Navigation */
                    selectedStudent ? (
                        <StudentDetailPanel
                            student={selectedStudent}
                            courseId={courseId}
                            courseTitle={course?.title}
                            onCreateRemediation={handleCreateStudentRemediation}
                            onGradeOverride={() => {
                                setGradeOverrideStudent(selectedStudent);
                                setGradeOverrideOpen(true);
                            }}
                            onBack={handleBackToList}
                            onPrevStudent={selectedStudentIndex > 0 ? handlePrevStudent : undefined}
                            onNextStudent={selectedStudentIndex < students.length - 1 ? handleNextStudent : undefined}
                            currentIndex={selectedStudentIndex}
                            totalStudents={students.length}
                            bloomProfile={bloomProfiles.find(p => p.studentId === selectedStudent.id)}
                            classBloomAverage={classBloomSummary?.averageByLevel}
                        />
                    ) : (
                        <div className="card-glass bg-gradient-to-br from-white to-slate-50/50 rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center">
                            <IconUsers className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg">לא נבחר תלמיד</p>
                            <button
                                onClick={handleBackToList}
                                className="mt-4 px-6 py-2 bg-wizdi-royal text-white rounded-xl font-bold hover:bg-wizdi-royal/90 transition-colors"
                            >
                                חזרה לרשימה
                            </button>
                        </div>
                    )
                )}
            </div>


            {/* Grade Override Modal */}
            {gradeOverrideStudent && (
                <GradeOverrideModal
                    isOpen={gradeOverrideOpen}
                    onClose={() => {
                        setGradeOverrideOpen(false);
                        setGradeOverrideStudent(null);
                    }}
                    studentName={gradeOverrideStudent.name}
                    taskTitle={course?.title || 'פעילות'}
                    currentScore={Math.round((gradeOverrideStudent.performance?.accuracy || 0) * 100)}
                    onSave={handleGradeOverride}
                />
            )}

            {/* Access Code Modal */}
            <AccessCodeModal
                isOpen={accessCodeOpen}
                onClose={() => setAccessCodeOpen(false)}
                courseId={courseId}
                courseTitle={course?.title || 'פעילות'}
                teacherId="current-teacher-id"
            />
        </div>
    );
};

export default TaskDetailDashboard;
