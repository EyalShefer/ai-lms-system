import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
    IconArrowRight,
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
    IconQuestionMark,
    IconBook,
    IconClipboardCheck,
    IconPresentation,
    IconChevronLeft,
    IconRefresh
} from '@tabler/icons-react';
import type { Course } from '../../shared/types/courseTypes';

// ============ TYPES ============

type ContentType = 'activity' | 'exam' | 'lesson';

interface StudentSubmission {
    id: string;
    studentName: string;
    studentEmail?: string;
    submittedAt: any;
    score: number;
    maxScore: number;
    status: 'submitted' | 'in_progress' | 'not_started';
    telemetry?: {
        stepResults: Record<string, 'success' | 'failure' | 'viewed'>;
        hintsUsed: Record<string, number>;
        totalBlocks: number;
        completedBlocks: number;
        successBlocks: number;
        failureBlocks: number;
        timeSpentSeconds?: number;
    };
    answers?: Record<string, any>;
    // For adaptive tracking
    masteryLevel?: number;
    variantUsed?: 'scaffolding' | 'original' | 'enrichment';
}

interface QuestionAnalysis {
    blockId: string;
    question: string;
    type: string;
    correctCount: number;
    incorrectCount: number;
    successRate: number;
    avgTimeSeconds?: number;
    commonWrongAnswers?: { answer: string; count: number }[];
}

interface ControlCenterProps {
    courseId: string;
    onBack: () => void;
    onViewStudent?: (studentId: string) => void;
    onViewLessonPlan?: (courseId: string) => void;
    onEditCourse?: (courseId: string) => void;
}

// ============ HELPER FUNCTIONS ============

const getContentType = (course: Course | null): ContentType => {
    if (!course) return 'activity';
    const productType = (course as any).productType || course.mode;
    if (productType === 'exam') return 'exam';
    if (productType === 'lesson') return 'lesson';
    return 'activity';
};

const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)} שניות`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} דקות`;
    return `${Math.round(seconds / 3600)} שעות`;
};

const formatDate = (timestamp: any): string => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// ============ SUB-COMPONENTS ============

