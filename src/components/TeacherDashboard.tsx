import React, { useState } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { generateClassAnalysis } from '../gemini';

const TeacherDashboard: React.FC = () => {
    const { course } = useCourseStore();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);

    // נתוני דמה לניתוח (מדמה מצב שבו תלמידים ענו על שאלות)
    const mockStudentsData = [
        { id: 1, name: "דניאל כהן", score: 85, answers: "ענה נכון על שאלות הידע, אך טעה בשאלת היישום המורכבת." },
        { id: 2, name: "מיכל לוי", score: 92, answers: "תשובות מלאות, מנומקות היטב, מפגינה חשיבה ביקורתית." },
        { id: 3, name: "יוסי ישראלי", score: 45, answers: "תשובות קצרות מדי, חוסר הבנה של מושגי היסוד." },
        { id: 4, name: "נועה שחר", score: 65, answers: "הבינה את הרעיון הכללי אך התקשתה בניסוח התשובה." },
        { id: 5, name: "אביב גולן", score: 88, answers: "שליטה מצוינת בחומר." },
    ];

    const handleAnalyzeClass = async () => {
        setIsAnalyzing(true);
        try {
            const result = await generateClassAnalysis(mockStudentsData);
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

                    <button
                        onClick={handleAnalyzeClass}
                        disabled={isAnalyzing}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all flex items-center gap-2"
                    >
                        {isAnalyzing ? 'ה-AI מנתח נתונים...' : '🤖 בצע ניתוח פדגוגי עמוק'}
                    </button>
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
                    <div className="p-4 border-b bg-gray-50 font-bold text-gray-500">נתוני גלם (ציונים)</div>
                    <table className="w-full text-right">
                        <thead className="bg-white border-b text-sm text-gray-400">
                            <tr>
                                <th className="px-6 py-3">שם</th>
                                <th className="px-6 py-3">ציון</th>
                                <th className="px-6 py-3">ניתוח אישי (AI)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {mockStudentsData.map((student) => {
                                const studentInsight = analysisResult?.studentInsights?.find((s: any) => s.name === student.name)?.insight;
                                return (
                                    <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-gray-800">{student.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${student.score > 80 ? 'bg-green-100 text-green-700' : student.score > 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {student.score}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {studentInsight || student.answers}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
};

export default TeacherDashboard;