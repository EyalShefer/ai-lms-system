import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData, SentenceBuilderContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';

interface SentenceBuilderQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
    hints?: string[];
    onHintUsed?: () => void;
}

const SentenceBuilderQuestion: React.FC<SentenceBuilderQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);

    const content = block.content as SentenceBuilderContent;
    const { instruction, words, correctSentence } = content;

    const [availableWords, setAvailableWords] = useState<string[]>([]);
    const [selectedWords, setSelectedWords] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        // Shuffle words
        setAvailableWords([...words].sort(() => Math.random() - 0.5));
        setSelectedWords([]);
        setIsSubmitted(false);
        setIsCorrect(false);
    }, [words]);

    const handleWordClick = (word: string, fromSelected: boolean) => {
        if (isSubmitted) return;

        if (fromSelected) {
            // Move back to available
            const index = selectedWords.indexOf(word);
            if (index >= 0) {
                const newSelected = [...selectedWords];
                newSelected.splice(index, 1);
                setSelectedWords(newSelected);
                setAvailableWords([...availableWords, word]);
            }
        } else {
            // Move to selected
            const index = availableWords.indexOf(word);
            if (index >= 0) {
                const newAvailable = [...availableWords];
                newAvailable.splice(index, 1);
                setAvailableWords(newAvailable);
                setSelectedWords([...selectedWords, word]);
            }
        }
    };

    const checkAnswer = () => {
        setIsSubmitted(true);
        setHasAttempted(true);
        attemptsRef.current += 1;

        const builtSentence = selectedWords.join(' ');
        const correct = builtSentence === correctSentence;
        setIsCorrect(correct);

        const score = calculateQuestionScore({
            isCorrect: correct,
            attempts: attemptsRef.current,
            hintsUsed: hintsUsedRef.current,
            responseTimeSec: (Date.now() - startTimeRef.current) / 1000
        });

        if (onComplete) {
            onComplete(score, {
                timeSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                lastAnswer: builtSentence
            });
        }
    };

    const handleShowHint = () => {
        if (currentHintLevel < hints.length) {
            setCurrentHintLevel(prev => prev + 1);
            hintsUsedRef.current += 1;
            onHintUsed?.();
        }
    };

    const resetQuestion = () => {
        setIsSubmitted(false);
        setIsCorrect(false);
        setAvailableWords([...words].sort(() => Math.random() - 0.5));
        setSelectedWords([]);
    };

    const clearSelection = () => {
        if (isSubmitted) return;
        setAvailableWords([...words].sort(() => Math.random() - 0.5));
        setSelectedWords([]);
    };

    return (
        <div className="w-full mx-auto">
            <p className="text-lg text-indigo-800 dark:text-white/90 mb-6 text-right font-bold">{instruction}</p>

            {/* Selected Words (Sentence Building Area) */}
            <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg min-h-[80px]">
                <p className="text-sm text-gray-500 mb-3">המשפט שלכם:</p>
                <div className="flex flex-wrap gap-2 justify-center" dir="rtl">
                    {selectedWords.length === 0 ? (
                        <span className="text-gray-400 italic">לחצו על המילים למטה כדי לבנות משפט</span>
                    ) : (
                        selectedWords.map((word, index) => (
                            <button
                                key={`selected-${index}`}
                                onClick={() => handleWordClick(word, true)}
                                disabled={isSubmitted}
                                className={`px-4 py-2 rounded-xl font-medium text-lg transition-all
                                    ${isSubmitted
                                        ? isCorrect
                                            ? 'bg-green-100 text-green-700 border-2 border-green-400'
                                            : 'bg-red-100 text-red-700 border-2 border-red-400'
                                        : 'bg-blue-100 text-blue-700 border-2 border-blue-400 hover:bg-blue-200 cursor-pointer'
                                    }
                                `}
                            >
                                {word}
                            </button>
                        ))
                    )}
                </div>
                {selectedWords.length > 0 && !isSubmitted && (
                    <div className="text-center mt-4">
                        <button
                            onClick={clearSelection}
                            className="text-sm text-gray-500 hover:text-gray-700 underline"
                        >
                            נקה הכל
                        </button>
                    </div>
                )}
            </div>

            {/* Available Words */}
            <div className="bg-white/10 rounded-2xl p-6 mb-6">
                <p className="text-sm text-white/70 mb-3">מילים זמינות:</p>
                <div className="flex flex-wrap gap-2 justify-center" dir="rtl">
                    {availableWords.map((word, index) => (
                        <button
                            key={`available-${index}`}
                            onClick={() => handleWordClick(word, false)}
                            disabled={isSubmitted}
                            className={`px-4 py-2 rounded-xl font-medium text-lg transition-all
                                ${isSubmitted
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer'
                                }
                            `}
                        >
                            {word}
                        </button>
                    ))}
                </div>
            </div>

            {/* Hints Section */}
            {!isExamMode && hints.length > 0 && !isSubmitted && (
                <div className="mb-6">
                    {currentHintLevel === 0 ? (
                        <div className="text-center">
                            <button
                                onClick={handleShowHint}
                                disabled={!hasAttempted}
                                className={`px-6 py-2 rounded-full font-medium transition-all ${
                                    hasAttempted
                                        ? 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-md'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {hasAttempted ? 'רמז' : 'רמז (זמין אחרי ניסיון ראשון)'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {hints.slice(0, currentHintLevel).map((hint, idx) => (
                                <div key={idx} className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">💡</span>
                                        <div>
                                            <div className="text-xs text-yellow-700 font-bold mb-1">רמז {idx + 1}</div>
                                            <div className="text-gray-700">{hint}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {currentHintLevel < hints.length && (
                                <div className="text-center">
                                    <button
                                        onClick={handleShowHint}
                                        className="px-6 py-2 rounded-full font-medium bg-yellow-500 text-white hover:bg-yellow-600"
                                    >
                                        רמז נוסף ({currentHintLevel}/{hints.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Submit Button */}
            {!isSubmitted && (
                <div className="text-center">
                    <button
                        onClick={checkAnswer}
                        disabled={selectedWords.length === 0}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${selectedWords.length > 0
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        בדיקה
                    </button>
                </div>
            )}

            {/* Results */}
            {isSubmitted && (
                <div className="mt-6 text-center animate-fade-in">
                    {isCorrect ? (
                        <span className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                            <IconCheck className="w-6 h-6" /> כל הכבוד! המשפט נכון
                        </span>
                    ) : (
                        <div className="space-y-4">
                            <span className="text-red-400 flex items-center justify-center gap-2 text-lg font-bold">
                                <IconX className="w-6 h-6" /> המשפט לא נכון
                            </span>
                            <div className="bg-white/10 rounded-xl p-4">
                                <p className="text-white/80 text-sm mb-2">המשפט הנכון:</p>
                                <p className="text-white font-medium text-lg">{correctSentence}</p>
                            </div>
                            <button
                                onClick={resetQuestion}
                                className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700"
                            >
                                נסו שוב
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SentenceBuilderQuestion;
