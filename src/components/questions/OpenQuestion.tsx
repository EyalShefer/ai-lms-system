/**
 * Wrapper for open-ended questions
 * Handles both text and audio responses
 */
import { memo } from 'react';
import type { ActivityBlock } from '../../shared/types/courseTypes';

interface OpenQuestionProps {
  block: ActivityBlock;
  answer?: any;
  onAnswerChange: (answer: any) => void;
  onSubmit: () => void;
  readOnly?: boolean;
}

const OpenQuestion = memo(function OpenQuestion({
  block,
  answer,
  onAnswerChange,
  onSubmit,
  readOnly = false,
}: OpenQuestionProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-bold mb-4">{block.title}</h3>

      {block.content && (
        <div
          className="prose max-w-none mb-4"
          dangerouslySetInnerHTML={{ __html: block.content }}
        />
      )}

      <textarea
        className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        rows={6}
        placeholder="כתוב את תשובתך כאן..."
        value={answer?.text || ''}
        onChange={(e) => onAnswerChange({ text: e.target.value })}
        disabled={readOnly}
      />

      {!readOnly && (
        <button
          onClick={onSubmit}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          disabled={!answer?.text?.trim()}
        >
          שלח תשובה
        </button>
      )}
    </div>
  );
});

export default OpenQuestion;
