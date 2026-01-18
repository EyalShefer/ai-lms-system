/**
 * StreamingProgress Component
 *
 * Visual component for showing real-time streaming progress.
 * Displays:
 * - Current progress message
 * - Level/Part indicators for differentiated/lesson content
 * - Animated text streaming effect
 * - Cancel button
 */

import React from 'react';
import { IconLoader, IconCircleX, IconCircleCheck, IconSparkles } from '@tabler/icons-react';
import type { StreamingState } from '../hooks/useStreamingGeneration';

// ============================================================
// TYPES
// ============================================================

interface StreamingProgressProps {
  state: StreamingState;
  onCancel?: () => void;
  showStreamedText?: boolean;
  className?: string;
}

interface LevelIndicatorProps {
  currentLevel?: string;
  completedLevels?: string[];
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

/**
 * Level progress indicator for differentiated content
 */
const LevelIndicator: React.FC<LevelIndicatorProps> = ({
  currentLevel,
  completedLevels = []
}) => {
  const levels = [
    { key: 'support', name: 'תומכת', color: 'bg-green-500' },
    { key: 'core', name: 'רגילה', color: 'bg-blue-500' },
    { key: 'enrichment', name: 'מתקדמת', color: 'bg-purple-500' }
  ];

  return (
    <div className="flex gap-2 items-center justify-center mt-3">
      {levels.map((level, index) => {
        const isCompleted = completedLevels.includes(level.key);
        const isCurrent = currentLevel === level.key;

        return (
          <React.Fragment key={level.key}>
            {index > 0 && (
              <div className={`h-0.5 w-8 transition-colors duration-300 ${
                isCompleted || isCurrent ? 'bg-gray-400' : 'bg-gray-200'
              }`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${isCompleted ? `${level.color} text-white` : ''}
                  ${isCurrent ? `${level.color} text-white animate-pulse ring-2 ring-offset-2 ring-${level.color}` : ''}
                  ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-400' : ''}
                `}
              >
                {isCompleted ? (
                  <IconCircleCheck className="w-5 h-5" />
                ) : isCurrent ? (
                  <IconLoader className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              <span className={`text-xs font-medium ${
                isCurrent ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {level.name}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * Typing animation for streamed text
 */
const StreamedText: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
      <div className="font-mono text-sm text-gray-700 whitespace-pre-wrap break-words">
        {text}
        <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
  state,
  onCancel,
  showStreamedText = false,
  className = ''
}) => {
  const { isStreaming, progress, currentLevel, currentPart, streamedText, error } = state;

  // Don't render if not streaming and no error
  if (!isStreaming && !error && !progress) {
    return null;
  }

  // Determine completed levels based on progress message
  const completedLevels: string[] = [];
  if (progress.includes('✓ רמה תומכת')) completedLevels.push('support');
  if (progress.includes('✓ רמה רגילה')) completedLevels.push('core');
  if (progress.includes('✓ רמה מתקדמת')) completedLevels.push('enrichment');

  return (
    <div className={`rounded-xl border bg-white shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isStreaming ? (
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <IconSparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 opacity-30 animate-ping" />
            </div>
          ) : error ? (
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <IconCircleX className="w-5 h-5 text-red-500" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <IconCircleCheck className="w-5 h-5 text-green-500" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900">
              {isStreaming ? 'יוצר תוכן...' : error ? 'שגיאה' : 'הושלם!'}
            </h3>
            <p className="text-sm text-gray-500">{progress}</p>
          </div>
        </div>

        {/* Cancel button */}
        {isStreaming && onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ביטול
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Level indicator for differentiated content */}
      {currentLevel && (
        <LevelIndicator
          currentLevel={currentLevel}
          completedLevels={completedLevels}
        />
      )}

      {/* Part indicator for lesson content */}
      {currentPart && !currentLevel && (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            <IconLoader className="w-4 h-4 animate-spin" />
            {currentPart === 'hook' && 'פתיחה'}
            {currentPart === 'instruction' && 'הוראה'}
            {currentPart === 'practice' && 'תרגול'}
            {currentPart === 'summary' && 'סיכום'}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {isStreaming && (
        <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-streaming-progress" />
        </div>
      )}

      {/* Streamed text preview */}
      {showStreamedText && streamedText && <StreamedText text={streamedText} />}
    </div>
  );
};

// ============================================================
// COMPACT VERSION
// ============================================================

interface StreamingBadgeProps {
  isStreaming: boolean;
  progress: string;
  currentLevel?: string;
}

export const StreamingBadge: React.FC<StreamingBadgeProps> = ({
  isStreaming,
  progress,
  currentLevel
}) => {
  if (!isStreaming) return null;

  const levelColors: Record<string, string> = {
    support: 'from-green-500 to-green-600',
    core: 'from-blue-500 to-blue-600',
    enrichment: 'from-purple-500 to-purple-600'
  };

  const gradientClass = currentLevel
    ? levelColors[currentLevel] || 'from-blue-500 to-purple-600'
    : 'from-blue-500 to-purple-600';

  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-1.5
      bg-gradient-to-r ${gradientClass}
      text-white text-sm font-medium rounded-full
      shadow-lg
    `}>
      <IconLoader className="w-4 h-4 animate-spin" />
      <span>{progress || 'מייצר...'}</span>
    </div>
  );
};

export default StreamingProgress;
