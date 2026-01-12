import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { generateClassAnalysis, generateStudentReport } from '../services/ai/geminiApi';
// type SubmissionData unused removed
// gradeBatch removed
import { collection, query, onSnapshot, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore'; // Added deleteDoc, doc, updateDoc
import { feedbackService } from '../services/feedbackService';
import { GamificationService } from '../services/telemetry';
import type { StudentAnalyticsProfile } from '../shared/types/courseTypes';
import { useAuth } from '../context/AuthContext';

import { db } from '../firebase';
import {
    IconBrain, IconX, IconSparkles, IconEdit, IconTrash,
    IconEye, IconSearch, IconLayer, IconBook, IconArrowBack,
    IconLink, IconCheck, IconStudent, IconList,
    IconArrowUp, IconArrowDown, IconLoader, IconFlag, IconAlertTriangle
} from '../icons';

// --- Lazy Load CoursePlayer ---
const CoursePlayer = React.lazy(() => import('./CoursePlayer'));
const TeacherControlCenter = React.lazy(() => import('./dashboard/TeacherControlCenter').then(m => ({ default: m.TeacherControlCenter })));
import { SmartGroupingPanel } from './SmartGroupingPanel';
import { ClassroomConnectButton } from './teacher/ClassroomConnectButton';
import { ClassroomAssignmentModal } from './teacher/ClassroomAssignmentModal';
import { ShareModal } from './ShareModal';
import { TeacherUsageWidget } from './TeacherUsageWidget';
import { IconBrandGoogle, IconShare, IconMail, IconMailOff, IconChartBar } from '@tabler/icons-react';

// --- CONSTANTS ---
const GRADE_ORDER = [
    "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
    "כיתה ז׳", "כיתה ח׳", "כיתה ט׳", "כיתה י׳", "כיתה י״א", "כיתה י״ב",
    "מכינה", "סטודנטים"
];

// ... (normalizeText function) ... 
const normalizeText = (text: string) => {
    if (!text) return "";
    return text.trim().replace(/[׳`´]/g, "'");
};

// ... (Interfaces remain the same) ...
interface StudentStat {
    id: string;
    name: string;
    score: number;
    progress: number;
    lastActive: string;
    answers?: any;
    chatHistory?: { role: string, parts: string }[];
    subject: string;
    gradeLevel: string;
    courseTitle: string;
    courseId: string;
    hasAlert?: boolean; // New Field
    analytics?: StudentAnalyticsProfile; // New Field
}

interface CourseAggregation {
    courseId: string;
    title: string;
    subject: string;
    grade: string;
    studentCount: number;
    avgScore: number;
    completionRate: number; // הוספנו אחוז השלמה
    atRiskCount: number;
    createdAt?: any;
    productType: 'lesson' | 'activity' | 'exam' | 'podcast' | null; // Product type from wizard
    mode?: 'learning' | 'exam' | 'lesson'; // Added mode
    submittedCount: number; // New field for submitted count
    parentLesson?: { courseId: string; title: string }; // If extracted from lesson plan
}

interface TeacherDashboardProps {
    onEditCourse?: (courseId: string) => void;
    onViewInsights?: () => void;
    onNavigateToAnalytics?: () => void; // New Prop
}

const StudentInsightsModal = ({ student, onClose }: { student: StudentStat, onClose: () => void }) => {
    const analytics = student.analytics;
    if (!analytics) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="bg-gradient-to-l from-wizdi-royal to-wizdi-cyan p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <IconBrain className="w-8 h-8 opacity-80" /> ניתוח ביצועים
                        </h3>
                        <p className="opacity-80 text-sm mt-1">ניתוח עבור: {student.name}</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><IconX className="w-6 h-6" /></button>
                </div>

                <div className="p-4 md:p-8 max-h-[70vh] overflow-y-auto">
                    {/* Header Chips - Learning Metrics */}
                    <div className="flex gap-4 mb-8 flex-wrap">
                        <div className="bg-wizdi-royal/10 text-wizdi-royal px-4 py-2 rounded-xl font-bold border border-wizdi-royal/20 flex items-center gap-2">
                            מעורבות: {analytics.engagementScore}%
                        </div>
                        {analytics.learningMetrics && (
                            <>
                                <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold border border-slate-200 flex items-center gap-2">
                                    שימוש ברמזים: {Math.round((analytics.learningMetrics.hintUsageRate || 0) * 100)}%
                                </div>
                                <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold border border-slate-200 flex items-center gap-2">
                                    השלמה: {Math.round((analytics.learningMetrics.completionRate || 0) * 100)}%
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Strengths */}
                        <div className="bg-wizdi-lime/10 p-6 rounded-3xl border border-wizdi-lime/20">
                            <h4 className="text-wizdi-lime font-bold mb-4 flex items-center gap-2 text-lg">
                                <IconCheck className="w-5 h-5" /> מיומנויות חזקות
                            </h4>
                            <ul className="space-y-3">
                                {analytics.strengths.map((s, i) => (
                                    <li key={i} className="flex gap-3 text-slate-700 leading-relaxed font-bold opacity-80 text-sm">
                                        <div className="w-1.5 h-1.5 bg-wizdi-lime rounded-full mt-2 shrink-0" />
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Weaknesses */}
                        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                            <h4 className="text-amber-600 font-bold mb-4 flex items-center gap-2 text-lg">
                                <IconFlag className="w-5 h-5" /> נושאים לחיזוק
                            </h4>
                            <ul className="space-y-3">
                                {analytics.weaknesses.map((w, i) => (
                                    <li key={i} className="flex gap-3 text-slate-700 leading-relaxed font-bold opacity-80 text-sm">
                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 shrink-0" />
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-wizdi-gold/10 p-6 rounded-3xl border border-wizdi-gold/20 flex gap-4 items-start">
                        <div className="bg-white p-3 rounded-full shadow-lg text-wizdi-gold shrink-0">
                            <IconSparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-wizdi-royal font-bold text-lg mb-1">נושא מומלץ לתרגול</h4>
                            <p className="text-slate-700 leading-relaxed opacity-90">
                                {analytics.recommendedFocus}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper function to get product type label and color
const getProductTypeDisplay = (productType: string | null | undefined, mode?: string) => {
    // Determine the actual type based on productType or mode fallback
    const actualType = productType || (mode === 'lesson' ? 'lesson' : mode === 'exam' ? 'exam' : 'activity');

    const labels: Record<string, string> = {
        'lesson': 'מערך שיעור',
        'exam': 'מבחן',
        'activity': 'פעילות',
        'podcast': 'פודקאסט'
    };

    const colors: Record<string, string> = {
        'lesson': 'bg-emerald-100 text-emerald-700',
        'exam': 'bg-wizdi-cyan/20 text-wizdi-cyan',
        'activity': 'bg-wizdi-royal/10 text-wizdi-royal',
        'podcast': 'bg-orange-100 text-orange-700'
    };

    const headerColors: Record<string, string> = {
        'lesson': 'text-emerald-600 bg-emerald-50 border-emerald-200',
        'exam': 'text-wizdi-cyan bg-wizdi-cyan/10 border-wizdi-cyan/20',
        'activity': 'text-wizdi-royal bg-wizdi-royal/10 border-wizdi-royal/20',
        'podcast': 'text-orange-600 bg-orange-50 border-orange-200'
    };

    const cardColors: Record<string, string> = {
        'lesson': 'bg-wizdi-lime text-green-900 border-wizdi-lime/50',
        'exam': 'bg-wizdi-cyan/80 text-white border-wizdi-cyan/50',
        'activity': 'bg-wizdi-gold text-amber-900 border-wizdi-gold/50',
        'podcast': 'bg-orange-400 text-white border-orange-500/50'
    };

    return {
        label: labels[actualType] || 'פעילות',
        color: colors[actualType] || colors['activity'],
        headerColor: headerColors[actualType] || headerColors['activity'],
        cardColor: cardColors[actualType] || cardColors['activity']
    };
};

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onEditCourse, onViewInsights, onNavigateToAnalytics }) => {
    // --- Auth ---
    const { currentUser } = useAuth();

    // --- State ---
    const [rawStudents, setRawStudents] = useState<any[]>([]);
    const [rawSubmissions, setRawSubmissions] = useState<any[]>([]);
    const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]); // New State
    const [coursesMap, setCoursesMap] = useState<Record<string, { subject: string, grade: string, title: string, createdAt?: any, mode?: string, syllabus?: any[], wizardData?: any }>>({});
    const [isCoursesLoaded, setIsCoursesLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ step: 'none' | 'first' | 'second', courseId: string | null }>({ step: 'none', courseId: null });

    // Assignment Modal State
    const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
    const [assignmentData, setAssignmentData] = useState({
        courseId: '',
        courseTitle: '',
        title: '',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '23:59',
        instructions: ''
    });

    // Share Modal State
    const [shareModalCourse, setShareModalCourse] = useState<{ id: string; title: string } | null>(null);

    // Navigation
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

    // Filters
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all'); // Added Type Filter
    const [searchTerm, setSearchTerm] = useState("");

    // View State
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'feedback'>('list'); // Added 'feedback' mode
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

    // Detail View State
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [viewingTestStudent, setViewingTestStudent] = useState<StudentStat | null>(null);
    const [reportStudent, setReportStudent] = useState<any>(null);
    const [viewingInsightStudent, setViewingInsightStudent] = useState<StudentStat | null>(null); // New State
    const [viewingLessonPlan, setViewingLessonPlan] = useState<string | null>(null); // View lesson plan modal
    const [viewingControlCenter, setViewingControlCenter] = useState<string | null>(null); // Teacher Control Center
    const [aiInsight, setAiInsight] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [groupAnalysis, setGroupAnalysis] = useState<string | null>(null);

    // Feedback State
    const [feedbackText, setFeedbackText] = useState("");
    const [isSavingFeedback, setIsSavingFeedback] = useState(false);
    // isGrading removed
    const [showOnlyAlerts, setShowOnlyAlerts] = useState(false); // New Filter State

    // Feedback View State
    const [courseFeedbackStats, setCourseFeedbackStats] = useState<any>(null);
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false); // Mobile Filter State

    // Email Reports Settings
    const [emailReportsEnabled, setEmailReportsEnabled] = useState(false);
    const [isEmailSettingLoading, setIsEmailSettingLoading] = useState(false);

    // Load email reports setting
    useEffect(() => {
        if (!currentUser) return;
        GamificationService.getUserProfile(currentUser.uid).then(profile => {
            if (profile) {
                setEmailReportsEnabled(profile.emailReportsEnabled ?? false);
            }
        });
    }, [currentUser]);

    // Handler to toggle email reports
    const handleToggleEmailReports = async (enabled: boolean) => {
        if (!currentUser) return;
        setIsEmailSettingLoading(true);
        try {
            await GamificationService.updateEmailReportsSetting(currentUser.uid, enabled);
            setEmailReportsEnabled(enabled);
        } catch (error) {
            console.error('Failed to update email setting:', error);
        } finally {
            setIsEmailSettingLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'feedback' && selectedCourseId) {
            setIsFeedbackLoading(true);
            feedbackService.getFeedbackStats(selectedCourseId)
                .then(stats => setCourseFeedbackStats(stats))
                .catch(err => console.error(err))
                .finally(() => setIsFeedbackLoading(false));
        }
    }, [viewMode, selectedCourseId]);

    useEffect(() => {
        if (viewingTestStudent) {
            setFeedbackText((viewingTestStudent as any).rawSubmission?.feedback || "");
        }
    }, [viewingTestStudent]);

    const [assignmentsMap, setAssignmentsMap] = useState<Record<string, any[]>>({});

    // --- 1. Fetch Courses Metadata (Realtime) ---
    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, "courses"), where("teacherId", "==", currentUser.uid));
        const unsubCourses = onSnapshot(q, (snapshot) => {
            // Updated mapped type to include syllabus for type detection
            const map: Record<string, { subject: string, grade: string, title: string, createdAt?: any, syllabus?: any[], parentLesson?: any }> = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                const rawSubject = data.subject || data.topic || "כללי";
                const rawGrade = data.gradeLevel || data.grade || data.classLevel || "כללי";

                map[doc.id] = {
                    subject: rawSubject,
                    grade: rawGrade,
                    title: data.title || "ללא שם",
                    createdAt: data.createdAt,
                    mode: data.mode, // Store mode
                    syllabus: data.syllabus, // Store syllabus
                    wizardData: data.wizardData, // Store wizardData for productType
                    parentLesson: data.parentLesson // Track if extracted from lesson plan
                };
            });
            setCoursesMap(map);
            setIsCoursesLoaded(true);
        }, (error) => {
            console.error("Error fetching courses:", error);
        });

        return () => unsubCourses();
    }, [currentUser]);

    // --- 1.5 Fetch Assignments for Due Dates ---
    useEffect(() => {
        if (!currentUser) return;

        const fetchAssignments = async () => {
            try {
                const q = query(collection(db, "assignments"), where("teacherId", "==", currentUser.uid));
                const snapshot = await getDocs(q);
                const map: Record<string, any[]> = {};

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (!map[data.courseId]) map[data.courseId] = [];
                    map[data.courseId].push({
                        id: doc.id,
                        dueDate: data.dueDate,
                        title: data.title
                    });
                });
                setAssignmentsMap(map);
            } catch (error) {
                console.error("Error fetching assignments:", error);
            }
        };
        fetchAssignments();
    }, [currentUser]);


    // --- 2. Fetch Students & Submissions ---
    useEffect(() => {
        if (!currentUser) return;

        // Fetch Submissions - filter by teacherId
        const qSub = query(collection(db, "submissions"), where("teacherId", "==", currentUser.uid));
        const unsubSub = onSnapshot(qSub, (snapshot) => {
            const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRawSubmissions(subs);
        }, (error) => {
            console.error("Error fetching submissions:", error);
        });

        // Legend: We might still need student_progress for older data, but for now we focus on submissions for the new flow.
        // If you want to keep 'student_progress' for "Registered" students who haven't submitted, keep this.
        const q = query(collection(db, "student_progress"), where("teacherId", "==", currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const raw = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRawStudents(raw);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching student progress:", error);
            setLoading(false);
        });

        // Safety Alerts Listener - filter by teacherId
        const qAlerts = query(
            collection(db, "safety_alerts"),
            where("teacherId", "==", currentUser.uid),
            where("isHandled", "==", false)
        );
        const unsubAlerts = onSnapshot(qAlerts, (snapshot) => {
            const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSafetyAlerts(alerts);
        }, (error) => {
            console.error("Error fetching safety alerts:", error);
        });

        return () => { unsubscribe(); unsubSub(); unsubAlerts(); };
    }, [currentUser]);

    // --- 3. Merge Data ---
    const allData: StudentStat[] = useMemo(() => {
        if (!isCoursesLoaded) return [];

        const studentsMap: Record<string, StudentStat> = {};

        // 1. Process "In Progress" students (rawStudents)
        rawStudents.forEach((data: any) => {
            const courseMeta = coursesMap[data.courseId];
            const subject = courseMeta?.subject || "אחר";
            const gradeLevel = courseMeta?.grade || "אחר";
            const courseTitle = courseMeta?.title || "קורס לא נמצא";

            // Normalize ID if email exists
            const id = data.studentEmail || data.id;

            // Check for alerts
            // Fix: Use data directly as studentsMap[id] is not yet assigned
            const currentName = data.studentEmail?.split('@')[0] || "אנונימי";
            const hasAlert = safetyAlerts.some((a: any) => a.studentId === data.id || a.studentName === currentName);

            studentsMap[id] = {
                id: data.id,
                name: data.studentEmail?.split('@')[0] || "אנונימי",
                score: data.finalScore || 0,
                progress: data.answers ? Math.min(Object.keys(data.answers).length * 10, 90) : 0, // Estimate percentage (10% per answer, max 90% until submit)
                lastActive: data.lastActive ? new Date(data.lastActive).toLocaleDateString('he-IL') : '-',
                answers: data.answers || {},
                chatHistory: data.chatHistory || [],
                courseId: data.courseId,
                subject,
                gradeLevel,
                courseTitle,
                isSubmitted: false, // Mark as not submitted initially
                hasAlert
            } as any;
        });

        // 2. Process "Submitted" students (rawSubmissions) - Overwrite or Add
        rawSubmissions.forEach((sub: any) => {
            const courseMeta = coursesMap[sub.courseId];
            // Simple unique key strategy: use studentName if no email/ID available
            const key = sub.studentEmail || sub.studentName || sub.id;

            let score = sub.score || 0;
            // Logic to use existing score if higher? For now, submission overrides.

            // Check for alerts
            const hasAlert = safetyAlerts.some((a: any) => a.studentId === sub.id || a.studentName === sub.studentName);

            studentsMap[key] = {
                ...studentsMap[key], // Keep existing metadata if any
                id: sub.id, // Use submission ID as primary for viewing
                name: sub.studentName || studentsMap[key]?.name || "אנונימי",
                score: score,
                progress: 100,
                lastActive: sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleDateString('he-IL') : (studentsMap[key]?.lastActive || 'היום'),
                answers: sub.answers || {},
                courseId: sub.courseId,
                subject: courseMeta?.subject || "אחר",
                gradeLevel: courseMeta?.grade || "אחר",
                courseTitle: courseMeta?.title || "קורס",
                source: 'submission',
                rawSubmission: sub,
                isSubmitted: true, // Mark as submitted
                hasAlert: studentsMap[key]?.hasAlert || hasAlert,
                analytics: sub.analytics || undefined
            } as any;
        });

        return Object.values(studentsMap);
    }, [rawSubmissions, rawStudents, coursesMap, isCoursesLoaded, safetyAlerts]);

    // --- 4. Dynamic Filter Lists ---
    const availableSubjects = useMemo(() => {
        const subjects = new Set<string>();
        Object.values(coursesMap).forEach(c => {
            if (c.subject && c.subject !== "כללי") subjects.add(c.subject);
        });
        return Array.from(subjects).sort();
    }, [coursesMap]);

    const availableGrades = useMemo(() => {
        const grades = new Set<string>();
        Object.values(coursesMap).forEach(c => {
            if (c.grade && c.grade !== "כללי") grades.add(c.grade);
        });
        return Array.from(grades).sort((a, b) => {
            const normA = normalizeText(a);
            const normB = normalizeText(b);
            const indexA = GRADE_ORDER.findIndex(g => normalizeText(g).includes(normA) || normA.includes(normalizeText(g)));
            const indexB = GRADE_ORDER.findIndex(g => normalizeText(g).includes(normB) || normB.includes(normalizeText(g)));
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [coursesMap]);

    // --- Aggregation Logic (Now includes Next Due Date & Sorting) ---
    const aggregatedCourses = useMemo(() => {
        const grouped: Record<string, CourseAggregation & { totalProgress: number, nextDueDate?: string }> = {};
        const today = new Date().toISOString();

        Object.entries(coursesMap).forEach(([id, meta]) => {
            const normMetaSubject = normalizeText(meta.subject);
            const normMetaGrade = normalizeText(meta.grade);
            const normFilterSubject = normalizeText(filterSubject);
            const normFilterGrade = normalizeText(filterGrade);

            // Type Filtering Logic - based on productType from wizardData
            const productType = meta.wizardData?.settings?.productType || null;
            const isLesson = productType === 'lesson' || meta.mode === 'lesson';
            const isExam = productType === 'exam' || meta.mode === 'exam';
            const isActivity = productType === 'activity' || (!isLesson && !isExam && productType !== 'podcast');
            const isPodcast = productType === 'podcast';

            const matchType = filterType === 'all' ||
                (filterType === 'lesson' && isLesson) ||
                (filterType === 'test' && isExam) ||
                (filterType === 'activity' && isActivity);

            const matchSubject = filterSubject === 'all' || normMetaSubject.includes(normFilterSubject);
            const matchGrade = filterGrade === 'all' || normMetaGrade.includes(normFilterGrade);
            const matchSearch = searchTerm === "" || meta.title.toLowerCase().includes(searchTerm.toLowerCase());

            if (matchSubject && matchGrade && matchSearch && matchType) {
                // Calculate next due date
                const courseAssignments = assignmentsMap[id] || [];
                const upcoming = courseAssignments
                    .filter(a => a.dueDate >= today)
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
                const nextDue = upcoming.length > 0 ? upcoming[0].dueDate : null;

                grouped[id] = {
                    courseId: id,
                    title: meta.title,
                    subject: meta.subject,
                    grade: meta.grade,
                    studentCount: 0,
                    avgScore: 0,
                    totalProgress: 0,
                    completionRate: 0,
                    atRiskCount: 0,
                    createdAt: meta.createdAt,
                    nextDueDate: nextDue, // New Field
                    productType: productType,
                    mode: meta.mode as any,
                    submittedCount: 0,
                    parentLesson: (meta as any).parentLesson // Track if extracted from lesson plan
                };
            }
        });

        allData.forEach(student => {
            if (grouped[student.courseId]) {
                grouped[student.courseId].studentCount++;
                if ((student as any).isSubmitted) {
                    grouped[student.courseId].submittedCount++;
                }

                grouped[student.courseId].avgScore += student.score;
                const studentProgress = student.progress > 0 ? 100 : 0;
                grouped[student.courseId].totalProgress += studentProgress;

                if (student.score < 60) grouped[student.courseId].atRiskCount++;
                if (student.hasAlert) grouped[student.courseId].atRiskCount++; // Increase risk count if safety alert
            }
        });

        let result = Object.values(grouped)
            .map(c => ({
                ...c,
                avgScore: c.studentCount > 0 ? Math.round(c.avgScore / c.studentCount) : 0,
                completionRate: c.studentCount > 0 ? Math.round(c.totalProgress / c.studentCount) : 0
            }));

        // Sorting Logic
        const { key, direction } = sortConfig;
        result.sort((a, b) => {
            let valA = (a as any)[key];
            let valB = (b as any)[key];

            // Handle specific types
            if (key === 'createdAt') {
                const getTime = (d: any) => (d?.seconds ? d.seconds : d instanceof Date ? d.getTime() / 1000 : 0);
                valA = getTime(valA);
                valB = getTime(valB);
            }
            if (key === 'nextDueDate') {
                // Empty dates last
                if (!valA) return 1;
                if (!valB) return -1;
            }
            if (key === 'type') {
                // Sort by type text
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [allData, coursesMap, assignmentsMap, filterSubject, filterGrade, searchTerm, sortConfig]);

    const currentCourseStudents = useMemo(() => {
        if (!selectedCourseId) return [];
        let students = allData.filter(s => s.courseId === selectedCourseId && s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (showOnlyAlerts) {
            students = students.filter(s => s.hasAlert);
        }
        return students;
    }, [allData, selectedCourseId, searchTerm, showOnlyAlerts]);

    const stats = useMemo(() => {
        if (currentCourseStudents.length === 0) return { avg: 0, high: 0, low: 0, risk: 0, distribution: [0, 0, 0, 0] };
        const sum = currentCourseStudents.reduce((acc, curr) => acc + curr.score, 0);
        const dist = [0, 0, 0, 0];
        let risk = 0;
        currentCourseStudents.forEach(s => {
            if (s.score < 60) { dist[0]++; risk++; }
            else if (s.score < 80) dist[1]++;
            else if (s.score < 90) dist[2]++;
            else dist[3]++;
        });
        return { avg: Math.round(sum / currentCourseStudents.length), high: dist[3], low: dist[0], risk, distribution: dist };
    }, [currentCourseStudents]);

    // --- Helpers ---
    // getScoreColor removed

    // --- Handlers ---
    const handleClassAnalysis = async () => {
        if (currentCourseStudents.length < 3) return alert("דרושים לפחות 3 תלמידים לניתוח.");
        setAiLoading(true);
        try {
            const insight = await generateClassAnalysis(currentCourseStudents);
            setAiInsight(insight);
        } catch (e) { alert("שגיאה בניתוח"); }
        finally { setAiLoading(false); }
    };

    const handleGroupAnalysis = () => {
        setAiLoading(true);
        const selectedGroup = currentCourseStudents.filter(s => selectedStudentIds.has(s.id));
        setTimeout(() => {
            const avg = selectedGroup.length > 0 ? Math.round(selectedGroup.reduce((a, b) => a + b.score, 0) / selectedGroup.length) : 0;
            setGroupAnalysis(`**ניתוח קבוצה (${selectedGroup.length} תלמידים):** ממוצע ${avg}.`);
            setAiLoading(false);
        }, 2000);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedStudentIds(newSet);
    };

    const handleCopyLink = (e: React.MouseEvent, courseId: string) => {
        try {
            console.log("handleCopyLink clicked for:", courseId);
            e.stopPropagation();
            const course = coursesMap[courseId];
            console.log("Found course:", course);

            setAssignmentData({
                courseId,
                courseTitle: course ? course.title : "משימה",
                title: course ? `הגשה: ${course.title}` : "",
                dueDate: new Date().toISOString().split('T')[0],
                dueTime: '23:59',
                instructions: ''
            });
            console.log("Setting modal open");
            setAssignmentModalOpen(true);
        } catch (error) {
            console.error("Error in handleCopyLink:", error);
            alert("שגיאה בפתיחת המשימה");
        }
    };

    const handleCreateAssignment = async () => {
        if (!assignmentData.title || !assignmentData.dueDate) return alert("חסרים פרטים");

        try {
            const combinedDate = new Date(`${assignmentData.dueDate}T${assignmentData.dueTime}`);

            const docRef = await addDoc(collection(db, "assignments"), {
                courseId: assignmentData.courseId,
                title: assignmentData.title,
                dueDate: combinedDate.toISOString(),
                instructions: assignmentData.instructions,
                createdAt: serverTimestamp(),
                teacherId: "TODO_USER_ID" // Ideally from context
            });

            const link = `${window.location.origin}/?assignmentId=${docRef.id}`;
            navigator.clipboard.writeText(link);
            setCopiedId(assignmentData.courseId);
            setAssignmentModalOpen(false);
            setTimeout(() => setCopiedId(null), 2000);
            alert("קישור משימה הועתק!");
        } catch (e) {
            console.error("Error creating assignment", e);
            alert("שגיאה ביצירת המשימה");
        }
    };

    const handleEditClick = (e: React.MouseEvent, courseId: string) => {
        e.stopPropagation();
        console.log('[TeacherDashboard] handleEditClick called with courseId:', courseId);
        if (onEditCourse) {
            onEditCourse(courseId);
        }
    };



    const handleDeleteCourse = async () => {
        if (!deleteConfirmation.courseId) return;

        try {
            await deleteDoc(doc(db, "courses", deleteConfirmation.courseId));
            // We rely on onSnapshot to update the list, but we should clear selection
            setSelectedCourseId(null);
            setDeleteConfirmation({ step: 'none', courseId: null });
            alert("הכיתה נמחקה בהצלחה.");
        } catch (error) {
            console.error("Error deleting course:", error);
            alert("שגיאה במחיקת הכיתה.");
        }
    };

    const handleSaveFeedback = async () => {
        if (!viewingTestStudent) return;
        const subId = (viewingTestStudent as any).rawSubmission?.id;
        if (!subId) return alert("לא נמצאה הגשה לשמירה");

        setIsSavingFeedback(true);
        try {
            await updateDoc(doc(db, "submissions", subId), {
                feedback: feedbackText,
                gradedAt: serverTimestamp()
            });
            alert("המשוב נשמר בהצלחה!");
        } catch (error) {
            console.error("Error saving feedback:", error);
            alert("שגיאה בשמירת המשוב");
        } finally {
            setIsSavingFeedback(false);
        }
    };

    if (loading || !isCoursesLoaded) return <div className="h-screen flex items-center justify-center text-wizdi-royal font-bold">טוען נתונים...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans pb-24 text-right" dir="rtl">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 1. TOP BAR */}
                {/* 1. TOP BAR */}
                <header className="card-glass p-0 sticky top-4 z-40 overflow-hidden shadow-glass ring-1 ring-white/40">
                    <div className="p-4 flex flex-col xl:flex-row justify-between items-center gap-4 bg-white/40">

                        {/* RIGHT SIDE (RTL Start) - Title Area */}
                        <div className="flex items-center gap-3 w-full xl:w-auto">
                            {selectedCourseId ? (
                                <div className="flex items-center gap-3 animate-slide-in-right">
                                    <h2 className="text-3xl font-black text-wizdi-royal tracking-tight text-right line-clamp-1 max-w-[600px] drop-shadow-sm" title={aggregatedCourses.find(c => c.courseId === selectedCourseId)?.title}>
                                        {(() => {
                                            const course = aggregatedCourses.find(c => c.courseId === selectedCourseId);
                                            const display = getProductTypeDisplay(course?.productType, course?.mode);
                                            return (
                                                <span className={`font-bold ml-2 text-lg uppercase tracking-wider px-2 py-1 rounded-lg border ${display.headerColor}`}>
                                                    {display.label}
                                                </span>
                                            );
                                        })()}
                                        {aggregatedCourses.find(c => c.courseId === selectedCourseId)?.title || "קורס נבחר"}
                                    </h2>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="bg-gradient-to-br from-wizdi-royal to-wizdi-cyan p-3 rounded-2xl text-white shadow-lg shadow-wizdi-royal/20 transform hover:scale-110 transition-transform duration-300">
                                        <IconLayer className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-black text-wizdi-royal tracking-tight">ניהול למידה</h1>
                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500/80">
                                            <span className="w-2 h-2 rounded-full bg-wizdi-lime animate-pulse"></span>
                                            מערכת בזמן אמת
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* LEFT SIDE (RTL End) - Actions / Filters */}
                        <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                            {selectedCourseId ? (
                                <div className="flex items-center gap-3 animate-fade-in">
                                    <button
                                        onClick={() => setDeleteConfirmation({ step: 'first', courseId: selectedCourseId })}
                                        className="px-5 py-2.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all font-bold flex items-center gap-2 text-sm border border-transparent hover:border-red-100"
                                        title="מחק פעילות/מבחן"
                                    >
                                        <IconTrash className="w-5 h-5 opacity-70 group-hover:opacity-100" /> מחיקה
                                    </button>
                                    <button
                                        onClick={() => setViewingControlCenter(selectedCourseId)}
                                        className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl transition-all font-bold flex items-center gap-2 text-sm border border-indigo-200"
                                        title="לוח בקרת כיתה - צפייה בנתונים מפורטים"
                                    >
                                        <IconChartBar className="w-5 h-5" /> לוח בקרה
                                    </button>
                                    <button
                                        onClick={() => setViewingLessonPlan(selectedCourseId)}
                                        className="px-5 py-2.5 bg-wizdi-cyan/10 hover:bg-wizdi-cyan/20 text-wizdi-cyan rounded-2xl transition-all font-bold flex items-center gap-2 text-sm border border-wizdi-cyan/30"
                                        title="צפה במערך השיעור"
                                    >
                                        <IconEye className="w-5 h-5" /> צפה במערך
                                    </button>
                                    <button
                                        onClick={() => { setSelectedCourseId(null); setAiInsight(null); setSearchTerm(''); setFilterSubject('all'); setFilterGrade('all'); setShowOnlyAlerts(false); }}
                                        className="btn-lip-primary px-6 py-2.5 text-sm flex items-center gap-2 shadow-lg shadow-wizdi-royal/20"
                                    >
                                        <IconArrowBack className="w-5 h-5 rotate-180" /> חזרה ללוח
                                    </button>
                                </div>
                            ) : (
                                <div className="card-glass flex flex-wrap items-center gap-3 w-full xl:w-auto p-2 border border-white/50 shadow-sm backdrop-blur-md">
                                    {/* View Toggle */}
                                    <div className="flex bg-slate-100/80 rounded-xl p-1 gap-1">
                                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'grid' ? 'bg-white shadow-sm text-wizdi-royal scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'}`} title="תצוגת כרטיסיות"><IconLayer className="w-5 h-5" /></button>
                                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'list' ? 'bg-white shadow-sm text-wizdi-royal scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'}`} title="תצוגת רשימה"><IconList className="w-5 h-5" /></button>
                                        <button onClick={() => setViewMode('feedback')} className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'feedback' ? 'bg-white shadow-sm text-wizdi-royal scale-105 font-bold' : 'text-slate-400 hover:text-slate-600'}`} title="משוב תלמידים"><IconFlag className="w-5 h-5" /></button>
                                    </div>

                                    <div className="w-px h-8 bg-slate-200 mx-1"></div>

                                    {/* Email Reports Toggle */}
                                    <button
                                        onClick={() => handleToggleEmailReports(!emailReportsEnabled)}
                                        disabled={isEmailSettingLoading}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                                            emailReportsEnabled
                                                ? 'bg-wizdi-cyan/20 text-wizdi-cyan border border-wizdi-cyan/30'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        } ${isEmailSettingLoading ? 'opacity-50' : ''}`}
                                        title={emailReportsEnabled ? 'דוחות מייל פעילים' : 'הפעל דוחות מייל'}
                                    >
                                        {emailReportsEnabled ? <IconMail className="w-4 h-4" /> : <IconMailOff className="w-4 h-4" />}
                                        <span className="hidden sm:inline">דוחות מייל</span>
                                    </button>

                                    <div className="w-px h-8 bg-slate-200 mx-1"></div>

                                    {/* Filters Group */}
                                    {/* Filters Group - Mobile Optimized */}
                                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto transition-all duration-300">
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <div className="relative group flex-1 md:flex-none">
                                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 group-hover:text-wizdi-royal transition-colors">
                                                    <IconSparkles className="w-4 h-4" />
                                                </div>
                                                <select
                                                    className="w-full md:w-auto bg-white/50 border border-transparent hover:border-slate-200 hover:bg-white text-sm py-2 pr-9 pl-4 rounded-xl focus:ring-2 focus:ring-wizdi-cyan/20 outline-none text-slate-600 font-bold transition-all cursor-pointer appearance-none"
                                                    value={filterType}
                                                    onChange={(e) => setFilterType(e.target.value)}
                                                >
                                                    <option value="all">סוג: הכל</option>
                                                    <option value="test">מבחנים</option>
                                                    <option value="activity">פעילויות</option>
                                                    <option value="lesson">מערכי שיעור</option>
                                                </select>
                                            </div>

                                            {/* Mobile Filter Toggle */}
                                            <button
                                                onClick={() => setShowMobileFilters(!showMobileFilters)}
                                                className={`md:hidden p-2 rounded-xl border transition-colors ${showMobileFilters ? 'bg-wizdi-royal/10 border-wizdi-royal/20 text-wizdi-royal' : 'bg-white border-transparent text-slate-400'}`}
                                            >
                                                <IconList className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Collapsible Filters */}
                                        <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-2 animate-fade-in origin-top`}>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 group-hover:text-wizdi-royal transition-colors">
                                                    <IconBook className="w-4 h-4" />
                                                </div>
                                                <select
                                                    className="w-full md:w-auto bg-white/50 border border-transparent hover:border-slate-200 hover:bg-white text-sm py-2 pr-9 pl-4 rounded-xl focus:ring-2 focus:ring-wizdi-cyan/20 outline-none text-slate-600 font-bold transition-all cursor-pointer appearance-none max-w-none md:max-w-[150px]"
                                                    value={filterSubject}
                                                    onChange={(e) => setFilterSubject(e.target.value)}
                                                >
                                                    <option value="all">מקצוע: הכל</option>
                                                    {availableSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
                                                </select>
                                            </div>

                                            <div className="relative group">
                                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 group-hover:text-wizdi-royal transition-colors">
                                                    <IconLayer className="w-4 h-4" />
                                                </div>
                                                <select
                                                    className="w-full md:w-auto bg-white/50 border border-transparent hover:border-slate-200 hover:bg-white text-sm py-2 pr-9 pl-4 rounded-xl focus:ring-2 focus:ring-wizdi-cyan/20 outline-none text-slate-600 font-bold transition-all cursor-pointer appearance-none max-w-none md:max-w-[150px]"
                                                    value={filterGrade}
                                                    onChange={(e) => setFilterGrade(e.target.value)}
                                                >
                                                    <option value="all">שכבה: הכל</option>
                                                    {availableGrades.map((g, i) => <option key={i} value={g}>{g}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-px h-8 bg-slate-200 mx-1 hidden md:block"></div>

                                    <div className="relative flex-1 min-w-[180px]">
                                        <IconSearch className="w-4 h-4 text-slate-400 absolute right-3 top-3 group-focus-within:text-wizdi-royal transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="חיפוש..."
                                            className="w-full pr-10 pl-4 py-2 bg-white/50 border border-transparent hover:bg-white hover:border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-wizdi-cyan/20 text-slate-700 font-medium transition-all placeholder:text-slate-400"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <div className="w-px h-8 bg-slate-200 mx-1"></div>

                                    <button
                                        onClick={onNavigateToAnalytics}
                                        className="btn-lip-primary px-5 py-2 text-sm flex items-center gap-2 shadow-lg shadow-wizdi-royal/20"
                                        title="Neural Dashboard"
                                    >
                                        <IconBrain className="w-5 h-5" />
                                        <span className="hidden lg:inline">תובנות AI</span>
                                    </button>
                                    <button
                                        onClick={onViewInsights}
                                        className="bg-slate-900 hover:bg-black text-wizdi-lime border border-slate-700/50 px-3 py-2 rounded-xl text-xs font-mono tracking-tight shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
                                        title="Wizdi Monitor"
                                    >
                                        <IconSparkles className="w-4 h-4" />
                                        <span className="hidden xl:inline">MONITOR</span>
                                    </button>
                                    <div className="w-px h-8 bg-slate-200 mx-1"></div>
                                    <ClassroomConnectButton />
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Usage Widget - Shows AI quota usage at the top */}
                {!selectedCourseId && (
                    <div className="mb-6">
                        <TeacherUsageWidget className="max-w-sm" />
                    </div>
                )}

                {!selectedCourseId && (
                    <div className="animate-fade-in relative z-10">
                        {aggregatedCourses.length === 0 ? (
                            <div className="text-center py-24 card-glass rounded-[3rem] shadow-xl flex flex-col items-center justify-center gap-6 group">
                                <div className="bg-wizdi-cloud p-6 rounded-full group-hover:scale-110 transition-transform duration-500">
                                    <IconBook className="w-20 h-20 text-wizdi-royal/30 group-hover:text-wizdi-royal/50 transition-colors" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-wizdi-royal/60 mb-2">טרם נוצרו כיתות</h3>
                                    <p className="text-slate-500/80 text-lg font-medium">זה הזמן ליצור את הפעילות הראשונה שלך!</p>
                                </div>
                                <button onClick={() => { setFilterSubject('all'); setFilterGrade('all'); setSearchTerm(''); }} className="btn-lip-primary px-6 py-2 text-sm">נקה סינונים</button>
                            </div>
                        ) : (
                            <>
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {aggregatedCourses.map(c => (
                                            <div
                                                key={c.courseId}
                                                onClick={() => setViewingControlCenter(c.courseId)}
                                                className="card-glass p-0 cursor-pointer group flex flex-col h-[280px] relative overflow-hidden hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 ring-1 ring-white/60 border-0"
                                            >
                                                {/* Header Color Splash */}
                                                <div className={`h-32 p-6 relative overflow-hidden transition-colors duration-500
                                                    ${c.productType === 'exam'
                                                        ? 'bg-gradient-to-br from-wizdi-cyan to-wizdi-royal'
                                                        : c.productType === 'lesson'
                                                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                                                            : c.productType === 'podcast'
                                                                ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                                                                : 'bg-gradient-to-br from-wizdi-royal to-wizdi-cyan'}
                                                `}>
                                                    {/* Background Pattern */}
                                                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                                                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>

                                                    <div className="relative z-10 flex justify-between items-start">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-md border shadow-sm ${getProductTypeDisplay(c.productType, c.mode).cardColor}`}>
                                                                {getProductTypeDisplay(c.productType, c.mode).label}
                                                            </span>
                                                            {c.parentLesson && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-md border border-white/30">
                                                                    ממערך שיעור
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                                                            <IconArrowBack className="w-5 h-5 text-white rotate-180" />
                                                        </div>
                                                    </div>

                                                    <h3 className="text-2xl font-black text-white mt-4 leading-tight line-clamp-2 drop-shadow-md">
                                                        {c.title}
                                                    </h3>
                                                </div>

                                                {/* Actions Overlay (Top Left) */}
                                                <div className="absolute top-4 left-4 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 transform -translate-y-2 group-hover:translate-y-0">
                                                    <button
                                                        onClick={(e) => handleEditClick(e, c.courseId)}
                                                        className="p-2.5 bg-white text-wizdi-royal hover:bg-blue-50 rounded-xl shadow-lg hover:scale-110 transition-all"
                                                        title="ערוך שיעור"
                                                    >
                                                        <IconEdit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleCopyLink(e, c.courseId)}
                                                        className="p-2.5 bg-wizdi-lime text-green-900 hover:bg-lime-400 rounded-xl shadow-lg hover:scale-110 transition-all font-bold"
                                                        title="העתק קישור להגשה"
                                                    >
                                                        {copiedId === c.courseId ? <IconCheck className="w-4 h-4 text-green-700" /> : <IconLink className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAssignmentData({
                                                                ...assignmentData,
                                                                courseId: c.courseId,
                                                                courseTitle: c.title,
                                                                title: c.title
                                                            });
                                                            setAssignmentModalOpen(true);
                                                        }}
                                                        className="p-2.5 bg-white text-slate-600 hover:text-wizdi-lime hover:bg-wizdi-lime/10 rounded-xl shadow-lg hover:scale-110 transition-all"
                                                        title="שייך ל-Google Classroom"
                                                    >
                                                        <IconBrandGoogle className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShareModalCourse({ id: c.courseId, title: c.title }); }}
                                                        className="p-2.5 bg-white text-slate-600 hover:text-wizdi-royal hover:bg-wizdi-royal/10 rounded-xl shadow-lg hover:scale-110 transition-all"
                                                        title="שתף פעילות/מבחן"
                                                    >
                                                        <IconShare className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Body Content */}
                                                < div className="p-6 flex-1 flex flex-col justify-between bg-gradient-to-b from-white to-blue-50/30" >
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                                            <span className="flex items-center gap-1"><IconBook className="w-3 h-3" /> {c.subject}</span>
                                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                            <span className="flex items-center gap-1"><IconStudent className="w-3 h-3" /> {c.grade}</span>
                                                        </div>

                                                        {/* Progress Bar */}
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-xs font-bold">
                                                                <span className="text-slate-600">התקדמות כיתתית</span>
                                                                <span className="text-wizdi-royal">{c.completionRate}%</span>
                                                            </div>
                                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-110 ${c.completionRate > 80 ? 'bg-gradient-to-r from-teal-400 to-emerald-500' : 'bg-gradient-to-r from-wizdi-royal to-cyan-400'}`}
                                                                    style={{ width: `${c.completionRate}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-100 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-3xl font-black text-slate-800">{c.studentCount}</div>
                                                            <div className="text-xs text-slate-400 font-bold uppercase">תלמידים</div>
                                                        </div>

                                                        {c.atRiskCount > 0 && (
                                                            <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100 animate-pulse">
                                                                <IconAlertTriangle className="w-4 h-4" />
                                                                <span className="text-xs font-black">{c.atRiskCount} בסיכון</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : viewMode === 'list' ? (
                                    /* --- LIST VIEW --- */
                                    <div className="card-glass rounded-3xl shadow-xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-right">
                                                <thead className="bg-wizdi-cloud text-slate-500 font-medium border-b border-slate-100">
                                                    <tr>
                                                        <th onClick={() => setSortConfig({ key: 'title', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 w-1/4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">שם הקורס {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th onClick={() => setSortConfig({ key: 'type', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">סוג {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th onClick={() => setSortConfig({ key: 'subject', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">תחום דעת {sortConfig.key === 'subject' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th onClick={() => setSortConfig({ key: 'grade', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">כיתה/קבוצה {sortConfig.key === 'grade' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th onClick={() => setSortConfig({ key: 'nextDueDate', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">מועד הגשה {sortConfig.key === 'nextDueDate' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th onClick={() => setSortConfig({ key: 'submittedCount', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">תלמידים (הוגשו/סך הכל) {sortConfig.key === 'submittedCount' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th onClick={() => setSortConfig({ key: 'completionRate', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">השלמה {sortConfig.key === 'completionRate' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th onClick={() => setSortConfig({ key: 'avgScore', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">ממוצע {sortConfig.key === 'avgScore' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
                                                        </th>
                                                        <th className="p-4 w-32">פעולות</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {aggregatedCourses.map(c => (
                                                        <tr key={c.courseId} onClick={() => setViewingControlCenter(c.courseId)} className="hover:bg-wizdi-cloud/50 cursor-pointer transition-colors group">
                                                            <td className="p-4">
                                                                <div className="font-bold text-slate-800 text-base group-hover:text-wizdi-royal transition-colors">{c.title}</div>
                                                                <div className="text-xs text-slate-400 mt-1">נוצר ב: {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('he-IL') : '-'}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${getProductTypeDisplay(c.productType, c.mode).color}`}>
                                                                        {getProductTypeDisplay(c.productType, c.mode).label}
                                                                    </span>
                                                                    {c.parentLesson && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-600" title={`ממערך: ${c.parentLesson.title}`}>
                                                                            ממערך
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-4"><span className="bg-wizdi-cloud text-slate-600 px-2 py-1 rounded text-xs font-bold">{c.subject}</span></td>
                                                            <td className="p-4"><span className="bg-wizdi-cloud text-slate-600 px-2 py-1 rounded text-xs font-bold">{c.grade}</span></td>
                                                            <td className="p-4">
                                                                {c.nextDueDate ? (
                                                                    <span className="font-bold bg-wizdi-gold/20 text-wizdi-gold px-2 py-1 rounded-md text-xs">
                                                                        {new Date(c.nextDueDate).toLocaleDateString('he-IL')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs">-</span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 font-bold text-slate-700">
                                                                <div className="flex items-center gap-2">
                                                                    <IconStudent className="w-4 h-4 text-slate-400" />
                                                                    <span>{c.submittedCount} / <span className="text-slate-400">{c.studentCount}</span></span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-gradient-to-l from-wizdi-royal to-wizdi-cyan" style={{ width: `${c.completionRate}%` }}></div>
                                                                    </div>
                                                                    <span className="text-xs font-bold">{c.completionRate}%</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 font-black text-lg text-wizdi-royal">{c.avgScore}</td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    <button onClick={(e) => handleEditClick(e, c.courseId)} className="p-2 hover:bg-white text-slate-400 hover:text-wizdi-royal rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm" title="עריכה"><IconEdit className="w-4 h-4" /></button>
                                                                    <button onClick={(e) => handleCopyLink(e, c.courseId)} className="p-2 hover:bg-white text-slate-400 hover:text-wizdi-lime rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm" title="העתק קישור"><IconLink className="w-4 h-4" /></button>

                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : viewMode === 'feedback' ? (
                                    <div className="space-y-6 animate-fade-in">
                                        {/* Stats Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Positive/Negative Ratio */}
                                            <div className="card-glass p-6 rounded-3xl shadow-xl flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-500 mb-1">יחס משוב</div>
                                                    <div className="text-3xl font-black text-slate-800 flex items-center gap-2">
                                                        <span className="text-wizdi-lime">{courseFeedbackStats?.stats?.positive || 0}</span>
                                                        <span className="text-slate-300 text-lg">/</span>
                                                        <span className="text-red-500">{courseFeedbackStats?.stats?.negative || 0}</span>
                                                    </div>
                                                </div>
                                                <div className="w-16 h-16 rounded-full bg-wizdi-cloud flex items-center justify-center">
                                                    {(courseFeedbackStats?.stats?.positive || 0) > (courseFeedbackStats?.stats?.negative || 0) ?
                                                        <IconCheck className="w-8 h-8 text-wizdi-lime" /> :
                                                        <IconAlertTriangle className="w-8 h-8 text-red-500" />
                                                    }
                                                </div>
                                            </div>

                                            {/* Top Pain Points */}
                                            <div className="card-glass p-6 rounded-3xl shadow-xl col-span-2">
                                                <div className="text-sm font-bold text-wizdi-royal mb-4">נושאים לשיפור (תגיות נפוצות)</div>
                                                <div className="flex gap-3 flex-wrap">
                                                    {Object.entries(courseFeedbackStats?.stats?.tags || {}).map(([tag, count]: any) => (
                                                        <div key={tag} className="bg-red-50 border border-red-100 text-red-700 px-4 py-2 rounded-xl flex items-center gap-2 font-bold">
                                                            <span>{tag === 'confusing' ? 'לא מובן' : tag === 'boring' ? 'משעמם' : tag === 'too_hard' ? 'קשה מדי' : tag === 'bug' ? 'תקלה' : tag}</span>
                                                            <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full">{count}</span>
                                                        </div>
                                                    ))}
                                                    {Object.keys(courseFeedbackStats?.stats?.tags || {}).length === 0 && (
                                                        <div className="text-slate-400 text-sm italic">אין מספיק נתונים עדיין</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Feedback List */}
                                        <div className="card-glass rounded-3xl shadow-xl overflow-hidden min-h-[400px]">
                                            <div className="p-6 border-b border-slate-100 bg-wizdi-cloud/50">
                                                <h3 className="font-bold text-wizdi-royal">תגובות אחרונות</h3>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {isFeedbackLoading ? (
                                                    <div className="p-12 text-center text-wizdi-royal font-bold animate-pulse">טוען משובים...</div>
                                                ) : courseFeedbackStats?.recent?.length > 0 ? (
                                                    courseFeedbackStats.recent.map((fb: any) => (
                                                        <div key={fb.id} className="p-6 hover:bg-wizdi-cloud/30 transition-colors flex gap-4">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${fb.type === 'positive' ? 'bg-wizdi-lime/20 text-wizdi-lime' : 'bg-red-100 text-red-600'}`}>
                                                                {fb.type === 'positive' ? <IconCheck className="w-5 h-5" /> : <IconFlag className="w-5 h-5" />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <div className="font-bold text-slate-800 text-sm">
                                                                        {/* We might want to resolve student name here later, for now showing context/id */}
                                                                        תלמיד (ID: {fb.userId.substring(0, 6)}...)
                                                                    </div>
                                                                    <div className="text-xs text-slate-400">{fb.timestamp?.toDate ? fb.timestamp.toDate().toLocaleDateString('he-IL') : 'היום'}</div>
                                                                </div>

                                                                {fb.tags && fb.tags.length > 0 && (
                                                                    <div className="flex gap-2 mb-2">
                                                                        {fb.tags.map((t: string) => (
                                                                            <span key={t} className="text-xs bg-wizdi-cloud text-slate-600 px-2 py-0.5 rounded border border-slate-200">{t}</span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {fb.comment && <div className="text-slate-600 text-sm bg-wizdi-cloud p-3 rounded-xl">{fb.comment}</div>}
                                                                <div className="text-xs text-slate-400 mt-2">הקשר: {fb.context?.blockType || 'כללי'}</div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-12 text-center text-slate-400">לא נמצאו משובים</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                )
                }

                {/* Selected View... (ללא שינוי) */}
                {
                    selectedCourseId && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="card-glass p-4 rounded-3xl shadow-xl text-center">
                                    <span className="text-xs text-slate-400 font-bold">ממוצע כיתתי</span>
                                    <div className="text-2xl font-black text-wizdi-royal mt-1">{stats.avg}</div>
                                </div>
                                <div className="card-glass p-4 rounded-3xl shadow-xl text-center">
                                    <span className="text-xs text-slate-400 font-bold">מצטיינים</span>
                                    <div className="text-2xl font-black text-wizdi-lime mt-1">{stats.high}</div>
                                </div>
                                <div className="card-glass p-4 rounded-3xl shadow-xl text-center border border-red-100">
                                    <span className="text-xs text-red-400 font-bold">תלמידים בסיכון</span>
                                    <div className="text-2xl font-black text-red-500 mt-1">{stats.risk}</div>
                                </div>
                                <div onClick={handleClassAnalysis} className="bg-gradient-to-br from-wizdi-royal to-wizdi-cyan p-4 rounded-3xl shadow-xl shadow-wizdi-royal/20 text-white flex flex-col justify-center items-center cursor-pointer hover:scale-105 transition-all">
                                    {aiLoading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div> : <IconBrain className="w-6 h-6" />}
                                    <span className="font-bold text-sm">ניתוח כיתתי (AI)</span>
                                </div>
                            </div>

                            {(aiInsight || groupAnalysis) && (
                                <div className="card-glass p-6 rounded-3xl shadow-xl relative">
                                    <button onClick={() => { setAiInsight(null); setGroupAnalysis(null) }} className="absolute top-4 left-4 p-1 hover:bg-slate-100 rounded-full"><IconX className="w-4 h-4 text-slate-400" /></button>
                                    <h3 className="font-bold text-wizdi-royal flex items-center gap-2 mb-4"><IconSparkles className="w-5 h-5 text-wizdi-cyan" />{groupAnalysis ? 'תוצאות ניתוח קבוצתי' : 'תובנות כיתתיות'}</h3>
                                    {groupAnalysis ? <div className="bg-wizdi-cloud p-4 rounded-xl text-slate-700 whitespace-pre-line leading-relaxed">{groupAnalysis}</div> : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="bg-wizdi-lime/10 p-4 rounded-xl border border-wizdi-lime/20"><span className="text-wizdi-lime font-bold block mb-2 border-b border-wizdi-lime/20 pb-1">חוזקות:</span><ul className="list-disc list-inside text-slate-600 space-y-1">{aiInsight.strongSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            <div className="bg-red-50 p-4 rounded-xl border border-red-100"><span className="text-red-500 font-bold block mb-2 border-b border-red-100 pb-1">חולשות:</span><ul className="list-disc list-inside text-slate-600 space-y-1">{aiInsight.weakSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            <div className="col-span-full bg-wizdi-royal/10 p-4 rounded-xl border border-wizdi-royal/20 text-wizdi-royal font-medium">💡 המלצה: {aiInsight.actionItems?.[0]}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Google Classroom Modal */}
                            <ClassroomAssignmentModal
                                isOpen={assignmentModalOpen}
                                onClose={() => setAssignmentModalOpen(false)}
                                examTitle={assignmentData.title}
                                examId={assignmentData.courseId}
                            />

                            {/* Smart Grouping Panel */}
                            <SmartGroupingPanel
                                classId={selectedCourseId}
                                teacherId="TEACHER_123" // Placeholder or from context
                                students={currentCourseStudents}
                            />

                            <div className="card-glass rounded-3xl shadow-xl overflow-hidden min-h-[400px]">
                                <div className="p-4 border-b border-slate-100 bg-wizdi-cloud/50 flex justify-between items-center">
                                    <div className="font-bold text-wizdi-royal text-sm">רשימת תלמידים ({currentCourseStudents.length})</div>
                                    {selectedStudentIds.size > 0 && (
                                        <button onClick={handleGroupAnalysis} className="btn-lip-primary text-xs px-3 py-1 flex items-center gap-1"><IconBrain className="w-3 h-3" /> נתח קבוצה ({selectedStudentIds.size})</button>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-wizdi-cloud text-slate-500 font-medium">
                                            <tr>
                                                <th className="p-4 w-10"></th>
                                                <th className="p-4">שם תלמיד</th>
                                                <th className="p-4">סטטוס</th>
                                                <th className="p-4">פעילות אחרונה</th>
                                                <th className="p-4">התקדמות</th>
                                                <th className="p-4">ציון</th>
                                                <th className="p-4">פעולות</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentCourseStudents.map(student => (
                                                <tr key={student.id} className={`hover:bg-wizdi-cloud/50 transition-colors ${selectedStudentIds.has(student.id) ? 'bg-wizdi-royal/5' : ''}`}>
                                                    <td className="p-4">
                                                        <input type="checkbox" className="rounded border-slate-300 text-wizdi-royal focus:ring-wizdi-cyan" checked={selectedStudentIds.has(student.id)} onChange={() => toggleSelection(student.id)} />
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                                        {student.name}
                                                        {student.hasAlert && (
                                                            <span className="bg-red-100 text-red-600 p-1 rounded-full animate-pulse" title="זוהתה מצוקה">
                                                                <IconFlag className="w-3 h-3" />
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {(student as any).isSubmitted ? (
                                                            <span className="bg-wizdi-lime/20 text-wizdi-lime px-2 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1">
                                                                <IconCheck className="w-3 h-3" /> הוגש
                                                            </span>
                                                        ) : (
                                                            <span className="bg-wizdi-gold/20 text-wizdi-gold px-2 py-1 rounded-lg text-xs font-bold flex items-center w-fit gap-1">
                                                                <IconLoader className="w-3 h-3" /> בתהליך
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-slate-500">{student.lastActive}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-gradient-to-l from-wizdi-royal to-wizdi-cyan" style={{ width: `${student.progress}%` }}></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-500">{student.progress}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded font-bold text-xs ${student.score < 60 ? 'bg-red-100 text-red-600' : 'bg-wizdi-lime/20 text-wizdi-lime'}`}>{student.score}</span>
                                                    </td>
                                                    <td className="p-4 flex gap-2">
                                                        <button onClick={() => setViewingTestStudent(student)} className="p-1.5 text-wizdi-royal hover:bg-wizdi-royal/10 rounded transition-colors" title="צפה"><IconEye className="w-4 h-4" /></button>
                                                        {student.analytics && (
                                                            <button onClick={() => setViewingInsightStudent(student)} className="p-1.5 text-wizdi-cyan hover:bg-wizdi-cyan/10 rounded transition-colors" title="תובנות AI">
                                                                <IconBrain className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button onClick={() => { setReportStudent(student); generateStudentReport(student).then(r => setReportStudent({ ...student, report: r })); }} className="p-1.5 text-wizdi-lime hover:bg-wizdi-lime/10 rounded transition-colors" title="דוח"><IconEdit className="w-4 h-4" /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {currentCourseStudents.length === 0 && <div className="text-center py-10 text-slate-400">לא נמצאו תלמידים בקורס זה</div>}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Modals */}
                {
                    viewingTestStudent && (
                        <div className="fixed inset-0 bg-white z-[100] animate-fade-in flex flex-col">
                            <React.Suspense fallback={<div className="flex-1 flex items-center justify-center text-wizdi-royal font-bold">טוען את נגן המבחן...</div>}>
                                <CoursePlayer
                                    reviewMode={true}
                                    assignment={{
                                        ...coursesMap[viewingTestStudent.courseId],
                                        id: viewingTestStudent.courseId,
                                        courseId: viewingTestStudent.courseId,
                                        activeSubmission: (viewingTestStudent as any).rawSubmission
                                    }}
                                    onExitReview={() => setViewingTestStudent(null)}
                                />
                            </React.Suspense>

                            {/* Feedback Footer */}
                            <div className="bg-white border-t border-wizdi-cloud p-4 shadow-2xl flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">משוב המורה לתלמיד:</label>
                                    <textarea
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-wizdi-cyan outline-none h-16 resize-none"
                                        placeholder="כתוב כאן משוב מילולי..."
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={handleSaveFeedback}
                                        disabled={isSavingFeedback}
                                        className="flex-1 md:flex-none btn-lip-action px-6 py-3 flex items-center justify-center gap-2"
                                    >
                                        {isSavingFeedback ? <span className="animate-spin">⏳</span> : <IconCheck className="w-5 h-5" />}
                                        שמור משוב
                                    </button>
                                    <button
                                        onClick={() => setViewingTestStudent(null)}
                                        className="flex-1 md:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors"
                                    >
                                        סגור
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Assignment Creation Modal */}
                {
                    assignmentModalOpen && createPortal(
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 text-right" dir="rtl">
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                                <div className="bg-gradient-to-l from-wizdi-royal to-wizdi-cyan p-4 text-white flex justify-between items-center">
                                    <h3 className="font-bold text-lg flex items-center gap-2"><IconLink className="w-5 h-5" /> יצירת קישור למשימה</h3>
                                    <button onClick={() => setAssignmentModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><IconX className="w-5 h-5" /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-wizdi-royal mb-1">שם המשימה / מבחן</label>
                                        <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-wizdi-cyan focus:ring-1 focus:ring-wizdi-cyan outline-none"
                                            value={assignmentData.title} onChange={e => setAssignmentData({ ...assignmentData, title: e.target.value })}
                                            placeholder="למשל: סיום פרק ב׳ - חזרה למבחן"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-wizdi-royal mb-1">תאריך הגשה</label>
                                            <input type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-wizdi-cyan outline-none"
                                                value={assignmentData.dueDate} onChange={e => setAssignmentData({ ...assignmentData, dueDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-wizdi-royal mb-1">שעה</label>
                                            <input type="time" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-wizdi-cyan outline-none"
                                                value={assignmentData.dueTime} onChange={e => setAssignmentData({ ...assignmentData, dueTime: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-wizdi-royal mb-1">הנחיות לתלמיד (אופציונלי)</label>
                                        <textarea className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-wizdi-cyan outline-none h-20 resize-none"
                                            value={assignmentData.instructions} onChange={e => setAssignmentData({ ...assignmentData, instructions: e.target.value })}
                                            placeholder="הנחיות מיוחדות, זמן מומלץ, וכו'..."
                                        />
                                    </div>

                                    <button onClick={handleCreateAssignment} className="w-full btn-lip-action py-3 flex justify-center items-center gap-2 mt-2">
                                        <IconLink className="w-5 h-5" /> צור קישור והעתק
                                    </button>
                                    <p className="text-xs text-center text-slate-400">הקישור ישמר בהיסטוריית המשימות של הכיתה</p>
                                </div>
                            </div>
                        </div>
                        , document.body)
                }

                {
                    reportStudent && reportStudent.report && (
                        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-wizdi-royal">דוח הערכה: {reportStudent.name}</h3>
                                    <button onClick={() => setReportStudent(null)}><IconX className="w-6 h-6 text-slate-400 hover:text-red-500" /></button>
                                </div>
                                <div className="bg-wizdi-cloud p-4 rounded-xl text-wizdi-royal text-sm leading-relaxed mb-6">{reportStudent.report.summary}</div>
                                <button onClick={() => window.print()} className="w-full btn-lip-primary py-3">הדפס דוח</button>
                            </div>
                        </div>
                    )
                }


                {/* Insights Modal */}
                {
                    viewingInsightStudent && (
                        <StudentInsightsModal student={viewingInsightStudent} onClose={() => setViewingInsightStudent(null)} />
                    )
                }

                {/* Lesson Plan Viewer Modal */}
                {
                    viewingLessonPlan && (
                        <div className="fixed inset-0 bg-white z-[100] animate-fade-in flex flex-col">
                            <React.Suspense fallback={<div className="flex-1 flex items-center justify-center text-wizdi-royal font-bold">טוען את המערך...</div>}>
                                <CoursePlayer
                                    reviewMode={true}
                                    hideReviewHeader={true}
                                    assignment={{
                                        ...coursesMap[viewingLessonPlan],
                                        id: viewingLessonPlan,
                                        courseId: viewingLessonPlan
                                    }}
                                    onExitReview={() => setViewingLessonPlan(null)}
                                />
                            </React.Suspense>
                        </div>
                    )
                }

            </div >
            {/* --- מודל אישור מחיקה - שלב 1 --- */}
            {
                deleteConfirmation.step === 'first' && createPortal(
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                                    <IconTrash className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-800 mb-2">מחיקת משימה</h3>
                                <p className="text-gray-500 mb-6 leading-relaxed">
                                    האם אתם בטוחים שברצונכם למחוק את המשימה?
                                    <br />
                                    <span className="font-bold text-red-500">פעולה זו תמחק את כל תוצאות התלמידים והנתונים המשויכים למשימה זו.</span>
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeleteConfirmation({ step: 'none', courseId: null })}
                                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                                    >
                                        ביטול
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmation(prev => ({ ...prev, step: 'second' }))}
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-colors"
                                    >
                                        המשך למחיקה
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* --- מודל אישור מחיקה - שלב 2 (סופי) --- */}
            {
                deleteConfirmation.step === 'second' && createPortal(
                    <div className="fixed inset-0 bg-red-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4 animate-fade-in" dir="rtl">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-shake border-4 border-red-500">
                            <div className="p-8 text-center">
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 border-4 border-red-50 animate-pulse">
                                    <IconTrash className="w-10 h-10" />
                                </div>
                                <h3 className="text-3xl font-black text-red-600 mb-2 uppercase tracking-tight">אזהרה אחרונה!</h3>
                                <p className="text-gray-600 mb-8 font-bold text-lg">
                                    פעולה זו היא בלתי הפיכה.
                                    <br />
                                    כל הנתונים יאבדו לנצח.
                                </p>
                                <div className="flex gap-3 flex-col">
                                    <button
                                        onClick={handleDeleteCourse}
                                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-red-200 transition-transform transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <IconTrash className="w-6 h-6" /> כן, מחק את המשימה לצמיתות
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirmation({ step: 'none', courseId: null })}
                                        className="w-full py-3 text-gray-500 font-bold hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors"
                                    >
                                        התחרטתי, בטל מחיקה
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Share Modal */}
            {shareModalCourse && (
                <ShareModal
                    isOpen={!!shareModalCourse}
                    onClose={() => setShareModalCourse(null)}
                    courseId={shareModalCourse.id}
                    courseTitle={shareModalCourse.title}
                    initialTab="assign"
                />
            )}

            {/* Teacher Control Center Modal */}
            {viewingControlCenter && (
                <div className="fixed inset-0 z-[100] bg-slate-50">
                    <React.Suspense fallback={
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                <p className="text-slate-500">טוען לוח בקרה...</p>
                            </div>
                        </div>
                    }>
                        <TeacherControlCenter
                            courseId={viewingControlCenter}
                            onBack={() => setViewingControlCenter(null)}
                            onViewStudent={(studentId) => {
                                // Find student and open their submission
                                const student = allData.find(s => s.id === studentId);
                                if (student) setViewingTestStudent(student);
                            }}
                            onViewLessonPlan={(courseId) => {
                                setViewingControlCenter(null);
                                setViewingLessonPlan(courseId);
                            }}
                            onEditCourse={(courseId) => {
                                setViewingControlCenter(null);
                                if (onEditCourse) onEditCourse(courseId);
                            }}
                        />
                    </React.Suspense>
                </div>
            )}

        </div >
    );
};

export default TeacherDashboard;