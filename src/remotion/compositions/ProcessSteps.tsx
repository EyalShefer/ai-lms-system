/**
 * ProcessSteps Composition
 * Numbered steps animation for procedures, algorithms, and recipes
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
import { Scene, BackgroundShape } from '../components/Transitions';
import { colors } from '../utils/colors';
import type { ProcessStepsProps } from '../types/composition.types';
import '../styles/remotion.css';

export const ProcessSteps: React.FC<ProcessStepsProps> = ({
  title,
  processTitle,
  description,
  steps,
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

  const bgColor = theme === 'light' ? brandColors.background : '#1a1a2e';
  const textColor = theme === 'light' ? colors.textPrimary : '#ffffff';

  // Scene timing
  const introEnd = 70;
  const stepsStart = 70;
  const stepDuration = 60; // frames per step
  const stepsEnd = stepsStart + steps.length * stepDuration;

  // Color palette for steps
  const stepColors = [
    brandColors.secondary,
    brandColors.accent,
    brandColors.gold,
    brandColors.primary,
    '#FF6B6B', // coral
    '#4ECDC4', // teal
  ];

  return (
    <AbsoluteFill
      className="remotion-composition"
      style={{
        backgroundColor: bgColor,
        fontFamily: '"Rubik", sans-serif',
        direction
      }}
    >
      {/* Animated background */}
      <BackgroundShape
        color={brandColors.secondary}
        shape="blob"
        position={{ x: 85, y: 15 }}
        size={350}
        animationSpeed={0.4}
      />
      <BackgroundShape
        color={brandColors.accent}
        shape="gradient"
        position={{ x: 15, y: 85 }}
        size={280}
        animationSpeed={0.5}
      />

      {/* Intro with process title */}
      <Scene enterFrame={0} exitFrame={introEnd} enterType="fade" exitType="fade">
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
              fontSize: 80,
              marginBottom: 30,
              opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            ⚙️
          </div>
          <div
            style={{
              marginBottom: 20,
              opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span
              style={{
                padding: '10px 24px',
                backgroundColor: brandColors.secondary,
                color: 'white',
                borderRadius: 9999,
                fontSize: 20,
                fontWeight: 600
              }}
            >
              תהליך שלב-אחר-שלב
            </span>
          </div>
          <AnimatedText
            text={processTitle}
            startFrame={20}
            animation="scale"
            fontSize={56}
            fontWeight={700}
            color={brandColors.primary}
          />
          {description && (
            <div
              style={{
                marginTop: 30,
                maxWidth: 800,
                textAlign: 'center',
                opacity: interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' })
              }}
            >
              <span style={{ fontSize: 24, color: colors.textSecondary, lineHeight: 1.5 }}>
                {description}
              </span>
            </div>
          )}
          <div
            style={{
              marginTop: 30,
              opacity: interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span style={{ fontSize: 22, color: brandColors.accent }}>
              {steps.length} שלבים
            </span>
          </div>
        </div>
      </Scene>

      {/* Steps - one at a time with animation */}
      {steps.map((step, index) => {
        const stepStart = stepsStart + index * stepDuration;
        const stepEnd = stepStart + stepDuration;
        const stepColor = stepColors[index % stepColors.length];

        return (
          <Scene
            key={index}
            enterFrame={stepStart}
            exitFrame={stepEnd}
            enterType="slide-rtl"
            exitType="fade"
          >
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
              {/* Progress indicator */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginBottom: 40,
                  opacity: interpolate(
                    frame,
                    [stepStart + 5, stepStart + 15],
                    [0, 1],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                  )
                }}
              >
                {steps.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === index ? 40 : 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: i <= index ? stepColor : 'rgba(139, 92, 246, 0.2)',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </div>

              {/* Step card */}
              <div
                style={{
                  width: '85%',
                  maxWidth: 1000,
                  backgroundColor: 'white',
                  borderRadius: 32,
                  boxShadow: '0 20px 60px rgba(139, 92, 246, 0.15)',
                  overflow: 'hidden',
                  transform: `scale(${spring({
                    frame: frame - stepStart,
                    fps,
                    config: { damping: 12, stiffness: 100 }
                  })})`,
                  transformOrigin: 'center center'
                }}
              >
                {/* Step number header */}
                <div
                  style={{
                    background: stepColor,
                    padding: '24px 40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                      fontWeight: 800,
                      color: 'white'
                    }}
                  >
                    {step.icon || step.number}
                  </div>
                  <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                    שלב {step.number} מתוך {steps.length}
                  </span>
                </div>

                {/* Step content */}
                <div style={{ padding: '40px 50px', textAlign: 'center' }}>
                  <div
                    style={{
                      opacity: interpolate(
                        frame,
                        [stepStart + 15, stepStart + 30],
                        [0, 1],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                      )
                    }}
                  >
                    <div
                      style={{
                        fontSize: 40,
                        fontWeight: 700,
                        color: textColor,
                        marginBottom: 20
                      }}
                    >
                      {step.title}
                    </div>
                  </div>

                  <div
                    style={{
                      opacity: interpolate(
                        frame,
                        [stepStart + 25, stepStart + 40],
                        [0, 1],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                      )
                    }}
                  >
                    <div
                      style={{
                        fontSize: 26,
                        color: colors.textSecondary,
                        lineHeight: 1.6
                      }}
                    >
                      {step.detail}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Scene>
        );
      })}

      {/* Completion */}
      <Scene enterFrame={stepsEnd} enterType="zoom">
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
              fontSize: 80,
              marginBottom: 30,
              opacity: interpolate(
                frame,
                [stepsEnd + 5, stepsEnd + 20],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            ✅
          </div>
          <AnimatedText
            text="סיימנו!"
            startFrame={stepsEnd + 10}
            animation="scale"
            fontSize={56}
            fontWeight={700}
            color={brandColors.secondary}
          />
          <div
            style={{
              marginTop: 24,
              opacity: interpolate(
                frame,
                [stepsEnd + 25, stepsEnd + 35],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            <span style={{ fontSize: 24, color: colors.textSecondary }}>
              השלמת את כל {steps.length} השלבים
            </span>
          </div>
        </div>
      </Scene>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: 'rgba(139, 92, 246, 0.2)'
        }}
      >
        <div
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${brandColors.secondary}, ${brandColors.accent})`,
            width: `${(frame / durationInFrames) * 100}%`
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default ProcessSteps;
