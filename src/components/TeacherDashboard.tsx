import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateClassAnalysis, generateStudentReport } from '../gemini';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
                // אם יש ציון סופי שמור, השתמש בו. אחרת חשב ממוצע.
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

            // הפעלת ניתוח AI אוטומטי אם יש נתונים ועדיין אין תובנות
            if (rawData.length > 0 && !aiInsight) {
                try {
                    const insight = await generateClassAnalysis(rawData);
                    setAiInsight(insight);
                } catch (e) {
                    console.error("Failed to generate class analysis", e);
                }
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [course.id]);

    const calculateStats = (data: StudentStat[]) => {
        if (data.length === 0) return;

        // חישוב ממוצע
        const sum = data.reduce((acc, curr) => acc + curr.score, 0);
        setAverageScore(Math.round(sum / data.length));

        // חישוב תלמידים בסיכון (מתחת ל-60)
        const risk = data.filter(s => s.score < 60).length;
        setAtRiskCount(risk);

        // חישוב התפלגות ציונים לגרף
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

    // פונקציית ייצוא לאקסל (CSV)
    const exportToCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        // כותרות (BOM לעברית תקינה באקסל)
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

    if (loading) return <div className="p-10 text-center text-gray-500 font-bold">טוען נתוני כיתה בזמן אמת... ⏳</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans pb-20">
            <div className="max-w-7xl mx-auto">

                {/* כותרת וכפתור ייצוא */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">דשבורד פדגוגי 📊</h1>
                        <p className="text-gray-500 mt-1">מערך שיעור: <span className="font-bold text-indigo-600">{course.title}</span></p>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 border border-indigo-200 shadow-sm"
                    >
                        <span>📥</span> ייצוא לאקסל
                    </button>
                </div>

                {/* KPI Cards - מדדים עיקריים */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-wide">ממוצע כיתתי</div>
                        <div className={`text-4xl font-extrabold ${averageScore > 80 ? 'text-green-600' : averageScore > 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {averageScore}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-wide">מצטיינים (90+)</div>
                        <div className="text-4xl font-extrabold text-blue-600">{distribution[3]}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-2 h-full bg-red-500"></div>
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-wide">טעוני טיפוח</div>
                        <div className="text-4xl font-extrabold text-red-600">{atRiskCount}</div>
                        <div className="text-xs text-red-400 mt-2 font-bold">דורש התייחסות מיידית</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="text-gray-400 text-sm font-bold uppercase tracking-wide">פעילות היום</div>
                        <div className="text-4xl font-extrabold text-purple-600">
                            {students.filter(s => s.lastActive === new Date().toLocaleDateString('he-IL')).length}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* עמודה ימנית: תובנות AI וגרפים */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* כרטיס תובנות AI */}
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
                            <div className="absolute top-4 left-4 text-3xl opacity-20">🤖</div>
                            <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                <span>🧠</span> תובנות פדגוגיות (AI Analysis)
                            </h3>

                            {aiInsight ? (
                                <div className="space-y-4 text-gray-700">
                                    <div className="bg-white/80 p-4 rounded-xl border border-indigo-50 shadow-sm">
                                        <h4 className="font-bold text-sm text-indigo-600 mb-1">סקירה כללית</h4>
                                        <p className="text-sm leading-relaxed">{aiInsight.classOverview}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                            <h4 className="font-bold text-sm text-green-700 mb-2">✅ נקודות חוזק</h4>
                                            <ul className="list-disc list-inside text-xs text-green-800 space-y-1">
                                                {aiInsight.strongSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                            <h4 className="font-bold text-sm text-red-700 mb-2">⚠️ נקודות לחיזוק</h4>
                                            <ul className="list-disc list-inside text-xs text-red-800 space-y-1">
                                                {aiInsight.weakSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                    {/* המלצות פעולה */}
                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                        <h4 className="font-bold text-sm text-yellow-800 mb-2">💡 המלצות לפעולה</h4>
                                        <ul className="list-disc list-inside text-xs text-yellow-900 space-y-1">
                                            {aiInsight.actionItems?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center">
                                    <div className="animate-spin text-3xl mb-3">⏳</div>
                                    <div className="text-sm font-medium">הבינה המלאכותית מנתחת את נתוני הכיתה...</div>
                                </div>
                            )}
                        </div>

                        {/* גרף התפלגות ציונים (ויזואלי) */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-6">התפלגות ציונים בכיתה</h3>
                            <div className="flex items-end justify-around h-48 gap-4 px-4 pb-2 border-b border-gray-50">
                                {distribution.map((count, i) => {
                                    // חישוב גובה העמודה באחוזים (מינימום 10% כדי שיראו משהו)
                                    const height = students.length > 0 ? Math.max((count / students.length) * 100, 10) : 0;
                                    const colors = [
                                        'bg-red-100 border-red-200 text-red-600',    // נכשל
                                        'bg-yellow-100 border-yellow-200 text-yellow-600', // עובר
                                        'bg-blue-100 border-blue-200 text-blue-600',    // טוב
                                        'bg-green-100 border-green-200 text-green-600'  // מצוין
                                    ];
                                    const labels = ['0-55', '56-75', '76-90', '91-100'];

                                    return (
                                        <div key={i} className="flex flex-col items-center w-full group relative">
                                            {/* Tooltip עם המספר המדויק */}
                                            <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                {count} תלמידים
                                            </div>

                                            <div
                                                className={`w-full rounded-t-xl border-t border-x transition-all duration-500 ${colors[i]} relative flex items-end justify-center pb-2`}
                                                style={{ height: `${height}%` }}
                                            >
                                                <span className="font-bold text-xl">{count}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-3 font-bold text-center w-full border-t pt-2">
                                                {labels[i]}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* עמודה שמאלית: רשימת תלמידים ופעולות */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[800px]">
                        <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between items-center sticky top-0 z-20">
                            <span>רשימת תלמידים</span>
                            <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs text-gray-600 font-bold">{students.length}</span>
                        </div>

                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            {students.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">אין תלמידים עדיין</div>
                            ) : (
                                <table className="w-full text-right text-sm border-collapse">
                                    <thead className="bg-white text-gray-400 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 font-normal bg-white">שם</th>
                                            <th className="px-4 py-3 font-normal bg-white text-center">ציון</th>
                                            <th className="px-4 py-3 font-normal bg-white text-center">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {students.map(student => (
                                            <tr key={student.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-800">{student.name}</div>
                                                    <div className="text-[10px] text-gray-400 mt-0.5">פעיל: {student.lastActive}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block min-w-[2.5rem] py-1 rounded-md text-center font-bold text-xs
                                                        ${student.score < 60 ? 'bg-red-100 text-red-700' :
                                                            student.score > 90 ? 'bg-green-100 text-green-700' :
                                                                'bg-gray-100 text-gray-700'}
                                                    `}>
                                                        {student.score}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleGenerateStudentReport(student)}
                                                        disabled={analyzingStudentId === student.id}
                                                        className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-indigo-100 shadow-sm"
                                                    >
                                                        {analyzingStudentId === student.id ? '⏳' : '📝 דוח אישי'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                </div>

                {/* Modal לדוח אישי לתלמיד (קופץ במרכז) */}
                {selectedStudentReport && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in border border-gray-200">
                            {/* כותרת המודל */}
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl sticky top-0 z-10">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-800">הערכה אישית: <span className="text-indigo-600">{selectedStudentReport.studentName}</span></h3>
                                    <p className="text-xs text-gray-500 mt-1">נוצר באמצעות AI על סמך ביצועי התלמיד</p>
                                </div>
                                <button onClick={() => setSelectedStudentReport(null)} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">✕</button>
                            </div>

                            {/* תוכן הדוח */}
                            <div className="p-8 space-y-6">
                                {/* סיכום כללי */}
                                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 text-blue-900 text-lg leading-relaxed shadow-sm">
                                    {selectedStudentReport.summary}
                                </div>

                                {/* מדדים ספציפיים */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">🎯 שליטה בידע</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">{selectedStudentReport.criteria?.knowledge}</p>
                                    </div>
                                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">🧠 עומק והבנה</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">{selectedStudentReport.criteria?.depth}</p>
                                    </div>
                                    <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">✍️ יכולת הבעה</h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">{selectedStudentReport.criteria?.expression}</p>
                                    </div>
                                    <div className="p-5 bg-yellow-50 rounded-xl border border-yellow-200">
                                        <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">🚀 המלצות להמשך</h4>
                                        <p className="text-sm text-yellow-900 leading-relaxed">{selectedStudentReport.criteria?.recommendations}</p>
                                    </div>
                                </div>
                            </div>

                            {/* כפתורים תחתונים */}
                            <div className="p-4 border-t bg-gray-50 text-center rounded-b-2xl sticky bottom-0">
                                <button
                                    onClick={() => window.print()}
                                    className="text-indigo-600 hover:bg-indigo-50 px-6 py-2 rounded-full font-bold transition-colors border border-indigo-200 shadow-sm flex items-center justify-center gap-2 mx-auto"
                                >
                                    <span>🖨️</span> הדפס דוח
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default TeacherDashboard;