import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck } from '../icons';

interface MemoryGameQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
}

interface Card {
    id: number;
    content: string;
    pairId: number;
    isFlipped: boolean;
    isMatched: boolean;
}

const MemoryGameQuestion: React.FC<MemoryGameQuestionProps> = ({ block, onComplete }) => {
    // Telemetry
    const startTimeRef = useRef<number>(Date.now());

    const content = React.useMemo(() => {
        const rawContent = block.content as any;
        const rawPairs = Array.isArray(rawContent.pairs) ? rawContent.pairs : [];
        const processedPairs = rawPairs.map((p: any) => ({
            card_a: p.card_a || p.front || '?',
            card_b: p.card_b || p.back || '?'
        }));
        return { pairs: processedPairs };
    }, [block.content]);

    const { pairs = [] } = content || {};

    const [cards, setCards] = useState<Card[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        // Telemetry Reset
        startTimeRef.current = Date.now();

        // Initialize game board
        const gameCards: Card[] = [];
        if (Array.isArray(pairs)) {
            pairs.forEach((pair, index) => {
                if (!pair) return;
                gameCards.push({
                    id: index * 2,
                    content: pair.card_a || '?',
                    pairId: index,
                    isFlipped: false,
                    isMatched: false
                });
                gameCards.push({
                    id: index * 2 + 1,
                    content: pair.card_b || '?',
                    pairId: index,
                    isFlipped: false,
                    isMatched: false
                });
            });
        }

        setCards(gameCards.sort(() => Math.random() - 0.5));
    }, [block]);

    const handleCardClick = (index: number) => {
        if (isLocked || cards[index].isFlipped || cards[index].isMatched) return;

        // Prevent clicking the same card twice (Race Condition Fix)
        if (flippedIndices.includes(index)) return;

        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        if (newFlipped.length === 2) {
            setIsLocked(true);
            setAttempts(prev => prev + 1);
            checkForMatch(newFlipped);
        }
    };

    const checkForMatch = (flipped: number[]) => {
        const [firstIndex, secondIndex] = flipped;
        const isMatch = cards[firstIndex].pairId === cards[secondIndex].pairId;

        setTimeout(() => {
            const newCards = [...cards];

            if (isMatch) {
                newCards[firstIndex].isMatched = true;
                newCards[secondIndex].isMatched = true;
            } else {
                newCards[firstIndex].isFlipped = false;
                newCards[secondIndex].isFlipped = false;
            }

            setCards(newCards);
            setFlippedIndices([]);
            setIsLocked(false);

            // Check completion
            if (newCards.every(c => c.isMatched)) {
                setIsComplete(true);
                // Simple scoring: max 100, minus penalty for extra attempts? 
                // Or just 100 for completion. Let's do 100 for completion for now.

                const timeSpent = (Date.now() - startTimeRef.current) / 1000;

                if (onComplete) {
                    onComplete(100, {
                        timeSeconds: Math.round(timeSpent),
                        attempts: attempts, // 'attempts' state tracks moves
                        hintsUsed: 0,
                        lastAnswer: attempts // or pairs
                    });
                }
            }
        }, 1000);
    };

    return (
        <div className="w-full mx-auto">
            <h3 className="text-3xl font-black mb-4 text-white text-center drop-shadow-sm">תרגול זיכרון</h3>
            <div className="text-white/80 mb-6 text-sm flex justify-between px-4">
                <span>מצא את הזוגות התואמים</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8">
                {cards.map((card, index) => (
                    <div
                        key={card.id}
                        onClick={() => handleCardClick(index)}
                        className={`aspect-[3/4] cursor-pointer perspective-1000 relative group`}
                    >
                        <div
                            className={`w-full h-full transition-all duration-500 relative rounded-xl shadow-md border border-gray-200
                            ${card.isFlipped || card.isMatched ? '[transform:rotateY(180deg)]' : 'hover:-translate-y-1 hover:shadow-lg'}
                        `}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* Card Back (Face Down) */}
                            <div
                                className="absolute inset-0 w-full h-full bg-indigo-600 rounded-xl flex items-center justify-center shadow-inner"
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                <div className="text-white text-4xl opacity-20 font-bold select-none">?</div>
                            </div>

                            {/* Card Front (Face Up) */}
                            <div
                                className="absolute inset-0 w-full h-full bg-white rounded-xl flex items-center justify-center p-4 text-center border-2 border-indigo-100"
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)'
                                }}
                            >
                                <span className={`font-bold text-gray-800 ${card.content.length > 20 ? 'text-xs' : 'text-sm'} select-none`}>
                                    {card.content}
                                </span>
                                {card.isMatched && (
                                    <div className="absolute top-2 right-2">
                                        <IconCheck className="w-4 h-4 text-green-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isComplete && (
                <div className="text-center animate-fade-in">
                    <div className="text-xl font-bold text-green-600 flex items-center justify-center gap-2">
                        <IconCheck className="w-8 h-8" />
                        <span>כל הכבוד! סיימת את המשחק</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemoryGameQuestion;
