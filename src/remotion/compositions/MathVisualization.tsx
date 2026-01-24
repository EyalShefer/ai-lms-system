/**
 * MathVisualization Composition
 * Animated mathematical visualizations for education
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring
} from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { MathFormula, EquationSteps, AnimatedNumber } from '../components/MathFormula';
import { Scene, BackgroundShape } from '../components/Transitions';
import { colors } from '../utils/colors';
import type { MathVisualizationProps } from '../types/composition.types';
import '../styles/remotion.css';

export const MathVisualization: React.FC<MathVisualizationProps> = ({
  title,
  operation,
  problem,
  steps,
  finalAnswer,
  direction = 'rtl',
  theme = 'light',
  brandColors = {
    primary: colors.wizdiRoyal,
    secondary: colors.wizdiAction,
    accent: colors.wizdiCyan,
    gold: colors.wizdiGold,
    background: colors.wizdiCloud
  }
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const bgColor = theme === 'light' ? '#ffffff' : '#1a1a2e';
  const textColor = theme === 'light' ? colors.textPrimary : '#ffffff';

  // Operation labels in Hebrew
  const operationLabels: Record<string, string> = {
    'addition': 'חיבור',
    'subtraction': 'חיסור',
    'multiplication': 'כפל',
    'division': 'חילוק',
    'fractions': 'שברים',
    'equations': 'משוואות',
    'geometry': 'גיאומטריה'
  };

  return (
    <AbsoluteFill
      className="remotion-composition"
      style={{
        backgroundColor: bgColor,
        fontFamily: '"Rubik", sans-serif',
        direction
      }}
    >
      {/* Subtle background pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${brandColors.secondary}10 1px, transparent 1px),
            linear-gradient(90deg, ${brandColors.secondary}10 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          opacity: 0.5
        }}
      />

      {/* Header */}
      <Scene enterFrame={0} exitFrame={45} enterType="fade" exitType="fade">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60
          }}
        >
          {/* Operation badge */}
          <div
            style={{
              opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' }),
              transform: `scale(${spring({ frame: frame - 5, fps, config: { damping: 10 } })})`,
              marginBottom: 30
            }}
          >
            <span
              style={{
                padding: '12px 32px',
                backgroundColor: brandColors.secondary,
                color: 'white',
                borderRadius: 9999,
                fontSize: 24,
                fontWeight: 600
              }}
            >
              {operationLabels[operation] || operation}
            </span>
          </div>

          <AnimatedText
            text={title}
            startFrame={15}
            animation="scale"
            fontSize={56}
            fontWeight={700}
            color={brandColors.primary}
          />
        </div>
      </Scene>

      {/* Problem statement */}
      <Scene enterFrame={45} exitFrame={90} enterType="slide-rtl" exitType="fade">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60
          }}
        >
          <div
            style={{
              marginBottom: 20,
              opacity: interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span style={{ fontSize: 28, color: colors.textSecondary }}>
              התרגיל:
            </span>
          </div>

          <div
            style={{
              padding: '40px 80px',
              backgroundColor: brandColors.background,
              borderRadius: 24,
              boxShadow: '0 8px 32px rgba(43, 89, 195, 0.15)'
            }}
          >
            <MathFormula
              formula={problem}
              startFrame={55}
              animation="draw"
              size="xlarge"
              color={brandColors.primary}
            />
          </div>
        </div>
      </Scene>

      {/* Step-by-step solution */}
      <Scene enterFrame={90} exitFrame={durationInFrames - 90} enterType="zoom">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60
          }}
        >
          <div
            style={{
              marginBottom: 40,
              opacity: interpolate(frame, [95, 110], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span style={{ fontSize: 32, color: brandColors.secondary, fontWeight: 600 }}>
              פתרון צעד אחר צעד
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 32,
              maxWidth: 1000,
              width: '100%'
            }}
          >
            {steps.map((step, index) => {
              const stepStartFrame = 110 + index * 60;
              const stepProgress = frame - stepStartFrame;

              if (stepProgress < 0) return null;

              const opacity = interpolate(stepProgress, [0, 20], [0, 1], {
                extrapolateRight: 'clamp'
              });
              const scale = spring({
                frame: stepProgress,
                fps,
                config: { damping: 12, stiffness: 100 }
              });

              const isActive = stepProgress >= 0 && (
                index === steps.length - 1 ||
                frame < stepStartFrame + 60
              );

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    opacity,
                    transform: `scale(${scale})`,
                    padding: 24,
                    backgroundColor: isActive ? 'rgba(139, 92, 246, 0.1)' : 'white',
                    borderRadius: 20,
                    border: `2px solid ${isActive ? brandColors.secondary : 'transparent'}`,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                    direction
                  }}
                >
                  {/* Step number */}
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: isActive ? brandColors.secondary : brandColors.background,
                      color: isActive ? 'white' : brandColors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <MathFormula
                      formula={step.formula}
                      size="large"
                      color={isActive ? brandColors.primary : colors.textPrimary}
                    />
                    <span
                      style={{
                        fontSize: 20,
                        color: colors.textSecondary,
                        direction
                      }}
                    >
                      {step.explanation}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Scene>

      {/* Final answer */}
      <Scene enterFrame={durationInFrames - 90} enterType="zoom">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60
          }}
        >
          <div
            style={{
              padding: '60px 100px',
              backgroundColor: brandColors.secondary,
              borderRadius: 32,
              boxShadow: `0 20px 60px ${brandColors.secondary}40`,
              textAlign: 'center'
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.8)' }}>
                התשובה:
              </span>
            </div>
            <MathFormula
              formula={finalAnswer}
              startFrame={durationInFrames - 80}
              animation="highlight"
              size="xlarge"
              color="white"
              highlightColor={brandColors.gold}
            />
          </div>

          {/* Celebration effect */}
          <div
            style={{
              marginTop: 40,
              opacity: interpolate(
                frame,
                [durationInFrames - 60, durationInFrames - 40],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            <span style={{ fontSize: 48 }}>🎉</span>
          </div>
        </div>
      </Scene>

      {/* Progress indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8
        }}
      >
        {['intro', 'problem', 'solution', 'answer'].map((stage, i) => {
          const stageFrames = [0, 45, 90, durationInFrames - 90];
          const isActive = frame >= stageFrames[i];
          return (
            <div
              key={stage}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: isActive ? brandColors.secondary : brandColors.background,
                transition: 'background-color 0.3s'
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default MathVisualization;
