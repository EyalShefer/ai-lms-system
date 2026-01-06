import React, { useState, useRef, useEffect } from 'react';
import type { ActivityBlock, TelemetryData } from '../courseTypes';
import { IconCheck, IconX } from '../icons';
import { MathRenderer } from './MathRenderer';

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
        <div className="mb-8 glass bg-white/80 p-6 rounded-2xl border border-white/50 shadow-sm">
            <h3 className="text-xl font-bold mb-4">
                {hasMath(block.content.question) ? (
                    <MathRenderer content={block.content.question} />
                ) : (
                    block.content.question
                )}
            </h3>

            {/* Media rendering could be passed as prop or handled here if we duplicate logic, 
                but for now let's focus on the question logic. Media is usually external in the CoursePlayer block.
                Wait, in CoursePlayer the media was INSIDE the case block.
                I should probably accept mediaSrc as a prop to keep it pure.
            */}

            <div className="space-y-3">
                {block.content.options?.map((opt: any, i: number) => {
                    const optText = getOptionText(opt);
                    let btnClass = "w-full text-right p-4 rounded-xl border transition-all ";

                    if (showFeedback) {
                        if (optText === block.content.correctAnswer) btnClass += "bg-green-50 border-green-500 text-green-900";
                        else if (selectedAnswer === optText) btnClass += "bg-red-50 border-red-300 text-red-900";
                        else btnClass += "opacity-50";
                    } else {
                        btnClass += selectedAnswer === optText ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200" : "border-gray-200 hover:bg-gray-50";
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleSelect(optText)}
                            className={btnClass}
                            disabled={!!showFeedback && !isExamMode} // Disable only if feedback shown (practice mode)
                        >
                            <div className="flex justify-between items-center">
                                {renderText(optText)}
                                {showFeedback && optText === block.content.correctAnswer && <IconCheck className="w-5 h-5 text-green-600" />}
                                {showFeedback && selectedAnswer === optText && optText !== block.content.correctAnswer && <IconX className="w-5 h-5 text-red-600" />}
                            </div>
                        </button>
                    );
                })}
            </div>

            {!isExamMode && !showFeedback && !isReviewMode && (
                <button
                    onClick={handleCheck}
                    disabled={!selectedAnswer}
                    className="mt-4 text-sm bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    בדוק תשובה
                </button>
            )}
        </div>
    );
};

export default MultipleChoiceQuestion;
