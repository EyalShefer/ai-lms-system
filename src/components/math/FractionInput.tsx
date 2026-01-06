/**
 * FractionInput Component
 *
 * A user-friendly input for fractions that looks like a real fraction.
 * Students enter numerator and denominator separately.
 *
 * Usage:
 *   <FractionInput
 *     value={{ numerator: 3, denominator: 4 }}
 *     onChange={(val) => console.log(val)}
 *   />
 */

import React, { useState, useRef, useEffect } from 'react';

export interface FractionValue {
  numerator: number | string;
  denominator: number | string;
}

interface FractionInputProps {
  /** Current value */
  value?: FractionValue;
  /** Callback when value changes */
  onChange?: (value: FractionValue) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether to show as correct (green) */
  isCorrect?: boolean;
  /** Whether to show as incorrect (red) */
  isIncorrect?: boolean;
  /** Placeholder for numerator */
  numeratorPlaceholder?: string;
  /** Placeholder for denominator */
  denominatorPlaceholder?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class name */
  className?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
}

export function FractionInput({
  value,
  onChange,
  disabled = false,
  isCorrect,
  isIncorrect,
  numeratorPlaceholder = '',
  denominatorPlaceholder = '',
  size = 'md',
  className = '',
  autoFocus = false,
}: FractionInputProps) {
  const [numerator, setNumerator] = useState<string>(
    value?.numerator?.toString() || ''
  );
  const [denominator, setDenominator] = useState<string>(
    value?.denominator?.toString() || ''
  );

  const numeratorRef = useRef<HTMLInputElement>(null);
  const denominatorRef = useRef<HTMLInputElement>(null);

  // Update internal state when value prop changes
  useEffect(() => {
    if (value) {
      setNumerator(value.numerator?.toString() || '');
      setDenominator(value.denominator?.toString() || '');
    }
  }, [value]);

  // Auto focus
  useEffect(() => {
    if (autoFocus && numeratorRef.current) {
      numeratorRef.current.focus();
    }
  }, [autoFocus]);

  const handleNumeratorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow only numbers and minus sign
    if (val === '' || /^-?\d*$/.test(val)) {
      setNumerator(val);
      onChange?.({
        numerator: val,
        denominator: denominator,
      });
    }
  };

  const handleDenominatorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow only positive numbers for denominator
    if (val === '' || /^\d*$/.test(val)) {
      setDenominator(val);
      onChange?.({
        numerator: numerator,
        denominator: val,
      });
    }
  };

  const handleNumeratorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to denominator on Enter or arrow down
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      denominatorRef.current?.focus();
    }
  };

  const handleDenominatorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to numerator on arrow up
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      numeratorRef.current?.focus();
    }
  };

  // Size classes
  const sizeClasses = {
    sm: {
      input: 'w-10 h-6 text-sm',
      line: 'w-12',
      container: 'gap-0.5',
    },
    md: {
      input: 'w-14 h-8 text-base',
      line: 'w-16',
      container: 'gap-1',
    },
    lg: {
      input: 'w-20 h-10 text-lg',
      line: 'w-24',
      container: 'gap-1',
    },
  };

  const sizes = sizeClasses[size];

  // Border color based on state
  let borderColor = 'border-gray-300 focus:border-indigo-500';
  if (isCorrect) {
    borderColor = 'border-green-500 bg-green-50';
  } else if (isIncorrect) {
    borderColor = 'border-red-500 bg-red-50';
  }

  return (
    <div className={`inline-flex flex-col items-center ${sizes.container} ${className}`}>
      {/* Numerator */}
      <input
        ref={numeratorRef}
        type="text"
        inputMode="numeric"
        value={numerator}
        onChange={handleNumeratorChange}
        onKeyDown={handleNumeratorKeyDown}
        disabled={disabled}
        placeholder={numeratorPlaceholder}
        className={`
          ${sizes.input}
          text-center border-2 rounded-md
          ${borderColor}
          outline-none transition-colors
          disabled:bg-gray-100 disabled:cursor-not-allowed
        `}
        aria-label="מונה"
      />

      {/* Fraction line */}
      <div className={`${sizes.line} h-0.5 bg-gray-800 rounded`} />

      {/* Denominator */}
      <input
        ref={denominatorRef}
        type="text"
        inputMode="numeric"
        value={denominator}
        onChange={handleDenominatorChange}
        onKeyDown={handleDenominatorKeyDown}
        disabled={disabled}
        placeholder={denominatorPlaceholder}
        className={`
          ${sizes.input}
          text-center border-2 rounded-md
          ${borderColor}
          outline-none transition-colors
          disabled:bg-gray-100 disabled:cursor-not-allowed
        `}
        aria-label="מכנה"
      />
    </div>
  );
}

