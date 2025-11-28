import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateClassAnalysis, generateStudentReport } from '../gemini';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const TeacherDashboard: React.FC = () => {
    const { course } = useCourseStore();

    // מצבי טעינה ונתונים
    const [studentsData, setStudentsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // ניתוח כיתתי
    const [isAnalyzingClass, setIsAnalyzingClass] = useState(false);
    const [classAnalysis, setClassAnalysis] = useState<any>(null);

    // ניתוח אישי (תעודה)
    const [analyzingStudentId, setAnalyzingStudentId] = useState<string | null>(null);
    const [selectedStudentReport, setSelectedStudentReport] = useState<any>(null);

    useEffect(() => {
        if (!course.id) return;

        const q = query(collection(db, "student_progress"), where("courseId", "==", course.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const realData = snapshot.docs.map(doc => {
                const data = doc.data();
                let totalScore = 0;
                let count = 0;
                if (data.grading) {
                    Object.values(data.grading).forEach((g: any) => {
                        if (g.grade) { totalScore += g.grade; count++; }
                    });
                }
                return {
                    id: doc.id,
                    ...data, // כולל attempts, answers, grading
                    name: data.studentEmail || "אנונימי",
                    score: count > 0 ? Math.round(totalScore / count) : 0,
                    lastActive: data.lastActive ? new Date(data.lastActive).toLocaleTimeString('he-IL') : '-'
                };
            });
            setStudentsData(realData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [course.id]);

    const handleAnalyzeClass = async () => {
        if (studentsData.length === 0) return alert("אין נתונים");
        setIsAnalyzingClass(true);
        try {
            const result = await generateClassAnalysis(studentsData);
            setClassAnalysis(result);
        } catch (e) { alert("שגיאה"); } finally { setIsAnalyzingClass(false); }
    };

    const handleGenerateStudentReport = async (student: any) => {
        setAnalyzingStudentId(student.id);
        try {
            const report = await generateStudentReport(student);
            setSelectedStudentReport(report);
        } catch (e) { alert("שגיאה ביצירת דוח"); } finally { setAnalyzingStudentId(null); }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans pb-20">
            <div className="max-w-6xl mx-auto">

                {/* כותרת וכפתורי פעולה */}
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">דשבורד מורה 📊</h1>
                        <p className="text-gray-500 mt-1">קורס: <span className="font-bold text-indigo-600">{course.title}</span></p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border text-center w-32">
                            <div className="text-2xl font-bold text-blue-600">{studentsData.length}</div>
                            <div className="text-xs text-gray-400">תלמידים</div>
                        </div>
                        <button onClick={handleAnalyzeClass} disabled={isAnalyzingClass || studentsData.length === 0} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:-translate-y-1 transition-all">
                            {isAnalyzingClass ? 'מנתח...' : '🤖 ניתוח כיתתי'}
                        </button>
                    </div>
                </div>

                {/* תוצאות ניתוח כיתתי */}
                {classAnalysis && (
                    <div className="mb-10 animate-fade-in bg-white p-8 rounded-2xl shadow-md border-t-4 border-indigo-500">
                        <h2 className="text-2xl font-bold text-indigo-900 mb-4">🧠 תובנות רוחב (כיתתי)</h2>
                        <div className="bg-indigo-50 p-4 rounded-lg text-indigo-800 mb-6">{classAnalysis.classOverview}</div>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-gray-700 mb-2">מגמות:</h3>
                                <div className="space-y-2">
                                    {classAnalysis.strongSkills?.map((s: string, i: number) => <div key={i} className="text-sm text-green-700 bg-green-50 px-2 py-1 rounded">✅ {s}</div>)}
                                    {classAnalysis.weakSkills?.map((s: string, i: number) => <div key={i} className="text-sm text-red-700 bg-red-50 px-2 py-1 rounded">⚠️ {s}</div>)}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-700 mb-2">המלצות:</h3>
                                <ul className="list-disc list-inside text-sm text-gray-600">{classAnalysis.actionItems?.map((item: string, i: number) => <li key={i}>{item}</li>)}</ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* טבלת תלמידים */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 font-bold text-gray-500">נתוני תלמידים</div>
                    <table className="w-full text-right">
                        <thead className="bg-white border-b text-sm text-gray-400">
                            <tr>
                                <th className="px-6 py-3">שם</th>
                                <th className="px-6 py-3">ציון מחושב</th>
                                <th className="px-6 py-3">נראה לאחרונה</th>
                                <th className="px-6 py-3">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {studentsData.map((student) => (
                                <tr key={student.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-bold text-gray-800">{student.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${student.score > 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{student.score}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{student.lastActive}</td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleGenerateStudentReport(student)}
                                            disabled={analyzingStudentId === student.id}
                                            className="text-indigo-600 hover:text-indigo-800 font-bold text-sm bg-indigo-50 px-3 py-1 rounded border border-indigo-100"
                                        >
                                            {analyzingStudentId === student.id ? 'מייצר...' : '📝 הערכה אישית'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Modal - דוח אישי לתלמיד */}
                {selectedStudentReport && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                                <h3 className="text-2xl font-bold text-gray-800">הערכה מסכמת: <span className="text-indigo-600">{selectedStudentReport.studentName || "תלמיד"}</span></h3>
                                <button onClick={() => setSelectedStudentReport(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-900 text-lg leading-relaxed">
                                    {selectedStudentReport.summary}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-4 bg-gray-50 rounded-xl border">
                                        <h4 className="font-bold text-gray-700 mb-2">🎯 שליטה בידע</h4>
                                        <p className="text-sm text-gray-600">{selectedStudentReport.criteria?.knowledge}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl border">
                                        <h4 className="font-bold text-gray-700 mb-2">🧠 עומק ויישום</h4>
                                        <p className="text-sm text-gray-600">{selectedStudentReport.criteria?.depth}</p>
                                    </div>
                                    <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                                        <h4 className="font-bold text-yellow-800 mb-2">🔄 דפוסי למידה (Agility)</h4>
                                        <p className="text-sm text-yellow-900">{selectedStudentReport.criteria?.agility}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-xl border">
                                        <h4 className="font-bold text-gray-700 mb-2">✍️ יכולת הבעה</h4>
                                        <p className="text-sm text-gray-600">{selectedStudentReport.criteria?.expression}</p>
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