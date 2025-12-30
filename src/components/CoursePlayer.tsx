
import React, { useState, useEffect, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import { useAuth } from '../context/AuthContext';
import type { ActivityBlock, Assignment } from '../courseTypes';
import {
    IconArrowBack, IconRobot, IconEye, IconCheck, IconX, IconCalendar, IconClock, IconInfo, IconBook, IconEdit, IconSparkles, IconLoader, IconHeadphones, IconMicrophone
} from '../icons';
import { submitAssignment } from '../services/submissionService';
import { openai, MODEL_NAME, checkOpenQuestionAnswer, transcribeAudio } from '../gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ClozeQuestion from './ClozeQuestion';
import OrderingQuestion from './OrderingQuestion';
import CategorizationQuestion from './CategorizationQuestion';
import MemoryGameQuestion from './MemoryGameQuestion';
import { SCORING_CONFIG, calculateQuestionScore, type AnswerAttempt, OPEN_QUESTION_SCORES } from '../utils/scoring';
import { CitationService } from '../services/citationService'; // GROUNDED QA
// import { SourceViewer } from './SourceViewer'; // NOTEBOOKLM GUIDE (Removed unused import)

import QuizBlock from './QuizBlock';
import type { TelemetryData } from '../courseTypes';
import InspectorDashboard from './InspectorDashboard'; // Wizdi-Monitor
import InspectorBadge from './InspectorBadge'; // Wizdi-Monitor
import { AudioRecorderBlock } from './AudioRecorderBlock';

// Helper to safely extract text from option (string or object)
const getAnswerText = (val: any): string => {
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val?.answer) return val.answer;
    return '';
};


// --- הגדרות טיפוסים למצב סקירה ---
interface StudentReviewData {
    studentName: string;
    answers: Record<string, any>;
    chatHistory?: { role: string, parts: string }[];
}

interface CoursePlayerProps {
    assignment?: Assignment;
    reviewMode?: boolean;
    studentData?: StudentReviewData;
    onExitReview?: () => void;
    forcedUnitId?: string;
    unitOverride?: any; // Allow passing unit object directly (for fast preview)
    hideReviewHeader?: boolean;
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
            const promptRole = block.metadata?.systemPrompt || "מורה עוזר";

            // 1. Chunk the text
            const chunks = CitationService.chunkText(context.unitContent);
            const groundedSystemPrompt = CitationService.constructSystemPrompt(chunks, promptRole);

            const promptTopic = "הנושא: " + '"' + context.unitTitle + '"' + ".";
            // const promptContent = ... (Replaced by Grounded Prompt)

            const systemInstruction = [promptIntro, groundedSystemPrompt, promptTopic].join("\n");

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
                    <h3 className="font-bold text-lg">
                        {block.type === 'interactive-chat' ? block.content.title || 'צ׳אט אינטראקטיבי' : 'צ׳אט אינטראקטיבי'}
                    </h3>
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
                                <div className="prose prose-sm max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 text-inherit">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            // Custom renderer for detecting [1], [2], etc.
                                            // Since we can't easily hook into "text" nodes with generic regex in ReactMarkdown without a plugin,
                                            // we will assume the model outputs them as text.
                                            // A stricter way is to use `remark-rehype` or a custom plugin.
                                            // For MVP, if the model outputs links like [[1]](citation:1), it's easier. 
                                            // But NotebookLM outputs plain text `[1]`.
                                            // Let's try to match text nodes. 
                                            // Actually, simplest allowed "Grounded" format is to ask AI to output `[1](citation:1)` Markdown links?
                                            // No, simpler: Just parse the text before rendering?
                                            // Let's use a simple text replacement for now or assume standard text.
                                            // WAITING: For this step, I will just render standard markdown. 
                                            // To make it clickable, I need a custom plugin or pre-processing.
                                            // Strategy: Pre-process the message text to turn `[1]` into `[[1]](#cit-1)`.
                                            a: ({ node, href, children, ...props }) => {
                                                if (href?.startsWith('#cit-')) {
                                                    const id = href.replace('#cit-', '');
                                                    return (
                                                        <button
                                                            onClick={() => {
                                                                // Logic to open split view and scroll
                                                                const element = document.getElementById(`chunk-${id}`);
                                                                if (element) {
                                                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    element.classList.add('bg-yellow-200'); // Highlight
                                                                    setTimeout(() => element.classList.remove('bg-yellow-200'), 2000);
                                                                } else {
                                                                    // If Split View is closed, we need to alert parent to open it?
                                                                    // For now, just console (or improved UX later)
                                                                    console.log("Jump to citation:", id);
                                                                }
                                                            }}
                                                            className="inline-flex items-center justify-center w-5 h-5 ml-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 hover:scale-110 transition-all align-middle"
                                                        >
                                                            {children}
                                                        </button>
                                                    );
                                                }
                                                return <a href={href} {...props}>{children}</a>;
                                            }
                                        }}
                                    >
                                        {/* Pre-process text to convert [1] to link syntax for the renderer to catch */}
                                        {msg.text.replace(/\[(\d+)\]/g, '[$1](#cit-$1)')}
                                    </ReactMarkdown>
                                </div>
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



