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
}

const ClozeQuestion: React.FC<ClozeQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    // Telemetry Refs
    const startTimeRef = React.useRef<number>(Date.now());
    const attemptsRef = React.useRef<number>(0);
    const hintsUsedRef = React.useRef<number>(0); // ✨ NEW

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

    // Initialize
    useEffect(() => {
        startTimeRef.current = Date.now(); // Reset timer on new question
        attemptsRef.current = 0;

        if (!sentence) return;

        // Prepare blanks based on sentence
        const blanksCount = (sentence.match(/_____/g) || []).length;
        setUserAnswers(new Array(blanksCount).fill(null));

        // Prepare word bank (shuffled)
        const allWords = [...hidden_words, ...(distractors || [])];
        setWordBank(allWords.sort(() => Math.random() - 0.5));
    }, [block, sentence, hidden_words, distractors]);

    const handleDragStart = (e: React.DragEvent, word: string) => {
        e.dataTransfer.setData("text/plain", word);
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        const word = e.dataTransfer.getData("text/plain");
        if (isSubmitted) return;

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
        setUserAnswers(prev => {
            const newState = [...prev];
            newState[index] = null;
            return newState;
        });
    };

    const checkAnswers = () => {
        setHasAttempted(true); // ✨ Unlock hints
        attemptsRef.current += 1;

        let correctCount = 0;
        userAnswers.forEach((ans, i) => {
            if (ans === hidden_words[i]) correctCount++;
        });

        // Calculate raw accuracy
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
            // Clear wrong answers to allow re-attempt
            setUserAnswers(prev => prev.map((ans, i) =>
                ans === hidden_words[i] ? ans : null // Keep correct, clear wrong
            ));
        }
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

            {!isSubmitted && (
                <div className="text-center">
                    <button
                        onClick={checkAnswers}
                        aria-label="בדיקת התשובות"
                        className="bg-blue-600 dark:bg-wizdi-action text-white px-8 py-3 min-h-[44px] rounded-full font-bold shadow-lg hover:bg-blue-700 dark:hover:bg-wizdi-action-hover transition-transform active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2"
                    >
                        בדיקה
                    </button>
                    {userAnswers.some(a => a === null) && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">ניתן לבדוק גם תשובות חלקיות</p>
                    )}
                </div>
            )}

            {isSubmitted && (
                <div className="mt-6 text-center animate-fade-in motion-reduce:animate-none" role="alert" aria-live="polite">
                    <div className="text-lg font-bold mb-4">
                        {userAnswers.every((a, i) => a === hidden_words[i]) ? (
                            <span className="text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                                <IconCheck className="w-6 h-6" aria-hidden="true" /> מעולה! כל התשובות נכונות
                            </span>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-red-500 dark:text-red-400 flex items-center justify-center gap-2">
                                    <IconX className="w-6 h-6" aria-hidden="true" /> יש טעויות
                                </span>
                                <button
                                    onClick={() => {
                                        setIsSubmitted(false);
                                        setUserAnswers(new Array(hidden_words.length).fill(null));
                                    }}
                                    className="text-blue-600 dark:text-wizdi-cyan text-sm hover:underline mt-2 min-h-[44px] px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 rounded"
                                >
                                    נסה שוב
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClozeQuestion;
