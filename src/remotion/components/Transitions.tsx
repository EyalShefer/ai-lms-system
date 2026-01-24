/**
 * Transition Components for Remotion
 * Scene transitions and effects
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill
} from 'remotion';
import { colors } from '../utils/colors';

export type TransitionType = 'fade' | 'slide-rtl' | 'slide-up' | 'wipe' | 'zoom' | 'blur';

interface TransitionProps {
  type: TransitionType;
  startFrame: number;
  duration?: number;
  direction?: 'in' | 'out';
  children: React.ReactNode;
}

export const Transition: React.FC<TransitionProps> = ({
  type,
  startFrame,
  duration = 30,
  direction = 'in',
  children
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = frame - startFrame;

  const getTransformStyle = (): React.CSSProperties => {
    if (direction === 'in' && progress < 0) {
      return { opacity: 0 };
    }
    if (direction === 'out' && progress < 0) {
      return { opacity: 1 };
    }

    const t = direction === 'in'
      ? interpolate(progress, [0, duration], [0, 1], { extrapolateRight: 'clamp' })
      : interpolate(progress, [0, duration], [1, 0], { extrapolateRight: 'clamp' });

    switch (type) {
      case 'fade':
        return { opacity: t };

      case 'slide-rtl': {
        const x = interpolate(t, [0, 1], [100, 0]);
        return {
          opacity: t,
          transform: `translateX(${direction === 'in' ? x : -x}%)`
        };
      }

      case 'slide-up': {
        const y = interpolate(t, [0, 1], [100, 0]);
        return {
          opacity: t,
          transform: `translateY(${y}%)`
        };
      }

      case 'wipe': {
        return {
          clipPath: `inset(0 ${interpolate(t, [0, 1], [100, 0])}% 0 0)`
        };
      }

      case 'zoom': {
        const scale = interpolate(t, [0, 1], [0.8, 1]);
        return {
          opacity: t,
          transform: `scale(${scale})`
        };
      }

      case 'blur': {
        const blur = interpolate(t, [0, 1], [10, 0]);
        return {
          opacity: t,
          filter: `blur(${blur}px)`
        };
      }

      default:
        return { opacity: 1 };
    }
  };

  return (
    <div style={getTransformStyle()}>
      {children}
    </div>
  );
};

// Scene wrapper with automatic transitions
interface SceneProps {
  enterFrame: number;
  exitFrame?: number;
  enterType?: TransitionType;
  exitType?: TransitionType;
  transitionDuration?: number;
  children: React.ReactNode;
  backgroundColor?: string;
}

export const Scene: React.FC<SceneProps> = ({
  enterFrame,
  exitFrame,
  enterType = 'fade',
  exitType = 'fade',
  transitionDuration = 20,
  children,
  backgroundColor = 'transparent'
}) => {
  const frame = useCurrentFrame();

  // Not yet visible
  if (frame < enterFrame) {
    return null;
  }

  // Already exited
  if (exitFrame && frame > exitFrame + transitionDuration) {
    return null;
  }

  const isEntering = frame < enterFrame + transitionDuration;
  const isExiting = exitFrame && frame >= exitFrame;

  let opacity = 1;
  let transform = 'none';

  if (isEntering) {
    const enterProgress = interpolate(
      frame,
      [enterFrame, enterFrame + transitionDuration],
      [0, 1],
      { extrapolateRight: 'clamp' }
    );
    opacity = enterProgress;
    if (enterType === 'slide-rtl') {
      transform = `translateX(${interpolate(enterProgress, [0, 1], [50, 0])}px)`;
    } else if (enterType === 'slide-up') {
      transform = `translateY(${interpolate(enterProgress, [0, 1], [50, 0])}px)`;
    } else if (enterType === 'zoom') {
      transform = `scale(${interpolate(enterProgress, [0, 1], [0.9, 1])})`;
    }
  }

  if (isExiting && exitFrame) {
    const exitProgress = interpolate(
      frame,
      [exitFrame, exitFrame + transitionDuration],
      [1, 0],
      { extrapolateRight: 'clamp' }
    );
    opacity = exitProgress;
    if (exitType === 'slide-rtl') {
      transform = `translateX(${interpolate(exitProgress, [1, 0], [0, -50])}px)`;
    } else if (exitType === 'slide-up') {
      transform = `translateY(${interpolate(exitProgress, [1, 0], [0, -50])}px)`;
    } else if (exitType === 'zoom') {
      transform = `scale(${interpolate(exitProgress, [1, 0], [1, 1.1])})`;
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor, opacity, transform }}>
      {children}
    </AbsoluteFill>
  );
};

// Animated background shapes
interface BackgroundShapeProps {
  color?: string;
  shape?: 'circle' | 'blob' | 'gradient';
  position?: { x: number; y: number };
  size?: number;
  animationSpeed?: number;
}

export const BackgroundShape: React.FC<BackgroundShapeProps> = ({
  color = colors.wizdiAction,
  shape = 'circle',
  position = { x: 50, y: 50 },
  size = 200,
  animationSpeed = 1
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const floatY = Math.sin((frame / fps) * animationSpeed) * 20;
  const scale = 1 + Math.sin((frame / fps) * animationSpeed * 0.5) * 0.1;

  const shapeStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: `translate(-50%, -50%) translateY(${floatY}px) scale(${scale})`,
    width: size,
    height: size,
    opacity: 0.2,
    filter: 'blur(40px)',
  };

  if (shape === 'circle') {
    return (
      <div
        style={{
          ...shapeStyle,
          borderRadius: '50%',
          background: color,
        }}
      />
    );
  }

  if (shape === 'blob') {
    return (
      <div
        style={{
          ...shapeStyle,
          borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
          background: color,
        }}
      />
    );
  }

  if (shape === 'gradient') {
    return (
      <div
        style={{
          ...shapeStyle,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />
    );
  }

  return null;
};

export default { Transition, Scene, BackgroundShape };
