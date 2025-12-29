import React, { useState, useEffect } from 'react';
import type { ActivityBlock } from '../courseTypes';
import { IconCheck, IconX, IconClock, IconSparkles } from '../icons';

interface TrueFalseQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number) => void;
    readOnly?: boolean;
}

const TrueFalseQuestion: React.FC<TrueFalseQuestionProps> = ({ block, onComplete, readOnly = false }) => {
    // Correctly parse content
    const content = React.useMemo(() => {
        // Fallback for string content
        if (typeof block.content === 'string') {
            return { statement: block.content, answer: true };
        }
        return {
            statement: block.content.statement || block.content.question || "האם המשפט נכון?",
            answer: block.content.answer // boolean
        };
    }, [block.content]);

    const { statement, answer } = content;

    const [userChoice, setUserChoice] = useState<boolean | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [score, setScore] = useState(0);

    // Optional: Add simple timer for "speed" feel?
    // For now, let's keep it simple but visually impactful as requested.

    const handleSelect = (choice: boolean) => {
        if (isSubmitted || readOnly) return;

        setUserChoice(choice);
        setIsSubmitted(true);

        const isCorrect = choice === answer;
        const calculatedScore = isCorrect ? 100 : 0;
        setScore(calculatedScore);

        if (onComplete) {
            onComplete(calculatedScore);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-8 rounded-3xl shadow-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

            <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-white/20 backdrop-blur-sm shadow-sm">
                    <IconSparkles className="w-4 h-4 text-yellow-300" />
                    <span>אמת או שקר בזק</span>
                </div>

                <h3 className="text-2xl md:text-4xl font-black mb-12 leading-tight drop-shadow-md">
                    "{statement}"
                </h3>

                <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                    <button
                        onClick={() => handleSelect(true)}
                        disabled={isSubmitted || readOnly}
                        className={`group relative h-32 rounded-2xl border-b-8 transition-all active:scale-95 active:border-b-0
                            ${isSubmitted
                                ? (answer === true
                                    ? 'bg-green-500 border-green-700 opacity-100 scale-105 shadow-[0_0_30px_rgba(34,197,94,0.5)]'
                                    : (userChoice === true ? 'bg-gray-400 border-gray-600 opacity-50' : 'bg-green-500 border-green-700 opacity-30'))
                                : 'bg-green-500 border-green-700 hover:bg-green-400'
                            }
                        `}
                    >
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl mb-1">👍</span>
                            <span className="text-2xl font-black uppercase tracking-wider">נכון</span>
                        </div>
                        {isSubmitted && answer === true && (
                            <div className="absolute -top-3 -right-3 bg-white text-green-600 w-8 h-8 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                                <IconCheck className="w-5 h-5 stroke-[3]" />
                            </div>
                        )}
                    </button>

                    <button
                        onClick={() => handleSelect(false)}
                        disabled={isSubmitted || readOnly}
                        className={`group relative h-32 rounded-2xl border-b-8 transition-all active:scale-95 active:border-b-0
                            ${isSubmitted
                                ? (answer === false
                                    ? 'bg-red-500 border-red-700 opacity-100 scale-105 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                                    : (userChoice === false ? 'bg-gray-400 border-gray-600 opacity-50' : 'bg-red-500 border-red-700 opacity-30'))
                                : 'bg-red-500 border-red-700 hover:bg-red-400'
                            }
                        `}
                    >
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl mb-1">👎</span>
                            <span className="text-2xl font-black uppercase tracking-wider">לא נכון</span>
                        </div>
                        {isSubmitted && answer === false && (
                            <div className="absolute -top-3 -right-3 bg-white text-red-600 w-8 h-8 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                                <IconCheck className="w-5 h-5 stroke-[3]" />
                            </div>
                        )}
                    </button>
                </div>

                {isSubmitted && (
                    <div className="mt-8 animate-fade-in">
                        <div className={`inline-block px-6 py-3 rounded-xl font-bold text-lg shadow-lg
                            ${userChoice === answer ? 'bg-white text-green-600' : 'bg-white text-red-500'}
                        `}>
                            {userChoice === answer ? (
                                <span className="flex items-center gap-2">🎉 תשובה נכונה!</span>
                            ) : (
                                <span className="flex items-center gap-2">😔 טעות, התשובה היא {answer ? 'נכון' : 'לא נכון'}</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrueFalseQuestion;
