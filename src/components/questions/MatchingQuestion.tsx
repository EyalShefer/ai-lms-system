import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ActivityBlock, TelemetryData, MatchingContent } from '../../shared/types/courseTypes';
import { IconCheck, IconX } from '../../icons';
import { calculateQuestionScore } from '../../utils/scoring';
import { MathRenderer } from '../MathRenderer';

interface MatchingQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
    hints?: string[];
    onHintUsed?: () => void;
}

interface Connection {
    leftId: string;
    rightId: string;
}

const MatchingQuestion: React.FC<MatchingQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const content = block.content as MatchingContent;
    const { instruction, leftItems, rightItems, correctMatches } = content;

    const [connections, setConnections] = useState<Connection[]>([]);
    const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [results, setResults] = useState<Record<string, boolean>>({});
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);
    const [shuffledRight, setShuffledRight] = useState<typeof rightItems>([]);

    useEffect(() => {
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;
        setConnections([]);
        setSelectedLeft(null);
        setIsSubmitted(false);
        setResults({});
        // Shuffle right items
        setShuffledRight([...rightItems].sort(() => Math.random() - 0.5));
    }, [rightItems]);

    const handleLeftClick = (leftId: string) => {
        if (isSubmitted) return;

        // If already connected, disconnect
        const existingConnection = connections.find(c => c.leftId === leftId);
        if (existingConnection) {
            setConnections(connections.filter(c => c.leftId !== leftId));
            return;
        }

        setSelectedLeft(leftId);
    };

    const handleRightClick = (rightId: string) => {
        if (isSubmitted || !selectedLeft) return;

        // Remove any existing connection to this right item
        const newConnections = connections.filter(c => c.rightId !== rightId && c.leftId !== selectedLeft);
        newConnections.push({ leftId: selectedLeft, rightId });

        setConnections(newConnections);
        setSelectedLeft(null);
    };

    const checkAnswers = () => {
        setIsSubmitted(true);
        setHasAttempted(true);
        attemptsRef.current += 1;

        const newResults: Record<string, boolean> = {};
        let correctCount = 0;

        connections.forEach(conn => {
            const isCorrect = correctMatches.some(
                match => match.left === conn.leftId && match.right === conn.rightId
            );
            newResults[conn.leftId] = isCorrect;
            if (isCorrect) correctCount++;
        });

        setResults(newResults);

        const isAllCorrect = correctCount === correctMatches.length && connections.length === correctMatches.length;

        // Only call onComplete when all answers are correct
        if (isAllCorrect && onComplete) {
            const score = calculateQuestionScore({
                isCorrect: true,
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                responseTimeSec: (Date.now() - startTimeRef.current) / 1000
            });

            onComplete(score, {
                timeSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                lastAnswer: connections
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
        setConnections([]);
        setSelectedLeft(null);
        setResults({});
    };

    const getConnectionColor = (leftId: string) => {
        if (!isSubmitted) return '#3B82F6'; // blue
        return results[leftId] ? '#22C55E' : '#EF4444'; // green or red
    };

    const isLeftConnected = (leftId: string) => connections.some(c => c.leftId === leftId);
    const isRightConnected = (rightId: string) => connections.some(c => c.rightId === rightId);
    const getConnectedRight = (leftId: string) => connections.find(c => c.leftId === leftId)?.rightId;

    return (
        <div className="w-full mx-auto" ref={containerRef}>
            <p className="text-lg text-indigo-800 dark:text-white/90 mb-6 text-right font-bold">{instruction}</p>

            <div className="flex justify-between gap-8 mb-8">
                {/* Left Column */}
                <div className="flex-1 space-y-3">
                    {leftItems.map((item) => {
                        const isConnected = isLeftConnected(item.id);
                        const isSelected = selectedLeft === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleLeftClick(item.id)}
                                disabled={isSubmitted}
                                className={`w-full p-4 rounded-xl border-2 transition-all text-right font-medium
                                    ${isSubmitted
                                        ? results[item.id] === true
                                            ? 'bg-green-50 border-green-400 text-green-700'
                                            : results[item.id] === false
                                                ? 'bg-red-50 border-red-400 text-red-700'
                                                : 'bg-gray-50 border-gray-300 text-gray-600'
                                        : isSelected
                                            ? 'bg-blue-100 border-blue-500 text-blue-700 shadow-lg'
                                            : isConnected
                                                ? 'bg-blue-50 border-blue-400 text-blue-700'
                                                : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md text-gray-700'
                                    }
                                `}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span>
                                        {item.text.includes('$') ? (
                                            <MathRenderer content={item.text} className="inline" />
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                    {isConnected && !isSubmitted && (
                                        <span className="text-blue-500">●</span>
                                    )}
                                    {isSubmitted && results[item.id] === true && (
                                        <IconCheck className="w-5 h-5 text-green-600" />
                                    )}
                                    {isSubmitted && results[item.id] === false && (
                                        <IconX className="w-5 h-5 text-red-600" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Connection Indicator */}
                <div className="flex flex-col justify-center items-center">
                    {selectedLeft && (
                        <div className="text-blue-500 animate-pulse text-2xl">→</div>
                    )}
                </div>

                {/* Right Column */}
                <div className="flex-1 space-y-3">
                    {shuffledRight.map((item) => {
                        const isConnected = isRightConnected(item.id);
                        const connectedLeftId = connections.find(c => c.rightId === item.id)?.leftId;

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleRightClick(item.id)}
                                disabled={isSubmitted || !selectedLeft}
                                className={`w-full p-4 rounded-xl border-2 transition-all text-right font-medium
                                    ${isSubmitted
                                        ? connectedLeftId && results[connectedLeftId] === true
                                            ? 'bg-green-50 border-green-400 text-green-700'
                                            : connectedLeftId && results[connectedLeftId] === false
                                                ? 'bg-red-50 border-red-400 text-red-700'
                                                : 'bg-gray-50 border-gray-300 text-gray-600'
                                        : isConnected
                                            ? 'bg-blue-50 border-blue-400 text-blue-700'
                                            : selectedLeft
                                                ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md text-gray-700 cursor-pointer'
                                                : 'bg-white border-gray-200 text-gray-700 opacity-60'
                                    }
                                `}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    {isConnected && !isSubmitted && (
                                        <span className="text-blue-500">●</span>
                                    )}
                                    <span className="flex-1">
                                        {item.text.includes('$') ? (
                                            <MathRenderer content={item.text} className="inline" />
                                        ) : (
                                            item.text
                                        )}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Connection Summary */}
            {connections.length > 0 && !isSubmitted && (
                <div className="mb-6 p-4 bg-white/10 rounded-xl">
                    <p className="text-white/80 text-sm mb-2">חיבורים ({connections.length}/{leftItems.length}):</p>
                    <div className="flex flex-wrap gap-2">
                        {connections.map((conn) => {
                            const leftItem = leftItems.find(i => i.id === conn.leftId);
                            const rightItem = rightItems.find(i => i.id === conn.rightId);
                            return (
                                <span key={conn.leftId} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                                    {leftItem?.text} ↔ {rightItem?.text}
                                </span>
                            );
                        })}
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
                        disabled={connections.length === 0}
                        className={`px-8 py-3 rounded-full font-bold shadow-lg transition-transform active:scale-95
                            ${connections.length > 0
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
                <div className="mt-6 animate-fade-in">
                    {Object.values(results).every(r => r) && connections.length === correctMatches.length ? (
                        <div className="text-center">
                            <span className="text-green-400 flex items-center justify-center gap-2 text-lg font-bold">
                                <IconCheck className="w-6 h-6" /> כל הכבוד! כל ההתאמות נכונות
                            </span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-center">
                                <span className="text-red-400 flex items-center justify-center gap-2 text-lg font-bold">
                                    <IconX className="w-6 h-6" /> יש התאמות שגויות
                                </span>
                            </div>

                            {/* Detailed feedback for wrong answers */}
                            <div className="bg-white/10 backdrop-blur rounded-xl p-4 space-y-3">
                                <p className="text-white/80 text-sm font-medium text-center">בדוק את ההתאמות שלך:</p>
                                <div className="space-y-2">
                                    {connections.map((conn) => {
                                        const leftItem = leftItems.find(i => i.id === conn.leftId);
                                        const rightItem = rightItems.find(i => i.id === conn.rightId);
                                        const isCorrect = results[conn.leftId];

                                        return (
                                            <div
                                                key={conn.leftId}
                                                className={`flex items-center justify-between p-3 rounded-lg ${
                                                    isCorrect
                                                        ? 'bg-green-500/20 border border-green-400/50'
                                                        : 'bg-red-500/20 border border-red-400/50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 flex-1">
                                                    {isCorrect ? (
                                                        <IconCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
                                                    ) : (
                                                        <IconX className="w-5 h-5 text-red-400 flex-shrink-0" />
                                                    )}
                                                    <span className="text-white text-sm">
                                                        {leftItem?.text} ↔ {rightItem?.text}
                                                    </span>
                                                </div>
                                                {!isCorrect && (
                                                    <span className="text-red-300 text-xs mr-2">נסה התאמה אחרת</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Encouragement message based on progress */}
                                <p className="text-white/70 text-sm text-center mt-3">
                                    {Object.values(results).filter(r => r).length > 0
                                        ? `יפה! ${Object.values(results).filter(r => r).length} מתוך ${correctMatches.length} התאמות נכונות. נסה לתקן את השאר.`
                                        : 'קרא שוב את הפריטים ונסה למצוא את הקשרים ביניהם.'
                                    }
                                </p>
                            </div>

                            {/* Hint suggestion after wrong answer */}
                            {!isExamMode && hints.length > 0 && currentHintLevel < hints.length && (
                                <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-xl p-4 text-center">
                                    <p className="text-yellow-200 text-sm mb-2">
                                        צריך עזרה? יש רמז זמין שיכול לעזור לך.
                                    </p>
                                    <button
                                        onClick={() => {
                                            handleShowHint();
                                            resetQuestion();
                                        }}
                                        className="bg-yellow-500 text-white px-6 py-2 rounded-full font-medium hover:bg-yellow-600 transition-colors"
                                    >
                                        💡 קבלו רמז ונסו שוב
                                    </button>
                                </div>
                            )}

                            <div className="text-center">
                                <button
                                    onClick={resetQuestion}
                                    className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700"
                                >
                                    נסו שוב {!isExamMode && hints.length > 0 && currentHintLevel < hints.length ? 'בלי רמז' : ''}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MatchingQuestion;
