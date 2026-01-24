/**
 * AnimatedText Component
 * Animated Hebrew RTL text with various effects
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing
} from 'remotion';
import { getHebrewTextStyle } from '../utils/fonts';

export type AnimationType = 'fade' | 'slide' | 'scale' | 'typewriter' | 'word-by-word';

interface AnimatedTextProps {
  text: string;
  startFrame?: number;
  animation?: AnimationType;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700 | 800;
  delay?: number;
  duration?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  startFrame = 0,
  animation = 'fade',
  className = '',
  style = {},
  color = '#1F2937',
  fontSize = 32,
  fontWeight = 400,
  delay = 0,
  duration = 30
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = frame - startFrame - delay;

  // Base Hebrew text style
  const hebrewStyle = getHebrewTextStyle(
    fontWeight === 400 ? 'regular' :
    fontWeight === 500 ? 'medium' :
    fontWeight === 600 ? 'semibold' :
    fontWeight === 700 ? 'bold' : 'extrabold'
  );

  // Animation calculations
  const getAnimationStyle = (): React.CSSProperties => {
    if (adjustedFrame < 0) {
      return { opacity: 0 };
    }

    switch (animation) {
      case 'fade': {
        const opacity = interpolate(
          adjustedFrame,
          [0, duration],
          [0, 1],
          { extrapolateRight: 'clamp' }
        );
        return { opacity };
      }

      case 'slide': {
        const progress = spring({
          frame: adjustedFrame,
          fps,
          config: { damping: 15, stiffness: 100 }
        });
        return {
          opacity: progress,
          transform: `translateX(${interpolate(progress, [0, 1], [100, 0])}px)`
        };
      }

      case 'scale': {
        const scale = spring({
          frame: adjustedFrame,
          fps,
          config: { damping: 10, stiffness: 100 }
        });
        const opacity = interpolate(
          adjustedFrame,
          [0, duration * 0.5],
          [0, 1],
          { extrapolateRight: 'clamp' }
        );
        return {
          opacity,
          transform: `scale(${scale})`
        };
      }

      case 'typewriter': {
        const chars = text.length;
        const charsToShow = Math.floor(
          interpolate(
            adjustedFrame,
            [0, duration],
            [0, chars],
            { extrapolateRight: 'clamp' }
          )
        );
        // For RTL, show from end
        const visibleText = text.slice(0, charsToShow);
        return {
          opacity: 1,
          // We'll handle this in render
        };
      }

      case 'word-by-word': {
        // Handled separately in render
        return { opacity: 1 };
      }

      default:
        return { opacity: 1 };
    }
  };

  // Special rendering for word-by-word animation
  if (animation === 'word-by-word') {
    const words = text.split(' ');
    const framesPerWord = duration / words.length;

    return (
      <div
        className={className}
        style={{
          ...hebrewStyle,
          color,
          fontSize,
          fontWeight,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25em',
          justifyContent: 'flex-end',
          ...style
        }}
      >
        {words.map((word, index) => {
          const wordFrame = adjustedFrame - index * framesPerWord;
          const wordOpacity = interpolate(
            wordFrame,
            [0, framesPerWord * 0.5],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          const wordY = interpolate(
            wordFrame,
            [0, framesPerWord * 0.5],
            [20, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          return (
            <span
              key={index}
              style={{
                opacity: wordOpacity,
                transform: `translateY(${wordY}px)`,
                display: 'inline-block'
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Typewriter effect
  if (animation === 'typewriter') {
    if (adjustedFrame < 0) {
      return <span style={{ opacity: 0 }}>{text}</span>;
    }

    const chars = text.length;
    const charsToShow = Math.floor(
      interpolate(
        adjustedFrame,
        [0, duration],
        [0, chars],
        { extrapolateRight: 'clamp' }
      )
    );
    const visibleText = text.slice(0, charsToShow);

    return (
      <span
        className={className}
        style={{
          ...hebrewStyle,
          color,
          fontSize,
          fontWeight,
          ...style
        }}
      >
        {visibleText}
        {charsToShow < chars && (
          <span
            style={{
              opacity: adjustedFrame % 30 < 15 ? 1 : 0,
              marginRight: '2px'
            }}
          >
            |
          </span>
        )}
      </span>
    );
  }

  // Standard animations
  const animationStyle = getAnimationStyle();

  return (
    <span
      className={className}
      style={{
        ...hebrewStyle,
        color,
        fontSize,
        fontWeight,
        ...animationStyle,
        ...style
      }}
    >
      {text}
    </span>
  );
};

export default AnimatedText;
