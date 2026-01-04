import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck, IconX } from '../icons';

interface CategorizationQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean; // ✨ NEW
    hints?: string[]; // ✨ NEW
    onHintUsed?: () => void; // ✨ NEW
}

interface Item {
    id: string;
    text: string;
    category: string;
}

const CategorizationQuestion: React.FC<CategorizationQuestionProps> = ({
    block,
    onComplete,
    isExamMode = false,
    hints = [],
    onHintUsed
}) => {
    // Telemetry
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0); // ✨ NEW

    // Safe parsing
    // Safe parsing
    const content = React.useMemo(() => {
        if (typeof block.content === 'string') {
            return { categories: [], items: [] }; // Fallback for string content
        }
        return block.content as { categories: string[]; items: { text: string; category: string }[] };
    }, [block.content]);

    const { categories = [], items = [] } = content || {};

    // State for items in the "bank" and items in each bucket
    // We'll give each item a unique ID for easier tracking
    const [bankItems, setBankItems] = useState<Item[]>([]);
    const [buckets, setBuckets] = useState<Record<string, Item[]>>({});
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        // Reset Telemetry
        startTimeRef.current = Date.now();
        attemptsRef.current = 0;

        // Initialize
        const safeItems = Array.isArray(items) ? items : [];
        const initialItems = safeItems.map((item, index) => ({
            ...item,
            text: item?.text || '?',
            category: item?.category || 'Uncategorized',
            id: `item-${index}`
        })).sort(() => Math.random() - 0.5);

        setBankItems(initialItems);

        const initialBuckets: Record<string, Item[]> = {};
        categories.forEach(c => initialBuckets[c] = []);
        setBuckets(initialBuckets);
    }, [block]);

    // ... (Handlers kept via skip, or I must include them if I replace large block) 
    // I am replacing the TOP part and the CHECK part separate? 
    // No, I'll replace the top block up to useEffect. And then the checkAnswers function.
    // Actually, I can replace the whole top section easily. 
    // But checkAnswers is far down.

    // I will use multi-chunk replacement if possible. Or sequential.
    // I'll assume I can't use multi_replace for this tool? It says "StartLine, EndLine".
    // I will replace top part first.

    // WAIT: I shouldn't execute this thought block if I can't replace handlers logic.
    // The replace_file_content replaces the BLOCK.
    // So I must include handlers if I overwrite them.
    // I'll replace 1-50 (Top part).
    // And 108-126 (Check function).

    // I'll do two calls.
    // Call 1: Imports and Top Logic.

    const handleDragStart = (e: React.DragEvent, itemId: string, source: 'bank' | string) => {
        setIsSubmitted(false);
        e.dataTransfer.setData("itemId", itemId);
        e.dataTransfer.setData("source", source);
    };

    const handleDrop = (e: React.DragEvent, targetCategory: string | 'bank') => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData("itemId");
        const source = e.dataTransfer.getData("source");

        // Prevent dropping on self or if submitted
        if (!itemId || !source || source === targetCategory || isSubmitted) return;

        let item: Item | undefined;
        let newBank = [...bankItems];
        const newBuckets: Record<string, Item[]> = { ...buckets };

        // 1. Remove from Source
        if (source === 'bank') {
            const idx = newBank.findIndex(i => i.id === itemId);
            if (idx === -1) return; // Item not found
            item = newBank[idx];
            newBank.splice(idx, 1);
        } else {
            // Source is a category
            if (!newBuckets[source]) return; // Invalid source category
            const bucketList = [...newBuckets[source]]; // Copy array
            const idx = bucketList.findIndex(i => i.id === itemId);
            if (idx === -1) return; // Item not found

            item = bucketList[idx];
            bucketList.splice(idx, 1);
            newBuckets[source] = bucketList; // Update bucket
        }

        if (!item) return;

        // 2. Add to Target
        if (targetCategory === 'bank') {
            newBank.push(item);
        } else {
            // Target is a category
            // Ensure target array exists (it should, but safety first)
            const targetList = [...(newBuckets[targetCategory] || [])];
            targetList.push(item);
            newBuckets[targetCategory] = targetList;
        }

        setBankItems(newBank);
        setBuckets(newBuckets);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const checkAnswers = () => {
        setIsSubmitted(true);
        attemptsRef.current += 1;

        let correctCount = 0;
        let totalItems = 0;

        Object.entries(buckets).forEach(([cat, catItems]) => {
            catItems.forEach(item => {
                totalItems++;
                if (item.category === cat) correctCount++;
            });
        });

        // Also count items left in bank as incomplete/incorrect if we want strictly all assigned
        // In this implementation, total items is based on what's defined in the block
        totalItems = items.length;

        const score = Math.round((correctCount / totalItems) * 100);

        const timeSpent = (Date.now() - startTimeRef.current) / 1000;

        if (onComplete) {
            onComplete(score, {
                timeSeconds: Math.round(timeSpent),
                attempts: attemptsRef.current,
                hintsUsed: 0,
                lastAnswer: buckets // Detailed bucket state
            });
        }
    };

    return (
        <div className="w-full mx-auto">
            <h3 className="text-3xl font-black mb-8 text-white text-center drop-shadow-sm">סידור לפי קטגוריות</h3>

            {/* Item Bank */}
            <div
                className="min-h-[100px] p-4 bg-gray-50 rounded-xl mb-8 border-2 border-dashed border-gray-200 flex flex-wrap gap-3 justify-center items-center transition-colors"
                onDrop={(e) => handleDrop(e, 'bank')}
                onDragOver={handleDragOver}
            >
                {bankItems.length === 0 && !isSubmitted && <span className="text-gray-400 text-sm">המחסן ריק (גרור פריטים בחזרה אם טעית)</span>}
                {bankItems.map(item => (
                    <div
                        key={item.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, item.id, 'bank')}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md select-none"
                    >
                        {item.text}
                    </div>
                ))}
            </div>

            {/* Buckets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {categories.map(category => {
                    const bucketItems = buckets[category] || [];
                    return (
                        <div
                            key={category}
                            className="flex flex-col h-full"
                        >
                            <div className="bg-indigo-600 text-white py-2 px-4 rounded-t-xl font-bold text-center shadow-sm">
                                {category}
                            </div>
                            <div
                                className={`flex-1 min-h-[200px] bg-slate-50 border-x border-b border-gray-200 rounded-b-xl p-3 flex flex-col gap-2 transition-colors
                                    ${!isSubmitted && 'hover:bg-indigo-50/50'}
                                `}
                                onDrop={(e) => handleDrop(e, category)}
                                onDragOver={handleDragOver}
                            >
                                {bucketItems.map(item => (
                                    <div
                                        key={item.id}
                                        draggable={true}
                                        onDragStart={(e) => handleDragStart(e, item.id, category)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium shadow-sm border flex justify-between items-center bg-white border-gray-100
                                            ${isSubmitted
                                                ? (item.category === category ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800')
                                                : 'cursor-grab active:cursor-grabbing'
                                            }
                                        `}
                                    >
                                        <span>{item.text}</span>
                                        {isSubmitted && (
                                            item.category === category
                                                ? <IconCheck className="w-4 h-4 text-green-600" />
                                                : <IconX className="w-4 h-4 text-red-600" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="text-center">
                <button
                    onClick={checkAnswers}
                    className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                >
                    {isSubmitted ? 'בדוק שוב' : 'בדיקה'}
                </button>
            </div>
        </div>
    );
};

export default CategorizationQuestion;
