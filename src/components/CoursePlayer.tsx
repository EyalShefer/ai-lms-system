import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import AiTutor from './AiTutor';
import { gradeStudentAnswer } from '../gemini';
import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const CoursePlayer: React.FC = () => {
    const { course, pdfSource } = useCourseStore();
    const { currentUser } = useAuth();

    const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
    const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
    const [showPdf, setShowPdf] = useState(false);
    const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

    const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<Record<string, string>>({});
    const [aiGrading, setAiGrading] = useState<Record<string, { grade: number, feedback: string }>>({});
    const [isGrading, setIsGrading] = useState<Record<string, boolean>>({});

    // --- התיקון: טעינה בטוחה שלא מפילה את האתר ---
    useEffect(() => {
        const loadProgress = async () => {
            // אם אין משתמש או קורס, או שאנחנו במצב פיתוח ללא רשת - לא עושים כלום
            if (!currentUser || !course.id) return;

            try {
                const progressId = `${course.id}_${currentUser.uid}`;
                const docRef = doc(db, "student_progress", progressId);

                // מנסים לקרוא. אם נכשל (בגלל רשת/חסימה) - עוברים ל-catch
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.answers) setStudentAnswers(data.answers);
                    if (data.grading) setAiGrading(data.grading);
                }
            } catch (error) {
                console.warn("⚠️ לא ניתן לטעון היסטוריית תלמיד (ייתכן חוסם פרסומות או בעיית רשת):", error);
                // אנחנו לא זורקים שגיאה למשתמש, אלא נותנים לו להמשיך "נקי"
            }
        };
        loadProgress();
    }, [currentUser, course.id]);

    const saveProgressToCloud = async (newAnswers: any, newGrading: any) => {
        if (!currentUser || !course.id) return;
        try {
            const progressId = `${course.id}_${currentUser.uid}`;
            await setDoc(doc(db, "student_progress", progressId), {
                studentId: currentUser.uid,
                studentEmail: currentUser.email,
                courseId: course.id,
                answers: newAnswers,
                grading: newGrading,
                lastActive: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error("Failed to save progress (offline?)", e);
        }
    };

    useEffect(() => {
        if (pdfSource && pdfSource.startsWith('data:application/pdf;base64,')) {
            try {
                const byteCharacters = atob(pdfSource.split(',')[1]);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                setPdfObjectUrl(url);
            } catch (e) {
                console.error("Failed to convert PDF", e);
            }
        } else if (pdfSource) {
            setPdfObjectUrl(pdfSource);
        }
    }, [pdfSource]);

    if (!course || !course.syllabus || course.syllabus.length === 0) {
        return <div className="text-center p-10 text-gray-500">הקורס ריק עדיין... עבור לעורך וצור תוכן.</div>;
    }

    const currentModule = course.syllabus[currentModuleIndex];
    const currentUnit = currentModule?.learningUnits[currentUnitIndex];

    if (!currentUnit) return <div className="text-center p-10">לא נמצא תוכן</div>;

    const getYoutubeId = (url: string) => {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const checkAnswer = (blockId: string, selectedOption: string, correctAnswer: string) => {
        const newAnswers = { ...studentAnswers, [blockId]: selectedOption };
        setStudentAnswers(newAnswers);
        saveProgressToCloud(newAnswers, aiGrading);

        const isCorrect = correctAnswer ? selectedOption === correctAnswer : true;
        if (isCorrect) setFeedback({ ...feedback, [blockId]: 'correct' });
        else setFeedback({ ...feedback, [blockId]: 'incorrect' });
    };

    const handleGradeOpenQuestion = async (blockId: string, question: string, modelAnswer: string) => {
        const answer = studentAnswers[blockId];
        if (!answer || answer.length < 5) return alert("אנא כתוב תשובה מלאה");

        setIsGrading({ ...isGrading, [blockId]: true });
        try {
            const result = await gradeStudentAnswer(question, answer, modelAnswer);
            const newGrading = { ...aiGrading, [blockId]: result };
            setAiGrading(newGrading);
            saveProgressToCloud(studentAnswers, newGrading);
        } catch (e) {
            alert("שגיאה בבדיקה");
        } finally {
            setIsGrading({ ...isGrading, [blockId]: false });
        }
    };

    const handleTextChange = (blockId: string, text: string) => {
        const newAnswers = { ...studentAnswers, [blockId]: text };
        setStudentAnswers(newAnswers);
    };

    const getSafeOptions = (content: any) => {
        if (content.options && Array.isArray(content.options) && content.options.length > 0) {
            return content.options;
        }
        return ["אפשרות 1", "אפשרות 2", "אפשרות 3", "אפשרות 4"];
    };

    return (
        <div className="flex h-[85vh] bg-gray-100 overflow-hidden rounded-2xl shadow-2xl border border-gray-200 relative">
            <aside className="w-64 bg-white border-l border-gray-200 flex flex-col shadow-lg z-10 shrink-0">
                <div className="p-4 bg-indigo-700 text-white shrink-0">
                    <h2 className="text-sm font-bold leading-tight">{course.title}</h2>
                </div>
                <div className="overflow-y-auto flex-1 py-2 custom-scrollbar">
                    {course.syllabus.map((mod, mIdx) => (
                        <div key={mod.id} className="mb-2">
                            <div className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                                {mod.title}
                            </div>
                            {mod.learningUnits.map((unit, uIdx) => {
                                const isActive = mIdx === currentModuleIndex && uIdx === currentUnitIndex;
                                return (
                                    <div
                                        key={unit.id}
                                        onClick={() => { setCurrentModuleIndex(mIdx); setCurrentUnitIndex(uIdx); }}
                                        className={`px-4 py-2 cursor-pointer flex items-center gap-2 border-b border-gray-50 ${isActive ? 'bg-indigo-50 text-indigo-700 border-r-4 border-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                                    >
                                        <span className="text-base">{unit.type === 'acquisition' ? '📖' : unit.type === 'practice' ? '✍️' : '🧠'}</span>
                                        <span className="text-xs truncate">{unit.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
                {pdfObjectUrl && (
                    <div className="p-3 border-t bg-gray-50 text-center shrink-0">
                        <button onClick={() => setShowPdf(!showPdf)} className={`w-full py-2 rounded font-bold text-xs flex items-center justify-center gap-2 transition-colors ${showPdf ? 'bg-red-100 text-red-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                            {showPdf ? '📕 סגור ספר' : '📖 פתח ספר מקור'}
                        </button>
                    </div>
                )}
            </aside>

            <main className={`flex-1 bg-gray-50 overflow-y-auto p-6 transition-all duration-300 ${showPdf ? 'w-1/2 border-l border-gray-300' : 'w-full'}`}>
                <div className="max-w-3xl mx-auto bg-white shadow-sm border border-gray-200 rounded-xl p-8 mb-20">
                    <header className="mb-8 border-b pb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentUnit.type === 'acquisition' ? 'bg-blue-100 text-blue-700' : currentUnit.type === 'practice' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>
                                {currentUnit.type === 'acquisition' ? 'למידה' : currentUnit.type === 'practice' ? 'תרגול' : 'מבחן'}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">{currentUnit.title}</h1>
                    </header>

                    {currentUnit.baseContent && <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed mb-10 whitespace-pre-line">{currentUnit.baseContent}</div>}

                    <div className="space-y-10">
                        {currentUnit.activityBlocks?.map((block) => (
                            <div key={block.id} className="animate-fade-in">
                                {block.type === 'text' && <div className="prose max-w-none text-gray-700 bg-gray-50 p-6 rounded-lg border-r-4 border-indigo-200 whitespace-pre-line shadow-sm">{block.content}</div>}

                                {block.type === 'image' && (
                                    <figure className="my-6">
                                        {block.content ? (
                                            <img src={block.content} alt="Visual" className="w-full rounded-xl shadow-md max-h-[500px] object-cover border border-gray-200 bg-gray-100" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                        ) : (<div className="w-full h-40 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 border-2 border-dashed">ממתין לתמונה...</div>)}
                                        {block.metadata?.aiPrompt && <figcaption className="text-xs text-gray-400 mt-2 text-center italic">AI Generated: {block.metadata.aiPrompt.substring(0, 50)}...</figcaption>}
                                    </figure>
                                )}

                                {block.type === 'video' && getYoutubeId(block.content) && (
                                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg my-6 bg-black">
                                        <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${getYoutubeId(block.content)}`} title="Video" frameBorder="0" allowFullScreen></iframe>
                                    </div>
                                )}

                                {block.type === 'gem-link' && (
                                    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-8 rounded-xl text-white shadow-xl transform hover:scale-[1.01] transition-transform my-6">
                                        <div className="flex items-start gap-5">
                                            <div className="text-5xl bg-white/20 p-3 rounded-full backdrop-blur-sm">💎</div>
                                            <div>
                                                <h3 className="font-bold text-2xl mb-2">{block.content.title || 'משימת דיאלוג'}</h3>
                                                <p className="text-purple-100 text-base mb-6 leading-relaxed">{block.content.instructions}</p>
                                                <a href={block.content.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white text-purple-700 px-6 py-3 rounded-full font-bold hover:bg-purple-50 transition-colors shadow-md"><span>פתח את הצ'אט</span><span>↗</span></a>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {block.type === 'multiple-choice' && (
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                        <h4 className="font-bold text-lg text-gray-800 mb-4 flex gap-3 items-start">
                                            <span className="bg-indigo-100 text-indigo-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0">?</span>
                                            {typeof block.content === 'object' ? block.content.question : block.content}
                                        </h4>
                                        <div className="space-y-3 mr-11">
                                            {getSafeOptions(block.content).map((opt: string, i: number) => {
                                                const isSelected = studentAnswers[block.id] === opt;
                                                const isCorrect = block.content.correctAnswer === opt;
                                                const showFeedback = !!feedback[block.id];
                                                let btnClass = "w-full text-right p-4 rounded-lg border transition-all flex justify-between items-center ";
                                                if (showFeedback) {
                                                    if (isCorrect) btnClass += "bg-green-100 border-green-200 text-green-900";
                                                    else if (isSelected) btnClass += "bg-red-50 border-red-200 text-red-900";
                                                    else btnClass += "bg-gray-50 border-gray-200 text-gray-400";
                                                } else {
                                                    btnClass += isSelected ? "bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300" : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300";
                                                }
                                                return (
                                                    <button key={i} onClick={() => checkAnswer(block.id, opt, block.content.correctAnswer)} disabled={showFeedback} className={btnClass}>
                                                        <span>{opt}</span>
                                                        {showFeedback && isCorrect && <span className="text-xl">✅</span>}
                                                        {showFeedback && isSelected && !isCorrect && <span className="text-xl">❌</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {feedback[block.id] === 'correct' && <div className="mt-4 mr-11 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-100">כל הכבוד! תשובה נכונה. 🎉</div>}
                                        {feedback[block.id] === 'incorrect' && <div className="mt-4 mr-11 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">לא נורא, נסה שוב.</div>}
                                    </div>
                                )}

                                {block.type === 'open-question' && (
                                    <div className="bg-gradient-to-br from-orange-50 to-yellow-50 p-8 rounded-xl border border-orange-100 shadow-sm">
                                        <h4 className="font-bold text-xl text-gray-800 mb-2 flex items-center gap-2"><span>✍️</span> שאלה למחשבה</h4>
                                        <p className="text-gray-700 mb-6 font-medium text-lg leading-relaxed border-b border-orange-200 pb-4">
                                            {typeof block.content === 'object' ? block.content.question : "שאלה פתוחה"}
                                        </p>
                                        <textarea
                                            className="w-full p-4 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none bg-white h-40 resize-none shadow-inner text-gray-700 text-base"
                                            placeholder="הקלד את תשובתך כאן..."
                                            value={studentAnswers[block.id] || ''}
                                            onChange={(e) => handleTextChange(block.id, e.target.value)}
                                            onBlur={() => saveProgressToCloud(studentAnswers, aiGrading)}
                                            disabled={!!aiGrading[block.id]}
                                        />
                                        {!aiGrading[block.id] && (
                                            <div className="mt-4 text-right">
                                                <button onClick={() => handleGradeOpenQuestion(block.id, typeof block.content === 'object' ? block.content.question : "", block.metadata?.modelAnswer || '')} disabled={isGrading[block.id]} className="bg-orange-500 text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:bg-gray-300">
                                                    {isGrading[block.id] ? 'בודק...' : 'שלח לבדיקה'}
                                                </button>
                                            </div>
                                        )}
                                        {aiGrading[block.id] && (
                                            <div className="mt-6 bg-white p-6 rounded-xl border-r-4 border-orange-400 shadow-md animate-fade-in">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className={`text-2xl font-black ${aiGrading[block.id].grade >= 80 ? 'text-green-600' : 'text-orange-600'}`}>ציון: {aiGrading[block.id].grade}</div>
                                                    <div className="text-sm text-gray-400 uppercase tracking-wider">משוב אוטומטי (AI)</div>
                                                </div>
                                                <p className="text-gray-700 leading-relaxed">{aiGrading[block.id].feedback}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                {showPdf && pdfObjectUrl && (
                    <div className="w-1/2 bg-gray-800 h-full relative animate-slide-left border-r border-gray-600">
                        <div className="absolute top-0 left-0 right-0 bg-gray-900 text-white p-1 text-center text-xs font-bold opacity-90">מסמך המקור</div>
                        <iframe src={pdfObjectUrl} className="w-full h-full" title="PDF Viewer"></iframe>
                    </div>
                )}
            </main>
            <AiTutor />
        </div>
    );
};

export default CoursePlayer;