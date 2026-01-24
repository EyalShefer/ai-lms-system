/**
 * AssignmentSteps Composition
 * Visual step-by-step task instructions for complex assignments
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
import type { AssignmentStepsProps } from '../types/composition.types';
import '../styles/remotion.css';

export const AssignmentSteps: React.FC<AssignmentStepsProps> = ({
  title,
  taskTitle,
  steps,
  dueDate,
  tips = [],
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
  const introEnd = 60;
  const stepsStart = 60;
  const stepsEnd = stepsStart + steps.length * 50 + 30;
  const tipsStart = tips.length > 0 ? stepsEnd : durationInFrames;

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

      {/* Intro with title */}
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
              marginBottom: 20,
              opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' })
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
              📋 הוראות המשימה
            </span>
          </div>

          <AnimatedText
            text={taskTitle}
            startFrame={15}
            animation="scale"
            fontSize={56}
            fontWeight={700}
            color={brandColors.primary}
          />

          {dueDate && (
            <div
              style={{
                marginTop: 30,
                opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: 'clamp' })
              }}
            >
              <span style={{ fontSize: 24, color: brandColors.accent, fontWeight: 500 }}>
                📅 תאריך הגשה: {dueDate}
              </span>
            </div>
          )}
        </div>
      </Scene>

      {/* Steps Section */}
      <Scene enterFrame={stepsStart} exitFrame={tipsStart - 20} enterType="slide-rtl">
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '40px 80px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              marginBottom: 30,
              textAlign: 'right',
              opacity: interpolate(frame, [stepsStart + 5, stepsStart + 20], [0, 1], {
                extrapolateRight: 'clamp'
              })
            }}
          >
            <span style={{ fontSize: 32, color: brandColors.secondary, fontWeight: 600 }}>
              שלבי הביצוע 📝
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map((step, index) => {
              const stepStart = stepsStart + 20 + index * 50;
              const stepProgress = frame - stepStart;

              if (stepProgress < 0) return null;

              const opacity = interpolate(stepProgress, [0, 20], [0, 1], {
                extrapolateRight: 'clamp'
              });
              const scale = spring({
                frame: stepProgress,
                fps,
                config: { damping: 12, stiffness: 100 }
              });

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'flex-start',
                    gap: 20,
                    opacity,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    padding: '16px 20px',
                    backgroundColor: 'white',
                    borderRadius: 16,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    borderRight: `4px solid ${brandColors.secondary}`,
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      minWidth: 48,
                      borderRadius: '50%',
                      backgroundColor: brandColors.secondary,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 700
                    }}
                  >
                    {step.icon || step.number}
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 22, color: textColor, fontWeight: 600, marginBottom: 4 }}>
                      {step.title}
                    </div>
                    <div style={{ fontSize: 18, color: colors.textSecondary, lineHeight: 1.4 }}>
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Scene>

      {/* Tips Section */}
      {tips.length > 0 && (
        <Scene enterFrame={tipsStart} enterType="zoom">
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
                padding: '40px 60px',
                backgroundColor: 'white',
                borderRadius: 32,
                boxShadow: '0 20px 60px rgba(139, 92, 246, 0.2)',
                maxWidth: 900
              }}
            >
              <div style={{ fontSize: 28, color: brandColors.gold, fontWeight: 600, marginBottom: 24, textAlign: 'right' }}>
                💡 טיפים להצלחה
              </div>
              {tips.map((tip, index) => {
                const tipStart = tipsStart + 20 + index * 20;
                const tipOpacity = interpolate(
                  frame,
                  [tipStart, tipStart + 15],
                  [0, 1],
                  { extrapolateRight: 'clamp' }
                );

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 12,
                      opacity: tipOpacity
                    }}
                  >
                    <span style={{ fontSize: 20, color: brandColors.gold }}>⭐</span>
                    <span style={{ fontSize: 20, color: textColor, textAlign: 'right' }}>{tip}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Scene>
      )}

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

export default AssignmentSteps;
