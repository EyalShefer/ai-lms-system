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
        <div className="wizdi-question-text wizdi-readable-text">
          <MathRenderer content={question} />
        </div>
      );
    }

    // Regular HTML content - sanitize for XSS protection
    return (
      <div
        className="wizdi-question-text wizdi-readable-text"
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
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
              הקלד את תשובתך כאן
            </label>
            <textarea
              className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 rounded-xl resize-none
                focus:ring-2 focus:ring-wizdi-cyan focus:border-wizdi-cyan
                bg-white dark:bg-slate-800
                text-slate-800 dark:text-slate-100
                placeholder:text-slate-400
                transition-all duration-200"
              style={{
                fontSize: 'var(--wizdi-font-size-base)',
                lineHeight: 'var(--wizdi-line-height-tight)',
              }}
              rows={5}
              placeholder="הקלד את תשובתך כאן..."
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
    <div className="wizdi-question-block" role="region" aria-labelledby={block.title ? 'open-question-title' : undefined}>
      {block.title && (
        <h3 id="open-question-title" className="text-xl font-bold mb-6 text-slate-800 dark:text-white">{block.title}</h3>
      )}

      {renderQuestion()}
      <div className="wizdi-answer-area">
        {renderInput()}
      </div>

      {/* Validation feedback */}
      {validationResult && (
        <div
          role="alert"
          aria-live="polite"
          className={`mt-4 p-4 min-h-[44px] rounded-xl text-base font-medium ${
            validationResult.isCorrect
              ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700'
          }`}
        >
          {validationResult.isCorrect ? (
            <span><span aria-hidden="true">✓</span> תשובה נכונה!</span>
          ) : (
            <span><span aria-hidden="true">✗</span> {validationResult.feedback || 'תשובה שגויה, נסו שוב'}</span>
          )}
        </div>
      )}

      {/* Submit button */}
      {!readOnly && (
        <button
          onClick={handleSubmit}
          aria-label="שלח תשובה"
          className="btn-lip-action mt-6 px-8 py-3"
          disabled={!answer?.text?.trim()}
        >
          שלח תשובה
        </button>
      )}

    </div>
  );
});

export default OpenQuestion;
