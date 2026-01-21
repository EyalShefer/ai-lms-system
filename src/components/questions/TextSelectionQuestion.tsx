import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData, TextSelectionContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';

interface TextSelectionQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
    hints?: string[];
    onHintUsed?: () => void;
}

const TextSelectionQuestion: React.FC<TextSelectionQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);

    const content = block.content as TextSelectionContent;
    const { instruction, text, selectableUnits, correctSelections, minSelections = 1, maxSelections } = content;

    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<{ correct: string[]; incorrect: string[]; missed: string[] }>({
        correct: [],
        incorrect: [],
        missed: []
    });
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    // Parse text into selectable units
    const units = React.useMemo(() => {
        if (selectableUnits === 'sentence') {
            // Split by sentence-ending punctuation
            return text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        }
        if (selectableUnits === 'paragraph') {
            return text.split(/\n\n+/).filter(p => p.trim());
        }
        // Default: words
        return text.split(/\s+/).filter(w => w.trim());
    }, [text, selectableUnits]);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        setSelectedItems([]);
        setIsSubmitted(false);
        setResults({ correct: [], incorrect: [], missed: [] });
    }, [text]);

    const handleUnitClick = (unit: string) => {
        if (isSubmitted) return;

        const index = selectedItems.indexOf(unit);
        if (index >= 0) {
            // Deselect
            setSelectedItems(selectedItems.filter(s => s !== unit));
        } else {
            // Check max selections
            if (maxSelections && selectedItems.length >= maxSelections) {
                return;
            }
            setSelectedItems([...selectedItems, unit]);
        }
    };

    const isUnitSelected = (unit: string) => selectedItems.includes(unit);
    const isUnitCorrect = (unit: string) => correctSelections.includes(unit);

    const checkAnswers = () => {
        setIsSubmitted(true);
        setHasAttempted(true);
        attemptsRef.current += 1;

        const correct = selectedItems.filter(item => correctSelections.includes(item));
        const incorrect = selectedItems.filter(item => !correctSelections.includes(item));
        const missed = correctSelections.filter(item => !selectedItems.includes(item));

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
                lastAnswer: selectedItems
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
        setSelectedItems([]);
        setResults({ correct: [], incorrect: [], missed: [] });
    };

    const getUnitStyle = (unit: string) => {
        const isSelected = isUnitSelected(unit);
        const isCorrect = isUnitCorrect(unit);

        if (isSubmitted) {
            if (isSelected && isCorrect) {
                return 'bg-green-200 text-green-800 border-2 border-green-500';
            }
            if (isSelected && !isCorrect) {
                return 'bg-red-200 text-red-800 border-2 border-red-500 line-through';
            }
            if (!isSelected && isCorrect) {
                return 'bg-yellow-100 text-yellow-800 border-2 border-dashed border-yellow-500';
            }
            return 'bg-white text-gray-600';
        }

        if (isSelected) {
            return 'bg-blue-200 text-blue-800 border-2 border-blue-500';
        }

        return 'bg-white text-gray-700 hover:bg-blue-50 border-2 border-transparent';
    };

    const unitLabel = selectableUnits === 'sentence' ? 'משפטים' :
        selectableUnits === 'paragraph' ? 'פסקאות' : 'מילים';

    return (
        <div className="w-full mx-auto">
            <p className="text-lg text-indigo-800 dark:text-white/90 mb-6 text-right font-bold">{instruction}</p>

            {/* Selection Info */}
            <div className="mb-4 text-center">
                <span className="text-white/70 text-sm">
                    בחרו {unitLabel}
                    {minSelections > 1 && ` (מינימום ${minSelections})`}
                    {maxSelections && ` (מקסימום ${maxSelections})`}
                </span>
            </div>

            {/* Text Area */}
            <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg">
                <div className={`text-right leading-loose ${selectableUnits === 'word' ? 'flex flex-wrap gap-1' : 'space-y-2'}`} dir="rtl">
                    {units.map((unit, index) => (
                        <button
                            key={index}
                            onClick={() => handleUnitClick(unit)}
                            disabled={isSubmitted}
                            className={`
                                ${selectableUnits === 'word' ? 'px-2 py-1 text-lg' : 'block w-full p-3 text-right text-base'}
                                rounded-lg transition-all cursor-pointer
                                ${getUnitStyle(unit)}
                            `}
                        >
                            {unit}
                            {isSubmitted && isUnitSelected(unit) && isUnitCorrect(unit) && (
                                <IconCheck className="w-4 h-4 inline mr-1 text-green-600" />
                            )}
                            {isSubmitted && isUnitSelected(unit) && !isUnitCorrect(unit) && (
                                <IconX className="w-4 h-4 inline mr-1 text-red-600" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Selection Count */}
            {!isSubmitted && selectedItems.length > 0 && (
                <div className="mb-6 text-center">
                    <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
                        נבחרו: {selectedItems.length} {unitLabel}
                    </span>
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
                        disabled={selectedItems.length < minSelections}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${selectedItems.length >= minSelections
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
                            <IconCheck className="w-6 h-6" /> כל הכבוד! בחרת נכון
                        </span>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-right bg-white/10 rounded-xl p-4 text-sm">
                                {results.correct.length > 0 && (
                                    <p className="text-green-400 mb-2">
                                        ✓ נכון ({results.correct.length})
                                    </p>
                                )}
                                {results.incorrect.length > 0 && (
                                    <p className="text-red-400 mb-2">
                                        ✗ שגוי ({results.incorrect.length})
                                    </p>
                                )}
                                {results.missed.length > 0 && (
                                    <p className="text-yellow-400">
                                        ⚠ פספסת ({results.missed.length})
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={resetQuestion}
                                className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700"
                            >
                                נסה שוב
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TextSelectionQuestion;
