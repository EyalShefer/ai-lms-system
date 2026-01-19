import React from 'react';
import { IconPhoto, IconSparkles } from '@tabler/icons-react';

export interface ImageGenerationSkeletonProps {
  /** Height of the skeleton (Tailwind class) */
  height?: string;
  /** Optional prompt text being generated */
  prompt?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Image Generation Skeleton
 *
 * A beautiful loading placeholder shown while AI generates an image.
 * Features flowing gradient animation with a subtle sparkle effect.
 */
export const ImageGenerationSkeleton: React.FC<ImageGenerationSkeletonProps> = ({
  height = 'h-48',
  prompt,
  className = '',
}) => {
  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100
        ${height}
        ${className}
      `}
    >
      {/* Animated gradient overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"
        style={{ backgroundSize: '200% 100%' }}
      />

      {/* Noise texture overlay for depth */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        {/* Icon with pulse animation */}
        <div className="relative">
          <IconPhoto className="w-12 h-12 text-blue-300/70" />
          <IconSparkles className="w-5 h-5 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-sm font-bold text-blue-600/80 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            יוצר תמונה...
          </p>
          {prompt && (
            <p className="text-xs text-gray-500/70 mt-1 max-w-[200px] truncate px-4">
              "{prompt}"
            </p>
          )}
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-100/50 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-progress"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};

export default ImageGenerationSkeleton;
