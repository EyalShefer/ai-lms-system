import React, { useState, useEffect, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { generateAdaptiveUnit } from '../gemini'; // וודא שיש לך את הפונקציה הזו ב-gemini.ts
import type { ActivityBlock, LearningUnit, Module } from '../courseTypes';

// --- רכיב צ'אט אינטראקטיבי חכם ---
const InteractiveChatBlock: React.FC<{ block: ActivityBlock; context: { unitTitle: string; unitContent: string } }> = ({ block, context }) => {
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (block.metadata?.initialMessage && messages.length === 0) {
            setMessages([{ role: 'model', text: block.metadata.initialMessage }]);
        }
    }, [block]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

            const systemInstruction = `
            הנחיות מערכת (System Instructions):
            1. זהות: אתה ${block.metadata?.systemPrompt || "מורה עוזר"}.
            2. הקשר: השיעור בנושא "${context.unitTitle}".
            3. תוכן השיעור: "${context.unitContent.substring(0, 800)}...".
            4. בטיחות: אם מזוהה מצוקה, הפנה למבוגר. אל תאפשר אלימות.
            5. שפה: עברית.
            `;

            const history = messages.map(m => ({
                role: m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        { role: "user", parts: [{ text: systemInstruction }] },
                        ...history,
                        { role: "user", parts: [{ text: userMsg }] }
                    ],
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                })
            });

            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "מצטער, הייתה שגיאה בתקשורת.";
            setMessages(prev => [...prev, { role: 'model', text: reply }]);

        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', text: "שגיאת רשת. נסה שוב." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-8 border border-indigo-100 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex items-center gap-3">
                <div className="text-2xl">💬</div>
                <div>
                    <h3 className="font-bold">{block.content.title || 'צ׳אט אינטראקטיבי'}</h3>
                    <p className="text-xs opacity-90">{block.content.description || 'שוחח עם הדמות על נושא השיעור'}</p>
                </div>
            </div>

            <div className="h-96 overflow-y-auto p-4 bg-gray-50 space-y-4">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loading && <div className="flex justify-start"><div className="bg-gray-200 p-2 rounded-xl text-xs text-gray-500 animate-pulse">מקליד...</div></div>}
                <div ref={bottomRef} />
            </div>

            <div className="p-3 bg-white border-t flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="הקלד הודעה לדמות..."
                    className="flex-1 p-3 border rounded-full text-sm outline-none focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md"
                >
                    ➤
                </button>
            </div>
        </div>
    );
};

// --- הקומפוננטה הראשית ---

