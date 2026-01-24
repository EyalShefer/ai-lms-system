/**
 * ExplainerVideo Composition
 * Animated explainer video for educational concepts
 */

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence
} from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { Scene, BackgroundShape } from '../components/Transitions';
import { colors } from '../utils/colors';
import type { ExplainerVideoProps } from '../types/composition.types';
import '../styles/remotion.css';

export const ExplainerVideo: React.FC<ExplainerVideoProps> = ({
  title,
  concept,
  explanation,
  examples,
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

  return (
    <AbsoluteFill
      className="remotion-composition remotion-rtl"
      style={{
        backgroundColor: bgColor,
        direction,
        fontFamily: '"Rubik", sans-serif'
      }}
    >
      {/* Animated background shapes */}
      <BackgroundShape
        color={brandColors.secondary}
        shape="blob"
        position={{ x: 80, y: 20 }}
        size={400}
        animationSpeed={0.5}
      />
      <BackgroundShape
        color={brandColors.accent}
        shape="gradient"
        position={{ x: 20, y: 80 }}
        size={300}
        animationSpeed={0.7}
      />

      {/* Scene 1: Title */}
      <Scene
        enterFrame={0}
        exitFrame={60}
        enterType="fade"
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
            padding: 80
          }}
        >
          <AnimatedText
            text={title}
            startFrame={10}
            animation="scale"
            fontSize={72}
            fontWeight={700}
            color={brandColors.primary}
            duration={30}
          />
        </div>
      </Scene>

      {/* Scene 2: Concept */}
      <Scene
        enterFrame={60}
        exitFrame={150}
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
            padding: 80
          }}
        >
          <div
            style={{
              marginBottom: 40,
              opacity: interpolate(frame, [70, 90], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span
              style={{
                fontSize: 24,
                color: brandColors.secondary,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}
            >
              המושג המרכזי
            </span>
          </div>

          <AnimatedText
            text={concept}
            startFrame={80}
            animation="word-by-word"
            fontSize={56}
            fontWeight={600}
            color={textColor}
            duration={60}
          />
        </div>
      </Scene>

      {/* Scene 3: Explanation */}
      <Scene
        enterFrame={150}
        exitFrame={240}
        enterType="slide-up"
        exitType="fade"
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: 80
          }}
        >
          <div
            className="remotion-card"
            style={{
              maxWidth: 1200,
              margin: '0 auto'
            }}
          >
            <AnimatedText
              text={explanation}
              startFrame={160}
              animation="fade"
              fontSize={36}
              fontWeight={400}
              color={textColor}
              duration={40}
              style={{ lineHeight: 1.6 }}
            />
          </div>
        </div>
      </Scene>

      {/* Scene 4: Examples */}
      <Scene
        enterFrame={240}
        enterType="zoom"
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: 80
          }}
        >
          <div
            style={{
              marginBottom: 40,
              opacity: interpolate(frame, [250, 270], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span
              style={{
                fontSize: 32,
                color: brandColors.secondary,
                fontWeight: 600
              }}
            >
              דוגמאות
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {examples.map((example, index) => {
              const itemStartFrame = 260 + index * 30;
              const itemProgress = frame - itemStartFrame;

              if (itemProgress < 0) return null;

              const opacity = interpolate(itemProgress, [0, 20], [0, 1], {
                extrapolateRight: 'clamp'
              });
              const translateX = interpolate(itemProgress, [0, 20], [50, 0], {
                extrapolateRight: 'clamp'
              });

              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    opacity,
                    transform: `translateX(${translateX}px)`,
                    padding: '16px 24px',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: 16,
                    borderRight: `4px solid ${brandColors.secondary}`
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: brandColors.secondary,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      fontWeight: 700,
                      flexShrink: 0
                    }}
                  >
                    {index + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 28,
                      color: textColor,
                      fontWeight: 400
                    }}
                  >
                    {example}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Scene>

      {/* Progress bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: 'rgba(139, 92, 246, 0.2)'
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: brandColors.secondary,
            width: `${(frame / durationInFrames) * 100}%`,
            transition: 'width 0.1s linear'
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default ExplainerVideo;
