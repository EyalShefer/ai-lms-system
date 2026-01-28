import React, { useState } from 'react';
import { IconRefresh, IconDeviceFloppy, IconShare, IconPencil, IconLoader2 } from '@tabler/icons-react';
import type { MicroActivity } from '../../shared/types/microActivityTypes';
import { getMicroActivityTypeInfo } from '../../shared/types/microActivityTypes';

interface MicroPreviewProps {
  activity: MicroActivity;
  onEdit: (activity: MicroActivity) => void;
  onRegenerate: () => void;
  onSave: () => void;
  onShare: () => void;
  isRegenerating: boolean;
}

export default function MicroPreview({
  activity,
  onEdit,
  onRegenerate,
  onSave,
  onShare,
  isRegenerating
}: MicroPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(activity.title);

  const typeInfo = getMicroActivityTypeInfo(activity.type);

  // Handle title save
  const handleTitleSave = () => {
    onEdit({ ...activity, title: editedTitle });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with title */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleTitleSave}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                שמור
              </button>
              <button
                onClick={() => {
                  setEditedTitle(activity.title);
                  setIsEditing(false);
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                ביטול
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{typeInfo?.icon}</span>
              <h3 className="text-xl font-bold text-gray-900">{activity.title}</h3>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <IconPencil className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-sm text-gray-500 mt-1">
            כיתה {activity.gradeLevel} | {typeInfo?.name}
          </p>
        </div>
      </div>

      {/* Content Preview */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-700">תצוגה מקדימה</h4>
        </div>
        <div className="p-4">
          <ContentPreview activity={activity} onEdit={onEdit} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {isRegenerating ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconRefresh className="w-5 h-5" />}
          <span>צור מחדש</span>
        </button>

        <button
          onClick={onSave}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <IconDeviceFloppy className="w-5 h-5" />
          <span>שמור לבנק</span>
        </button>

        <button
          onClick={onShare}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-colors"
        >
          <IconShare className="w-5 h-5" />
          <span>שתף עכשיו</span>
        </button>
      </div>
    </div>
  );
}

// Content preview based on activity type
interface ContentPreviewProps {
  activity: MicroActivity;
  onEdit: (activity: MicroActivity) => void;
}

function ContentPreview({ activity, onEdit }: ContentPreviewProps) {
  const content = activity.block?.content;

  if (!content) {
    return <p className="text-gray-500">אין תוכן לתצוגה</p>;
  }

  switch (activity.type) {
    case 'memory_game':
      return <MemoryGamePreview content={content} />;
    case 'matching':
      return <MatchingPreview content={content} />;
    case 'categorization':
      return <CategorizationPreview content={content} />;
    case 'ordering':
      return <OrderingPreview content={content} />;
    case 'multiple_choice':
      return <MultipleChoicePreview content={content} />;
    case 'true_false':
      return <TrueFalsePreview content={content} />;
    case 'open_question':
      return <OpenQuestionPreview content={content} />;
    case 'fill_in_blanks':
      return <FillInBlanksPreview content={content} />;
    case 'matrix':
      return <MatrixPreview content={content} />;
    default:
      return <GenericPreview content={content} />;
  }
}

// Memory Game Preview
function MemoryGamePreview({ content }: { content: any }) {
  const pairs = content.pairs || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-3">
        {pairs.length} זוגות להתאמה
      </p>
      <div className="grid grid-cols-2 gap-3">
        {pairs.map((pair: any, index: number) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
              {pair.card_a}
            </span>
            <span className="text-gray-400">↔</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
              {pair.card_b}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Matching Preview
function MatchingPreview({ content }: { content: any }) {
  const leftItems = content.leftItems || [];
  const rightItems = content.rightItems || [];
  const matches = content.correctMatches || [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-3">{content.instruction}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium">צד שמאל</p>
          {leftItems.map((item: any) => (
            <div key={item.id} className="p-2 bg-blue-50 rounded-lg text-sm">
              {item.text}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium">צד ימין</p>
          {rightItems.map((item: any) => (
            <div key={item.id} className="p-2 bg-green-50 rounded-lg text-sm">
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Categorization Preview
function CategorizationPreview({ content }: { content: any }) {
  const categories = content.categories || [];
  const items = content.items || [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-3">{content.question}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map((cat: string, index: number) => (
          <span
            key={index}
            className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
          >
            {cat}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item: any, index: number) => (
          <span
            key={index}
            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
          >
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

// Ordering Preview
function OrderingPreview({ content }: { content: any }) {
  const items = content.correct_order || [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-3">{content.instruction}</p>
      <ol className="space-y-2">
        {items.map((item: string, index: number) => (
          <li key={index} className="flex items-center gap-3">
            <span className="w-6 h-6 flex items-center justify-center bg-blue-600 text-white rounded-full text-sm font-medium">
              {index + 1}
            </span>
            <span className="text-sm">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Multiple Choice Preview
function MultipleChoicePreview({ content }: { content: any }) {
  const questions = content.questions || [];

  return (
    <div className="space-y-4">
      {questions.map((q: any, index: number) => (
        <div key={index} className="p-3 bg-gray-50 rounded-lg">
          <p className="font-medium text-gray-900 mb-2">
            {index + 1}. {q.question}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {q.options?.map((opt: string, optIndex: number) => (
              <div
                key={optIndex}
                className={`p-2 rounded text-sm ${
                  opt === q.correctAnswer
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// True/False Preview
function TrueFalsePreview({ content }: { content: any }) {
  const statements = content.statements || [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-3">{content.instruction}</p>
      <div className="space-y-2">
        {statements.map((s: any, index: number) => (
          <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                s.isTrue
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {s.isTrue ? 'נכון' : 'לא נכון'}
            </span>
            <span className="text-sm">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Open Question Preview
function OpenQuestionPreview({ content }: { content: any }) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-gray-900">{content.question}</p>
      {content.modelAnswer && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-700 font-medium mb-1">תשובה מודל:</p>
          <p className="text-sm text-yellow-900">{content.modelAnswer}</p>
        </div>
      )}
    </div>
  );
}

// Fill in Blanks Preview
function FillInBlanksPreview({ content }: { content: any }) {
  const sentences = content.sentences || [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-3">{content.instruction}</p>
      <div className="space-y-2">
        {sentences.map((s: any, index: number) => (
          <div key={index} className="p-2 bg-gray-50 rounded-lg">
            <p className="text-sm">
              {s.text.replace('___', `[${s.answer}]`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Matrix Preview
function MatrixPreview({ content }: { content: any }) {
  const columns = content.columns || [];
  const rows = content.rows || [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-3">{content.instruction}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" dir="rtl">
          <thead>
            <tr className="bg-blue-500 text-white">
              <th className="px-3 py-2 text-right border border-blue-400">שאלה</th>
              {columns.map((col: string, idx: number) => (
                <th key={idx} className="px-3 py-2 text-center border border-blue-400">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, rowIdx: number) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-3 py-2 text-right border border-gray-200 font-medium">
                  {row.question}
                </td>
                {columns.map((col: string, colIdx: number) => (
                  <td key={colIdx} className="px-3 py-2 text-center border border-gray-200">
                    <div className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center ${
                      row.correctAnswer === col
                        ? 'bg-green-500 border-green-600'
                        : 'bg-white border-gray-300'
                    }`}>
                      {row.correctAnswer === col && <span className="text-white text-xs">✓</span>}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Generic Preview for other types
function GenericPreview({ content }: { content: any }) {
  return (
    <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-64" dir="ltr">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}
