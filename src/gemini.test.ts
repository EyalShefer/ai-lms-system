// Mock OpenAI before imports
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => {
    return { mockCreate: vi.fn() };
});

vi.mock("openai", () => {
    const OpenAI = vi.fn();
    OpenAI.prototype.chat = {
        completions: {
            create: mockCreate,
        },
    };
    return { default: OpenAI };
});

// Mock dependencies
vi.mock('uuid', () => ({
    v4: () => 'test-uuid-1234'
}));

import { mapSystemItemToBlock, generateUnitSkeleton } from './gemini';
// @ts-ignore
import skeletonFixture from './tests/fixtures/skeletonResponse.json';

describe('gemini.ts - Golden Master Tests', () => {

    // Clear mocks before each test
    beforeEach(() => {
        mockCreate.mockClear();
    });

    describe('mapSystemItemToBlock', () => {

        it('should return null for null input', () => {
            const result = mapSystemItemToBlock(null);
            expect(result).toBeNull();
        });

        it('should handle standard multiple_choice input', () => {
            const input = {
                type: 'multiple_choice',
                question: { text: 'Test Question?' },
                options: [
                    { text: 'Option A', is_correct: true },
                    { text: 'Option B', is_correct: false }
                ]
            };

            const result = mapSystemItemToBlock(input);

            expect(result).toEqual({
                id: 'test-uuid-1234',
                type: 'multiple-choice',
                content: {
                    question: 'Test Question?',
                    options: ['Option A', 'Option B'],
                    correctAnswer: 'Option A'
                },
                metadata: {
                    bloomLevel: 'General',
                    feedbackCorrect: 'תשובה נכונה!',
                    feedbackIncorrect: 'נסו שוב.',
                    sourceReference: null,
                    score: 10,
                    progressiveHints: [],
                    richOptions: [
                        { text: 'Option A', is_correct: true },
                        { text: 'Option B', is_correct: false }
                    ]
                }
            });
        });

        it('should handle ordering type and fallback to defaults if items missing', () => {
            const input = {
                type: 'ordering',
                question: 'Order these',
                items: ['Step 1', 'Step 2']
            };

            const result = mapSystemItemToBlock(input);

            expect(result).toEqual({
                id: 'test-uuid-1234',
                type: 'ordering',
                content: {
                    instruction: 'Order these',
                    correct_order: ['Step 1', 'Step 2']
                },
                metadata: {
                    bloomLevel: 'General',
                    feedbackCorrect: 'תשובה נכונה!',
                    feedbackIncorrect: 'נסו שוב.',
                    sourceReference: null,
                    score: 15
                }
            });
        });

        it('should capture "The Mary Smith" behavior (simulated inputs based on known issues)', () => {
            const input = {
                type: 'categorization',
                items: [] // Empty items
            };

            const result = mapSystemItemToBlock(input);

            // Robust V4 behavior: Return null for empty data (fail safe) instead of hallucinating dummy items
            expect(result).toBeNull();
        });

    });

    describe('generateUnitSkeleton', () => {
        it('should correctly parse AI response and return UnitSkeleton', async () => {
            // Setup Mock Return Value
            mockCreate.mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: JSON.stringify(skeletonFixture)
                        }
                    }
                ]
            });

            // Execute
            const result = await generateUnitSkeleton("Test Topic", "Grade 5", "short");

            // Verify Result
            expect(result).not.toBeNull();
            expect(result?.unit_title).toBe("The Industrial Revolution");
            expect(result?.steps).toHaveLength(3);

            // Snapshot to lock the structure
            expect(result).toMatchSnapshot();

            // Verify API Call
            expect(mockCreate).toHaveBeenCalledTimes(1);
            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.messages).toBeDefined();
            expect(callArgs.messages[0].role).toBe('user');
            expect(callArgs.messages[0].content).toContain('Pedagogical Architect');
        });

        it('should handle API failure gracefully', async () => {
            mockCreate.mockRejectedValue(new Error("API connection failed"));

            const result = await generateUnitSkeleton("Test Topic", "Grade 5", "short");
            expect(result).toBeNull();
        });
    });
});
