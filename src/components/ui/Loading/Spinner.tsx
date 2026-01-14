import React from 'react';
import { AIStarsSpinner, AIStarsSize, AIStarsColor } from './AIStarsSpinner';

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

// Map Spinner colors to AIStars colors
const colorMap: Record<SpinnerColor, AIStarsColor> = {
  primary: 'primary',
  action: 'action',
  white: 'white',
  current: 'gradient',
};

/**
 * Accessible Loading Spinner with AI Stars Animation
 *
 * Features:
 * - Screen reader announcement
 * - Multiple sizes
 * - Respects prefers-reduced-motion
 * - AI-themed animated stars
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
  return (
    <AIStarsSpinner
      size={size as AIStarsSize}
      color={colorMap[color]}
      label={label}
      className={className}
    />
  );
};

export default Spinner;