const CoursePlayer: React.FC = () => {
    const { course, setCourse, pdfSource } = useCourseStore();
    const { currentUser } = useAuth();

    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [activeUnitId, setActiveUnitId] = useState<string | null>(null);

    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [feedbackVisible, setFeedbackVisible] = useState<Record<string, boolean>>({});

    // ניהול ניסיונות לכל שאלה (3 ניסיונות)
    const [attempts, setAttempts] = useState<Record<string, number>>({});

    // ניהול אדפטיביות
    const [isGeneratingAdaptive, setIsGeneratingAdaptive] = useState(false);
    const [showPdf, setShowPdf] = useState(false);

    useEffect(() => {
        if (course?.syllabus?.length > 0) {
            if (!activeModuleId) setActiveModuleId(course.syllabus[0].id);
            if (!activeUnitId && course.syllabus[0].learningUnits?.length > 0) {
                setActiveUnitId(course.syllabus[0].learningUnits[0].id);
            }
        }
    }, [course]);

    if (!course || !course.syllabus) return <div className="p-8 text-center">טוען מערך שיעור...</div>;

    const activeModule = course.syllabus.find(m => m.id === activeModuleId);
    const activeUnit = activeModule?.learningUnits.find(u => u.id === activeUnitId);
    const isExamMode = course.mode === 'exam';

    const handleAnswerSelect = (blockId: string, answer: string) => {
        if (!feedbackVisible[blockId]) {
            setUserAnswers(prev => ({ ...prev, [blockId]: answer }));
        }
    };

    const checkAnswer = (blockId: string, correctAnswer: string) => {
        if (isExamMode) return;

        const isCorrect = userAnswers[blockId] === correctAnswer;
        const currentAttempts = attempts[blockId] || 0;

        if (isCorrect) {
            setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
        } else {
            // מאפשרים 2 ניסיונות כושלים (0 ו-1), בשלישי (2) נגמר.
            if (currentAttempts < 2) {
                setAttempts(prev => ({ ...prev, [blockId]: currentAttempts + 1 }));
                const remaining = 2 - currentAttempts;
                alert(`תשובה שגויה. נותרו לך ${remaining} ניסיונות.`);
            } else {
                setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
            }
        }
    };

    // --- לוגיקה אדפטיבית: סיום יחידה ---
    const handleFinishUnit = async () => {
        if (!activeUnit) return;

        // 1. חישוב ציון
        const questions = activeUnit.activityBlocks.filter(b => b.type === 'multiple-choice');
        // אם אין שאלות, פשוט עוברים
        if (questions.length === 0) {
            alert("יחידה הושלמה בהצלחה!");
            return;
        }

        let correctCount = 0;
        questions.forEach(q => {
            if (userAnswers[q.id] === q.content.correctAnswer) correctCount++;
        });

        const score = Math.round((correctCount / questions.length) * 100);

        // 2. בדיקה האם נדרש חיזוק (פחות מ-60)
        if (score < 60 && !isExamMode) {
            if (confirm(`הציון שלך ביחידה זו הוא ${score}. האם תרצה שהמערכת תיצור עבורך שיעור חיזוק מותאם אישית?`)) {
                setIsGeneratingAdaptive(true);
                try {
                    // קריאה לפונקציה החדשה ב-gemini.ts
                    const remedialUnit = await generateAdaptiveUnit(activeUnit, "General comprehension failure");

                    // הוספה לקורס
                    const updatedCourse = { ...course };
                    const modIndex = updatedCourse.syllabus.findIndex(m => m.id === activeModuleId);
                    if (modIndex !== -1) {
                        const unitIndex = updatedCourse.syllabus[modIndex].learningUnits.findIndex(u => u.id === activeUnitId);
                        updatedCourse.syllabus[modIndex].learningUnits.splice(unitIndex + 1, 0, remedialUnit);

                        setCourse(updatedCourse);
                        setActiveUnitId(remedialUnit.id);
                        alert("שיעור החיזוק מוכן! בהצלחה.");
                    }
                } catch (e) {
                    console.error(e);
                    alert("שגיאה ביצירת תוכן אדפטיבי.");
                } finally {
                    setIsGeneratingAdaptive(false);
                }
            }
        } else {
            alert(`כל הכבוד! סיימת את היחידה בציון ${score}.`);
        }
    };

    const renderBlock = (block: ActivityBlock) => {
        switch (block.type) {
            case 'text':
                return (
                    <div key={block.id} className="prose max-w-none text-gray-800 leading-8 mb-8 whitespace-pre-wrap text-lg bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        {block.content}
                    </div>
                );

            case 'image':
                return (
                    <div key={block.id} className="mb-8">
                        <img
                            src={block.content}
                            alt={block.metadata?.fileName || 'Visual'}
                            className="w-full max-h-[500px] object-contain rounded-2xl border border-gray-100 shadow-sm bg-gray-50"
                        />
                        {block.metadata?.aiPrompt && <p className="text-xs text-gray-400 mt-2 text-center italic">נוצר ע"י AI</p>}
                    </div>
                );

            case 'video':
                const isYoutube = block.content.includes('youtu');
                const embedUrl = block.content.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');

                return (
                    <div key={block.id} className="mb-8 aspect-video bg-black rounded-2xl overflow-hidden shadow-lg border border-gray-200">
                        {isYoutube ? (
                            <iframe className="w-full h-full" src={embedUrl} title="Video" allowFullScreen />
                        ) : (
                            <video src={block.content} className="w-full h-full" controls />
                        )}
                    </div>
                );

            case 'interactive-chat':
                return (
                    <InteractiveChatBlock
                        key={block.id}
                        block={block}
                        context={{
                            unitTitle: activeUnit?.title || "שיעור כללי",
                            unitContent: activeUnit?.baseContent || ""
                        }}
                    />
                );

            case 'multiple-choice':
                const isCorrect = userAnswers[block.id] === block.content.correctAnswer;
                const showFeedback = feedbackVisible[block.id] && !isExamMode;
                const attemptCount = attempts[block.id] || 0;

                return (
                    <div key={block.id} className="mb-8 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold text-gray-900">{block.content.question}</h3>
                            {block.metadata?.score > 0 && <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-500">{block.metadata.score} נק׳</span>}
                        </div>
                        <div className="space-y-3">
                            {block.content.options?.map((option: string, idx: number) => {
                                const isSelected = userAnswers[block.id] === option;
                                let btnClass = "w-full text-right p-4 rounded-xl border transition-all flex justify-between items-center text-lg ";

                                if (showFeedback) {
                                    if (option === block.content.correctAnswer) btnClass += "bg-green-100 border-green-500 text-green-900 ";
                                    else if (isSelected) btnClass += "bg-red-50 border-red-300 text-red-900 ";
                                    else btnClass += "border-gray-200 opacity-50 ";
                                } else {
                                    btnClass += isSelected ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500 " : "border-gray-200 hover:bg-gray-50 ";
                                }

                                return (
                                    <button key={idx} onClick={() => handleAnswerSelect(block.id, option)} className={btnClass} disabled={showFeedback}>
                                        <span>{option}</span>
                                        {showFeedback && option === block.content.correctAnswer && <span>✅</span>}
                                        {showFeedback && isSelected && option !== block.content.correctAnswer && <span>❌</span>}
                                    </button>
                                );
                            })}
                        </div>
                        {!isExamMode && !showFeedback && (
                            <div className="mt-6 flex items-center justify-between">
                                <span className="text-xs text-gray-400">ניסיון {attemptCount + 1} מתוך 3</span>
                                <button
                                    onClick={() => checkAnswer(block.id, block.content.correctAnswer)}
                                    disabled={!userAnswers[block.id]}
                                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-lg"
                                >
                                    בדיקה
                                </button>
                            </div>
                        )}
                        {showFeedback && (
                            <div className={`mt-4 p-3 rounded-lg text-center font-bold ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {isCorrect ? 'כל הכבוד! תשובה נכונה 🎉' : 'לא נורא, התשובה הנכונה סומנה בירוק.'}
                            </div>
                        )}
                    </div>
                );

            case 'open-question':
                return (
                    <div key={block.id} className="mb-8 bg-orange-50 p-6 rounded-2xl border border-orange-100">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="text-xl font-bold text-gray-900">✍️ שאלה פתוחה</h3>
                            {block.metadata?.score > 0 && <span className="text-xs font-bold bg-white px-2 py-1 rounded text-orange-500 border border-orange-200">{block.metadata.score} נק׳</span>}
                        </div>
                        <p className="font-medium text-gray-800 mb-4 text-lg">{block.content.question}</p>
                        <textarea
                            className="w-full p-4 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none min-h-[150px] text-lg bg-white"
                            placeholder="הקלד את תשובתך כאן..."
                            value={userAnswers[block.id] || ''}
                            onChange={(e) => handleAnswerSelect(block.id, e.target.value)}
                        />
                    </div>
                );

            case 'gem-link':
                return (
                    <div key={block.id} className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-xl">
                        <div className="flex items-center gap-4 mb-2"><span className="text-3xl">💎</span><h3 className="text-xl font-bold">{block.content.title}</h3></div>
                        <p className="opacity-90 mb-4">{block.content.instructions || "לחץ על הקישור כדי לפתוח את המשימה האינטראקטיבית"}</p>
                        <a href={block.content.url} target="_blank" rel="noreferrer" className="inline-block bg-white text-indigo-600 px-6 py-2 rounded-full font-bold">התחל משימה ➔</a>
                    </div>
                );

            default: return null;
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50">
            <aside className="w-80 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0 pb-20 shadow-xl z-10">
                <div className="p-6">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">תוכן העניינים</h2>
                    <div className="space-y-8">
                        {course.syllabus.map((mod: Module) => (
                            <div key={mod.id}>
                                <div className="font-bold text-gray-800 mb-3 px-2 border-r-4 border-indigo-500 mr-[-24px] pr-5 bg-indigo-50 py-2">{mod.title}</div>
                                <div className="space-y-1">
                                    {mod.learningUnits.map((unit: LearningUnit) => (
                                        <button
                                            key={unit.id}
                                            onClick={() => { setActiveModuleId(mod.id); setActiveUnitId(unit.id); }}
                                            className={`w-full text-right px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-between group
                                                ${activeUnitId === unit.id
                                                    ? 'bg-indigo-600 text-white font-bold shadow-md transform scale-105'
                                                    : 'text-gray-600 hover:bg-gray-100'}`}
                                        >
                                            <span>{unit.title}</span>
                                            {/* הסתרת התגיות במצב מבחן כפי שביקשת */}
                                            {unit.type === 'test' && !isExamMode && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeUnitId === unit.id ? 'bg-white text-indigo-600' : 'bg-red-100 text-red-600'}`}>
                                                    מבחן
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {pdfSource && (
                    <div className="p-4 border-t mt-4 sticky bottom-0 bg-white">
                        <button onClick={() => setShowPdf(!showPdf)} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                            {showPdf ? 'סגור ספר' : '📖 פתח ספר לימוד'}
                        </button>
                    </div>
                )}
            </aside>

            <main className={`flex-1 overflow-y-auto p-8 scroll-smooth transition-all duration-300 ${showPdf ? 'flex gap-4' : ''}`}>
                <div className={`mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 min-h-[500px] p-10 relative transition-all duration-300 ${showPdf ? 'w-1/2' : 'max-w-4xl'}`}>
                    {activeUnit ? (
                        <>
                            <header className="mb-10 pb-6 border-b border-gray-100">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold mb-3 inline-block
                                    ${activeUnit.type === 'acquisition' ? 'bg-blue-100 text-blue-700' : activeUnit.type === 'practice' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}
                                `}>
                                    {activeUnit.type === 'acquisition' ? '📖 יחידת לימוד' : activeUnit.type === 'practice' ? '💪 יחידת תרגול' : '📝 יחידת מבחן'}
                                </span>
                                <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">{activeUnit.title}</h1>
                            </header>

                            <div className="space-y-6">
                                {activeUnit.activityBlocks?.length === 0 && <div className="text-gray-400 text-center py-10">אין תוכן ביחידה זו עדיין.</div>}
                                {activeUnit.activityBlocks?.map(renderBlock)}
                            </div>

                            {/* כפתור סיום יחידה + אדפטיביות */}
                            <div className="mt-12 pt-8 border-t border-gray-100 flex justify-center">
                                <button
                                    onClick={handleFinishUnit}
                                    disabled={isGeneratingAdaptive}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all flex items-center gap-2"
                                >
                                    {isGeneratingAdaptive ? '🤖 ה-AI בונה לך שיעור חיזוק...' : '✅ סיימתי את היחידה'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="text-6xl mb-4">👋</div>
                            <div className="text-xl">בחר יחידת לימוד מהתפריט בצד ימין</div>
                        </div>
                    )}
                </div>

                {/* PDF Viewer */}
                {showPdf && pdfSource && (
                    <div className="w-1/2 bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-700 animate-slide-left">
                        <div className="bg-gray-900 text-white p-2 text-center text-xs font-bold border-b border-gray-700">ספר הלימוד המקורי</div>
                        <iframe src={pdfSource} className="w-full h-full bg-white" title="PDF Viewer"></iframe>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CoursePlayer;