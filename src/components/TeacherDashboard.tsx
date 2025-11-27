import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateClassAnalysis } from '../gemini';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const TeacherDashboard: React.FC = () => {
    const { course } = useCourseStore();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [studentsData, setStudentsData] = useState<any[]>([]); // נתונים אמיתיים מהענן
    const [loading, setLoading] = useState(true);

    // האזנה לנתונים מ-Firebase בזמן אמת
    useEffect(() => {
        if (!course.id) return;

        const q = query(
            collection(db, "student_progress"),
            where("courseId", "==", course.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const realData = snapshot.docs.map(doc => {
                const data = doc.data();

                // חישוב ציון ממוצע לתלמיד על בסיס כל השאלות שבדק ה-AI
                let totalScore = 0;
                let count = 0;
                if (data.grading) {
                    Object.values(data.grading).forEach((g: any) => {
                        if (g.grade) {
                            totalScore += g.grade;
                            count++;
                        }
                    });
                }

                return {
                    id: doc.id,
                    name: data.studentEmail || "אנונימי", // כרגע אנחנו יודעים רק מייל
                    score: count > 0 ? Math.round(totalScore / count) : 0,
                    answers: JSON.stringify(data.answers), // לצורך הניתוח של ה-AI
                    lastActive: data.lastActive ? new Date(data.lastActive).toLocaleTimeString('he-IL') : '-'
                };
            });

            setStudentsData(realData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [course.id]);

    const handleAnalyzeClass = async () => {
        if (studentsData.length === 0) return alert("אין עדיין נתונים לנתח");
        setIsAnalyzing(true);
        try {
            const result = await generateClassAnalysis(studentsData);
            setAnalysisResult(result);
        } catch (e) {
            alert("שגיאה בניתוח הנתונים");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans pb-20">
            <div className="max-w-6xl mx-auto">

                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">לוח בקרה למורה 📊</h1>
                        <p className="text-gray-500 mt-1">קורס: <span className="font-bold text-indigo-600">{course.title}</span></p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border text-center w-32">
                            <div className="text-2xl font-bold text-blue-600">{studentsData.length}</div>
                            <div className="text-xs text-gray-400">תלמידים פעילים</div>
                        </div>
                        <button
                            onClick={handleAnalyzeClass}
                            disabled={isAnalyzing || studentsData.length === 0}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all flex items-center gap-2"
                        >
                            {isAnalyzing ? 'ה-AI מנתח נתונים...' : '🤖 בצע ניתוח פדגוגי עמוק'}
                        </button>
                    </div>
                </div>

                {analysisResult && (
                    <div className="mb-10 animate-fade-in">
                        <div className="bg-white p-8 rounded-2xl shadow-md border-t-4 border-indigo-500">
                            <h2 className="text-2xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                🧠 תובנות המערכת (AI Insights)
                            </h2>
                            <div className="bg-indigo-50 p-4 rounded-lg text-indigo-800 mb-6 text-lg leading-relaxed">
                                {analysisResult.classOverview}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="font-bold text-gray-700 mb-3">מיומנויות ומגמות:</h3>
                                    <div className="flex flex-col gap-4">
                                        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                            <span className="font-bold text-green-700 block mb-1">✅ חוזקות כיתתיות:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {analysisResult.strongSkills?.map((s: string, i: number) => (
                                                    <span key={i} className="bg-white px-2 py-1 rounded text-sm text-green-800 border border-green-200">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                                            <span className="font-bold text-red-700 block mb-1">⚠️ קשיים מזוהים:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {analysisResult.weakSkills?.map((s: string, i: number) => (
                                                    <span key={i} className="bg-white px-2 py-1 rounded text-sm text-red-800 border border-red-200">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-700 mb-3">המלצות למורה:</h3>
                                    <ul className="space-y-2">
                                        {analysisResult.actionItems?.map((item: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg">
                                                <span className="bg-indigo-200 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                                                <span className="text-gray-700">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 font-bold text-gray-500 flex justify-between">
                        <span>נתוני אמת (מהענן)</span>
                        {loading && <span className="text-xs text-blue-500">מתעדכן...</span>}
                    </div>
                    <table className="w-full text-right">
                        <thead className="bg-white border-b text-sm text-gray-400">
                            <tr>
                                <th className="px-6 py-3">שם (מייל)</th>
                                <th className="px-6 py-3">ציון ממוצע</th>
                                <th className="px-6 py-3">נראה לאחרונה</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {studentsData.length === 0 ? (
                                <tr><td colSpan={3} className="p-10 text-center text-gray-400">עדיין אין תלמידים פעילים בקורס זה</td></tr>
                            ) : (
                                studentsData.map((student) => (
                                    <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-gray-800">{student.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${student.score > 80 ? 'bg-green-100 text-green-700' : student.score > 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {student.score}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {student.lastActive}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
};

export default TeacherDashboard;