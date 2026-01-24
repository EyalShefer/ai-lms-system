/**
 * ObjectivesIntro Composition
 * "What you'll learn today" animated opener for lessons
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
import type { ObjectivesIntroProps } from '../types/composition.types';
import '../styles/remotion.css';

export const ObjectivesIntro: React.FC<ObjectivesIntroProps> = ({
  title,
  lessonTitle,
  objectives,
  duration,
  welcomeMessage = 'מה נלמד היום?',
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
  const welcomeEnd = 50;
  const titleEnd = 100;
  const objectivesStart = 100;
  const closingStart = objectivesStart + objectives.length * 35 + 30;

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
        color={brandColors.gold}
        shape="blob"
        position={{ x: 80, y: 20 }}
        size={400}
        animationSpeed={0.6}
      />
      <BackgroundShape
        color={brandColors.secondary}
        shape="gradient"
        position={{ x: 20, y: 80 }}
        size={300}
        animationSpeed={0.4}
      />

      {/* Welcome message */}
      <Scene enterFrame={0} exitFrame={welcomeEnd} enterType="fade" exitType="fade">
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
            🎯
          </div>
          <AnimatedText
            text={welcomeMessage}
            startFrame={10}
            animation="scale"
            fontSize={64}
            fontWeight={700}
            color={brandColors.primary}
          />
        </div>
      </Scene>

      {/* Lesson title */}
      <Scene enterFrame={welcomeEnd} exitFrame={titleEnd} enterType="zoom" exitType="fade">
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
              opacity: interpolate(frame, [welcomeEnd + 5, welcomeEnd + 20], [0, 1], { extrapolateRight: 'clamp' })
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
              📚 השיעור שלנו
            </span>
          </div>
          <AnimatedText
            text={lessonTitle}
            startFrame={welcomeEnd + 15}
            animation="word-by-word"
            fontSize={52}
            fontWeight={700}
            color={textColor}
          />
          {duration && (
            <div
              style={{
                marginTop: 24,
                opacity: interpolate(frame, [welcomeEnd + 30, welcomeEnd + 45], [0, 1], { extrapolateRight: 'clamp' })
              }}
            >
              <span style={{ fontSize: 22, color: brandColors.accent }}>⏱️ {duration}</span>
            </div>
          )}
        </div>
      </Scene>

      {/* Objectives */}
      <Scene enterFrame={objectivesStart} exitFrame={closingStart - 10} enterType="slide-rtl">
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
              opacity: interpolate(frame, [objectivesStart + 5, objectivesStart + 20], [0, 1], {
                extrapolateRight: 'clamp'
              })
            }}
          >
            <span style={{ fontSize: 32, color: brandColors.secondary, fontWeight: 600 }}>
              בסיום השיעור תוכלו: ✨
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {objectives.map((objective, index) => {
              const objStart = objectivesStart + 20 + index * 35;
              const objProgress = frame - objStart;

              if (objProgress < 0) return null;

              const opacity = interpolate(objProgress, [0, 20], [0, 1], {
                extrapolateRight: 'clamp'
              });
              const slideX = interpolate(objProgress, [0, 20], [50, 0], {
                extrapolateRight: 'clamp'
              });

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 20,
                    opacity,
                    transform: `translateX(${slideX}px)`,
                    padding: '18px 24px',
                    backgroundColor: 'white',
                    borderRadius: 16,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    borderRight: `4px solid ${brandColors.gold}`,
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      borderRadius: '50%',
                      backgroundColor: brandColors.gold,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 700
                    }}
                  >
                    {index + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 24,
                      color: textColor,
                      fontWeight: 500,
                      textAlign: 'right',
                      flex: 1,
                      lineHeight: 1.4
                    }}
                  >
                    {objective}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Scene>

      {/* Closing motivation */}
      <Scene enterFrame={closingStart} enterType="zoom">
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
              fontSize: 72,
              marginBottom: 30,
              opacity: interpolate(frame, [closingStart + 5, closingStart + 20], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            🚀
          </div>
          <AnimatedText
            text="בואו נתחיל!"
            startFrame={closingStart + 15}
            animation="scale"
            fontSize={56}
            fontWeight={700}
            color={brandColors.secondary}
          />
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
          backgroundColor: 'rgba(255, 213, 0, 0.2)'
        }}
      >
        <div
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${brandColors.gold}, ${brandColors.secondary})`,
            width: `${(frame / durationInFrames) * 100}%`
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default ObjectivesIntro;
