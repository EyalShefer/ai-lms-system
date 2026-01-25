import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData, HighlightContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';

interface HighlightQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
    hints?: string[];
    onHintUsed?: () => void;
}

const HighlightQuestion: React.FC<HighlightQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);

    const content = block.content as HighlightContent;
    const { instruction, text, correctHighlights, highlightType = 'background' } = content;

    const [selectedRanges, setSelectedRanges] = useState<{ start: number; end: number; text: string }[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<{ correct: string[]; incorrect: string[]; missed: string[] }>({
        correct: [],
        incorrect: [],
        missed: []
    });
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    // Split text into words with their positions
    const words = React.useMemo(() => {
        const result: { word: string; start: number; end: number }[] = [];
        let position = 0;

        text.split(/(\s+)/).forEach((part) => {
            if (part.trim()) {
                result.push({
                    word: part,
                    start: position,
                    end: position + part.length
                });
            }
            position += part.length;
        });

        return result;
    }, [text]);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        setSelectedRanges([]);
        setIsSubmitted(false);
        setResults({ correct: [], incorrect: [], missed: [] });
    }, [text]);

    const isWordSelected = (wordStart: number, wordEnd: number) => {
        return selectedRanges.some(range =>
            (wordStart >= range.start && wordEnd <= range.end) ||
            (range.start >= wordStart && range.end <= wordEnd) ||
            (wordStart <= range.start && wordEnd > range.start) ||
            (wordStart < range.end && wordEnd >= range.end)
        );
    };

    const isWordCorrect = (word: string) => {
        return correctHighlights.some(h => h.text === word);
    };

    const handleWordClick = (word: string, start: number, end: number) => {
        if (isSubmitted) return;

        const existingIndex = selectedRanges.findIndex(r => r.text === word && r.start === start);

        if (existingIndex >= 0) {
            // Deselect
            setSelectedRanges(selectedRanges.filter((_, i) => i !== existingIndex));
        } else {
            // Select
            setSelectedRanges([...selectedRanges, { start, end, text: word }]);
        }
    };

    const checkAnswers = () => {
        setIsSubmitted(true);
        setHasAttempted(true);
        attemptsRef.current += 1;

        const correctWords = correctHighlights.map(h => h.text);
        const selectedWords = selectedRanges.map(r => r.text);

        const correct = selectedWords.filter(w => correctWords.includes(w));
        const incorrect = selectedWords.filter(w => !correctWords.includes(w));
        const missed = correctWords.filter(w => !selectedWords.includes(w));

        setResults({ correct, incorrect, missed });

        const isAllCorrect = incorrect.length === 0 && missed.length === 0;

        const score = calculateQuestionScore({
            isCorrect: isAllCorrect,
            attempts: attemptsRef.current,
            hintsUsed: hintsUsedRef.current,
            responseTimeSec: (Date.now() - startTimeRef.current) / 1000
        });

        if (onComplete) {
            onComplete(score, {
                timeSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                lastAnswer: selectedRanges
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
        setSelectedRanges([]);
        setResults({ correct: [], incorrect: [], missed: [] });
    };

    const getHighlightStyle = (word: string, isSelected: boolean) => {
        if (!isSelected && !isSubmitted) return {};

        if (isSubmitted) {
            const isCorrectWord = isWordCorrect(word);
            const wasSelected = selectedRanges.some(r => r.text === word);

            if (wasSelected && isCorrectWord) {
                return {
                    backgroundColor: '#BBF7D0',
                    border: '2px solid #22C55E',
                    borderRadius: highlightType === 'circle' ? '50%' : '4px'
                };
            }
            if (wasSelected && !isCorrectWord) {
                return {
                    backgroundColor: '#FECACA',
                    border: '2px solid #EF4444',
                    borderRadius: highlightType === 'circle' ? '50%' : '4px',
                    textDecoration: highlightType === 'underline' ? 'line-through' : 'none'
                };
            }
            if (!wasSelected && isCorrectWord) {
                return {
                    backgroundColor: '#FEF3C7',
                    border: '2px dashed #F59E0B',
                    borderRadius: highlightType === 'circle' ? '50%' : '4px'
                };
            }
            return {};
        }

        // Selected but not submitted
        if (highlightType === 'circle') {
            return {
                backgroundColor: '#DBEAFE',
                border: '2px solid #3B82F6',
                borderRadius: '50%',
                padding: '2px 8px'
            };
        }
        if (highlightType === 'underline') {
            return {
                borderBottom: '3px solid #3B82F6',
                paddingBottom: '2px'
            };
        }
        return {
            backgroundColor: '#DBEAFE',
            borderRadius: '4px',
            padding: '2px 4px'
        };
    };

    return (
        <div className="w-full mx-auto">
            <p className="text-lg text-indigo-800 dark:text-white/90 mb-6 text-right font-bold">{instruction}</p>

            {/* Text Area */}
            <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg">
                <div className="text-xl leading-loose text-gray-800 text-right" dir="rtl">
                    {words.map((wordData, index) => {
                        const isSelected = selectedRanges.some(r => r.text === wordData.word && r.start === wordData.start);
                        const style = getHighlightStyle(wordData.word, isSelected);

                        return (
                            <React.Fragment key={index}>
                                <span
                                    onClick={() => handleWordClick(wordData.word, wordData.start, wordData.end)}
                                    className={`cursor-pointer transition-all inline-block mx-1 my-1 px-1
                                        ${!isSubmitted ? 'hover:bg-blue-100 hover:rounded' : ''}
                                    `}
                                    style={style}
                                >
                                    {wordData.word}
                                </span>
                                {' '}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Selection Summary */}
            {selectedRanges.length > 0 && !isSubmitted && (
                <div className="mb-6 p-4 bg-white/10 rounded-xl">
                    <p className="text-white/80 text-sm mb-2">נבחרו ({selectedRanges.length}):</p>
                    <div className="flex flex-wrap gap-2">
                        {selectedRanges.map((range, idx) => (
                            <span
                                key={idx}
                                onClick={() => handleWordClick(range.text, range.start, range.end)}
                                className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-200"
                            >
                                {range.text} ✕
                            </span>
                        ))}
                    </div>
                </div>
            )}

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
                        onClick={checkAnswers}
                        disabled={selectedRanges.length === 0}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${selectedRanges.length > 0
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
                    {results.incorrect.length === 0 && results.missed.length === 0 ? (
                        <span className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                            <IconCheck className="w-6 h-6" /> כל הכבוד! סימנת נכון
                        </span>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-right bg-white/10 rounded-xl p-4">
                                {results.correct.length > 0 && (
                                    <p className="text-green-400 mb-2">
                                        ✓ נכון: {results.correct.join(', ')}
                                    </p>
                                )}
                                {results.incorrect.length > 0 && (
                                    <p className="text-red-400 mb-2">
                                        ✗ שגוי: {results.incorrect.join(', ')}
                                    </p>
                                )}
                                {results.missed.length > 0 && (
                                    <p className="text-yellow-400">
                                        ⚠ פספסת: {results.missed.join(', ')}
                                    </p>
                                )}
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

export default HighlightQuestion;
