import React, { useState, useEffect } from 'react';
import type { ActivityBlock } from '../courseTypes';
import { IconCheck, IconX } from '../icons';

interface ClozeQuestionProps {
    block: ActivityBlock;
    onComplete?: (score: number) => void;
}

const ClozeQuestion: React.FC<ClozeQuestionProps> = ({ block, onComplete }) => {
    // Safe parsing of content
    // Safe parsing of content with memoization to prevent infinite loops
    const content = React.useMemo(() => {
        if (typeof block.content === 'string') {
            const text = block.content;
            const matches = text.match(/\[(.*?)\]/g) || [];
            const hidden_words = matches.map(m => m.slice(1, -1));
            const sentence = text.replace(/\[(.*?)\]/g, '_____');
            return { sentence, hidden_words, distractors: [] };
        }
        return block.content as { sentence: string; hidden_words: string[]; distractors: string[] };
    }, [block.content]);

    const { sentence = '', hidden_words = [], distractors = [] } = content || {};

    const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
    const [wordBank, setWordBank] = useState<string[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Initialize
    useEffect(() => {
        if (!sentence) return;

        // Prepare blanks based on sentence
        const blanksCount = (sentence.match(/_____/g) || []).length;
        setUserAnswers(new Array(blanksCount).fill(null));

        // Prepare word bank (shuffled)
        const allWords = [...hidden_words, ...(distractors || [])];
        setWordBank(allWords.sort(() => Math.random() - 0.5));
    }, [block, sentence, hidden_words, distractors]);

    const handleDragStart = (e: React.DragEvent, word: string) => {
        e.dataTransfer.setData("text/plain", word);
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        const word = e.dataTransfer.getData("text/plain");
        if (isSubmitted) return;

        setUserAnswers(prev => {
            const newState = [...prev];
            newState[index] = word;
            return newState;
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeAnswer = (index: number) => {
        if (isSubmitted) return;
        setUserAnswers(prev => {
            const newState = [...prev];
            newState[index] = null;
            return newState;
        });
    };

    const checkAnswers = () => {
        setIsSubmitted(true);
        let correctCount = 0;
        userAnswers.forEach((ans, i) => {
            if (ans === hidden_words[i]) correctCount++;
        });
        const score = Math.round((correctCount / hidden_words.length) * 100);
        if (onComplete) onComplete(score);
    };

    // Split sentence by placeholders
    const parts = sentence.split('_____');

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold mb-6 text-gray-800">השלם את המשפט</h3>

            <div className="mb-8 text-lg leading-loose text-center" dir="rtl">
                {parts.map((part, i) => (
                    <React.Fragment key={i}>
                        {part}
                        {i < parts.length - 1 && (
                            <span
                                onDrop={(e) => handleDrop(e, i)}
                                onDragOver={handleDragOver}
                                onClick={() => removeAnswer(i)}
                                className={`inline-block min-w-[100px] mx-2 h-10 border-b-2 align-middle text-center px-2 cursor-pointer transition-colors
                                    ${userAnswers[i]
                                        ? (isSubmitted
                                            ? (userAnswers[i] === hidden_words[i] ? 'border-green-500 text-green-700 bg-green-50' : 'border-red-500 text-red-700 bg-red-50')
                                            : 'border-blue-500 text-blue-700 bg-blue-50')
                                        : 'border-gray-300 bg-gray-50'
                                    }
                                `}
                            >
                                {userAnswers[i] || (
                                    <span className="text-gray-300 text-sm select-none">גרור לכאן</span>
                                )}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Word Bank */}
            <div className="flex flex-wrap gap-3 justify-center mb-8 bg-gray-50 p-4 rounded-xl">
                {wordBank.map((word, i) => {
                    const isUsed = userAnswers.includes(word);
                    return (
                        <div
                            key={i}
                            draggable={!isSubmitted && !isUsed}
                            onDragStart={(e) => handleDragStart(e, word)}
                            className={`px-4 py-2 rounded-lg font-medium shadow-sm border select-none transition-all
                                ${isUsed
                                    ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:shadow-md cursor-grab active:cursor-grabbing'
                                }
                            `}
                        >
                            {word}
                        </div>
                    );
                })}
            </div>

            {!isSubmitted && (
                <div className="text-center">
                    <button
                        onClick={checkAnswers}
                        disabled={userAnswers.some(a => a === null)}
                        className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                    >
                        בדיקה
                    </button>
                </div>
            )}

            {isSubmitted && (
                <div className="mt-6 text-center animate-fade-in">
                    <div className="text-lg font-bold">
                        {userAnswers.every((a, i) => a === hidden_words[i]) ? (
                            <span className="text-green-600 flex items-center justify-center gap-2">
                                <IconCheck className="w-6 h-6" /> מעולה! כל התשובות נכונות
                            </span>
                        ) : (
                            <span className="text-red-500 flex items-center justify-center gap-2">
                                <IconX className="w-6 h-6" /> יש טעויות, נסה שוב
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClozeQuestion;
