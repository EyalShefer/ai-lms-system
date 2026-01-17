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
import { checkOpenQuestionAnswer } from '../services/ai/geminiApi';
import ThinkingOverlay from './ThinkingOverlay';
import { syncProgress, checkDailyStreak, DEFAULT_GAMIFICATION_PROFILE } from '../services/gamificationService';
import { onSessionComplete, updateProficiencyVector, updateErrorFingerprint } from '../services/profileService';
import { useStudentTelemetry } from '../hooks/useStudentTelemetry';
import { makeAdaptiveDecision, applyPolicyDecision, selectVariant, getInitialStudentState, type BKTAction } from '../services/adaptivePolicyService';
import ShopModal from './ShopModal';
import SuccessModal from './SuccessModal';
import type { GamificationProfile } from '../shared/types/courseTypes';
import TeacherCockpit from './TeacherCockpit'; // NEW: Teacher View
import { calculateQuestionScore, SCORING_CONFIG } from '../utils/scoring'; // CRITICAL FIX: Import scoring system
import { submitAssignment, type SubmissionData } from '../services/submissionService'; // Student submission
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';


// --- Specialized Sub-Components ---
import ClozeQuestion from './ClozeQuestion';
import OrderingQuestion from './OrderingQuestion';
import CategorizationQuestion from './CategorizationQuestion';
import MemoryGameQuestion from './MemoryGameQuestion';
import TrueFalseQuestion from './TrueFalseQuestion';
import { PodcastPlayer } from './PodcastPlayer';
import { AudioRecorderBlock } from './AudioRecorderBlock';
import { InfographicViewer } from './InfographicViewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeHtml } from '../utils/sanitize';


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

    // DEBUG: Track render count
    const renderCount = React.useRef(0);
    renderCount.current++;

    useEffect(() => {
        console.log(`🔄 SequentialCoursePlayer MOUNTED. CourseId: ${course?.id}`);
        return () => console.log(`❌ SequentialCoursePlayer UNMOUNTED. CourseId: ${course?.id}`);
    }, []);

    if (renderCount.current < 10 || renderCount.current % 100 === 0) {
        console.log(`🔄 SequentialCoursePlayer Render #${renderCount.current}`, { courseId: course?.id });
    }

    const playSound = useSound();
    const { currentUser } = useAuth(); // for FeedbackWidget


    // --- State: The "Pool" ---
    // --- State: The "Pool" (Mutable Queue for Adaptive Injection) ---
    const [playbackQueue, setPlaybackQueue] = useState<ActivityBlock[]>([]);

    // Inspector Mode (Wizdi-Monitor)
    const [inspectorMode, setInspectorMode] = useState(false);
    const [forceExam, setForceExam] = useState(false); // DEBUG: Override mode
    const isExamMode = forceExam || course?.mode === 'exam';

    // Source PDF/Text Panel (side-by-side view)
    const [showSourcePanel, setShowSourcePanel] = useState(false);
    const hasSourceContent = !!(course?.pdfSource || course?.fullBookContent);
    const shouldShowSource = course?.showSourceToStudent && hasSourceContent;

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

    // Use course.id as dependency to prevent infinite re-renders
    // The syllabus content is loaded once when course.id changes
    useEffect(() => {
        if (course?.syllabus && course.id !== 'loading') {
            const initialBlocks = course.syllabus.flatMap(m => m.learningUnits.flatMap(u => (u.activityBlocks || []) as ActivityBlock[]));
            setPlaybackQueue(initialBlocks);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [course?.id]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [historyStack, setHistoryStack] = useState<number[]>([]);
    const [isNavigatingBack, setIsNavigatingBack] = useState(false); // Track back navigation to disable auto-skip

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
    const [isCheckingOpenQuestion, setIsCheckingOpenQuestion] = useState(false); // NEW: Open Question AI Check
    const [openQuestionAttempts, setOpenQuestionAttempts] = useState<Record<string, number>>({}); // Track attempts per block

    // --- State: Results Tracking (for Timeline Colors & Persistence) ---
    const [stepResults, setStepResults] = useState<Record<string, 'success' | 'failure' | 'viewed'>>({});
    const [hintsVisible, setHintsVisible] = useState<Record<string, number>>({});


    // --- State: Gamification ---
    // Persistent Profile (synced with Firestore)
    const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(DEFAULT_GAMIFICATION_PROFILE);

    // --- State: Submission ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // UI Helpers
    const [combo, setCombo] = useState(0); // Multiplier
    const [showFloater, setShowFloater] = useState<{ id: number, amount: number } | null>(null);
    const [isShopOpen, setIsShopOpen] = useState(false);

    // --- ADAPTIVE: Student Telemetry Hook ---
    const lessonId = course?.syllabus?.[0]?.learningUnits?.[0]?.id || 'unknown_lesson';
    const telemetry = useStudentTelemetry(currentUser?.uid || 'guest', lessonId);

    // --- ADAPTIVE: Collected Error Tags for Error Fingerprint ---
    const [sessionErrorTags, setSessionErrorTags] = useState<string[]>([]);

    // --- ADAPTIVE: Toast for Challenge/Mastery notifications ---
    const [adaptiveToast, setAdaptiveToast] = useState<{
        show: boolean;
        type: 'success' | 'info' | 'challenge';
        title: string;
        description: string;
    } | null>(null);

    // --- ADAPTIVE: Current mastery level and accuracy (for variant selection) ---
    const [currentMastery, setCurrentMastery] = useState(0.5);
    const [recentAccuracy, setRecentAccuracy] = useState(0.5);

    // --- ADAPTIVE: Track which variant is being shown for each block ---
    const [activeVariants, setActiveVariants] = useState<Record<string, 'original' | 'scaffolding' | 'enrichment'>>({});

    // Initial Load & Streak Check + Profile-based Starting Level
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

            // --- ADAPTIVE: Load existing profile to set personalized starting level ---
            const currentTopicId = playbackQueue[0]?.metadata?.tags?.[0] ||
                playbackQueue[0]?.metadata?.topic ||
                'general';

            getInitialStudentState(currentUser.uid, currentTopicId).then(({ mastery, accuracy }) => {
                setCurrentMastery(mastery);
                setRecentAccuracy(accuracy);

                if (mastery !== 0.5 || accuracy !== 0.5) {
                    console.log(`📊 Loaded profile: Starting with mastery=${mastery.toFixed(2)}, accuracy=${accuracy.toFixed(2)}`);

                    // Show toast if starting from non-default level
                    if (mastery > 0.7) {
                        setAdaptiveToast({
                            show: true,
                            type: 'challenge',
                            title: '⭐ נתוני פרופיל נטענו',
                            description: 'מתחילים מרמה מתקדמת על בסיס הביצועים הקודמים שלך!'
                        });
                        setTimeout(() => setAdaptiveToast(null), 3000);
                    } else if (mastery < 0.35) {
                        setAdaptiveToast({
                            show: true,
                            type: 'info',
                            title: '📚 נתוני פרופיל נטענו',
                            description: 'מתחילים עם תוכן מותאם כדי לחזק את הבסיס'
                        });
                        setTimeout(() => setAdaptiveToast(null), 3000);
                    }
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.uid]);


    // Reset or Restore status when moving to new block
    // Also: Auto-skip redundant text blocks if they will be shown in split-view with the next question
    useEffect(() => {
        if (!currentBlock) return;

        // --- ADAPTIVE: Select appropriate variant based on student performance ---
        const questionTypes = [
            'multiple-choice', 'open-question', 'fill_in_blanks', 'ordering',
            'categorization', 'memory_game', 'true_false_speed',
            // 8 New Question Types
            'matching', 'highlight', 'sentence_builder', 'image_labeling',
            'table_completion', 'text_selection', 'rating_scale', 'matrix'
        ];
        if (questionTypes.includes(currentBlock.type) && !activeVariants[currentBlock.id]) {
            // Check if this block has variants available
            const hasScaffolding = !!currentBlock.metadata?.scaffolding_id;
            const hasEnrichment = !!currentBlock.metadata?.enrichment_id;

            if (hasScaffolding || hasEnrichment) {
                // Select variant based on current mastery and accuracy
                const selectedVariant = selectVariant(currentBlock, currentMastery, recentAccuracy);

                if (selectedVariant !== 'original') {
                    // Get the variant block from metadata (where it's stored during generation)
                    const variantBlock = selectedVariant === 'scaffolding'
                        ? currentBlock.metadata?.scaffolding_variant
                        : currentBlock.metadata?.enrichment_variant;

                    if (variantBlock) {
                        // Update the queue with the variant block
                        const newQueue = [...playbackQueue];
                        newQueue[currentIndex] = variantBlock;
                        setPlaybackQueue(newQueue);

                        // Track which variant is active
                        setActiveVariants(prev => ({ ...prev, [currentBlock.id]: selectedVariant }));

                        console.log(`🎯 Adaptive: Selected ${selectedVariant} variant for block ${currentBlock.id}`);
                        console.log(`   Original content:`, currentBlock.content);
                        console.log(`   Variant content:`, variantBlock.content);

                        // Show subtle toast for variant selection
                        if (selectedVariant === 'scaffolding') {
                            setAdaptiveToast({
                                show: true,
                                type: 'info',
                                title: '📚 תוכן מותאם',
                                description: 'הותאם לך תוכן עם דוגמאות נוספות'
                            });
                            setTimeout(() => setAdaptiveToast(null), 2500);
                        } else if (selectedVariant === 'enrichment') {
                            setAdaptiveToast({
                                show: true,
                                type: 'challenge',
                                title: '🚀 אתגר!',
                                description: 'קיבלת שאלה ברמה מתקדמת'
                            });
                            setTimeout(() => setAdaptiveToast(null), 2500);
                        }
                    } else {
                        console.warn(`⚠️ Variant ${selectedVariant} selected but variant block not found in metadata`);
                        setActiveVariants(prev => ({ ...prev, [currentBlock.id]: 'original' }));
                    }
                } else {
                    setActiveVariants(prev => ({ ...prev, [currentBlock.id]: 'original' }));
                }
            }
        }
        // --- END VARIANT SELECTION ---

        // --- AUTO-SKIP LOGIC ---
        // If current block is passive text/pdf AND next block is interactive (question),
        // skip this block because the text will be displayed in split-view anyway
        const passiveContextTypes = ['text', 'pdf'];
        const interactiveTypes = [
            'multiple-choice', 'open-question', 'fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'true_false_speed',
            // 8 New Question Types
            'matching', 'highlight', 'sentence_builder', 'image_labeling', 'table_completion', 'text_selection', 'rating_scale', 'matrix'
        ];
        const nextBlock = playbackQueue[currentIndex + 1];

        // Don't auto-skip if user is navigating back - they want to see this content
        if (!isNavigatingBack &&
            passiveContextTypes.includes(currentBlock.type) &&
            nextBlock &&
            interactiveTypes.includes(nextBlock.type)) {
            // Auto-skip: mark as viewed and move to next
            setStepResults(prev => ({ ...prev, [currentBlock.id]: 'viewed' }));
            setHistoryStack(prev => [...prev, currentIndex]);
            setCurrentIndex(prev => prev + 1);
            return;
        }
        // Reset back navigation flag after processing
        if (isNavigatingBack) {
            setIsNavigatingBack(false);
        }
        // --- END AUTO-SKIP ---

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

            // --- ADAPTIVE: Start telemetry tracking for interactive blocks ---
            const interactiveTypes = [
                'multiple-choice', 'open-question', 'fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'true_false_speed',
                // 8 New Question Types
                'matching', 'highlight', 'sentence_builder', 'image_labeling', 'table_completion', 'text_selection', 'rating_scale', 'matrix'
            ];
            if (interactiveTypes.includes(currentBlock.type)) {
                telemetry.onQuestionStart(currentBlock.id, currentBlock.type);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, currentBlock?.id]); // Removed playbackQueue to prevent infinite loop - setPlaybackQueue is called inside


    // --- Handlers ---

    const handleShowHint = (blockId: string) => {
        const newLevel = (hintsVisible[blockId] || 0) + 1;
        setHintsVisible(prev => ({ ...prev, [blockId]: newLevel }));

        // --- ADAPTIVE: Track hint usage for profile ---
        telemetry.onHintRequested();
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

    // 2a. Check Open Question with AI (Scaffolded Feedback)
    const handleCheckOpenQuestion = useCallback(async () => {
        const answer = userAnswers[currentBlock.id];
        if (!answer || answer.trim().length < 3) return;

        setIsCheckingOpenQuestion(true);
        const currentAttempts = (openQuestionAttempts[currentBlock.id] || 0) + 1;
        setOpenQuestionAttempts(prev => ({ ...prev, [currentBlock.id]: currentAttempts }));

        try {
            // Get context from course
            const sourceText = course?.syllabus?.[0]?.learningUnits?.[0]?.activityBlocks
                ?.filter((b: any) => b.type === 'text')
                ?.map((b: any) => b.content)
                ?.join('\n') || '';

            const question = currentBlock.content?.question || '';
            const modelAnswer = currentBlock.metadata?.modelAnswer || currentBlock.content?.modelAnswer || '';

            const result = await checkOpenQuestionAnswer(
                question,
                answer,
                modelAnswer,
                sourceText,
                isExamMode ? 'exam' : 'learning'
            );

            if (result.status === 'correct') {
                setStepStatus('success');
                playSound('success');
                setFeedbackMsg(result.feedback || 'מצוין! תשובה נכונה.');
                setStepResults(prev => ({ ...prev, [currentBlock.id]: 'success' }));

                // Gamification for correct open answer
                const xpGain = Math.max(100 - (currentAttempts - 1) * 20, 40);
                setGamificationProfile(prev => ({
                    ...prev,
                    xp: prev.xp + xpGain,
                    gems: prev.gems + (currentAttempts === 1 ? 2 : 1),
                }));
                setShowFloater({ id: Date.now(), amount: xpGain });

            } else if (result.status === 'partial') {
                // Keep in ready_to_check state - allow retry with guidance
                setStepStatus('ready_to_check');
                setFeedbackMsg(result.feedback || 'כמעט! נסה להרחיב את התשובה.');
                playSound('failure');

            } else {
                // Incorrect - give scaffolded hint
                setStepStatus('ready_to_check'); // Allow retry
                setFeedbackMsg(result.feedback || 'נסה שוב. קרא שוב את הטקסט ושים לב לפרטים.');
                playSound('failure');

                // After 3 attempts, show more help
                if (currentAttempts >= 3) {
                    setFeedbackMsg(prev => (prev || '') + '\n💡 רמז: ' + (currentBlock.metadata?.progressiveHints?.[0] || 'חפש את המילים המרכזיות בטקסט.'));
                }
            }
        } catch (error) {
            console.error('Error checking open question:', error);
            setFeedbackMsg('שגיאה בבדיקה. נסה שוב.');
        } finally {
            setIsCheckingOpenQuestion(false);
        }
    }, [currentBlock, userAnswers, course, isExamMode, openQuestionAttempts, playSound]);

    // 2b. Check Action (The "Lime Button")
    const handleCheck = useCallback(() => {
        // 1. Check if PASSIVE block (Text, Media, Activity Images) -> Always simple continue
        const passiveTypes = ['text', 'video', 'image', 'pdf', 'gem-link', 'podcast', 'activity-intro', 'scenario-image'];
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
        } else if (currentBlock.type === 'open-question') {
            // Delegate to AI-based scaffolded checking
            handleCheckOpenQuestion();
            return;
        } else {
            // Complex blocks usually drive themselves, but if we fall through:
            return;
        }

        processResult(isCorrect);
    }, [currentBlock, userAnswers, stepStatus, handleCheckOpenQuestion]);

    // 3. Process Result (Gamification + ADAPTIVE BKT Logic)
    // ✅ FIXED: Now uses central scoring system according to PROJECT_DNA.md
    const processResult = async (isCorrect: boolean) => {
        // Save Result for Timeline
        setStepResults(prev => ({ ...prev, [currentBlock.id]: isCorrect ? 'success' : 'failure' }));

        // ✅ CRITICAL FIX: Calculate score using the central scoring function
        const hintsUsed = hintsVisible[currentBlock.id] || 0;
        const prevAttempts = stepResults[currentBlock.id] ? 1 : 0; // If already attempted, it's at least attempt #2

        // --- ADAPTIVE: Track telemetry for profile ---
        telemetry.onAnswerSubmitted(isCorrect, prevAttempts + 1);

        // --- ADAPTIVE: Collect error tags for Error Fingerprint ---
        if (!isCorrect && currentBlock.metadata?.adaptive_analysis?.distractor_analysis) {
            const selectedAnswer = userAnswers[currentBlock.id];
            const distractor = currentBlock.metadata.adaptive_analysis.distractor_analysis.find(
                (d: any) => d.option_text === selectedAnswer
            );
            if (distractor?.error_tag) {
                setSessionErrorTags(prev => [...prev, distractor.error_tag]);
            }
        }

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

                        // --- ADAPTIVE: Update Proficiency Vector with new mastery ---
                        if (data.mastery !== undefined && user) {
                            const topicId = currentBlock.metadata?.tags?.[0] ||
                                course?.syllabus?.[0]?.learningUnits?.[0]?.title ||
                                'general';
                            updateProficiencyVector(user.uid, topicId, data.mastery).catch(e =>
                                console.error("Proficiency Vector update failed:", e)
                            );

                            // --- ADAPTIVE: Update local mastery for variant selection ---
                            setCurrentMastery(data.mastery);
                        }

                        // --- ADAPTIVE: Update recent accuracy for variant selection ---
                        const recentResults = Object.values(stepResults).slice(-5);
                        const successCount = recentResults.filter(r => r === 'success').length;
                        const newAccuracy = recentResults.length > 0 ? successCount / recentResults.length : 0.5;
                        setRecentAccuracy(newAccuracy);

                        // --- POLICY ENGINE: Act on BKT recommendations ---
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
                        } else if (data.action === 'challenge' || data.action === 'mastered') {
                            // --- ADAPTIVE POLICY: Challenge Mode & Mastery Skip ---
                            try {
                                const decision = await makeAdaptiveDecision(
                                    data.action as BKTAction,
                                    data.mastery || 0,
                                    playbackQueue,
                                    currentIndex,
                                    currentBlock,
                                    user.uid
                                );

                                console.log(`🧠 Adaptive Decision: ${decision.action}`, decision);

                                if (decision.action === 'skip' || decision.action === 'skip_to_topic') {
                                    // Show toast notification
                                    if (decision.toast) {
                                        setAdaptiveToast({
                                            show: true,
                                            ...decision.toast
                                        });
                                        // Auto-hide after 3 seconds
                                        setTimeout(() => setAdaptiveToast(null), 3000);
                                    }

                                    // Apply the skip after a brief delay for UX
                                    setTimeout(() => {
                                        const newIndex = applyPolicyDecision(
                                            decision,
                                            currentIndex,
                                            playbackQueue.length
                                        );
                                        setHistoryStack(prev => [...prev, currentIndex]);
                                        setCurrentIndex(newIndex);
                                    }, 1500);

                                    setFeedbackMsg(decision.message || "");
                                } else {
                                    // Just show feedback, no skip
                                    if (decision.toast) {
                                        setAdaptiveToast({
                                            show: true,
                                            ...decision.toast
                                        });
                                        setTimeout(() => setAdaptiveToast(null), 3000);
                                    }
                                    setFeedbackMsg(prev => (prev || "") + "\n" + (decision.message || ""));
                                }
                            } catch (policyErr) {
                                console.error("Policy decision error:", policyErr);
                                // Fallback to simple messages
                                if (data.action === 'challenge') {
                                    setFeedbackMsg(prev => (prev || "") + "\n🌟 מצוין! המערכת מזהה שליטה גבוהה.");
                                } else {
                                    setFeedbackMsg(prev => (prev || "") + "\n🏆 שליטה מלאה! מוכנים לאתגר הבא.");
                                }
                            }
                        }
                    }
                }).catch(err => console.error("BKT Sync Failed", err));
            }
        } catch (e) {
            console.error("Adaptive connection error", e);
        }
    };

    // Callback for "Self-Checking" components (Cloze, Ordering, Categorization)
    // ✅ FIXED: Now properly handles partial scores from complex components
    const handleComplexBlockComplete = (score: number, telemetryData?: { attempts?: number, hintsUsed?: number }) => {
        // Complex blocks pass their own score (0-100)
        // We need to handle partial scores properly, not just pass/fail

        // Update hints if provided by the component
        if (telemetryData?.hintsUsed && telemetryData.hintsUsed > 0) {
            setHintsVisible(prev => ({ ...prev, [currentBlock.id]: telemetryData.hintsUsed ?? 0 }));
        }

        // Process with actual score for proper feedback
        processComplexResult(score, telemetryData);
    };

    // NEW: Process results from complex questions with partial scoring
    const processComplexResult = async (score: number, _telemetryData?: { attempts?: number, hintsUsed?: number }) => {
        const isPerfect = score === 100;
        const passed = score > 60;

        // Save Result for Timeline
        setStepResults(prev => ({ ...prev, [currentBlock.id]: passed ? 'success' : 'failure' }));

        if (passed) {
            setStepStatus('success');
            playSound('success');

            // XP based on actual score (not 100 for partial)
            const totalXpGain = score;

            // Gems: 2 for perfect, 1 for passed, 0 for failed
            let totalGemGain = 0;
            if (isPerfect) {
                totalGemGain = 2;
            } else if (passed) {
                totalGemGain = 1;
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

            // Contextual feedback based on actual score
            let feedback: string;
            if (isPerfect) {
                feedback = ["מעולה!", "כל הכבוד!", "יפה מאוד!", "מושלם!"][Math.floor(Math.random() * 4)];
            } else if (score >= 80) {
                feedback = `כמעט מושלם! קיבלת ${score} נקודות.`;
            } else if (score >= 60) {
                feedback = `עברת! קיבלת ${score} נקודות. נסה לשפר בפעם הבאה.`;
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

            // Show score even on failure for complex questions
            setFeedbackMsg(`קיבלת ${score} נקודות. צריך לפחות 61 כדי לעבור. נסו שוב!`);
        }

        // --- ADAPTIVE BRAIN SYNC (Cloud) ---
        try {
            const functions = getFunctions();
            const auth = getAuth();
            const user = auth.currentUser;

            if (user && course?.id) {
                const submitAdaptiveAnswer = httpsCallable(functions, 'submitAdaptiveAnswer');
                submitAdaptiveAnswer({
                    userId: user.uid,
                    unitId: course.syllabus[0]?.learningUnits[0]?.id || 'unknown_unit',
                    blockId: currentBlock.id,
                    score: score,
                    isCorrect: passed,
                    metadata: currentBlock.metadata
                }).then(async (result: any) => {
                    const data = result.data;
                    if (data) {
                        console.log("🧠 BKT Update:", data);

                        // --- ADAPTIVE: Update Proficiency Vector with new mastery ---
                        if (data.mastery !== undefined && user) {
                            const topicId = currentBlock.metadata?.tags?.[0] ||
                                course?.syllabus?.[0]?.learningUnits?.[0]?.title ||
                                'general';
                            updateProficiencyVector(user.uid, topicId, data.mastery).catch(e =>
                                console.error("Proficiency Vector update failed:", e)
                            );

                            // --- ADAPTIVE: Update local mastery for variant selection ---
                            setCurrentMastery(data.mastery);
                        }

                        // --- ADAPTIVE: Update recent accuracy for variant selection ---
                        const recentResults = Object.values(stepResults).slice(-5);
                        const successCount = recentResults.filter(r => r === 'success').length;
                        const newAccuracy = recentResults.length > 0 ? successCount / recentResults.length : 0.5;
                        setRecentAccuracy(newAccuracy);

                        // --- POLICY ENGINE: Act on BKT recommendations ---
                        if (data.action === 'remediate') {
                            setIsRemediating(true);
                            setFeedbackMsg(prev => (prev || "") + "\n🤖 המערכת מזהה קושי. מנתח פערים...");

                            try {
                                const remedialBlock = await generateRemedialBlock(
                                    currentBlock,
                                    course.title || "General",
                                    userAnswers[currentBlock.id]
                                );

                                if (remedialBlock) {
                                    setPlaybackQueue(prev => {
                                        const newQ = [...prev];
                                        newQ.splice(currentIndex + 1, 0, remedialBlock);
                                        return newQ;
                                    });
                                    setFeedbackMsg("יצרתי עבורכם הסבר ממוקד לחזרה. לחצו על המשך.");
                                }
                            } catch (genErr) {
                                console.error("Factory Error:", genErr);
                            } finally {
                                setIsRemediating(false);
                            }
                        } else if (data.action === 'challenge' || data.action === 'mastered') {
                            // --- ADAPTIVE POLICY: Challenge Mode & Mastery Skip ---
                            try {
                                const decision = await makeAdaptiveDecision(
                                    data.action as BKTAction,
                                    data.mastery || 0,
                                    playbackQueue,
                                    currentIndex,
                                    currentBlock,
                                    user.uid
                                );

                                console.log(`🧠 Adaptive Decision (Complex): ${decision.action}`, decision);

                                if (decision.action === 'skip' || decision.action === 'skip_to_topic') {
                                    if (decision.toast) {
                                        setAdaptiveToast({ show: true, ...decision.toast });
                                        setTimeout(() => setAdaptiveToast(null), 3000);
                                    }

                                    setTimeout(() => {
                                        const newIndex = applyPolicyDecision(decision, currentIndex, playbackQueue.length);
                                        setHistoryStack(prev => [...prev, currentIndex]);
                                        setCurrentIndex(newIndex);
                                    }, 1500);

                                    setFeedbackMsg(decision.message || "");
                                } else {
                                    if (decision.toast) {
                                        setAdaptiveToast({ show: true, ...decision.toast });
                                        setTimeout(() => setAdaptiveToast(null), 3000);
                                    }
                                    setFeedbackMsg(prev => (prev || "") + "\n" + (decision.message || ""));
                                }
                            } catch (policyErr) {
                                console.error("Policy decision error:", policyErr);
                                setFeedbackMsg(prev => (prev || "") + "\n🌟 מצוין!");
                            }
                        }
                    }
                }).catch(err => console.error("BKT Sync Failed", err));
            }
        } catch (e) {
            console.error("Adaptive connection error", e);
        }
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
        setIsNavigatingBack(true); // Prevent auto-skip when going back
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

        const passiveTypes = ['text', 'video', 'image', 'pdf', 'gem-link', 'podcast', 'activity-intro', 'scenario-image', 'infographic'];

        // PASSIVE BLOCK LOGIC:
        // For passive blocks (non-questions), hide the check button entirely.
        // Navigation is handled by the arrow buttons only.
        if (passiveTypes.includes(currentBlock.type)) {
            return null;
        }

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

        return (
            <button
                key={stepStatus} // Re-trigger animation on status change
                onClick={handleCheck}
                disabled={!isChecked && stepStatus === 'idle' && currentBlock.type === 'multiple-choice' && !userAnswers[currentBlock.id]}
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
                        <h2
                            className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed text-center"
                            dir="auto"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentBlock.content.question || '') }}
                        />
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
                const openQuestionAttemptCount = openQuestionAttempts[currentBlock.id] || 0;
                return (
                    <div className="space-y-6 w-full max-w-4xl mx-auto">
                        <h2
                            className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed text-center"
                            dir="auto"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentBlock.content.question || '') }}
                        />
                        <textarea
                            className={`w-full p-4 rounded-2xl border-2 focus:ring-4 min-h-[200px] text-lg resize-none transition-all ${stepStatus === 'success'
                                    ? 'border-green-400 bg-green-50 focus:border-green-500 focus:ring-green-500/10'
                                    : feedbackMsg && stepStatus === 'ready_to_check'
                                        ? 'border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500/10'
                                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/10'
                                }`}
                            placeholder="הקלד את תשובתך כאן..."
                            dir="auto"
                            disabled={stepStatus === 'success'}
                            onChange={(e) => handleAnswerSelect(e.target.value)}
                            value={userAnswers[currentBlock.id] || ''}
                        />

                        {/* Scaffolded Feedback Display */}
                        {feedbackMsg && stepStatus !== 'failure' && (
                            <div className={`animate-in slide-in-from-top-2 border-2 rounded-2xl p-4 ${
                                stepStatus === 'success'
                                    ? 'bg-green-50 border-green-200 text-green-900'
                                    : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}>
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">{stepStatus === 'success' ? '🎉' : '💭'}</span>
                                    <div className="flex-1">
                                        <p className="font-bold text-lg mb-1">
                                            {stepStatus === 'success' ? 'כל הכבוד!' : 'משוב מהמורה:'}
                                        </p>
                                        <p className="whitespace-pre-line">{feedbackMsg}</p>
                                        {openQuestionAttemptCount > 0 && stepStatus !== 'success' && (
                                            <p className="text-sm mt-2 text-amber-700">
                                                ניסיון {openQuestionAttemptCount} • נסה לשפר את התשובה ולחץ שוב על "בדיקה"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Loading State */}
                        {isCheckingOpenQuestion && (
                            <div className="flex items-center justify-center gap-3 text-blue-600">
                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="font-bold">בודק את התשובה...</span>
                            </div>
                        )}
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
                        <div
                            className="text-slate-800 prose prose-lg md:prose-2xl max-w-none prose-headings:text-indigo-600 prose-headings:font-black prose-p:text-slate-700 prose-p:font-bold prose-p:leading-relaxed prose-strong:text-indigo-700"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentBlock.content) }}
                        />
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
                            loading="lazy"
                            decoding="async"
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

            // === ACTIVITY MEDIA BLOCKS ===
            case 'activity-intro': {
                const introContent = currentBlock.content as any;
                if (!introContent?.imageUrl) return <div className="p-10 text-center text-gray-500">תמונת פתיחה לא נמצאה</div>;
                return (
                    <div className="mb-4">
                        <div className="rounded-2xl overflow-hidden shadow-lg">
                            <img
                                src={introContent.imageUrl}
                                alt={introContent.title || 'תמונת פתיחה'}
                                className="w-full h-56 md:h-72 object-cover"
                                loading="lazy"
                            />
                        </div>
                    </div>
                );
            }

            case 'scenario-image': {
                const scenarioContent = currentBlock.content as any;
                if (!scenarioContent?.imageUrl) return <div className="p-10 text-center text-gray-500">תמונה לא נמצאה</div>;
                return (
                    <div className="mb-4">
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3 text-amber-700">
                                <span className="text-xl">🔍</span>
                                <span className="font-medium">התבונן בתמונה:</span>
                            </div>
                            <img
                                src={scenarioContent.imageUrl}
                                alt={scenarioContent.caption || 'תמונת דילמה'}
                                className="w-full max-h-64 object-contain rounded-xl bg-white"
                                loading="lazy"
                            />
                            {scenarioContent.caption && (
                                <p className="mt-3 text-center text-amber-800 font-medium">
                                    {scenarioContent.caption}
                                </p>
                            )}
                        </div>
                    </div>
                );
            }

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
        }
    };

    // --- Submission Handler ---
    const handleSubmitActivity = async () => {
        console.log("🚀 handleSubmitActivity called!", { isSubmitting, hasSubmitted, courseId: course?.id });
        if (isSubmitting || hasSubmitted) {
            console.log("⚠️ Submission blocked - isSubmitting:", isSubmitting, "hasSubmitted:", hasSubmitted);
            return;
        }

        const courseId = course?.id;
        if (!courseId) {
            console.log("⚠️ No courseId found!");
            alert('שגיאה: לא נמצא מזהה קורס');
            return;
        }

        // Calculate total score from stepResults
        const totalBlocks = playbackQueue.length;
        const completedBlocks = Object.keys(stepResults).length;
        const successBlocks = Object.values(stepResults).filter(r => r === 'success').length;
        const failureBlocks = Object.values(stepResults).filter(r => r === 'failure').length;

        // Calculate score: success = 100pts, viewed = 50pts, failure = 0pts
        let totalScore = 0;
        let maxPossibleScore = 0;

        playbackQueue.forEach(block => {
            const passiveTypes = ['text', 'video', 'image', 'pdf', 'gem-link', 'podcast', 'activity-intro', 'scenario-image'];
            const isPassive = passiveTypes.includes(block.type);

            if (isPassive) {
                // Passive blocks worth 50 points if viewed
                maxPossibleScore += 50;
                if (stepResults[block.id] === 'viewed') {
                    totalScore += 50;
                }
            } else {
                // Interactive blocks worth 100 points
                maxPossibleScore += 100;
                if (stepResults[block.id] === 'success') {
                    totalScore += 100;
                } else if (stepResults[block.id] === 'failure') {
                    totalScore += 0;
                }
            }
        });

        // Normalize to percentage
        const finalScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

        setIsSubmitting(true);

        try {
            const submissionData: SubmissionData = {
                assignmentId: courseId, // Using courseId as assignmentId for direct submissions
                courseId: courseId,
                studentName: currentUser?.displayName || currentUser?.email || 'אורח',
                answers: userAnswers,
                score: finalScore,
                maxScore: 100,
                courseTopic: course?.title || 'נושא כללי',
                telemetry: {
                    stepResults,
                    hintsUsed: hintsVisible,
                    totalBlocks,
                    completedBlocks,
                    successBlocks,
                    failureBlocks,
                    gamificationProfile: {
                        xp: gamificationProfile.xp,
                        gems: gamificationProfile.gems,
                        streak: gamificationProfile.currentStreak
                    },
                    completedAt: new Date().toISOString()
                }
            };

            console.log("📤 Submitting data:", submissionData);
            const result = await submitAssignment(submissionData);
            console.log("✅ Submission result:", result);

            if (result.success) {
                setHasSubmitted(true);
                playSound('success');
                alert(`הפעילות הוגשה בהצלחה! ציון: ${finalScore}%`);
            }
        } catch (error) {
            console.error('❌ Submission error:', error);
            alert('שגיאה בהגשת הפעילות. נסה שוב.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Teacher Cockpit Mode ---
    // Detect if this is a Teacher Lesson Plan or Podcast
    // IMPORTANT: Check productType BEFORE loading state to handle podcast/lesson without activityBlocks
    const productType = (course as any)?.wizardData?.settings?.productType;
    const isCourseLoading = !course || course.id === 'loading';
    console.log("🕵️ SequentialCoursePlayer: courseId:", course?.id, "productType:", productType, "isCourseLoading:", isCourseLoading);

    // If course is still loading from Firestore (id === 'loading'), wait
    // This prevents showing the wrong view while data is still being fetched
    if (isCourseLoading) {
        console.log("🕵️ SequentialCoursePlayer: Course still loading from Firestore...");
        return <div className="h-screen w-full bg-blue-600 flex items-center justify-center text-white font-bold text-2xl animate-pulse">טוען שיעור...</div>;
    }

    if ((productType === 'lesson' || productType === 'podcast') && !forceExam && !inspectorMode) {
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

    // --- Loading State ---
    // Only show loading for regular student content (not lesson/podcast which use TeacherCockpit)
    if (!currentBlock) return <div className="h-screen w-full bg-blue-600 flex items-center justify-center text-white font-bold text-2xl animate-pulse">טוען שיעור...</div>;

    // --- Student Player (Default) ---
    return (
        <div className="fixed inset-0 bg-[#3565e3] flex flex-col font-sans overflow-hidden" dir="rtl">

            {/* 1. Header (Gamification) */}
            <div className="flex-none p-4 pt-20 md:pt-32 pb-2 z-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between text-white bg-[#3565e3] pb-4 border-b border-white/10">
                    {/* Exit/Back & Progress Text */}
                    <div className="flex items-center gap-4">
                        {/* Submit Button - Leftmost */}
                        <button
                            onClick={handleSubmitActivity}
                            disabled={isSubmitting || hasSubmitted}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all shadow-lg transform hover:scale-105 active:scale-95 ${hasSubmitted
                                    ? 'bg-green-500 text-white cursor-default'
                                    : isSubmitting
                                        ? 'bg-white/30 text-white/70 cursor-wait'
                                        : 'bg-gradient-to-r from-green-400 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-600 border border-green-300/30'
                                }`}
                            title="הגש פעילות"
                        >
                            {hasSubmitted ? (
                                <>
                                    <IconCheck className="w-5 h-5" />
                                    <span className="hidden md:inline">הוגש</span>
                                </>
                            ) : isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    <span className="hidden md:inline">שולח...</span>
                                </>
                            ) : (
                                <>
                                    <IconChevronLeft className="w-5 h-5" />
                                    <span className="hidden md:inline">הגש פעילות</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => {
                                if (onExit) {
                                    onExit();
                                } else if (window.history.length > 1) {
                                    window.history.back();
                                } else {
                                    window.location.hash = '#/';
                                }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white border border-white/20"
                            title="חזרה לדשבורד"
                        >
                            <IconChevronRight className="w-5 h-5" />
                            <span className="font-bold text-sm hidden sm:inline">חזרה</span>
                        </button>

                        {/* Source Document Toggle Button */}
                        {shouldShowSource && (
                            <button
                                onClick={() => setShowSourcePanel(!showSourcePanel)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition border ${showSourcePanel
                                        ? 'bg-white text-blue-600 border-white'
                                        : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                                    }`}
                                title={showSourcePanel ? 'סגור טקסט' : 'צפייה בטקסט'}
                            >
                                <IconBook className="w-5 h-5" />
                                <span className="font-bold text-sm hidden sm:inline">
                                    {showSourcePanel ? 'סגור טקסט' : 'צפייה בטקסט'}
                                </span>
                            </button>
                        )}
                        <div className="flex flex-col text-right">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold opacity-80 uppercase tracking-widest">{currentUser?.displayName || "אורח"}</span>
                                <IconBell className="w-4 h-4 opacity-70" />
                            </div>
                            <span className="text-xl font-black font-mono" dir="ltr">{currentIndex + 1} / {playbackQueue.length}</span>
                        </div>
                    </div>

                    {/* Simplified Progress Bar */}
                    <div className="flex-1 mx-4 max-w-lg hidden md:flex items-center gap-4">
                        {/* Progress Dots & Bar Container */}
                        <div className="flex-1 flex flex-col gap-2">
                            {/* Simple Colored Dots */}
                            <div className="flex items-center justify-center gap-1">
                                {playbackQueue.map((block, idx) => {
                                    const isCompleted = idx < currentIndex;
                                    const isCurrent = idx === currentIndex;
                                    const result = stepResults[block.id];

                                    let dotColor = "bg-white/30"; // Future
                                    if (isCurrent) {
                                        dotColor = "bg-yellow-400 ring-2 ring-yellow-300 ring-offset-1 ring-offset-blue-600";
                                    } else if (isCompleted) {
                                        if (result === 'success') dotColor = "bg-green-400";
                                        else if (result === 'failure') dotColor = "bg-red-400";
                                        else dotColor = "bg-green-400"; // Viewed/completed
                                    }

                                    return (
                                        <div
                                            key={`dot-${block.id}`}
                                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${dotColor} ${isCurrent ? 'scale-125' : ''}`}
                                        />
                                    );
                                })}
                            </div>

                            {/* Step Counter Text */}
                            <div className="text-center text-white/80 text-sm font-medium">
                                שלב {currentIndex + 1} מתוך {playbackQueue.length}
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

            {/* 2. Main Card Area with Optional Source Panel */}
            <div className={`flex-1 overflow-hidden flex transition-all duration-300 ${(stepStatus === 'success' || stepStatus === 'failure') ? 'pb-48' : 'pb-32'}`}>

                {/* Source Document Panel (Left side when open) */}
                {showSourcePanel && shouldShowSource && (
                    <div className="w-1/2 h-full bg-white/95 backdrop-blur border-l border-white/20 flex flex-col animate-in slide-in-from-right duration-300 z-10">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 shrink-0">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <IconBook className="w-5 h-5 text-blue-500" />
                                מסמך מקור
                            </h3>
                            <button
                                onClick={() => setShowSourcePanel(false)}
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                <IconX className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto min-h-0">
                            {course?.pdfSource ? (
                                <iframe
                                    src={course.pdfSource}
                                    className="w-full h-full border-none"
                                    title="מסמך מקור"
                                />
                            ) : course?.fullBookContent ? (
                                <div className="p-6 prose max-w-none text-sm leading-relaxed" dir="rtl">
                                    <div className="font-serif text-gray-800 leading-relaxed whitespace-pre-wrap">
                                        {course.fullBookContent}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                {/* Activity Content Area */}
                <div className={`${showSourcePanel && shouldShowSource ? 'w-1/2' : 'w-full'} overflow-y-auto p-4 pt-4 md:pt-12 scrollbar-none [&::-webkit-scrollbar]:hidden`}>
                    <div className={`${showSourcePanel && shouldShowSource ? 'max-w-2xl' : 'max-w-6xl'} mx-auto`}>
                        {/* Floating XP Animation */}
                        {showFloater && <XpFloater amount={showFloater.amount} onComplete={() => setShowFloater(null)} />}

                        {/* split-view-logic (for previous block context, only when source panel is closed) */}
                        {(() => {
                            // Check for Context (Previous block was passive content?)
                            const prevBlock = playbackQueue[currentIndex - 1];
                            const isInteractive = !['text', 'video', 'image', 'pdf', 'gem-link', 'podcast'].includes(currentBlock.type);
                            const hasContext = prevBlock && ['text', 'pdf'].includes(prevBlock.type) && isInteractive;

                            // Only show inline context if source panel is closed
                            if (hasContext && !showSourcePanel) {
                                return (
                                    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:min-h-[500px]">
                                        {/* Context Panel (Left/Top) - PDF or Text */}
                                        <div className="lg:flex-1 lg:w-1/2 bg-white/90 backdrop-blur rounded-[32px] shadow-xl p-4 md:p-6 lg:p-8 overflow-y-auto border-4 border-white/50 max-h-[40vh] lg:max-h-[70vh] lg:min-h-[400px]">
                                            {prevBlock.type === 'pdf' ? (
                                                <iframe
                                                    src={`${prevBlock.content}#toolbar=0`}
                                                    width="100%"
                                                    height="100%"
                                                    title="PDF Context"
                                                    className="border-0 rounded-xl min-h-[250px] lg:min-h-[350px]"
                                                />
                                            ) : (
                                                <div className="prose prose-lg lg:prose-xl prose-indigo max-w-none text-slate-800 dir-rtl">
                                                    {prevBlock.content.split('\n').map((line: string, i: number) => {
                                                        if (!line.trim()) return <br key={i} />;
                                                        if (line.startsWith('#')) {
                                                            return <h3 key={i} className="text-xl lg:text-2xl xl:text-3xl font-bold mb-3 lg:mb-4 text-indigo-600">{line.replace(/^#+\s*/, '')}</h3>;
                                                        }
                                                        return <p key={i} className="text-lg lg:text-xl xl:text-2xl leading-relaxed font-medium mb-3 lg:mb-4">{line}</p>;
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Active Question Panel (Right/Bottom) */}
                                        <div className="lg:flex-1 lg:w-1/2 bg-white rounded-[32px] shadow-2xl p-4 md:p-6 lg:p-8 flex flex-col justify-center animate-in slide-in-from-right-8 duration-500">
                                            {renderBlockContent()}
                                        </div>
                                    </div>
                                );
                            }

                            // Standard Single View
                            return (
                                <div className={`bg-white rounded-[32px] shadow-2xl overflow-hidden min-h-[500px] flex flex-col relative animate-in zoom-in-95 duration-300 ${showSourcePanel ? 'max-w-full' : 'max-w-5xl'} mx-auto w-full`}>
                                    <div className="p-8 md:p-12 flex-1 flex flex-col justify-center">
                                        {renderBlockContent()}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Success Modal Overlay */}
            {showSuccessModal && (
                <SuccessModal
                    onContinue={async () => {
                        // --- ADAPTIVE: Save Session to Profile ---
                        if (currentUser?.uid && !simulateGuest) {
                            try {
                                const sessionData = telemetry.getSessionSummary();
                                const topicId = course?.syllabus?.[0]?.learningUnits?.[0]?.title || course?.title || 'general';

                                console.log('📊 Saving session to profile:', {
                                    userId: currentUser.uid,
                                    lessonId,
                                    questions: sessionData.summary.total_questions,
                                    correct: sessionData.summary.correct_answers,
                                    hintsUsed: sessionData.summary.total_hints_used,
                                    errorTags: sessionErrorTags.length
                                });

                                await onSessionComplete(
                                    currentUser.uid,
                                    sessionData,
                                    topicId,
                                    sessionErrorTags
                                );

                                console.log('✅ Profile updated successfully');
                            } catch (error) {
                                console.error('❌ Failed to save session to profile:', error);
                            }
                        }

                        setShowSuccessModal(false);
                        onExit && onExit();
                    }}
                    onReview={() => {
                        setShowSuccessModal(false);
                        // Stay on page
                    }}
                    xpGained={gamificationProfile.xp} // Dynamic from actual session
                    gemsGained={gamificationProfile.gems}
                />
            )}

            {/* 3. Bottom Action Bar (Sticky) */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 transition-transform duration-300 z-20 ${stepStatus === 'success' ? 'bg-[#d7ffb8] translate-y-0' :
                stepStatus === 'failure' ? 'bg-[#ffdfe0] translate-y-0' :
                    'bg-[#3565e3] border-t border-white/10 backdrop-blur-lg translate-y-0'
                }`}>
                <div className="max-w-4xl mx-auto flex flex-row items-end justify-between gap-4">

                    {/* Back Arrow - Hidden on first slide */}
                    <div className="flex items-center gap-2 order-1">
                        {currentIndex > 0 && (
                            <button
                                onClick={handleBack}
                                className="p-4 rounded-full bg-white/95 hover:bg-white text-blue-600 transition-all active:scale-95 shadow-lg border-2 border-white/50"
                            >
                                <IconChevronRight className="w-8 h-8" />
                            </button>
                        )}
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

                    {/* Next Arrow - Hidden on last slide */}
                    <div className="flex items-center gap-2 order-3">
                        {!isLast && (
                            <button
                                onClick={handleNext}
                                className="p-4 rounded-full bg-white/95 hover:bg-white text-blue-600 transition-all active:scale-95 shadow-lg border-2 border-white/50"
                            >
                                <IconChevronLeft className="w-8 h-8" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Overlays */}
            {isRemediating && <ThinkingOverlay />}

            {/* Adaptive Toast Notification (Challenge Mode / Mastery Skip) */}
            {adaptiveToast?.show && (
                <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-5 fade-in duration-500">
                    <div className={`px-6 py-4 rounded-2xl shadow-2xl border-2 flex items-center gap-4 min-w-[300px] ${adaptiveToast.type === 'challenge'
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-600 border-purple-300 text-white'
                            : adaptiveToast.type === 'success'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-300 text-white'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-600 border-blue-300 text-white'
                        }`}>
                        <span className="text-3xl">
                            {adaptiveToast.type === 'challenge' ? '🚀' : adaptiveToast.type === 'success' ? '🏆' : 'ℹ️'}
                        </span>
                        <div className="flex-1">
                            <h4 className="font-black text-lg">{adaptiveToast.title}</h4>
                            <p className="text-sm opacity-90">{adaptiveToast.description}</p>
                        </div>
                    </div>
                </div>
            )}

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
