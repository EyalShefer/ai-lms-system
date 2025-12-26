import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { generateClassAnalysis, generateStudentReport } from '../gemini';
// type SubmissionData unused removed
import { gradeBatch } from '../services/gradingService';
import { collection, query, onSnapshot, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore'; // Added deleteDoc, doc, updateDoc
import { db } from '../firebase';
import {
    IconBrain, IconX, IconSparkles, IconEdit, IconTrash,
    IconEye, IconSearch, IconLayer, IconBook, IconArrowBack,
    IconLink, IconCheck, IconStudent, IconList,
    IconArrowUp, IconArrowDown, IconLoader, IconFlag
} from '../icons';

// --- Lazy Load CoursePlayer ---
const CoursePlayer = React.lazy(() => import('./CoursePlayer'));

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
    type: 'test' | 'activity'; // Added type
    submittedCount: number; // New field for submitted count
}

interface TeacherDashboardProps {
    onEditCourse?: (courseId: string) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onEditCourse }) => {
    // --- State ---
    const [rawStudents, setRawStudents] = useState<any[]>([]);
    const [rawSubmissions, setRawSubmissions] = useState<any[]>([]);
    const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]); // New State
    const [coursesMap, setCoursesMap] = useState<Record<string, { subject: string, grade: string, title: string, createdAt?: any, syllabus?: any[] }>>({});
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

    // Navigation
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

    // Filters
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all'); // Added Type Filter
    const [searchTerm, setSearchTerm] = useState("");

    // View State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to LIST
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

    // Detail View State
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [viewingTestStudent, setViewingTestStudent] = useState<StudentStat | null>(null);
    const [reportStudent, setReportStudent] = useState<any>(null);
    const [aiInsight, setAiInsight] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [groupAnalysis, setGroupAnalysis] = useState<string | null>(null);

    // Feedback State
    const [feedbackText, setFeedbackText] = useState("");
    const [isSavingFeedback, setIsSavingFeedback] = useState(false);
    const [isGrading, setIsGrading] = useState<Record<string, boolean>>({}); // Loading state per courseId
    const [showOnlyAlerts, setShowOnlyAlerts] = useState(false); // New Filter State

    useEffect(() => {
        if (viewingTestStudent) {
            setFeedbackText((viewingTestStudent as any).rawSubmission?.feedback || "");
        }
    }, [viewingTestStudent]);

    const [assignmentsMap, setAssignmentsMap] = useState<Record<string, any[]>>({});

    // --- 1. Fetch Courses Metadata ---
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const q = query(collection(db, "courses"));
                const snapshot = await getDocs(q);
                // Updated mapped type to include syllabus for type detection
                const map: Record<string, { subject: string, grade: string, title: string, createdAt?: any, syllabus?: any[] }> = {};

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const rawSubject = data.subject || data.topic || "כללי";
                    const rawGrade = data.gradeLevel || data.grade || data.classLevel || "כללי";

                    map[doc.id] = {
                        subject: rawSubject,
                        grade: rawGrade,
                        title: data.title || "ללא שם",
                        createdAt: data.createdAt,
                        syllabus: data.syllabus // Store syllabus
                    };
                });
                setCoursesMap(map);
                setIsCoursesLoaded(true);
            } catch (error) {
                console.error("Error fetching courses map:", error);
            }
        };
        fetchCourses();
    }, []);

    // --- 1.5 Fetch Assignments for Due Dates ---
    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const q = query(collection(db, "assignments"));
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
    }, []);


    // --- 2. Fetch Students & Submissions ---
    useEffect(() => {
        // Fetch Submissions
        const qSub = collection(db, "submissions");
        const unsubSub = onSnapshot(qSub, (snapshot) => {
            const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRawSubmissions(subs);
        });

        // Legend: We might still need student_progress for older data, but for now we focus on submissions for the new flow.
        // If you want to keep 'student_progress' for "Registered" students who haven't submitted, keep this.
        const q = collection(db, "student_progress");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const raw = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRawStudents(raw);
            setLoading(false);
        });

        // Safety Alerts Listener
        const qAlerts = query(collection(db, "safety_alerts"), where("isHandled", "==", false));
        const unsubAlerts = onSnapshot(qAlerts, (snapshot) => {
            const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSafetyAlerts(alerts);
        });

        return () => { unsubscribe(); unsubSub(); unsubAlerts(); };
    }, []);

    // --- 3. Merge Data ---
    const allData: StudentStat[] = useMemo(() => {
        if (!isCoursesLoaded) return [];

        const studentsMap: Record<string, StudentStat> = {};

        // 1. Process "In Progress" students (rawStudents)
        rawStudents.forEach((data: any) => {
            const courseMeta = coursesMap[data.courseId];
            const subject = courseMeta ? courseMeta.subject : "אחר";
            const gradeLevel = courseMeta ? courseMeta.grade : "אחר";
            const courseTitle = courseMeta ? courseMeta.title : "קורס לא נמצא";

            // Normalize ID if email exists
            const id = data.studentEmail || data.id;

            // Check for alerts
            const hasAlert = safetyAlerts.some((a: any) => a.studentId === data.id || a.studentName === studentsMap[id].name);

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
                hasAlert: studentsMap[key]?.hasAlert || hasAlert
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

            // Type Filtering Logic
            const hasTest = meta.syllabus?.some((m: any) => m.learningUnits?.some((u: any) => u.type === 'test'));
            const matchType = filterType === 'all' ||
                (filterType === 'test' && hasTest) ||
                (filterType === 'activity' && !hasTest);

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
                    type: hasTest ? 'test' : 'activity',
                    submittedCount: 0
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
    const getScoreColor = (score: number) => {
        if (score >= 85) return 'text-teal-500';
        if (score >= 70) return 'text-yellow-600';
        return 'text-red-500';
    };

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

    if (loading || !isCoursesLoaded) return <div className="h-screen flex items-center justify-center text-indigo-600 font-bold bg-slate-50">טוען נתונים...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans pb-24 text-right" dir="rtl">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 1. TOP BAR */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 sticky top-4 z-30">
                    <div className="flex flex-col xl:flex-row justify-between items-center gap-4">

                        {/* RIGHT SIDE (RTL Start) - Title Area */}
                        <div className="flex items-center gap-3 w-full xl:w-auto">
                            {selectedCourseId ? (
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight text-right line-clamp-1 max-w-[600px]" title={aggregatedCourses.find(c => c.courseId === selectedCourseId)?.title}>
                                        <span className="text-indigo-600 font-medium ml-1">
                                            {aggregatedCourses.find(c => c.courseId === selectedCourseId)?.type === 'test' ? 'מבחן:' : 'פעילות:'}
                                        </span>
                                        {aggregatedCourses.find(c => c.courseId === selectedCourseId)?.title || "קורס נבחר"}
                                    </h2>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-200"><IconLayer className="w-6 h-6" /></div>
                                    <div>
                                        <h1 className="text-xl font-bold text-slate-800">המשימות שלי</h1>
                                        <p className="text-xs text-slate-500">פורטל ניהול פדגוגי</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* LEFT SIDE (RTL End) - Actions / Filters */}
                        <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                            {selectedCourseId ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setDeleteConfirmation({ step: 'first', courseId: selectedCourseId })}
                                        className="px-4 py-2 text-red-600 hover:bg-red-50 bg-white border border-red-100 rounded-xl transition-all font-bold flex items-center gap-2"
                                        title="מחק פעילות/מבחן"
                                    >
                                        <IconTrash className="w-5 h-5" /> מחיקה
                                    </button>
                                    <button
                                        onClick={() => { setSelectedCourseId(null); setAiInsight(null); setSearchTerm(''); setFilterSubject('all'); setFilterGrade('all'); setShowOnlyAlerts(false); }}
                                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors flex items-center gap-2 font-bold shadow-sm border border-indigo-200"
                                    >
                                        <IconArrowBack className="w-5 h-5 rotate-180" /> חזרה ללוח המשימות
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    {/* View Toggle */}
                                    <div className="flex bg-slate-200 rounded-lg p-1 gap-1">
                                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="תצוגת כרטיסיות"><IconLayer className="w-4 h-4" /></button>
                                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`} title="תצוגת רשימה"><IconList className="w-4 h-4" /></button>
                                    </div>
                                    <div className="w-px h-6 bg-slate-300 mx-1"></div>

                                    {/* Type Filter */}
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <IconSparkles className="w-4 h-4 text-slate-400" />
                                        <select className="bg-transparent border-none text-sm p-0 focus:ring-0 text-slate-700 font-medium min-w-[100px] cursor-pointer" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                            <option value="all">כל הסוגים</option>
                                            <option value="test">מבחנים</option>
                                            <option value="activity">פעילויות</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <IconBook className="w-4 h-4 text-slate-400" />
                                        <select className="bg-transparent border-none text-sm p-0 focus:ring-0 text-slate-700 font-medium min-w-[120px] cursor-pointer" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
                                            <option value="all">כל המקצועות</option>
                                            {availableSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <IconLayer className="w-4 h-4 text-slate-400" />
                                        <select className="bg-transparent border-none text-sm p-0 focus:ring-0 text-slate-700 font-medium min-w-[120px] cursor-pointer" value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
                                            <option value="all">כל השכבות</option>
                                            {availableGrades.map((g, i) => <option key={i} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-px h-6 bg-slate-300 mx-1"></div>
                                    <div className="relative flex-1 min-w-[200px]">
                                        <IconSearch className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                        <input type="text" placeholder="חיפוש כיתה..." className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                    </div>
                                    <button
                                        onClick={() => setShowOnlyAlerts(!showOnlyAlerts)}
                                        className={`p-2 rounded-lg transition-colors border ${showOnlyAlerts ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500'}`}
                                        title="הצג רק התראות אלימות/מצוקה"
                                    >
                                        <IconFlag className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {!selectedCourseId && (
                    <div className="animate-fade-in">
                        {aggregatedCourses.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                                <IconBook className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-400">לא נמצאו כיתות</h3>
                                <p className="text-slate-400 mb-4">נסה לשנות את הסינון או צור קורס חדש</p>
                                <button onClick={() => { setFilterSubject('all'); setFilterGrade('all'); setSearchTerm(''); }} className="text-indigo-600 font-bold hover:underline">נקה סינונים</button>
                            </div>
                        ) : (
                            <>
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {aggregatedCourses.map(c => (
                                            <div
                                                key={c.courseId}
                                                onClick={() => setSelectedCourseId(c.courseId)}
                                                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between h-48 relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

                                                {/* כפתורי פעולה */}
                                                <div className="absolute top-4 left-4 flex gap-2 z-20">
                                                    <button
                                                        onClick={(e) => handleEditClick(e, c.courseId)}
                                                        className="p-2 bg-white/80 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-full shadow-sm border border-slate-100 transition-all"
                                                        title="ערוך שיעור"
                                                    >
                                                        <IconEdit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleCopyLink(e, c.courseId)}
                                                        className="p-2 bg-white/80 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-full shadow-sm border border-slate-100 transition-all"
                                                        title="העתק קישור לתלמיד"
                                                    >
                                                        {copiedId === c.courseId ? <IconCheck className="w-4 h-4 text-green-500" /> : <IconLink className="w-4 h-4" />}
                                                    </button>
                                                </div>

                                                {/* Header: שם ופרטים */}
                                                <div>
                                                    <div className="flex items-start gap-2 mb-2 pl-24">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-md whitespace-nowrap">{c.subject}</span>
                                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md whitespace-nowrap">{c.grade}</span>
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-700 transition-colors line-clamp-2 pl-24 leading-tight">{c.title}</h3>
                                                </div>

                                                {/* Body: הנתונים החדשים (ממוצע + אחוז השלמה) */}
                                                <div className="flex justify-between items-center mt-6 px-2">
                                                    <div className="text-center">
                                                        <span className="text-xs font-bold text-slate-400 block mb-1">ממוצע כיתתי</span>
                                                        <span className={`text-4xl font-black ${getScoreColor(c.avgScore)}`}>
                                                            {c.avgScore || '-'}
                                                        </span>
                                                    </div>
                                                    <div className="w-px h-10 bg-slate-100"></div>
                                                    <div className="text-center">
                                                        <span className="text-xs font-bold text-slate-400 block mb-1">אחוז השלמה</span>
                                                        <span className="text-4xl font-black text-slate-700">
                                                            {c.completionRate}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Footer: התרעות */}
                                                <div className="mt-auto pt-4">
                                                    {c.atRiskCount > 0 ? (
                                                        <div className="bg-red-50 text-red-600 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 border border-red-100 animate-pulse">
                                                            ⚠️ {c.atRiskCount} תלמידים דורשים התייחסות
                                                        </div>
                                                    ) : (
                                                        <div className="bg-teal-50 text-teal-600 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 border border-teal-100">
                                                            <IconCheck className="w-3 h-3" /> {c.studentCount} הגשות
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* --- LIST VIEW --- */
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-right">
                                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                                    <tr>
                                                        <th onClick={() => setSortConfig({ key: 'title', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })} className="p-4 w-1/4 cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <div className="flex items-center gap-1">שם הקורס {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />)}</div>
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
                                                        <tr key={c.courseId} onClick={() => setSelectedCourseId(c.courseId)} className="hover:bg-indigo-50/50 cursor-pointer transition-colors group">
                                                            <td className="p-4">
                                                                <div className="font-bold text-slate-800 text-base group-hover:text-indigo-700 transition-colors">{c.title}</div>
                                                                <div className="text-xs text-slate-400 mt-1">נוצר ב: {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('he-IL') : '-'}</div>
                                                            </td>
                                                            <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{c.subject}</span></td>
                                                            <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{c.grade}</span></td>
                                                            <td className="p-4">
                                                                {c.nextDueDate ? (
                                                                    <span className="text-slate-700 font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-md text-xs border border-yellow-100">
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
                                                                        <div className="h-full bg-indigo-500" style={{ width: `${c.completionRate}%` }}></div>
                                                                    </div>
                                                                    <span className="text-xs font-bold">{c.completionRate}%</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 font-black text-lg text-slate-700">{c.avgScore}</td>
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-2">
                                                                    <button onClick={(e) => handleEditClick(e, c.courseId)} className="p-2 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm" title="עריכה"><IconEdit className="w-4 h-4" /></button>
                                                                    <button onClick={(e) => handleCopyLink(e, c.courseId)} className="p-2 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-slate-200 shadow-sm" title="העתק קישור"><IconLink className="w-4 h-4" /></button>

                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Selected View... (ללא שינוי) */}
                {
                    selectedCourseId && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                    <span className="text-xs text-slate-400 font-bold">ממוצע כיתתי</span>
                                    <div className="text-2xl font-black text-slate-700 mt-1">{stats.avg}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                                    <span className="text-xs text-slate-400 font-bold">מצטיינים</span>
                                    <div className="text-2xl font-black text-teal-500 mt-1">{stats.high}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-red-50 shadow-sm text-center">
                                    <span className="text-xs text-red-400 font-bold">תלמידים בסיכון</span>
                                    <div className="text-2xl font-black text-red-500 mt-1">{stats.risk}</div>
                                </div>
                                <div onClick={handleClassAnalysis} className="bg-indigo-600 p-4 rounded-xl shadow-lg shadow-indigo-200 text-white flex flex-col justify-center items-center cursor-pointer hover:bg-indigo-700 transition-colors">
                                    {aiLoading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div> : <IconBrain className="w-6 h-6" />}
                                    <span className="font-bold text-sm">ניתוח כיתתי (AI)</span>
                                </div>
                            </div>

                            {(aiInsight || groupAnalysis) && (
                                <div className="bg-gradient-to-br from-white to-indigo-50/50 p-6 rounded-3xl border border-indigo-100 shadow-sm relative">
                                    <button onClick={() => { setAiInsight(null); setGroupAnalysis(null) }} className="absolute top-4 left-4 p-1 hover:bg-slate-100 rounded-full"><IconX className="w-4 h-4 text-slate-400" /></button>
                                    <h3 className="font-bold text-indigo-900 flex items-center gap-2 mb-4"><IconSparkles className="w-5 h-5 text-indigo-600" />{groupAnalysis ? 'תוצאות ניתוח קבוצתי' : 'תובנות כיתתיות'}</h3>
                                    {groupAnalysis ? <div className="bg-white p-4 rounded-xl border border-indigo-100 text-slate-700 whitespace-pre-line leading-relaxed">{groupAnalysis}</div> : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm"><span className="text-teal-600 font-bold block mb-2 border-b border-teal-50 pb-1">חוזקות:</span><ul className="list-disc list-inside text-slate-600 space-y-1">{aiInsight.strongSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm"><span className="text-red-500 font-bold block mb-2 border-b border-red-50 pb-1">חולשות:</span><ul className="list-disc list-inside text-slate-600 space-y-1">{aiInsight.weakSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
                                            <div className="col-span-full bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-indigo-800 font-medium">💡 המלצה: {aiInsight.actionItems?.[0]}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <div className="font-bold text-slate-700 text-sm">רשימת תלמידים ({currentCourseStudents.length})</div>
                                    {selectedStudentIds.size > 0 && (
                                        <button onClick={handleGroupAnalysis} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"><IconBrain className="w-3 h-3" /> נתח קבוצה ({selectedStudentIds.size})</button>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="p-4 w-10"></th>
                                                <th className="p-4">שם תלמיד</th>
                                                <th className="p-4">פעילות אחרונה</th>
                                                <th className="p-4">התקדמות</th>
                                                <th className="p-4">ציון</th>
                                                <th className="p-4">פעולות</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentCourseStudents.map(student => (
                                                <tr key={student.id} className={`hover:bg-slate-50/80 transition-colors ${selectedStudentIds.has(student.id) ? 'bg-indigo-50/50' : ''}`}>
                                                    <td className="p-4">
                                                        <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={selectedStudentIds.has(student.id)} onChange={() => toggleSelection(student.id)} />
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                                        {student.name}
                                                        {student.hasAlert && (
                                                            <span className="bg-red-100 text-red-600 p-1 rounded-full animate-pulse" title="זוהתה מצוקה">
                                                                <IconFlag className="w-3 h-3" />
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-slate-500">{student.lastActive}</td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-indigo-500" style={{ width: `${student.progress}%` }}></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-500">{student.progress}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded font-bold text-xs ${student.score < 60 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{student.score}</span>
                                                    </td>
                                                    <td className="p-4 flex gap-2">
                                                        <button onClick={() => setViewingTestStudent(student)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="צפה"><IconEye className="w-4 h-4" /></button>
                                                        <button onClick={() => { setReportStudent(student); generateStudentReport(student).then(r => setReportStudent({ ...student, report: r })); }} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors" title="דוח"><IconEdit className="w-4 h-4" /></button>
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
                            <React.Suspense fallback={<div className="flex-1 flex items-center justify-center text-indigo-600 font-bold">טוען את נגן המבחן...</div>}>
                                <CoursePlayer
                                    reviewMode={true}
                                    assignment={{
                                        ...coursesMap[viewingTestStudent.courseId],
                                        activeSubmission: (viewingTestStudent as any).rawSubmission
                                    }}
                                    onExitReview={() => setViewingTestStudent(null)}
                                />
                            </React.Suspense>

                            {/* Feedback Footer */}
                            <div className="bg-white border-t border-indigo-100 p-4 shadow-2xl flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 w-full">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">משוב המורה לתלמיד:</label>
                                    <textarea
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none h-16 resize-none"
                                        placeholder="כתוב כאן משוב מילולי..."
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <button
                                        onClick={handleSaveFeedback}
                                        disabled={isSavingFeedback}
                                        className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                                    >
                                        {isSavingFeedback ? <span className="animate-spin">⏳</span> : <IconCheck className="w-5 h-5" />}
                                        שמור משוב
                                    </button>
                                    <button
                                        onClick={() => setViewingTestStudent(null)}
                                        className="flex-1 md:flex-none px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
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
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 text-right" dir="rtl">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                                    <h3 className="font-bold text-lg flex items-center gap-2"><IconLink className="w-5 h-5" /> יצירת קישור למשימה</h3>
                                    <button onClick={() => setAssignmentModalOpen(false)} className="hover:bg-indigo-700 p-1 rounded-full text-indigo-100"><IconX className="w-5 h-5" /></button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">שם המשימה / מבחן</label>
                                        <input type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            value={assignmentData.title} onChange={e => setAssignmentData({ ...assignmentData, title: e.target.value })}
                                            placeholder="למשל: סיום פרק ב׳ - חזרה למבחן"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">תאריך הגשה</label>
                                            <input type="date" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                                value={assignmentData.dueDate} onChange={e => setAssignmentData({ ...assignmentData, dueDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">שעה</label>
                                            <input type="time" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none"
                                                value={assignmentData.dueTime} onChange={e => setAssignmentData({ ...assignmentData, dueTime: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">הנחיות לתלמיד (אופציונלי)</label>
                                        <textarea className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:border-indigo-500 outline-none h-20 resize-none"
                                            value={assignmentData.instructions} onChange={e => setAssignmentData({ ...assignmentData, instructions: e.target.value })}
                                            placeholder="הנחיות מיוחדות, זמן מומלץ, וכו'..."
                                        />
                                    </div>

                                    <button onClick={handleCreateAssignment} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2 mt-2">
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
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-800">דוח הערכה: {reportStudent.name}</h3>
                                    <button onClick={() => setReportStudent(null)}><IconX className="w-6 h-6 text-slate-400 hover:text-red-500" /></button>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-xl text-blue-900 text-sm leading-relaxed mb-6">{reportStudent.report.summary}</div>
                                <button onClick={() => window.print()} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">הדפס דוח</button>
                            </div>
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

        </div >
    );
};

export default TeacherDashboard;