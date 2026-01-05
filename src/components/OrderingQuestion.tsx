import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck, IconX } from '../icons';
import { calculateQuestionScore } from '../utils/scoring';

interface OrderingQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean; // ✨ NEW: Disable hints in exam mode
    hints?: string[]; // ✨ NEW: Progressive hints
    onHintUsed?: () => void; // ✨ NEW: Callback when hint revealed
}

const OrderingQuestion: React.FC<OrderingQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    // Telemetry
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0); // ✨ NEW: Track hints

    // Safe parsing
    // Safe parsing
    const content = React.useMemo(() => {
        if (typeof block.content === 'string') {
            const lines = block.content.split('\n').map(l => l.trim()).filter(l => l);
            return { instruction: 'סדר את הפריטים:', correct_order: lines };
        }
        const rawContent = block.content as any;
        let order: string[] = [];
        if (Array.isArray(rawContent.correct_order)) order = rawContent.correct_order;
        else if (Array.isArray(rawContent.items)) order = rawContent.items;

        const instructionStr = rawContent.instruction || rawContent.question || 'סדר את הפריטים:';

        // --- Fallback: If no items, split the instruction into words to create a game ---
        if (order.length < 2 && instructionStr && instructionStr.length > 10) {
            order = instructionStr.split(' ').filter((w: string) => w.length > 1); // Simple word sort
        }

        return {
            instruction: instructionStr,
            correct_order: order
        };
    }, [block.content]);

    const { instruction, correct_order } = content;

    const [items, setItems] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const draggingItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // ✨ NEW: Hint state
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [hasAttempted, setHasAttempted] = useState(false);

    useEffect(() => {
        // Reset Telemetry
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;

        // Initialize with shuffled items
        if (correct_order.length > 0) {
            const shuffled = [...correct_order].sort(() => Math.random() - 0.5);
            setItems(shuffled);
        } else {
            setItems([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(correct_order)]);

    const handleDragStart = (e: React.DragEvent, position: number) => {
        draggingItem.current = position;
        e.dataTransfer.effectAllowed = "move";
        // Ghost image styling workaround if needed, but default is usually fine
    };

    const handleDragEnter = (_: React.DragEvent, position: number) => {
        dragOverItem.current = position;

        // Optional: Pre-swap visual feedback could go here, but keeping it simple for now
    };

    const handleDragEnd = () => {
        const dragIndex = draggingItem.current;
        const dragOverIndex = dragOverItem.current;

        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex && !isSubmitted) {
            const newItems = [...items];
            const draggedItemContent = newItems[dragIndex];
            newItems.splice(dragIndex, 1);
            newItems.splice(dragOverIndex, 0, draggedItemContent);
            setItems(newItems);
        }

        draggingItem.current = null;
        dragOverItem.current = null;
    };

    const checkOrder = () => {
        setIsSubmitted(true);
        setHasAttempted(true); // ✨ Unlock hints after first attempt
        attemptsRef.current += 1;

        const isCorrect = JSON.stringify(items) === JSON.stringify(correct_order);

        // ✅ FIXED: Use central scoring function with hints tracking
        const score = calculateQuestionScore({
            isCorrect,
            attempts: attemptsRef.current,
            hintsUsed: hintsUsedRef.current, // ✨ Now tracking hints!
            responseTimeSec: (Date.now() - startTimeRef.current) / 1000
        });

        const timeSpent = (Date.now() - startTimeRef.current) / 1000;

        if (onComplete) {
            onComplete(score, {
                timeSeconds: Math.round(timeSpent),
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current, // ✨ Pass actual hints used
                lastAnswer: items
            });
        }
    };

    // ✨ NEW: Handle hint reveal
    const handleShowHint = () => {
        if (currentHintLevel < hints.length) {
            setCurrentHintLevel(prev => prev + 1);
            hintsUsedRef.current += 1;
            onHintUsed?.(); // Notify parent
        }
    };

    return (
        <div className="w-full mx-auto">
            <h3 className="text-3xl font-black mb-4 text-white text-center drop-shadow-sm">סידור לפי סדר</h3>
            <p className="text-lg text-white/90 mb-8 text-center font-medium">{instruction}</p>

            <div className="space-y-3 mb-8">
                {items.map((item, index) => (
                    <div
                        key={item} // Assuming unique items for now
                        draggable={!isSubmitted}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className={`p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center gap-4 transition-all
                            ${isSubmitted
                                ? (items[index] === correct_order[index] ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50')
                                : 'cursor-grab active:cursor-grabbing hover:border-blue-300 hover:shadow-md'
                            }
                        `}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                            ${isSubmitted
                                ? (items[index] === correct_order[index] ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700')
                                : 'bg-gray-100 text-gray-500'
                            }
                        `}>
                            {index + 1}
                        </div>
                        <div className="flex-1 font-medium text-gray-700 select-none">
                            {item}
                        </div>

                        {!isSubmitted && (
                            <div className="text-gray-300 text-xl font-light">≡</div>
                        )}
                    </div>
                ))}
            </div>

            {/* ✨ NEW: Progressive Hints Section */}
            {!isExamMode && hints.length > 0 && !isSubmitted && (
                <div className="mb-6">
                    {currentHintLevel === 0 ? (
                        <div className="text-center">
                            <button
                                onClick={handleShowHint}
                                disabled={!hasAttempted}
                                className={`px-6 py-2 rounded-full font-medium transition-all ${
                                    hasAttempted
                                        ? 'bg-yellow-500 text-white hover:bg-yellow-600 shadow-md hover:shadow-lg'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                💡 {hasAttempted ? 'רמז' : 'רמז (זמין אחרי ניסיון ראשון)'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
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

                            {currentHintLevel < hints.length && (
                                <div className="text-center">
                                    <button
                                        onClick={handleShowHint}
                                        className="px-6 py-2 rounded-full font-medium bg-yellow-500 text-white hover:bg-yellow-600 shadow-md hover:shadow-lg transition-all"
                                    >
                                        💡 רמז נוסף ({currentHintLevel}/{hints.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!isSubmitted && (
                <div className="text-center">
                    <button
                        onClick={checkOrder}
                        className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition-transform active:scale-95"
                    >
                        בדיקה
                    </button>
                </div>
            )}

            {isSubmitted && (
                <div className="mt-6 text-center animate-fade-in">
                    <div className="text-lg font-bold">
                        {JSON.stringify(items) === JSON.stringify(correct_order) ? (
                            <span className="text-green-600 flex items-center justify-center gap-2">
                                <IconCheck className="w-6 h-6" /> כל הכבוד! הסדר נכון
                            </span>
                        ) : (
                            <div className="space-y-4">
                                <span className="text-red-500 flex items-center justify-center gap-2">
                                    <IconX className="w-6 h-6" /> הסדר שגוי, נסה שוב
                                </span>
                                <button
                                    onClick={() => setIsSubmitted(false)}
                                    className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 transition-transform active:scale-95"
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

export default OrderingQuestion;
