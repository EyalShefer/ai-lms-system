import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck, IconX } from '../icons';
import { calculateQuestionScore, SCORING_CONFIG } from '../utils/scoring';
import { MathRenderer } from './MathRenderer';

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
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
        setDraggingIndex(position);
        e.dataTransfer.effectAllowed = "move";

        // Make the drag ghost semi-transparent
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.5';
        }
    };

    const handleDragEnter = (_: React.DragEvent, position: number) => {
        dragOverItem.current = position;
        setDragOverIndex(position);
    };

    const handleDragLeave = () => {
        // Only clear if we're leaving the list area entirely
        // The state will be updated by the next dragEnter
    };

    const handleDragEnd = (e: React.DragEvent) => {
        // Restore opacity
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }

        const dragIndex = draggingItem.current;
        const targetIndex = dragOverItem.current;

        if (dragIndex !== null && targetIndex !== null && dragIndex !== targetIndex && !isSubmitted) {
            const newItems = [...items];
            const draggedItemContent = newItems[dragIndex];
            newItems.splice(dragIndex, 1);
            newItems.splice(targetIndex, 0, draggedItemContent);
            setItems(newItems);
        }

        draggingItem.current = null;
        dragOverItem.current = null;
        setDraggingIndex(null);
        setDragOverIndex(null);
    };

    const checkOrder = () => {
        setHasAttempted(true); // ✨ Unlock hints after first attempt
        attemptsRef.current += 1;

        const isCorrect = JSON.stringify(items) === JSON.stringify(correct_order);
        const maxAttempts = SCORING_CONFIG.MAX_ATTEMPTS;

        // ✅ NEW: 3-attempt logic with progressive hints
        if (isCorrect || attemptsRef.current >= maxAttempts) {
            // Correct or final attempt - lock the question
            setIsSubmitted(true);

            // ✅ FIXED: Use central scoring function with hints tracking
            const score = calculateQuestionScore({
                isCorrect,
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                responseTimeSec: (Date.now() - startTimeRef.current) / 1000
            });

            const timeSpent = (Date.now() - startTimeRef.current) / 1000;

            if (onComplete) {
                onComplete(score, {
                    timeSeconds: Math.round(timeSpent),
                    attempts: attemptsRef.current,
                    hintsUsed: hintsUsedRef.current,
                    lastAnswer: items
                });
            }
        } else {
            // Still have attempts - show progressive hint and allow retry
            if (currentHintLevel < hints.length) {
                setCurrentHintLevel(prev => prev + 1);
                hintsUsedRef.current += 1;
                onHintUsed?.();
            }
            // Don't lock - allow user to continue reordering
        }
    };

    return (
        <div className="w-full mx-auto" role="region" aria-label="שאלת סידור">
            <p className="text-lg text-indigo-800 dark:text-white/90 mb-6 text-right font-bold">{instruction}</p>

            <div
                className="space-y-3 mb-8"
                role="list"
                aria-label="פריטים לסידור - גרור כדי לשנות סדר"
            >
                {items.map((item, index) => {
                    const isCorrectPosition = items[index] === correct_order[index];
                    const isDragging = draggingIndex === index;
                    const isDragOver = dragOverIndex === index && draggingIndex !== null && draggingIndex !== index;

                    return (
                        <div
                            key={item}
                            draggable={!isSubmitted}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            role="listitem"
                            aria-grabbed={draggingItem.current === index}
                            aria-label={`פריט ${index + 1}: ${item}${isSubmitted ? (isCorrectPosition ? ', במיקום נכון' : ', במיקום שגוי') : ''}`}
                            tabIndex={isSubmitted ? -1 : 0}
                            onKeyDown={(e) => {
                                if (isSubmitted) return;
                                if (e.key === 'ArrowUp' && index > 0) {
                                    e.preventDefault();
                                    const newItems = [...items];
                                    [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
                                    setItems(newItems);
                                } else if (e.key === 'ArrowDown' && index < items.length - 1) {
                                    e.preventDefault();
                                    const newItems = [...items];
                                    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
                                    setItems(newItems);
                                }
                            }}
                            className={`p-4 min-h-[56px] bg-white dark:bg-slate-700 border-2 rounded-xl shadow-sm flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2
                                ${isDragging
                                    ? 'opacity-50 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                                    : isDragOver
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02] shadow-lg'
                                        : isSubmitted
                                            ? (isCorrectPosition ? 'border-green-300 bg-green-50 dark:bg-green-900/30' : 'border-red-300 bg-red-50 dark:bg-red-900/30')
                                            : 'border-gray-200 dark:border-slate-600 cursor-grab active:cursor-grabbing hover:border-wizdi-action hover:shadow-md'
                                }
                                transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out
                            `}
                            style={{
                                // Prevent layout shift by keeping items in place during drag
                                transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
                                willChange: draggingIndex !== null ? 'transform' : 'auto'
                            }}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                                ${isSubmitted
                                    ? (isCorrectPosition ? 'bg-green-200 text-green-700 dark:bg-green-800 dark:text-green-200' : 'bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-200')
                                    : 'bg-gray-100 text-gray-500 dark:bg-slate-600 dark:text-slate-300'
                                }
                            `} aria-hidden="true">
                                {index + 1}
                            </div>
                            <div className="flex-1 font-medium text-gray-700 dark:text-slate-200 select-none">
                                {item.includes('$') || item.includes('\\') ? (
                                    <MathRenderer content={item} className="inline" />
                                ) : (
                                    item
                                )}
                            </div>

                            {!isSubmitted && (
                                <div className="text-gray-300 dark:text-slate-500 text-xl font-light" aria-hidden="true">≡</div>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="sr-only">השתמש בחצים למעלה ולמטה כדי לשנות את סדר הפריטים</p>

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
