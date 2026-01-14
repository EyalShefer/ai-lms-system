import React from 'react';

export type AIStarsSize = 'sm' | 'md' | 'lg' | 'xl';
export type AIStarsColor = 'primary' | 'action' | 'white' | 'gradient';

export interface AIStarsSpinnerProps {
  /** Size of the spinner */
  size?: AIStarsSize;
  /** Color variant */
  color?: AIStarsColor;
  /** Accessible label */
  label?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AI Stars Loading Spinner
 *
 * Animated AI-themed stars that orbit and sparkle during loading states.
 * Replaces traditional spinning circles with a more magical, AI-inspired animation.
 */
export const AIStarsSpinner: React.FC<AIStarsSpinnerProps> = ({
  size = 'md',
  color = 'gradient',
  label = 'טוען...',
  className = '',
}) => {
  const sizeConfig: Record<AIStarsSize, { container: string; starSizes: number[] }> = {
    sm: { container: 'w-6 h-6', starSizes: [8, 6, 5] },
    md: { container: 'w-10 h-10', starSizes: [12, 10, 8] },
    lg: { container: 'w-14 h-14', starSizes: [16, 14, 10] },
    xl: { container: 'w-20 h-20', starSizes: [24, 20, 14] },
  };

  const colorConfig: Record<AIStarsColor, string[]> = {
    primary: ['#4F46E5', '#6366F1', '#818CF8'],
    action: ['#F97316', '#FB923C', '#FDBA74'],
    white: ['#FFFFFF', '#F1F5F9', '#E2E8F0'],
    gradient: ['#4F46E5', '#8B5CF6', '#EC4899'],
  };

  const config = sizeConfig[size];
  const colors = colorConfig[color];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <div className={`relative ${config.container}`}>
        {/* Center star - pulsing */}
        <svg
          className="absolute inset-0 m-auto animate-pulse motion-reduce:animate-none"
          width={config.starSizes[0]}
          height={config.starSizes[0]}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L16.82 20.5L12 17.77L7.18 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z"
            fill={colors[0]}
            className="drop-shadow-lg"
          />
        </svg>

        {/* Orbiting star 1 */}
        <div
          className="absolute inset-0 animate-[orbit_2s_linear_infinite] motion-reduce:animate-none"
          style={{ animationDelay: '0ms' }}
        >
          <svg
            className="absolute"
            style={{ top: '0%', left: '50%', transform: 'translateX(-50%)' }}
            width={config.starSizes[1]}
            height={config.starSizes[1]}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L16.82 20.5L12 17.77L7.18 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z"
              fill={colors[1]}
              className="drop-shadow-md"
            />
          </svg>
        </div>

        {/* Orbiting star 2 */}
        <div
          className="absolute inset-0 animate-[orbit_2s_linear_infinite] motion-reduce:animate-none"
          style={{ animationDelay: '-666ms' }}
        >
          <svg
            className="absolute"
            style={{ top: '0%', left: '50%', transform: 'translateX(-50%)' }}
            width={config.starSizes[2]}
            height={config.starSizes[2]}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L16.82 20.5L12 17.77L7.18 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z"
              fill={colors[2]}
              className="drop-shadow-sm"
            />
          </svg>
        </div>

        {/* Orbiting star 3 */}
        <div
          className="absolute inset-0 animate-[orbit_2s_linear_infinite] motion-reduce:animate-none"
          style={{ animationDelay: '-1333ms' }}
        >
          <svg
            className="absolute"
            style={{ top: '0%', left: '50%', transform: 'translateX(-50%)' }}
            width={config.starSizes[1]}
            height={config.starSizes[1]}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 2L14.09 8.26L20.5 9.27L15.75 13.97L16.82 20.5L12 17.77L7.18 20.5L8.25 13.97L3.5 9.27L9.91 8.26L12 2Z"
              fill={colors[0]}
              className="drop-shadow-md opacity-80"
            />
          </svg>
        </div>

        {/* Sparkle effects */}
        <div className="absolute inset-0">
          <div
            className="absolute w-1 h-1 rounded-full animate-[sparkle_1.5s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ top: '20%', left: '80%', backgroundColor: colors[1], animationDelay: '0ms' }}
          />
          <div
            className="absolute w-1 h-1 rounded-full animate-[sparkle_1.5s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ top: '70%', left: '15%', backgroundColor: colors[2], animationDelay: '500ms' }}
          />
          <div
            className="absolute w-0.5 h-0.5 rounded-full animate-[sparkle_1.5s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ top: '85%', left: '75%', backgroundColor: colors[0], animationDelay: '1000ms' }}
          />
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default AIStarsSpinner;
