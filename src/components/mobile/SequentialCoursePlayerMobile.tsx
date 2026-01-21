/**
 * SequentialCoursePlayerMobile.tsx
 *
 * Mobile-optimized course player with:
 * - Tab-based switching between content and source (not side-by-side)
 * - Forward/back navigation
 * - Basic gamification (XP, coins, streak)
 * - Full-width content display
 * - Touch-optimized controls (44px+ targets)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCourseStore } from '../../context/CourseContext';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../hooks/useSound';
import type { ActivityBlock, Assignment, GamificationProfile } from '../../shared/types/courseTypes';
import {
    IconChevronLeft, IconChevronRight, IconCheck, IconX,
    IconStar, IconBook, IconHome
} from '../../icons';
import { syncProgress, checkDailyStreak, DEFAULT_GAMIFICATION_PROFILE } from '../../services/gamificationService';
import { calculateQuestionScore } from '../../utils/scoring';
import { checkOpenQuestionAnswer } from '../../services/ai/geminiApi';

// Question Components
import ClozeQuestion from '../ClozeQuestion';
import OrderingQuestion from '../OrderingQuestion';
import CategorizationQuestion from '../CategorizationQuestion';
import MemoryGameQuestion from '../MemoryGameQuestion';
import TrueFalseQuestion from '../TrueFalseQuestion';
import MatchingQuestion from '../questions/MatchingQuestion';
import { sanitizeHtml, formatTeacherContent, stripAsterisks } from '../../utils/sanitize';
import { PodcastPlayer } from '../PodcastPlayer';
import { InfographicViewer } from '../InfographicViewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MobilePlayerProps {
    assignment?: Assignment;
    onExit?: () => void;
    simulateGuest?: boolean;
}

// Simple XP Animation
const XpFloater = ({ amount, onComplete }: { amount: number; onComplete: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 1000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-bounce motion-reduce:animate-none">
            <span className="text-3xl font-black text-yellow-400 drop-shadow-lg">
                +{amount} XP
            </span>
        </div>
    );
};

// Tab type for switching between content and source
type ActiveTab = 'content' | 'source';

const SequentialCoursePlayerMobile: React.FC<MobilePlayerProps> = ({
    assignment,
    onExit,
    simulateGuest = false
}) => {
    const { course } = useCourseStore();
    const { currentUser } = useAuth();
    const playSound = useSound();

    // --- Core State ---
    const [playbackQueue, setPlaybackQueue] = useState<ActivityBlock[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [historyStack, setHistoryStack] = useState<number[]>([]);

    // --- Tab State (Mobile-specific) ---
    const [activeTab, setActiveTab] = useState<ActiveTab>('content');
    const hasSourceContent = !!(course?.pdfSource || course?.fullBookContent);
    const shouldShowSourceTab = course?.showSourceToStudent && hasSourceContent;

    // --- Interaction State ---
    const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
    const [stepStatus, setStepStatus] = useState<'idle' | 'ready_to_check' | 'success' | 'failure'>('idle');
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
    const [stepResults, setStepResults] = useState<Record<string, 'success' | 'failure' | 'viewed'>>({});
    const [hintsVisible, setHintsVisible] = useState<Record<string, number>>({});
    const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);

    // --- Gamification (Basic) ---
    const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(DEFAULT_GAMIFICATION_PROFILE);
    const [showFloater, setShowFloater] = useState<{ id: number; amount: number } | null>(null);

    const currentBlock = playbackQueue[currentIndex];
    const isLast = currentIndex === playbackQueue.length - 1;
    const isFirst = currentIndex === 0;
    const isExamMode = course?.mode === 'exam';

    // Initialize queue
    useEffect(() => {
        if (course?.syllabus) {
            const initialBlocks = course.syllabus.flatMap(m =>
                m.learningUnits.flatMap(u => (u.activityBlocks || []) as ActivityBlock[])
            );
            setPlaybackQueue(initialBlocks);
        }
    }, [course]);

    // Load streak on mount
    useEffect(() => {
        if (currentUser?.uid) {
            checkDailyStreak(currentUser.uid).then(result => {
                setGamificationProfile(prev => ({
                    ...prev,
                    currentStreak: result.currentStreak,
                    frozenDays: result.frozenDays
                }));
            });
        }
    }, [currentUser]);

    // Reset status on block change
    useEffect(() => {
        if (!currentBlock) return;

        const prevResult = stepResults[currentBlock.id];
        if (prevResult) {
            setStepStatus(prevResult === 'viewed' ? 'idle' : prevResult as any);
            setFeedbackMsg(null);
        } else {
            setStepStatus('idle');
            setFeedbackMsg(null);
        }

        // Always start on content tab when changing blocks
        setActiveTab('content');
    }, [currentIndex, currentBlock?.id]);

    // --- Navigation ---
    const handleNext = useCallback(() => {
        if (isLast) {
            // Course complete - exit
            onExit?.();
            return;
        }
        setHistoryStack(prev => [...prev, currentIndex]);
        setCurrentIndex(prev => prev + 1);
    }, [currentIndex, isLast, onExit]);

    const handleBack = useCallback(() => {
        if (historyStack.length > 0) {
            const prevIndex = historyStack[historyStack.length - 1];
            setHistoryStack(prev => prev.slice(0, -1));
            setCurrentIndex(prevIndex);
        } else if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex, historyStack]);

    // --- Answer Handling ---
    const handleAnswerSelect = (val: any) => {
        if (stepStatus === 'success' || stepStatus === 'failure') return;
        setUserAnswers(prev => ({ ...prev, [currentBlock.id]: val }));
        setStepStatus('ready_to_check');
    };

    const processResult = async (isCorrect: boolean) => {
        setStepResults(prev => ({ ...prev, [currentBlock.id]: isCorrect ? 'success' : 'failure' }));

        const hintsUsed = hintsVisible[currentBlock.id] || 0;
        const score = calculateQuestionScore({
            isCorrect,
            attempts: 1,
            hintsUsed,
            responseTimeSec: 0
        });

        if (isCorrect) {
            setStepStatus('success');
            playSound('success');
            setFeedbackMsg('מצוין! תשובה נכונה');

            const xpGain = Math.round(score * 0.5);
            setGamificationProfile(prev => ({
                ...prev,
                xp: prev.xp + xpGain,
                gems: prev.gems + 1
            }));
            setShowFloater({ id: Date.now(), amount: xpGain });
        } else {
            setStepStatus('failure');
            playSound('failure');
            setFeedbackMsg('טעות, נסה שוב');
        }

        // Sync to server
        if (currentUser?.uid && !simulateGuest) {
            await syncProgress(currentUser.uid, gamificationProfile);
        }
    };

    const handleCheck = useCallback(async () => {
        const passiveTypes = ['text', 'video', 'image', 'pdf', 'gem-link', 'podcast'];

        if (passiveTypes.includes(currentBlock.type)) {
            setStepResults(prev => ({ ...prev, [currentBlock.id]: 'viewed' }));
            handleNext();
            return;
        }

        if (stepStatus === 'success' || stepStatus === 'failure') {
            handleNext();
            return;
        }

        const answer = userAnswers[currentBlock.id];

        if (currentBlock.type === 'multiple-choice') {
            if (!answer) return;
            const isCorrect = answer === currentBlock.content.correctAnswer;
            processResult(isCorrect);
        } else if (currentBlock.type === 'open-question') {
            if (!answer || answer.trim().length < 3) return;

            setIsCheckingAnswer(true);
            try {
                const sourceText = course?.syllabus?.[0]?.learningUnits?.[0]?.activityBlocks
                    ?.filter((b: any) => b.type === 'text')
                    ?.map((b: any) => b.content)
                    ?.join('\n') || '';

                const question = currentBlock.content?.question || '';
                const modelAnswer = currentBlock.metadata?.modelAnswer || currentBlock.content?.modelAnswer || '';

                console.log('📝 [Mobile] Checking open question:', { question, answer, modelAnswer: modelAnswer?.substring(0, 50), sourceTextLength: sourceText.length });

                const result = await checkOpenQuestionAnswer(
                    question, answer, modelAnswer, sourceText,
                    isExamMode ? 'exam' : 'learning'
                );

                console.log('✅ [Mobile] AI Response:', result);

                if (result.status === 'correct') {
                    setFeedbackMsg(result.feedback || 'מצוין! תשובה נכונה.');
                    processResult(true);
                } else {
                    setFeedbackMsg(result.feedback || 'נסה שוב');
                    playSound('failure');
                }
            } catch (error: any) {
                console.error('❌ [Mobile] Error checking answer:', error);
                setFeedbackMsg('שגיאה בבדיקה. ' + (error?.message || ''));
            } finally {
                setIsCheckingAnswer(false);
            }
        }
    }, [currentBlock, userAnswers, stepStatus, handleNext, course, isExamMode, playSound]);

    // --- Block Content Renderer ---
    const renderBlockContent = () => {
        if (!currentBlock) return null;

        const blockContent = currentBlock.content;
        const blockType = currentBlock.type;

        switch (blockType) {
            case 'text':
                return (
                    <div
                        className="prose prose-lg max-w-none text-slate-800 dark:text-slate-200"
                        dangerouslySetInnerHTML={{ __html: formatTeacherContent(typeof blockContent === 'string' ? blockContent : '') }}
                    />
                );

            case 'video':
                const videoUrl = typeof blockContent === 'string' ? blockContent : blockContent?.url;
                return (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                        <iframe
                            src={videoUrl}
                            className="w-full h-full"
                            allowFullScreen
                            title="וידאו"
                            loading="lazy"
                        />
                    </div>
                );

            case 'image':
                const imageUrl = typeof blockContent === 'string' ? blockContent : blockContent?.url;
                return (
                    <img
                        src={imageUrl}
                        alt={currentBlock.title || 'תמונה'}
                        className="max-w-full h-auto rounded-xl"
                        loading="lazy"
                        decoding="async"
                    />
                );

            case 'multiple-choice':
                const mcContent = blockContent as { question: string; options: string[]; correctAnswer: string };
                const selectedAnswer = userAnswers[currentBlock.id];

                return (
                    <div className="space-y-4">
                        <h3
                            className="text-xl font-bold text-slate-800 dark:text-white mb-6"
                            dangerouslySetInnerHTML={{ __html: formatTeacherContent(mcContent.question || '') }}
                        />
                        <div className="space-y-3" role="radiogroup" aria-label="אפשרויות תשובה">
                            {mcContent.options.map((option, idx) => {
                                const isSelected = selectedAnswer === option;
                                const showResult = stepStatus === 'success' || stepStatus === 'failure';
                                const isCorrect = option === mcContent.correctAnswer;

                                let buttonClass = 'w-full min-h-[56px] p-4 text-right rounded-xl border-2 transition-all ';

                                if (showResult) {
                                    if (isCorrect) {
                                        buttonClass += 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200';
                                    } else if (isSelected && !isCorrect) {
                                        buttonClass += 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200';
                                    } else {
                                        buttonClass += 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 opacity-50';
                                    }
                                } else {
                                    buttonClass += isSelected
                                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200'
                                        : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-violet-300 dark:hover:border-violet-500';
                                }

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleAnswerSelect(option)}
                                        disabled={showResult}
                                        role="radio"
                                        aria-checked={isSelected}
                                        className={buttonClass}
                                    >
                                        <span className="font-medium">{option}</span>
                                        {showResult && isCorrect && (
                                            <IconCheck className="inline-block mr-2 w-5 h-5 text-green-600" aria-hidden="true" />
                                        )}
                                        {showResult && isSelected && !isCorrect && (
                                            <IconX className="inline-block mr-2 w-5 h-5 text-red-600" aria-hidden="true" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'open-question':
                const oqContent = blockContent as { question: string };
                return (
                    <div className="space-y-4">
                        <h3
                            className="text-xl font-bold text-slate-800 dark:text-white mb-4"
                            dangerouslySetInnerHTML={{ __html: formatTeacherContent(oqContent.question || '') }}
                        />
                        <textarea
                            value={userAnswers[currentBlock.id] || ''}
                            onChange={(e) => handleAnswerSelect(e.target.value)}
                            disabled={stepStatus === 'success'}
                            placeholder="כתוב את תשובתך כאן..."
                            className="w-full min-h-[150px] p-4 text-lg border-2 border-gray-200 dark:border-slate-600 rounded-xl
                                     bg-white dark:bg-slate-700 text-slate-800 dark:text-white
                                     focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-800
                                     resize-none transition-colors"
                            dir="rtl"
                        />
                    </div>
                );

            case 'fill_in_blanks':
                return <ClozeQuestion block={currentBlock} onComplete={(score) => processResult(score >= 50)} />;

            case 'ordering':
                return <OrderingQuestion block={currentBlock} onComplete={(score) => processResult(score >= 50)} />;

            case 'categorization':
                return <CategorizationQuestion block={currentBlock} onComplete={(score) => processResult(score >= 50)} />;

            case 'memory_game':
                return <MemoryGameQuestion block={currentBlock} onComplete={(score) => processResult(score >= 50)} />;

            case 'true_false_speed':
                return <TrueFalseQuestion block={currentBlock} onComplete={(score) => processResult(score >= 50)} />;

            case 'matching':
                return <MatchingQuestion block={currentBlock} onComplete={(score) => processResult(score >= 50)} />;

            case 'podcast':
                return <PodcastPlayer block={currentBlock} />;

            case 'infographic':
                return <InfographicViewer block={currentBlock} />;

            default:
                return (
                    <div className="text-center text-gray-500 dark:text-gray-400 p-8">
                        סוג תוכן לא נתמך: {blockType}
                    </div>
                );
        }
    };

    // --- Source Content Renderer ---
    // Priority: Show fullBookContent if available, fallback to pdfSource
    const renderSourceContent = () => {
        if (course?.fullBookContent) {
            return (
                <div className="p-4 prose max-w-none text-base leading-relaxed" dir="rtl">
                    <div className="font-serif text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                        {course.fullBookContent}
                    </div>
                </div>
            );
        }

        if (course?.pdfSource) {
            return (
                <div className="h-full flex flex-col min-h-[60vh]">
                    <iframe
                        src={course.pdfSource}
                        className="w-full flex-1 border-none rounded-lg"
                        title="מסמך מקור"
                        loading="lazy"
                    />
                    {/* Fallback link if iframe fails to load */}
                    <div className="p-3 bg-white dark:bg-slate-800 border-t text-center">
                        <a
                            href={course.pdfSource}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            פתח את המסמך בחלון חדש ↗
                        </a>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center text-gray-500 p-8">
                אין מסמך מקור זמין
            </div>
        );
    };

    // --- Loading State ---
    if (!course || course.id === 'loading') {
        return (
            <div className="min-h-screen bg-wizdi-royal flex items-center justify-center">
                <div className="text-white text-xl font-bold animate-pulse motion-reduce:animate-none">
                    טוען שיעור...
                </div>
            </div>
        );
    }

    if (!currentBlock) {
        return (
            <div className="min-h-screen bg-wizdi-royal flex items-center justify-center">
                <div className="text-white text-xl font-bold">
                    אין תוכן להצגה
                </div>
            </div>
        );
    }

    // Progress percentage
    const progressPercent = Math.round(((currentIndex + 1) / playbackQueue.length) * 100);

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col" dir="rtl">
            {/* XP Animation */}
            {showFloater && <XpFloater amount={showFloater.amount} onComplete={() => setShowFloater(null)} />}

            {/* Header - Compact Mobile Version */}
            <header className="bg-wizdi-royal dark:bg-slate-800 text-white px-4 py-3 safe-area-inset-top">
                <div className="flex items-center justify-between">
                    {/* Exit Button */}
                    <button
                        onClick={onExit}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                        aria-label="יציאה"
                    >
                        <IconHome className="w-6 h-6" />
                    </button>

                    {/* Progress */}
                    <div className="flex-1 mx-4">
                        <div className="flex items-center justify-center gap-2 text-sm font-medium">
                            <span>{currentIndex + 1}</span>
                            <span className="text-white/60">/</span>
                            <span>{playbackQueue.length}</span>
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-wizdi-cyan rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                                role="progressbar"
                                aria-valuenow={progressPercent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            />
                        </div>
                    </div>

                    {/* Gamification Stats */}
                    <div className="flex items-center gap-3">
                        {/* Streak */}
                        <div className="flex items-center gap-1">
                            <span className="text-lg">🔥</span>
                            <span className="font-bold text-sm">{gamificationProfile.currentStreak}</span>
                        </div>
                        {/* XP */}
                        <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-lg">
                            <IconStar className="w-4 h-4 text-yellow-300" />
                            <span className="font-bold text-sm text-yellow-300">{gamificationProfile.xp}</span>
                        </div>
                        {/* Gems */}
                        <div className="flex items-center gap-1">
                            <span className="text-lg">💎</span>
                            <span className="font-bold text-sm text-cyan-300">{gamificationProfile.gems}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab Switcher (Only if source is available) */}
            {shouldShowSourceTab && (
                <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4">
                    <div className="flex" role="tablist" aria-label="תצוגת תוכן">
                        <button
                            onClick={() => setActiveTab('content')}
                            role="tab"
                            aria-selected={activeTab === 'content'}
                            className={`flex-1 min-h-[48px] py-3 text-center font-bold transition-colors border-b-2 ${
                                activeTab === 'content'
                                    ? 'border-wizdi-action text-wizdi-action dark:text-violet-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            📝 תוכן
                        </button>
                        <button
                            onClick={() => setActiveTab('source')}
                            role="tab"
                            aria-selected={activeTab === 'source'}
                            className={`flex-1 min-h-[48px] py-3 text-center font-bold transition-colors border-b-2 ${
                                activeTab === 'source'
                                    ? 'border-wizdi-action text-wizdi-action dark:text-violet-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                        >
                            <IconBook className="inline-block w-5 h-5 ml-1" />
                            מקור
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 pb-32">
                <div
                    role="tabpanel"
                    aria-label={activeTab === 'content' ? 'תוכן השיעור' : 'מסמך מקור'}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 min-h-[300px]"
                >
                    {activeTab === 'content' ? renderBlockContent() : renderSourceContent()}
                </div>

                {/* Feedback Message */}
                {feedbackMsg && (
                    <div
                        role="alert"
                        aria-live="polite"
                        className={`mt-4 p-4 rounded-xl text-center font-bold ${
                            stepStatus === 'success'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700'
                                : stepStatus === 'failure'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700'
                        }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            {stepStatus === 'success' ? (
                                <><IconCheck className="w-5 h-5" aria-hidden="true" /> {feedbackMsg}</>
                            ) : stepStatus === 'failure' ? (
                                <><IconX className="w-5 h-5" aria-hidden="true" /> {feedbackMsg}</>
                            ) : (
                                <><span className="text-lg" aria-hidden="true">💭</span> {feedbackMsg}</>
                            )}
                        </span>
                    </div>
                )}
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 py-3 safe-area-inset-bottom">
                <div className="flex items-center justify-between gap-4">
                    {/* Back Button */}
                    <button
                        onClick={handleBack}
                        disabled={isFirst && historyStack.length === 0}
                        className={`min-w-[56px] min-h-[56px] flex items-center justify-center rounded-xl transition-all ${
                            isFirst && historyStack.length === 0
                                ? 'bg-gray-100 dark:bg-slate-700 text-gray-300 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95'
                        }`}
                        aria-label="הקודם"
                    >
                        <IconChevronRight className="w-7 h-7" />
                    </button>

                    {/* Main Action Button - Hidden for passive (non-question) blocks */}
                    {!['text', 'video', 'image', 'pdf', 'gem-link', 'podcast', 'activity-intro', 'scenario-image', 'infographic'].includes(currentBlock.type) && (
                        <button
                            onClick={handleCheck}
                            disabled={isCheckingAnswer || (stepStatus === 'ready_to_check' && !userAnswers[currentBlock.id])}
                            className={`flex-1 min-h-[56px] rounded-xl font-bold text-lg transition-all active:scale-[0.98] ${
                                stepStatus === 'success'
                                    ? 'bg-green-500 text-white'
                                    : stepStatus === 'failure'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-wizdi-action hover:bg-wizdi-action-hover text-white shadow-lg'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-label={
                                stepStatus === 'success' || stepStatus === 'failure'
                                    ? 'המשך'
                                    : stepStatus === 'ready_to_check'
                                        ? 'בדוק'
                                        : 'המשך'
                            }
                        >
                            {isCheckingAnswer ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    בודק...
                                </span>
                            ) : stepStatus === 'success' || stepStatus === 'failure' ? (
                                'המשך →'
                            ) : stepStatus === 'ready_to_check' ? (
                                'בדוק ✓'
                            ) : (
                                'בדיקה'
                            )}
                        </button>
                    )}

                    {/* Forward Button */}
                    <button
                        onClick={handleNext}
                        disabled={isLast}
                        className={`min-w-[56px] min-h-[56px] flex items-center justify-center rounded-xl transition-all ${
                            isLast
                                ? 'bg-gray-100 dark:bg-slate-700 text-gray-300 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95'
                        }`}
                        aria-label="הבא"
                    >
                        <IconChevronLeft className="w-7 h-7" />
                    </button>
                </div>
            </nav>
        </div>
    );
};

export default SequentialCoursePlayerMobile;
