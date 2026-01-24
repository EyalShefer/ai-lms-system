/**
 * VocabularyFlashcards Composition
 * Animated term definitions with visuals for vocabulary learning
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
import type { VocabularyProps } from '../types/composition.types';
import '../styles/remotion.css';

export const VocabularyFlashcards: React.FC<VocabularyProps> = ({
  title,
  topic,
  words,
  showExamples = true,
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

  // Calculate frames per word - each word gets equal time after intro
  const introFrames = 60;
  const outroFrames = 40;
  const wordFrames = Math.floor((durationInFrames - introFrames - outroFrames) / words.length);

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
        color={brandColors.accent}
        shape="blob"
        position={{ x: 85, y: 20 }}
        size={350}
        animationSpeed={0.5}
      />
      <BackgroundShape
        color={brandColors.secondary}
        shape="gradient"
        position={{ x: 15, y: 80 }}
        size={300}
        animationSpeed={0.6}
      />

      {/* Intro with topic */}
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
          <div
            style={{
              fontSize: 80,
              marginBottom: 30,
              opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            📖
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
                backgroundColor: brandColors.accent,
                color: 'white',
                borderRadius: 9999,
                fontSize: 20,
                fontWeight: 600
              }}
            >
              מילון מונחים
            </span>
          </div>
          <AnimatedText
            text={topic}
            startFrame={20}
            animation="scale"
            fontSize={56}
            fontWeight={700}
            color={brandColors.primary}
          />
          <div
            style={{
              marginTop: 30,
              opacity: interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' })
            }}
          >
            <span style={{ fontSize: 24, color: colors.textSecondary }}>
              {words.length} מונחים חדשים
            </span>
          </div>
        </div>
      </Scene>

      {/* Vocabulary cards - one at a time */}
      {words.map((word, index) => {
        const wordStart = introFrames + index * wordFrames;
        const wordEnd = wordStart + wordFrames;

        return (
          <Scene
            key={index}
            enterFrame={wordStart}
            exitFrame={wordEnd}
            enterType="zoom"
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
              {/* Card */}
              <div
                style={{
                  width: '80%',
                  maxWidth: 900,
                  backgroundColor: 'white',
                  borderRadius: 32,
                  boxShadow: '0 20px 60px rgba(139, 92, 246, 0.15)',
                  overflow: 'hidden'
                }}
              >
                {/* Term header */}
                <div
                  style={{
                    background: `linear-gradient(135deg, ${brandColors.secondary}, ${brandColors.accent})`,
                    padding: '30px 40px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>
                    מונח {index + 1} מתוך {words.length}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 16
                    }}
                  >
                    {word.icon && <span style={{ fontSize: 48 }}>{word.icon}</span>}
                    <span
                      style={{
                        fontSize: 48,
                        fontWeight: 700,
                        color: 'white'
                      }}
                    >
                      {word.term}
                    </span>
                  </div>
                </div>

                {/* Definition */}
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div
                    style={{
                      opacity: interpolate(
                        frame,
                        [wordStart + 20, wordStart + 35],
                        [0, 1],
                        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                      )
                    }}
                  >
                    <div style={{ fontSize: 18, color: brandColors.secondary, marginBottom: 12, fontWeight: 600 }}>
                      הגדרה
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        color: textColor,
                        lineHeight: 1.5,
                        fontWeight: 500
                      }}
                    >
                      {word.definition}
                    </div>
                  </div>

                  {/* Example */}
                  {showExamples && word.example && (
                    <div
                      style={{
                        marginTop: 30,
                        padding: '20px 24px',
                        backgroundColor: 'rgba(139, 92, 246, 0.08)',
                        borderRadius: 16,
                        opacity: interpolate(
                          frame,
                          [wordStart + 40, wordStart + 55],
                          [0, 1],
                          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
                        )
                      }}
                    >
                      <div style={{ fontSize: 16, color: brandColors.accent, marginBottom: 8, fontWeight: 600 }}>
                        💡 דוגמה
                      </div>
                      <div style={{ fontSize: 22, color: colors.textSecondary, fontStyle: 'italic' }}>
                        "{word.example}"
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Scene>
        );
      })}

      {/* Outro */}
      <Scene enterFrame={durationInFrames - outroFrames} enterType="zoom">
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
                [durationInFrames - outroFrames + 10, durationInFrames - outroFrames + 25],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            🎉
          </div>
          <AnimatedText
            text="כל הכבוד!"
            startFrame={durationInFrames - outroFrames + 15}
            animation="scale"
            fontSize={48}
            fontWeight={700}
            color={brandColors.secondary}
          />
          <div
            style={{
              marginTop: 24,
              opacity: interpolate(
                frame,
                [durationInFrames - outroFrames + 25, durationInFrames - outroFrames + 35],
                [0, 1],
                { extrapolateRight: 'clamp' }
              )
            }}
          >
            <span style={{ fontSize: 24, color: colors.textSecondary }}>
              למדתם {words.length} מונחים חדשים!
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
          backgroundColor: 'rgba(0, 194, 255, 0.2)'
        }}
      >
        <div
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${brandColors.accent}, ${brandColors.secondary})`,
            width: `${(frame / durationInFrames) * 100}%`
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default VocabularyFlashcards;
