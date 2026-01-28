import React, { useState, useEffect } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck, IconX } from '../icons';
import { calculateQuestionScore, SCORING_CONFIG } from '../utils/scoring';
import { MathRenderer } from './MathRenderer';
import { sanitizeHtml } from '../utils/sanitize';

interface ClozeQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean; // ✨ NEW
    hints?: string[]; // ✨ NEW
    onHintUsed?: () => void; // ✨ NEW
    savedAnswers?: (string | null)[]; // For restoring state on back navigation
    isCompleted?: boolean; // Show completed state without re-attempt
    onReset?: () => void; // Callback to reset parent state on "Try Again"
}

const ClozeQuestion: React.FC<ClozeQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed,
    savedAnswers,
    isCompleted = false,
    onReset
}) => {
    // Telemetry Refs
    const startTimeRef = React.useRef<number>(Date.now());
    const attemptsRef = React.useRef<number>(0);
    const hintsUsedRef = React.useRef<number>(0); // ✨ NEW
    const resetsRef = React.useRef<number>(0); // Track resets for telemetry

    // Safe parsing of content with memoization to prevent infinite loops
    // Safe parsing of content with robust fallback for different formats
    const content = React.useMemo(() => {
        let rawText = '';
        let providedHiddenWords: string[] | undefined;
        let providedDistractors: string[] | undefined;

        // 1. Extract Raw Text
        if (typeof block.content === 'string') {
            rawText = block.content;
        } else if (block.content && typeof block.content === 'object') {
            const c = block.content as any;
            // Support both 'sentence' (legacy) and 'text' (gemini output)
            rawText = c.sentence || c.text || '';
            providedHiddenWords = c.hidden_words;
            providedDistractors = c.distractors;
        }

        // 2. Parse Brackets if present and no explicit hidden words were provided
        // This handles the case where Gemini sends { text: "The [Sun] is hot" } without processing it first.
        const hasBrackets = /\[(.*?)\]/.test(rawText);

        if (hasBrackets && (!providedHiddenWords || providedHiddenWords.length === 0)) {
            const matches = rawText.match(/\[(.*?)\]/g) || [];
            const hidden_words = matches.map(m => m.slice(1, -1));
            const sentence = rawText.replace(/\[(.*?)\]/g, '_____');
            return { sentence, hidden_words, distractors: providedDistractors || [] };
        }

        // 3. Passthrough if already formatted
        // Fallback: If AI produced underscores (_____) but no hidden_words, try to recover from metadata backup
        // This fixes cases where Geminti produced "A is ____" + metadata.wordBank ["Red"]
        if ((!providedHiddenWords || providedHiddenWords.length === 0) && !hasBrackets && block.metadata?.wordBank) {
            const underscoreCount = (rawText.match(/_____/g) || []).length;
            if (underscoreCount > 0 && block.metadata.wordBank.length >= underscoreCount) {
                // Heuristic: Assume the first N words in the bank are the correct answers in order
                const recoveredHidden = block.metadata.wordBank.slice(0, underscoreCount);
                const recoveredDistractors = block.metadata.wordBank.slice(underscoreCount);

                return {
                    sentence: rawText,
                    hidden_words: recoveredHidden,
                    distractors: recoveredDistractors
                };
            }
        }

        // 4. Extreme Fallback: If absolutely no hidden words found, auto-hide random words (up to 3)
        // This handles "Text Only" failure cases from the AI
        if ((!providedHiddenWords || providedHiddenWords.length === 0) && !hasBrackets && (!block.metadata?.wordBank || block.metadata.wordBank.length === 0)) {
            const words = rawText.split(' ');
            if (words.length > 5) {
                // Pick 2-3 random words to hide, preferring longer words
                const indicesToHide: number[] = [];
                words.forEach((w, i) => {
                    if (w.length > 3 && indicesToHide.length < 3 && Math.random() > 0.7) {
                        indicesToHide.push(i);
                    }
                });
                // Ensure at least one
                if (indicesToHide.length === 0) indicesToHide.push(Math.floor(Math.random() * words.length));

                const newHidden: string[] = [];
                const newSentence = words.map((w, i) => {
                    if (indicesToHide.includes(i)) {
                        newHidden.push(w);
                        return '_____';
                    }
                    return w;
                }).join(' ');

                return { sentence: newSentence, hidden_words: newHidden, distractors: [] };
            }
        }

        return {
            sentence: rawText,
            hidden_words: providedHiddenWords || [],
            distractors: providedDistractors || []
        };
    }, [block.content, block.metadata]);

    const { sentence = '', hidden_words = [], distractors = [] } = content || {};
    console.log("Cloze Debug:", { rawContent: block.content, sentence, hidden_words, distractors }); // DEBUG

    const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
    const [wordBank, setWordBank] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // ✨ NEW: Hint state
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    // NEW: Partial check feedback state - FIXED: Added more granular feedback types
    const [partialFeedback, setPartialFeedback] = useState<{
        cleared: number;
        kept: number;
        empty: number;
        type: 'wrong' | 'partial' | 'incomplete';
    } | null>(null);

    // Initialize
    useEffect(() => {
        startTimeRef.current = Date.now(); // Reset timer on new question
        attemptsRef.current = 0;

        if (!sentence) return;

        // Prepare blanks based on sentence
        const blanksCount = (sentence.match(/_____/g) || []).length;

        // Restore from saved answers if available, otherwise start fresh
        if (savedAnswers && savedAnswers.length === blanksCount) {
            setUserAnswers(savedAnswers);
            setIsSubmitted(isCompleted);
        } else {
            setUserAnswers(new Array(blanksCount).fill(null));
        }

        // Prepare word bank (shuffled) - but keep used words filtered if restoring
        const allWords = [...hidden_words, ...(distractors || [])];
        setWordBank(allWords.sort(() => Math.random() - 0.5));
    }, [block, sentence, hidden_words, distractors, savedAnswers, isCompleted]);

    const handleDragStart = (e: React.DragEvent, word: string) => {
        e.dataTransfer.setData("text/plain", word);
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        const word = e.dataTransfer.getData("text/plain");
        if (isSubmitted) return;

        setPartialFeedback(null); // Clear feedback on new interaction
        setUserAnswers(prev => {
            const newState = [...prev];
            newState[index] = word;
            return newState;
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeAnswer = (index: number) => {
        if (isSubmitted) return;
        setPartialFeedback(null); // Clear feedback on new interaction
        setUserAnswers(prev => {
            const newState = [...prev];
            newState[index] = null;
            return newState;
        });
    };

    const checkAnswers = () => {
        setHasAttempted(true); // ✨ Unlock hints
        attemptsRef.current += 1;
        setPartialFeedback(null); // Clear any previous feedback

        let correctCount = 0;
        let wrongCount = 0;
        let emptyCount = 0;

        userAnswers.forEach((ans, i) => {
            if (ans === null) {
                emptyCount++;
            } else if (ans === hidden_words[i]) {
                correctCount++;
            } else {
                wrongCount++;
            }
        });

        // Calculate raw accuracy based on total blanks
        const accuracy = correctCount / hidden_words.length;
        const isFullyCorrect = accuracy === 1;
        const maxAttempts = SCORING_CONFIG.MAX_ATTEMPTS;

        // ✅ NEW: 3-attempt logic with progressive hints
        if (isFullyCorrect || attemptsRef.current >= maxAttempts) {
            // Correct or final attempt - lock the question
            setIsSubmitted(true);

            // ✅ FIXED: Use central scoring function with hints
            const finalScore = calculateQuestionScore({
                isCorrect: isFullyCorrect,
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                responseTimeSec: (Date.now() - startTimeRef.current) / 1000
            });

            // Apply partial credit for partially correct answers
            const scoreWithPartialCredit = isFullyCorrect
                ? finalScore
                : Math.round(finalScore * accuracy);

            const timeSpent = (Date.now() - startTimeRef.current) / 1000;

            if (onComplete) {
                onComplete(scoreWithPartialCredit, {
                    timeSeconds: Math.round(timeSpent),
                    attempts: attemptsRef.current,
                    hintsUsed: hintsUsedRef.current,
                    resets: resetsRef.current,
                    lastAnswer: userAnswers
                });
            }
        } else {
            // Still have attempts - show progressive hint and allow retry
            if (currentHintLevel < hints.length) {
                setCurrentHintLevel(prev => prev + 1);
                hintsUsedRef.current += 1;
                onHintUsed?.();
            }

            // FIXED: Show clear feedback about what was cleared/kept/empty
            if (wrongCount > 0) {
                setPartialFeedback({
                    cleared: wrongCount,
                    kept: correctCount,
                    empty: emptyCount,
                    type: 'wrong'
                });
            } else if (correctCount > 0 && emptyCount > 0) {
                setPartialFeedback({
                    cleared: 0,
                    kept: correctCount,
                    empty: emptyCount,
                    type: 'partial'
                });
            } else if (emptyCount > 0 && correctCount === 0) {
                // All empty or partial - shouldn't happen since button is disabled, but handle gracefully
                setPartialFeedback({
                    cleared: 0,
                    kept: 0,
                    empty: emptyCount,
                    type: 'incomplete'
                });
            }

            // Clear wrong answers to allow re-attempt (keep correct ones)
            setUserAnswers(prev => prev.map((ans, i) =>
                ans === hidden_words[i] ? ans : null // Keep correct, clear wrong
            ));
        }
    };

    // Pre-submission reset - clears all answers, doesn't reset attempts
    const handlePreSubmitReset = () => {
        if (isSubmitted) return; // Safety check

        resetsRef.current += 1; // Track reset for telemetry

        // Clear all answers
        setUserAnswers(new Array(hidden_words.length).fill(null));

        // Clear feedback and hints display (but don't reset counters)
        setPartialFeedback(null);
        setCurrentHintLevel(0);
        setHasAttempted(false);
    };

    // Split sentence by placeholders
    const parts = sentence.split('_____');

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700" role="region" aria-labelledby="cloze-title">
            <h3 id="cloze-title" className="text-xl font-bold mb-6 text-gray-800 dark:text-white">השלם את המשפט</h3>
            <p className="sr-only">גרור מילים מהמחסן למקומות הריקים או לחץ על מילה כדי למקם אותה</p>

            <div className="mb-8 text-lg leading-loose text-center" dir="rtl" role="group" aria-label="משפט להשלמה">
                {parts.map((part, i) => (
                    <React.Fragment key={i}>
                        {part.includes('$') || part.includes('\\') ? (
                            <MathRenderer content={part} className="inline" />
                        ) : (
                            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(part) }} />
                        )}
                        {i < parts.length - 1 && (
                            <button
                                onDrop={(e) => handleDrop(e, i)}
                                onDragOver={handleDragOver}
                                onClick={() => removeAnswer(i)}
                                type="button"
                                aria-label={userAnswers[i] ? `תשובה ${i + 1}: ${userAnswers[i]}. לחץ להסרה` : `מקום ריק ${i + 1}. גרור מילה לכאן`}
                                className={`inline-block min-w-[100px] min-h-[44px] mx-2 border-b-2 align-middle text-center px-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 rounded
                                    ${userAnswers[i]
                                        ? (isSubmitted
                                            ? (userAnswers[i] === hidden_words[i] ? 'border-green-500 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30' : 'border-red-500 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30')
                                            : 'border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30')
                                        : 'border-gray-300 dark:border-slate-500 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                                    }
                                `}
                            >
                                {userAnswers[i] || (
                                    <span className="text-gray-300 dark:text-slate-500 text-sm select-none">גרור לכאן</span>
                                )}
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Word Bank */}
            <div className="flex flex-wrap gap-3 justify-center mb-8 bg-gray-50 dark:bg-slate-700/50 p-4 rounded-xl" role="list" aria-label="מחסן מילים">
                {wordBank.map((word, i) => {
                    const isUsed = userAnswers.includes(word);
                    return (
                        <button
                            key={i}
                            type="button"
                            role="listitem"
                            draggable={!isSubmitted && !isUsed}
                            onDragStart={(e) => handleDragStart(e, word)}
                            onClick={() => {
                                if (isSubmitted || isUsed) return;
                                // Find first empty blank
                                const firstEmpty = userAnswers.findIndex(a => a === null);
                                if (firstEmpty !== -1) {
                                    setPartialFeedback(null); // Clear feedback on new interaction
                                    setUserAnswers(prev => {
                                        const newState = [...prev];
                                        newState[firstEmpty] = word;
                                        return newState;
                                    });
                                }
                            }}
                            disabled={isSubmitted || isUsed}
                            aria-label={isUsed ? `${word} - כבר בשימוש` : `${word} - לחץ למיקום`}
                            className={`px-4 py-2 min-h-[44px] rounded-lg font-medium shadow-sm border select-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2
                                ${isUsed
                                    ? 'bg-gray-100 dark:bg-slate-600 text-gray-400 dark:text-slate-400 border-gray-100 dark:border-slate-500 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-600 hover:border-blue-400 dark:hover:border-wizdi-cyan hover:shadow-md cursor-pointer active:scale-95 motion-reduce:active:scale-100'
                                }
                            `}
                        >
                            {word}
                        </button>
                    );
                })}
            </div>

            {/* Progressive Hints - Auto-revealed after wrong attempts, no manual button */}
            {!isExamMode && hints.length > 0 && currentHintLevel > 0 && !isSubmitted && (
                <div className="mb-6 space-y-2">
                    {hints.slice(0, currentHintLevel).map((hint, idx) => (
                        <div
                            key={idx}
                            className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 animate-fade-in"
                        >
                            <div className="flex items-start gap-3">
                                <span className="text-2xl">💡</span>
                                <div className="flex-1">
                                    <div className="text-xs text-yellow-700 font-bold mb-1">רמז {idx + 1}</div>
                                    <div className="text-gray-700">{hint}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* FIXED: Partial Check Feedback - Clear distinction between different states */}
            {!isSubmitted && partialFeedback && (
                <div className="mb-6 animate-fade-in" role="alert" aria-live="polite">
                    <div className={`border-2 rounded-xl p-4 ${
                        partialFeedback.type === 'wrong'
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600'
                            : partialFeedback.type === 'partial'
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600'
                    }`}>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">
                                {partialFeedback.type === 'wrong' ? '🔄' : partialFeedback.type === 'partial' ? '✨' : '⚠️'}
                            </span>
                            <div className="flex-1 text-right">
                                {partialFeedback.type === 'wrong' ? (
                                    <>
                                        <div className="font-bold text-orange-700 dark:text-orange-300 mb-1">
                                            יש טעויות - נסו שוב!
                                        </div>
                                        <div className="text-sm text-orange-600 dark:text-orange-400">
                                            {partialFeedback.kept > 0 && (
                                                <span>✓ {partialFeedback.kept} תשובות נכונות נשארו במקום. </span>
                                            )}
                                            <span>{partialFeedback.cleared} תשובות שגויות הוסרו - השלימו את החסר.</span>
                                        </div>
                                    </>
                                ) : partialFeedback.type === 'partial' ? (
                                    <>
                                        <div className="font-bold text-blue-700 dark:text-blue-300 mb-1">
                                            יפה! המשיכו למלא
                                        </div>
                                        <div className="text-sm text-blue-600 dark:text-blue-400">
                                            ✓ {partialFeedback.kept} תשובות נכונות - השלימו את {partialFeedback.empty} משבצות נוספות.
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="font-bold text-amber-700 dark:text-amber-300 mb-1">
                                            לא סיימת למלא!
                                        </div>
                                        <div className="text-sm text-amber-600 dark:text-amber-400">
                                            יש עוד {partialFeedback.empty} משבצות ריקות - גררו מילים מהמחסן.
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!isSubmitted && (
                <div className="text-center flex flex-col items-center gap-3">
                    <div className="flex gap-3 justify-center">
                        {!isExamMode && (
                            <button
                                onClick={handlePreSubmitReset}
                                className="bg-gray-500 dark:bg-slate-600 text-white px-6 py-3 min-h-[44px] rounded-full font-bold shadow-lg hover:bg-gray-600 dark:hover:bg-slate-500 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2"
                                aria-label="איפוס השאלה - ניקוי כל התשובות"
                            >
                                איפוס
                            </button>
                        )}
                        <button
                            onClick={checkAnswers}
                            disabled={!userAnswers.some(a => a !== null)}
                            aria-label="בדיקת התשובות"
                            aria-disabled={!userAnswers.some(a => a !== null)}
                            className={`px-8 py-3 min-h-[44px] rounded-full font-bold shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 ${
                                userAnswers.some(a => a !== null)
                                    ? 'bg-blue-600 dark:bg-wizdi-action text-white hover:bg-blue-700 dark:hover:bg-wizdi-action-hover active:scale-95 motion-reduce:transition-none cursor-pointer'
                                    : 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            בדיקה
                        </button>
                    </div>
                    {userAnswers.some(a => a === null) && userAnswers.some(a => a !== null) && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">ניתן לבדוק גם תשובות חלקיות</p>
                    )}
                    {!userAnswers.some(a => a !== null) && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">גררו מילה לפחות אחת כדי לבדוק</p>
                    )}
                </div>
            )}

            {/* Post-submission: Only show "Try Again" button for incorrect answers - feedback text is shown in parent to avoid redundancy */}
            {isSubmitted && !userAnswers.every((a, i) => a === hidden_words[i]) && (
                <div className="mt-6 text-center animate-fade-in motion-reduce:animate-none">
                    <button
                        onClick={() => {
                            setIsSubmitted(false);
                            setPartialFeedback(null);
                            setUserAnswers(new Array(hidden_words.length).fill(null));
                            attemptsRef.current = 0;
                            hintsUsedRef.current = 0;
                            setCurrentHintLevel(0);
                            setHasAttempted(false);
                            startTimeRef.current = Date.now();
                            // Notify parent to reset its state
                            onReset?.();
                        }}
                        className="bg-blue-600 dark:bg-wizdi-action text-white px-6 py-2 min-h-[44px] rounded-full font-bold shadow-md hover:bg-blue-700 dark:hover:bg-wizdi-action-hover transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2"
                    >
                        נסו שוב
                    </button>
                </div>
            )}
        </div>
    );
};

export default ClozeQuestion;
