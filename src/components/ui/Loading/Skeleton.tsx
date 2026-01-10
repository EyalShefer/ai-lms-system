import React from 'react';

export interface SkeletonProps {
  /** Width (can be Tailwind class or CSS value) */
  width?: string;
  /** Height (can be Tailwind class or CSS value) */
  height?: string;
  /** Border radius variant */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Skeleton Loading Placeholder
 *
 * Features:
 * - Shimmer animation
 * - Respects prefers-reduced-motion
 * - Customizable dimensions
 *
 * @example
 * ```tsx
 * <Skeleton width="w-32" height="h-4" rounded="md" />
 * ```
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = 'w-full',
  height = 'h-4',
  rounded = 'md',
  className = '',
}) => {
  const roundedStyles: Record<typeof rounded, string> = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  };

  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`
        ${width}
        ${height}
        ${roundedStyles[rounded]}
        bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
        dark:from-slate-700 dark:via-slate-600 dark:to-slate-700
        animate-shimmer
        motion-reduce:animate-none motion-reduce:bg-slate-200 motion-reduce:dark:bg-slate-700
        ${className}
      `}
      style={{
        backgroundSize: '200% 100%',
      }}
    />
  );
};

/**
 * Skeleton Text - Multiple lines of text placeholder
 */
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`} role="presentation" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? 'w-3/4' : 'w-full'}
          height="h-4"
          rounded="md"
        />
      ))}
    </div>
  );
};

/**
 * Skeleton Card - Full card placeholder
 */
export const SkeletonCard: React.FC<{
  hasImage?: boolean;
  className?: string;
}> = ({ hasImage = false, className = '' }) => {
  return (
    <div
      className={`card-glass p-6 ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      {hasImage && (
        <Skeleton width="w-full" height="h-40" rounded="xl" className="mb-4" />
      )}
      <Skeleton width="w-3/4" height="h-6" rounded="md" className="mb-2" />
      <Skeleton width="w-1/2" height="h-4" rounded="md" className="mb-4" />
      <SkeletonText lines={2} />
    </div>
  );
};

/**
 * Skeleton Avatar - Circular avatar placeholder
 */
export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const sizeStyles: Record<typeof size, string> = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <Skeleton
      width={sizeStyles[size].split(' ')[0]}
      height={sizeStyles[size].split(' ')[1]}
      rounded="full"
      className={className}
    />
  );
};

export default Skeleton;
