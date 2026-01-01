import React, { useState, useEffect } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck, IconX } from '../icons';

interface ClozeQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
}

const ClozeQuestion: React.FC<ClozeQuestionProps> = ({ block, onComplete }) => {
    // Telemetry Refs
    const startTimeRef = React.useRef<number>(Date.now());
    const attemptsRef = React.useRef<number>(0);

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
        setIsSubmitted(true);
        attemptsRef.current += 1; // Increment attempt

        let correctCount = 0;
        userAnswers.forEach((ans, i) => {
            if (ans === hidden_words[i]) correctCount++;
        });
        const score = Math.round((correctCount / hidden_words.length) * 100);

        const timeSpent = (Date.now() - startTimeRef.current) / 1000; // In seconds

        if (onComplete) {
            onComplete(score, {
                timeSeconds: Math.round(timeSpent),
                attempts: attemptsRef.current,
                hintsUsed: 0, // Placeholder for now
                lastAnswer: userAnswers
            });
        }
    };

    // Split sentence by placeholders
    const parts = sentence.split('_____');

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-6 text-gray-800">השלם את המשפט</h3>

            <div className="mb-8 text-lg leading-loose text-center" dir="rtl">
                {parts.map((part, i) => (
                    <React.Fragment key={i}>
                        {part}
                        {i < parts.length - 1 && (
                            <span
                                onDrop={(e) => handleDrop(e, i)}
                                onDragOver={handleDragOver}
                                onClick={() => removeAnswer(i)}
                                className={`inline-block min-w-[100px] mx-2 h-10 border-b-2 align-middle text-center px-2 cursor-pointer transition-colors
                                    ${userAnswers[i]
                                        ? (isSubmitted
                                            ? (userAnswers[i] === hidden_words[i] ? 'border-green-500 text-green-700 bg-green-50' : 'border-red-500 text-red-700 bg-red-50')
                                            : 'border-blue-500 text-blue-700 bg-blue-50')
                                        : 'border-gray-300 bg-gray-50'
                                    }
                                `}
                            >
                                {userAnswers[i] || (
                                    <span className="text-gray-300 text-sm select-none">גרור לכאן</span>
                                )}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Word Bank */}
            <div className="flex flex-wrap gap-3 justify-center mb-8 bg-gray-50 p-4 rounded-xl">
                {wordBank.map((word, i) => {
                    const isUsed = userAnswers.includes(word);
                    return (
                        <div
                            key={i}
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
                            className={`px-4 py-2 rounded-lg font-medium shadow-sm border select-none transition-all
                                ${isUsed
                                    ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer active:scale-95'
                                }
                            `}
                        >
                            {word}
                        </div>
                    );
                })}
            </div>

            {!isSubmitted && (
                <div className="text-center">
                    <button
                        onClick={checkAnswers}
                        className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition-transform active:scale-95"
                    >
                        בדיקה
                    </button>
                    {userAnswers.some(a => a === null) && (
                        <p className="text-xs text-gray-400 mt-2">ניתן לבדוק גם תשובות חלקיות</p>
                    )}
                </div>
            )}

            {isSubmitted && (
                <div className="mt-6 text-center animate-fade-in">
                    <div className="text-lg font-bold mb-4">
                        {userAnswers.every((a, i) => a === hidden_words[i]) ? (
                            <span className="text-green-600 flex items-center justify-center gap-2">
                                <IconCheck className="w-6 h-6" /> מעולה! כל התשובות נכונות
                            </span>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-red-500 flex items-center justify-center gap-2">
                                    <IconX className="w-6 h-6" /> יש טעויות
                                </span>
                                <button
                                    onClick={() => {
                                        setIsSubmitted(false);
                                        setUserAnswers(new Array(hidden_words.length).fill(null));
                                    }}
                                    className="text-blue-600 text-sm hover:underline mt-2"
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
