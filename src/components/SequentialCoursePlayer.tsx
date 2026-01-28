import React, { useState, useEffect, useCallback } from 'react';
import { useCourseStore } from '../context/CourseContext';

import {
    IconSparkles,
    IconChevronLeft, IconChevronRight,
    IconCheck, IconX, IconStar, IconLink,
    IconVideo, IconHeadphones, IconJoystick, IconTarget, IconBook, IconBell, IconInfo, IconBrain,
    IconHome
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
import { makeAdaptiveDecision, applyPolicyDecision, selectVariant, getInitialStudentState, shouldOfferEnrichment, type BKTAction } from '../services/adaptivePolicyService';
import { logVariantSelected, logBktUpdate, logChallengeMode, logMasterySkip, logRemediationInjected, logScaffoldingOffered, logScaffoldingAccepted, logScaffoldingDeclined, logEnrichmentOffered, logEnrichmentAccepted, logEnrichmentDeclined } from '../services/adaptiveLoggingService';
import { getTopicIdForBlock } from '../services/curriculumTopicService';
import ShopModal from './ShopModal';
import SuccessModal from './SuccessModal';
import type { GamificationProfile } from '../shared/types/courseTypes';
import TeacherCockpit from './TeacherCockpit'; // NEW: Teacher View
import { calculateQuestionScore, SCORING_CONFIG } from '../utils/scoring'; // CRITICAL FIX: Import scoring system
import { submitAssignment, type SubmissionData } from '../services/submissionService'; // Student submission
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import ScaffoldingOfferModal from './ScaffoldingOfferModal'; // NEW: Scaffolding variant modal
import EnrichmentOfferModal from './EnrichmentOfferModal'; // NEW: Enrichment variant modal
import { generateVariantInBackground } from '../services/variantCacheService'; // NEW: Variant generation
import type { VariantType } from '../types/variantCache.types'; // NEW: Variant types
import { useVariantReadiness } from '../hooks/useVariantReadiness'; // Progressive variant generation
import VariantPreparationOverlay from './VariantPreparationOverlay'; // Progressive variant overlay


// --- Specialized Sub-Components ---
import ClozeQuestion from './ClozeQuestion';
import OrderingQuestion from './OrderingQuestion';
import CategorizationQuestion from './CategorizationQuestion';
import MemoryGameQuestion from './MemoryGameQuestion';
import TrueFalseQuestion from './TrueFalseQuestion';
import MatchingQuestion from './questions/MatchingQuestion';
import MatrixQuestion from './questions/MatrixQuestion';
import { PodcastPlayer } from './PodcastPlayer';
import { AudioRecorderBlock } from './AudioRecorderBlock';
import { InfographicViewer } from './InfographicViewer';
import { RemotionVideoPlayer } from './RemotionVideoPlayer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeHtml, formatTeacherContent, stripAsterisks } from '../utils/sanitize';


interface SequentialPlayerProps {
    assignment?: Assignment;
    onExit?: () => void;
    onEdit?: () => void;
    simulateGuest?: boolean;
}

// --- Gamification Helper Components ---

const XpFloater = ({ amount, onComplete }: { amount: number, onComplete: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 1500);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <div className="absolute top-1/4 right-10 pointer-events-none z-50 animate-bounce-up">
            <div className="relative">
                <span className="text-5xl font-black bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_4px_8px_rgba(251,191,36,0.5)] header-font">
                    +{amount} XP
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 blur-xl opacity-40 -z-10"></div>
            </div>
        </div>
    );
};

