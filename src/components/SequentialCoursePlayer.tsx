import React, { useState, useEffect, useCallback } from 'react';
import { useCourseStore } from '../context/CourseContext';

import {
    IconSparkles,
    IconChevronLeft, IconChevronRight,
    IconCheck, IconX, IconStar, IconLink,
    IconVideo, IconHeadphones, IconJoystick, IconTarget, IconBook, IconBell
} from '../icons';
import type { ActivityBlock, Assignment } from '../shared/types/courseTypes';
import { getIconForBlockType } from '../utils/pedagogicalIcons';
import { useSound } from '../hooks/useSound';
import { FeedbackWidget } from './FeedbackWidget'; // NEW: Feedback Loop
import { useAuth } from '../context/AuthContext';
import { generateRemedialBlock } from '../services/adaptiveContentService';
import ThinkingOverlay from './ThinkingOverlay';
import { syncProgress, checkDailyStreak, DEFAULT_GAMIFICATION_PROFILE } from '../services/gamificationService';
import ShopModal from './ShopModal';
import SuccessModal from './SuccessModal';
import type { GamificationProfile } from '../shared/types/courseTypes';
import TeacherCockpit from './TeacherCockpit'; // NEW: Teacher View
import { calculateQuestionScore, SCORING_CONFIG } from '../utils/scoring'; // CRITICAL FIX: Import scoring system


// --- Specialized Sub-Components ---
import ClozeQuestion from './ClozeQuestion';
import OrderingQuestion from './OrderingQuestion';
import CategorizationQuestion from './CategorizationQuestion';
import MemoryGameQuestion from './MemoryGameQuestion';
import TrueFalseQuestion from './TrueFalseQuestion';
import { PodcastPlayer } from './PodcastPlayer';
import { AudioRecorderBlock } from './AudioRecorderBlock';
import { InfographicViewer } from './InfographicViewer';


interface SequentialPlayerProps {
    assignment?: Assignment;
    onExit?: () => void;
    onEdit?: () => void;
    simulateGuest?: boolean;
}

// --- Gamification Helper Components ---

const XpFloater = ({ amount, onComplete }: { amount: number, onComplete: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 1000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="absolute top-1/4 right-10 pointer-events-none z-50 animate-bounce-up">
            <span className="text-4xl font-black text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] header-font">
                +{amount} XP
            </span>
        </div>
    );
};

