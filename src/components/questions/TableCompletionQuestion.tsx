import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData, TableCompletionContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';

interface TableCompletionQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
    hints?: string[];
    onHintUsed?: () => void;
}

const TableCompletionQuestion: React.FC<TableCompletionQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);

    const content = block.content as TableCompletionContent;
    const { instruction, headers, rows } = content;

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<Record<string, boolean>>({});
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        setAnswers({});
        setIsSubmitted(false);
        setResults({});
    }, [rows]);

    const getCellKey = (rowIndex: number, cellIndex: number) => `${rowIndex}-${cellIndex}`;

    const handleInputChange = (rowIndex: number, cellIndex: number, value: string) => {
        if (isSubmitted) return;
        const key = getCellKey(rowIndex, cellIndex);
        setAnswers(prev => ({ ...prev, [key]: value }));
    };

    const getEditableCellsCount = () => {
        let count = 0;
        rows.forEach(row => {
            row.cells.forEach(cell => {
                if (cell.editable) count++;
            });
        });
        return count;
    };

    const getFilledCellsCount = () => {
        let count = 0;
        rows.forEach((row, rowIndex) => {
            row.cells.forEach((cell, cellIndex) => {
                if (cell.editable) {
                    const key = getCellKey(rowIndex, cellIndex);
                    if (answers[key]?.trim()) count++;
                }
            });
        });
        return count;
    };

    const checkAnswers = () => {
        setIsSubmitted(true);
        setHasAttempted(true);
        attemptsRef.current += 1;

        const newResults: Record<string, boolean> = {};
        let correctCount = 0;
        let totalEditable = 0;

        rows.forEach((row, rowIndex) => {
            row.cells.forEach((cell, cellIndex) => {
                if (cell.editable && cell.correctAnswer) {
                    totalEditable++;
                    const key = getCellKey(rowIndex, cellIndex);
                    const userAnswer = (answers[key] || '').trim().toLowerCase();
                    const correctAnswer = cell.correctAnswer.trim().toLowerCase();
                    const isCorrect = userAnswer === correctAnswer;
                    newResults[key] = isCorrect;
                    if (isCorrect) correctCount++;
                }
            });
        });

        setResults(newResults);

        const isAllCorrect = correctCount === totalEditable;

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
            <p className="text-lg text-indigo-800 dark:text-white/90 mb-6 text-right font-bold">{instruction}</p>

            {/* Table */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg mb-6">
                <table className="w-full" dir="rtl">
                    <thead>
                        <tr className="bg-gradient-to-r from-blue-500 to-blue-600">
                            {headers.map((header, index) => (
                                <th
                                    key={index}
                                    className="px-4 py-3 text-white font-bold text-right border-l border-blue-400 last:border-l-0"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={rowIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                            >
                                {row.cells.map((cell, cellIndex) => {
                                    const key = getCellKey(rowIndex, cellIndex);
                                    const isCorrect = results[key];

                                    return (
                                        <td
                                            key={cellIndex}
                                            className="px-4 py-3 border-l border-gray-200 last:border-l-0"
                                        >
                                            {cell.editable ? (
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={answers[key] || ''}
                                                        onChange={(e) => handleInputChange(rowIndex, cellIndex, e.target.value)}
                                                        disabled={isSubmitted}
                                                        placeholder="..."
                                                        className={`w-full px-3 py-2 rounded-lg border-2 text-right transition-all
                                                            ${isSubmitted
                                                                ? isCorrect
                                                                    ? 'border-green-400 bg-green-50 text-green-700'
                                                                    : 'border-red-400 bg-red-50 text-red-700'
                                                                : 'border-blue-200 bg-blue-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-200'
                                                            }
                                                        `}
                                                    />
                                                    {isSubmitted && (
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2">
                                                            {isCorrect
                                                                ? <IconCheck className="w-5 h-5 text-green-600" />
                                                                : <IconX className="w-5 h-5 text-red-600" />
                                                            }
                                                        </span>
                                                    )}
                                                    {isSubmitted && !isCorrect && cell.correctAnswer && (
                                                        <div className="text-xs text-green-600 mt-1">
                                                            התשובה: {cell.correctAnswer}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-700 font-medium">{cell.value}</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Progress Indicator */}
            {!isSubmitted && (
                <div className="mb-6 text-center">
                    <span className="text-white/70 text-sm">
                        מילאת {getFilledCellsCount()} מתוך {getEditableCellsCount()} תאים
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
                        disabled={getFilledCellsCount() === 0}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${getFilledCellsCount() > 0
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
                            <IconCheck className="w-6 h-6" /> כל הכבוד! כל התאים נכונים
                        </span>
                    ) : (
                        <div className="space-y-4">
                            <span className="text-red-400 flex items-center justify-center gap-2 text-lg font-bold">
                                <IconX className="w-6 h-6" /> יש תאים שגויים
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

export default TableCompletionQuestion;
