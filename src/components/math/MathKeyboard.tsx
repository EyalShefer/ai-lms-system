/**
 * MathKeyboard Component
 *
 * A virtual keyboard with math symbols for easy input.
 * Designed for elementary school students.
 *
 * Usage:
 *   <MathKeyboard onInsert={(symbol) => insertAtCursor(symbol)} />
 */

import React, { useState } from 'react';

interface MathKeyboardProps {
  /** Callback when a symbol is clicked */
  onInsert: (symbol: string) => void;
  /** Whether to show the keyboard */
  isOpen?: boolean;
  /** Callback to toggle keyboard */
  onToggle?: () => void;
  /** Which symbol groups to show */
  groups?: ('numbers' | 'operations' | 'fractions' | 'comparisons' | 'geometry')[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class name */
  className?: string;
}

// Symbol groups
const SYMBOL_GROUPS = {
  numbers: {
    label: 'מספרים',
    symbols: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-'],
  },
  operations: {
    label: 'פעולות',
    symbols: ['+', '−', '×', '÷', '=', '(', ')', '/', '^'],
  },
  fractions: {
    label: 'שברים',
    symbols: ['½', '⅓', '¼', '⅔', '¾', '⅕', '⅖', '⅗', '⅘'],
  },
  comparisons: {
    label: 'השוואות',
    symbols: ['<', '>', '≤', '≥', '≠', '≈'],
  },
  geometry: {
    label: 'גיאומטריה',
    symbols: ['°', '∠', '△', '□', '○', 'π', '²', '³', '√'],
  },
};

export function MathKeyboard({
  onInsert,
  isOpen = true,
  onToggle,
  groups = ['numbers', 'operations', 'fractions'],
  size = 'md',
  className = '',
}: MathKeyboardProps) {
  const [activeGroup, setActiveGroup] = useState<string>(groups[0]);

  const sizeClasses = {
    sm: {
      button: 'w-8 h-8 text-sm',
      tab: 'px-2 py-1 text-xs',
    },
    md: {
      button: 'w-10 h-10 text-base',
      tab: 'px-3 py-1.5 text-sm',
    },
    lg: {
      button: 'w-12 h-12 text-lg',
      tab: 'px-4 py-2 text-base',
    },
  };

  const sizes = sizeClasses[size];

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <span>🔢</span>
        <span>מקלדת מתמטית</span>
      </button>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-lg p-3 ${className}`}>
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">מקלדת מתמטית</span>
        {onToggle && (
          <button
            onClick={onToggle}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded"
          >
            ✕
          </button>
        )}
      </div>

      {/* Group tabs */}
      <div className="flex flex-wrap gap-1 mb-2 border-b border-gray-200 pb-2">
        {groups.map((groupKey) => {
          const group = SYMBOL_GROUPS[groupKey];
          return (
            <button
              key={groupKey}
              onClick={() => setActiveGroup(groupKey)}
              className={`
                ${sizes.tab}
                rounded-md transition-colors
                ${activeGroup === groupKey
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Symbols grid */}
      <div className="grid grid-cols-6 gap-1">
        {SYMBOL_GROUPS[activeGroup as keyof typeof SYMBOL_GROUPS]?.symbols.map((symbol) => (
          <button
            key={symbol}
            onClick={() => onInsert(symbol)}
            className={`
              ${sizes.button}
              flex items-center justify-center
              bg-gray-50 hover:bg-indigo-100 hover:text-indigo-700
              border border-gray-200 rounded-lg
              font-medium transition-all
              active:scale-95
            `}
          >
            {symbol}
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
        <button
          onClick={() => onInsert('⌫')}
          className="flex-1 py-1.5 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
        >
          מחק ⌫
        </button>
        <button
          onClick={() => onInsert(' ')}
          className="flex-1 py-1.5 text-sm bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          רווח
        </button>
      </div>
    </div>
  );
}

/**
 * Compact inline math keyboard (just symbols, no tabs)
 */
interface InlineMathKeyboardProps {
  onInsert: (symbol: string) => void;
  symbols?: string[];
  className?: string;
}

export function InlineMathKeyboard({
  onInsert,
  symbols = ['+', '−', '×', '÷', '=', '/', '.', '½', '¼', '¾'],
  className = '',
}: InlineMathKeyboardProps) {
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {symbols.map((symbol) => (
        <button
          key={symbol}
          onClick={() => onInsert(symbol)}
          className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-sm font-medium transition-colors"
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}

/**
 * Number pad for simple numeric input
 */
interface NumberPadProps {
  onInsert: (value: string) => void;
  onClear?: () => void;
  onSubmit?: () => void;
  showDecimal?: boolean;
  showNegative?: boolean;
  className?: string;
}

export function NumberPad({
  onInsert,
  onClear,
  onSubmit,
  showDecimal = true,
  showNegative = false,
  className = '',
}: NumberPadProps) {
  const numbers = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {numbers.map((num) => (
        <button
          key={num}
          onClick={() => onInsert(num)}
          className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-lg font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          {num}
        </button>
      ))}

      {/* Bottom row */}
      {showNegative ? (
        <button
          onClick={() => onInsert('-')}
          className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-lg font-medium hover:bg-gray-50"
        >
          −
        </button>
      ) : (
        <div />
      )}

      <button
        onClick={() => onInsert('0')}
        className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-lg font-medium hover:bg-gray-50 active:bg-gray-100"
      >
        0
      </button>

      {showDecimal ? (
        <button
          onClick={() => onInsert('.')}
          className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-lg font-medium hover:bg-gray-50"
        >
          .
        </button>
      ) : (
        <div />
      )}

      {/* Action buttons */}
      {onClear && (
        <button
          onClick={onClear}
          className="col-span-1 h-12 flex items-center justify-center bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100"
        >
          C
        </button>
      )}

      {onSubmit && (
        <button
          onClick={onSubmit}
          className="col-span-2 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
        >
          שלח ←
        </button>
      )}
    </div>
  );
}

export default MathKeyboard;
