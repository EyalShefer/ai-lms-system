import React, { useState, useEffect, useRef } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck } from '../icons';
import { calculateQuestionScore } from '../utils/scoring';

interface MemoryGameQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number, telemetry?: TelemetryData) => void;
    isExamMode?: boolean;
}

interface Card {
    id: number;
    content: string;
    pairId: number;
    isFlipped: boolean;
    isMatched: boolean;
}

// Colors for visual pair grouping - each pair gets a distinct accent color
const PAIR_COLORS = [
    { border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-400' },
    { border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-400' },
    { border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', ring: 'ring-purple-400' },
    { border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', ring: 'ring-amber-400' },
    { border: 'border-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30', ring: 'ring-rose-400' },
    { border: 'border-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/30', ring: 'ring-cyan-400' },
    { border: 'border-lime-500', bg: 'bg-lime-50 dark:bg-lime-900/30', ring: 'ring-lime-400' },
    { border: 'border-fuchsia-500', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30', ring: 'ring-fuchsia-400' },
];

const MemoryGameQuestion: React.FC<MemoryGameQuestionProps> = ({ block, onComplete, isExamMode = false }) => {
    // Telemetry
    const startTimeRef = useRef<number>(Date.now());
    const resetsRef = useRef<number>(0); // Track resets for telemetry

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
                        resets: resetsRef.current,
                        lastAnswer: attempts
                    });
                }
            }
        }, 1000);
    };

    // Pre-completion reset - reshuffles cards, doesn't reset attempts
    const handleReset = () => {
        if (isComplete || isLocked) return; // Safety check

        resetsRef.current += 1; // Track reset for telemetry

        // Reset all cards to unflipped and unmatched, then reshuffle
        const resetCards = cards.map(card => ({
            ...card,
            isFlipped: false,
            isMatched: false
        })).sort(() => Math.random() - 0.5);

        setCards(resetCards);
        setFlippedIndices([]);
    };

    // Calculate optimal grid layout based on card count
    const cardCount = cards.length;
    const gridCols = cardCount <= 4 ? 2 : cardCount <= 8 ? 4 : cardCount <= 12 ? 4 : 6;

    return (
        <div className="w-full mx-auto flex flex-col h-full max-h-[calc(100dvh-280px)]" role="region" aria-labelledby="memory-title">
            <h3 id="memory-title" className="text-2xl sm:text-3xl font-black mb-2 sm:mb-4 text-indigo-800 dark:text-white text-center shrink-0">תרגול זיכרון</h3>
            <div className="text-gray-600 dark:text-white/70 mb-3 sm:mb-6 text-sm flex justify-between px-4 shrink-0">
                <span>מצא את הזוגות התואמים</span>
                <span className="sr-only">לחץ על קלף כדי להפוך אותו. מצא זוגות תואמים.</span>
            </div>

            <div
                className={`grid gap-2 sm:gap-4 mb-4 flex-1 min-h-0 overflow-y-auto px-1 ${
                    gridCols === 2 ? 'grid-cols-2' :
                    gridCols === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                    'grid-cols-3 sm:grid-cols-6'
                }`}
                style={{
                    maxHeight: 'calc(100dvh - 350px)',
                    alignContent: cardCount <= 8 ? 'center' : 'start'
                }}
                role="grid"
                aria-label="לוח משחק זיכרון"
            >
                {cards.map((card, index) => {
                    const pairColor = PAIR_COLORS[card.pairId % PAIR_COLORS.length];

                    return (
                    <button
                        key={card.id}
                        onClick={() => handleCardClick(index)}
                        disabled={isLocked || card.isMatched}
                        aria-label={
                            card.isMatched
                                ? `${card.content} - זוג מותאם`
                                : card.isFlipped
                                    ? card.content
                                    : 'קלף הפוך - לחץ לגילוי'
                        }
                        aria-pressed={card.isFlipped}
                        role="gridcell"
                        className={`aspect-[3/4] min-h-[70px] sm:min-h-[90px] max-h-[150px] cursor-pointer perspective-1000 relative group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 rounded-xl transition-transform duration-300 ${
                            card.isMatched
                                ? 'cursor-default animate-match-pop'
                                : ''
                        }`}
                    >
                        <div
                            className={`w-full h-full transition-all duration-500 motion-reduce:duration-0 relative rounded-xl shadow-md
                            ${card.isMatched
                                ? `${pairColor.border} border-[3px] ring-2 ${pairColor.ring} ring-offset-1 shadow-lg`
                                : 'border border-gray-200 dark:border-slate-600'
                            }
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
                                className={`absolute inset-0 w-full h-full rounded-xl flex items-center justify-center p-3 text-center transition-colors duration-300 ${
                                    card.isMatched
                                        ? `${pairColor.bg}`
                                        : 'bg-white dark:bg-slate-700 border-2 border-indigo-100 dark:border-indigo-500/30'
                                }`}
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)'
                                }}
                            >
                                <span className="font-bold text-gray-800 dark:text-slate-100 text-base leading-tight break-words hyphens-auto select-none max-w-full overflow-hidden">
                                    {card.content}
                                </span>
                                {card.isMatched && (
                                    <div
                                        className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-green-500 rounded-full p-1 shadow-md animate-check-bounce"
                                        aria-hidden="true"
                                    >
                                        <IconCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white stroke-[3]" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                    );
                })}
            </div>

            {/* Reset button - only before completion and not in exam mode */}
            {!isComplete && !isExamMode && (
                <div className="text-center mb-4">
                    <button
                        onClick={handleReset}
                        disabled={isLocked}
                        className="bg-gray-500 dark:bg-slate-600 text-white px-6 py-3 min-h-[44px] rounded-full font-bold shadow-lg hover:bg-gray-600 dark:hover:bg-slate-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2"
                        aria-label="איפוס המשחק - ערבוב מחדש"
                    >
                        איפוס
                    </button>
                </div>
            )}

            {/* Success feedback is shown in parent to avoid redundancy */}
        </div>
    );
};

export default MemoryGameQuestion;
