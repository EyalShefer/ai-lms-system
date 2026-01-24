import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { StudentMistakesPanel } from './StudentMistakesPanel';
import { ScaffoldingPatternsSummary } from './ScaffoldingPatternsSummary';

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

// Journey Summary Card (Compact) + Modal for full view
const JourneySummary: React.FC<{ student: StudentAnalytics }> = ({ student }) => {
    const [showModal, setShowModal] = useState(false);

    // Calculate journey stats including variant analysis
    const stats = useMemo(() => {
        if (!student.journey || student.journey.length === 0) {
            return {
                success: 0, failure: 0, הבנה: 0, total: 0, completionRate: 0,
                startingPath: null as 'הבנה' | 'יישום' | 'העמקה' | null,
                variantCounts: { הבנה: 0, יישום: 0, העמקה: 0 }
            };
        }

        const success = student.journey.filter(n => n.status === 'success').length;
        const failure = student.journey.filter(n => n.status === 'failure').length;
        const הבנהCount = student.journey.filter(n => n.type === 'הבנה').length;
        const total = student.journey.length;
        const completionRate = total > 0 ? Math.round((success / (success + failure || 1)) * 100) : 0;

        // Analyze variants used (הבנה=Understanding, יישום=Application, העמקה=Deepening)
        const variantCounts = { הבנה: 0, יישום: 0, העמקה: 0 };
        let startingPath: 'הבנה' | 'יישום' | 'העמקה' | null = null;

        student.journey.forEach((node, idx) => {
            if (node.variantUsed) {
                variantCounts[node.variantUsed]++;
                // Get the first variant as starting path
                if (idx === 0 || (startingPath === null && node.type === 'question')) {
                    startingPath = node.variantUsed;
                }
            }
        });

        return { success, failure, הבנה: הבנהCount, total, completionRate, startingPath, variantCounts };
    }, [student.journey]);

    const hintsUsed = student.performance?.hintDependency
        ? Math.round(student.performance.hintDependency * (student.performance.totalQuestions || 0))
        : 0;

    if (!student.journey || student.journey.length === 0) {
        return (
            <div className="bento-card rounded-2xl p-4 text-center text-slate-400 text-sm">
                אין נתוני מסלול עדיין
            </div>
        );
    }

    return (
        <>
            {/* Compact Summary Card */}
            <div className="bento-card ai-glow rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold flex items-center gap-2">
                        <div className="ai-icon-container w-10 h-10">
                            <IconActivity className="w-5 h-5 text-white" />
                        </div>
                        <span className="ai-gradient-text">סיכום מסלול למידה</span>
                    </h4>
                    <button
                        onClick={() => setShowModal(true)}
                        className="ai-action-btn px-3 py-1.5 text-xs"
                    >
                        <IconEye size={14} />
                        צפה במסלול המלא
                    </button>
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-1.5 bento-card bg-green-50 text-green-700 px-3 py-2 rounded-xl">
                        <IconCheck size={16} />
                        <span className="font-black text-lg">{stats.success}</span>
                        <span className="text-xs">הצלחות</span>
                    </div>
                    <div className="flex items-center gap-1.5 bento-card bg-slate-100 text-slate-600 px-3 py-2 rounded-xl">
                        <IconX size={16} />
                        <span className="font-black text-lg">{stats.failure}</span>
                        <span className="text-xs">כישלונות</span>
                    </div>
                    <div className="flex items-center gap-1.5 bento-card bg-amber-50 text-amber-700 px-3 py-2 rounded-xl">
                        <IconRefresh size={16} />
                        <span className="font-black text-lg">{stats.remediation}</span>
                        <span className="text-xs">חיזוק</span>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                        <IconCheck size={14} className="text-indigo-500" /> הצלחה: <strong className="text-indigo-700">{stats.completionRate}%</strong>
                    </span>
                    <span className="flex items-center gap-1">
                        <IconBulb size={14} className="text-amber-500" /> רמזים: <strong className="text-slate-700">{hintsUsed}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                        <IconClock size={14} className="text-slate-400" /> זמן ממוצע: <strong className="text-slate-700">{student.performance?.avgResponseTime || 0}s</strong>
                    </span>
                </div>

                {/* Starting Path - Simple display */}
                {stats.startingPath && (
                    <div className="mt-3 pt-3 border-t border-slate-100/50 flex items-center justify-between">
                        <span className="text-xs text-slate-500">מסלול נוכחי:</span>
                        <span className={`ai-pill ${
                            stats.startingPath === 'הבנה' ? 'bg-amber-100 text-amber-700' :
                            stats.startingPath === 'העמקה' ? 'bg-purple-100 text-purple-700' :
                            ''
                        }`}>
                            {stats.startingPath === 'הבנה' ? 'הבנה' :
                             stats.startingPath === 'העמקה' ? 'העמקה' : 'יישום'}
                        </span>
                    </div>
                )}
            </div>

            {/* Full Journey Modal - Using Portal to render above everything */}
            {showModal && createPortal(
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 md:p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-slate-200" dir="rtl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-white p-5 border-b border-slate-100 shrink-0 rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                        <IconActivity className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">מסלול הלמידה של {student.name}</h3>
                                        <p className="text-slate-500 text-sm">כל השלבים שהתלמיד עבר בפעילות</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                                >
                                    <IconX size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {/* Legend - מקרא */}
                            <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-100">
                                <div className="text-xs font-bold text-slate-500 mb-3">מקרא</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-green-500"></div>
                                        <span className="text-slate-600">תשובה נכונה</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-red-400"></div>
                                        <span className="text-slate-600">תשובה שגויה</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-slate-300"></div>
                                        <span className="text-slate-600">צפייה בתוכן</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-amber-400"></div>
                                        <span className="text-slate-600">שאלת חיזוק</span>
                                    </div>
                                </div>
                                <div className="border-t border-slate-200 mt-3 pt-3">
                                    <div className="text-xs font-bold text-slate-500 mb-2">רמת שאלה (התאמה אוטומטית)</div>
                                    <div className="flex flex-wrap gap-4 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 font-medium">הבנה</span>
                                            <span className="text-slate-500">מותאמת למתקשים</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 font-medium">יישום</span>
                                            <span className="text-slate-500">רמה סטנדרטית</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded border border-purple-200 font-medium">העמקה</span>
                                            <span className="text-slate-500">מאתגרת למתקדמים</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg border border-green-100">
                                    <IconCheck size={14} className="text-green-600" />
                                    <span className="text-sm font-medium text-green-700">{student.journey.filter(n => n.status === 'success').length} נכונות</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
                                    <IconX size={14} className="text-red-500" />
                                    <span className="text-sm font-medium text-red-600">{student.journey.filter(n => n.status === 'failure').length} שגויות</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                                    <IconRefresh size={14} className="text-amber-600" />
                                    <span className="text-sm font-medium text-amber-700">{student.journey.filter(n => n.type === 'remediation').length} חיזוק</span>
                                </div>
                            </div>

                            {/* Journey Timeline */}
                            <div className="space-y-2">
                                {student.journey.map((node, idx) => {
                                    const isRemediation = node.type === 'remediation';
                                    const isQuestion = node.type === 'question';
                                    const isContent = node.type === 'content';
                                    const isSuccess = node.status === 'success';
                                    const isFailure = node.status === 'failure';

                                    // Card background based on status
                                    const cardBg = isSuccess ? 'bg-green-50/70 border-green-200' :
                                                   isFailure ? 'bg-red-50/70 border-red-200' :
                                                   'bg-white border-slate-200';

                                    const typeLabel = isQuestion ? 'שאלה' : isContent ? 'תוכן' : 'שאלת חיזוק';
                                    const statusLabel = isSuccess ? 'נכון' : isFailure ? 'שגוי' : isContent ? 'נצפה' : '';

                                    // Step number background
                                    const stepBg = isSuccess ? 'bg-green-500 text-white' :
                                                   isFailure ? 'bg-red-400 text-white' :
                                                   isRemediation ? 'bg-amber-400 text-white' :
                                                   'bg-slate-200 text-slate-600';

                                    // Indentation for remediation
                                    const indent = isRemediation ? 'mr-6' : '';

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-3 p-3 rounded-xl border ${cardBg} ${indent} transition-all`}
                                        >
                                            {/* Step Number */}
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${stepBg}`}>
                                                {idx + 1}
                                            </div>

                                            {/* Type Label */}
                                            <span className="text-sm text-slate-700">{typeLabel}</span>

                                            {/* Status */}
                                            {statusLabel && (
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                                    isSuccess ? 'bg-green-100 text-green-700' :
                                                    isFailure ? 'bg-red-100 text-red-600' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {statusLabel}
                                                </span>
                                            )}

                                            {/* Spacer */}
                                            <div className="flex-1"></div>

                                            {/* Variant Badge - Show for all variants including יישום (Application) */}
                                            {node.variantUsed && (
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                                                    node.variantUsed === 'הבנה'
                                                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                        : node.variantUsed === 'העמקה'
                                                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    {node.variantUsed === 'הבנה' ? 'הבנה' :
                                                     node.variantUsed === 'העמקה' ? 'העמקה' : 'יישום'}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
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
        <div className="bento-card bento-featured ai-glow rounded-3xl overflow-hidden mb-8">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="ai-icon-container w-12 h-12">
                        <IconChartBar className="w-6 h-6 text-white" />
                    </div>
                    <span className="ai-gradient-text">תובנות כיתתיות - מבט על</span>
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
                                onClick={() => onCreateGroupRemediation('הבנה')}
                                className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <IconSparkles size={14} className="text-amber-500" />
                                צור משימת הבנה לקבוצה
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
                                    <div className="font-bold text-slate-800">יישום</div>
                                    <div className="text-xs text-slate-500">לרוב התלמידים</div>
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
                                onClick={() => onCreateGroupRemediation('יישום')}
                                className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <IconSparkles size={14} className="text-slate-500" />
                                צור משימת יישום לקבוצה
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
                                    <div className="text-xs text-slate-500">מוכנים להעמקה</div>
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
                                onClick={() => onCreateGroupRemediation('העמקה')}
                                className="w-full py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <IconSparkles size={14} className="text-wizdi-action" />
                                צור משימת העמקה לקבוצה
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
            case 'medium': return { label: 'יישום', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <IconUsers className="w-3.5 h-3.5" /> };
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
            <div className="bento-card p-6 text-center text-slate-400">
                אין נתוני תלמידים
            </div>
        );
    }

    return (
        <div className="bento-card ai-glow rounded-3xl overflow-hidden h-full !hover:transform-none" style={{ transform: 'none' }}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <div className="ai-icon-container w-12 h-12">
                        <IconUsers className="w-6 h-6 text-white" />
                    </div>
                    <span className="ai-gradient-text">רשימת תלמידים</span>
                    <span className="text-sm font-normal text-slate-400">({students.length})</span>
                </h2>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 mx-4 mt-4 mb-1 bg-slate-100/50 text-xs font-bold text-slate-500 uppercase tracking-wider rounded-xl">
                <div className="col-span-3">תלמיד/ה</div>
                <div className="col-span-2 text-center">ציון</div>
                <div className="col-span-2 text-center">סטטוס</div>
                <div className="col-span-2 text-center">רמה</div>
                <div className="col-span-2 text-center">מוטיבציה</div>
                <div className="col-span-1 text-center">התראות</div>
            </div>

            {/* Student List - Scrollable with card separation */}
            <div className="max-h-[600px] overflow-y-auto relative z-10 p-4 space-y-3">
                {students.map(s => {
                    const level = getLevelLabel(s.riskLevel);
                    // Use course-specific mastery if available, otherwise calculate average across all courses
                    const avgMastery = s.courseMastery !== undefined
                        ? Math.round(s.courseMastery * 100)
                        : (Object.values(s.mastery || {}).length > 0
                            ? Math.round((Object.values(s.mastery).reduce((a, b) => a + b, 0) / Object.values(s.mastery).length) * 100)
                            : 0);
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
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelectStudent(s.id);
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectStudent(s.id); }}
                            style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}
                            className={`grid grid-cols-12 gap-2 px-5 py-4 items-center transition-all select-none rounded-2xl border [&>*]:pointer-events-none
                                ${selectedStudentId === s.id
                                    ? 'bg-wizdi-royal/5 border-wizdi-royal/30 shadow-md shadow-wizdi-royal/10 ring-2 ring-wizdi-royal/20'
                                    : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm active:bg-slate-100'}
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
                                <div className={`text-lg font-black ${accuracy >= 70 ? 'text-wizdi-royal' : 'text-slate-600'}`}>
                                    {accuracy}%
                                </div>
                                <div className="text-[10px] text-slate-400">דיוק</div>
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
                            <div className="col-span-2 text-center pointer-events-none">
                                <MotivationBadge student={s} />
                            </div>

                            {/* Gaming Alerts */}
                            <div className="col-span-1 text-center pointer-events-none">
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
            <div className="p-4 mx-4 mb-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl">
                <div className="flex justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        מתקשים: <strong className="text-amber-600">{students.filter(s => s.riskLevel === 'high').length}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                        יישום: <strong className="text-slate-600">{students.filter(s => s.riskLevel === 'medium').length}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-wizdi-action"></span>
                        מתקדמים: <strong className="text-wizdi-action">{students.filter(s => s.riskLevel === 'low').length}</strong>
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
        // Use course-specific mastery if available, otherwise calculate average across all courses
        if (student.courseMastery !== undefined) {
            return Math.round(student.courseMastery * 100);
        }
        const values = Object.values(student.mastery || {});
        if (values.length === 0) return 0;
        return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100);
    }, [student.mastery, student.courseMastery]);

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
            <div className="bento-card rounded-2xl p-4 mb-6 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 hover:text-wizdi-royal font-bold transition-colors"
                >
                    <IconList className="w-5 h-5" />
                    חזרה לרשימת התלמידים
                </button>

                <div className="flex items-center gap-4">
                    <span className="ai-pill">
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
                    <div className="bento-card bento-featured ai-glow rounded-3xl p-6">
                        <div className="text-center mb-6">
                            <div className="relative inline-block">
                                <img src={student.avatar} alt={student.name} className="w-24 h-24 rounded-3xl border-4 border-white shadow-lg" loading="lazy" decoding="async" />
                                <div className="absolute -bottom-1 -right-1 ai-icon-container w-8 h-8">
                                    <IconUsers className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <h2 className="text-2xl font-black mt-4">
                                <span className="ai-gradient-text">{student.name}</span>
                            </h2>
                            <div className="text-sm text-slate-500 mt-1">
                                פעילות אחרונה: {new Date(student.lastActive).toLocaleTimeString('he-IL')}
                            </div>
                            <span className="ai-pill mt-2">
                                ID: {student.id.substring(0, 12)}
                            </span>
                        </div>

                        {/* Score */}
                        <div className="bento-card bg-gradient-to-br from-wizdi-royal/10 to-wizdi-cyan/10 p-5 rounded-2xl text-center mb-4">
                            <div className="text-4xl font-black font-mono ai-gradient-text">
                                {avgMastery}%
                            </div>
                            <div className="text-slate-500 uppercase font-bold text-xs tracking-wider mt-1">שליטה ממוצעת</div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2">
                            <button
                                onClick={() => onCreateRemediation(actionConfig.type)}
                                className="ai-action-btn w-full py-3 px-4 text-sm"
                            >
                                {actionConfig.icon}
                                {actionConfig.label}
                            </button>

                            {onGradeOverride && (
                                <button
                                    onClick={onGradeOverride}
                                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm border border-slate-200 bg-white text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                                >
                                    <IconEdit className="w-4 h-4" />
                                    עדכן ציון ידנית
                                </button>
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Column - Main Content */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Row 1: Bloom Taxonomy - Full width */}
                    {bloomProfile ? (
                        <BloomStudentBars
                            profile={bloomProfile}
                            classAverage={classBloomAverage}
                            compact={false}
                        />
                    ) : (
                        <div className="bento-card rounded-2xl p-4">
                            <h4 className="text-slate-700 font-bold mb-2 flex items-center gap-2 text-sm">
                                <div className="ai-icon-container w-8 h-8">
                                    <IconBrain className="w-4 h-4 text-white" />
                                </div>
                                <span className="ai-gradient-text">רמות בלום</span>
                            </h4>
                            <p className="text-xs text-slate-400">אין נתונים זמינים</p>
                        </div>
                    )}

                    {/* Row 2: Mistakes Panel - Main Focus */}
                    <StudentMistakesPanel
                        studentId={student.id}
                        courseId={courseId}
                        studentName={student.name}
                    />

                    {/* Row 2.5: Scaffolding Patterns Summary */}
                    <ScaffoldingPatternsSummary userId={student.id} />

                    {/* Row 3: Journey Summary - Full width */}
                    <div className="bento-card rounded-2xl overflow-hidden">
                        <div className="p-4">
                            <JourneySummary student={student} />
                        </div>
                    </div>

                    {/* Row 4: Conversations */}
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
                console.log('🎯 [TaskDetailDashboard] Starting fetch for courseId:', courseId);

                // Fetch course
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                if (courseDoc.exists()) {
                    const courseData = { id: courseDoc.id, ...courseDoc.data() } as Course;
                    console.log('📚 [TaskDetailDashboard] Course loaded:', courseData.title);
                    setCourse(courseData);
                }

                // Fetch student analytics
                console.log('👥 [TaskDetailDashboard] Fetching analytics for courseId:', courseId);
                const analyticsData = await getSmartCourseAnalytics(courseId);
                console.log('📊 [TaskDetailDashboard] Analytics returned:', analyticsData.length, 'students');
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
                'הבנה': 'הבנה למתקשים',
                'יישום': 'יישום לרוב התלמידים',
                'העמקה': 'העמקה למתקדמים'
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

    // Navigation handlers for student detail view
    const handleSelectStudent = (studentId: string) => {
        // Always use internal view mode for student details
        // (onViewStudent is available but ID formats may not match)
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
                <div className="bento-card bento-featured text-center p-12">
                    <div className="ai-icon-container w-16 h-16 mx-auto mb-4">
                        <IconClipboardCheck className="w-8 h-8 text-white" />
                    </div>
                    <AIStarsSpinner size="xl" color="primary" className="mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">טוען לוח משימה...</p>
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
                {/* Header - Bento Style */}
                <div className="bento-card mb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                    <div>
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 text-slate-500 hover:text-violet-600 mb-4 transition-colors font-medium"
                        >
                            <IconArrowRight size={20} />
                            חזרה לדשבורד
                        </button>
                        <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
                            <div className="ai-icon-container w-14 h-14">
                                <IconClipboardCheck className="w-7 h-7 text-white" />
                            </div>
                            <span className="ai-gradient-text">לוח משימה</span>
                        </h1>
                        <p className="text-slate-500 text-lg">
                            {course?.title ? (
                                <span className="font-semibold ai-gradient-text">{course.title}</span>
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

                    {/* Actions */}
                    <div className="flex gap-4 items-center">
                        <div className="flex items-center gap-2">
                            {/* Access Code Button */}
                            <button
                                onClick={() => setAccessCodeOpen(true)}
                                className="ai-action-btn px-4 py-2.5 text-sm"
                                title="קוד גישה"
                            >
                                <IconKey size={18} />
                                <span className="hidden sm:inline">קוד גישה</span>
                            </button>
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                title="רענן נתונים"
                            >
                                <IconRefresh size={20} className={`text-slate-600 dark:text-slate-300 ${refreshing ? 'animate-spin' : ''}`} />
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
                        <div className="bento-card bento-featured rounded-3xl p-12 text-center">
                            <div className="ai-icon-container w-16 h-16 mx-auto mb-4">
                                <IconUsers className="w-8 h-8 text-white" />
                            </div>
                            <p className="text-slate-500 text-lg">לא נבחר תלמיד</p>
                            <button
                                onClick={handleBackToList}
                                className="ai-action-btn mt-4 px-6 py-2"
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
