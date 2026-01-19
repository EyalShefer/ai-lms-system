import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck } from '../icons';
import { calculateQuestionScore } from '../utils/scoring';

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
        return {
            pairs: processedPairs,
            cardBackEmoji: rawContent.cardBackEmoji || rawContent.card_back_emoji,
            cardBackImage: rawContent.cardBackImage || rawContent.card_back_image
        };
    }, [block.content]);

    const { pairs = [], cardBackEmoji, cardBackImage } = content || {};

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

                // ✅ FIXED: Use central scoring with attempt tracking
                // Memory game is always "correct" when completed, but score varies by efficiency
                const score = calculateQuestionScore({
                    isCorrect: true,
                    attempts: Math.min(attempts, 3), // Cap at 3 to avoid excessive penalty
                    hintsUsed: 0, // Memory game doesn't have hints
                    responseTimeSec: (Date.now() - startTimeRef.current) / 1000
                });

                const timeSpent = (Date.now() - startTimeRef.current) / 1000;

                if (onComplete) {
                    onComplete(score, {
                        timeSeconds: Math.round(timeSpent),
                        attempts: attempts,
                        hintsUsed: 0,
                        lastAnswer: attempts
                    });
                }
            }
        }, 1000);
    };

    return (
        <div className="w-full mx-auto" role="region" aria-labelledby="memory-title">
            <h3 id="memory-title" className="text-3xl font-black mb-4 text-indigo-800 dark:text-white text-center">תרגול זיכרון</h3>
            <div className="text-gray-600 dark:text-white/70 mb-6 text-sm flex justify-between px-4">
                <span>מצא את הזוגות התואמים</span>
                <span className="sr-only">לחץ על קלף כדי להפוך אותו. מצא זוגות תואמים.</span>
            </div>

            <div
                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8"
                role="grid"
                aria-label="לוח משחק זיכרון"
            >
                {cards.map((card, index) => (
                    <button
                        key={card.id}
                        onClick={() => handleCardClick(index)}
                        disabled={isLocked || card.isMatched}
                        aria-label={card.isFlipped || card.isMatched ? card.content : 'קלף הפוך'}
                        aria-pressed={card.isFlipped}
                        className={`aspect-[3/4] min-h-[100px] cursor-pointer perspective-1000 relative group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 rounded-xl ${card.isMatched ? 'cursor-default' : ''}`}
                    >
                        <div
                            className={`w-full h-full transition-all duration-500 motion-reduce:duration-0 relative rounded-xl shadow-md border border-gray-200 dark:border-slate-600
                            ${card.isFlipped || card.isMatched ? '[transform:rotateY(180deg)]' : 'hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0'}
                        `}
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            {/* Card Back (Face Down) */}
                            <div
                                className="absolute inset-0 w-full h-full bg-indigo-600 dark:bg-indigo-700 rounded-xl flex items-center justify-center shadow-inner overflow-hidden"
                                style={{ backfaceVisibility: 'hidden' }}
                                aria-hidden="true"
                            >
                                {cardBackImage ? (
                                    <img
                                        src={cardBackImage}
                                        alt=""
                                        className="w-full h-full object-cover opacity-40"
                                    />
                                ) : cardBackEmoji ? (
                                    <div className="text-5xl select-none opacity-80">{cardBackEmoji}</div>
                                ) : (
                                    <div className="text-white text-4xl opacity-20 font-bold select-none">?</div>
                                )}
                            </div>

                            {/* Card Front (Face Up) */}
                            <div
                                className="absolute inset-0 w-full h-full bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center p-3 text-center border-2 border-indigo-100 dark:border-indigo-500/30"
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)'
                                }}
                            >
                                <span className="font-bold text-gray-800 dark:text-slate-100 text-base leading-tight break-words hyphens-auto select-none max-w-full overflow-hidden">
                                    {card.content}
                                </span>
                                {card.isMatched && (
                                    <div className="absolute top-2 right-2" aria-hidden="true">
                                        <IconCheck className="w-4 h-4 text-green-500" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {isComplete && (
                <div className="text-center animate-fade-in motion-reduce:animate-none" role="alert" aria-live="polite">
                    <div className="text-xl font-bold text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                        <IconCheck className="w-8 h-8" aria-hidden="true" />
                        <span>כל הכבוד! סיימת את המשחק</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemoryGameQuestion;
