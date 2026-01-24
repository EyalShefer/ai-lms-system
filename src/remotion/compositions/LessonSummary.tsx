/**
 * LessonSummary Composition
 * Animated lesson summary video with key points
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
import { AnimatedNumber } from '../components/MathFormula';
import { Scene, BackgroundShape } from '../components/Transitions';
import { colors } from '../utils/colors';
import type { LessonSummaryProps } from '../types/composition.types';
import '../styles/remotion.css';

export const LessonSummary: React.FC<LessonSummaryProps> = ({
  title,
  lessonTitle,
  keyPoints,
  nextSteps = [],
  achievements,
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
  const introEnd = 50;
  const keyPointsStart = 50;
  const keyPointsEnd = keyPoints.length * 40 + keyPointsStart + 30;
  const nextStepsStart = keyPointsEnd;
  const achievementsStart = nextSteps.length > 0 ? nextStepsStart + nextSteps.length * 30 + 20 : keyPointsEnd + 20;

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
        color={brandColors.gold}
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
              סיכום השיעור
            </span>
          </div>

          <AnimatedText
            text={lessonTitle}
            startFrame={15}
            animation="scale"
            fontSize={56}
            fontWeight={700}
            color={brandColors.primary}
          />
        </div>
      </Scene>

      {/* Key Points Section */}
      <Scene enterFrame={keyPointsStart} exitFrame={achievementsStart - 20} enterType="slide-rtl">
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
              opacity: interpolate(frame, [keyPointsStart + 5, keyPointsStart + 20], [0, 1], {
                extrapolateRight: 'clamp'
              })
            }}
          >
            <span style={{ fontSize: 32, color: brandColors.secondary, fontWeight: 600 }}>
              נקודות מפתח 🎯
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {keyPoints.map((point, index) => {
              const pointStart = keyPointsStart + 20 + index * 40;
              const pointProgress = frame - pointStart;

              if (pointProgress < 0) return null;

              const opacity = interpolate(pointProgress, [0, 20], [0, 1], {
                extrapolateRight: 'clamp'
              });
              const scale = spring({
                frame: pointProgress,
                fps,
                config: { damping: 12, stiffness: 100 }
              });

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 20,
                    opacity,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    padding: '20px 24px',
                    backgroundColor: 'white',
                    borderRadius: 20,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    borderRight: `4px solid ${brandColors.secondary}`,
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      borderRadius: '50%',
                      backgroundColor: brandColors.secondary,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 700
                    }}
                  >
                    ✓
                  </div>
                  <span style={{
                    fontSize: 24,
                    color: textColor,
                    fontWeight: 500,
                    textAlign: 'right',
                    flex: 1,
                    lineHeight: 1.4
                  }}>
                    {point}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Next Steps */}
          {nextSteps.length > 0 && (
            <div style={{ marginTop: 40, textAlign: 'right' }}>
              <div
                style={{
                  marginBottom: 20,
                  opacity: interpolate(frame, [nextStepsStart, nextStepsStart + 15], [0, 1], {
                    extrapolateRight: 'clamp'
                  })
                }}
              >
                <span style={{ fontSize: 28, color: brandColors.accent, fontWeight: 600 }}>
                  הצעדים הבאים 🚀
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {nextSteps.map((step, index) => {
                  const stepStart = nextStepsStart + 15 + index * 30;
                  const stepProgress = frame - stepStart;

                  if (stepProgress < 0) return null;

                  const opacity = interpolate(stepProgress, [0, 15], [0, 1], {
                    extrapolateRight: 'clamp'
                  });

                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 16,
                        opacity
                      }}
                    >
                      <span style={{ fontSize: 20, color: brandColors.accent }}>←</span>
                      <span style={{ fontSize: 20, color: colors.textSecondary, textAlign: 'right' }}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Scene>

      {/* Achievements Section */}
      {achievements && (
        <Scene enterFrame={achievementsStart} enterType="zoom">
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
                textAlign: 'center'
              }}
            >
              {/* XP Earned */}
              <div style={{ marginBottom: 30 }}>
                <div style={{ fontSize: 24, color: colors.textSecondary, marginBottom: 8 }}>
                  נקודות נסיון שנצברו
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 64, color: brandColors.gold }}>⭐</span>
                  <span style={{ fontSize: 72, fontWeight: 800, color: brandColors.gold }}>
                    <AnimatedNumber
                      from={0}
                      to={achievements.xp}
                      startFrame={achievementsStart + 10}
                      duration={40}
                      size="xlarge"
                      color={brandColors.gold}
                    />
                  </span>
                  <span style={{ fontSize: 32, color: brandColors.gold, fontWeight: 600 }}>XP</span>
                </div>
              </div>

              {/* Badges */}
              {achievements.badges && achievements.badges.length > 0 && (
                <div>
                  <div style={{ fontSize: 20, color: colors.textSecondary, marginBottom: 16 }}>
                    תגים חדשים
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                    {achievements.badges.map((badge, index) => {
                      const badgeStart = achievementsStart + 50 + index * 15;
                      const badgeProgress = frame - badgeStart;

                      const scale = badgeProgress > 0
                        ? spring({ frame: badgeProgress, fps, config: { damping: 10 } })
                        : 0;

                      return (
                        <div
                          key={index}
                          style={{
                            fontSize: 48,
                            transform: `scale(${scale})`
                          }}
                        >
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Celebration */}
            <div
              style={{
                marginTop: 40,
                opacity: interpolate(
                  frame,
                  [achievementsStart + 60, achievementsStart + 80],
                  [0, 1],
                  { extrapolateRight: 'clamp' }
                )
              }}
            >
              <span style={{ fontSize: 36, color: brandColors.secondary, fontWeight: 600 }}>
                כל הכבוד! 🎉
              </span>
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

export default LessonSummary;
