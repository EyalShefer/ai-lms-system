
import React, { useState, useEffect, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import type { ActivityBlock } from '../courseTypes';
import {
    IconArrowBack, IconRobot, IconEye, IconCheck, IconX, IconCalendar, IconClock, IconInfo, IconUser, IconBook, IconEdit, IconSparkles, IconLoader
} from '../icons';
import { submitAssignment } from '../services/submissionService';
import { openai, MODEL_NAME, checkOpenQuestionAnswer } from '../gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ClozeQuestion from './ClozeQuestion';
import OrderingQuestion from './OrderingQuestion';
import CategorizationQuestion from './CategorizationQuestion';
import MemoryGameQuestion from './MemoryGameQuestion';

// Helper to safely extract text from option (string or object)
const getOptionText = (opt: any): string => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object' && opt.text) return opt.text;
    return '';
};

// --- הגדרות טיפוסים למצב סקירה ---
interface StudentReviewData {
    studentName: string;
    answers: Record<string, any>;
    chatHistory?: { role: string, parts: string }[];
}

interface CoursePlayerProps {
    assignment?: any; // Added assignment prop
    reviewMode?: boolean;
    studentData?: StudentReviewData;
    onExitReview?: () => void;
}

// --- רכיב צ'אט אינטראקטיבי חכם ---
const InteractiveChatBlock: React.FC<{
    block: ActivityBlock;
    context: { unitTitle: string; unitContent: string };
    forcedHistory?: { role: string, parts: string }[];
    readOnly?: boolean;
}> = ({ block, context, forcedHistory, readOnly = false }) => {

    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null); // Ref for container instead of bottom element

    // טעינת היסטוריה או הודעה ראשונית
    useEffect(() => {
        if (forcedHistory && forcedHistory.length > 0) {
            const formatted = forcedHistory.map(msg => ({
                role: msg.role as 'user' | 'model',
                text: msg.parts
            }));
            setMessages(formatted);
        } else if (block.metadata?.initialMessage && messages.length === 0) {
            setMessages([{ role: 'model', text: block.metadata.initialMessage }]);
        }
    }, [block, forcedHistory]);

    // גלילה חכמה (ללא קפיצות דף)
    useEffect(() => {
        if (!readOnly && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages, readOnly]);

    const handleSend = async () => {
        if (!input.trim() || readOnly) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            // Explicit string construction to avoid parser issues with Hebrew/Template Literals
            const promptIntro = "הנחיות מערכת:";
            const promptRole = "אתה " + (block.metadata?.systemPrompt || "מורה עוזר") + ".";
            const promptTopic = "הנושא: " + '"' + context.unitTitle + '"' + ".";
            const promptContent = "תוכן: " + '"' + context.unitContent.substring(0, 800) + '..."' + ".";
            const promptSafety = "שמור על בטיחות ושפה נאותה.";

            const systemInstruction = [promptIntro, promptRole, promptTopic, promptContent, promptSafety].join("\n");

            const historyMessages = messages.map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.text
            }));

            // שימוש בקליינט המרכזי של OpenAI (שעובר דרך הפרוקסי)
            const response = await openai.chat.completions.create({
                model: MODEL_NAME, // שימוש במודל המוגדר גלובלית
                messages: [
                    { role: "system", content: systemInstruction },
                    ...historyMessages as any,
                    { role: "user", content: userMsg }
                ]
            });

            const reply = response.choices[0]?.message?.content || "שגיאה בתקשורת (No content).";
            setMessages(prev => [...prev, { role: 'model', text: reply }]);

        } catch (error) {
            console.error("Bot Communication Error (OpenAI):", error);
            setMessages(prev => [...prev, { role: 'model', text: "מצטער, יש לי קשיי תקשורת רגעיים. אנא נסה שוב מאוחר יותר." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-8 glass border border-purple-100/50 rounded-2xl overflow-hidden shadow-sm bg-white/60 backdrop-blur-md">
            <div className={"p-4 text-white flex items-center gap-3 shadow-sm " + (readOnly ? "bg-slate-700" : "bg-gradient-to-r from-purple-600/90 to-indigo-600/90")}>
                <div className="bg-white/20 p-2 rounded-full"><IconRobot className="w-6 h-6" /></div>
                <div>
                    <h3 className="font-bold text-lg">{block.content.title || 'צ׳אט אינטראקטיבי'}</h3>
                    <p className="text-xs opacity-90">{readOnly ? 'תיעוד שיחה (מצב צפייה)' : 'שוחח עם הבוט'}</p>
                </div>
            </div>

            <div
                ref={containerRef}
                className="h-96 overflow-y-auto p-4 bg-gray-50/50 space-y-4 scrollbar-thin scrollbar-thumb-gray-300"
            >
                {messages.length === 0 && readOnly && <div className="text-center text-gray-400 mt-20">אין היסטוריית שיחה.</div>}
                {messages.map((msg, i) => (
                    <div key={i} className={"flex " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={"max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm " + (
                            msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                        )}>
                            {readOnly && <div className="text-[10px] opacity-50 mb-1">{msg.role === 'user' ? 'תלמיד' : 'בוט'}</div>}
                            <div className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 text-inherit">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.text}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && <div className="text-xs text-gray-400 animate-pulse mr-2">מקליד...</div>}

            </div>

            {!readOnly && (
                <div className="p-3 bg-white/80 border-t flex gap-2 backdrop-blur">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="הקלד הודעה..." className="flex-1 p-3 border border-gray-200 rounded-full text-sm outline-none focus:border-indigo-500" />
                    <button onClick={handleSend} disabled={loading || !input.trim()} className="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-indigo-700 shadow-md"><IconArrowBack className="w-5 h-5 rotate-180" /></button>
                </div>
            )}
        </div>
    );
};

interface CoursePlayerProps {
    assignment?: any;
    reviewMode?: boolean;
    onExitReview?: () => void;
    studentData?: StudentReviewData;
    forcedUnitId?: string; // New Prop
    hideReviewHeader?: boolean;
}

// --- הקומפוננטה הראשית ---
const CoursePlayer: React.FC<CoursePlayerProps> = ({ assignment, reviewMode = false, studentData, onExitReview, forcedUnitId, hideReviewHeader = false }) => {
    const { course } = useCourseStore();

    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [activeUnitId, setActiveUnitId] = useState<string | null>(forcedUnitId || null);
    // Initialize userAnswers from submission if available, otherwise empty
    const [userAnswers, setUserAnswers] = useState<Record<string, any>>(assignment?.activeSubmission?.answers || {});
    const [feedbackVisible, setFeedbackVisible] = useState<Record<string, boolean>>({});
    const [hintsVisible, setHintsVisible] = useState<Record<string, number>>({}); // number = how many hints shown
    const [blockMistakes, setBlockMistakes] = useState<Record<string, number>>({}); // Track mistakes per block
    const [openQuestionFeedback, setOpenQuestionFeedback] = useState<Record<string, { status: string, feedback: string }>>({}); // Tutor feedback
    const [checkingOpenId, setCheckingOpenId] = useState<string | null>(null); // Loading state for Tutor check

    // Submission State
    const [studentName, setStudentName] = useState('');
    const [isNameConfirmed, setIsNameConfirmed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Split View State
    const [showSplitView, setShowSplitView] = useState(false);

    // Open Split View by default if content exists and enabled
    const hasAutoOpenedRef = useRef(false);
    useEffect(() => {
        if (course?.id && course?.showSourceToStudent && course?.fullBookContent && !hasAutoOpenedRef.current) {
            setShowSplitView(true);
            hasAutoOpenedRef.current = true;
        }
        // Reset ref if course changes
        return () => { if (course?.id) hasAutoOpenedRef.current = false; };
    }, [course?.id, course?.showSourceToStudent, !!course?.fullBookContent]);

    // If not an assignment (teacher preview), we don't need name
    useEffect(() => {
        if (!assignment) {
            setIsNameConfirmed(true);
        }
    }, [assignment]);
    useEffect(() => {
        if (forcedUnitId) {
            setActiveUnitId(forcedUnitId);
            const moduleForUnit = course?.syllabus?.find(m => m.learningUnits?.some(u => u.id === forcedUnitId));
            if (moduleForUnit) setActiveModuleId(moduleForUnit.id);
        } else if (reviewMode && userAnswers && Object.keys(userAnswers).length > 0 && course?.syllabus) {
            // Smart Review: Find the first unit where the student has answers
            let foundUnitId = null;
            let foundModuleId = null;

            for (const module of course.syllabus) {
                for (const unit of module.learningUnits) {
                    const hasAnswer = unit.activityBlocks?.some(block => userAnswers[block.id]);
                    if (hasAnswer) {
                        foundUnitId = unit.id;
                        foundModuleId = module.id;
                        break;
                    }
                }
                if (foundUnitId) break;
            }

            if (foundUnitId) {
                setActiveUnitId(foundUnitId);
                setActiveModuleId(foundModuleId);
            } else {
                // Fallback to first unit if answers exist but don't match (shouldn't happen)
                if (!activeModuleId) setActiveModuleId(course.syllabus[0].id);
                if (!activeUnitId && course.syllabus[0].learningUnits?.length > 0) setActiveUnitId(course.syllabus[0].learningUnits[0].id);
            }
        } else if (course?.syllabus?.length > 0) {
            // Default initialization
            if (!activeModuleId) setActiveModuleId(course.syllabus[0].id);
            if (!activeUnitId && course.syllabus[0].learningUnits?.length > 0) setActiveUnitId(course.syllabus[0].learningUnits[0].id);
        }
    }, [course, forcedUnitId, reviewMode]); // Removed userAnswers dependency to avoid loops, as userAnswers is init from props

    // מצב סקירה
    useEffect(() => {
        if (reviewMode && studentData?.answers) {
            setUserAnswers(studentData.answers);
            setFeedbackVisible(() => {
                const newState: Record<string, boolean> = {};
                if (activeUnit) activeUnit.activityBlocks.forEach(b => newState[b.id] = true);
                return newState;
            });
        }
    }, [reviewMode, studentData, activeUnitId]);

    // בדיקת טעינה
    if (!course || !course.syllabus) return <div className="h-screen flex items-center justify-center text-gray-500">טוען תוכן...</div>;

    // --- 1. מסך הזנת שם (רק למשימות) ---
    if (assignment && !isNameConfirmed) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IconUser className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">ברוכים הבאים!</h1>
                    <p className="text-gray-600 mb-6">לפני שמתחילים במשימה <b>"{assignment.title}"</b>, אנא הכניסו את שמכם המלא.</p>

                    <input
                        type="text"
                        placeholder="שם מלא..."
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-xl mb-6 text-lg focus:border-blue-500 outline-none"
                    />

                    <button
                        onClick={() => {
                            if (studentName.trim().length > 1) setIsNameConfirmed(true);
                        }}
                        disabled={studentName.trim().length < 2}
                        className={"w-full py-3 rounded-xl font-bold text-white transition-all " + (
                            studentName.trim().length < 2 ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                        )}
                    >
                        התחל משימה
                    </button>
                </div>
            </div>
        );
    }

    // --- 2. מסך סיום והגשה ---
    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg w-full text-center animate-scale-in">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <IconCheck className="w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-800 mb-3">המשימה הוגשה בהצלחה!</h1>
                    <p className="text-gray-600 text-lg mb-8">
                        תודה רבה, {studentName}.<br />
                        התשובות שלך נשמרו והועברו למורה לבדיקה.
                    </p>
                    <button onClick={() => window.close()} className="text-gray-400 hover:text-gray-600 text-sm underline">
                        סגור חלונית
                    </button>
                </div>
            </div>
        );
    }

    const activeModule = course.syllabus.find(m => m.id === activeModuleId);
    const activeUnit = activeModule?.learningUnits.find(u => u.id === activeUnitId);
    const isExamMode = course.mode === 'exam';

    // חישוב הגיל לתצוגה
    const displayGrade = course.gradeLevel || course.targetAudience || "כללי";


    const handleShowHint = (blockId: string) => {
        setHintsVisible(prev => {
            const currentLevel = prev[blockId] || 0;
            return { ...prev, [blockId]: currentLevel + 1 };
        });
    };

    const handleAnswerSelect = (blockId: string, answer: any) => {
        if (!reviewMode && !feedbackVisible[blockId]) {
            setUserAnswers(prev => ({
                ...prev,
                [blockId]: answer
            }));
            // Reset hints when user tries to answer? Optional. 
            // For now, let's keep them if they asked.
        }
    };
    const checkAnswer = async (blockId: string) => {
        if (isExamMode || reviewMode) return;

        const block = activeUnit?.activityBlocks.find(b => b.id === blockId);
        if (!block) return;

        // 1. Multiple Choice Check
        if (block.type === 'multiple-choice') {
            setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
            const isCorrect = userAnswers[blockId] === block.content.correctAnswer;
            if (!isCorrect) {
                setBlockMistakes(prev => ({ ...prev, [blockId]: (prev[blockId] || 0) + 1 }));
            }
        }

        // 2. Open Question Check (The Tutor)
        else if (block.type === 'open-question') {
            if (!userAnswers[blockId] || userAnswers[blockId].trim().length < 3) return; // Ignore empty answers

            setCheckingOpenId(blockId);

            // Get context (Source text) if available
            const sourceText = course?.fullBookContent || "";
            const modelAnswer = block.metadata?.modelAnswer || "";

            const tutorResponse = await checkOpenQuestionAnswer(
                block.content.question,
                userAnswers[blockId],
                modelAnswer,
                sourceText
            );

            setOpenQuestionFeedback(prev => ({ ...prev, [blockId]: tutorResponse }));
            setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
            setCheckingOpenId(null);
        }
        else {
            // Default for others
            setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
        }
    };

    const handleGameComplete = (blockId: string, score: number) => {
        if (reviewMode) return;
        // Save score as string or generic obj
        setUserAnswers(prev => ({ ...prev, [blockId]: "Score: " + score }));
        setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
    };

    // --- לוגיקה למעבר יחידה ---
    const goToNextUnit = () => {
        if (reviewMode || !course.syllabus) return;

        const currentModuleIndex = course.syllabus.findIndex(m => m.id === activeModuleId);
        const currentModule = course.syllabus[currentModuleIndex];
        const currentUnitIndex = currentModule?.learningUnits.findIndex(u => u.id === activeUnitId);

        if (currentModule && currentUnitIndex !== -1) {
            if (currentUnitIndex < currentModule.learningUnits.length - 1) {
                // ... (Logic remains same)
                const nextUnit = currentModule.learningUnits[currentUnitIndex + 1];
                setActiveUnitId(nextUnit.id);
                window.scrollTo(0, 0);
            }
            else if (currentModuleIndex < course.syllabus.length - 1) {
                // ... (Logic remains same)
                const nextModule = course.syllabus[currentModuleIndex + 1];
                setActiveModuleId(nextModule.id);
                if (nextModule.learningUnits.length > 0) {
                    setActiveUnitId(nextModule.learningUnits[0].id);
                }
                window.scrollTo(0, 0);
            } else {
                // Last Unit: Trigger Submit!
                handleSubmit();
            }
        }
    };

    const calculateScore = () => {
        if (!course || !course.syllabus) return 0;

        let totalWeightedScore = 0;
        let totalMaxWeight = 0;

        course.syllabus.forEach(module => {
            module.learningUnits.forEach(unit => {
                unit.activityBlocks?.forEach(block => {
                    const weight = block.metadata?.score || 10; // Default weight is 10 if not specified

                    // 1. Multiple Choice
                    if (block.type === 'multiple-choice' && block.content.correctAnswer) {
                        totalMaxWeight += weight;
                        if (userAnswers[block.id] === block.content.correctAnswer) {
                            totalWeightedScore += weight;
                        }
                    }

                    // 2. Interactive Questions (Stored as "Score: X" string, X is 0-100)
                    else if (['fill_in_blanks', 'ordering', 'categorization', 'memory_game'].includes(block.type)) {
                        totalMaxWeight += weight;
                        const answerStr = userAnswers[block.id];
                        if (answerStr && typeof answerStr === 'string' && answerStr.startsWith('Score: ')) {
                            const numericScore = parseInt(answerStr.replace('Score: ', '')) || 0;
                            // Add proportional score based on weight
                            totalWeightedScore += (numericScore / 100) * weight;
                        }
                    }

                    // 3. Related Questions (Metadata)
                    if (block.metadata?.relatedQuestion?.correctAnswer) {
                        const relatedWeight = 5; // Fixed weight for related questions
                        totalMaxWeight += relatedWeight;
                        // Reconstruct ID for related question: blockId_related
                        if (userAnswers[block.id + "_related"] === block.metadata.relatedQuestion.correctAnswer) {
                            totalWeightedScore += relatedWeight;
                        }
                    }
                });
            });
        });

        if (totalMaxWeight === 0) return 0; // No score applicable
        return Math.round((totalWeightedScore / totalMaxWeight) * 100);
    };

    const handleSubmit = async () => {
        if (!assignment || !studentName) return;

        if (!window.confirm("האם אתה בטוח שברצונך להגיש את המשימה? לא ניתן לשנות תשובות לאחר ההגשה.")) return;

        setIsSubmitting(true);
        try {
            const finalScore = calculateScore();
            await submitAssignment({
                assignmentId: assignment.id || 'unknown', // Fallback if ID extracted from URL param outside
                courseId: course.id,
                studentName: studentName,
                answers: userAnswers,
                score: finalScore
            });
            setIsSubmitted(true);
        } catch (e) {
            alert("אירעה שגיאה בהגשה. נא לנסות שוב.");
            console.error(e);
            setIsSubmitting(false);
        }
    };

    const handleContinueClick = async () => {
        if (reviewMode) {
            if (onExitReview) onExitReview();
            return;
        }
        goToNextUnit();
    };

    // --- פונקציית עזר לרינדור שאלות מוצמדות ---
    const renderRelatedQuestion = (parentId: string, relatedQ: any) => {
        if (!relatedQ || !relatedQ.question) return null;

        const relatedId = parentId + "_related";
        const isSelected = userAnswers[relatedId];
        const showFeedback = reviewMode || (feedbackVisible[relatedId] && !isExamMode);

        return (
            <div className="mt-4 pt-4 border-t border-gray-100 bg-blue-50/50 p-4 rounded-xl">
                <div className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wide">שאלה קשורה</div>
                <h4 className="font-bold text-gray-800 mb-3 text-sm">{relatedQ.question}</h4>

                {relatedQ.type === 'multiple-choice' && (
                    <div className="space-y-2">
                        {relatedQ.options?.map((opt: any, i: number) => {
                            const optText = getOptionText(opt);
                            let btnClass = "w-full text-right p-2.5 rounded-lg border text-sm transition-all ";
                            if (showFeedback) {
                                if (optText === relatedQ.correctAnswer) btnClass += "bg-green-50 border-green-400 text-green-800 font-bold";
                                else if (isSelected === optText) btnClass += "bg-red-50 border-red-300 text-red-800";
                                else btnClass += "opacity-50 border-transparent bg-gray-50";
                            } else {
                                btnClass += isSelected === optText ? "border-blue-500 bg-white shadow-sm ring-1 ring-blue-200" : "border-gray-200 bg-white hover:bg-gray-50";
                            }
                            return (
                                <button key={i} onClick={() => handleAnswerSelect(relatedId, optText)} className={btnClass} disabled={!!showFeedback}>
                                    <div className="flex justify-between items-center">
                                        <span>{optText}</span>
                                        {showFeedback && optText === relatedQ.correctAnswer && <IconCheck className="w-4 h-4 text-green-600" />}
                                        {showFeedback && isSelected === optText && optText !== relatedQ.correctAnswer && <IconX className="w-4 h-4 text-red-600" />}
                                    </div>
                                </button>
                            );
                        })}
                        {!isExamMode && !showFeedback && !reviewMode && (
                            <button onClick={() => checkAnswer(relatedId)} className="mt-2 text-xs text-blue-600 font-bold hover:underline">בדוק תשובה</button>
                        )}
                    </div>
                )}

                {relatedQ.type === 'open-question' && (
                    <textarea
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none bg-white"
                        value={userAnswers[relatedId] || ''}
                        onChange={(e) => handleAnswerSelect(relatedId, e.target.value)}
                        readOnly={reviewMode}
                        placeholder={reviewMode ? "התלמיד לא ענה" : "כתוב את תשובתך כאן..."}
                        rows={2}
                    />
                )}
            </div>
        );
    };

    const isVideoEmbed = (url: string) => url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo') || url.includes('/embed/');

    const renderMediaElement = (src: string) => {
        if (isVideoEmbed(src)) {
            return <iframe src={src} className="w-full h-48 md:h-64 bg-black" title="Video" allowFullScreen />;
        }
        return <video src={src} controls className="w-full h-48 md:h-64 bg-black" />;
    };

    const renderBlock = (block: ActivityBlock) => {
        // --- חילוץ בטוח של כתובת המדיה ---
        const getMediaSrc = () => {
            if (block.content && typeof block.content === 'string' && block.content.startsWith('http')) return block.content;
            if (block.metadata?.uploadedFileUrl) return block.metadata.uploadedFileUrl;
            if (block.metadata?.media) return block.metadata.media;
            return null;
        };

        const mediaSrc = getMediaSrc();

        switch (block.type) {
            case 'text': return (
                <div key={block.id} className="prose max-w-none text-gray-800 mb-8 glass bg-white/70 p-6 rounded-2xl">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {block.content}
                    </ReactMarkdown>
                </div>
            );

            case 'image':
                if (!mediaSrc) return null;
                return (
                    <div key={block.id} className="mb-8 p-1 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        <img src={mediaSrc} className="w-full rounded-xl" alt="תוכן שיעור" />
                        {block.metadata?.caption && (
                            <div className="text-center text-sm text-gray-500 mt-2 pb-2 italic font-medium px-4">{block.metadata.caption}</div>
                        )}
                        {block.metadata?.relatedQuestion && renderRelatedQuestion(block.id, block.metadata.relatedQuestion)}
                    </div>
                );

            case 'video':
                if (!mediaSrc) return null;
                return (
                    <div key={block.id} className="mb-8 p-1 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        <div className="aspect-video bg-black rounded-xl overflow-hidden">
                            {renderMediaElement(mediaSrc)}
                        </div>
                        {block.metadata?.caption && (
                            <div className="text-center text-sm text-gray-500 mt-2 pb-2 italic font-medium px-4">{block.metadata.caption}</div>
                        )}
                        {block.metadata?.relatedQuestion && renderRelatedQuestion(block.id, block.metadata.relatedQuestion)}
                    </div>
                );

            case 'interactive-chat': return <InteractiveChatBlock key={block.id} block={block} context={{ unitTitle: activeUnit?.title || "", unitContent: "" }} forcedHistory={reviewMode ? studentData?.chatHistory : undefined} readOnly={reviewMode} />;

            case 'multiple-choice':
                const isSelected = userAnswers[block.id];
                const showFeedback = reviewMode || (feedbackVisible[block.id] && !isExamMode);

                const qMedia = getMediaSrc();

                return (
                    <div key={block.id} className="mb-8 glass bg-white/80 p-6 rounded-2xl border border-white/50 shadow-sm">
                        <h3 className="text-xl font-bold mb-4">{block.content.question}</h3>

                        {qMedia && (
                            <div className="mb-4 rounded-xl overflow-hidden">
                                {block.metadata?.mediaType === 'video' ?
                                    renderMediaElement(qMedia) :
                                    <img src={qMedia} alt="מדיה לשאלה" className="w-full h-48 object-cover" />
                                }
                            </div>
                        )}

                        <div className="space-y-3">
                            {block.content.options?.map((opt: any, i: number) => {
                                const optText = getOptionText(opt);
                                let btnClass = "w-full text-right p-4 rounded-xl border transition-all ";
                                if (showFeedback) {
                                    if (optText === block.content.correctAnswer) btnClass += "bg-green-50 border-green-500 text-green-900";
                                    else if (isSelected === optText) btnClass += "bg-red-50 border-red-300 text-red-900";
                                    else btnClass += "opacity-50";
                                } else {
                                    btnClass += isSelected === optText ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200" : "border-gray-200 hover:bg-gray-50";
                                }
                                return (
                                    <button key={i} onClick={() => handleAnswerSelect(block.id, optText)} className={btnClass} disabled={!!showFeedback}>
                                        <div className="flex justify-between items-center">
                                            <span>{optText}</span>
                                            {showFeedback && optText === block.content.correctAnswer && <IconCheck className="w-5 h-5 text-green-600" />}
                                            {showFeedback && isSelected === optText && optText !== block.content.correctAnswer && <IconX className="w-5 h-5 text-red-600" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {!isExamMode && !showFeedback && !reviewMode && <button onClick={() => checkAnswer(block.id)} className="mt-4 text-blue-600 font-bold text-sm">בדיקה</button>}

                        {/* Display Text-Back Feedback */}
                        {showFeedback && (
                            <div className={"mt-4 p-4 rounded-xl border animate-fade-in " + (userAnswers[block.id] === block.content.correctAnswer ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                                {userAnswers[block.id] === block.content.correctAnswer ? (
                                    <div className="text-green-800 font-bold flex items-center gap-2">
                                        <IconCheck className="w-5 h-5" />
                                        {block.metadata?.feedbackCorrect || "תשובה נכונה! כל הכבוד."}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="text-red-800 font-bold flex items-center gap-2">
                                            <IconX className="w-5 h-5" />
                                            {(() => {
                                                const richOptions = block.metadata?.richOptions;
                                                if (richOptions && Array.isArray(richOptions)) {
                                                    const selectedOpt = richOptions.find((o: any) => o.text === userAnswers[block.id]);
                                                    if (selectedOpt && selectedOpt.feedback) {
                                                        return selectedOpt.feedback;
                                                    }
                                                }
                                                return block.metadata?.feedbackIncorrect || "תשובה לא נכונה, נסו שוב.";
                                            })()}
                                        </div>
                                        {block.metadata?.sourceHint && (
                                            <div className="text-sm text-blue-900 bg-blue-100/50 p-3 rounded-lg border-r-4 border-blue-500 mt-2">
                                                <div className="font-bold flex items-center gap-1 mb-1">
                                                    <IconBook className="w-4 h-4" /> רמז מהטקסט:
                                                </div>
                                                {block.metadata.sourceHint}
                                            </div>
                                        )}
                                        {/* Retry Button for Learning Mode */}
                                        {!isExamMode && !reviewMode && (
                                            <button
                                                onClick={() => setFeedbackVisible(prev => ({ ...prev, [block.id]: false }))}
                                                className="flex items-center gap-2 text-red-600 bg-white border border-red-200 px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-red-50 transition-all mt-2"
                                            >
                                                <IconArrowBack className="w-4 h-4" /> אל תתייאש, נסה שוב!
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Progressive Hints Section (Only for Learning Mode AND After Mistake) */}
                        {!isExamMode && !reviewMode && block.metadata?.progressiveHints && block.metadata.progressiveHints.length > 0 && (
                            // Show if feedback is visible (user just checked) OR if they have made a mistake previously
                            (showFeedback || (blockMistakes[block.id] || 0) > 0) && (
                                <div className="mt-4">
                                    <button
                                        onClick={() => handleShowHint(block.id)}
                                        className="text-amber-600 text-sm font-bold flex items-center gap-1 hover:bg-amber-50 px-3 py-1.5 rounded-full transition-colors border border-amber-200"
                                    >
                                        <IconSparkles className="w-4 h-4" />
                                        {hintsVisible[block.id] ?
                                            (hintsVisible[block.id]! < block.metadata.progressiveHints.length ? 'רמז נוסף' : 'כל הרמזים מוצגים')
                                            : 'צריך עזרה?'}
                                    </button>

                                    {hintsVisible[block.id] && (
                                        <div className="mt-3 space-y-2 animate-fade-in">
                                            {block.metadata.progressiveHints.slice(0, hintsVisible[block.id]).map((hint: string, idx: number) => (
                                                <div key={idx} className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 text-sm shadow-sm flex gap-3">
                                                    <span className="font-bold bg-amber-200 text-amber-800 w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">{idx + 1}</span>
                                                    <span>{hint}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                );
            case 'open-question':
                return (
                    <div key={block.id} className="mb-8 glass bg-indigo-50/50 p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <IconEdit className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">שאלה פתוחה</h3>
                        </div>

                        <div className="mb-4 text-lg font-medium text-gray-700 leading-relaxed">
                            {block.content.question}
                        </div>

                        {getMediaSrc() && (
                            <div className="mb-4 rounded-xl overflow-hidden">
                                {block.metadata?.mediaType === 'video' ?
                                    renderMediaElement(getMediaSrc()!) :
                                    <img src={getMediaSrc()!} alt="מדיה לשאלה" className="w-full h-48 object-cover" />
                                }
                            </div>
                        )}

                        <textarea
                            value={userAnswers[block.id] || ''}
                            onChange={(e) => handleAnswerSelect(block.id, e.target.value)}
                            placeholder={reviewMode ? "התלמיד לא ענה" : "כתבו את התשובה כאן..."}
                            rows={4}
                            className={"w-full p-4 border rounded-xl outline-none transition-colors " + (reviewMode || feedbackVisible[block.id] ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-white focus:border-indigo-300')}
                            disabled={reviewMode || feedbackVisible[block.id]}
                        />

                        {/* Student Self-Check Button */}
                        {!isExamMode && !reviewMode && (
                            <div className="mt-4">
                                {!feedbackVisible[block.id] ? (
                                    <button
                                        onClick={() => checkAnswer(block.id)}
                                        disabled={checkingOpenId === block.id}
                                        className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-2"
                                    >
                                        {checkingOpenId === block.id ? <><IconLoader className="w-4 h-4 animate-spin" /> בודק...</> : 'בדוק תשובה'}
                                    </button>
                                ) : (
                                    <div className={"p-4 rounded-xl animate-fade-in border " + (
                                        openQuestionFeedback[block.id]?.status === 'correct' ? 'bg-green-50 border-green-200' :
                                            openQuestionFeedback[block.id]?.status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
                                                'bg-red-50 border-red-200'
                                    )}>
                                        <div className={"text-xs font-bold mb-1 flex items-center gap-1 " + (
                                            openQuestionFeedback[block.id]?.status === 'correct' ? 'text-green-700' :
                                                openQuestionFeedback[block.id]?.status === 'partial' ? 'text-yellow-700' :
                                                    'text-red-700'
                                        )}>
                                            <IconRobot className="w-4 h-4" />
                                            {openQuestionFeedback[block.id]?.status === 'correct' ? 'משוב מעולה!' :
                                                openQuestionFeedback[block.id]?.status === 'partial' ? 'בכיוון הנכון...' :
                                                    'שים לב...'}
                                        </div>
                                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                            {openQuestionFeedback[block.id]?.feedback || "תשובה נקלטה."}
                                        </div>

                                        {/* Allow retry if not correct */}
                                        {openQuestionFeedback[block.id]?.status !== 'correct' && (
                                            <button
                                                onClick={() => setFeedbackVisible(prev => ({ ...prev, [block.id]: false }))}
                                                className="mt-3 text-xs font-bold underline opacity-70 hover:opacity-100"
                                            >
                                                נסה לתקן את התשובה
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* הצגת המחוון למורה במצב צפייה */}
                        {reviewMode && block.metadata?.modelAnswer && (
                            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                <div className="text-xs font-bold text-yellow-700 mb-1 flex items-center gap-1">
                                    <IconInfo className="w-3 h-3" /> הנחיות למורה / תשובה מצופה:
                                </div>
                                <div className="text-sm text-yellow-900 leading-relaxed whitespace-pre-wrap">{block.metadata.modelAnswer}</div>
                            </div>
                        )}
                    </div>
                );
            case 'fill_in_blanks':
                const fibMedia = getMediaSrc();
                return (
                    <div key={block.id} className="mb-8">
                        {fibMedia && (
                            <div className="mb-4 rounded-xl overflow-hidden max-w-xl mx-auto">
                                {block.metadata?.mediaType === 'video' ?
                                    renderMediaElement(fibMedia) :
                                    <img src={fibMedia} alt="מדיה לשאלה" className="w-full h-48 object-cover" />
                                }
                            </div>
                        )}
                        <ClozeQuestion block={block} onComplete={(score) => handleGameComplete(block.id, score)} />
                    </div>
                );
            case 'ordering':
                const ordMedia = getMediaSrc();
                return (
                    <div key={block.id} className="mb-8">
                        {ordMedia && (
                            <div className="mb-4 rounded-xl overflow-hidden max-w-xl mx-auto">
                                {block.metadata?.mediaType === 'video' ?
                                    renderMediaElement(ordMedia) :
                                    <img src={ordMedia} alt="מדיה לשאלה" className="w-full h-48 object-cover" />
                                }
                            </div>
                        )}
                        <OrderingQuestion block={block} onComplete={(score) => handleGameComplete(block.id, score)} />
                    </div>
                );
            case 'categorization':
                const catMedia = getMediaSrc();
                return (
                    <div key={block.id} className="mb-8">
                        {catMedia && (
                            <div className="mb-4 rounded-xl overflow-hidden max-w-2xl mx-auto">
                                {block.metadata?.mediaType === 'video' ?
                                    renderMediaElement(catMedia) :
                                    <img src={catMedia} alt="מדיה לשאלה" className="w-full h-48 object-cover" />
                                }
                            </div>
                        )}
                        <CategorizationQuestion block={block} onComplete={(score) => handleGameComplete(block.id, score)} />
                    </div>
                );
            case 'memory_game':
                const memMedia = getMediaSrc();
                return (
                    <div key={block.id} className="mb-8">
                        {memMedia && (
                            <div className="mb-4 rounded-xl overflow-hidden max-w-3xl mx-auto">
                                {block.metadata?.mediaType === 'video' ?
                                    renderMediaElement(memMedia) :
                                    <img src={memMedia} alt="מדיה לשאלה" className="w-full h-48 object-cover" />
                                }
                            </div>
                        )}
                        <MemoryGameQuestion block={block} onComplete={(score) => handleGameComplete(block.id, score)} />
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="min-h-full bg-gray-50 flex flex-col items-center">
            {reviewMode && studentData && !hideReviewHeader && (
                <div className="sticky top-0 w-full h-10 bg-yellow-400 text-yellow-900 font-bold text-center flex items-center justify-center z-[60] shadow-md">
                    <IconEye className="w-5 h-5 ml-2" /> מצב סקירה: {studentData.studentName}
                    <button onClick={onExitReview} className="mr-4 bg-white/30 px-3 py-0.5 rounded text-sm hover:bg-white/50">יציאה</button>
                </div>
            )}



            {/* --- Assignment Header --- */}
            {assignment && (
                <div className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-lg sticky top-0 z-[50] animate-slide-down mb-6">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold border border-white/20">משימה להגשה</span>
                                <h2 className="font-bold text-lg">{assignment.title || "ללא שם"}</h2>
                            </div>
                            {assignment.instructions && (
                                <div className="text-sm text-blue-100 flex items-center gap-1 opacity-90 mt-1">
                                    <IconInfo className="w-3 h-3" /> {assignment.instructions}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                            <div className="text-center">
                                <span className="text-xs text-blue-200 block">מועד הגשה</span>
                                <div className="font-bold flex items-center gap-1">
                                    <IconCalendar className="w-4 h-4" />
                                    {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('he-IL') : '-'}
                                </div>
                            </div>
                            <div className="w-px h-8 bg-white/20"></div>
                            <div className="text-center">
                                <span className="text-xs text-blue-200 block">שעה</span>
                                <div className="font-bold flex items-center gap-1">
                                    <IconClock className="w-4 h-4" />
                                    {assignment.dueDate ? new Date(assignment.dueDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Source Text Toggle --- */}
            {/* Show button only if enabled AND content exists */}
            {course.showSourceToStudent && (course.fullBookContent || course.pdfSource) && (
                <div className="fixed left-4 bottom-4 z-50">
                    <button
                        onClick={() => setShowSplitView(!showSplitView)}
                        className={"shadow-xl flex items-center gap-2 px-5 py-3 rounded-full font-bold transition-all transform hover:scale-105 " + (showSplitView ? 'bg-gray-800 text-white' : 'bg-blue-600 text-white')}
                    >
                        <IconBook className="w-5 h-5" />
                        {showSplitView ? 'סגור טקסט מקור' : 'הצג טקסט מקור'}
                    </button>
                </div>
            )}

            <div className={"flex-1 w-full max-w-7xl mx-auto p-4 transition-all duration-500 " + (showSplitView ? 'flex gap-6 items-start' : '')}>

                {/* --- Split View Side Panel (Source Text) --- */}
                {showSplitView && (
                    <div className="w-1/2 h-[85vh] sticky top-24 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col animate-slide-in-left">
                        <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><IconBook className="w-5 h-5 text-blue-500" /> טקסט המקור</h3>
                            <button onClick={() => setShowSplitView(false)} className="text-gray-400 hover:text-gray-600"><IconX className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-gray-50 h-full relative">
                            {course.pdfSource ? (
                                <iframe
                                    src={course.pdfSource}
                                    className="w-full h-full absolute inset-0 border-none"
                                    title="מסמך מקור"
                                />
                            ) : (
                                <div className="p-6 prose max-w-none text-sm leading-relaxed">
                                    {course.fullBookContent ? (
                                        <div className="whitespace-pre-wrap font-serif text-gray-800">{course.fullBookContent}</div>
                                    ) : (
                                        <div className="text-center text-gray-500 mt-10">
                                            <p className="font-bold">לא נמצא טקסט מקור.</p>
                                            <p className="text-sm">ייתכן שהמסמך לא עובד כראוי או שלא הועלה תוכן.</p>
                                            <p className="text-xs text-gray-400 mt-2">ID: {course.id}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- Main Content Area --- */}
                <main className={"transition-all duration-500 " + (showSplitView ? "w-1/2" : "w-full max-w-3xl mx-auto") + " " + (showSplitView ? "" : "p-6 md:p-10") + " pb-48"}>
                    {activeUnit ? (
                        <>
                            <header className="mb-8 text-center">
                                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{activeUnit.title}</h1>
                                {activeModule && <div className="text-sm text-gray-500 font-medium">{activeModule.title}</div>}

                                <div className="flex justify-center gap-2 mt-3">
                                    <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">
                                        {displayGrade}
                                    </span>
                                    {course.subject && (
                                        <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">
                                            {course.subject}
                                        </span>
                                    )}
                                </div>
                            </header>

                            <div className="space-y-6">
                                {activeUnit.activityBlocks?.map(renderBlock)}
                            </div>

                            <div className="mt-16 flex justify-center">
                                <button
                                    onClick={handleContinueClick}
                                    className="bg-blue-600 text-white px-10 py-3.5 rounded-full font-bold shadow-xl hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-3 text-lg"
                                >
                                    {reviewMode ? 'סגור תצוגה' : (
                                        (() => {
                                            const isLastUnit = activeModuleId === course.syllabus[course.syllabus.length - 1].id &&
                                                activeUnitId === activeModule?.learningUnits[activeModule.learningUnits.length - 1].id;

                                            return isLastUnit ? (
                                                <>
                                                    הגשה <IconCheck className="w-5 h-5" />
                                                </>
                                            ) : (
                                                <>
                                                    הבא <IconArrowBack className="w-5 h-5" />
                                                </>
                                            );
                                        })()
                                    )}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center mt-20">
                            {/* מצב סיום קורס / יחידה אחרונה */}
                            <div className="bg-white p-8 rounded-3xl shadow-lg inline-block">
                                <h2 className="text-2xl font-bold mb-4">סיימת את כל היחידות! 🎉</h2>
                                <p className="text-gray-600 mb-8">כל הכבוד על ההשקעה.</p>

                                {assignment ? (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="bg-green-600 text-white px-12 py-4 rounded-full font-bold shadow-xl hover:bg-green-700 text-xl flex items-center gap-3 transition-transform hover:scale-105 mx-auto"
                                    >
                                        {isSubmitting ? 'שולח...' : 'הגש משימה לבדיקה'}
                                        {!isSubmitting && <IconCheck className="w-6 h-6" />}
                                    </button>
                                ) : (
                                    <p className="text-sm text-gray-400">(מצב תצוגה מקדימה - ללא הגשה)</p>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default CoursePlayer;