import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData, RatingScaleContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';

interface RatingScaleQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
}

const RatingScaleQuestion: React.FC<RatingScaleQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);

    const content = block.content as RatingScaleContent;
    const { question, minValue, maxValue, minLabel, maxLabel, correctAnswer, showNumbers } = content;

    const [selectedValue, setSelectedValue] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);

    // Generate scale values
    const scaleValues = React.useMemo(() => {
        const values: number[] = [];
        for (let i = minValue; i <= maxValue; i++) {
            values.push(i);
        }
        return values;
    }, [minValue, maxValue]);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        setSelectedValue(null);
        setIsSubmitted(false);
        setIsCorrect(false);
    }, [question]);

    const handleSelect = (value: number) => {
        if (isSubmitted) return;
        setSelectedValue(value);
    };

    const checkAnswer = () => {
        setIsSubmitted(true);
        attemptsRef.current += 1;

        // If there's a correct answer defined, check it
        const hasCorrectAnswer = correctAnswer !== undefined && correctAnswer !== null;
        const correct = hasCorrectAnswer ? selectedValue === correctAnswer : true;
        setIsCorrect(correct);

        // For subjective questions (no correct answer), always give full score
        const score = hasCorrectAnswer
            ? calculateQuestionScore({
                isCorrect: correct,
                attempts: attemptsRef.current,
                hintsUsed: 0,
                responseTimeSec: (Date.now() - startTimeRef.current) / 1000
            })
            : 100;

        if (onComplete) {
            onComplete(score, {
                timeSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                attempts: attemptsRef.current,
                hintsUsed: 0,
                lastAnswer: selectedValue
            });
        }
    };

    const resetQuestion = () => {
        setIsSubmitted(false);
        setSelectedValue(null);
        setIsCorrect(false);
    };

    const hasCorrectAnswer = correctAnswer !== undefined && correctAnswer !== null;

    return (
        <div className="w-full mx-auto">
            <h3 className="text-3xl font-black mb-4 text-white text-center drop-shadow-sm">סקאלת דירוג</h3>
            <p className="text-xl text-white/90 mb-8 text-center font-medium">{question}</p>

            {/* Scale */}
            <div className="bg-white rounded-2xl p-8 mb-6 shadow-lg">
                {/* Labels */}
                <div className="flex justify-between mb-6 text-sm text-gray-600 px-2">
                    <span className="text-right">{maxLabel}</span>
                    <span className="text-left">{minLabel}</span>
                </div>

                {/* Scale Buttons */}
                <div className="flex justify-between items-center gap-2" dir="ltr">
                    {scaleValues.map((value) => {
                        const isSelected = selectedValue === value;
                        const isCorrectValue = correctAnswer === value;

                        return (
                            <button
                                key={value}
                                onClick={() => handleSelect(value)}
                                disabled={isSubmitted}
                                className={`
                                    flex-1 aspect-square max-w-[60px] rounded-full
                                    flex items-center justify-center
                                    font-bold text-lg transition-all
                                    ${isSubmitted
                                        ? isSelected
                                            ? hasCorrectAnswer
                                                ? isCorrect
                                                    ? 'bg-green-500 text-white ring-4 ring-green-300'
                                                    : 'bg-red-500 text-white ring-4 ring-red-300'
                                                : 'bg-blue-500 text-white ring-4 ring-blue-300'
                                            : isCorrectValue && hasCorrectAnswer
                                                ? 'bg-green-100 text-green-700 ring-2 ring-dashed ring-green-500'
                                                : 'bg-gray-100 text-gray-400'
                                        : isSelected
                                            ? 'bg-blue-500 text-white ring-4 ring-blue-300 scale-110'
                                            : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 hover:scale-105'
                                    }
                                `}
                            >
                                {showNumbers ? value : '●'}
                            </button>
                        );
                    })}
                </div>

                {/* Visual Scale Line */}
                <div className="mt-6 relative">
                    <div className="h-2 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-full" />
                    {selectedValue !== null && (
                        <div
                            className="absolute top-0 w-4 h-4 bg-blue-500 rounded-full -translate-y-1 transition-all shadow-lg"
                            style={{
                                left: `${((selectedValue - minValue) / (maxValue - minValue)) * 100}%`,
                                transform: 'translateX(-50%) translateY(-25%)'
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Selected Value Display */}
            {selectedValue !== null && !isSubmitted && (
                <div className="mb-6 text-center">
                    <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-lg font-medium">
                        בחרת: {selectedValue}
                    </span>
                </div>
            )}

            {/* Submit Button */}
            {!isSubmitted && (
                <div className="text-center">
                    <button
                        onClick={checkAnswer}
                        disabled={selectedValue === null}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${selectedValue !== null
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        {hasCorrectAnswer ? 'בדיקה' : 'שליחה'}
                    </button>
                </div>
            )}

            {/* Results */}
            {isSubmitted && (
                <div className="mt-6 text-center animate-fade-in">
                    {hasCorrectAnswer ? (
                        isCorrect ? (
                            <span className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                                <IconCheck className="w-6 h-6" /> כל הכבוד! בחרת נכון
                            </span>
                        ) : (
                            <div className="space-y-4">
                                <span className="text-red-400 flex items-center justify-center gap-2 text-lg font-bold">
                                    <IconX className="w-6 h-6" /> לא נכון
                                </span>
                                <p className="text-white/80">
                                    התשובה הנכונה: {correctAnswer}
                                </p>
                                <button
                                    onClick={resetQuestion}
                                    className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700"
                                >
                                    נסו שוב
                                </button>
                            </div>
                        )
                    ) : (
                        <span className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                            <IconCheck className="w-6 h-6" /> תודה על התשובה!
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default RatingScaleQuestion;