const StreakFlame = ({ count }: { count: number }) => (
    <div className={`flex items-center gap-1 transition-all transform ${count > 0 ? 'scale-110' : 'scale-100 opacity-50'} ${count >= 3 ? 'animate-bounce' : ''}`}>
        <span className="text-2xl filter drop-shadow-md">🔥</span>
        <span className={`text-xl font-black ${count >= 3 ? 'text-red-500 drop-shadow-lg' : count > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
            {count}
        </span>
    </div>
);

// --- Main Component ---


const SequentialCoursePlayer: React.FC<SequentialPlayerProps> = ({ assignment, onExit, onEdit, simulateGuest = false }) => {
    const { course } = useCourseStore();
    const playSound = useSound();
    const { currentUser } = useAuth(); // for FeedbackWidget


    // --- State: The "Pool" ---
    // --- State: The "Pool" (Mutable Queue for Adaptive Injection) ---
    const [playbackQueue, setPlaybackQueue] = useState<ActivityBlock[]>([]);

    // Inspector Mode (Wizdi-Monitor)
    const [inspectorMode, setInspectorMode] = useState(false);
    const [forceExam, setForceExam] = useState(false); // DEBUG: Override mode
    const isExamMode = forceExam || course?.mode === 'exam';

    useEffect(() => {
        // Safe check for window
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('inspector') === 'true') {
                setInspectorMode(true);
            }
            if (params.get('forceExam') === 'true') {
                setForceExam(true);
                console.warn("⚠️ Force Exam Mode Active via URL Parameter");
            }
        }
    }, []);

    useEffect(() => {
        if (course?.syllabus) {
            const initialBlocks = course.syllabus.flatMap(m => m.learningUnits.flatMap(u => (u.activityBlocks || []) as ActivityBlock[]));
            setPlaybackQueue(initialBlocks);
        }
    }, [course]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [historyStack, setHistoryStack] = useState<number[]>([]);

    const currentBlock = playbackQueue[currentIndex];
    const isLast = currentIndex === playbackQueue.length - 1;

    // --- State: Interaction ---
    const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});

    // Status Flow: 'idle' -> 'selected' (for MC) -> 'checked' -> 'correct'/'incorrect'
    // For Complex blocks (cloze/ordering), they might handle their own internal checking, 
    // but here we enforce a global "Continue" step.
    const [stepStatus, setStepStatus] = useState<'idle' | 'ready_to_check' | 'success' | 'failure'>('idle');
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
    const [isRemediating, setIsRemediating] = useState(false); // NEW: Remediation Loading State

    // --- State: Results Tracking (for Timeline Colors & Persistence) ---
    const [stepResults, setStepResults] = useState<Record<string, 'success' | 'failure' | 'viewed'>>({});
    const [hintsVisible, setHintsVisible] = useState<Record<string, number>>({});


    // --- State: Gamification ---
    // Persistent Profile (synced with Firestore)
    const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(DEFAULT_GAMIFICATION_PROFILE);

    // UI Helpers
    const [combo, setCombo] = useState(0); // Multiplier
    const [showFloater, setShowFloater] = useState<{ id: number, amount: number } | null>(null);
    const [isShopOpen, setIsShopOpen] = useState(false);

    // Initial Load & Streak Check
    useEffect(() => {
        if (currentUser?.uid) {
            checkDailyStreak(currentUser.uid).then(result => {
                setGamificationProfile(prev => ({
                    ...prev,
                    currentStreak: result.currentStreak,
                    frozenDays: result.frozenDays
                }));
                // Could toast message if streak was frozen/reset
            });
            // Initial Sync/Fetch could be here if we want to get fresh "gems" count too
            // syncProgress(currentUser.uid, 0, 0).then(p => p && setGamificationProfile(p));
        }
    }, [currentUser]);


    // Reset or Restore status when moving to new block
    useEffect(() => {
        if (!currentBlock) return;
        const prevResult = stepResults[currentBlock.id];

        // Reset local block interaction states
        // Ensure hints are closed when entering a new block (unless we want to persist them, but "Start" should be 0)
        // If we want to persist hints for "Back" navigation, we keep them involved.
        // But if the user says "immediately", maybe IDs are duplicated?
        // Let's force a reset if it's not "viewed" or "success"? No, valid to see hints again.

        if (prevResult) {
            if (prevResult === 'viewed') {
                setStepStatus('idle'); // Passive blocks just show 'Continue'
                setFeedbackMsg(null);
            } else {
                setStepStatus(prevResult as any); // Cast because stepStatus state is narrower than stepResults
                setFeedbackMsg(prevResult === 'success' ? "מצוין! כבר השלמתם את השלב הזה." : "כבר ניסיתם את השלב הזה.");
            }
        } else {
            setStepStatus('idle');
            setFeedbackMsg(null);
            // Hint Reset for new un-attempted blocks (just in case of ID collision or zombie state)
            setHintsVisible(prev => ({ ...prev, [currentBlock.id]: 0 }));
        }
    }, [currentIndex, currentBlock?.id]); // Only when ID changes, not necessarily stepResults deep change
    // Note: Removed stepResults dependency to avoid loop, we only check on mount of new index.


    // --- Handlers ---

    const handleShowHint = (blockId: string) => {
        const newLevel = (hintsVisible[blockId] || 0) + 1;
        setHintsVisible(prev => ({ ...prev, [blockId]: newLevel }));
    };

    // 1. Selection (User Interact)
    const handleAnswerSelect = (val: any) => {
        if (stepStatus === 'success' || stepStatus === 'failure') return; // Locked
        setUserAnswers(prev => ({ ...prev, [currentBlock.id]: val }));

        // If it's a simple Multiple Choice, deciding to select makes it "Ready"
        // For complex blocks, they might trigger this themselves via callback if needed, 
        // OR we just rely on the 'Check' button being always active but validating content.
        setStepStatus('ready_to_check');
    };

    // 2. Check Action (The "Lime Button")
    const handleCheck = useCallback(() => {
        // 1. Check if PASSIVE block (Text, Media) -> Always simple continue
        const passiveTypes = ['text', 'video', 'image', 'pdf', 'gem-link', 'podcast'];
        if (passiveTypes.includes(currentBlock.type)) {
            // Mark as "viewed" implicitly for progress bar (no score, no success banner)
            setStepResults(prev => ({ ...prev, [currentBlock.id]: 'viewed' }));
            handleNext();
            return;
        }

        // If already checked, this button becomes "Continue"
        if (stepStatus === 'success' || stepStatus === 'failure') {
            handleNext();
            return;
        }

        const answer = userAnswers[currentBlock.id];
        let isCorrect = false;

        // Validation Logic per Type
        if (currentBlock.type === 'multiple-choice') {
            if (!answer) return; // Should be disabled
            isCorrect = answer === currentBlock.content.correctAnswer;
        } else {
            // Complex blocks usually drive themselves, but if we fall through:
            return;
        }

        processResult(isCorrect);
    }, [currentBlock, userAnswers, stepStatus]);

    // 3. Process Result (Gamification + ADAPTIVE BKT Logic)
    // ✅ FIXED: Now uses central scoring system according to PROJECT_DNA.md
    const processResult = async (isCorrect: boolean) => {
        // Save Result for Timeline
        setStepResults(prev => ({ ...prev, [currentBlock.id]: isCorrect ? 'success' : 'failure' }));

        // ✅ CRITICAL FIX: Calculate score using the central scoring function
        const hintsUsed = hintsVisible[currentBlock.id] || 0;
        const prevAttempts = stepResults[currentBlock.id] ? 1 : 0; // If already attempted, it's at least attempt #2

        const score = calculateQuestionScore({
            isCorrect,
            attempts: prevAttempts + 1,
            hintsUsed: hintsUsed,
            responseTimeSec: 0 // Could track actual time if needed
        });

        console.log(`🎯 Scoring: isCorrect=${isCorrect}, attempts=${prevAttempts + 1}, hints=${hintsUsed}, score=${score}`);

        if (isCorrect) {
            setStepStatus('success');
            playSound('success');

            // ✅ FIXED: XP is now directly tied to score (0-100)
            const totalXpGain = score;

            // ✅ FIXED: Gems based on score quality
            let totalGemGain = 0;
            if (score === SCORING_CONFIG.CORRECT_FIRST_TRY) {
                totalGemGain = 2; // Perfect score: 2 gems
            } else if (score >= SCORING_CONFIG.RETRY_PARTIAL) {
                totalGemGain = 1; // Partial/retry: 1 gem
            }

            // Optimistic UI Update
            setGamificationProfile(prev => ({
                ...prev,
                xp: prev.xp + totalXpGain,
                gems: prev.gems + totalGemGain,
                currentStreak: prev.currentStreak + 1,
            }));

            setCombo(prev => prev + 1);
            setShowFloater({ id: Date.now(), amount: totalXpGain });

            // ✅ FIXED: Contextual feedback based on score
            let feedback: string;
            if (score === SCORING_CONFIG.CORRECT_FIRST_TRY) {
                feedback = ["מעולה!", "כל הכבוד!", "יפה מאוד!", "מושלם!"][Math.floor(Math.random() * 4)];
            } else if (score >= SCORING_CONFIG.RETRY_PARTIAL) {
                if (hintsUsed > 0) {
                    const penalty = SCORING_CONFIG.CORRECT_FIRST_TRY - score;
                    feedback = `יפה! (${penalty} נקודות הופחתו בגלל ${hintsUsed} רמזים)`;
                } else {
                    feedback = "טוב! (תשובה נכונה בניסיון נוסף)";
                }
            } else {
                feedback = "כמעט!";
            }
            setFeedbackMsg(feedback);

            // Background Sync
            if (currentUser?.uid) {
                syncProgress(currentUser.uid, totalXpGain, totalGemGain).then(updatedProfile => {
                    if (updatedProfile) {
                        setGamificationProfile(updatedProfile);
                    }
                });
            }

        } else {
            setStepStatus('failure');
            playSound('failure');
            setCombo(0);

            setFeedbackMsg(currentBlock.type === 'multiple-choice'
                ? `התשובה הנכונה: ${currentBlock.content.correctAnswer}`
                : "לא נורא, נסו שוב!");
        }

        // --- ADAPTIVE BRAIN SYNC (Cloud) ---
        // Fire & Forget (or await if critical)
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const { getAuth } = await import('firebase/auth');
            const functions = getFunctions();
            const auth = getAuth();
            const user = auth.currentUser;



            if (user && course?.id) {
                const submitAdaptiveAnswer = httpsCallable(functions, 'submitAdaptiveAnswer');
                submitAdaptiveAnswer({
                    userId: user.uid,
                    unitId: course.syllabus[0]?.learningUnits[0]?.id || 'unknown_unit',
                    blockId: currentBlock.id,
                    score: isCorrect ? 100 : 0,
                    isCorrect,
                    metadata: currentBlock.metadata
                }).then(async (result: any) => {
                    const data = result.data;
                    if (data) {
                        console.log("🧠 BKT Update:", data);

                        // --- FACTORY: REAL-TIME REMEDIATION ---
                        if (data.action === 'remediate') {
                            // Trigger "Thinking" Overlay
                            setIsRemediating(true);
                            setFeedbackMsg(prev => (prev || "") + "\n🤖 המערכת מזהה קושי. מנתח פערים...");

                            try {
                                const remedialBlock = await generateRemedialBlock(
                                    currentBlock,
                                    course.title || "General",
                                    userAnswers[currentBlock.id] // Pass the wrong answer
                                );

                                if (remedialBlock) {
                                    setPlaybackQueue(prev => {
                                        const newQ = [...prev];
                                        // Insert immediately after current
                                        newQ.splice(currentIndex + 1, 0, remedialBlock);
                                        return newQ;
                                    });
                                    setFeedbackMsg("יצרתי עבורכם הסבר ממוקד לחזרה. לחצו על המשך.");
                                }
                            } catch (genErr) {
                                console.error("Factory Error:", genErr);
                            } finally {
                                setIsRemediating(false); // Hide Overlay
                            }
                        }
                    }
                }).catch(err => console.error("BKT Sync Failed", err));
            }
        } catch (e) {
            console.error("Adaptive connection error", e);
        }
    };

    // Callback for "Self-Checking" components (Cloze, Ordering)
    // ✅ FIXED: Now properly processes score from complex components
    const handleComplexBlockComplete = (score: number, telemetryData?: { attempts?: number, hintsUsed?: number }) => {
        // Complex blocks pass their own score (0-100)
        // We map this to isCorrect for processResult
        const passed = score > 60;

        // Update hints if provided by the component
        if (telemetryData?.hintsUsed && telemetryData.hintsUsed > 0) {
            setHintsVisible(prev => ({ ...prev, [currentBlock.id]: telemetryData.hintsUsed }));
        }

        processResult(passed);
    };

    // --- 4. Navigation ---
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleNext = () => {
        // Prepare next
        if (isLast) {
            setShowSuccessModal(true);
        } else {
            setHistoryStack(prev => [...prev, currentIndex]);
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (historyStack.length === 0) return;
        const prev = historyStack[historyStack.length - 1];
        setHistoryStack(stk => stk.slice(0, -1));
        setCurrentIndex(prev);
    };


    // --- Key Press Handling (Enter to Check/Next) ---
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') handleCheck();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleCheck]);


    // --- Render Helpers ---

    const renderFooterButton = () => {
        const isChecked = stepStatus === 'success' || stepStatus === 'failure';
        let label = "בדיקה";
        let colorClass = "bg-[#0056b3] text-white border-blue-800 hover:bg-blue-700"; // Default: Active Check (Manifesto Blue)

        const passiveTypes = ['text', 'video', 'image', 'pdf', 'gem-link', 'podcast'];

        // COMPLEX BLOCK LOGIC:
        // If it's a complex interactive block (Cloze, Ordering, etc.) AND we are in 'idle' mode,
        // we HIDE the main button because the block usually has its own internal 'Check' button (or drag logic).
        const complexTypes = ['fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'true_false_speed', 'audio-response'];
        if (complexTypes.includes(currentBlock.type) && !isChecked) {
            return null; // Hide button, let the component drive
        }

        if (isChecked) {
            label = stepStatus === 'success' ? "המשך" : "הבנתי, המשך";
            colorClass = stepStatus === 'success'
                ? "bg-[#0056b3] text-white border-blue-800 hover:bg-blue-700" // Continue Success (Blue)
                : "bg-red-500 text-white border-red-700 hover:bg-red-400"; // Continue Failure
        } else if (stepStatus === 'idle' && currentBlock.type === 'multiple-choice' && !userAnswers[currentBlock.id]) {
            // Disabled state for MC if nothing selected
            colorClass = "bg-slate-700 text-slate-500 border-slate-700 cursor-not-allowed transform-none";
        }

        // Passive content override
        if (passiveTypes.includes(currentBlock.type)) {
            label = "המשך";
            colorClass = "bg-[#0056b3] text-white border-blue-800 hover:bg-blue-700";
        }

        return (
            <button
                key={stepStatus} // Re-trigger animation on status change
                onClick={handleCheck}
                disabled={!passiveTypes.includes(currentBlock.type) && !isChecked && stepStatus === 'idle' && currentBlock.type === 'multiple-choice' && !userAnswers[currentBlock.id]}
                className={`w-full py-4 rounded-2xl font-black text-xl tracking-wide uppercase transition-all active:translate-y-1 active:border-b-0 border-b-4 shadow-lg animate-pop ${colorClass}`}
            >
                {label}
            </button>
        );
    };

    const renderProgressiveHints = (block: ActivityBlock) => {
        const hints = block.metadata?.progressiveHints;
        if (!hints || hints.length === 0) return null;
        if (isExamMode) return null; // No hints in exam

        const currentLevel = hintsVisible[block.id] || 0;
        const isMaxLevel = currentLevel >= hints.length;
        // Hint Policy: Require at least 1 attempt before showing hints (unless already revealed)
        const attempts = stepResults[block.id] === 'failure' ? 1 : 0; // Simplified check since we don't have full attempt count in state, but 'failure' implies >0 attempts. 
        // Better: userAnswers[block.id] presence implies attempt.
        const hasAttempted = !!userAnswers[block.id] || stepStatus !== 'idle';
        const isLocked = currentLevel === 0 && !hasAttempted;

        if (isLocked) return null; // Don't show hint button at all if not attempted

        return (
            <div className="mb-6 flex flex-col items-start gap-2 animate-in slide-in-from-top-2">
                <button
                    onClick={() => handleShowHint(block.id)}
                    disabled={isMaxLevel}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-sm ${isMaxLevel
                        ? 'bg-gray-100 text-gray-400 cursor-default'
                        : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:scale-105 active:scale-95' // Secondary Style
                        }`}
                >
                    <IconSparkles className="w-4 h-4" />
                    {currentLevel === 0 ? '💡 רמז' : (isMaxLevel ? 'כל הרמזים מוצגים' : 'רמז נוסף')}
                </button>

                {currentLevel > 0 && (
                    <div className="space-y-2 w-full max-w-md animate-fade-in mt-2">
                        {hints.slice(0, currentLevel).map((hint, idx) => (
                            <div key={idx} className="relative bg-blue-50 border border-blue-200 p-3 pr-4 rounded-xl text-blue-900 text-sm shadow-sm flex gap-3 items-start">
                                <span className="font-bold bg-blue-200 text-blue-800 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{idx + 1}</span>
                                <span className="flex-1">{hint}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderBlockContent = () => {
        switch (currentBlock.type) {
            case 'multiple-choice':
                return (
                    <div className="space-y-6">
                        {renderProgressiveHints(currentBlock)}
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed text-center" dir="auto">
                            {currentBlock.content.question}
                        </h2>
                        <div className="grid gap-4">
                            {currentBlock.content.options?.map((opt: any, idx: number) => {
                                const text = typeof opt === 'string' ? opt : opt.value || opt.answer;
                                const isSelected = userAnswers[currentBlock.id] === text;
                                const isResultState = stepStatus === 'success' || stepStatus === 'failure';
                                const isCorrectOpt = text === currentBlock.content.correctAnswer;
                                const isUserWrong = isResultState && isSelected && !isCorrectOpt;

                                let optionStyle = "border-slate-200 hover:bg-slate-50"; // Default
                                if (isSelected) optionStyle = "border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-500/20";

                                if (isResultState) {
                                    if (isCorrectOpt) optionStyle = "border-green-500 bg-green-100 text-green-800";
                                    else if (isUserWrong) optionStyle = "border-red-500 bg-red-100 text-red-800";
                                    else optionStyle = "opacity-50 grayscale";
                                }

                                return (
                                    <button
                                        key={idx}
                                        disabled={isResultState}
                                        onClick={() => handleAnswerSelect(text)}
                                        className={`w-full p-5 rounded-2xl text-right font-bold text-lg border-2 transition-all active:scale-95 ${optionStyle}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{text}</span>
                                            {/* Indicators */}
                                            {isResultState && isCorrectOpt && <IconCheck className="w-6 h-6 text-green-600" />}
                                            {isResultState && isUserWrong && <IconX className="w-6 h-6 text-red-500" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'open-question':
                return (
                    <div className="space-y-6 w-full max-w-4xl mx-auto">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed text-center" dir="auto">
                            {currentBlock.content.question}
                        </h2>
                        <textarea
                            className="w-full p-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 min-h-[200px] text-lg resize-none transition-all"
                            placeholder="הקלד את תשובתך כאן..."
                            dir="auto"
                            disabled={stepStatus === 'success' || stepStatus === 'failure'}
                            onChange={(e) => handleAnswerSelect(e.target.value)}
                            value={userAnswers[currentBlock.id] || ''}
                        />
                    </div>
                );

            case 'fill_in_blanks':
                return <ClozeQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;
            case 'ordering':
                return <OrderingQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;
            case 'categorization':
                return <CategorizationQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;
            case 'memory_game':
                return <MemoryGameQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;
            case 'true_false_speed':
                // @ts-ignore
                return <TrueFalseQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;

            // --- Passive Content Renderers ---
            case 'text':
                return (
                    <div className="space-y-8 text-right w-full max-w-4xl mx-auto" dir="rtl">
                        <div className="text-slate-800">
                            {currentBlock.content.split('\n').map((line: string, i: number) => {
                                if (!line.trim()) return <br key={i} />;
                                // Header detection logic (basic)
                                if (line.startsWith('#')) {
                                    return <h2 key={i} className="text-3xl md:text-5xl font-black mb-6 text-indigo-600">{line.replace(/^#+\s*/, '')}</h2>;
                                }
                                return <p key={i} className="text-2xl md:text-3xl leading-relaxed font-bold mb-6 text-slate-700">{line}</p>;
                            })}
                        </div>
                    </div>
                );
            case 'video':
                let videoId = currentBlock.content;
                if (videoId.includes('v=')) videoId = videoId.split('v=')[1]?.split('&')[0];
                if (videoId.includes('youtu.be/')) videoId = videoId.split('youtu.be/')[1]?.split('?')[0];

                return (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-lg bg-black">
                        <iframe
                            width="100%" height="100%"
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title="Video Lesson"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="border-0"
                        />
                    </div>
                );
            case 'image':
                return (
                    <div className="flex flex-col items-center gap-4">
                        <img
                            src={currentBlock.content}
                            alt="Lesson Content"
                            className="rounded-2xl shadow-md max-h-[50vh] object-contain"
                        />
                    </div>
                );

            case 'pdf':
                return (
                    <div className="w-full h-[600px] rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                        <iframe
                            src={`${currentBlock.content}#toolbar=0`}
                            width="100%"
                            height="100%"
                            title="PDF Viewer"
                            className="border-0"
                        />
                    </div>
                );

            case 'gem-link':
                return (
                    <div className="flex flex-col items-center gap-6 p-8 text-center bg-blue-50 rounded-3xl border-4 border-blue-100 border-dashed">
                        <div className="text-6xl animate-bounce">💎</div>
                        <h2 className="text-2xl font-bold text-slate-800">פעילות מיוחדת!</h2>
                        <p className="text-lg text-slate-600 max-w-md">
                            לחץ על הכפתור למטה כדי לפתוח את הפעילות בחלון חדש.
                        </p>
                        <a
                            href={currentBlock.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-xl shadow-lg hover:bg-blue-700 transition transform hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            פתח פעילות <IconLink className="w-5 h-5" />
                        </a>
                    </div>
                );

            case 'podcast':
                return (
                    <PodcastPlayer
                        script={currentBlock.content.script}
                        initialAudioUrl={currentBlock.content.audioUrl}
                        title={currentBlock.content.title}
                    />
                );

            case 'infographic':
                const infographicSrc = typeof currentBlock.content === 'string'
                    ? currentBlock.content
                    : (currentBlock.content?.imageUrl || currentBlock.metadata?.uploadedFileUrl || '');
                const infographicTitle = typeof currentBlock.content === 'object' ? currentBlock.content?.title : undefined;
                const infographicCaption = typeof currentBlock.content === 'object' ? currentBlock.content?.caption : currentBlock.metadata?.caption;
                const infographicType = currentBlock.metadata?.infographicType || (typeof currentBlock.content === 'object' ? currentBlock.content?.visualType : undefined);

                if (!infographicSrc) return <div className="p-10 text-center text-gray-500">אינפוגרפיקה לא נמצאה</div>;
                return (
                    <InfographicViewer
                        src={infographicSrc}
                        title={infographicTitle}
                        caption={infographicCaption}
                        infographicType={infographicType}
                    />
                );

            case 'audio-response':
                // @ts-ignore
                return <AudioRecorderBlock block={currentBlock} onAnswer={(url) => handleComplexBlockComplete(100)} />;

            default:
                return <div className="p-10 text-center text-gray-500">Feature coming soon: {currentBlock.type}</div>;
        }
    };

    const handleEdit = () => {
        // Navigate to editor
        const courseId = (course as any).id;
        if (courseId) {
            window.location.hash = `/editor/${courseId}`;
            // Or if using a router callback passed from props, use that.
            // Assuming basic hash routing or that reload handles it.
            // If this component is used inside a router, we might need useNavigate.
            // But for now, window.location.assign is safest for a "hard" jump if router isn't exposed.
        }
    };

    // --- Loading State ---
    if (!currentBlock) return <div className="h-screen w-full bg-blue-600 flex items-center justify-center text-white font-bold text-2xl animate-pulse">טוען שיעור...</div>;


    // --- Teacher Cockpit Mode ---
    // Detect if this is a Teacher Lesson Plan
    const productType = (course as any)?.wizardData?.settings?.productType;
    console.log("🕵️ SequentialCoursePlayer: Detected Product Type:", productType);

    if (productType === 'lesson' && !forceExam && !inspectorMode) {
        // Use the first unit found (Standard for current generation flow)
        const unit = course?.syllabus?.[0]?.learningUnits?.[0];
        if (unit) {
            // Smart fallback for onExit
            const handleExit = () => {
                console.log('🔙 SequentialCoursePlayer TeacherCockpit onExit called');
                if (onExit) {
                    onExit();
                } else if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = '/';
                }
            };

            return <TeacherCockpit unit={unit as any} courseId={course?.id} onExit={handleExit} onEdit={onEdit} />;
        }
    }

    // --- Student Player (Default) ---
    return (
        <div className="fixed inset-0 bg-[#3565e3] flex flex-col font-sans overflow-hidden" dir="rtl">

            {/* 1. Header (Gamification) */}
            <div className="flex-none p-4 pt-20 md:pt-32 pb-2 z-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between text-white bg-[#3565e3] pb-4 border-b border-white/10">
                    {/* Exit/Back & Progress Text */}
                    <div className="flex items-center gap-4">
                        <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white">
                            <IconX className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col text-right">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold opacity-80 uppercase tracking-widest">{currentUser?.displayName || "אורח"}</span>
                                <IconBell className="w-4 h-4 opacity-70" />
                            </div>
                            <span className="text-xl font-black font-mono" dir="ltr">{currentIndex + 1} / {playbackQueue.length}</span>
                        </div>
                    </div>

                    {/* Central Progress Bar with Markers */}
                    <div className="flex-1 mx-8 max-w-md hidden md:block relative group h-6 mt-2">
                        {/* Markers Icons (Floating Above) */}
                        <div className="absolute -top-10 left-0 right-0 h-8 pointer-events-none w-full">
                            {playbackQueue.map((block, idx) => {
                                const isCompleted = idx < currentIndex;
                                const isCurrent = idx === currentIndex;
                                const result = stepResults[block.id];

                                // Use centralized icon mapping for consistency with Teacher Cockpit
                                const Icon = getIconForBlockType(block.type);

                                // Styling
                                let iconColor = "text-white/30";
                                let scale = "scale-75";
                                if (isCurrent) {
                                    iconColor = "text-yellow-300";
                                    scale = "scale-150 drop-shadow-[0_0_8px_rgba(253,224,71,0.6)]";
                                } else if (isCompleted) {
                                    // Check result from stepResults
                                    if (result === 'success') iconColor = "text-green-400";
                                    else if (result === 'failure') iconColor = "text-red-400";
                                    else iconColor = "text-lime-400"; // Default completed
                                    scale = "scale-100 opacity-90";
                                }

                                // Position Calculation (RTL Friendly)
                                const total = playbackQueue.length;
                                // Prevent division by zero if total <= 1
                                const percentage = total > 1 ? (idx / (total - 1)) * 100 : 50;

                                return (
                                    <div
                                        key={`icon-${block.id}`}
                                        className={`absolute top-0 flex flex-col items-center justify-center transition-all duration-500 ${iconColor} ${scale}`}
                                        style={{ right: `${percentage}%`, transform: 'translateX(50%)' }}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {isCurrent && <div className="mt-1 w-1 h-1 bg-yellow-300 rounded-full animate-ping" />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Ticks on the Bar (Simplified) */}
                        <div className="absolute top-1 left-0 right-0 h-4 pointer-events-none w-full">
                            {playbackQueue.map((block, idx) => {
                                const isCurrent = idx === currentIndex;
                                const total = playbackQueue.length;
                                const percentage = total > 1 ? (idx / (total - 1)) * 100 : 50;

                                return (
                                    <div
                                        key={`tick-${idx}`}
                                        className={`absolute top-0 w-0.5 h-4 bg-white/20 rounded-full transition-all ${isCurrent ? 'bg-yellow-300 h-5 -mt-0.5 shadow-[0_0_8px_yellow]' : ''}`}
                                        style={{ right: `${percentage}%`, transform: 'translateX(50%)' }}
                                    />
                                )
                            })}
                        </div>

                        {/* The Bar Itself */}
                        <div className="h-4 bg-black/20 rounded-full overflow-hidden p-1 backdrop-blur-sm shadow-inner relative z-0">
                            <div
                                className="h-full bg-gradient-to-l from-lime-400 to-green-500 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(163,230,53,0.5)] relative"
                                style={{ width: `${((currentIndex + 1) / playbackQueue.length) * 100}%` }}
                            >
                                <div className="absolute inset-0 bg-white/30 animate-pulse-slow"></div>
                            </div>
                        </div>
                    </div>


                    {/* Stats: Streak & XP & Gems */}
                    <div className="flex items-center gap-4">
                        {/* Streak Widget */}
                        <div className="flex items-center gap-2 bg-black/20 px-4 py-2 rounded-2xl border border-white/5 backdrop-blur-md shadow-lg transform hover:scale-105 transition-all">
                            <StreakFlame count={gamificationProfile.currentStreak} />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">רצף</span>
                        </div>

                        {/* XP Widget */}
                        <div className="flex items-center gap-2 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 px-4 py-2 rounded-2xl border border-yellow-400/30 backdrop-blur-md shadow-lg transform hover:scale-105 transition-all">
                            <IconStar className="w-5 h-5 text-yellow-300 drop-shadow-md" />
                            <span className="font-black text-yellow-300 font-mono text-xl drop-shadow-sm">{gamificationProfile.xp}</span>
                            <span className="text-xs font-bold text-yellow-200 uppercase tracking-wider">נקודות</span>
                        </div>

                        {/* Gems Widget (Clickable for Shop) */}
                        <button
                            onClick={() => setIsShopOpen(true)}
                            className="flex items-center gap-2 bg-gradient-to-br from-blue-400/20 to-cyan-500/20 px-4 py-2 rounded-2xl border border-cyan-400/30 backdrop-blur-md shadow-lg transform hover:scale-105 transition-all outline-none focus:ring-2 focus:ring-cyan-400"
                        >
                            <span className="text-xl">💎</span>
                            <span className="font-black text-cyan-300 font-mono text-xl drop-shadow-sm">{gamificationProfile.gems}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. Bottom Action Bar (Sticky) */}


            {/* 2. Main Card Area (Modified for spacing) */}
            <div className={`flex-1 overflow-y-auto w-full max-w-6xl mx-auto p-4 flex flex-col justify-start pt-4 md:pt-12 transition-all duration-300 scrollbar-none [&::-webkit-scrollbar]:hidden ${(stepStatus === 'success' || stepStatus === 'failure') ? 'pb-64' : 'pb-48'
                }`}>
                {/* Floating XP Animation */}
                {showFloater && <XpFloater amount={showFloater.amount} onComplete={() => setShowFloater(null)} />}

                {/* split-view-logic */}
                {(() => {
                    // Check for Context (Previous block was passive content?)
                    const prevBlock = playbackQueue[currentIndex - 1];
                    const isInteractive = !['text', 'video', 'image', 'pdf', 'gem-link', 'podcast'].includes(currentBlock.type);
                    const hasContext = prevBlock && ['text', 'pdf'].includes(prevBlock.type) && isInteractive;

                    if (hasContext) {
                        return (
                            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[500px]">
                                {/* Context Panel (Left/Top) */}
                                <div className="flex-1 bg-white/90 backdrop-blur rounded-[32px] shadow-xl p-6 md:p-8 overflow-y-auto border-4 border-white/50 max-h-[60vh] lg:max-h-none">
                                    <div className="prose prose-xl prose-indigo max-w-none text-slate-800 dir-rtl">
                                        {prevBlock.content.split('\n').map((line: string, i: number) => {
                                            if (!line.trim()) return <br key={i} />;
                                            if (line.startsWith('#')) {
                                                return <h3 key={i} className="text-2xl md:text-3xl font-bold mb-4 text-indigo-600">{line.replace(/^#+\s*/, '')}</h3>;
                                            }
                                            return <p key={i} className="text-xl md:text-2xl leading-relaxed font-medium mb-4">{line}</p>;
                                        })}
                                    </div>
                                </div>

                                {/* Active Question Panel (Right/Bottom) */}
                                <div className="flex-1 bg-white rounded-[32px] shadow-2xl p-6 md:p-8 flex flex-col justify-center animate-in slide-in-from-right-8 duration-500">
                                    {renderBlockContent()}
                                </div>
                            </div>
                        );
                    }

                    // Standard Single View
                    return (
                        <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden min-h-[500px] flex flex-col relative animate-in zoom-in-95 duration-300 max-w-5xl mx-auto w-full">
                            <div className="p-8 md:p-12 flex-1 flex flex-col justify-center">
                                {renderBlockContent()}
                            </div>
                        </div>
                    );
                })()}

            </div>

            {/* Success Modal Overlay */}
            {showSuccessModal && (
                <SuccessModal
                    onContinue={() => {
                        setShowSuccessModal(false);
                        onExit && onExit();
                    }}
                    onReview={() => {
                        setShowSuccessModal(false);
                        // Stay on page
                    }}
                    xpGained={50} // Dynamic later
                    gemsGained={2}
                />
            )}

            {/* 3. Bottom Action Bar (Sticky) */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 transition-transform duration-300 z-20 ${stepStatus === 'success' ? 'bg-[#d7ffb8] translate-y-0' :
                stepStatus === 'failure' ? 'bg-[#ffdfe0] translate-y-0' :
                    'bg-[#3565e3] border-t border-white/10 backdrop-blur-lg translate-y-0'
                }`}>
                <div className="max-w-4xl mx-auto flex flex-row items-end justify-between gap-4">

                    <div className="flex items-center gap-2 order-1">
                        <button
                            onClick={handleBack}
                            disabled={currentIndex === 0}
                            className="p-4 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all active:scale-95 shadow-lg border border-white/5"
                        >
                            <IconChevronRight className="w-8 h-8" />
                        </button>
                    </div>

                    {/* Feedback OR Action Button */}
                    <div className="flex-1 w-full flex items-center justify-center gap-4 order-2">
                        {/* Feedback Text (Only shown on Result) */}
                        {(stepStatus === 'success' || stepStatus === 'failure') ? (
                            <div className="flex-1 animate-in slide-in-from-bottom-5 fade-in">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stepStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                                        {stepStatus === 'success' ? <IconCheck className="w-6 h-6 text-white" /> : <IconX className="w-6 h-6 text-white" />}
                                    </div>
                                    <h3 className={`text-3xl font-black ${stepStatus === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                                        {stepStatus === 'success' ? 'נכון!' : 'שגוי'}
                                    </h3>
                                </div>
                                {feedbackMsg && <p className={`text-lg font-medium ${stepStatus === 'success' ? 'text-green-700' : 'text-red-700'}`}>{feedbackMsg}</p>}
                                <div className="mt-2 text-right">
                                    <FeedbackWidget
                                        courseId={course.id}
                                        unitId={course.syllabus[0]?.learningUnits[0]?.id || "unknown"}
                                        blockId={currentBlock.id}
                                        blockType={currentBlock.type}
                                        userId={currentUser?.uid || "anonymous"}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1"></div>
                        )}

                        {/* The Big Action Button */}
                        <div className="w-full">
                            {renderFooterButton()}
                        </div>
                    </div>

                    {/* Next Arrow (Free Move) */}
                    <div className="flex items-center gap-2 order-3">
                        <button
                            onClick={handleNext} // Allow skipping
                            disabled={isLast}
                            className="p-4 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all active:scale-95 shadow-lg border border-white/5"
                        >
                            <IconChevronLeft className="w-8 h-8" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Overlays */}
            {isRemediating && <ThinkingOverlay />}

            <ShopModal
                isOpen={isShopOpen}
                onClose={() => setIsShopOpen(false)}
                currentGems={gamificationProfile.gems}
                frozenDays={gamificationProfile.frozenDays}
                onPurchaseComplete={(newGems) => {
                    setGamificationProfile(prev => ({ ...prev, gems: newGems, frozenDays: prev.frozenDays + 1 }));
                }}
            />
        </div>
    );
};

export default SequentialCoursePlayer;