// Stats Card Component
const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    trend?: { value: number; isPositive: boolean };
}> = ({ title, value, icon, color, trend }) => (
    <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm`}>
        <div className="flex items-start justify-between">
            <div>
                <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
                <p className={`text-3xl font-black ${color}`}>{value}</p>
                {trend && (
                    <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                        {trend.isPositive ? <IconTrendingUp size={16} /> : <IconTrendingDown size={16} />}
                        <span>{trend.value}%</span>
                    </div>
                )}
            </div>
            <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                {icon}
            </div>
        </div>
    </div>
);

// Student Row Component
const StudentRow: React.FC<{
    student: StudentSubmission;
    contentType: ContentType;
    onView?: () => void;
}> = ({ student, contentType, onView }) => {
    const getStatusBadge = () => {
        switch (student.status) {
            case 'submitted':
                return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">הושלם</span>;
            case 'in_progress':
                return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">בתהליך</span>;
            default:
                return <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">לא התחיל</span>;
        }
    };

    const getVariantBadge = () => {
        if (contentType !== 'activity' || !student.variantUsed) return null;
        const variants = {
            scaffolding: { label: '📚 תגבור', color: 'bg-blue-100 text-blue-700' },
            original: { label: '📖 רגיל', color: 'bg-slate-100 text-slate-600' },
            enrichment: { label: '🚀 העשרה', color: 'bg-purple-100 text-purple-700' }
        };
        const v = variants[student.variantUsed];
        return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${v.color}`}>{v.label}</span>;
    };

    return (
        <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {student.studentName.charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">{student.studentName}</p>
                        {student.studentEmail && (
                            <p className="text-xs text-slate-400">{student.studentEmail}</p>
                        )}
                    </div>
                </div>
            </td>
            <td className="p-4">{getStatusBadge()}</td>
            {contentType === 'activity' && (
                <td className="p-4">{getVariantBadge()}</td>
            )}
            <td className="p-4">
                {student.status === 'submitted' ? (
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${
                                    student.score >= 80 ? 'bg-emerald-500' :
                                    student.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${student.score}%` }}
                            />
                        </div>
                        <span className="font-bold text-slate-700">{Math.round(student.score)}%</span>
                    </div>
                ) : (
                    <span className="text-slate-400">-</span>
                )}
            </td>
            <td className="p-4 text-slate-500 text-sm">
                {student.telemetry?.timeSpentSeconds
                    ? formatTime(student.telemetry.timeSpentSeconds)
                    : '-'
                }
            </td>
            <td className="p-4 text-slate-500 text-sm">
                {formatDate(student.submittedAt)}
            </td>
            <td className="p-4">
                <button
                    onClick={onView}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
                    title="צפה בהגשה"
                >
                    <IconEye size={18} />
                </button>
            </td>
        </tr>
    );
};

// Question Analysis Component (for Exams)
const QuestionAnalysisCard: React.FC<{ analysis: QuestionAnalysis }> = ({ analysis }) => (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
                <p className="font-medium text-slate-800 line-clamp-2">{analysis.question}</p>
                <span className="text-xs text-slate-400 mt-1">{analysis.type}</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                analysis.successRate >= 70 ? 'bg-emerald-100 text-emerald-700' :
                analysis.successRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
                {Math.round(analysis.successRate)}%
            </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-emerald-600">
                <IconCheck size={16} />
                <span>{analysis.correctCount} נכון</span>
            </div>
            <div className="flex items-center gap-1 text-red-500">
                <IconX size={16} />
                <span>{analysis.incorrectCount} שגוי</span>
            </div>
            {analysis.avgTimeSeconds && (
                <div className="flex items-center gap-1 text-slate-500">
                    <IconClock size={16} />
                    <span>{formatTime(analysis.avgTimeSeconds)}</span>
                </div>
            )}
        </div>
        {analysis.commonWrongAnswers && analysis.commonWrongAnswers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">תשובות שגויות נפוצות:</p>
                <div className="flex flex-wrap gap-2">
                    {analysis.commonWrongAnswers.slice(0, 3).map((wa, i) => (
                        <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded">
                            {wa.answer} ({wa.count})
                        </span>
                    ))}
                </div>
            </div>
        )}
    </div>
);

// Score Distribution Chart (simple bar chart)
const ScoreDistribution: React.FC<{ submissions: StudentSubmission[] }> = ({ submissions }) => {
    const distribution = useMemo(() => {
        const ranges = [
            { label: '0-20', min: 0, max: 20, count: 0, color: 'bg-red-500' },
            { label: '21-40', min: 21, max: 40, count: 0, color: 'bg-orange-500' },
            { label: '41-60', min: 41, max: 60, count: 0, color: 'bg-amber-500' },
            { label: '61-80', min: 61, max: 80, count: 0, color: 'bg-lime-500' },
            { label: '81-100', min: 81, max: 100, count: 0, color: 'bg-emerald-500' },
        ];

        submissions.filter(s => s.status === 'submitted').forEach(s => {
            const range = ranges.find(r => s.score >= r.min && s.score <= r.max);
            if (range) range.count++;
        });

        const maxCount = Math.max(...ranges.map(r => r.count), 1);
        return ranges.map(r => ({ ...r, height: (r.count / maxCount) * 100 }));
    }, [submissions]);

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <IconChartBar className="text-indigo-600" size={20} />
                התפלגות ציונים
            </h3>
            <div className="flex items-end justify-between gap-2 h-40">
                {distribution.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-slate-100 rounded-t-lg relative" style={{ height: '120px' }}>
                            <div
                                className={`absolute bottom-0 w-full ${d.color} rounded-t-lg transition-all duration-500`}
                                style={{ height: `${d.height}%` }}
                            />
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{d.label}</span>
                        <span className="text-sm font-bold text-slate-700">{d.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Mastery Heatmap (for Activities)
const MasteryHeatmap: React.FC<{ submissions: StudentSubmission[] }> = ({ submissions }) => {
    const masteryGroups = useMemo(() => {
        const groups = {
            scaffolding: submissions.filter(s => s.variantUsed === 'scaffolding' || (s.masteryLevel && s.masteryLevel < 0.4)),
            original: submissions.filter(s => s.variantUsed === 'original' || (s.masteryLevel && s.masteryLevel >= 0.4 && s.masteryLevel <= 0.8)),
            enrichment: submissions.filter(s => s.variantUsed === 'enrichment' || (s.masteryLevel && s.masteryLevel > 0.8))
        };
        return groups;
    }, [submissions]);

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <IconBrain className="text-indigo-600" size={20} />
                מפת רמות התלמידים
            </h3>
            <div className="grid grid-cols-3 gap-4">
                {/* Scaffolding */}
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">📚</span>
                        <div>
                            <p className="font-bold text-blue-800">תגבור</p>
                            <p className="text-xs text-blue-600">צריכים עזרה</p>
                        </div>
                    </div>
                    <p className="text-3xl font-black text-blue-700">{masteryGroups.scaffolding.length}</p>
                    <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
                        {masteryGroups.scaffolding.slice(0, 5).map(s => (
                            <p key={s.id} className="text-xs text-blue-600 truncate">{s.studentName}</p>
                        ))}
                        {masteryGroups.scaffolding.length > 5 && (
                            <p className="text-xs text-blue-400">+{masteryGroups.scaffolding.length - 5} נוספים</p>
                        )}
                    </div>
                </div>

                {/* Original */}
                <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">📖</span>
                        <div>
                            <p className="font-bold text-slate-800">רגיל</p>
                            <p className="text-xs text-slate-600">מתקדמים יציב</p>
                        </div>
                    </div>
                    <p className="text-3xl font-black text-slate-700">{masteryGroups.original.length}</p>
                    <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
                        {masteryGroups.original.slice(0, 5).map(s => (
                            <p key={s.id} className="text-xs text-slate-600 truncate">{s.studentName}</p>
                        ))}
                        {masteryGroups.original.length > 5 && (
                            <p className="text-xs text-slate-400">+{masteryGroups.original.length - 5} נוספים</p>
                        )}
                    </div>
                </div>

                {/* Enrichment */}
                <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🚀</span>
                        <div>
                            <p className="font-bold text-purple-800">העשרה</p>
                            <p className="text-xs text-purple-600">מצטיינים</p>
                        </div>
                    </div>
                    <p className="text-3xl font-black text-purple-700">{masteryGroups.enrichment.length}</p>
                    <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
                        {masteryGroups.enrichment.slice(0, 5).map(s => (
                            <p key={s.id} className="text-xs text-purple-600 truncate">{s.studentName}</p>
                        ))}
                        {masteryGroups.enrichment.length > 5 && (
                            <p className="text-xs text-purple-400">+{masteryGroups.enrichment.length - 5} נוספים</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Lesson Completion View
const LessonCompletionView: React.FC<{ submissions: StudentSubmission[], totalStudents: number }> = ({ submissions, totalStudents }) => {
    const stats = useMemo(() => {
        const completed = submissions.filter(s => s.status === 'submitted').length;
        const inProgress = submissions.filter(s => s.status === 'in_progress').length;
        const notStarted = totalStudents - completed - inProgress;
        const avgTime = submissions
            .filter(s => s.telemetry?.timeSpentSeconds)
            .reduce((acc, s) => acc + (s.telemetry?.timeSpentSeconds || 0), 0) / (completed || 1);

        return { completed, inProgress, notStarted, avgTime };
    }, [submissions, totalStudents]);

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <IconPresentation className="text-indigo-600" size={20} />
                סטטוס השלמה
            </h3>

            {/* Progress Ring */}
            <div className="flex items-center gap-8 mb-6">
                <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                        <circle
                            cx="64" cy="64" r="56"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="12"
                            strokeDasharray={`${(stats.completed / totalStudents) * 352} 352`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-black text-slate-800">
                            {Math.round((stats.completed / totalStudents) * 100)}%
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-slate-600">השלימו: <strong>{stats.completed}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-slate-600">בתהליך: <strong>{stats.inProgress}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-slate-300" />
                        <span className="text-slate-600">לא התחילו: <strong>{stats.notStarted}</strong></span>
                    </div>
                </div>
            </div>

            {/* Avg Time */}
            <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-4">
                <IconClock className="text-slate-400" size={24} />
                <div>
                    <p className="text-sm text-slate-500">זמן למידה ממוצע</p>
                    <p className="text-xl font-bold text-slate-800">{formatTime(stats.avgTime)}</p>
                </div>
            </div>
        </div>
    );
};

// Not Started Students Alert
const NotStartedAlert: React.FC<{ students: StudentSubmission[], onSendReminder: () => void }> = ({ students, onSendReminder }) => {
    if (students.length === 0) return null;

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                    <IconAlertTriangle className="text-amber-600 mt-1" size={24} />
                    <div>
                        <h4 className="font-bold text-amber-800">תלמידים שטרם התחילו ({students.length})</h4>
                        <p className="text-sm text-amber-600 mt-1">
                            {students.slice(0, 3).map(s => s.studentName).join(', ')}
                            {students.length > 3 && ` ועוד ${students.length - 3}`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onSendReminder}
                    className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-colors flex items-center gap-2"
                >
                    <IconMail size={16} />
                    שלח תזכורת
                </button>
            </div>
        </div>
    );
};

// ============ MAIN COMPONENT ============

export const TeacherControlCenter: React.FC<ControlCenterProps> = ({ courseId, onBack, onViewStudent, onViewLessonPlan, onEditCourse }) => {
    const [course, setCourse] = useState<Course | null>(null);
    const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
    const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const contentType = getContentType(course);

    // Fetch course and submissions
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch course
                const courseDoc = await getDoc(doc(db, 'courses', courseId));
                if (courseDoc.exists()) {
                    setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
                }

                // Fetch submissions
                const submissionsQuery = query(
                    collection(db, 'submissions'),
                    where('courseId', '==', courseId)
                );
                const submissionsSnap = await getDocs(submissionsQuery);
                const subs: StudentSubmission[] = submissionsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as StudentSubmission));
                setSubmissions(subs);

                // Analyze questions if exam
                if (courseDoc.exists()) {
                    const courseData = courseDoc.data();
                    if (courseData.productType === 'exam' || courseData.mode === 'exam') {
                        analyzeQuestions(courseData, subs);
                    }
                }
            } catch (error) {
                console.error('Error fetching control center data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId]);

    const analyzeQuestions = (courseData: any, subs: StudentSubmission[]) => {
        const blocks = courseData.syllabus?.[0]?.learningUnits?.[0]?.activityBlocks || [];
        const questionBlocks = blocks.filter((b: any) =>
            ['multiple-choice', 'open-question', 'fill_in_blanks', 'ordering', 'categorization'].includes(b.type)
        );

        const analysis: QuestionAnalysis[] = questionBlocks.map((block: any) => {
            const blockAnswers = subs
                .filter(s => s.answers?.[block.id])
                .map(s => ({
                    answer: s.answers![block.id],
                    isCorrect: s.telemetry?.stepResults?.[block.id] === 'success'
                }));

            const correctCount = blockAnswers.filter(a => a.isCorrect).length;
            const incorrectCount = blockAnswers.filter(a => !a.isCorrect).length;

            // Find common wrong answers
            const wrongAnswers = blockAnswers.filter(a => !a.isCorrect);
            const wrongCounts: Record<string, number> = {};
            wrongAnswers.forEach(wa => {
                const key = typeof wa.answer === 'string' ? wa.answer : JSON.stringify(wa.answer);
                wrongCounts[key] = (wrongCounts[key] || 0) + 1;
            });
            const commonWrongAnswers = Object.entries(wrongCounts)
                .map(([answer, count]) => ({ answer, count }))
                .sort((a, b) => b.count - a.count);

            return {
                blockId: block.id,
                question: block.content?.question || block.content?.instruction || 'שאלה',
                type: block.type,
                correctCount,
                incorrectCount,
                successRate: blockAnswers.length > 0 ? (correctCount / blockAnswers.length) * 100 : 0,
                commonWrongAnswers
            };
        });

        setQuestionAnalysis(analysis);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        // Re-fetch data
        const submissionsQuery = query(
            collection(db, 'submissions'),
            where('courseId', '==', courseId)
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        const subs: StudentSubmission[] = submissionsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as StudentSubmission));
        setSubmissions(subs);
        setRefreshing(false);
    };

    const handleSendReminder = () => {
        // TODO: Implement email reminder
        alert('פונקציית שליחת תזכורת תיושם בקרוב');
    };

    const handleExport = () => {
        // TODO: Implement CSV export
        alert('פונקציית ייצוא תיושם בקרוב');
    };

    // Calculate stats
    const stats = useMemo(() => {
        const submitted = submissions.filter(s => s.status === 'submitted');
        const avgScore = submitted.length > 0
            ? submitted.reduce((acc, s) => acc + s.score, 0) / submitted.length
            : 0;
        const atRisk = submitted.filter(s => s.score < 60).length;
        const excellent = submitted.filter(s => s.score >= 90).length;
        const avgTime = submitted
            .filter(s => s.telemetry?.timeSpentSeconds)
            .reduce((acc, s) => acc + (s.telemetry?.timeSpentSeconds || 0), 0) / (submitted.length || 1);

        return { avgScore, atRisk, excellent, submitted: submitted.length, avgTime };
    }, [submissions]);

    const notStartedStudents = submissions.filter(s => s.status === 'not_started');

    // Content type config
    const contentTypeConfig = {
        activity: {
            label: 'פעילות',
            icon: <IconActivity size={20} />,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-100'
        },
        exam: {
            label: 'מבחן',
            icon: <IconClipboardCheck size={20} />,
            color: 'text-cyan-600',
            bgColor: 'bg-cyan-100'
        },
        lesson: {
            label: 'מערך שיעור',
            icon: <IconBook size={20} />,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-100'
        }
    };

    const config = contentTypeConfig[contentType];

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">טוען נתונים...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6" dir="rtl">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors"
                    >
                        <IconArrowRight size={20} />
                        חזרה לדשבורד
                    </button>

                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${config.bgColor} ${config.color} flex items-center gap-1`}>
                                    {config.icon}
                                    {config.label}
                                </span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-800">{course?.title || 'לוח בקרה'}</h1>
                            <p className="text-slate-500 mt-1">
                                {course?.subject} • {course?.gradeLevel}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                                title="רענן נתונים"
                            >
                                <IconRefresh size={20} className={`text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            {onViewLessonPlan && (
                                <button
                                    onClick={() => onViewLessonPlan(courseId)}
                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                                    title="צפה במערך השיעור"
                                >
                                    <IconEye size={18} />
                                    צפה במערך
                                </button>
                            )}
                            {onEditCourse && (
                                <button
                                    onClick={() => onEditCourse(courseId)}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                    title="ערוך את הפעילות"
                                >
                                    <IconBook size={18} />
                                    ערוך
                                </button>
                            )}
                            <button
                                onClick={handleExport}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                            >
                                <IconDownload size={18} />
                                ייצוא
                            </button>
                        </div>
                    </div>
                </header>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        title="תלמידים שהגישו"
                        value={`${stats.submitted}/${submissions.length}`}
                        icon={<IconUsers size={24} className="text-indigo-600" />}
                        color="text-indigo-600"
                    />
                    <StatCard
                        title="ציון ממוצע"
                        value={`${Math.round(stats.avgScore)}%`}
                        icon={<IconChartBar size={24} className="text-emerald-600" />}
                        color="text-emerald-600"
                    />
                    <StatCard
                        title={contentType === 'activity' ? 'צריכים תגבור' : 'ציון נמוך'}
                        value={stats.atRisk}
                        icon={<IconAlertTriangle size={24} className="text-amber-600" />}
                        color="text-amber-600"
                    />
                    <StatCard
                        title="מצטיינים"
                        value={stats.excellent}
                        icon={<IconTrendingUp size={24} className="text-purple-600" />}
                        color="text-purple-600"
                    />
                </div>

                {/* Alert for not started */}
                {notStartedStudents.length > 0 && (
                    <div className="mb-8">
                        <NotStartedAlert
                            students={notStartedStudents}
                            onSendReminder={handleSendReminder}
                        />
                    </div>
                )}

                {/* Content-specific sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Activity: Mastery Heatmap */}
                    {contentType === 'activity' && (
                        <MasteryHeatmap submissions={submissions} />
                    )}

                    {/* Exam: Score Distribution */}
                    {contentType === 'exam' && (
                        <ScoreDistribution submissions={submissions} />
                    )}

                    {/* Lesson: Completion View */}
                    {contentType === 'lesson' && (
                        <LessonCompletionView
                            submissions={submissions}
                            totalStudents={submissions.length || 30} // TODO: Get actual class size
                        />
                    )}

                    {/* Common: Time/Engagement stats or Question Analysis */}
                    {contentType === 'exam' && questionAnalysis.length > 0 ? (
                        <div className="bg-white rounded-2xl p-6 border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <IconQuestionMark className="text-indigo-600" size={20} />
                                ניתוח שאלות
                            </h3>
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                {questionAnalysis.map(q => (
                                    <QuestionAnalysisCard key={q.blockId} analysis={q} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-6 border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <IconClock className="text-indigo-600" size={20} />
                                זמני ביצוע
                            </h3>
                            <div className="text-center py-8">
                                <p className="text-4xl font-black text-slate-800 mb-2">
                                    {formatTime(stats.avgTime)}
                                </p>
                                <p className="text-slate-500">זמן ביצוע ממוצע</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Students Table */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <IconUsers className="text-indigo-600" size={20} />
                            רשימת תלמידים ({submissions.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr className="text-right text-sm text-slate-500 font-medium">
                                    <th className="p-4">תלמיד/ה</th>
                                    <th className="p-4">סטטוס</th>
                                    {contentType === 'activity' && <th className="p-4">רמה</th>}
                                    <th className="p-4">ציון</th>
                                    <th className="p-4">זמן</th>
                                    <th className="p-4">הגשה</th>
                                    <th className="p-4">פעולות</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map(student => (
                                    <StudentRow
                                        key={student.id}
                                        student={student}
                                        contentType={contentType}
                                        onView={() => onViewStudent?.(student.id)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherControlCenter;