// --- הקומפוננטה הראשית ---
const CoursePlayer: React.FC<CoursePlayerProps> = ({ assignment, reviewMode = false, studentData, onExitReview, forcedUnitId, unitOverride, hideReviewHeader = false }) => {
    const { course } = useCourseStore();

    const { currentUser } = useAuth(); // Get current user for name auto-fill

    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [activeUnitId, setActiveUnitId] = useState<string | null>(forcedUnitId || null);
    const [initialLoadDone, setInitialLoadDone] = useState(false);

    // Initialize userAnswers safely. If assignment has activeSubmission, use it.
    // IF we have a new assignment, we update.
    const [userAnswers, setUserAnswers] = useState<Record<string, any>>(() => {
        return assignment?.activeSubmission?.answers || {};
    });

    // Telemetry State
    const [telemetry, setTelemetry] = useState<Record<string, TelemetryData>>({});

    // Scoring State: Tracks detailed attempts and scores per block
    const [gradingState, setGradingState] = useState<Record<string, AnswerAttempt & { score: number }>>({});

    // We only update userAnswers from props if a DIFFERENT assignment is loaded, 
    // NOT when the SAME assignment updates its status.
    const lastAssignmentIdRef = useRef(assignment?.id);
    useEffect(() => {
        if (assignment?.id && assignment.id !== lastAssignmentIdRef.current) {
            setUserAnswers(assignment?.activeSubmission?.answers || {});
            lastAssignmentIdRef.current = assignment.id;
        }
    }, [assignment?.id]);

    // Hydrate Grading State from User Answers (for resuming sessions)
    // We assume 1 attempt / 0 hints for loaded answers where we don't have history
    useEffect(() => {
        if (!course || !userAnswers || Object.keys(gradingState).length > 0) return;

        const initialGrading: Record<string, AnswerAttempt & { score: number }> = {};
        let hasUpdates = false;

        course.syllabus.forEach(module => {
            module.learningUnits.forEach(unit => {
                unit.activityBlocks?.forEach(block => {
                    const ans = userAnswers[block.id];
                    if (ans !== undefined && ans !== null && ans !== '') {
                        // Default assumptions
                        let isCorrect = false;
                        let score = 0;
                        const isMultipleChoice = ['multiple-choice', 'cloze', 'ordering', 'categorization'].includes(block.type);

                        if (block.type === 'open-question') {
                            // Check for persisted score
                            if (typeof ans === 'object' && ans.provisional_score !== undefined) {
                                score = ans.provisional_score;
                                isCorrect = score > 0;
                            }
                        } else if (isMultipleChoice) {
                            isCorrect = ans === block.content.correctAnswer;
                            score = isCorrect ? SCORING_CONFIG.CORRECT_FIRST_TRY : 0;
                        }

                        // Only set if we calculated something meaningful or it's an answered block
                        if (score > 0 || isCorrect || ans) {
                            initialGrading[block.id] = {
                                attempts: 1,
                                hintsUsed: 0,
                                isCorrect,
                                responseTimeSec: 0,
                                score
                            };
                            hasUpdates = true;
                        }
                    }
                });
            });
        });

        if (hasUpdates) {
            setGradingState(prev => ({ ...prev, ...initialGrading }));
        }
    }, [course, userAnswers, gradingState]); // careful with deps to avoid loops

    const [feedbackVisible, setFeedbackVisible] = useState<Record<string, boolean>>({});
    const [hintsVisible, setHintsVisible] = useState<Record<string, number>>({}); // number = how many hints shown
    const [blockMistakes, setBlockMistakes] = useState<Record<string, number>>({}); // Track mistakes per block
    const [openQuestionFeedback, setOpenQuestionFeedback] = useState<Record<string, { status: string, feedback: string }>>({}); // Tutor feedback

    const [checkingOpenId, setCheckingOpenId] = useState<string | null>(null); // Loading state for Tutor check

    // Recording State
    const [isRecording, setIsRecording] = useState<string | null>(null); // ID of block currently recording
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);

    // Submission State
    const [studentName, setStudentName] = useState(currentUser?.displayName || '');
    const [isNameConfirmed, setIsNameConfirmed] = useState(!!currentUser?.displayName); // Auto-confirm if name exists
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // --- Submitted State Persistence (Fix for Remount Issue) ---
    useEffect(() => {
        if (!assignment?.id) return;
        const key = `wizdi_submitted_${assignment.id}`;

        // 1. Restore from storage on mount
        const savedState = sessionStorage.getItem(key);

        if (savedState) {
            try {
                const { submitted, score, name } = JSON.parse(savedState);
                if (submitted) {
                    setIsSubmitted(true);
                }
            } catch (e) { console.error("Storage parse error", e); }
        }
    }, [assignment?.id]);

    useEffect(() => {
        if (isSubmitted && assignment?.id) {
            const key = `wizdi_submitted_${assignment.id}`;
            sessionStorage.setItem(key, JSON.stringify({
                submitted: true,
                score: calculateScore(),
                name: studentName,
                timestamp: Date.now()
            }));
        }
    }, [isSubmitted, assignment?.id]); // Update storage when state changes

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

    // Inspector Mode (Wizdi-Monitor)
    const [inspectorMode, setInspectorMode] = useState(false);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('inspector') === 'true') {
            setInspectorMode(true);
        }
    }, []);

    // SET INITIAL UNIT if not set
    useEffect(() => {
        if (!initialLoadDone && !activeUnitId && course?.syllabus?.length > 0) {
            const firstModule = course.syllabus[0];
            if (firstModule && firstModule.learningUnits?.length > 0) {
                setActiveModuleId(firstModule.id);
                setActiveUnitId(firstModule.learningUnits[0].id);
                setInitialLoadDone(true);
            }
        }
    }, [course, activeUnitId, initialLoadDone]);

    // If not an assignment (teacher preview), we don't need name.
    // FIX: If assignment appears (switching from preview to student view), we MUST reset confirmed state.
    useEffect(() => {
        if (!assignment) {
            setIsNameConfirmed(true);
        } else {
            // If we have a logged-in user, use their name
            if (currentUser?.displayName) {
                setStudentName(currentUser.displayName);
                setIsNameConfirmed(true);
            } else {
                setIsNameConfirmed(false);
                setStudentName('');
            }
        }
    }, [assignment?.id, currentUser]); // Depend on ID to reset on new assignment

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    // --- Helper Functions & Logic ---

    // --- Audio Recording Logic ---
    const handleStartRecording = async (blockId: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                setIsRecording(null);
                setRecordingTime(0);
                clearInterval(timerRef.current);

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const existingText = getAnswerText(userAnswers[blockId]);

                // Show loading indicator in text? 
                // Better: Just wait? Or optimistically update?
                // For now, let's block UI or show specific loader.
                // We'll insert a "Transcribing..." placeholder or just wait.

                console.log("Transcribing audio...");
                handleAnswerSelect(blockId, existingText + (existingText ? "\n" : "") + "[מעבד הקלטה...]"); // UX Placeholder

                const text = await transcribeAudio(audioBlob);

                // Remove placeholder and append text
                const current = userAnswers[blockId] || "";
                handleAnswerSelect(blockId, (prev: string) => {
                    // remove placeholder
                    const clean = prev.replace("\n[מעבד הקלטה...]", "").replace("[מעבד הקלטה...]", "");
                    if (text) return clean + (clean ? " " : "") + text;
                    return clean;
                });

                if (!text) alert("התמלול נכשל. אנא נסה שוב.");
            };

            mediaRecorderRef.current.start();
            setIsRecording(blockId);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 60) {
                        handleStopRecording(); // Auto stop
                        return 60;
                    }
                    return prev + 1;
                });
            }, 1000);

        } catch (e) {
            console.error("Mic Error:", e);
            alert("לא ניתן לגשת למיקרופון. אנא ודא שיש אישור.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const isExamMode = course?.mode === 'exam';

    const handleAnswerSelect = (questionId: string, answer: any) => {
        if (isSubmitted && isExamMode) return; // Prevent changes after submission in exam mode
        // In learning mode or before submission, allow changes
        if (typeof answer === 'function') {
            // Support functional updates for stale state handling (recording)
            setUserAnswers(prev => ({ ...prev, [questionId]: answer(prev[questionId] || '') }));
        } else {
            setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
        }
    };

    const handleTelemetryUpdate = (blockId: string, answer: any, data: TelemetryData) => {
        // Update local selection (for UI)
        handleAnswerSelect(blockId, answer);

        // Update Telemetry
        setTelemetry(prev => ({
            ...prev,
            [blockId]: data
        }));
    };

    const checkAnswer = async (blockId: string) => {
        // Find the block to check correctness
        const block = activeUnit?.activityBlocks?.find((b: ActivityBlock) => b.id === blockId);
        if (!block) return;

        // Increment attempts
        // If we already have a grading state, use it, otherwise init
        // BUT: simple increment here might double count if we click check multiple times?
        // Usually "Check Answer" is disabled after success.

        const currentGrading = gradingState[blockId] || { attempts: 0, hintsUsed: 0, isCorrect: false, responseTimeSec: 0, score: 0 };
        const newAttempts = currentGrading.attempts + 1;
        const hintsUsed = hintsVisible[blockId] || 0;

        // --- Handle Open Question (AI Tutor) ---
        if (block.type === 'open-question') {
            const userAnswer = userAnswers[blockId];
            if (!userAnswer || (typeof userAnswer === 'string' && userAnswer.trim().length < 2)) {
                alert("אנא כתוב תשובה מלאה לפני הבדיקה.");
                return;
            }

            setCheckingOpenId(blockId);
            try {
                // Use Source Text if available (Global context) or fallback
                const context = course?.fullBookContent || "";

                // If userAnswers is object, extract text
                const textAnswer = typeof userAnswer === 'object' ? userAnswer.answer : userAnswer;

                const feedback = await checkOpenQuestionAnswer(
                    block.content.question,
                    textAnswer,
                    block.metadata?.modelAnswer || "TBD",
                    context,
                    isExamMode ? 'exam' : 'learning'
                );

                setOpenQuestionFeedback(prev => ({ ...prev, [blockId]: feedback }));
                setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));

                // Calibrate Score
                let numericScore = OPEN_QUESTION_SCORES.INCORRECT;
                if (feedback.status === 'correct') numericScore = OPEN_QUESTION_SCORES.CORRECT;
                if (feedback.status === 'partial') numericScore = OPEN_QUESTION_SCORES.PARTIAL;

                // Update Grading State
                const newGrading: AnswerAttempt & { score: number } = {
                    attempts: newAttempts,
                    hintsUsed: hintsUsed,
                    isCorrect: feedback.status === 'correct',
                    responseTimeSec: 0,
                    score: numericScore
                };
                setGradingState(prev => ({ ...prev, [blockId]: newGrading }));

                // Update UserAnswers with Provisional Score
                // We preserve the answer text but add the score
                handleAnswerSelect(blockId, {
                    answer: textAnswer,
                    provisional_score: numericScore,
                    feedback: feedback // Optional: Store feedback too
                });

            } catch (e) {
                console.error("Tutor check failed", e);
                // Fallback
                setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));
            } finally {
                setCheckingOpenId(null);
            }
            return;
        }

        // --- Standard Logic for Close-Ended Questions ---
        setFeedbackVisible(prev => ({ ...prev, [blockId]: true }));

        const isCorrect = userAnswers[blockId] === block.content.correctAnswer;

        if (!isCorrect) {
            setBlockMistakes(prev => ({ ...prev, [blockId]: (prev[blockId] || 0) + 1 }));
        }

        // Calculate Score using Utility
        const attemptAndScore: AnswerAttempt & { score: number } = {
            attempts: newAttempts,
            hintsUsed: hintsUsed,
            isCorrect: isCorrect,
            responseTimeSec: 0, // Pending implementation
            score: 0 // placeholder
        };

        // If simple calculation matches utility
        attemptAndScore.score = calculateQuestionScore(attemptAndScore);

        setGradingState(prev => ({ ...prev, [blockId]: attemptAndScore }));
    };

    const handleShowHint = (blockId: string) => {
        const newLevel = (hintsVisible[blockId] || 0) + 1;
        setHintsVisible(prev => ({ ...prev, [blockId]: newLevel }));

        // Telemetry Update
        setTelemetry(prev => {
            const currentData = prev[blockId] || { timeSeconds: 0, attempts: 0, hintsUsed: 0, lastAnswer: null, events: [] };
            return {
                ...prev,
                [blockId]: {
                    ...currentData,
                    hintsUsed: newLevel,
                    events: [
                        ...(currentData.events || []),
                        { event: 'HINT_REVEALED', level: newLevel, timestamp: Date.now() }
                    ]
                }
            };
        });
    };

    const calculateScore = () => {
        if (!course) return 0;
        let totalQuestions = 0;
        let totalScoreObtained = 0;

        course.syllabus.forEach(module => {
            module.learningUnits.forEach(unit => {
                unit.activityBlocks?.forEach(block => {
                    // Identify Scorable Blocks
                    const isScorable = ['multiple-choice', 'cloze', 'ordering', 'categorization', 'open-question', 'memory_game'].includes(block.type) || block.metadata?.relatedQuestion;

                    if (isScorable) {
                        totalQuestions++;

                        // Get Score from Grading State
                        const grade = gradingState[block.id];
                        if (grade) {
                            totalScoreObtained += grade.score;
                        } else {
                            // Fallback for related questions or legacy data NOT in gradingState?
                            // 2. Interactive Questions (Stored as "Score: X" string, X is 0-100)
                            const answer = userAnswers[block.id];
                            if (answer && typeof answer === 'string' && answer.startsWith('Score: ')) {
                                totalScoreObtained += parseInt(answer.replace('Score: ', '')) || 0;
                            } else if (answer && typeof answer === 'object' && typeof answer.score === 'number') {
                                totalScoreObtained += answer.score;
                            }
                        }

                        // Related Question Logic (Simplified)
                        if (block.metadata?.relatedQuestion?.correctAnswer) {
                            // We might need to track this in gradingState too, but for now fallback
                            const relId = block.id + "_related";
                            if (userAnswers[relId] === block.metadata.relatedQuestion.correctAnswer) {
                                // Assume full points? Or 50%? 
                                // Let's assume full points for simplicity unless untracked
                                // Ideally, related questions should be their own blocks or tracked similarly
                                totalQuestions++; // Count as another question
                                const relGrade = gradingState[relId];
                                if (relGrade) totalScoreObtained += relGrade.score;
                                else if (userAnswers[relId] === block.metadata.relatedQuestion.correctAnswer) totalScoreObtained += 100;
                            }
                        }
                    }
                });
            });
        });

        if (totalQuestions === 0) return 100;

        // Normalize: (Obtained / Possible) * 100
        const maxPossible = totalQuestions * 100;
        return Math.round((totalScoreObtained / maxPossible) * 100);
    };

    const goToNextUnit = () => {
        if (!activeModuleId || !activeUnitId || !course) return;

        const currentModuleIndex = course.syllabus.findIndex(m => m.id === activeModuleId);
        const currentModule = course.syllabus[currentModuleIndex];
        const currentUnitIndex = currentModule.learningUnits.findIndex(u => u.id === activeUnitId);

        // Try next unit in same module
        if (currentUnitIndex < currentModule.learningUnits.length - 1) {
            setActiveUnitId(currentModule.learningUnits[currentUnitIndex + 1].id);
            window.scrollTo(0, 0);
            return;
        }

        // Try next module
        if (currentModuleIndex < course.syllabus.length - 1) {
            const nextModule = course.syllabus[currentModuleIndex + 1];
            if (nextModule.learningUnits.length > 0) {
                setActiveModuleId(nextModule.id);
                setActiveUnitId(nextModule.learningUnits[0].id);
                window.scrollTo(0, 0);
                return;
            }
        }

        // End of course
        setActiveUnitId(null);
    };

    const handleGameComplete = (blockId: string, score: number, data?: TelemetryData) => {
        setUserAnswers(prev => ({ ...prev, [blockId]: { score, completed: true } }));
        if (data) {
            setTelemetry(prev => ({ ...prev, [blockId]: data }));
        }
    };

    // Debug Unmount
    useEffect(() => {
        return () => console.log("⚠️ CoursePlayer Unmounting!");
    }, []);

    const handleSubmit = async (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log("🚀 handleSubmit CLICKED!");
        console.log("Current State:", { assignment, studentName, isNameConfirmed, userAnswers });

        if (!assignment) {
            console.warn("No assignment found - Preview mode?");
            alert("מצב תצוגה מקדימה - לא ניתן להגיש משימה. (המשימה תוצג כ'הוגשה' עבור תלמיד אמת)");
            return;
        }

        // Validation: Verify Name
        if (!studentName || studentName.trim().length === 0) {
            console.warn("Student name missing!", studentName);
            // Should not happen if isNameConfirmed logic is correct, but as a safety net:
            alert("חסר שם תלמיד. אנא רענן את הדף והכנס שם.");
            setIsNameConfirmed(false); // Force name entry
            return;
        }

        // Check for incomplete questions
        let totalQuestions = 0;
        let answeredCount = 0;
        course?.syllabus?.forEach(module => {
            module.learningUnits.forEach(unit => {
                unit.activityBlocks?.forEach(block => {
                    if (['multiple-choice', 'cloze', 'ordering', 'categorization', 'open_question', 'memory_game'].includes(block.type)) {
                        totalQuestions++;
                        if (userAnswers[block.id]) answeredCount++;
                    }
                });
            });
        });

        console.log("📝 Submission Validation:", { totalQuestions, answeredCount });
        const isComplete = answeredCount >= totalQuestions;
        let confirmMsg = "האם אתה בטוח שברצונך להגיש את המשימה?";
        if (!isComplete) {
            confirmMsg = `⚠️ שים לב: ענית רק על ${answeredCount} מתוך ${totalQuestions} שאלות.\n\nהאם אתה בטוח שברצונך להגיש כך?`;
        } else {
            confirmMsg += "\n\nלא ניתן לשנות תשובות לאחר ההגשה.";
        }

        // Use standard confirm, but maybe wrap in timeout to ensure no UI blocking issues
        if (!window.confirm(confirmMsg)) {
            return;
        }

        setIsSubmitting(true);
        try {
            const finalScore = calculateScore();
            console.log("Calculated Score:", finalScore);

            // Verify IDs before sending
            if (!assignment.id || !course.id) {
                throw new Error(`Missing IDs: Asst=${assignment.id}, Course=${course.id}`);
            }

            const result = await submitAssignment({
                assignmentId: assignment.id,
                courseId: course.id,
                studentName: studentName,
                answers: userAnswers,
                score: finalScore,
                courseTopic: course.title, // Pass for AI Analysis
                telemetry: telemetry // Pass Telemetry Data
            });
            console.log("Submission Result:", result);
            setIsSubmitted(true);
        } catch (e) {
            console.error("Submission Failed:", e);
            alert("שגיאה קריטית בהגשה:\n" + (e as any).message);
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

        const showFeedback = reviewMode || (feedbackVisible[relatedId] && !isExamMode);

        return (
            <div className="mt-4 pt-4 border-t border-gray-100 bg-blue-50/50 p-4 rounded-xl">
                <div className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wide">שאלה קשורה</div>
                <h4 className="font-bold text-gray-800 mb-3 text-sm">{relatedQ.question}</h4>

                {relatedQ.type === 'multiple-choice' && (
                    <QuizBlock
                        data={relatedQ}
                        userAnswer={userAnswers[relatedId]}
                        onAnswer={(ans) => handleAnswerSelect(relatedId, ans)}
                        onCheck={() => checkAnswer(relatedId)}
                        showFeedback={showFeedback}
                        isReadOnly={reviewMode || (showFeedback && !isExamMode)}
                        isExamMode={isExamMode}
                        hintsVisibleLevel={hintsVisible[relatedId] || 0}
                    />
                )}

                {relatedQ.type === 'open-question' && (
                    <textarea
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:border-blue-400 outline-none bg-white"
                        value={typeof userAnswers[relatedId] === 'object' ? userAnswers[relatedId].answer : (userAnswers[relatedId] || '')}
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

    const renderProgressiveHints = (block: ActivityBlock) => {
        const hints = block.metadata?.progressiveHints;
        if (!hints || hints.length === 0) return null;
        if (isExamMode || reviewMode) return null;

        const currentLevel = hintsVisible[block.id] || 0;
        const isMaxLevel = currentLevel >= hints.length;

        return (
            <div className="mt-4 flex flex-col items-start gap-2">
                <button
                    onClick={() => handleShowHint(block.id)}
                    disabled={isMaxLevel}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${isMaxLevel
                        ? 'bg-gray-100 text-gray-400 cursor-default'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 shadow-sm'
                        }`}
                >
                    <IconSparkles className="w-4 h-4" />
                    {currentLevel === 0 ? '💡 רמז' : (isMaxLevel ? 'כל הרמזים מוצגים' : 'רמז נוסף')}
                </button>

                {currentLevel > 0 && (
                    <div className="space-y-2 w-full max-w-md animate-fade-in mt-2">
                        {hints.slice(0, currentLevel).map((hint, idx) => (
                            <div key={idx} className="relative bg-amber-50 border border-amber-200 p-3 pr-4 rounded-xl text-amber-900 text-sm shadow-sm flex gap-3 items-start">
                                <span className="font-bold bg-amber-200 text-amber-800 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{idx + 1}</span>
                                <span className="flex-1">{hint}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderBlock = (block: ActivityBlock) => {
        // --- חילוץ בטוח של כתובת המדיה ---
        const getMediaSrc = () => {
            const c = block.content;
            if (typeof c === 'string' && c.startsWith('http')) return c;
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

            case 'podcast':
                return (
                    <div key={block.id} className="mb-8 glass bg-purple-50/50 p-6 rounded-2xl border border-purple-100/60 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                                <IconHeadphones className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{block.content.title || "פודקאסט לסיכום היחידה"}</h3>
                                <div className="text-xs text-purple-600 font-bold">Wizdi Audio Overview 🎧</div>
                            </div>
                        </div>

                        {/* Podcast Player (Mock for now, would be real audio tag) */}
                        <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm mb-4">
                            <div className="flex items-center gap-4">
                                <button className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-purple-700 hover:scale-105 transition-all">
                                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
                                </button>
                                <div className="flex-1">
                                    <div className="h-2 bg-purple-100 rounded-full overflow-hidden cursor-pointer">
                                        <div className="h-full w-1/3 bg-purple-500 rounded-full relative">
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-purple-600 rounded-full shadow-sm"></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                                        <span>02:14</span>
                                        <span>05:30</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Script / Transcript */}
                        {block.content.script && (
                            <div className="bg-white/80 rounded-xl border border-purple-50 p-4 max-h-64 overflow-y-auto custom-scrollbar space-y-3">
                                {block.content.script.map((line: any, idx: number) => (
                                    <div key={idx} className={`flex flex-col ${line.speaker.includes('Host') ? 'items-start' : 'items-end'}`}>
                                        <div className={`p-3 rounded-2xl max-w-[90%] text-sm leading-relaxed ${line.speaker.includes('Host') ? 'bg-purple-50 text-purple-900 rounded-tl-none' : 'bg-indigo-50 text-indigo-900 rounded-tr-none'}`}>
                                            <span className="font-bold text-[10px] block opacity-50 mb-1">{line.speaker}</span>
                                            {line.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'interactive-chat': return <InteractiveChatBlock key={block.id} block={block} context={{ unitTitle: activeUnit?.title || "", unitContent: "" }} forcedHistory={reviewMode ? studentData?.chatHistory : undefined} readOnly={reviewMode} />;

            case 'multiple-choice':
                const mcMedia = getMediaSrc();
                const showFeedback = reviewMode || (feedbackVisible[block.id] && !isExamMode);

                return (
                    <div key={block.id} className="mb-8">
                        {mcMedia && (
                            <div className="mb-4 rounded-xl overflow-hidden max-w-xl mx-auto">
                                {block.metadata?.mediaType === 'video' ?
                                    renderMediaElement(mcMedia) :
                                    <img src={mcMedia} alt="מדיה לשאלה" className="w-full h-48 object-cover" />
                                }
                            </div>
                        )}
                        <QuizBlock
                            data={block.content}
                            userAnswer={userAnswers[block.id]}
                            onAnswer={(ans, tel) => tel && handleTelemetryUpdate(block.id, ans, tel)}
                            onCheck={() => checkAnswer(block.id)}
                            showFeedback={showFeedback}
                            isReadOnly={reviewMode || (showFeedback && !isExamMode)}
                            isExamMode={isExamMode}
                            hints={block.metadata?.progressiveHints}
                            hintsVisibleLevel={hintsVisible[block.id] || 0}
                            onShowHint={() => handleShowHint(block.id)}
                            inspectorMode={inspectorMode}
                        />

                        {inspectorMode && <InspectorBadge block={block} mode={course.mode || 'learning'} />}

                        {/* Progressive Hints Section - Handled internally by QuizBlock now */}
                        {/* renderProgressiveHints(block) - Removed to avoid duplication */}
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

                        <div className="relative">
                            <textarea
                                value={getAnswerText(userAnswers[block.id])}
                                onChange={(e) => handleAnswerSelect(block.id, e.target.value)}
                                placeholder={reviewMode ? "התלמיד לא ענה" : "כתבו את התשובה כאן... (ניתן גם להקליט)"}
                                rows={4}
                                className={"w-full p-4 border rounded-xl outline-none transition-colors " + (reviewMode || feedbackVisible[block.id] ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-white focus:border-indigo-300')}
                                disabled={reviewMode || feedbackVisible[block.id]}
                            />

                            {/* Recording Button */}
                            {!reviewMode && !feedbackVisible[block.id] && (
                                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    {isRecording === block.id ? (
                                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-full animate-pulse">
                                            <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div>
                                            <span className="text-xs font-mono font-bold">{recordingTime}s / 60s</span>
                                            <button onClick={handleStopRecording} className="text-xs font-bold underline hover:text-red-800">סיום</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleStartRecording(block.id)}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                                            title="הקלט תשובה קולית"
                                        >
                                            <IconMicrophone className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Student Self-Check Button */}
                        {
                            !isExamMode && !reviewMode && (
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
                            )
                        }

                        {/* הצגת המחוון למורה במצב צפייה */}
                        {

                            reviewMode && block.metadata?.modelAnswer && (
                                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                    <div className="text-xs font-bold text-yellow-700 mb-1 flex items-center gap-1">
                                        <IconInfo className="w-3 h-3" /> הנחיות למורה / תשובה מצופה:
                                    </div>
                                    <div className="text-sm text-yellow-900 leading-relaxed whitespace-pre-wrap">{block.metadata.modelAnswer}</div>
                                </div>
                            )
                        }

                        {/* Progressive Hints for Open Question */}
                        {renderProgressiveHints(block)}
                    </div>
                );
            case 'fill_in_blanks': {
                const fibMedia = mediaSrc;
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
                        <ClozeQuestion block={block} onComplete={(score, tel) => handleGameComplete(block.id, score, tel)} />
                    </div>
                );
            }
            case 'ordering': {
                const ordMedia = mediaSrc;
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
                        <OrderingQuestion block={block} onComplete={(score, tel) => handleGameComplete(block.id, score, tel)} />
                    </div>
                );
            }
            case 'categorization': {
                const catMedia = mediaSrc;
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
                        <CategorizationQuestion block={block} onComplete={(score, tel) => handleGameComplete(block.id, score, tel)} />
                    </div>
                );
            }
            case 'memory_game':
                const memMedia = mediaSrc;
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
                        <MemoryGameQuestion block={block} onComplete={(score, tel) => handleGameComplete(block.id, score, tel)} />
                    </div>
                );
            case 'audio-response':
                return (
                    <div key={block.id} className="mb-8">
                        <AudioRecorderBlock
                            block={block}
                            onAnswer={(url) => handleAnswerSelect(block.id, url)}
                            userAnswer={userAnswers[block.id]}
                            isReadOnly={isSubmitted}
                        />
                    </div>
                );
            default: return null;
        }
    };

    // --- Computed Values ---
    const activeModule = course?.syllabus?.find(m => m.id === activeModuleId);
    const activeUnit = unitOverride || activeModule?.learningUnits?.find(u => u.id === activeUnitId);
    const displayGrade = assignment?.score ? `ציון: ${assignment.score}` : '';

    if (!course || course.id === 'loading') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
                <IconLoader className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="font-bold text-lg animate-pulse">טוען תוכן קורס...</p>
                <p className="text-sm opacity-70 mt-2">אנא המתן מספר שניות</p>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gray-50 flex flex-col items-center">
            {inspectorMode && activeUnit && (
                <InspectorDashboard blocks={activeUnit.activityBlocks || []} mode={course.mode || 'learning'} />
            )}

            {/* --- Success Screen --- */}
            {isSubmitted && (
                <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center animate-fade-in p-8 text-center">
                    <IconCheck className="w-24 h-24 text-green-500 mb-6 animate-bounce" />
                    <h2 className="text-4xl font-black text-gray-800 mb-4">המשימה הוגשה בהצלחה!</h2>
                    <p className="text-xl text-gray-600 mb-8 max-w-lg">
                        כל הכבוד, <strong>{studentName}</strong>. התשובות שלך נשלחו למורה.
                    </p>
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 max-w-sm w-full mb-8">
                        <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">הציון שלך</div>
                        <div className="text-6xl font-black text-blue-600">{calculateScore()}</div>
                    </div>
                    <button
                        onClick={() => window.location.replace('/')}
                        className="bg-gray-800 text-white px-8 py-3 rounded-full font-bold hover:bg-gray-900 transition-all hover:scale-105"
                    >
                        חזרה לדף הבית
                    </button>
                </div>
            )}

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
                                        <div className="font-serif text-gray-800 leading-relaxed">
                                            {CitationService.chunkText(course.fullBookContent).map((chunk) => (
                                                <span
                                                    key={chunk.id}
                                                    id={`chunk-${chunk.id}`}
                                                    className="relative py-1 px-1 rounded transition-colors duration-1000 block md:inline hover:bg-yellow-50/50"
                                                >
                                                    <sup className="text-gray-400 text-xs select-none pr-1">[{chunk.id}]</sup>
                                                    {chunk.text + " "}
                                                </span>
                                            ))}
                                        </div>
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
                                {(() => {
                                    const isLastUnit = activeModuleId === course.syllabus[course.syllabus.length - 1].id &&
                                        activeUnitId === activeModule?.learningUnits[activeModule.learningUnits.length - 1].id;

                                    return (
                                        <button
                                            onClick={isLastUnit ? handleSubmit : handleContinueClick}
                                            disabled={isLastUnit && isSubmitting}
                                            className={`${isLastUnit ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-10 py-3.5 rounded-full font-bold shadow-xl transition-all hover:scale-105 flex items-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {reviewMode ? 'סגור תצוגה' : (
                                                isLastUnit ? (
                                                    <>
                                                        {isSubmitting ? 'שולח...' : 'הגש משימה'} <IconCheck className="w-5 h-5" />
                                                    </>
                                                ) : (
                                                    <>
                                                        הבא <IconArrowBack className="w-5 h-5" />
                                                    </>
                                                )
                                            )}
                                        </button>
                                    );
                                })()}
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
                                        type="button"
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