/**
 * TimelineAnimation Composition
 * Animated timeline for historical events or processes
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
import type { TimelineAnimationProps } from '../types/composition.types';
import '../styles/remotion.css';

export const TimelineAnimation: React.FC<TimelineAnimationProps> = ({
  title,
  events,
  layout = 'horizontal',
  showConnectors = true,
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

  // Calculate frames per event
  const introFrames = 60;
  const outroFrames = 30;
  const eventFrames = (durationInFrames - introFrames - outroFrames) / events.length;

  // Event colors cycle
  const eventColors = [
    brandColors.secondary,
    brandColors.accent,
    brandColors.primary,
    brandColors.gold
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
      {/* Background decorations */}
      <BackgroundShape
        color={brandColors.secondary}
        shape="gradient"
        position={{ x: 10, y: 20 }}
        size={300}
        animationSpeed={0.3}
      />
      <BackgroundShape
        color={brandColors.accent}
        shape="gradient"
        position={{ x: 90, y: 80 }}
        size={250}
        animationSpeed={0.4}
      />

      {/* Title Scene */}
      <Scene enterFrame={0} exitFrame={introFrames} enterType="fade" exitType="fade">
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
          <AnimatedText
            text={title}
            startFrame={10}
            animation="scale"
            fontSize={64}
            fontWeight={700}
            color={brandColors.primary}
          />

          <div
            style={{
              marginTop: 30,
              opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span style={{ fontSize: 28, color: colors.textSecondary }}>
              {events.length} אירועים
            </span>
          </div>
        </div>
      </Scene>

      {/* Timeline Scene */}
      <Scene enterFrame={introFrames} enterType="fade">
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: layout === 'horizontal' ? '60px 40px' : '40px 80px'
          }}
        >
          {layout === 'horizontal' ? (
            // Horizontal timeline
            <div style={{ position: 'relative', width: '100%', height: '60%' }}>
              {/* Timeline line */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 4,
                  backgroundColor: brandColors.background,
                  transform: 'translateY(-50%)'
                }}
              >
                {/* Animated progress */}
                <div
                  style={{
                    height: '100%',
                    backgroundColor: brandColors.secondary,
                    width: `${interpolate(
                      frame,
                      [introFrames, durationInFrames - outroFrames],
                      [0, 100],
                      { extrapolateRight: 'clamp' }
                    )}%`,
                    borderRadius: 4
                  }}
                />
              </div>

              {/* Events */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: '100%',
                  position: 'relative'
                }}
              >
                {events.map((event, index) => {
                  const eventStart = introFrames + index * eventFrames;
                  const eventProgress = frame - eventStart;
                  const color = event.color || eventColors[index % eventColors.length];

                  if (eventProgress < 0) return null;

                  const scale = spring({
                    frame: eventProgress,
                    fps,
                    config: { damping: 12, stiffness: 100 }
                  });

                  const opacity = interpolate(eventProgress, [0, 20], [0, 1], {
                    extrapolateRight: 'clamp'
                  });

                  const isAbove = index % 2 === 0;

                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        opacity,
                        transform: `scale(${scale})`,
                        flex: 1
                      }}
                    >
                      {/* Event card */}
                      <div
                        style={{
                          order: isAbove ? 1 : 3,
                          padding: '16px 20px',
                          backgroundColor: 'white',
                          borderRadius: 16,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          maxWidth: 200,
                          textAlign: 'center',
                          borderTop: `4px solid ${color}`
                        }}
                      >
                        <div style={{ fontSize: 16, color, fontWeight: 600, marginBottom: 4 }}>
                          {event.date}
                        </div>
                        <div style={{ fontSize: 18, color: textColor, fontWeight: 600, marginBottom: 4 }}>
                          {event.title}
                        </div>
                        <div style={{ fontSize: 14, color: colors.textSecondary }}>
                          {event.description}
                        </div>
                      </div>

                      {/* Connector line */}
                      {showConnectors && (
                        <div
                          style={{
                            order: 2,
                            width: 2,
                            height: 40,
                            backgroundColor: color
                          }}
                        />
                      )}

                      {/* Timeline dot */}
                      <div
                        style={{
                          order: isAbove ? 3 : 1,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: color,
                          boxShadow: `0 0 0 4px white, 0 0 0 6px ${color}`
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Vertical timeline
            <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto', width: '100%' }}>
              {/* Timeline line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 30,
                  width: 4,
                  backgroundColor: brandColors.background
                }}
              >
                <div
                  style={{
                    width: '100%',
                    backgroundColor: brandColors.secondary,
                    height: `${interpolate(
                      frame,
                      [introFrames, durationInFrames - outroFrames],
                      [0, 100],
                      { extrapolateRight: 'clamp' }
                    )}%`,
                    borderRadius: 4
                  }}
                />
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40, paddingRight: 60 }}>
                {events.map((event, index) => {
                  const eventStart = introFrames + index * eventFrames;
                  const eventProgress = frame - eventStart;
                  const color = event.color || eventColors[index % eventColors.length];

                  if (eventProgress < 0) return null;

                  const opacity = interpolate(eventProgress, [0, 20], [0, 1], {
                    extrapolateRight: 'clamp'
                  });
                  const translateX = interpolate(eventProgress, [0, 20], [50, 0], {
                    extrapolateRight: 'clamp'
                  });

                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 20,
                        opacity,
                        transform: `translateX(${translateX}px)`,
                        position: 'relative'
                      }}
                    >
                      {/* Timeline dot */}
                      <div
                        style={{
                          position: 'absolute',
                          right: -42,
                          top: 20,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: color,
                          boxShadow: `0 0 0 4px white, 0 0 0 6px ${color}`,
                          zIndex: 1
                        }}
                      />

                      {/* Event card */}
                      <div
                        style={{
                          flex: 1,
                          padding: '20px 24px',
                          backgroundColor: 'white',
                          borderRadius: 20,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          borderRight: `4px solid ${color}`
                        }}
                      >
                        <div style={{ fontSize: 18, color, fontWeight: 600, marginBottom: 8 }}>
                          {event.icon && <span style={{ marginLeft: 8 }}>{event.icon}</span>}
                          {event.date}
                        </div>
                        <div style={{ fontSize: 24, color: textColor, fontWeight: 600, marginBottom: 8 }}>
                          {event.title}
                        </div>
                        <div style={{ fontSize: 18, color: colors.textSecondary, lineHeight: 1.5 }}>
                          {event.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
            backgroundColor: brandColors.secondary,
            width: `${(frame / durationInFrames) * 100}%`
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default TimelineAnimation;
