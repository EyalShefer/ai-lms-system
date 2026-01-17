import React, { useState, useRef, useEffect } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck, IconX } from '../icons';
import { MathRenderer } from './MathRenderer';
import { sanitizeHtml } from '../utils/sanitize';

interface MultipleChoiceQuestionProps {
    block: ActivityBlock;
    // We pass both the selected answer and the telemetry back
    onAnswer: (answer: string, telemetry: TelemetryData) => void;
    // Initial state if re-visiting
    initialAnswer?: string;
    isReviewMode?: boolean;
    isExamMode?: boolean;
}

const MultipleChoiceQuestion: React.FC<MultipleChoiceQuestionProps> = ({
    block,
    onAnswer,
    initialAnswer,
    isReviewMode = false,
    isExamMode = false
}) => {
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(initialAnswer || null);
    const [isSubmitted, setIsSubmitted] = useState(!!initialAnswer && (isReviewMode || !isExamMode)); // If review, show feedback immediately? Logic depends on usage.
    // Actually, for consistency: user selects -> then clicks "Check". Or instant check?
    // In the original code, there was a "Check" button only if !isExamMode.
    // Let's stick to: Select -> Highlight. Check -> Show result.

    // Telemetry
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);
    const hintsUsedRef = useRef<number>(0);

    useEffect(() => {
        startTimeRef.current = Date.now();
    }, [block.id]);

    const handleSelect = (optText: string) => {
        if (isReviewMode) return;
        if (isSubmitted && !isExamMode) return; // Cannot change after submit in practice mode

        setSelectedAnswer(optText);

        // In Exam mode, we might want to update immediately without "submitting"
        if (isExamMode) {
            // Update parent immediately, but telemetry considers it "one attempt" or "ongoing"?
            // For now, simple update.
            const timeSpent = (Date.now() - startTimeRef.current) / 1000;
            onAnswer(optText, {
                timeSeconds: Math.round(timeSpent),
                attempts: attemptsRef.current,
                hintsUsed: hintsUsedRef.current,
                lastAnswer: optText
            });
        }
    };

    const handleCheck = () => {
        if (!selectedAnswer) return;

        setIsSubmitted(true);
        attemptsRef.current += 1;

        const timeSpent = (Date.now() - startTimeRef.current) / 1000;

        onAnswer(selectedAnswer, {
            timeSeconds: Math.round(timeSpent), // Convert to seconds
            attempts: attemptsRef.current,
            hintsUsed: hintsUsedRef.current,
            lastAnswer: selectedAnswer
        });
    };

    const getOptionText = (opt: any) => typeof opt === 'string' ? opt : opt.text;
    const showFeedback = isReviewMode || (isSubmitted && !isExamMode);

    // Check if text contains math notation
    const hasMath = (text: string) => text?.includes('$') || text?.includes('\\');

    // Render text with optional math support
    const renderText = (text: string) => {
        if (hasMath(text)) {
            return <MathRenderer content={text} className="inline" />;
        }
        return <span>{text}</span>;
    };

    return (
        <div
            className="mb-8 glass bg-white/80 dark:bg-slate-800/80 p-6 rounded-2xl border border-white/50 dark:border-slate-700 shadow-sm"
            role="group"
            aria-labelledby={`question-${block.id}`}
        >
            <h3 id={`question-${block.id}`} className="text-xl font-bold mb-4 text-slate-800 dark:text-white">
                {hasMath(block.content.question) ? (
                    <MathRenderer content={block.content.question} />
                ) : (
                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content.question || '') }} />
                )}
            </h3>

            <div
                className="space-y-3"
                role="radiogroup"
                aria-label="אפשרויות תשובה"
            >
                {block.content.options?.map((opt: any, i: number) => {
                    const optText = getOptionText(opt);
                    const isSelected = selectedAnswer === optText;
                    const isCorrect = optText === block.content.correctAnswer;
                    const isWrong = isSelected && !isCorrect;

                    let btnClass = "w-full text-right p-4 min-h-[44px] rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2 ";

                    if (showFeedback) {
                        if (isCorrect) btnClass += "bg-green-50 dark:bg-green-900/30 border-green-500 text-green-900 dark:text-green-200";
                        else if (isWrong) btnClass += "bg-red-50 dark:bg-red-900/30 border-red-300 text-red-900 dark:text-red-200";
                        else btnClass += "opacity-50 dark:opacity-40";
                    } else {
                        btnClass += isSelected
                            ? "border-wizdi-action bg-wizdi-action-light dark:bg-wizdi-action/20 shadow-sm ring-1 ring-wizdi-action/30"
                            : "border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200";
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleSelect(optText)}
                            className={btnClass}
                            disabled={!!showFeedback && !isExamMode}
                            role="radio"
                            aria-checked={isSelected}
                            aria-disabled={!!showFeedback && !isExamMode}
                            aria-describedby={showFeedback ? `feedback-${block.id}-${i}` : undefined}
                        >
                            <div className="flex justify-between items-center">
                                {renderText(optText)}
                                {showFeedback && isCorrect && (
                                    <>
                                        <IconCheck className="w-5 h-5 text-green-600 dark:text-green-400" aria-hidden="true" />
                                        <span id={`feedback-${block.id}-${i}`} className="sr-only">תשובה נכונה</span>
                                    </>
                                )}
                                {showFeedback && isWrong && (
                                    <>
                                        <IconX className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />
                                        <span id={`feedback-${block.id}-${i}`} className="sr-only">תשובה שגויה</span>
                                    </>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {!isExamMode && !showFeedback && !isReviewMode && (
                <button
                    onClick={handleCheck}
                    disabled={!selectedAnswer}
                    aria-disabled={!selectedAnswer}
                    className="mt-4 text-sm btn-lip-action px-6 py-2 min-h-[44px] rounded-full font-bold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wizdi-cyan focus-visible:ring-offset-2"
                >
                    בדוק תשובה
                </button>
            )}
        </div>
    );
};

export default MultipleChoiceQuestion;
