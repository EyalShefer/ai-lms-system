import { lazy, Suspense, memo } from 'react';
import type { ActivityBlock } from '../../shared/types/courseTypes';
import { sanitizeHtml } from '../../utils/sanitize';

// Lazy load question components
const MultipleChoiceQuestion = lazy(() => import('./MultipleChoiceQuestion'));
const ClozeQuestion = lazy(() => import('./ClozeQuestion'));
const OrderingQuestion = lazy(() => import('./OrderingQuestion'));
const CategorizationQuestion = lazy(() => import('./CategorizationQuestion'));
const MemoryGameQuestion = lazy(() => import('./MemoryGameQuestion'));
const TrueFalseSpeedQuestion = lazy(() => import('./TrueFalseSpeedQuestion'));
const OpenQuestion = lazy(() => import('./OpenQuestion'));
const InteractiveChatBlock = lazy(() => import('./InteractiveChatBlock'));

interface QuestionRendererProps {
  block: ActivityBlock;
  currentStepIndex: number;
  userAnswers: Record<string, any>;
  onAnswerChange: (blockId: string, answer: any) => void;
  onAnswerSubmit: (blockId: string) => void;
  onValidationResult: (blockId: string, result: any) => void;
  onBlockComplete?: (blockId: string) => void;
  readOnly?: boolean;
  courseContext?: {
    topic: string;
    gradeLevel: string;
    mode?: 'learning' | 'exam';
  };
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

/**
 * Central question renderer
 * Dynamically loads the appropriate question component based on block type
 */
export const QuestionRenderer = memo(function QuestionRenderer({
  block,
  currentStepIndex,
  userAnswers,
  onAnswerChange,
  onAnswerSubmit,
  onValidationResult,
  onBlockComplete,
  readOnly = false,
  courseContext,
}: QuestionRendererProps) {
  const answer = userAnswers[block.id];

  // Common props passed to all question components
  const commonProps = {
    block,
    answer,
    onAnswerChange: (newAnswer: any) => onAnswerChange(block.id, newAnswer),
    onSubmit: () => onAnswerSubmit(block.id),
    onValidationResult: (result: any) => onValidationResult(block.id, result),
    onComplete: onBlockComplete ? () => onBlockComplete(block.id) : undefined,
    readOnly,
  };

  // Render appropriate component based on block type
  const renderQuestion = () => {
    switch (block.type) {
      case 'multiple-choice':
        return <MultipleChoiceQuestion {...commonProps} />;

      case 'fill_in_blanks':
        return <ClozeQuestion {...commonProps} />;

      case 'ordering':
        return <OrderingQuestion {...commonProps} />;

      case 'categorization':
        return <CategorizationQuestion {...commonProps} />;

      case 'memory_game':
        return <MemoryGameQuestion {...commonProps} />;

      case 'true_false_speed':
        return <TrueFalseSpeedQuestion {...commonProps} />;

      case 'open-question':
      case 'audio-response':
        return <OpenQuestion {...commonProps} />;

      case 'interactive-chat':
        return (
          <InteractiveChatBlock
            {...commonProps}
            context={{
              topic: courseContext?.topic || '',
              step: currentStepIndex + 1,
            }}
            readOnly={readOnly}
          />
        );

      // Non-interactive blocks (display only)
      case 'text':
        return (
          <div className="prose max-w-none p-6 bg-white rounded-lg shadow">
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content as string) }} />
          </div>
        );

      case 'video':
        return (
          <div className="relative w-full pb-[56.25%]">
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg shadow"
              src={block.videoUrl}
              title={block.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );

      case 'image':
        return (
          <div className="flex flex-col items-center p-4">
            <img
              src={block.imageUrl}
              alt={block.title || 'תמונה'}
              className="max-w-full rounded-lg shadow-lg"
              loading="lazy"
              decoding="async"
            />
            {block.caption && (
              <p className="mt-2 text-sm text-gray-600 text-center">{block.caption}</p>
            )}
          </div>
        );

      case 'podcast':
        return (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">🎙️ {block.title}</h3>
            {block.audioUrl && (
              <audio controls className="w-full">
                <source src={block.audioUrl} type="audio/mpeg" />
                הדפדפן שלך אינו תומך בנגן אודיו.
              </audio>
            )}
          </div>
        );

      default:
        return (
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">
              סוג בלוק לא נתמך: <code>{block.type}</code>
            </p>
          </div>
        );
    }
  };

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <div className="question-block">{renderQuestion()}</div>
    </Suspense>
  );
});

export default QuestionRenderer;
