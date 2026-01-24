/**
 * Comparison Composition
 * Side-by-side visual comparison of two items/concepts
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
import type { ComparisonProps } from '../types/composition.types';
import '../styles/remotion.css';

export const Comparison: React.FC<ComparisonProps> = ({
  title,
  comparisonTitle,
  itemA,
  itemB,
  criteria,
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
  const itemsIntroEnd = 120;
  const comparisonStart = 120;
  const criteriaFrames = 50; // frames per criterion
  const summaryStart = comparisonStart + criteria.length * criteriaFrames;

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
        position={{ x: 25, y: 20 }}
        size={300}
        animationSpeed={0.4}
      />
      <BackgroundShape
        color={brandColors.accent}
        shape="blob"
        position={{ x: 75, y: 80 }}
        size={300}
        animationSpeed={0.5}
      />

      {/* Intro with comparison title */}
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
            ⚖️
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
              השוואה
            </span>
          </div>
          <AnimatedText
            text={comparisonTitle}
            startFrame={20}
            animation="scale"
            fontSize={52}
            fontWeight={700}
            color={brandColors.primary}
          />
        </div>
      </Scene>

      {/* Items introduction */}
      <Scene enterFrame={introEnd} exitFrame={itemsIntroEnd} enterType="slide-up" exitType="fade">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 60,
            padding: 60
          }}
        >
          {/* Item A */}
          <div
            style={{
              flex: 1,
              maxWidth: 450,
              backgroundColor: 'white',
              borderRadius: 24,
              padding: 40,
              boxShadow: '0 10px 40px rgba(139, 92, 246, 0.15)',
              textAlign: 'center',
              opacity: interpolate(
                frame,
                [introEnd + 10, introEnd + 30],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              ),
              transform: `translateX(${interpolate(
                frame,
                [introEnd + 10, introEnd + 30],
                [-50, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              )}px)`,
              borderTop: `6px solid ${brandColors.secondary}`
            }}
          >
            {itemA.icon && <div style={{ fontSize: 56, marginBottom: 16 }}>{itemA.icon}</div>}
            <div style={{ fontSize: 32, fontWeight: 700, color: brandColors.secondary, marginBottom: 12 }}>
              {itemA.name}
            </div>
            <div style={{ fontSize: 20, color: colors.textSecondary, lineHeight: 1.5 }}>
              {itemA.description}
            </div>
          </div>

          {/* VS */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: brandColors.gold,
              opacity: interpolate(
                frame,
                [introEnd + 25, introEnd + 40],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              ),
              transform: `scale(${spring({
                frame: frame - (introEnd + 25),
                fps,
                config: { damping: 10 }
              })})`
            }}
          >
            VS
          </div>

          {/* Item B */}
          <div
            style={{
              flex: 1,
              maxWidth: 450,
              backgroundColor: 'white',
              borderRadius: 24,
              padding: 40,
              boxShadow: '0 10px 40px rgba(0, 194, 255, 0.15)',
              textAlign: 'center',
              opacity: interpolate(
                frame,
                [introEnd + 20, introEnd + 40],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              ),
              transform: `translateX(${interpolate(
                frame,
                [introEnd + 20, introEnd + 40],
                [50, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              )}px)`,
              borderTop: `6px solid ${brandColors.accent}`
            }}
          >
            {itemB.icon && <div style={{ fontSize: 56, marginBottom: 16 }}>{itemB.icon}</div>}
            <div style={{ fontSize: 32, fontWeight: 700, color: brandColors.accent, marginBottom: 12 }}>
              {itemB.name}
            </div>
            <div style={{ fontSize: 20, color: colors.textSecondary, lineHeight: 1.5 }}>
              {itemB.description}
            </div>
          </div>
        </div>
      </Scene>

      {/* Criteria comparison */}
      {criteria.map((criterion, index) => {
        const criterionStart = comparisonStart + index * criteriaFrames;
        const criterionEnd = criterionStart + criteriaFrames;

        const valueA = itemA.attributes[criterion] || '-';
        const valueB = itemB.attributes[criterion] || '-';

        return (
          <Scene
            key={index}
            enterFrame={criterionStart}
            exitFrame={criterionEnd}
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
                alignItems: 'center',
                padding: 60
              }}
            >
              {/* Criterion label */}
              <div
                style={{
                  marginBottom: 40,
                  opacity: interpolate(
                    frame,
                    [criterionStart + 5, criterionStart + 20],
                    [0, 1],
                    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                  )
                }}
              >
                <span
                  style={{
                    padding: '12px 32px',
                    backgroundColor: brandColors.gold,
                    color: 'white',
                    borderRadius: 9999,
                    fontSize: 24,
                    fontWeight: 600
                  }}
                >
                  {criterion}
                </span>
              </div>

              {/* Comparison cards */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                  gap: 40,
                  width: '100%',
                  maxWidth: 1200
                }}
              >
                {/* Item A value */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderRadius: 24,
                    padding: '40px 30px',
                    textAlign: 'center',
                    boxShadow: '0 10px 40px rgba(139, 92, 246, 0.1)',
                    borderLeft: `6px solid ${brandColors.secondary}`,
                    opacity: interpolate(
                      frame,
                      [criterionStart + 15, criterionStart + 30],
                      [0, 1],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                    ),
                    transform: `scale(${spring({
                      frame: frame - (criterionStart + 15),
                      fps,
                      config: { damping: 12 }
                    })})`
                  }}
                >
                  <div style={{ fontSize: 20, color: brandColors.secondary, fontWeight: 600, marginBottom: 16 }}>
                    {itemA.icon} {itemA.name}
                  </div>
                  <div style={{ fontSize: 32, color: textColor, fontWeight: 700, lineHeight: 1.4 }}>
                    {valueA}
                  </div>
                </div>

                {/* Item B value */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'white',
                    borderRadius: 24,
                    padding: '40px 30px',
                    textAlign: 'center',
                    boxShadow: '0 10px 40px rgba(0, 194, 255, 0.1)',
                    borderRight: `6px solid ${brandColors.accent}`,
                    opacity: interpolate(
                      frame,
                      [criterionStart + 20, criterionStart + 35],
                      [0, 1],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                    ),
                    transform: `scale(${spring({
                      frame: frame - (criterionStart + 20),
                      fps,
                      config: { damping: 12 }
                    })})`
                  }}
                >
                  <div style={{ fontSize: 20, color: brandColors.accent, fontWeight: 600, marginBottom: 16 }}>
                    {itemB.icon} {itemB.name}
                  </div>
                  <div style={{ fontSize: 32, color: textColor, fontWeight: 700, lineHeight: 1.4 }}>
                    {valueB}
                  </div>
                </div>
              </div>

              {/* Progress dots */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginTop: 40
                }}
              >
                {criteria.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === index ? 32 : 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: i <= index ? brandColors.gold : 'rgba(255, 213, 0, 0.3)'
                    }}
                  />
                ))}
              </div>
            </div>
          </Scene>
        );
      })}

      {/* Summary */}
      <Scene enterFrame={summaryStart} enterType="zoom">
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
              opacity: interpolate(
                frame,
                [summaryStart + 5, summaryStart + 20],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            📊
          </div>
          <AnimatedText
            text="סיכום ההשוואה"
            startFrame={summaryStart + 10}
            animation="scale"
            fontSize={48}
            fontWeight={700}
            color={brandColors.primary}
          />

          {/* Mini summary cards */}
          <div
            style={{
              display: 'flex',
              gap: 40,
              marginTop: 40,
              opacity: interpolate(
                frame,
                [summaryStart + 25, summaryStart + 40],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            <div
              style={{
                padding: '20px 40px',
                backgroundColor: 'white',
                borderRadius: 16,
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ fontSize: 32 }}>{itemA.icon}</div>
              <div style={{ fontSize: 20, color: brandColors.secondary, fontWeight: 600 }}>{itemA.name}</div>
            </div>
            <div style={{ fontSize: 32, color: brandColors.gold, alignSelf: 'center' }}>⚖️</div>
            <div
              style={{
                padding: '20px 40px',
                backgroundColor: 'white',
                borderRadius: 16,
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ fontSize: 32 }}>{itemB.icon}</div>
              <div style={{ fontSize: 20, color: brandColors.accent, fontWeight: 600 }}>{itemB.name}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 30,
              opacity: interpolate(
                frame,
                [summaryStart + 35, summaryStart + 45],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            <span style={{ fontSize: 22, color: colors.textSecondary }}>
              השווינו לפי {criteria.length} קריטריונים
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
          backgroundColor: 'rgba(255, 213, 0, 0.2)'
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

export default Comparison;
