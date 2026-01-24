/**
 * MathFormula Component
 * Animated mathematical formulas for educational videos
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring
} from 'remotion';
import { colors } from '../utils/colors';

interface MathFormulaProps {
  formula: string;
  startFrame?: number;
  animation?: 'fade' | 'draw' | 'highlight' | 'step-by-step';
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  color?: string;
  highlightColor?: string;
  className?: string;
}

const sizeMap = {
  small: 24,
  medium: 36,
  large: 48,
  xlarge: 64
};

export const MathFormula: React.FC<MathFormulaProps> = ({
  formula,
  startFrame = 0,
  animation = 'fade',
  size = 'large',
  color = colors.textPrimary,
  highlightColor = colors.wizdiAction,
  className = ''
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = frame - startFrame;
  const fontSize = sizeMap[size];

  // Parse formula for rendering
  // Simple parser for basic math notation
  const renderFormula = () => {
    // Replace common math symbols
    let rendered = formula
      .replace(/\*/g, '\u00D7')  // multiplication
      .replace(/\//g, '\u00F7')  // division
      .replace(/sqrt\(([^)]+)\)/g, '\u221A$1')  // square root
      .replace(/\^2/g, '\u00B2')  // squared
      .replace(/\^3/g, '\u00B3')  // cubed
      .replace(/pi/gi, '\u03C0')  // pi
      .replace(/>=/g, '\u2265')  // >=
      .replace(/<=/g, '\u2264')  // <=
      .replace(/!=/g, '\u2260'); // !=

    return rendered;
  };

  const getAnimationStyle = (): React.CSSProperties => {
    if (adjustedFrame < 0) {
      return { opacity: 0 };
    }

    switch (animation) {
      case 'fade': {
        const opacity = interpolate(
          adjustedFrame,
          [0, 20],
          [0, 1],
          { extrapolateRight: 'clamp' }
        );
        return { opacity };
      }

      case 'draw': {
        const progress = spring({
          frame: adjustedFrame,
          fps,
          config: { damping: 20, stiffness: 80 }
        });
        return {
          opacity: 1,
          clipPath: `inset(0 ${interpolate(progress, [0, 1], [100, 0])}% 0 0)`
        };
      }

      case 'highlight': {
        const highlightProgress = interpolate(
          adjustedFrame,
          [0, 15, 30, 45],
          [0, 1, 1, 0],
          { extrapolateRight: 'clamp' }
        );
        return {
          opacity: 1,
          textShadow: `0 0 ${highlightProgress * 20}px ${highlightColor}`
        };
      }

      default:
        return { opacity: 1 };
    }
  };

  return (
    <div
      className={`remotion-math ${className}`}
      style={{
        fontFamily: '"Times New Roman", serif',
        fontSize,
        color,
        fontWeight: 400,
        letterSpacing: '0.05em',
        direction: 'ltr',
        textAlign: 'center',
        ...getAnimationStyle()
      }}
    >
      {renderFormula()}
    </div>
  );
};

// Animated equation with step-by-step reveal
interface EquationStepProps {
  steps: string[];
  startFrame?: number;
  framesPerStep?: number;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
}

export const EquationSteps: React.FC<EquationStepProps> = ({
  steps,
  startFrame = 0,
  framesPerStep = 45,
  size = 'large'
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = frame - startFrame;
  const fontSize = sizeMap[size];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24
      }}
    >
      {steps.map((step, index) => {
        const stepStartFrame = index * framesPerStep;
        const stepProgress = adjustedFrame - stepStartFrame;

        if (stepProgress < 0) {
          return null;
        }

        const opacity = interpolate(
          stepProgress,
          [0, 15],
          [0, 1],
          { extrapolateRight: 'clamp' }
        );

        const translateY = interpolate(
          stepProgress,
          [0, 15],
          [20, 0],
          { extrapolateRight: 'clamp' }
        );

        const isCurrentStep = adjustedFrame >= stepStartFrame &&
          (index === steps.length - 1 || adjustedFrame < (index + 1) * framesPerStep);

        return (
          <div
            key={index}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              fontFamily: '"Times New Roman", serif',
              fontSize,
              color: isCurrentStep ? colors.wizdiAction : colors.textPrimary,
              fontWeight: isCurrentStep ? 600 : 400,
              transition: 'color 0.3s ease',
              direction: 'ltr'
            }}
          >
            {step}
          </div>
        );
      })}
    </div>
  );
};

// Number animation (counting up/down)
interface AnimatedNumberProps {
  from: number;
  to: number;
  startFrame?: number;
  duration?: number;
  format?: (n: number) => string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  color?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  from,
  to,
  startFrame = 0,
  duration = 30,
  format = (n) => Math.round(n).toString(),
  size = 'large',
  color = colors.textPrimary
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = frame - startFrame;
  const fontSize = sizeMap[size];

  const value = interpolate(
    adjustedFrame,
    [0, duration],
    [from, to],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <span
      style={{
        fontFamily: '"Rubik", sans-serif',
        fontSize,
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      {format(value)}
    </span>
  );
};

export default MathFormula;
