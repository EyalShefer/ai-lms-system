import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateClassAnalysis, generateStudentReport } from '../gemini';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
    IconChart, IconStudent, IconBrain, IconList,
    IconCheck, IconX, IconSparkles, IconEdit, IconSave,
    IconFilter, IconEye, IconSearch, IconLayer, IconBook, IconRobot, IconArrowBack
} from '../icons';

// --- Lazy Load CoursePlayer ---
const CoursePlayer = React.lazy(() => import('./CoursePlayer'));

// --- CONSTANTS ---
const GRADE_ORDER = [
    "כיתה א'", "כיתה ב'", "כיתה ג'", "כיתה ד'", "כיתה ה'", "כיתה ו'",
    "כיתה ז'", "כיתה ח'", "כיתה ט'", "כיתה י'", "כיתה יא'", "כיתה יב'",
    "מכינה", "סטודנטים"
];

// --- Helper: Aggressive Normalization ---
const normalizeText = (text: string) => {
    if (!text) return "";
    return text.trim().replace(/[׳`´]/g, "'");
};

// --- Types ---
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
}

interface CourseAggregation {
    courseId: string;
    title: string;
    subject: string;
    grade: string;
    studentCount: number;
    avgScore: number;
    atRiskCount: number;
    createdAt?: any; // הוספנו שדה לתאריך כדי שנוכל למיין
}

const TeacherDashboard: React.FC = () => {
    // --- State ---
    const [rawStudents, setRawStudents] = useState<any[]>([]);
    // הוספנו createdAt ל-State של המפה
    const [coursesMap, setCoursesMap] = useState<Record<string, { subject: string, grade: string, title: string, createdAt?: any }>>({});
    const [isCoursesLoaded, setIsCoursesLoaded] = useState(false);
    const [loading, setLoading] = useState(true);

    // Navigation
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

    // Filters
    const [filterSubject, setFilterSubject] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState("");

    // Detail View State
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [viewingTestStudent, setViewingTestStudent] = useState<StudentStat | null>(null);
    const [reportStudent, setReportStudent] = useState<any>(null);
    const [aiInsight, setAiInsight] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [groupAnalysis, setGroupAnalysis] = useState<string | null>(null);

    // --- 1. Fetch Courses Metadata ---
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const q = query(collection(db, "courses"));
                const snapshot = await getDocs(q);
                const map: Record<string, { subject: string, grade: string, title: string, createdAt?: any }> = {};

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const rawSubject = data.subject || data.topic || "כללי";
                    const rawGrade = data.gradeLevel || data.grade || data.classLevel || "כללי";

                    map[doc.id] = {
                        subject: rawSubject,
                        grade: rawGrade,
                        title: data.title || "ללא שם",
                        createdAt: data.createdAt // שמירת התאריך לצורך מיון
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

    // --- 2. Fetch Students ---
    useEffect(() => {
        const q = collection(db, "student_progress");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const raw = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRawStudents(raw);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- 3. Merge Data ---
    const allData: StudentStat[] = useMemo(() => {
        if (!isCoursesLoaded) return [];

        return rawStudents.map((data: any) => {
            const courseMeta = coursesMap[data.courseId];

            const subject = courseMeta ? courseMeta.subject : "אחר";
            const gradeLevel = courseMeta ? courseMeta.grade : "אחר";
            const courseTitle = courseMeta ? courseMeta.title : "קורס לא נמצא";

            let totalScore = 0, count = 0;
            if (data.grading) {
                Object.values(data.grading).forEach((g: any) => {
                    if (typeof g.grade === 'number') { totalScore += g.grade; count++; }
                });
            }
            const finalScore = count > 0 ? Math.round(totalScore / count) : (data.finalScore || 0);

            return {
                id: data.id,
                name: data.studentEmail?.split('@')[0] || "אנונימי",
                score: finalScore,
                progress: data.answers ? Object.keys(data.answers).length : 0,
                lastActive: data.lastActive ? new Date(data.lastActive).toLocaleDateString('he-IL') : '-',
                answers: data.answers || {},
                chatHistory: data.chatHistory || [],
                courseId: data.courseId,
                subject,
                gradeLevel,
                courseTitle
            };
        });
    }, [rawStudents, coursesMap, isCoursesLoaded]);

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


    // --- Aggregation Logic ---
    const aggregatedCourses = useMemo(() => {
        const grouped: Record<string, CourseAggregation> = {};

        Object.entries(coursesMap).forEach(([id, meta]) => {
            const normMetaSubject = normalizeText(meta.subject);
            const normMetaGrade = normalizeText(meta.grade);
            const normFilterSubject = normalizeText(filterSubject);
            const normFilterGrade = normalizeText(filterGrade);

            const matchSubject = filterSubject === 'all' || normMetaSubject.includes(normFilterSubject);
            const matchGrade = filterGrade === 'all' || normMetaGrade.includes(normFilterGrade);
            const matchSearch = searchTerm === "" || meta.title.toLowerCase().includes(searchTerm.toLowerCase());

            if (matchSubject && matchGrade && matchSearch) {
                grouped[id] = {
                    courseId: id,
                    title: meta.title,
                    subject: meta.subject,
                    grade: meta.grade,
                    studentCount: 0,
                    avgScore: 0,
                    atRiskCount: 0,
                    createdAt: meta.createdAt // מעבירים את התאריך לאובייקט המקובץ
                };
            }
        });

        allData.forEach(student => {
            if (grouped[student.courseId]) {
                grouped[student.courseId].studentCount++;
                grouped[student.courseId].avgScore += student.score;
                if (student.score < 60) grouped[student.courseId].atRiskCount++;
            }
        });

        return Object.values(grouped)
            .map(c => ({
                ...c,
                avgScore: c.studentCount > 0 ? Math.round(c.avgScore / c.studentCount) : 0
            }))
            // --- כאן מתבצע המיון ---
            .sort((a, b) => {
                const getTime = (dateVal: any) => {
                    if (!dateVal) return 0;
                    if (dateVal.seconds) return dateVal.seconds;
                    if (dateVal instanceof Date) return dateVal.getTime() / 1000;
                    return 0;
                };
                return getTime(b.createdAt) - getTime(a.createdAt); // מהחדש לישן
            });
        // -----------------------

    }, [allData, coursesMap, filterSubject, filterGrade, searchTerm]);

    // --- Specific Course Data ---
    const currentCourseStudents = useMemo(() => {
        if (!selectedCourseId) return [];
        return allData.filter(s => s.courseId === selectedCourseId && s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [allData, selectedCourseId, searchTerm]);

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

    const selectAll = () => {
        if (selectedStudentIds.size === currentCourseStudents.length) setSelectedStudentIds(new Set());
        else setSelectedStudentIds(new Set(currentCourseStudents.map(s => s.id)));
    };

    const handleStudentReport = async (student: StudentStat) => {
        setReportStudent(student);
        try {
            const report = await generateStudentReport(student);
            setReportStudent({ ...student, report });
        } catch (e) { alert("שגיאה"); setReportStudent(null); }
    };

    if (loading || !isCoursesLoaded) return <div className="h-screen flex items-center justify-center text-indigo-600 font-bold bg-slate-50">טוען נתונים...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans pb-24 text-right" dir="rtl">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 1. TOP BAR */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 sticky top-4 z-30">
                    <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3 w-full">
                            {selectedCourseId ? (
                                <button
                                    onClick={() => { setSelectedCourseId(null); setAiInsight(null); setSearchTerm(''); setFilterSubject('all'); setFilterGrade('all'); }}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors flex items-center gap-2 font-bold shadow-sm border border-indigo-200"
                                >
                                    <IconArrowBack className="w-5 h-5 rotate-180" /> חזרה לכל הכיתות
                                </button>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-200"><IconLayer className="w-6 h-6" /></div>
                                    <div>
                                        <h1 className="text-xl font-bold text-slate-800">הכיתות שלי</h1>
                                        <p className="text-xs text-slate-500">פורטל ניהול פדגוגי</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Filters - Visible Only in Global View */}
                        {!selectedCourseId && (
                            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                    <IconBook className="w-4 h-4 text-slate-400" />
                                    <select
                                        className="bg-transparent border-none text-sm p-0 focus:ring-0 text-slate-700 font-medium min-w-[120px] cursor-pointer"
                                        value={filterSubject}
                                        onChange={(e) => setFilterSubject(e.target.value)}
                                    >
                                        <option value="all">כל המקצועות</option>
                                        {availableSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                    <IconLayer className="w-4 h-4 text-slate-400" />
                                    <select
                                        className="bg-transparent border-none text-sm p-0 focus:ring-0 text-slate-700 font-medium min-w-[120px] cursor-pointer"
                                        value={filterGrade}
                                        onChange={(e) => setFilterGrade(e.target.value)}
                                    >
                                        <option value="all">כל השכבות</option>
                                        {availableGrades.map((g, i) => <option key={i} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                                <div className="relative flex-1 min-w-[200px]">
                                    <IconSearch className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                    <input
                                        type="text"
                                        placeholder="חיפוש כיתה..."
                                        className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {selectedCourseId && (
                            <div className="bg-indigo-50 px-4 py-2 rounded-xl text-indigo-800 font-bold border border-indigo-100 shadow-sm flex items-center gap-2">
                                <IconBook className="w-4 h-4" />
                                {aggregatedCourses.find(c => c.courseId === selectedCourseId)?.title || "קורס נבחר"}
                            </div>
                        )}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {aggregatedCourses.map(c => (
                                    <div
                                        key={c.courseId}
                                        onClick={() => setSelectedCourseId(c.courseId)}
                                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between h-48 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{c.subject}</span>
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{c.grade}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-700 transition-colors line-clamp-2">{c.title}</h3>
                                        </div>

                                        <div className="flex justify-between items-end border-t border-slate-50 pt-4 mt-4">
                                            <div className="text-center">
                                                <span className="block text-2xl font-bold text-slate-700">{c.studentCount}</span>
                                                <span className="text-[10px] text-slate-400">תלמידים</span>
                                            </div>
                                            <div className="text-center">
                                                <span className={`block text-2xl font-bold ${c.atRiskCount > 0 ? 'text-red-500' : 'text-slate-300'}`}>{c.atRiskCount}</span>
                                                <span className="text-[10px] text-slate-400">בסיכון</span>
                                            </div>
                                            <div className="bg-indigo-50 p-2 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors text-indigo-600">
                                                <IconArrowBack className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {selectedCourseId && (
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
                                                <td className="p-4 font-bold text-slate-800">{student.name}</td>
                                                <td className="p-4 text-slate-500">{student.lastActive}</td>
                                                <td className="p-4">
                                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(student.progress * 10, 100)}%` }}></div>
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
                )}

                {/* --- Modals --- */}
                {viewingTestStudent && (
                    <div className="fixed inset-0 bg-white z-[100] animate-fade-in flex flex-col">
                        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-indigo-600 font-bold">טוען את נגן המבחן...</div>}>
                            <CoursePlayer
                                reviewMode={true}
                                studentData={{
                                    studentName: viewingTestStudent.name,
                                    answers: viewingTestStudent.answers,
                                    chatHistory: viewingTestStudent.chatHistory
                                }}
                                onExitReview={() => setViewingTestStudent(null)}
                            />
                        </Suspense>
                    </div>
                )}

                {reportStudent && reportStudent.report && (
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
                )}
            </div>
        </div>
    );
};

export default TeacherDashboard;