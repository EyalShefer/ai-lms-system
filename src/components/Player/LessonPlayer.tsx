import React, { useState } from 'react';

// Simplified types for the test component
export interface LessonPlayerProps {
    lessonData: any;
    onComplete?: () => void;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({ lessonData, onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState(false);

    const currentBlock = lessonData.activityBlocks[currentIndex];

    // Generic handler
    const handleAnswer = (answer: string) => {
        setSelectedAnswer(answer);

        if (currentBlock.type === 'multiple-choice') {
            if (answer === currentBlock.content.correctAnswer) {
                setFeedback("Correct! Well done.");
                setIsCorrect(true);
            } else {
                setFeedback("Incorrect. Try again.");
                setIsCorrect(false);
            }
        }
    };

    const handleNext = () => {
        if (currentIndex < lessonData.activityBlocks.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setFeedback(null);
            setIsCorrect(false);
        } else {
            if (onComplete) onComplete();
        }
    };

    if (!currentBlock) return <div>No content</div>;

    return (
        <div data-testid="lesson-player">
            <h2>{lessonData.title}</h2>

            <div className="block-content">
                <h3>{currentBlock.content.question}</h3>

                {currentBlock.type === 'multiple-choice' && (
                    <div className="options">
                        {currentBlock.content.options.map((opt: string) => (
                            <button
                                key={opt}
                                onClick={() => handleAnswer(opt)}
                                aria-label={opt}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {feedback && <div data-testid="feedback-message">{feedback}</div>}

            {isCorrect && (
                <button onClick={handleNext} data-testid="next-button">
                    Next
                </button>
            )}
        </div>
    );
};