const StreakFlame = ({ count }: { count: number }) => (
    <div className={`flex items-center gap-1.5 transition-all transform ${count > 0 ? 'scale-110' : 'scale-100 opacity-50'} ${count >= 3 ? 'animate-pulse' : ''}`}>
        <span className="text-2xl filter drop-shadow-lg">🔥</span>
        <span className={`text-xl font-black font-mono ${count >= 3 ? 'bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent drop-shadow-lg' : count > 0 ? 'text-orange-300' : 'text-gray-400'}`}>
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

    // --- Progressive Variant Generation ---
    // Check if variants are ready for this task
    const variantReadiness = useVariantReadiness(assignment?.id);
    const [skipVariantWait, setSkipVariantWait] = useState(false);

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

            // DIAGNOSTIC: Log all blocks loaded for debugging off-topic content issues
            console.log(`📋 [DIAGNOSTIC] Course loaded:`, {
                courseId: course.id,
                courseTitle: course.title,
                subject: course.subject,
                totalBlocks: initialBlocks.length,
                blocks: initialBlocks.map((b, i) => ({
                    index: i,
                    id: b.id,
                    type: b.type,
                    question: b.content?.question?.substring(0, 100) || 'N/A'
                }))
            });
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
    const [stepStatus, setStepStatus] = useState<'idle' | 'ready_to_check' | 'success' | 'failure' | 'partial'>('idle');
    const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
    const [isRemediating, setIsRemediating] = useState(false); // NEW: Remediation Loading State
    const [isCheckingOpenQuestion, setIsCheckingOpenQuestion] = useState(false); // NEW: Open Question AI Check
    const [openQuestionAttempts, setOpenQuestionAttempts] = useState<Record<string, number>>({}); // Track attempts per block
    const [blockAttempts, setBlockAttempts] = useState<Record<string, number>>({}); // Track attempts for all question types

    // --- State: Results Tracking (for Timeline Colors & Persistence) ---
    const [stepResults, setStepResults] = useState<Record<string, 'success' | 'failure' | 'partial' | 'viewed'>>({});
    const [hintsVisible, setHintsVisible] = useState<Record<string, number>>({});


    // --- State: Gamification ---
    // Persistent Profile (synced with Firestore)
    const [gamificationProfile, setGamificationProfile] = useState<GamificationProfile>(DEFAULT_GAMIFICATION_PROFILE);

    // --- State: Submission ---
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // UI Helpers
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
    // Hebrew: הבנה=Understanding, יישום=Application, העמקה=Deepening
    const [activeVariants, setActiveVariants] = useState<Record<string, 'יישום' | 'הבנה' | 'העמקה'>>({});

    // --- SCAFFOLDING: Modal for offering variant after 3 failures ---
    const [isScaffoldingModalOpen, setIsScaffoldingModalOpen] = useState(false);
    const [scaffoldingBlockId, setScaffoldingBlockId] = useState<string | null>(null);
    const [scaffoldingVariantType, setScaffoldingVariantType] = useState<VariantType>('הבנה');
    const [isCurrentBlockScaffolding, setIsCurrentBlockScaffolding] = useState(false);

    // --- ENRICHMENT: Modal for offering challenge variant to high-performers ---
    const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
    const [enrichmentBlockId, setEnrichmentBlockId] = useState<string | null>(null);
    const [enrichmentVariantType, setEnrichmentVariantType] = useState<VariantType>('העמקה');

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

        // DIAGNOSTIC: Log each block as it's displayed
        console.log(`🎬 [DIAGNOSTIC] Displaying block ${currentIndex + 1}/${playbackQueue.length}:`, {
            courseId: course?.id,
            courseTitle: course?.title,
            blockId: currentBlock.id,
            blockType: currentBlock.type,
            blockQuestion: currentBlock.content?.question?.substring(0, 150) || 'N/A',
            fullContent: currentBlock.type === 'open-question' ? currentBlock.content : undefined
        });

        // --- ADAPTIVE: Select appropriate variant based on student performance ---
        // IMPORTANT: Skip variant selection in exam mode - all students get identical questions
        if (isExamMode) {
            console.log('📝 [EXAM MODE] Skipping adaptive variant selection');
        }
        const questionTypes = [
            'multiple-choice', 'open-question', 'fill_in_blanks', 'ordering',
            'categorization', 'memory_game', 'true_false_speed',
            // 8 New Question Types
            'matching', 'highlight', 'sentence_builder', 'image_labeling',
            'table_completion', 'text_selection', 'rating_scale', 'matrix'
        ];
        if (!isExamMode && questionTypes.includes(currentBlock.type) && !activeVariants[currentBlock.id]) {
            // Check if this block has variants available (הבנה=Understanding, העמקה=Deepening)
            const hasHavana = !!currentBlock.metadata?.הבנה_id || !!currentBlock.metadata?.scaffolding_id;
            const hasHaamaka = !!currentBlock.metadata?.העמקה_id || !!currentBlock.metadata?.enrichment_id;

            if (hasHavana || hasHaamaka) {
                // Select variant based on current mastery and accuracy
                const selectedVariant = selectVariant(currentBlock, currentMastery, recentAccuracy);

                if (selectedVariant !== 'יישום') {
                    // Get the variant block from metadata (where it's stored during generation)
                    const variantBlock = selectedVariant === 'הבנה'
                        ? (currentBlock.metadata?.הבנה_variant || currentBlock.metadata?.scaffolding_variant)
                        : (currentBlock.metadata?.העמקה_variant || currentBlock.metadata?.enrichment_variant);

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

                        // Log to Firestore for analysis
                        if (auth.currentUser && course?.id) {
                            logVariantSelected(
                                auth.currentUser.uid,
                                course.id,
                                currentBlock.id,
                                selectedVariant,
                                currentMastery,
                                recentAccuracy
                            );
                        }

                        // Show subtle toast for variant selection
                        if (selectedVariant === 'הבנה') {
                            setAdaptiveToast({
                                show: true,
                                type: 'info',
                                title: '📚 רמת הבנה',
                                description: 'הותאם לך תוכן עם דוגמאות נוספות'
                            });
                            setTimeout(() => setAdaptiveToast(null), 2500);
                        } else if (selectedVariant === 'העמקה') {
                            setAdaptiveToast({
                                show: true,
                                type: 'challenge',
                                title: '🚀 רמת העמקה!',
                                description: 'קיבלת שאלה ברמה מתקדמת'
                            });
                            setTimeout(() => setAdaptiveToast(null), 2500);
                        }
                    } else {
                        console.warn(`⚠️ Variant ${selectedVariant} selected but variant block not found in metadata`);
                        setActiveVariants(prev => ({ ...prev, [currentBlock.id]: 'יישום' }));
                    }
                } else {
                    setActiveVariants(prev => ({ ...prev, [currentBlock.id]: 'יישום' }));
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
                setFeedbackMsg(
                    prevResult === 'success' ? "מצוין! כבר השלמתם את השלב הזה." :
                    prevResult === 'partial' ? "יפה! השלמתם את השלב הזה באופן חלקי." :
                    "כבר עברתם על השלב הזה."
                );
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
        if (stepStatus === 'success' || stepStatus === 'failure' || stepStatus === 'partial') return; // Locked
        setUserAnswers(prev => ({ ...prev, [currentBlock.id]: val }));

        // If it's a simple Multiple Choice, deciding to select makes it "Ready"
        // For complex blocks, they might trigger this themselves via callback if needed, 
        // OR we just rely on the 'Check' button being always active but validating content.
        setStepStatus('ready_to_check');
    };

    // 2a. Check Open Question with AI (Scaffolded Feedback)
    // ✅ NEW: 3-attempt limit with progressive hints
    const handleCheckOpenQuestion = useCallback(async () => {
        const answer = userAnswers[currentBlock.id];
        if (!answer || answer.trim().length < 3) return;

        setIsCheckingOpenQuestion(true);
        const currentAttempts = (openQuestionAttempts[currentBlock.id] || 0) + 1;
        setOpenQuestionAttempts(prev => ({ ...prev, [currentBlock.id]: currentAttempts }));

        const maxAttempts = SCORING_CONFIG.MAX_ATTEMPTS;
        const hints = currentBlock.metadata?.progressiveHints || [];

        try {
            // Get context from course
            const sourceText = course?.syllabus?.[0]?.learningUnits?.[0]?.activityBlocks
                ?.filter((b: any) => b.type === 'text')
                ?.map((b: any) => b.content)
                ?.join('\n') || '';

            const question = currentBlock.content?.question || '';
            const modelAnswer = currentBlock.metadata?.modelAnswer || currentBlock.content?.modelAnswer || '';

            console.log('📝 Checking open question:', { question, answer, modelAnswer: modelAnswer?.substring(0, 50), sourceTextLength: sourceText.length, attempt: `${currentAttempts}/${maxAttempts}` });

            const result = await checkOpenQuestionAnswer(
                question,
                answer,
                modelAnswer,
                sourceText,
                isExamMode ? 'exam' : 'learning'
            );

            console.log('✅ AI Response:', result);

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
                // Check if max attempts reached
                if (currentAttempts >= maxAttempts) {
                    // Partial answer after max attempts = partial success (not failure!)
                    setStepStatus('partial');
                    setStepResults(prev => ({ ...prev, [currentBlock.id]: 'partial' }));
                    playSound('success'); // Positive sound for partial success

                    // Give partial XP (50% of full)
                    const xpGain = Math.max(50 - (currentAttempts - 1) * 10, 25);
                    setGamificationProfile(prev => ({
                        ...prev,
                        xp: prev.xp + xpGain,
                        gems: prev.gems + 1,
                    }));
                    setShowFloater({ id: Date.now(), amount: xpGain });

                    setFeedbackMsg(result.feedback || 'תשובה חלקית - כל הכבוד על המאמץ!');
                } else {
                    // Allow retry with guidance
                    setStepStatus('ready_to_check');
                    playSound('failure');
                    const currentHintLevel = hintsVisible[currentBlock.id] || 0;
                    if (currentHintLevel < hints.length) {
                        setHintsVisible(prev => ({ ...prev, [currentBlock.id]: currentHintLevel + 1 }));
                        setFeedbackMsg(`${result.feedback || 'כמעט! נסו להרחיב את התשובה.'}\n💡 רמז ${currentHintLevel + 1}: ${hints[currentHintLevel]}`);
                    } else {
                        setFeedbackMsg(result.feedback || 'כמעט! נסו להרחיב את התשובה.');
                    }
                }

            } else {
                // Incorrect
                if (currentAttempts >= maxAttempts) {
                    // Final attempt - show model answer
                    setStepStatus('failure');
                    setStepResults(prev => ({ ...prev, [currentBlock.id]: 'failure' }));
                    playSound('failure');
                    if (hints.length > 0) {
                        setHintsVisible(prev => ({ ...prev, [currentBlock.id]: hints.length }));
                    }
                    setFeedbackMsg(modelAnswer ? `הנה התשובה: ${stripAsterisks(modelAnswer)}` : (result.feedback || 'נסו שאלה אחרת.'));
                } else {
                    // Still have attempts - show progressive hint
                    setStepStatus('ready_to_check');
                    playSound('failure');
                    const currentHintLevel = hintsVisible[currentBlock.id] || 0;

                    if (currentHintLevel < hints.length) {
                        setHintsVisible(prev => ({ ...prev, [currentBlock.id]: currentHintLevel + 1 }));
                        setFeedbackMsg(`${result.feedback || 'נסו שוב.'}\n💡 רמז ${currentHintLevel + 1}: ${hints[currentHintLevel]}`);
                    } else {
                        setFeedbackMsg(result.feedback || 'נסו שוב.');
                    }
                }
            }
        } catch (error: any) {
            console.error('❌ Error checking open question:', error);
            console.error('Error details:', error?.message, error?.code);
            setFeedbackMsg('שגיאה בבדיקה. נסו שוב.');
        } finally {
            setIsCheckingOpenQuestion(false);
        }
    }, [currentBlock, userAnswers, course, isExamMode, openQuestionAttempts, hintsVisible, playSound]);

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
        if (stepStatus === 'success' || stepStatus === 'failure' || stepStatus === 'partial') {
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
    // ✅ NEW: 3-attempt limit with progressive hints before showing correct answer
    const processResult = async (isCorrect: boolean) => {
        // Track attempts for this block
        const currentAttempts = (blockAttempts[currentBlock.id] || 0) + 1;
        setBlockAttempts(prev => ({ ...prev, [currentBlock.id]: currentAttempts }));

        // Save Result for Timeline
        setStepResults(prev => ({ ...prev, [currentBlock.id]: isCorrect ? 'success' : 'failure' }));

        // ✅ CRITICAL FIX: Calculate score using the central scoring function
        const hintsUsed = hintsVisible[currentBlock.id] || 0;

        // --- ADAPTIVE: Track telemetry for profile ---
        telemetry.onAnswerSubmitted(isCorrect, currentAttempts);

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
            attempts: currentAttempts,
            hintsUsed: hintsUsed,
            responseTimeSec: 0 // Could track actual time if needed
        });

        console.log(`🎯 Scoring: isCorrect=${isCorrect}, attempts=${currentAttempts}/${SCORING_CONFIG.MAX_ATTEMPTS}, hints=${hintsUsed}, score=${score}`);

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

            setShowFloater({ id: Date.now(), amount: totalXpGain });

            // ✅ FIXED: Clean contextual feedback (no scores/penalties shown)
            let feedback: string;
            if (score === SCORING_CONFIG.CORRECT_FIRST_TRY) {
                feedback = "מעולה!";
            } else if (score >= 80) {
                feedback = "כל הכבוד";
            } else if (score >= SCORING_CONFIG.RETRY_PARTIAL) {
                feedback = "יפה";
            } else {
                feedback = "יפה";
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

            // --- ENRICHMENT OFFER LOGIC: Check if student should be offered העמקה variant ---
            // Only check when student answers correctly (not after failures)
            if (score === SCORING_CONFIG.CORRECT_FIRST_TRY) {
                // Check if enrichment should be offered based on performance (mastery + accuracy)
                const shouldOffer = shouldOfferEnrichment(
                    currentMastery,
                    recentAccuracy,
                    currentBlock
                );

                if (shouldOffer && !isEnrichmentModalOpen && !isExamMode) {
                    // Check if enrichment variant exists (skip in exam mode)
                    const hasEnrichment = !!(currentBlock.metadata?.העמקה_id || currentBlock.metadata?.enrichment_id);

                    if (hasEnrichment) {
                        console.log('🚀 Offering enrichment to high-performing student');

                        // Log offer
                        if (currentUser?.uid && course?.id) {
                            logEnrichmentOffered(
                                currentUser.uid,
                                course.id,
                                currentBlock.id,
                                'העמקה',
                                currentMastery
                            );

                            // Pre-generate variant in background
                            generateVariantInBackground(
                                currentBlock.id,
                                'העמקה',
                                currentUser.uid,
                                course.id
                            );
                        }

                        // Open enrichment modal
                        setEnrichmentBlockId(currentBlock.id);
                        setEnrichmentVariantType('העמקה');
                        setIsEnrichmentModalOpen(true);
                    }
                }
            }

        } else {
            // ✅ NEW: 3-attempt logic with progressive hints
            const maxAttempts = SCORING_CONFIG.MAX_ATTEMPTS;
            const hints = currentBlock.metadata?.progressiveHints || [];

            if (currentAttempts >= maxAttempts) {
                // Final attempt - check mastery to decide scaffolding offer
                setStepStatus('failure');
                playSound('failure');

                // Show all remaining hints
                if (hints.length > 0) {
                    setHintsVisible(prev => ({ ...prev, [currentBlock.id]: hints.length }));
                }

                // --- SCAFFOLDING LOGIC: Check mastery ---
                // Mastery < 0.3 = struggling → offer הבנה variant
                // Mastery >= 0.3 = just bad luck → show answer
                // IMPORTANT: Skip scaffolding in exam mode
                if (currentMastery < 0.3 && !isExamMode) {
                    console.log(`📚 Low mastery (${currentMastery.toFixed(2)}) - offering scaffolding variant`);

                    // Trigger variant generation in background if not cached
                    const topic = currentBlock.metadata?.topic || course?.title || 'כללי';
                    generateVariantInBackground({
                        baseBlock: currentBlock,
                        variantType: 'הבנה',
                        topic,
                        activityId: course?.id,
                        runInBackground: true
                    });

                    // Log scaffolding offer
                    if (currentUser?.uid && course?.id) {
                        logScaffoldingOffered(
                            currentUser.uid,
                            course.id,
                            currentBlock.id,
                            'הבנה',
                            currentMastery,
                            currentAttempts
                        );
                    }

                    // Open scaffolding modal (no message - modal explains itself, icon shows adaptation)
                    setScaffoldingBlockId(currentBlock.id);
                    setScaffoldingVariantType('הבנה');
                    setIsScaffoldingModalOpen(true);
                } else {
                    // High enough mastery - just show answer
                    const correctAnswer = currentBlock.content?.correctAnswer || currentBlock.content?.correct;
                    setFeedbackMsg(currentBlock.type === 'multiple-choice'
                        ? `הנה התשובה הנכונה: ${correctAnswer}`
                        : (correctAnswer ? `הנה התשובה: ${correctAnswer}` : 'נסו שאלה אחרת.'));
                }
            } else {
                // Still have attempts - show progressive hint and allow retry
                setStepStatus('ready_to_check'); // Allow retry
                playSound('failure');

                // Auto-reveal next hint if available
                const currentHintLevel = hintsVisible[currentBlock.id] || 0;
                const nextHintIndex = currentHintLevel;

                if (nextHintIndex < hints.length) {
                    // Show next progressive hint
                    setHintsVisible(prev => ({ ...prev, [currentBlock.id]: nextHintIndex + 1 }));
                    const hintText = hints[nextHintIndex];
                    setFeedbackMsg(`נסו שוב.\n💡 רמז ${nextHintIndex + 1}: ${hintText}`);
                } else {
                    // No more hints but still have attempts
                    setFeedbackMsg('נסו שוב');
                }

                // Clear user answer to allow re-selection
                setUserAnswers(prev => ({ ...prev, [currentBlock.id]: undefined }));
            }
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

                        // Get curriculum topic from Knowledge Base (or fallback chain)
                        const topicId = await getTopicIdForBlock(
                            currentBlock,
                            course?.targetAudience,  // grade (e.g., 'ב', 'ג')
                            course?.subject || 'math'
                        );

                        logBktUpdate(
                            user.uid,
                            course.id,
                            currentBlock.id,
                            currentMastery,
                            data.mastery || 0,
                            data.action || 'continue',
                            passed,
                            topicId
                        );

                        // --- ADAPTIVE: Update Proficiency Vector with curriculum topic ---
                        if (data.mastery !== undefined && user) {
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
                        // IMPORTANT: Skip adaptive actions in exam mode
                        if (data.action === 'remediate' && !isExamMode) {
                            // Trigger "Thinking" Overlay (no message - icon shows adaptation)
                            setIsRemediating(true);

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
                                    // Log remediation to Firestore
                                    logRemediationInjected(
                                        user.uid,
                                        course.id,
                                        currentBlock.id,
                                        remedialBlock.id || 'remedial',
                                        userAnswers[currentBlock.id]
                                    );
                                }
                            } catch (genErr) {
                                console.error("Factory Error:", genErr);
                            } finally {
                                setIsRemediating(false); // Hide Overlay
                            }
                        } else if ((data.action === 'challenge' || data.action === 'mastered') && !isExamMode) {
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
                                    // Log to Firestore
                                    if (data.action === 'challenge') {
                                        logChallengeMode(user.uid, course.id, decision.skipCount || 1);
                                    } else if (data.action === 'mastered') {
                                        logMasterySkip(user.uid, course.id, decision.targetTopicId || topicId, data.mastery || 0);
                                    }

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
                                    setFeedbackMsg(prev => (prev || "") + "\n🌟 מצוין!");
                                } else {
                                    setFeedbackMsg(prev => (prev || "") + "\n🏆 מצוין!");
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
    const handleComplexBlockComplete = (score: number, telemetryData?: { attempts?: number, hintsUsed?: number, lastAnswer?: any }) => {
        // Complex blocks pass their own score (0-100)
        // We need to handle partial scores properly, not just pass/fail

        // Update hints if provided by the component
        if (telemetryData?.hintsUsed && telemetryData.hintsUsed > 0) {
            setHintsVisible(prev => ({ ...prev, [currentBlock.id]: telemetryData.hintsUsed ?? 0 }));
        }

        // Save the answers for back navigation
        if (telemetryData?.lastAnswer !== undefined) {
            setUserAnswers(prev => ({ ...prev, [currentBlock.id]: telemetryData.lastAnswer }));
        }

        // Process with actual score for proper feedback
        processComplexResult(score, telemetryData);
    };

    // Reset handler for "Try Again" in complex components (Cloze, etc.)
    const handleComplexBlockReset = () => {
        // Clear parent state so the user can re-attempt the question
        setStepStatus('idle');
        setFeedbackMsg(null);
        setStepResults(prev => {
            const newResults = { ...prev };
            delete newResults[currentBlock.id];
            return newResults;
        });
        setUserAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers[currentBlock.id];
            return newAnswers;
        });
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

            setShowFloater({ id: Date.now(), amount: totalXpGain });

            // Contextual feedback based on actual score
            let feedback: string;
            if (isPerfect) {
                feedback = "מעולה!";
            } else if (score >= 80) {
                feedback = "כל הכבוד";
            } else if (score >= 60) {
                feedback = "יפה";
            } else if (score >= 51) {
                feedback = "קרוב! נסו שוב";
            } else {
                feedback = "נסו שוב";
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

            // Encouraging feedback without showing scores
            setFeedbackMsg(score >= 51 ? "קרוב! נסו שוב" : "נסו שוב");
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

                        // Get curriculum topic from Knowledge Base (or fallback chain)
                        const topicId = await getTopicIdForBlock(
                            currentBlock,
                            course?.targetAudience,  // grade (e.g., 'ב', 'ג')
                            course?.subject || 'math'
                        );

                        logBktUpdate(
                            user.uid,
                            course.id,
                            currentBlock.id,
                            currentMastery,
                            data.mastery || 0,
                            data.action || 'continue',
                            passed,
                            topicId
                        );

                        // --- ADAPTIVE: Update Proficiency Vector with curriculum topic ---
                        if (data.mastery !== undefined && user) {
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
                        // IMPORTANT: Skip adaptive actions in exam mode
                        if (data.action === 'remediate' && !isExamMode) {
                            setIsRemediating(true);

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
                                }
                            } catch (genErr) {
                                console.error("Factory Error:", genErr);
                            } finally {
                                setIsRemediating(false);
                            }
                        } else if ((data.action === 'challenge' || data.action === 'mastered') && !isExamMode) {
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

    // --- SCAFFOLDING HANDLERS ---
    /**
     * Handle acceptance of scaffolding variant
     * Replace current block with variant and reset state
     */
    const handleScaffoldingAccept = useCallback((variant: ActivityBlock) => {
        console.log('✅ Scaffolding variant accepted:', variant.id);

        // Log acceptance
        if (currentUser?.uid && course?.id && scaffoldingBlockId) {
            logScaffoldingAccepted(
                currentUser.uid,
                course.id,
                scaffoldingBlockId,
                variant.id,
                scaffoldingVariantType,
                currentMastery
            );
        }

        // Replace current block with variant in queue
        setPlaybackQueue(prev => {
            const newQueue = [...prev];
            newQueue[currentIndex] = variant;
            return newQueue;
        });

        // Mark this block as scaffolding variant
        setIsCurrentBlockScaffolding(true);

        // Reset state for new attempt
        setStepStatus('idle');
        setUserAnswers(prev => ({ ...prev, [variant.id]: undefined }));
        setBlockAttempts(prev => ({ ...prev, [variant.id]: 0 }));
        setHintsVisible(prev => ({ ...prev, [variant.id]: 0 }));
        setFeedbackMsg(null);

        // Close modal
        setIsScaffoldingModalOpen(false);
        setScaffoldingBlockId(null);
    }, [currentIndex, currentUser, course, scaffoldingBlockId, scaffoldingVariantType, currentMastery]);

    /**
     * Handle decline of scaffolding variant
     * Show correct answer and allow continue
     */
    const handleScaffoldingDecline = useCallback(() => {
        console.log('❌ Scaffolding variant declined');

        // Log decline
        if (currentUser?.uid && course?.id && scaffoldingBlockId) {
            logScaffoldingDeclined(
                currentUser.uid,
                course.id,
                scaffoldingBlockId,
                scaffoldingVariantType,
                currentMastery
            );
        }

        // Close modal
        setIsScaffoldingModalOpen(false);
        setScaffoldingBlockId(null);

        // Show correct answer
        const correctAnswer = currentBlock.content?.correctAnswer || currentBlock.content?.correct;
        setFeedbackMsg(currentBlock.type === 'multiple-choice'
            ? `הנה התשובה הנכונה: ${correctAnswer}`
            : (correctAnswer ? `הנה התשובה: ${correctAnswer}` : 'נסו שאלה אחרת.'));
    }, [currentBlock, currentUser, course, scaffoldingBlockId, scaffoldingVariantType, currentMastery]);

    // --- ENRICHMENT HANDLERS ---
    /**
     * Handle acceptance of enrichment variant
     * Replace current block with harder variant and reset state
     */
    const handleEnrichmentAccept = useCallback((variant: ActivityBlock) => {
        console.log('✅ Enrichment variant accepted:', variant.id);

        // Log acceptance
        if (currentUser?.uid && course?.id && enrichmentBlockId) {
            logEnrichmentAccepted(
                currentUser.uid,
                course.id,
                enrichmentBlockId,
                variant.id,
                enrichmentVariantType,
                currentMastery
            );
        }

        // Replace current block with variant in queue
        setPlaybackQueue(prev => {
            const newQueue = [...prev];
            newQueue[currentIndex] = variant;
            return newQueue;
        });

        // Reset state for new attempt
        setStepStatus('idle');
        setUserAnswers(prev => ({ ...prev, [variant.id]: undefined }));
        setBlockAttempts(prev => ({ ...prev, [variant.id]: 0 }));
        setHintsVisible(prev => ({ ...prev, [variant.id]: 0 }));
        setFeedbackMsg(null);

        // Close modal
        setIsEnrichmentModalOpen(false);
        setEnrichmentBlockId(null);

        // Show motivational toast
        setAdaptiveToast({
            show: true,
            type: 'challenge',
            title: '🚀 אתגר התקבל!',
            description: 'בואו נראה איך מתמודדים עם שאלה מתקדמת!'
        });
        setTimeout(() => setAdaptiveToast(null), 3000);
    }, [currentIndex, currentUser, course, enrichmentBlockId, enrichmentVariantType, currentMastery]);

    /**
     * Handle decline of enrichment variant
     * Continue normally with standard content
     */
    const handleEnrichmentDecline = useCallback(() => {
        console.log('❌ Enrichment variant declined');

        // Log decline
        if (currentUser?.uid && course?.id && enrichmentBlockId) {
            logEnrichmentDeclined(
                currentUser.uid,
                course.id,
                enrichmentBlockId,
                enrichmentVariantType,
                currentMastery
            );
        }

        // Close modal
        setIsEnrichmentModalOpen(false);
        setEnrichmentBlockId(null);

        // Show supportive message
        setAdaptiveToast({
            show: true,
            type: 'info',
            title: '👍 בסדר גמור!',
            description: 'נמשיך עם השאלה הרגילה'
        });
        setTimeout(() => setAdaptiveToast(null), 2000);
    }, [currentUser, course, enrichmentBlockId, enrichmentVariantType, currentMastery]);

    // --- 4. Navigation ---
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleNext = () => {
        // Reset scaffolding flag when moving to next question
        setIsCurrentBlockScaffolding(false);

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
        const isChecked = stepStatus === 'success' || stepStatus === 'failure' || stepStatus === 'partial';
        let label = "בדיקה";
        let colorClass = "bg-[#0056b3] text-white border-blue-800 hover:bg-blue-700"; // Default: Active Check (Manifesto Blue)

        const passiveTypes = ['text', 'video', 'image', 'pdf', 'gem-link', 'podcast', 'activity-intro', 'scenario-image', 'infographic'];

        // PASSIVE BLOCK LOGIC:
        // For passive blocks (non-questions), hide the check button entirely.
        // Navigation is handled by the arrow buttons only.
        if (passiveTypes.includes(currentBlock.type)) {
            return null;
        }

        // ALL QUESTION TYPES: Hide footer button - each block has its own internal check button
        const questionTypes = ['fill_in_blanks', 'ordering', 'categorization', 'memory_game', 'true_false_speed', 'audio-response', 'multiple-choice', 'open-question'];
        if (questionTypes.includes(currentBlock.type)) {
            return null; // Hide button, let the component's internal button handle it
        }

        // After check complete, hide button - navigation handled by arrows only
        if (isChecked) {
            return null;
        }

        return null; // Default: no footer button for questions
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
            <div className="mb-6 flex flex-col items-start gap-3 animate-in slide-in-from-top-2">
                <button
                    onClick={() => handleShowHint(block.id)}
                    disabled={isMaxLevel}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-md ${isMaxLevel
                        ? 'bg-slate-100 text-slate-400 cursor-default'
                        : 'bg-gradient-to-r from-violet-50 to-cyan-50 text-violet-600 border border-violet-200/50 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/10 hover:scale-105 active:scale-95'
                        }`}
                >
                    <IconSparkles className="w-4 h-4" />
                    {currentLevel === 0 ? '💡 רמז' : (isMaxLevel ? 'כל הרמזים מוצגים' : 'רמז נוסף')}
                </button>

                {currentLevel > 0 && (
                    <div className="space-y-3 w-full max-w-md animate-fade-in mt-2">
                        {hints.slice(0, currentLevel).map((hint, idx) => (
                            <div key={idx} className="relative bg-gradient-to-r from-violet-50/80 to-cyan-50/80 border border-violet-200/50 p-4 pr-5 rounded-2xl text-slate-800 text-sm shadow-sm flex gap-3 items-start backdrop-blur-sm">
                                <span className="font-bold bg-gradient-to-br from-violet-500 to-cyan-500 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">{idx + 1}</span>
                                <span className="flex-1 leading-relaxed">{hint}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderBlockContent = () => {
        // Check if current block is using an adaptive variant
        const currentVariant = activeVariants[currentBlock?.id];
        const isAdaptiveVariant = currentVariant && currentVariant !== 'יישום';

        return (
            <div className="relative">
                {/* Scaffolding Badge - AI-Native Design (shown when user accepts scaffolding) */}
                {isCurrentBlockScaffolding && (
                    <div className="absolute -top-3 right-0 z-10 flex items-center gap-2 bg-gradient-to-r from-violet-100 via-purple-100 to-pink-100 border border-violet-300/50 px-4 py-2 rounded-2xl shadow-lg shadow-violet-500/10 animate-in slide-in-from-top-2">
                        <IconSparkles className="w-4 h-4 text-violet-600" />
                        <span className="text-xs font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">שאלה בדיוק בשבילך</span>
                    </div>
                )}

                {/* Adaptive Variant Indicator - Subtle icon showing content is personalized */}
                {isAdaptiveVariant && !isCurrentBlockScaffolding && (
                    <div
                        className="absolute -top-2 left-2 z-10"
                        title={currentVariant === 'הבנה' ? 'גרסה מותאמת - תומכת' : 'גרסה מותאמת - מאתגרת'}
                    >
                        <div className="relative group">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <IconBrain className="w-4 h-4 text-white" />
                            </div>
                            {/* Subtle glow ring */}
                            <div className="absolute inset-0 rounded-full bg-indigo-400/50 animate-ping" style={{ animationDuration: '2s' }}></div>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                תוכן מותאם אישית
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {renderBlockContentInner()}
            </div>
        );
    };

    const renderBlockContentInner = () => {
        switch (currentBlock.type) {
            case 'multiple-choice':
                return (
                    <div className="space-y-6">
                        {renderProgressiveHints(currentBlock)}
                        <h2
                            className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed text-center"
                            dir="auto"
                            dangerouslySetInnerHTML={{ __html: formatTeacherContent(currentBlock.content.question || '') }}
                        />
                        <div className="grid gap-4">
                            {currentBlock.content.options?.map((opt: any, idx: number) => {
                                const text = typeof opt === 'string' ? opt : opt.value || opt.answer;
                                const isSelected = userAnswers[currentBlock.id] === text;
                                const isResultState = stepStatus === 'success' || stepStatus === 'failure' || stepStatus === 'partial';
                                const isCorrectOpt = text === currentBlock.content.correctAnswer;
                                const isUserWrong = isResultState && isSelected && !isCorrectOpt;

                                let optionStyle = "border-slate-200 hover:bg-slate-50"; // Default
                                if (isSelected) optionStyle = "border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-500/20";

                                if (isResultState) {
                                    if (isCorrectOpt) optionStyle = "border-green-500 bg-green-100 text-green-800";
                                    else if (isUserWrong) optionStyle = "border-orange-400 bg-orange-50 text-orange-800"; // Softer orange instead of red
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
                                            {isResultState && isUserWrong && <IconInfo className="w-6 h-6 text-orange-500" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Internal Check Button for Multiple Choice */}
                        {!(stepStatus === 'success' || stepStatus === 'failure' || stepStatus === 'partial') && (
                            <div className="flex justify-center mt-6">
                                <button
                                    onClick={handleCheck}
                                    disabled={!userAnswers[currentBlock.id]}
                                    className={`px-8 py-4 rounded-2xl font-black text-xl transition-all shadow-lg ${
                                        userAnswers[currentBlock.id]
                                            ? 'bg-[#0056b3] text-white hover:bg-blue-700 active:scale-95'
                                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    בדיקה
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'open-question':
                const openQuestionAttemptCount = openQuestionAttempts[currentBlock.id] || 0;
                return (
                    <div className="space-y-6 w-full max-w-4xl mx-auto">
                        <h2
                            className="text-2xl md:text-3xl font-bold text-slate-800 leading-relaxed text-center"
                            dir="auto"
                            dangerouslySetInnerHTML={{ __html: formatTeacherContent(currentBlock.content.question || '') }}
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

                        {/* Scaffolded Feedback Display - only for hints/partial feedback, NOT success (which is shown in bottom bar) */}
                        {feedbackMsg && stepStatus !== 'failure' && stepStatus !== 'success' && (
                            <div className="animate-in slide-in-from-top-2 border-2 rounded-2xl p-4 bg-amber-50 border-amber-200 text-amber-900">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">💭</span>
                                    <div className="flex-1">
                                        <p className="font-bold text-lg mb-1">משוב מהמורה:</p>
                                        <p className="whitespace-pre-line">{feedbackMsg}</p>
                                        {openQuestionAttemptCount > 0 && (
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

                        {/* Internal Check Button for Open Question */}
                        {!(stepStatus === 'success' || stepStatus === 'failure') && !isCheckingOpenQuestion && (
                            <div className="flex justify-center mt-6">
                                <button
                                    onClick={handleCheck}
                                    disabled={!userAnswers[currentBlock.id] || (userAnswers[currentBlock.id] || '').trim().length < 3}
                                    className={`px-8 py-4 rounded-2xl font-black text-xl transition-all shadow-lg ${
                                        userAnswers[currentBlock.id] && (userAnswers[currentBlock.id] || '').trim().length >= 3
                                            ? 'bg-[#0056b3] text-white hover:bg-blue-700 active:scale-95'
                                            : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    בדיקה
                                </button>
                            </div>
                        )}
                    </div>
                );

            case 'fill_in_blanks':
                return <ClozeQuestion block={currentBlock} onComplete={handleComplexBlockComplete} onReset={handleComplexBlockReset} savedAnswers={userAnswers[currentBlock.id]} isCompleted={!!stepResults[currentBlock.id]} />;
            case 'ordering':
                return <OrderingQuestion block={currentBlock} onComplete={handleComplexBlockComplete} savedAnswers={userAnswers[currentBlock.id]} isCompleted={!!stepResults[currentBlock.id]} />;
            case 'categorization':
                return <CategorizationQuestion block={currentBlock} onComplete={handleComplexBlockComplete} onReset={handleComplexBlockReset} savedAnswers={userAnswers[currentBlock.id]} isCompleted={!!stepResults[currentBlock.id]} />;
            case 'memory_game':
                return <MemoryGameQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;
            case 'true_false_speed':
                // @ts-ignore
                return <TrueFalseQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;
            case 'matching':
                return <MatchingQuestion block={currentBlock} onComplete={handleComplexBlockComplete} />;

            // --- Passive Content Renderers ---
            case 'text':
                return (
                    <div className="space-y-8 text-right w-full max-w-4xl mx-auto" dir="rtl">
                        <div
                            className="text-slate-800 prose prose-lg md:prose-2xl max-w-none prose-headings:text-indigo-600 prose-headings:font-black prose-p:text-slate-700 prose-p:font-bold prose-p:leading-relaxed prose-strong:text-indigo-700"
                            dangerouslySetInnerHTML={{ __html: formatTeacherContent(currentBlock.content) }}
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

            case 'remotion-video':
                return (
                    <div className="w-full max-w-4xl mx-auto">
                        <RemotionVideoPlayer
                            content={currentBlock.content}
                            showControls
                            className="rounded-2xl shadow-lg"
                        />
                    </div>
                );

            case 'image':
                // Check if image URL is empty or missing - show completion message instead
                if (!currentBlock.content || currentBlock.content.trim() === '') {
                    return (
                        <div className="flex flex-col items-center gap-6 p-8 text-center bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl border-2 border-green-200">
                            <div className="relative">
                                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                                    <IconCheck className="w-10 h-10 text-white" />
                                </div>
                                <IconStar className="absolute -top-1 -right-1 w-6 h-6 text-yellow-400 animate-bounce" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">סיימת את הפעילות!</h2>
                            <p className="text-lg text-slate-600 max-w-md">
                                כל הכבוד! סיימת לעבור על כל התכנים.
                            </p>
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mt-2">
                                <p className="text-blue-800 font-bold flex items-center gap-2 justify-center">
                                    <IconBell className="w-5 h-5" />
                                    לחץ על כפתור "הגש פעילות" הירוק בראש המסך
                                </p>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="flex flex-col items-center gap-4">
                        <img
                            src={currentBlock.content}
                            alt="תמונה מהשיעור"
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

            case 'matrix':
                return (
                    <MatrixQuestion
                        block={currentBlock}
                        onComplete={(score) => handleComplexBlockComplete(score)}
                        isExamMode={isExamMode}
                        hints={(currentBlock.content as any)?.hints}
                    />
                );

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

        // Verify user is authenticated before submission (required by Firestore rules)
        const auth = getAuth();
        const authenticatedUserId = currentUser?.uid || auth.currentUser?.uid;
        console.log('🔐 Auth Debug:', {
            contextUserId: currentUser?.uid,
            firebaseAuthUserId: auth.currentUser?.uid,
            finalUserId: authenticatedUserId,
            userEmail: currentUser?.email || auth.currentUser?.email
        });
        if (!authenticatedUserId) {
            console.error('❌ Cannot submit: No authenticated user');
            alert('נדרשת התחברות כדי להגיש את הפעילות. אנא התחבר/י ונסה שוב.');
            return;
        }

        setIsSubmitting(true);

        try {
            const submissionData: SubmissionData = {
                assignmentId: courseId, // Using courseId as assignmentId for direct submissions
                courseId: courseId,
                studentId: authenticatedUserId, // Must match auth.uid for Firestore rules
                teacherId: (course as any)?.teacherId, // Course teacher for read access
                studentName: currentUser?.displayName || currentUser?.email || auth.currentUser?.displayName || auth.currentUser?.email || 'אורח',
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
                // Don't show score for exams - teacher will review and provide feedback
                const isExam = (course as any)?.wizardData?.settings?.productType === 'exam';
                if (isExam) {
                    alert('הבחינה הוגשה בהצלחה! המורה יבדוק את התשובות.');
                } else {
                    alert(`הפעילות הוגשה בהצלחה! ציון: ${finalScore}%`);
                }
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
        return (
            <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center text-white" dir="rtl">
                <button
                    onClick={() => {
                        console.log('🚀 Dashboard button clicked during loading, onExit:', !!onExit);
                        if (onExit) onExit();
                        else if (window.history.length > 1) window.history.back();
                        else window.location.href = '/';
                    }}
                    className="absolute top-6 right-6 flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-slate-700/80 to-slate-800/80 hover:from-slate-600/80 hover:to-slate-700/80 rounded-2xl border border-white/20 backdrop-blur-md shadow-lg transform hover:scale-105 transition-all text-white"
                    title="חזרה לדשבורד התלמיד"
                >
                    <IconHome className="w-6 h-6" />
                    <span className="font-bold">דשבורד</span>
                </button>
                <div className="font-bold text-2xl animate-pulse">טוען שיעור...</div>
            </div>
        );
    }

    // --- Progressive Variant Generation: Show overlay while variants are being prepared ---
    // Only show if: variants are loading AND user hasn't chosen to skip AND this is an assigned task
    if (variantReadiness.isLoading && !skipVariantWait && assignment?.id) {
        return (
            <VariantPreparationOverlay
                stats={variantReadiness.stats}
                onSkip={() => setSkipVariantWait(true)}
                title="מכינים תוכן מותאם"
                description="המערכת מייצרת גרסאות מותאמות אישית לרמה שלך..."
            />
        );
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
    if (!currentBlock) {
        return (
            <div className="h-screen w-full bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center text-white" dir="rtl">
                <button
                    onClick={() => {
                        console.log('🚀 Dashboard button clicked during block loading, onExit:', !!onExit);
                        if (onExit) onExit();
                        else if (window.history.length > 1) window.history.back();
                        else window.location.href = '/';
                    }}
                    className="absolute top-6 right-6 flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-slate-700/80 to-slate-800/80 hover:from-slate-600/80 hover:to-slate-700/80 rounded-2xl border border-white/20 backdrop-blur-md shadow-lg transform hover:scale-105 transition-all text-white"
                    title="חזרה לדשבורד התלמיד"
                >
                    <IconHome className="w-6 h-6" />
                    <span className="font-bold">דשבורד</span>
                </button>
                <div className="font-bold text-2xl animate-pulse">טוען שיעור...</div>
            </div>
        );
    }

    // --- Student Player (Default) ---
    return (
        <div className="fixed inset-0 pt-20 bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col font-sans overflow-hidden h-[100dvh]" dir="rtl">
            {/* AI Background Particles */}
            <div className="ai-particles opacity-30" aria-hidden="true">
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
                <div className="ai-particle"></div>
            </div>

            {/* 1. Header (Gamification) - AI-Native Design */}
            <div className="flex-none p-4 pt-6 md:pt-8 pb-2 z-10 relative">
                <div className="max-w-6xl mx-auto flex items-center justify-between text-white pb-4 border-b border-white/10">
                    {/* Exit/Back & Progress Text */}
                    <div className="flex items-center gap-4">
                        {/* Dashboard Button - Leftmost */}
                        <button
                            onClick={() => {
                                console.log('🚀 Dashboard button clicked, onExit:', !!onExit);
                                if (onExit) {
                                    onExit();
                                } else if (window.history.length > 1) {
                                    window.history.back();
                                } else {
                                    window.location.hash = '#/';
                                }
                            }}
                            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-slate-700/80 to-slate-800/80 hover:from-slate-600/80 hover:to-slate-700/80 rounded-2xl border border-white/20 backdrop-blur-md shadow-lg transform hover:scale-105 transition-all text-white"
                            title="חזרה לדשבורד התלמיד"
                        >
                            <IconHome className="w-7 h-7" />
                            <span className="font-bold hidden sm:inline">דשבורד</span>
                        </button>

                        {/* Source Document Toggle Button */}
                        {shouldShowSource && (
                            <button
                                onClick={() => setShowSourcePanel(!showSourcePanel)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border backdrop-blur-sm ${showSourcePanel
                                        ? 'bg-white text-violet-600 border-white shadow-lg shadow-white/20'
                                        : 'bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40'
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

                    {/* AI-Native Progress Bar */}
                    <div className="flex-1 mx-4 max-w-xl hidden md:flex items-center gap-4">
                        {/* Progress Dots & Bar Container */}
                        <div className="flex-1 flex flex-col gap-3 bg-white/5 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
                            {/* AI-Style Progress Dots */}
                            <div className="flex items-center justify-center gap-1.5">
                                {playbackQueue.map((block, idx) => {
                                    const isCompleted = idx < currentIndex;
                                    const isCurrent = idx === currentIndex;
                                    const result = stepResults[block.id];

                                    let dotColor = "bg-white/20"; // Future
                                    let dotGlow = "";
                                    if (isCurrent) {
                                        dotColor = "bg-gradient-to-r from-violet-400 to-cyan-400";
                                        dotGlow = "shadow-lg shadow-violet-400/50 ring-2 ring-violet-300/50";
                                    } else if (isCompleted) {
                                        if (result === 'success') {
                                            dotColor = "bg-gradient-to-r from-emerald-400 to-green-400";
                                            dotGlow = "shadow-sm shadow-emerald-400/30";
                                        }
                                        else if (result === 'failure') {
                                            dotColor = "bg-gradient-to-r from-rose-400 to-red-400";
                                        }
                                        else {
                                            dotColor = "bg-gradient-to-r from-emerald-400 to-green-400";
                                            dotGlow = "shadow-sm shadow-emerald-400/30";
                                        }
                                    }

                                    return (
                                        <div
                                            key={`dot-${block.id}`}
                                            className={`w-3 h-3 rounded-full transition-all duration-300 ${dotColor} ${dotGlow} ${isCurrent ? 'scale-125' : 'hover:scale-110'}`}
                                        />
                                    );
                                })}
                            </div>

                            {/* Step Counter Text with AI Gradient */}
                            <div className="text-center">
                                <span className="text-sm font-bold bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
                                    שלב {currentIndex + 1} מתוך {playbackQueue.length}
                                </span>
                            </div>
                        </div>
                    </div>


                    {/* Stats: Streak & XP & Gems - AI-Native Widgets */}
                    <div className="flex items-center gap-3">
                        {/* Streak Widget - Bento Card Style */}
                        <div className="flex items-center gap-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 px-4 py-2.5 rounded-2xl border border-orange-400/30 backdrop-blur-md shadow-lg shadow-orange-500/10 transform hover:scale-105 transition-all group">
                            <StreakFlame count={gamificationProfile.currentStreak} />
                            <span className="text-xs font-bold text-orange-200/80 uppercase tracking-wider group-hover:text-orange-100 transition-colors">רצף</span>
                        </div>

                        {/* XP Widget - AI Glow Effect */}
                        <div className="flex items-center gap-2 bg-gradient-to-br from-amber-400/20 via-yellow-400/20 to-orange-400/20 px-4 py-2.5 rounded-2xl border border-yellow-400/30 backdrop-blur-md shadow-lg shadow-yellow-500/20 transform hover:scale-105 transition-all group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            <IconStar className="w-5 h-5 text-yellow-300 drop-shadow-md relative z-10" />
                            <span className="font-black text-yellow-300 font-mono text-xl drop-shadow-sm relative z-10">{gamificationProfile.xp}</span>
                            <span className="text-xs font-bold text-yellow-200/80 uppercase tracking-wider relative z-10">XP</span>
                        </div>

                        {/* Gems Widget - AI Shimmer Effect */}
                        <button
                            onClick={() => setIsShopOpen(true)}
                            className="flex items-center gap-2 bg-gradient-to-br from-violet-500/20 via-cyan-500/20 to-blue-500/20 px-4 py-2.5 rounded-2xl border border-cyan-400/30 backdrop-blur-md shadow-lg shadow-cyan-500/20 transform hover:scale-105 transition-all outline-none focus:ring-2 focus:ring-cyan-400/50 group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            <span className="text-xl relative z-10">💎</span>
                            <span className="font-black bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent font-mono text-xl relative z-10">{gamificationProfile.gems}</span>
                        </button>

                        {/* Submit Button - Rightmost */}
                        <button
                            onClick={handleSubmitActivity}
                            disabled={isSubmitting || hasSubmitted}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-xl transform hover:scale-105 active:scale-95 ${hasSubmitted
                                    ? 'bg-gradient-to-r from-emerald-400 to-green-500 text-white cursor-default ring-2 ring-green-400/50'
                                    : isSubmitting
                                        ? 'bg-white/20 text-white/70 cursor-wait backdrop-blur-sm'
                                        : 'bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 text-white hover:shadow-emerald-500/30 hover:shadow-2xl border border-white/20'
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
                    </div>
                </div>
            </div>

            {/* 2. Main Card Area with Optional Source Panel */}
            <div className={`flex-1 overflow-hidden flex transition-all duration-300 ${(stepStatus === 'success' || stepStatus === 'failure' || stepStatus === 'partial') ? 'pb-36 sm:pb-44' : 'pb-24 sm:pb-28'}`}>

                {/* Source Document Panel (Left side when open) - AI-Native Style */}
                {showSourcePanel && shouldShowSource && (
                    <div className="w-1/2 h-full bg-white/98 backdrop-blur-md border-l border-slate-200/50 flex flex-col animate-in slide-in-from-right duration-300 z-10 shadow-2xl shadow-slate-900/10">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-violet-50/30 shrink-0">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-sm">
                                    <IconBook className="w-4 h-4 text-white" />
                                </div>
                                <span>מסמך מקור</span>
                            </h3>
                            <button
                                onClick={() => setShowSourcePanel(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto min-h-0">
                            {/* Priority: Show pdfSource if available, fallback to fullBookContent */}
                            {course?.pdfSource ? (
                                <div className="h-full flex flex-col">
                                    <iframe
                                        src={course.pdfSource}
                                        className="w-full flex-1 border-none"
                                        title="מסמך מקור"
                                    />
                                    {/* Fallback link if iframe fails to load */}
                                    <div className="p-3 bg-white border-t text-center">
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
                                    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:min-h-[min(500px,55dvh)]">
                                        {/* Context Panel (Left/Top) - AI-Native Bento Card */}
                                        <div className="lg:flex-1 lg:w-1/2 bento-card bento-static bg-white/90 backdrop-blur-sm rounded-[32px] shadow-xl p-4 md:p-6 lg:p-8 overflow-y-auto border border-slate-200/50 max-h-[35dvh] lg:max-h-[50dvh] lg:min-h-[min(400px,45dvh)] relative">
                                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-300 via-violet-400 to-slate-300 opacity-50"></div>
                                            {prevBlock.type === 'pdf' ? (
                                                <iframe
                                                    src={`${prevBlock.content}#toolbar=0`}
                                                    width="100%"
                                                    height="100%"
                                                    title="PDF Context"
                                                    className="border-0 rounded-xl min-h-[250px] lg:min-h-[350px]"
                                                />
                                            ) : (
                                                <div
                                                    className="prose prose-lg lg:prose-xl prose-violet max-w-none text-slate-800 dir-rtl"
                                                    dangerouslySetInnerHTML={{ __html: formatTeacherContent(prevBlock.content) }}
                                                />
                                            )}
                                        </div>

                                        {/* Active Question Panel (Right/Bottom) - AI-Native Featured Card */}
                                        <div className="lg:flex-1 lg:w-1/2 bento-card bento-static bg-white/95 backdrop-blur-sm rounded-[32px] shadow-2xl p-4 md:p-6 lg:p-8 flex flex-col justify-center animate-in slide-in-from-right-8 duration-500 relative border border-white/50">
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-violet-500 opacity-60"></div>
                                            {renderBlockContent()}
                                        </div>
                                    </div>
                                );
                            }

                            // Standard Single View - AI-Native Bento Card
                            return (
                                <div className={`bento-card bento-static bg-white/95 backdrop-blur-sm rounded-[32px] shadow-2xl overflow-hidden min-h-[min(500px,60dvh)] flex flex-col relative animate-in zoom-in-95 duration-300 ${showSourcePanel ? 'max-w-full' : 'max-w-5xl'} mx-auto w-full border border-white/50`}>
                                    {/* Subtle AI gradient overlay at top */}
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-cyan-500 to-violet-500 opacity-60"></div>
                                    <div className="p-8 md:p-12 flex-1 flex flex-col justify-center relative z-10">
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
                        if (onExit) onExit();
                    }}
                    onReview={() => {
                        setShowSuccessModal(false);
                        // Stay on page
                    }}
                    xpGained={gamificationProfile.xp} // Dynamic from actual session
                    gemsGained={gamificationProfile.gems}
                />
            )}

            {/* 3. Bottom Action Bar (Sticky) - AI-Native Design */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 transition-all duration-300 z-20 ${stepStatus === 'success' ? 'bg-gradient-to-t from-emerald-100 to-emerald-50/95 backdrop-blur-sm' :
                stepStatus === 'partial' ? 'bg-gradient-to-t from-amber-100 to-amber-50/95 backdrop-blur-sm' :
                    stepStatus === 'failure' ? 'bg-gradient-to-t from-sky-100 to-sky-50/95 backdrop-blur-sm' :
                        'bg-gradient-to-t from-slate-900/95 to-slate-900/80 border-t border-white/10 backdrop-blur-lg'
                }`}>
                <div className="max-w-4xl mx-auto flex flex-row items-end justify-between gap-4">

                    {/* Back Arrow - AI Style */}
                    <div className="flex items-center gap-2 order-1">
                        {currentIndex > 0 && (
                            <button
                                onClick={handleBack}
                                className="p-4 rounded-2xl bg-white/95 hover:bg-white text-violet-600 transition-all active:scale-95 shadow-lg shadow-violet-500/10 border border-violet-200/50 hover:border-violet-300 hover:shadow-xl"
                            >
                                <IconChevronRight className="w-8 h-8" />
                            </button>
                        )}
                    </div>

                    {/* Feedback OR Action Button - AI-Native Style */}
                    <div className="flex-1 w-full flex items-center justify-center gap-4 order-2">
                        {/* Feedback Text (Only shown on Result) */}
                        {(stepStatus === 'success' || stepStatus === 'failure' || stepStatus === 'partial') ? (
                            <div className="flex-1 animate-in slide-in-from-bottom-5 fade-in">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                                        stepStatus === 'success' ? 'bg-gradient-to-br from-emerald-400 to-green-500 shadow-emerald-500/30' :
                                        stepStatus === 'partial' ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30' :
                                        'bg-gradient-to-br from-sky-400 to-blue-500 shadow-sky-500/30'
                                    }`}>
                                        {stepStatus === 'success' ? <IconCheck className="w-7 h-7 text-white" /> :
                                         stepStatus === 'partial' ? <IconSparkles className="w-7 h-7 text-white" /> :
                                         <IconInfo className="w-7 h-7 text-white" />}
                                    </div>
                                    <h3 className={`text-3xl font-black ${
                                        stepStatus === 'success' ? 'bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent' :
                                        stepStatus === 'partial' ? 'bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent' :
                                        'bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent'
                                    }`}>
                                        {stepStatus === 'success' ? 'מעולה!' :
                                         stepStatus === 'partial' ? 'כמעט!' :
                                         ''}
                                    </h3>
                                </div>
                                {feedbackMsg &&
                                 !(stepStatus === 'success' && feedbackMsg === 'מעולה!') &&
                                 !(stepStatus === 'partial' && feedbackMsg === 'כמעט!') && (
                                    <p className={`text-lg font-medium whitespace-pre-line break-words max-w-prose ${
                                        stepStatus === 'success' ? 'text-emerald-700' :
                                        stepStatus === 'partial' ? 'text-amber-700' :
                                        'text-sky-700'
                                    }`}>{feedbackMsg}</p>
                                )}
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
                        <div className="shrink-0">
                            {renderFooterButton()}
                        </div>
                    </div>

                    {/* Next Arrow - AI Style */}
                    <div className="flex items-center gap-2 order-3">
                        {!isLast && (
                            <button
                                onClick={handleNext}
                                className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 hover:from-violet-400 hover:to-cyan-400 text-white transition-all active:scale-95 shadow-lg shadow-violet-500/30 border border-white/20 hover:shadow-xl hover:shadow-violet-500/40"
                            >
                                <IconChevronLeft className="w-8 h-8" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 4. Overlays */}
            {isRemediating && <ThinkingOverlay />}

            {/* Inspector Mode Panel - Debug Info */}
            {inspectorMode && (
                <div className="fixed top-4 left-4 z-50 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border-2 border-cyan-500 p-4 max-w-sm">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyan-200">
                        <IconBrain className="w-5 h-5 text-cyan-600" />
                        <h3 className="font-bold text-cyan-900">Adaptive Inspector</h3>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-600 font-medium">Current Mastery:</span>
                            <span className={`font-bold ${currentMastery < 0.3 ? 'text-red-600' : currentMastery < 0.7 ? 'text-amber-600' : 'text-green-600'}`}>
                                {(currentMastery * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 font-medium">Recent Accuracy:</span>
                            <span className={`font-bold ${recentAccuracy < 0.5 ? 'text-red-600' : recentAccuracy < 0.8 ? 'text-amber-600' : 'text-green-600'}`}>
                                {(recentAccuracy * 100).toFixed(0)}%
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 font-medium">Block Type:</span>
                            <span className="font-bold text-slate-800">{currentBlock.type}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600 font-medium">Block ID:</span>
                            <span className="font-mono text-xs text-slate-500">{currentBlock.id.substring(0, 12)}...</span>
                        </div>
                        {isCurrentBlockScaffolding && (
                            <div className="mt-3 pt-3 border-t border-cyan-200 flex items-center gap-2 bg-cyan-50 px-2 py-1.5 rounded-lg">
                                <IconBrain className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                                <span className="font-bold text-cyan-700 text-xs">Scaffolding Variant Active</span>
                            </div>
                        )}
                        <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="text-slate-500 text-xs">
                                Scaffolding triggers when:<br/>
                                • 3 failures + mastery &lt; 30%
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Scaffolding Offer Modal */}
            <ScaffoldingOfferModal
                isOpen={isScaffoldingModalOpen}
                onClose={() => setIsScaffoldingModalOpen(false)}
                onAccept={handleScaffoldingAccept}
                onDecline={handleScaffoldingDecline}
                blockId={scaffoldingBlockId}
                variantType={scaffoldingVariantType}
            />

            {/* Enrichment Offer Modal */}
            <EnrichmentOfferModal
                isOpen={isEnrichmentModalOpen}
                onClose={() => setIsEnrichmentModalOpen(false)}
                onAccept={handleEnrichmentAccept}
                onDecline={handleEnrichmentDecline}
                blockId={enrichmentBlockId}
                variantType={enrichmentVariantType}
                studentStats={{
                    mastery: currentMastery
                }}
            />
        </div>
    );
};

export default SequentialCoursePlayer;