/**
 * Mixed Number Input (whole number + fraction)
 * For inputs like "1 ½" or "2 ¾"
 */
interface MixedNumberInputProps extends Omit<FractionInputProps, 'value' | 'onChange'> {
  value?: {
    whole: number | string;
    numerator: number | string;
    denominator: number | string;
  };
  onChange?: (value: {
    whole: number | string;
    numerator: number | string;
    denominator: number | string;
  }) => void;
}

export function MixedNumberInput({
  value,
  onChange,
  disabled = false,
  isCorrect,
  isIncorrect,
  size = 'md',
  className = '',
}: MixedNumberInputProps) {
  const [whole, setWhole] = useState<string>(value?.whole?.toString() || '');
  const [numerator, setNumerator] = useState<string>(
    value?.numerator?.toString() || ''
  );
  const [denominator, setDenominator] = useState<string>(
    value?.denominator?.toString() || ''
  );

  const wholeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value) {
      setWhole(value.whole?.toString() || '');
      setNumerator(value.numerator?.toString() || '');
      setDenominator(value.denominator?.toString() || '');
    }
  }, [value]);

  const handleWholeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^-?\d*$/.test(val)) {
      setWhole(val);
      onChange?.({ whole: val, numerator, denominator });
    }
  };

  const handleFractionChange = (frac: FractionValue) => {
    setNumerator(frac.numerator.toString());
    setDenominator(frac.denominator.toString());
    onChange?.({
      whole,
      numerator: frac.numerator,
      denominator: frac.denominator,
    });
  };

  const sizeClasses = {
    sm: 'w-8 h-6 text-sm',
    md: 'w-10 h-8 text-base',
    lg: 'w-14 h-10 text-lg',
  };

  let borderColor = 'border-gray-300 focus:border-indigo-500';
  if (isCorrect) {
    borderColor = 'border-green-500 bg-green-50';
  } else if (isIncorrect) {
    borderColor = 'border-red-500 bg-red-50';
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Whole number */}
      <input
        ref={wholeRef}
        type="text"
        inputMode="numeric"
        value={whole}
        onChange={handleWholeChange}
        disabled={disabled}
        placeholder="0"
        className={`
          ${sizeClasses[size]}
          text-center border-2 rounded-md
          ${borderColor}
          outline-none transition-colors
          disabled:bg-gray-100 disabled:cursor-not-allowed
        `}
        aria-label="מספר שלם"
      />

      {/* Fraction part */}
      <FractionInput
        value={{ numerator, denominator }}
        onChange={handleFractionChange}
        disabled={disabled}
        isCorrect={isCorrect}
        isIncorrect={isIncorrect}
        size={size}
      />
    </div>
  );
}

/**
 * Helper: Convert FractionValue to decimal
 */
export function fractionToDecimal(value: FractionValue): number | null {
  const num = typeof value.numerator === 'string'
    ? parseInt(value.numerator, 10)
    : value.numerator;
  const den = typeof value.denominator === 'string'
    ? parseInt(value.denominator, 10)
    : value.denominator;

  if (isNaN(num) || isNaN(den) || den === 0) {
    return null;
  }

  return num / den;
}

/**
 * Helper: Convert FractionValue to string like "3/4"
 */
export function fractionToString(value: FractionValue): string {
  return `${value.numerator}/${value.denominator}`;
}

/**
 * Helper: Parse string like "3/4" to FractionValue
 */
export function parseFraction(str: string): FractionValue | null {
  const match = str.trim().match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  return {
    numerator: parseInt(match[1], 10),
    denominator: parseInt(match[2], 10),
  };
}

export default FractionInput;
