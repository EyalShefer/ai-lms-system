import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData, MatrixContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';
import { sanitizeHtml } from '../../utils/sanitize';

interface MatrixQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
    hints?: string[];
    onHintUsed?: () => void;
}

const MatrixQuestion: React.FC<MatrixQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);

    const content = block.content as MatrixContent;
    const { instruction, columns, rows } = content;

    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<Record<number, boolean>>({});
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        setAnswers({});
        setIsSubmitted(false);
        setResults({});
    }, [rows]);

    const handleSelect = (rowIndex: number, column: string) => {
        if (isSubmitted) return;
        setAnswers(prev => ({ ...prev, [rowIndex]: column }));
    };

    const getAnsweredCount = () => Object.keys(answers).length;

    const checkAnswers = () => {
        setIsSubmitted(true);
        setHasAttempted(true);
        attemptsRef.current += 1;

        const newResults: Record<number, boolean> = {};
        let correctCount = 0;

        rows.forEach((row, index) => {
            const userAnswer = answers[index];
            const isCorrect = userAnswer === row.correctAnswer;
            newResults[index] = isCorrect;
            if (isCorrect) correctCount++;
        });

        setResults(newResults);

        const isAllCorrect = correctCount === rows.length;

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
                lastAnswer: answers
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
        setAnswers({});
        setResults({});
    };

    return (
        <div className="w-full mx-auto">
            <h3 className="text-3xl font-black mb-4 text-white text-center drop-shadow-sm">מטריקס</h3>
            <p className="text-lg text-white/90 mb-8 text-center font-medium">{instruction}</p>

            {/* Matrix Table */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg mb-6">
                <table className="w-full" dir="rtl">
                    <thead>
                        <tr className="bg-gradient-to-r from-blue-500 to-blue-600">
                            <th className="px-4 py-3 text-white font-bold text-right border-l border-blue-400 w-1/3">
                                שאלה
                            </th>
                            {columns.map((col, index) => (
                                <th
                                    key={index}
                                    className="px-4 py-3 text-white font-bold text-center border-l border-blue-400 last:border-l-0"
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            const isRowCorrect = results[rowIndex];
                            const userAnswer = answers[rowIndex];

                            return (
                                <tr
                                    key={rowIndex}
                                    className={`
                                        ${rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                                        ${isSubmitted
                                            ? isRowCorrect
                                                ? 'bg-green-50'
                                                : 'bg-red-50'
                                            : ''
                                        }
                                    `}
                                >
                                    {/* Question Cell */}
                                    <td className="px-4 py-4 border-l border-gray-200 text-right">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-700 font-medium" dangerouslySetInnerHTML={{ __html: sanitizeHtml(row.question || '') }} />
                                            {isSubmitted && (
                                                isRowCorrect
                                                    ? <IconCheck className="w-5 h-5 text-green-600" />
                                                    : <IconX className="w-5 h-5 text-red-600" />
                                            )}
                                        </div>
                                    </td>

                                    {/* Option Cells */}
                                    {columns.map((col, colIndex) => {
                                        const isSelected = userAnswer === col;
                                        const isCorrectAnswer = row.correctAnswer === col;

                                        return (
                                            <td
                                                key={colIndex}
                                                className="px-4 py-4 border-l border-gray-200 last:border-l-0 text-center"
                                            >
                                                <button
                                                    onClick={() => handleSelect(rowIndex, col)}
                                                    disabled={isSubmitted}
                                                    className={`
                                                        w-8 h-8 rounded-full border-2 transition-all
                                                        flex items-center justify-center mx-auto
                                                        ${isSubmitted
                                                            ? isSelected
                                                                ? isRowCorrect
                                                                    ? 'bg-green-500 border-green-600 text-white'
                                                                    : 'bg-red-500 border-red-600 text-white'
                                                                : isCorrectAnswer
                                                                    ? 'bg-green-100 border-green-500 border-dashed'
                                                                    : 'bg-gray-100 border-gray-300'
                                                            : isSelected
                                                                ? 'bg-blue-500 border-blue-600 text-white'
                                                                : 'bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                                        }
                                                    `}
                                                >
                                                    {isSelected && (
                                                        <span className="text-lg">●</span>
                                                    )}
                                                    {isSubmitted && !isSelected && isCorrectAnswer && (
                                                        <span className="text-green-600">✓</span>
                                                    )}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Progress Indicator */}
            {!isSubmitted && (
                <div className="mb-6 text-center">
                    <span className="text-white/70 text-sm">
                        ענית על {getAnsweredCount()} מתוך {rows.length} שאלות
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
                        disabled={getAnsweredCount() < rows.length}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${getAnsweredCount() === rows.length
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
                    {Object.values(results).every(r => r) ? (
                        <span className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                            <IconCheck className="w-6 h-6" /> כל הכבוד! כל התשובות נכונות
                        </span>
                    ) : (
                        <div className="space-y-4">
                            <span className="text-red-400 flex items-center justify-center gap-2 text-lg font-bold">
                                <IconX className="w-6 h-6" />
                                {Object.values(results).filter(r => r).length} מתוך {rows.length} נכונות
                            </span>
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

export default MatrixQuestion;
