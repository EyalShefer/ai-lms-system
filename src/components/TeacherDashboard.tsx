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

    // סטטיסטיקות
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

        // האזנה לנתוני התלמידים בזמן אמת
        const q = query(collection(db, "student_progress"), where("courseId", "==", course.id));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const rawData = snapshot.docs.map(doc => {
                const data = doc.data();

                // חישוב ציון משוקלל
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
                    name: data.studentEmail?.split('@')[0] || "אנונימי",
                    score: finalScore,
                    progress: data.answers ? Object.keys(data.answers).length : 0,
                    lastActive: data.lastActive ? new Date(data.lastActive).toLocaleDateString('he-IL') : '-'
                };
            });

            setStudents(rawData);
            calculateStats(rawData);

            // הפעלת ניתוח AI אוטומטי אם יש נתונים וטרם בוצע ניתוח
            if (rawData.length > 0 && !aiInsight) {
                generateClassAnalysis(rawData).then(setAiInsight).catch(console.error);
            }

            setLoading(false);
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
            if (s.score < 56) dist[0]++;
            else if (s.score < 76) dist[1]++;
            else if (s.score < 91) dist[2]++;
            else dist[3]++;
        });
        setDistribution(dist);
    };

    const handleGenerateStudentReport = async (student: any) => {
        setAnalyzingStudentId(student.id);
        try {
            const report = await generateStudentReport(student);
            setSelectedStudentReport(report);
        } catch (e) {
            alert("שגיאה ביצירת דוח");
        } finally {
            setAnalyzingStudentId(null);
        }
    };

    const exportToCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,שם תלמיד,ציון,התקדמות,נראה לאחרונה\n";
        students.forEach(row => {
            csvContent += `${row.name},${row.score},${row.progress},${row.lastActive}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ציונים_${course.title}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    if (loading) return <div className="p-10 text-center text-gray-500">טוען נתוני כיתה בזמן אמת...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans pb-20">
            <div className="max-w-7xl mx-auto">

                {/* כותרת וכפתור ייצוא */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">דשבורד פדגוגי 📊</h1>
                        <p className="text-gray-500 mt-1">מערך שיעור: <span className="font-bold text-indigo-600">{course.title}</span></p>
                    </div>
                    <button onClick={exportToCSV} className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 border border-indigo-200">
                        <span>📥</span> ייצוא לאקסל
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="text-gray-400 text-sm font-bold">ממוצע כיתתי</div>
                        <div className={`text-4xl font-extrabold ${averageScore > 80 ? 'text-green-600' : averageScore > 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {averageScore}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="text-gray-400 text-sm font-bold">מצטיינים (90+)</div>
                        <div className="text-4xl font-extrabold text-blue-600">{distribution[3]}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-2 h-full bg-red-500"></div>
                        <div className="text-gray-400 text-sm font-bold">טעוני טיפוח</div>
                        <div className="text-4xl font-extrabold text-red-600">{atRiskCount}</div>
                        <div className="text-xs text-red-400 mt-2 font-bold">דורש התייחסות</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                        <div className="text-gray-400 text-sm font-bold">פעילות היום</div>
                        <div className="text-4xl font-extrabold text-purple-600">
                            {students.filter(s => s.lastActive === new Date().toLocaleDateString('he-IL')).length}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* עמודה ימנית: תובנות AI */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative">
                            <div className="absolute top-4 left-4 text-2xl">🤖</div>
                            <h3 className="text-lg font-bold text-indigo-900 mb-4">תובנות ה-AI (ניתוח אוטומטי)</h3>
                            {aiInsight ? (
                                <div className="space-y-4 text-gray-700">
                                    <div className="bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                                        <h4 className="font-bold text-sm text-indigo-600 mb-1">סקירה כללית</h4>
                                        <p className="text-sm leading-relaxed">{aiInsight.classOverview}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                                            <h4 className="font-bold text-sm text-green-700 mb-1">✅ נקודות חוזק</h4>
                                            <ul className="list-disc list-inside text-xs text-green-800">
                                                {aiInsight.strongSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                        <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                                            <h4 className="font-bold text-sm text-red-700 mb-1">⚠️ נקודות לחיזוק</h4>
                                            <ul className="list-disc list-inside text-xs text-red-800">
                                                {aiInsight.weakSkills?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <div className="animate-spin text-2xl mb-2">⏳</div>
                                    <div>מנתח נתונים...</div>
                                </div>
                            )}
                        </div>

                        {/* גרף התפלגות */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-6">התפלגות ציונים</h3>
                            <div className="flex items-end justify-around h-40 gap-4 px-4">
                                {distribution.map((count, i) => (
                                    <div key={i} className="flex flex-col items-center w-full group">
                                        <div className="text-xs font-bold mb-1 opacity-0 group-hover:opacity-100">{count}</div>
                                        <div
                                            className={`w-full rounded-t-lg transition-all hover:opacity-80 ${i === 0 ? 'bg-red-200' : i === 1 ? 'bg-yellow-200' : i === 2 ? 'bg-blue-200' : 'bg-green-200'}`}
                                            style={{ height: `${Math.max(count * 10, 5)}%` }}
                                        ></div>
                                        <div className="text-xs text-gray-500 mt-2 font-bold">
                                            {i === 0 ? '0-55' : i === 1 ? '56-75' : i === 2 ? '76-90' : '91+'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* עמודה שמאלית: טבלת תלמידים */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex justify-between">
                            <span>רשימת תלמידים</span>
                            <span className="bg-gray-200 px-2 rounded text-xs flex items-center">{students.length}</span>
                        </div>
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-white text-gray-400 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3 font-normal">שם</th>
                                        <th className="px-4 py-3 font-normal">ציון</th>
                                        <th className="px-4 py-3 font-normal">דוח</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {students.map(student => (
                                        <tr key={student.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-3 font-bold text-gray-800">
                                                {student.name}
                                                <div className="text-[10px] text-gray-400 font-normal">{student.lastActive}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-bold ${student.score < 60 ? 'text-red-600' : 'text-gray-800'}`}>{student.score}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleGenerateStudentReport(student)}
                                                    disabled={analyzingStudentId === student.id}
                                                    className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-100"
                                                >
                                                    {analyzingStudentId === student.id ? '...' : '📝 הערכה'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* Modal לדוח אישי */}
                {selectedStudentReport && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                                <h3 className="text-2xl font-bold text-gray-800">הערכה אישית: <span className="text-indigo-600">{selectedStudentReport.studentName}</span></h3>
                                <button onClick={() => setSelectedStudentReport(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-900 text-lg leading-relaxed">
                                    {selectedStudentReport.summary}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-4 bg-gray-50 rounded-xl border">
                                        <h4 className="font-bold text-gray-700 mb-2">🎯 ידע</h4>
                                        <p className="text-sm text-gray-600">{selectedStudentReport.criteria?.knowledge}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl border">
                                        <h4 className="font-bold text-gray-700 mb-2">🧠 עומק</h4>
                                        <p className="text-sm text-gray-600">{selectedStudentReport.criteria?.depth}</p>
                                    </div>
                                </div>

                                <div className="border-t pt-6">
                                    <h4 className="font-bold text-gray-800 mb-2">🚀 המלצות להמשך:</h4>
                                    <p className="text-gray-600">{selectedStudentReport.criteria?.recommendations}</p>
                                </div>
                            </div>
                            <div className="p-4 border-t bg-gray-50 text-center rounded-b-2xl">
                                <button onClick={() => window.print()} className="text-indigo-600 hover:underline text-sm font-bold">הדפס דוח 🖨️</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default TeacherDashboard;