import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock } from '../courseTypes';
import { IconCheck, IconX } from '../icons';

interface OrderingQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number) => void;
}

const OrderingQuestion: React.FC<OrderingQuestionProps> = ({ block, onComplete }) => {
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

        return {
            instruction: rawContent.instruction || rawContent.question || 'סדר את הפריטים:',
            correct_order: order
        };
    }, [block.content]);

    const { instruction, correct_order } = content;

    const [items, setItems] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const draggingItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
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
        const isCorrect = JSON.stringify(items) === JSON.stringify(correct_order);
        const score = isCorrect ? 100 : 0;
        if (onComplete) onComplete(score);
    };

    return (
        <div className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-2 text-gray-800">סידור לפי סדר</h3>
            <p className="text-gray-600 mb-6">{instruction}</p>

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
                            <span className="text-red-500 flex items-center justify-center gap-2">
                                <IconX className="w-6 h-6" /> הסדר שגוי, נסה שוב
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderingQuestion;
