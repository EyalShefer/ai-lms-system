import { render, screen, fireEvent } from '@testing-library/react';
import { LessonPlayer } from './LessonPlayer';
import '@testing-library/jest-dom';

const mockLessonData = {
    id: 'unit-1',
    title: 'Test Unit',
    type: 'practice',
    activityBlocks: [
        {
            id: 'block-1',
            type: 'multiple-choice',
            content: {
                question: 'What is 2 + 2?',
                options: ['3', '4', '5'],
                correctAnswer: '4'
            },
            metadata: { score: 10 }
        }
    ]
};

describe('LessonPlayer Component', () => {

    it('renders the player with mock data', () => {
        render(<LessonPlayer lessonData={mockLessonData} />);
        expect(screen.getByText('Test Unit')).toBeInTheDocument();
        expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('shows feedback message when wrong answer is clicked', () => {
        render(<LessonPlayer lessonData={mockLessonData} />);

        const wrongOption = screen.getByText('3');
        fireEvent.click(wrongOption);

        expect(screen.getByTestId('feedback-message')).toHaveTextContent('Incorrect');
    });

    it('enables next button when correct answer is clicked', () => {
        render(<LessonPlayer lessonData={mockLessonData} />);

        // Initial state: Next button should not be visible
        expect(screen.queryByTestId('next-button')).not.toBeInTheDocument();

        const correctOption = screen.getByText('4');
        fireEvent.click(correctOption);

        // Feedback
        expect(screen.getByTestId('feedback-message')).toHaveTextContent('Correct');

        // Next Button
        const nextBtn = screen.getByTestId('next-button');
        expect(nextBtn).toBeInTheDocument();
        expect(nextBtn).toBeEnabled();
    });

});
