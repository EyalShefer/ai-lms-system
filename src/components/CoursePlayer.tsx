import React, { useState, useEffect, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import { generateAdaptiveUnit } from '../gemini';
import type { ActivityBlock, LearningUnit, Module } from '../courseTypes';
import {
    IconChat, IconBook, IconEdit, IconList, IconSparkles,
    IconCheck, IconX, IconArrowBack, IconVideo, IconImage,
    IconRobot, IconLink, IconStudent, IconChart
} from '../icons';

// --- רכיב צ'אט אינטראקטיבי חכם (בעיצוב Glass) ---
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
        <div className="mb-8 glass border border-purple-100/50 rounded-2xl overflow-hidden shadow-sm bg-white/60 backdrop-blur-md">
            <div className="bg-gradient-to-r from-purple-600/90 to-indigo-600/90 p-4 text-white flex items-center gap-3 shadow-sm">
                <div className="bg-white/20 p-2 rounded-full"><IconRobot className="w-6 h-6" /></div>
                <div>
                    <h3 className="font-bold text-lg">{block.content.title || 'צ׳אט אינטראקטיבי'}</h3>
                    <p className="text-xs opacity-90">{block.content.description || 'שוחח עם הדמות על נושא השיעור'}</p>
                </div>
            </div>

            <div className="h-96 overflow-y-auto p-4 bg-gray-50/50 space-y-4 scrollbar-thin scrollbar-thumb-gray-300">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-none text-xs text-gray-500 flex gap-1 items-center shadow-sm">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <div className="p-3 bg-white/80 border-t flex gap-2 backdrop-blur">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="הקלד הודעה לדמות..."
                    className="flex-1 p-3 border border-gray-200 rounded-full text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 bg-gray-50 focus:bg-white transition-colors"
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md transform active:scale-95"
                >
                    <IconArrowBack className="w-5 h-5 rotate-180" />
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
    const [attempts, setAttempts] = useState<Record<string, number>>({});
    const [isGeneratingAdaptive, setIsGeneratingAdaptive] = useState(false);
    const [showPdf, setShowPdf] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true); // למובייל

    useEffect(() => {
        if (course?.syllabus?.length > 0) {
            if (!activeModuleId) setActiveModuleId(course.syllabus[0].id);
            if (!activeUnitId && course.syllabus[0].learningUnits?.length > 0) {
                setActiveUnitId(course.syllabus[0].learningUnits[0].id);
            }
        }
    }, [course]);

    if (!course || !course.syllabus) return <div className="h-screen flex items-center justify-center text-gray-500">טוען תוכן...</div>;

    const activeModule = course.syllabus.find(m => m.id === activeModuleId);
    const activeUnit = activeModule?.learningUnits.find(u => u.id === activeUnitId);
    const isExamMode = course.mode === 'exam';

    // עזר לתווית ואייקון היחידה
    const getUnitBadge = (unit: LearningUnit) => {
        if (unit.type === 'acquisition') return { label: 'יחידת לימוד', class: 'bg-blue-100 text-blue-700 border-blue-200', icon: <IconBook className="w-3 h-3" /> };
        if (unit.type === 'practice') return { label: 'יחידת תרגול', class: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <IconEdit className="w-3 h-3" /> };
        if (unit.type === 'test') return { label: 'מבחן ידע', class: 'bg-red-100 text-red-700 border-red-200', icon: <IconList className="w-3 h-3" /> };
        if (unit.type === 'remedial') return { label: 'יחידת חיזוק', class: 'bg-green-100 text-green-700 border-green-200', icon: <IconSparkles className="w-3 h-3" /> };
        return { label: 'יחידה כללית', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: <IconBook className="w-3 h-3" /> };
    };

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
            if (currentAttempts < 2) {
                setAttempts(prev => ({ ...prev, [blockId]: currentAttempts + 1 }));
                alert(`תשובה שגויה. נותרו לך ${2 - currentAttempts} ניסיונות.`);
            } else {
                setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
            }
        }
    };

    const goToNextUnit = () => {
        if (!activeModuleId || !activeUnitId) return;
        const currentModIndex = course.syllabus.findIndex(m => m.id === activeModuleId);
        if (currentModIndex === -1) return;
        const currentModule = course.syllabus[currentModIndex];
        const currentUnitIndex = currentModule.learningUnits.findIndex(u => u.id === activeUnitId);

        if (currentUnitIndex < currentModule.learningUnits.length - 1) {
            setActiveUnitId(currentModule.learningUnits[currentUnitIndex + 1].id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (currentModIndex < course.syllabus.length - 1) {
            const nextModule = course.syllabus[currentModIndex + 1];
            if (nextModule.learningUnits.length > 0) {
                setActiveModuleId(nextModule.id);
                setActiveUnitId(nextModule.learningUnits[0].id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            alert("כל הכבוד! סיימת את הקורס כולו. 🎉");
        }
    };

    const handleContinueClick = async () => {
        if (!activeUnit) return;
        const questions = activeUnit.activityBlocks.filter(b => b.type === 'multiple-choice');
        let score = 100;

        if (questions.length > 0) {
            let correctCount = 0;
            questions.forEach(q => { if (userAnswers[q.id] === q.content.correctAnswer) correctCount++; });
            score = Math.round((correctCount / questions.length) * 100);
        }

        if (score < 60 && !isExamMode && questions.length > 0) {
            setIsGeneratingAdaptive(true);
            try {
                const remedialUnit = await generateAdaptiveUnit(activeUnit, "General comprehension failure");
                const updatedCourse = { ...course };
                const modIndex = updatedCourse.syllabus.findIndex(m => m.id === activeModuleId);
                if (modIndex !== -1) {
                    const unitIndex = updatedCourse.syllabus[modIndex].learningUnits.findIndex(u => u.id === activeUnitId);
                    updatedCourse.syllabus[modIndex].learningUnits.splice(unitIndex + 1, 0, remedialUnit);
                    setCourse(updatedCourse);
                    setActiveUnitId(remedialUnit.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch (e) {
                console.error("Adaptive Error:", e);
                goToNextUnit();
            } finally {
                setIsGeneratingAdaptive(false);
            }
        } else {
            goToNextUnit();
        }
    };

    const renderBlock = (block: ActivityBlock) => {
        switch (block.type) {
            case 'text':
                return (
                    <div key={block.id} className="prose max-w-none text-gray-800 leading-8 mb-8 whitespace-pre-wrap text-lg glass bg-white/70 p-6 rounded-2xl shadow-sm border border-white/50">
                        {block.content}
                    </div>
                );

            case 'image':
                return (
                    <div key={block.id} className="mb-8">
                        <div className="relative rounded-2xl overflow-hidden shadow-lg border border-gray-200 group">
                            <img src={block.content} alt={block.metadata?.fileName || 'Visual'} className="w-full max-h-[500px] object-contain bg-gray-50" />
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-md flex items-center gap-1">
                                <IconImage className="w-3 h-3" /> תמונה
                            </div>
                        </div>
                        {block.metadata?.aiPrompt && <p className="text-xs text-gray-400 mt-2 text-center flex justify-center items-center gap-1"><IconSparkles className="w-3 h-3" /> נוצר ע"י AI</p>}
                    </div>
                );

            case 'video':
                const isYoutube = block.content.includes('youtu');
                const embedUrl = block.content.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
                return (
                    <div key={block.id} className="mb-8 aspect-video bg-black rounded-2xl overflow-hidden shadow-lg border border-gray-200 relative group">
                        {isYoutube ? (
                            <iframe className="w-full h-full" src={embedUrl} title="Video" allowFullScreen />
                        ) : (
                            <video src={block.content} className="w-full h-full" controls />
                        )}
                        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-md flex items-center gap-1 pointer-events-none">
                            <IconVideo className="w-3 h-3" /> וידאו
                        </div>
                    </div>
                );

            case 'interactive-chat':
                return <InteractiveChatBlock key={block.id} block={block} context={{ unitTitle: activeUnit?.title || "שיעור כללי", unitContent: activeUnit?.baseContent || "" }} />;

            case 'multiple-choice':
                const isCorrect = userAnswers[block.id] === block.content.correctAnswer;
                const showFeedback = feedbackVisible[block.id] && !isExamMode;
                const attemptCount = attempts[block.id] || 0;
                return (
                    <div key={block.id} className="mb-8 glass bg-white/80 p-6 rounded-2xl border border-white/50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1 h-full bg-blue-500/50"></div>
                        <div className="flex justify-between items-start mb-4 pr-3">
                            <h3 className="text-xl font-bold text-gray-900">{block.content.question}</h3>
                            {block.metadata?.score > 0 && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full border border-blue-200">{block.metadata.score} נק׳</span>}
                        </div>
                        <div className="space-y-3 pr-3">
                            {block.content.options?.map((option: string, idx: number) => {
                                const isSelected = userAnswers[block.id] === option;
                                let btnClass = "w-full text-right p-4 rounded-xl border transition-all flex justify-between items-center text-lg shadow-sm ";
                                if (showFeedback) {
                                    if (option === block.content.correctAnswer) btnClass += "bg-green-50 border-green-500 text-green-900 ring-1 ring-green-500 ";
                                    else if (isSelected) btnClass += "bg-red-50 border-red-300 text-red-900 ";
                                    else btnClass += "border-gray-200 opacity-50 bg-gray-50 ";
                                } else {
                                    btnClass += isSelected ? "border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500 " : "border-gray-200 hover:bg-white hover:border-blue-300 hover:shadow-md bg-white/50 ";
                                }
                                return (
                                    <button key={idx} onClick={() => handleAnswerSelect(block.id, option)} className={btnClass} disabled={showFeedback}>
                                        <span>{option}</span>
                                        {showFeedback && option === block.content.correctAnswer && <IconCheck className="text-green-600 w-6 h-6" />}
                                        {showFeedback && isSelected && option !== block.content.correctAnswer && <IconX className="text-red-500 w-6 h-6" />}
                                    </button>
                                );
                            })}
                        </div>
                        {!isExamMode && !showFeedback && (
                            <div className="mt-6 flex items-center justify-between pr-3">
                                <span className="text-xs text-gray-500 font-medium">ניסיון {attemptCount + 1} מתוך 3</span>
                                <button onClick={() => checkAnswer(block.id, block.content.correctAnswer)} disabled={!userAnswers[block.id]} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200/50 flex items-center gap-2">
                                    בדיקה <IconCheck className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        {showFeedback && (
                            <div className={`mt-4 p-3 rounded-xl text-center font-bold flex items-center justify-center gap-2 animate-pulse ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isCorrect ? <><IconSparkles className="w-5 h-5" /> כל הכבוד! תשובה נכונה</> : 'לא נורא, התשובה הנכונה סומנה בירוק.'}
                            </div>
                        )}
                    </div>
                );

            case 'open-question':
                return (
                    <div key={block.id} className="mb-8 glass bg-orange-50/50 p-6 rounded-2xl border border-orange-100/60 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1 h-full bg-orange-400/50"></div>
                        <div className="flex justify-between items-start mb-3 pr-3">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><IconEdit className="w-5 h-5 text-orange-500" /> שאלה פתוחה</h3>
                            {block.metadata?.score > 0 && <span className="text-xs font-bold bg-white px-2 py-1 rounded text-orange-500 border border-orange-200">{block.metadata.score} נק׳</span>}
                        </div>
                        <p className="font-medium text-gray-800 mb-4 text-lg pr-3">{block.content.question}</p>
                        <textarea
                            className="w-full p-4 border border-orange-200/80 rounded-xl focus:ring-2 focus:ring-orange-200 outline-none min-h-[150px] text-lg bg-white/80 backdrop-blur focus:bg-white transition-all shadow-inner"
                            placeholder="הקלד את תשובתך כאן..."
                            value={userAnswers[block.id] || ''}
                            onChange={(e) => handleAnswerSelect(block.id, e.target.value)}
                        />
                    </div>
                );

            case 'gem-link':
                return (
                    <div key={block.id} className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-2xl text-white shadow-xl flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-1"><span className="text-2xl">💎</span><h3 className="text-xl font-bold">{block.content.title}</h3></div>
                            <p className="opacity-90 text-sm">{block.content.instructions || "לחץ על הקישור כדי לפתוח"}</p>
                        </div>
                        <a href={block.content.url} target="_blank" rel="noreferrer" className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-6 py-3 rounded-xl font-bold backdrop-blur-md transition-all flex items-center gap-2">
                            פתח <IconLink className="w-4 h-4" />
                        </a>
                    </div>
                );

            default: return null;
        }
    };

    const unitBadge = activeUnit ? getUnitBadge(activeUnit) : { label: '', class: '', icon: null };

    return (
        <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50 font-sans">
            {/* Sidebar - Mobile Toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-full shadow-lg border border-gray-200 text-gray-600"
            >
                <IconList className="w-6 h-6" />
            </button>

            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} fixed md:relative w-80 h-full bg-white/80 backdrop-blur-xl border-l border-white/50 shadow-2xl md:shadow-none z-40 transition-transform duration-300 flex flex-col`}>
                <div className="p-6 overflow-y-auto flex-1 pb-20 scrollbar-thin scrollbar-thumb-gray-200">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2"><IconChart className="w-4 h-4" /> תוכן העניינים</h2>
                    <div className="space-y-6">
                        {course.syllabus.map((mod: Module) => (
                            <div key={mod.id}>
                                <div className="font-bold text-gray-800 mb-2 px-2 border-r-4 border-blue-500 mr-[-24px] pr-5 bg-blue-50/50 py-2 rounded-l-lg text-sm">{mod.title}</div>
                                <div className="space-y-1 pr-2">
                                    {mod.learningUnits.map((unit: LearningUnit) => (
                                        <button
                                            key={unit.id}
                                            onClick={() => { setActiveModuleId(mod.id); setActiveUnitId(unit.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                                            className={`w-full text-right px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between group border ${activeUnitId === unit.id
                                                ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-md transform scale-105 origin-right'
                                                : 'text-gray-600 hover:bg-gray-100 border-transparent'}`}
                                        >
                                            <span className="truncate">{unit.title}</span>
                                            {unit.type === 'test' && !isExamMode && !unit.title.includes('סיכום') && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${activeUnitId === unit.id ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>מבחן</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {pdfSource && (
                    <div className="p-4 border-t border-gray-100 bg-white/90 backdrop-blur">
                        <button onClick={() => setShowPdf(!showPdf)} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 shadow-lg">
                            {showPdf ? <><IconX className="w-4 h-4" /> סגור ספר</> : <><IconBook className="w-4 h-4" /> פתח ספר לימוד</>}
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Content */}
            <main className={`flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth transition-all duration-300 relative ${showPdf ? 'flex gap-4' : ''}`}>
                <div className={`mx-auto glass bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl border border-white/50 min-h-[500px] p-6 md:p-10 relative transition-all duration-300 ${showPdf ? 'w-1/2 hidden md:block' : 'max-w-4xl w-full'}`}>
                    {activeUnit ? (
                        <>
                            <header className="mb-8 pb-6 border-b border-gray-100">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold mb-3 inline-flex items-center gap-1.5 border ${unitBadge.class}`}>
                                    {unitBadge.icon} {unitBadge.label}
                                </span>
                                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{activeUnit.title}</h1>
                            </header>

                            <div className="space-y-6">
                                {activeUnit.activityBlocks?.length === 0 && <div className="text-gray-400 text-center py-20 flex flex-col items-center gap-2"><IconBook className="w-12 h-12 opacity-20" /> אין תוכן ביחידה זו עדיין.</div>}
                                {activeUnit.activityBlocks?.map(renderBlock)}
                            </div>

                            <div className="mt-12 pt-8 border-t border-gray-100 flex justify-center pb-10">
                                <button
                                    onClick={handleContinueClick}
                                    disabled={isGeneratingAdaptive}
                                    className="bg-gradient-to-l from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-full font-bold text-lg shadow-lg hover:shadow-blue-200/50 transform hover:-translate-y-1 transition-all flex items-center gap-3 disabled:opacity-70 disabled:cursor-wait"
                                >
                                    {isGeneratingAdaptive ? (
                                        <>
                                            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                            <span>מכין תרגול מותאם...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>המשך לשיעור הבא</span>
                                            <IconArrowBack className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                            <IconStudent className="w-24 h-24 mb-4 opacity-20" />
                            <div className="text-xl">בחר יחידת לימוד מהתפריט</div>
                        </div>
                    )}
                </div>

                {/* PDF Viewer - Slide in */}
                {showPdf && pdfSource && (
                    <div className="w-full md:w-1/2 bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-700 animate-slide-left fixed md:relative inset-0 z-50 md:z-auto m-4 md:m-0">
                        <div className="bg-gray-900 text-white p-3 text-center text-xs font-bold border-b border-gray-700 flex justify-between items-center px-4">
                            <span>ספר הלימוד המקורי</span>
                            <button onClick={() => setShowPdf(false)} className="md:hidden"><IconX className="w-4 h-4" /></button>
                        </div>
                        <iframe src={pdfSource} className="w-full h-full bg-white" title="PDF Viewer"></iframe>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CoursePlayer;