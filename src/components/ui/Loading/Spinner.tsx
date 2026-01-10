import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'action' | 'white' | 'current';

export interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Color variant */
  color?: SpinnerColor;
  /** Accessible label */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Accessible Loading Spinner
 *
 * Features:
 * - Screen reader announcement
 * - Multiple sizes
 * - Respects prefers-reduced-motion
 *
 * @example
 * ```tsx
 * <Spinner size="md" label="טוען..." />
 * ```
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'primary',
  label = 'טוען...',
  className = '',
}) => {
  // Size styles
  const sizeStyles: Record<SpinnerSize, string> = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
    xl: 'h-12 w-12 border-4',
  };

  // Color styles
  const colorStyles: Record<SpinnerColor, string> = {
    primary: 'border-wizdi-royal/30 border-t-wizdi-royal',
    action: 'border-wizdi-action/30 border-t-wizdi-action',
    white: 'border-white/30 border-t-white',
    current: 'border-current/30 border-t-current',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <div
        className={`
          ${sizeStyles[size]}
          ${colorStyles[color]}
          rounded-full
          animate-spin
          motion-reduce:animate-none
        `}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default Spinner;
