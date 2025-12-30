import React, { useRef, useEffect } from 'react';
import { IconCheck, IconX, IconSparkles } from '../icons';
import type { TelemetryData } from '../courseTypes';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface QuizData {
    question: string;
    options?: (string | { text: string })[];
    correctAnswer?: string;
}

interface QuizBlockProps {
    data: QuizData;
    userAnswer: string | null;
    onAnswer: (answer: string, telemetry?: TelemetryData) => void;
    onCheck?: () => void;
    showFeedback: boolean;
    isReadOnly: boolean;
    isExamMode?: boolean;
    hints?: string[];
    hintsVisibleLevel?: number;
    onShowHint?: () => void;
    inspectorMode?: boolean;
}

// Helper to safely extract text from option (string or object)
const getOptionText = (opt: string | { text?: string }): string => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object' && opt.text) return opt.text;
    return '';
};

const QuizBlock: React.FC<QuizBlockProps> = ({
    data,
    userAnswer,
    onAnswer,
    onCheck,
    showFeedback,
    isReadOnly,
    isExamMode = false,
    hints = [],
    hintsVisibleLevel = 0,
    onShowHint,
    inspectorMode = false
}) => {
    const { question, options, correctAnswer } = data;

    // Telemetry State
    const startTimeRef = useRef<number>(Date.now());
    const attemptsRef = useRef<number>(0);

    useEffect(() => {
        startTimeRef.current = Date.now();
    }, [question]);

    const handleSelection = (optText: string) => {
        if (!isReadOnly && (!showFeedback || isExamMode)) {
            const timeSpent = (Date.now() - startTimeRef.current) / 1000;
            const telemetry: TelemetryData = {
                timeSeconds: Math.round(timeSpent),
                attempts: attemptsRef.current,
                lastAnswer: optText,
                hintsUsed: hintsVisibleLevel // Use the passed prop
            };
            onAnswer(optText, telemetry);
        }
    };

    const handleCheckClick = () => {
        if (onCheck) {
            attemptsRef.current += 1;
            onCheck();
        }
    };

    // Helper for rendering clickable citations
    const renderMarkdownWithCitations = (text: string) => {
        // Pre-process text to turn [1] into link syntax
        const processedText = text.replace(/\[(\d+)\]/g, '[$1](#cit-$1)');

        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ node, href, children, ...props }) => {
                        if (href?.startsWith('#cit-')) {
                            const id = href.replace('#cit-', '');
                            return (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const element = document.getElementById(`chunk-${id}`);
                                        if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            element.classList.add('bg-yellow-200');
                                            setTimeout(() => element.classList.remove('bg-yellow-200'), 2000);
                                        }
                                    }}
                                    className="inline-flex items-center justify-center w-5 h-5 ml-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full hover:bg-blue-100 hover:scale-110 transition-all align-middle cursor-pointer"
                                >
                                    {children}
                                </button>
                            );
                        }
                        return <a href={href} {...props}>{children}</a>;
                    },
                    p: ({ children }) => <p className="mb-2">{children}</p>
                }}
            >
                {processedText}
            </ReactMarkdown>
        );
    };

    if (!options || options.length === 0) return null;

    const isMaxHints = hintsVisibleLevel >= hints.length;
    const canShowHint = !isExamMode && hints.length > 0;

    return (
        <div className="w-full">
            {/* Question Text */}
            {question && (
                <div className="font-bold text-gray-800 mb-4 text-lg has-text-content">
                    {renderMarkdownWithCitations(question)}
                </div>
            )}

            {/* Options List */}
            <div className="space-y-3">
                {options.map((opt, i) => {
                    const optText = getOptionText(opt);
                    const isSelected = userAnswer === optText;

                    let btnClass = "w-full text-right p-3.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ";

                    if (showFeedback) {
                        if (optText === correctAnswer) {
                            btnClass += "bg-green-50 border-green-400 text-green-900 font-bold focus:ring-green-400";
                        } else if (isSelected) {
                            btnClass += "bg-red-50 border-red-300 text-red-900 focus:ring-red-300";
                        } else {
                            btnClass += "opacity-50 border-gray-100 bg-gray-50 text-gray-400";
                        }
                    } else {
                        if (isSelected) {
                            btnClass += "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200 text-blue-900 font-medium focus:ring-blue-400";
                        } else {
                            btnClass += "border-gray-200 bg-white hover:bg-gray-50 text-gray-700 focus:ring-gray-200";
                        }
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleSelection(optText)}
                            disabled={isReadOnly || (showFeedback && !isExamMode)}
                            className={btnClass}
                        >
                            <div className="flex justify-between items-center">
                                <span className="flex-1">
                                    {/* Option text might also need markdown if complex, but usually strings. 
                                        Let's strip or render simple. directives didn't specify. 
                                        Safe to leave as string for now. */}
                                    {optText}
                                </span>
                                {showFeedback && optText === correctAnswer && (
                                    <IconCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                                )}
                                {showFeedback && isSelected && optText !== correctAnswer && (
                                    <IconX className="w-5 h-5 text-red-600 flex-shrink-0" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Check Answer Button */}
            {!isExamMode && !showFeedback && !isReadOnly && onCheck && (
                <div className="mt-4">
                    <button
                        onClick={handleCheckClick}
                        disabled={!userAnswer}
                        className="text-sm bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        בדוק תשובה
                    </button>
                </div>
            )}

            {/* Progressive Hints UI */}
            {canShowHint && (
                <div className="mt-6 flex flex-col items-start gap-3">
                    {/* Render Revealed Hints */}
                    {hintsVisibleLevel > 0 && (
                        <div className="space-y-2 w-full animate-fade-in">
                            {hints.slice(0, hintsVisibleLevel).map((hint, idx) => (
                                <div key={idx} className="relative bg-amber-50 border border-amber-200 p-3 pr-4 rounded-xl text-amber-900 text-sm shadow-sm flex gap-3 items-start">
                                    <span className="font-bold bg-amber-200 text-amber-800 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span className="flex-1">{renderMarkdownWithCitations(hint)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Reveal Button */}
                    {!isMaxHints && onShowHint && (
                        <button
                            onClick={onShowHint}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 shadow-sm transition-all"
                        >
                            <IconSparkles className="w-4 h-4" />
                            {hintsVisibleLevel === 0 ? 'קבל רמז' : 'רמז נוסף'}
                        </button>
                    )}
                </div>
            )}


            {/* Internal Debug/Inspector Marker (Optional - if needed for specific block styling) */}
            {inspectorMode && (
                <div className="absolute top-0 right-0 -mt-2 -mr-2 pointer-events-none">
                    {/* Placeholder for potential internal element specific indicators */}
                </div>
            )}
        </div>
    );
};

export default QuizBlock;
