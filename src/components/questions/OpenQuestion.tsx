/**
 * OpenQuestion Component
 *
 * Handles open-ended questions with support for:
 * - Regular text answers
 * - Numeric answers (with validation)
 * - Fraction answers (with FractionInput)
 * - Math keyboard for symbol input
 */
import { memo, useState, useRef, useCallback } from 'react';
import type { ActivityBlock } from '../../shared/types/courseTypes';
import { MathRenderer } from '../MathRenderer';
import { FractionInput, fractionToString } from '../math/FractionInput';
import type { FractionValue } from '../math/FractionInput';
import { InlineMathKeyboard, NumberPad } from '../math/MathKeyboard';
import { validateMathAnswer, getValidationOptionsForGrade } from '../../utils/mathValidation';
import { sanitizeHtml } from '../../utils/sanitize';

interface OpenQuestionProps {
  block: ActivityBlock;
  answer?: any;
  onAnswerChange: (answer: any) => void;
  onSubmit: () => void;
  readOnly?: boolean;
  gradeLevel?: string;
}

// Detect answer type from block metadata
type AnswerType = 'text' | 'number' | 'fraction' | 'mixed-number';

function getAnswerType(block: ActivityBlock): AnswerType {
  const metadata = block.metadata || {};
  if (metadata.answerType) return metadata.answerType as AnswerType;

  // Auto-detect from expected answer format
  const expected = metadata.expectedAnswer || metadata.modelAnswer || '';
  if (typeof expected === 'string') {
    if (/^\d+\/\d+$/.test(expected)) return 'fraction';
    if (/^\d+\s+\d+\/\d+$/.test(expected)) return 'mixed-number';
    if (/^-?\d+(\.\d+)?$/.test(expected)) return 'number';
  }

  return 'text';
}

const OpenQuestion = memo(function OpenQuestion({
  block,
  answer,
  onAnswerChange,
  onSubmit,
  readOnly = false,
  gradeLevel = 'ד',
}: OpenQuestionProps) {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isCorrect: boolean;
    feedback?: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const answerType = getAnswerType(block);
  const content = block.content as any;
  const question = typeof content === 'string' ? content : content?.question || '';
  const expectedAnswer = block.metadata?.expectedAnswer || block.metadata?.modelAnswer;
  const unit = block.metadata?.unit || '';

  // Handle text/number input change
  const handleTextChange = useCallback((value: string) => {
    setValidationResult(null);
    onAnswerChange({ text: value, type: answerType });
  }, [onAnswerChange, answerType]);

  // Handle fraction input change
  const handleFractionChange = useCallback((value: FractionValue) => {
    setValidationResult(null);
    onAnswerChange({
      fraction: value,
      text: fractionToString(value),
      type: 'fraction',
    });
  }, [onAnswerChange]);

  // Insert symbol from keyboard
  const handleInsertSymbol = useCallback((symbol: string) => {
    if (symbol === '⌫') {
      // Backspace
      const currentText = answer?.text || '';
      handleTextChange(currentText.slice(0, -1));
    } else {
      const currentText = answer?.text || '';
      handleTextChange(currentText + symbol);
    }
    inputRef.current?.focus();
  }, [answer?.text, handleTextChange]);

  // Validate answer before submit
  const handleSubmit = useCallback(() => {
    if (expectedAnswer && answerType !== 'text') {
      const studentAnswer = answer?.text || '';
      const options = getValidationOptionsForGrade(gradeLevel);
      const result = validateMathAnswer(studentAnswer, expectedAnswer.toString(), options);

      setValidationResult({
        isCorrect: result.isCorrect,
        feedback: result.feedback,
      });
    }
    onSubmit();
  }, [answer?.text, expectedAnswer, answerType, gradeLevel, onSubmit]);

  // Render the question content with math support
  const renderQuestion = () => {
    if (!question) return null;

    // Check if content contains LaTeX
    if (question.includes('$') || question.includes('\\')) {
      return (
        <div className="prose max-w-none mb-4">
          <MathRenderer content={question} />
        </div>
      );
    }

    // Regular HTML content - sanitize for XSS protection
    return (
      <div
        className="prose max-w-none mb-4"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(question) }}
      />
    );
  };

  // Render the appropriate input based on answer type
  const renderInput = () => {
    if (readOnly) {
      return (
        <div className="p-4 bg-gray-50 rounded-lg border">
          <span className="text-gray-600">תשובה: </span>
          <span className="font-medium">{answer?.text || 'לא נענה'}</span>
          {unit && <span className="text-gray-500 mr-1">{unit}</span>}
        </div>
      );
    }

    switch (answerType) {
      case 'fraction':
        return (
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-700">התשובה:</span>
              <FractionInput
                value={answer?.fraction}
                onChange={handleFractionChange}
                disabled={readOnly}
                isCorrect={validationResult?.isCorrect === true}
                isIncorrect={validationResult?.isCorrect === false}
                size="lg"
                autoFocus
              />
              {unit && <span className="text-gray-600">{unit}</span>}
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-700">התשובה:</span>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                className={`
                  w-32 px-4 py-3 text-xl text-center border-2 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-300
                  ${validationResult?.isCorrect === true
                    ? 'border-green-500 bg-green-50'
                    : validationResult?.isCorrect === false
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300'
                  }
                `}
                value={answer?.text || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                disabled={readOnly}
                autoFocus
              />
              {unit && <span className="text-gray-600">{unit}</span>}
            </div>

            {/* Number pad for mobile/touch */}
            <NumberPad
              onInsert={handleInsertSymbol}
              onClear={() => handleTextChange('')}
              showDecimal={gradeLevel >= 'ה'}
              showNegative={gradeLevel >= 'ו'}
              className="max-w-xs"
            />
          </div>
        );

      case 'text':
      default:
        return (
          <div className="flex flex-col gap-3">
            <textarea
              className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={6}
              placeholder="כתוב את תשובתך כאן..."
              value={answer?.text || ''}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={readOnly}
            />

            {/* Math keyboard toggle for text answers (optional) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowKeyboard(!showKeyboard)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <span>🔢</span>
                <span>{showKeyboard ? 'הסתר' : 'סימנים מתמטיים'}</span>
              </button>
            </div>

            {showKeyboard && (
              <InlineMathKeyboard
                onInsert={handleInsertSymbol}
                className="p-2 bg-gray-50 rounded-lg"
              />
            )}
          </div>
        );
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      {block.title && (
        <h3 className="text-xl font-bold mb-4">{block.title}</h3>
      )}

      {renderQuestion()}
      {renderInput()}

      {/* Validation feedback */}
      {validationResult && (
        <div
          className={`mt-3 p-3 rounded-lg ${
            validationResult.isCorrect
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {validationResult.isCorrect ? (
            <span>✓ תשובה נכונה!</span>
          ) : (
            <span>✗ {validationResult.feedback || 'תשובה שגויה, נסה שוב'}</span>
          )}
        </div>
      )}

      {/* Submit button */}
      {!readOnly && (
        <button
          onClick={handleSubmit}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!answer?.text?.trim()}
        >
          שלח תשובה
        </button>
      )}

      {/* Teacher tip (if available and in exam review mode) */}
      {readOnly && block.metadata?.teacher_guidelines && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">📝 הנחיות למורה:</h4>
          <div className="text-sm text-yellow-700 whitespace-pre-wrap">
            {block.metadata.teacher_guidelines}
          </div>
        </div>
      )}
    </div>
  );
});

export default OpenQuestion;
