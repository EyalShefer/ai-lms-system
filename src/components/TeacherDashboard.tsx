import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateClassAnalysis, generateStudentReport } from '../gemini';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
    IconChart, IconStudent, IconBrain, IconList,
    IconCheck, IconX, IconSparkles, IconEdit, IconSave
} from '../icons';

interface StudentStat {
    id: string;
    name: string;
    score: number;
    progress: number;
    lastActive: string;
    weakness?: string;
}

const TeacherDashboard: React.FC = () => {
    const { course } = useCourseStore();

    // מצבי טעינה ונתונים
    const [students, setStudents] = useState<StudentStat[]>([]);
    const [loading, setLoading] = useState(true);

    // סטטיסטיקות מחושבות
    const [averageScore, setAverageScore] = useState(0);
    const [atRiskCount, setAtRiskCount] = useState(0);
    const [distribution, setDistribution] = useState([0, 0, 0, 0]); // נכשל, עובר, טוב, מצוין

    // ניתוח כיתתי (AI)
    const [aiInsight, setAiInsight] = useState<any>(null);
    const [aiLoading, setAiLoading] = useState(false);

    // ניתוח אישי (תעודה)
    const [analyzingStudentId, setAnalyzingStudentId] = useState<string | null>(null);
    const [selectedStudentReport, setSelectedStudentReport] = useState<any>(null);

    useEffect(() => {
        if (!course.id) return;

        // האזנה לנתוני התלמידים בזמן אמת מ-Firestore
        const q = query(collection(db, "student_progress"), where("courseId", "==", course.id));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const rawData = snapshot.docs.map(doc => {
                const data = doc.data();

                // חישוב ציון משוקלל מתוך הנתונים שנשמרו
                let totalScore = 0;
                let count = 0;
                if (data.grading) {
                    Object.values(data.grading).forEach((g: any) => {
                        if (typeof g.grade === 'number') {
                            totalScore += g.grade;
                            count++;
                        }
                    });
                }
                const finalScore = count > 0 ? Math.round(totalScore / count) : (data.finalScore || 0);

                return {
                    id: doc.id,
                    name: data.studentEmail?.split('@')[0] || "אנונימי", // שם משתמש מהאימייל
                    score: finalScore,
                    progress: data.answers ? Object.keys(data.answers).length : 0, // התקדמות לפי כמות תשובות
                    lastActive: data.lastActive ? new Date(data.lastActive).toLocaleDateString('he-IL') : '-'
                };
            });

            setStudents(rawData);
            calculateStats(rawData);
            setLoading(false);

            // הפעלת ניתוח AI אוטומטי (רק אם יש מספיק נתונים ועדיין לא נוצר)
            if (rawData.length >= 3 && !aiInsight && !aiLoading) {
                setAiLoading(true);
                generateClassAnalysis(rawData)
                    .then(insight => setAiInsight(insight))
                    .catch(e => console.error("Failed to generate class analysis", e))
                    .finally(() => setAiLoading(false));
            }
        });

        return () => unsubscribe();
    }, [course.id]);

    const calculateStats = (data: StudentStat[]) => {
        if (data.length === 0) return;

        const sum = data.reduce((acc, curr) => acc + curr.score, 0);
        setAverageScore(Math.round(sum / data.length));

        const risk = data.filter(s => s.score < 60).length;
        setAtRiskCount(risk);

        const dist = [0, 0, 0, 0];
        data.forEach(s => {
            if (s.score < 56) dist[0]++;      // נכשל
            else if (s.score < 76) dist[1]++; // עובר
            else if (s.score < 91) dist[2]++; // טוב
            else dist[3]++;                   // מצוין
        });
        setDistribution(dist);
    };

    const handleGenerateStudentReport = async (student: any) => {
        setAnalyzingStudentId(student.id);
        try {
            const report = await generateStudentReport(student);
            setSelectedStudentReport(report);
        } catch (e) {
            alert("שגיאה ביצירת דוח לתלמיד");
        } finally {
            setAnalyzingStudentId(null);
        }
    };

    const exportToCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "\uFEFFשם תלמיד,ציון,התקדמות (שאלות שנענו),נראה לאחרונה\n";
        students.forEach(row => {
            csvContent += `${row.name},${row.score},${row.progress},${row.lastActive}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ציונים_${course.title}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-bold bg-gray-50">טוען נתונים...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans pb-20">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><IconChart className="w-8 h-8 text-indigo-600" /> דשבורד פדגוגי</h1>
                        <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">מערך שיעור: <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{course.title}</span></p>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm hover:shadow flex items-center gap-2 text-sm"
                    >
                        <IconSave className="w-4 h-4" /> ייצוא לאקסל
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="glass p-6 rounded-2xl shadow-sm border border-white/60 bg-white/70 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><IconChart className="w-3 h-3" /> ממוצע כיתתי</div>
                        <div className={`text-5xl font-extrabold mt-2 ${averageScore > 80 ? 'text-green-500' : averageScore > 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                            {averageScore}
                        </div>
                    </div>
                    <div className="glass p-6 rounded-2xl shadow-sm border border-white/60 bg-white/70 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><IconSparkles className="w-3 h-3" /> מצטיינים (90+)</div>
                        <div className="text-5xl font-extrabold text-blue-500 mt-2">{distribution[3]}</div>
                    </div>
                    <div className="glass p-6 rounded-2xl shadow-sm border border-red-100 bg-red-50/50 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-1.5 h-full bg-red-400"></div>
                        {/* תיקון הטקסט כאן */}
                        <div className="text-red-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">⚠️ זקוקים לתשומת לב מיוחדת</div>
                        <div className="text-5xl font-extrabold text-red-500 mt-2">{atRiskCount}</div>
                    </div>
                    <div className="glass p-6 rounded-2xl shadow-sm border border-white/60 bg-white/70 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="text-gray-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><IconStudent className="w-3 h-3" /> פעילות היום</div>
                        <div className="text-5xl font-extrabold text-purple-500 mt-2">
                            {students.filter(s => s.lastActive === new Date().toLocaleDateString('he-IL')).length}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: AI & Charts */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* AI Insights Card */}
                        <div className="glass bg-gradient-to-br from-indigo-50/80 to-white/90 p-8 rounded-3xl shadow-sm border border-indigo-100/50 relative overflow-hidden backdrop-blur-xl">
                            <div className="absolute top-0 right-0 p-6 opacity-10"><IconBrain className="w-32 h-32 text-indigo-600" /></div>
                            <h3 className="text-xl font-bold text-indigo-900 mb-6 flex items-center gap-2 relative z-10">
                                <span className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><IconBrain className="w-5 h-5" /></span>
                                תובנות פדגוגיות (AI Analysis)
                            </h3>

                            {aiInsight ? (
                                <div className="space-y-6 relative z-10">
                                    <div className="bg-white/60 p-5 rounded-2xl border border-white/50 shadow-sm backdrop-blur-sm">
                                        <h4 className="font-bold text-sm text-indigo-600 mb-2">סקירה כללית</h4>
                                        <p className="text-sm leading-relaxed text-gray-700">{aiInsight.classOverview}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-green-50/60 p-5 rounded-2xl border border-green-100/50">
                                            <h4 className="font-bold text-sm text-green-700 mb-3 flex items-center gap-2"><IconCheck className="w-4 h-4" /> נקודות חוזק</h4>
                                            <ul className="space-y-2">
                                                {aiInsight.strongSkills?.map((s: string, i: number) => (
                                                    <li key={i} className="text-xs text-green-800 flex items-start gap-2">
                                                        <span className="mt-1 w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0"></span> {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="bg-red-50/60 p-5 rounded-2xl border border-red-100/50">
                                            <h4 className="font-bold text-sm text-red-700 mb-3 flex items-center gap-2"><IconX className="w-4 h-4" /> נקודות לחיזוק</h4>
                                            <ul className="space-y-2">
                                                {aiInsight.weakSkills?.map((s: string, i: number) => (
                                                    <li key={i} className="text-xs text-red-800 flex items-start gap-2">
                                                        <span className="mt-1 w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0"></span> {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50/60 p-5 rounded-2xl border border-yellow-100/50">
                                        <h4 className="font-bold text-sm text-yellow-800 mb-3 flex items-center gap-2"><IconSparkles className="w-4 h-4" /> המלצות לפעולה</h4>
                                        <ul className="space-y-2">
                                            {aiInsight.actionItems?.map((s: string, i: number) => (
                                                <li key={i} className="text-xs text-yellow-900 flex items-start gap-2">
                                                    <span className="mt-1 w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0"></span> {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center relative z-10">
                                    {students.length < 3 ? (
                                        <div className="text-sm">דרושים לפחות 3 תלמידים כדי להפיק דוח תובנות.</div>
                                    ) : aiLoading ? (
                                        <>
                                            <div className="animate-spin text-3xl mb-3 border-2 border-indigo-600 border-t-transparent rounded-full w-8 h-8"></div>
                                            <div className="text-sm font-medium text-indigo-600">הבינה המלאכותית מנתחת את הנתונים...</div>
                                        </>
                                    ) : (
                                        <div className="text-sm">לא נמצאו תובנות עדיין.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Grade Distribution Chart */}
                        <div className="glass bg-white/80 p-8 rounded-3xl shadow-sm border border-white/60">
                            <h3 className="text-lg font-bold text-gray-800 mb-8 flex items-center gap-2"><IconChart className="w-5 h-5 text-gray-400" /> התפלגות ציונים</h3>
                            <div className="flex items-end justify-around h-64 gap-6 px-4 pb-2 border-b border-gray-100">
                                {distribution.map((count, i) => {
                                    const height = students.length > 0 ? Math.max((count / students.length) * 100, 5) : 0;
                                    const colors = [
                                        'bg-red-100 border-red-200 text-red-600',    // Fail
                                        'bg-yellow-100 border-yellow-200 text-yellow-600', // Pass
                                        'bg-blue-100 border-blue-200 text-blue-600',    // Good
                                        'bg-green-100 border-green-200 text-green-600'  // Excellent
                                    ];
                                    const labels = ['0-55', '56-75', '76-90', '91-100'];

                                    return (
                                        <div key={i} className="flex flex-col items-center w-full group relative h-full justify-end">
                                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg mb-2 z-20 whitespace-nowrap">
                                                {count} תלמידים ({students.length > 0 ? Math.round((count / students.length) * 100) : 0}%)
                                            </div>
                                            <div
                                                className={`w-full max-w-[60px] rounded-t-xl border transition-all duration-700 ease-out ${colors[i]} relative flex items-center justify-center hover:opacity-80`}
                                                style={{ height: `${height}%` }}
                                            >
                                                <span className="font-bold text-xl">{count > 0 ? count : ''}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-4 font-bold text-center w-full">
                                                {labels[i]}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Student List */}
                    <div className="glass bg-white/80 rounded-3xl shadow-sm border border-white/60 overflow-hidden flex flex-col h-[900px]">
                        <div className="p-6 border-b border-gray-100 bg-white/50 backdrop-blur font-bold text-gray-700 flex justify-between items-center sticky top-0 z-20">
                            <span className="flex items-center gap-2"><IconList className="w-4 h-4" /> רשימת תלמידים</span>
                            <span className="bg-indigo-100 px-3 py-1 rounded-full text-xs text-indigo-700 font-bold border border-indigo-200">{students.length}</span>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar p-2">
                            {students.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 flex flex-col items-center gap-2">
                                    <IconStudent className="w-12 h-12 opacity-20" />
                                    <span>אין תלמידים רשומים עדיין</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {students.map(student => (
                                        <div key={student.id} className="bg-white p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-gray-800">{student.name}</div>
                                                <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                                    <span className={`w-2 h-2 rounded-full ${student.lastActive === new Date().toLocaleDateString('he-IL') ? 'bg-green-400' : 'bg-gray-300'}`}></span>
                                                    פעיל: {student.lastActive}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className={`px-3 py-1 rounded-lg font-bold text-sm min-w-[3rem] text-center ${student.score < 60 ? 'bg-red-50 text-red-600 border border-red-100' :
                                                        student.score > 90 ? 'bg-green-50 text-green-600 border border-green-100' :
                                                            'bg-gray-50 text-gray-600 border border-gray-200'
                                                    }`}>
                                                    {student.score}
                                                </div>
                                                <button
                                                    onClick={() => handleGenerateStudentReport(student)}
                                                    disabled={analyzingStudentId === student.id}
                                                    className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors"
                                                    title="הפקת דוח אישי"
                                                >
                                                    {analyzingStudentId === student.id ? <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div> : <IconEdit className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Student Report Modal */}
                {selectedStudentReport && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in border border-gray-200">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 backdrop-blur sticky top-0 z-10">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><IconStudent className="w-5 h-5 text-indigo-500" /> דוח הערכה אישי</h3>
                                    <p className="text-sm text-indigo-600 font-bold mt-0.5">{selectedStudentReport.studentName}</p>
                                </div>
                                <button onClick={() => setSelectedStudentReport(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><IconX className="w-5 h-5 text-gray-500" /></button>
                            </div>

                            <div className="p-8 space-y-8">
                                <div className="bg-blue-50/60 p-6 rounded-2xl border border-blue-100 text-blue-900 leading-relaxed shadow-sm">
                                    <h4 className="font-bold text-xs text-blue-400 uppercase tracking-wider mb-2">סיכום ביצועים</h4>
                                    {selectedStudentReport.summary}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-sm"><IconCheck className="w-4 h-4 text-green-500" /> ידע ושליטה</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">{selectedStudentReport.criteria?.knowledge}</p>
                                    </div>
                                    <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-sm"><IconBrain className="w-4 h-4 text-purple-500" /> עומק והבנה</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">{selectedStudentReport.criteria?.depth}</p>
                                    </div>
                                    <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2 text-sm"><IconEdit className="w-4 h-4 text-blue-500" /> יכולת הבעה</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">{selectedStudentReport.criteria?.expression}</p>
                                    </div>
                                    <div className="p-5 bg-yellow-50/50 rounded-2xl border border-yellow-100">
                                        <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2 text-sm"><IconSparkles className="w-4 h-4 text-yellow-600" /> המלצות להמשך</h4>
                                        <p className="text-sm text-yellow-900 leading-relaxed">{selectedStudentReport.criteria?.recommendations}</p>
                                    </div>
                                </div>

                                <div className="text-center pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => window.print()}
                                        className="text-white bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-full font-bold transition-all shadow-lg hover:shadow-indigo-200 flex items-center justify-center gap-2 mx-auto"
                                    >
                                        הדפס דוח
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default TeacherDashboard;