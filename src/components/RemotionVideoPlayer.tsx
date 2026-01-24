/**
 * RemotionVideoPlayer Component
 * Plays Remotion-generated videos with preview and render progress support
 */

import React, { useState, useEffect, lazy, Suspense, Component, ErrorInfo } from 'react';
import { Player } from '@remotion/player';
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconRefresh,
  IconLoader2,
  IconAlertCircle,
  IconMaximize,
  IconVolume,
  IconVolumeOff
} from '@tabler/icons-react';
import { pollRenderProgress, COMPOSITION_LABELS } from '../services/remotionService';
import type { RemotionVideoContent, RemotionCompositionType } from '../shared/types/courseTypes';

// Error Boundary for catching render errors
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class PlayerErrorBoundary extends Component<{ children: React.ReactNode; onError?: (error: string) => void }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode; onError?: (error: string) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Remotion Player Error:', error, errorInfo);
    this.props.onError?.(error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="aspect-video bg-gradient-to-br from-red-50 to-orange-50 flex flex-col items-center justify-center gap-4 rounded-2xl" dir="rtl">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <IconAlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-700">שגיאה בטעינת הסרטון</p>
            <p className="text-sm text-red-600 mt-1 max-w-xs">{this.state.error?.message}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <IconRefresh className="w-4 h-4" />
            נסה שוב
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load compositions for code splitting
const ExplainerVideo = lazy(() => import('../remotion/compositions/ExplainerVideo'));
const MathVisualization = lazy(() => import('../remotion/compositions/MathVisualization'));
const TimelineAnimation = lazy(() => import('../remotion/compositions/TimelineAnimation'));
const LessonSummary = lazy(() => import('../remotion/compositions/LessonSummary'));
// New compositions
const AssignmentSteps = lazy(() => import('../remotion/compositions/AssignmentSteps'));
const ObjectivesIntro = lazy(() => import('../remotion/compositions/ObjectivesIntro'));
const VocabularyFlashcards = lazy(() => import('../remotion/compositions/VocabularyFlashcards'));
const ProcessSteps = lazy(() => import('../remotion/compositions/ProcessSteps'));
const Comparison = lazy(() => import('../remotion/compositions/Comparison'));

// Composition component map
const compositionComponents: Record<RemotionCompositionType, React.LazyExoticComponent<React.FC<any>>> = {
  'explainer': ExplainerVideo,
  'math-visualization': MathVisualization,
  'timeline': TimelineAnimation,
  'lesson-summary': LessonSummary,
  'quiz-intro': ExplainerVideo, // Fallback
  // New compositions
  'assignment-steps': AssignmentSteps,
  'objectives-intro': ObjectivesIntro,
  'vocabulary': VocabularyFlashcards,
  'process-steps': ProcessSteps,
  'comparison': Comparison
};

// Duration in frames (30fps)
const compositionFrames: Record<RemotionCompositionType, number> = {
  'explainer': 300,
  'math-visualization': 450,
  'timeline': 600,
  'lesson-summary': 300,
  'quiz-intro': 150,
  // New compositions
  'assignment-steps': 360,
  'objectives-intro': 240,
  'vocabulary': 450,
  'process-steps': 360,
  'comparison': 450
};

interface RemotionVideoPlayerProps {
  content: RemotionVideoContent;
  onRenderComplete?: (videoUrl: string) => void;
  onError?: (error: string) => void;
  className?: string;
  showControls?: boolean;
  autoPlay?: boolean;
}

export const RemotionVideoPlayer: React.FC<RemotionVideoPlayerProps> = ({
  content,
  onRenderComplete,
  onError,
  className = '',
  showControls = true,
  autoPlay = false
}) => {
  const [currentStatus, setCurrentStatus] = useState(content.status);
  const [renderProgress, setRenderProgress] = useState(content.renderProgress || 0);
  const [videoUrl, setVideoUrl] = useState(content.videoUrl);
  const [error, setError] = useState(content.error);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const compositionInfo = COMPOSITION_LABELS[content.compositionType];
  const Composition = compositionComponents[content.compositionType];
  const durationInFrames = compositionFrames[content.compositionType];

  // Check if we have valid props for preview
  const hasValidProps = content.props && Object.keys(content.props).length > 0;

  // Poll for render progress if rendering
  useEffect(() => {
    if (currentStatus === 'rendering' && content.jobId) {
      pollRenderProgress(
        content.jobId,
        (progress, status) => {
          setRenderProgress(progress);
          setCurrentStatus(status);
        }
      ).then(result => {
        if (result.videoUrl) {
          setVideoUrl(result.videoUrl);
          setCurrentStatus('ready');
          onRenderComplete?.(result.videoUrl);
        }
      }).catch(err => {
        setError(err.message);
        setCurrentStatus('error');
        onError?.(err.message);
      });
    }
  }, [content.jobId, currentStatus]);

  // Sync with prop changes
  useEffect(() => {
    setCurrentStatus(content.status);
    setVideoUrl(content.videoUrl);
    setError(content.error);
    setRenderProgress(content.renderProgress || 0);
  }, [content]);

  // Debug logging
  useEffect(() => {
    console.log('RemotionVideoPlayer state:', {
      status: currentStatus,
      hasValidProps,
      compositionType: content.compositionType,
      props: content.props
    });
  }, [currentStatus, hasValidProps, content.compositionType, content.props]);

  // If video is ready and has URL, show native video player
  if (currentStatus === 'ready' && videoUrl) {
    return (
      <div
        className={`relative rounded-2xl overflow-hidden shadow-lg bg-black ${className}`}
        dir="rtl"
      >
        <video
          src={videoUrl}
          controls={showControls}
          autoPlay={autoPlay}
          className="w-full aspect-video"
          poster={content.thumbnailUrl}
        />

        {/* Type badge */}
        <div className="absolute top-4 right-4">
          <span className="px-3 py-1.5 bg-violet-500/90 text-white text-sm font-medium rounded-full flex items-center gap-1.5">
            <span>{compositionInfo.icon}</span>
            <span>{compositionInfo.label}</span>
          </span>
        </div>
      </div>
    );
  }

  // If error, show error state
  if (currentStatus === 'error') {
    return (
      <div
        className={`relative rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 aspect-video flex flex-col items-center justify-center gap-4 ${className}`}
        dir="rtl"
      >
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <IconAlertCircle className="w-8 h-8 text-red-500" />
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-red-700">שגיאה ביצירת הסרטון</p>
          {error && (
            <p className="text-sm text-red-600 mt-1 max-w-xs">{error}</p>
          )}
        </div>

        <button
          onClick={() => {
            setCurrentStatus('pending');
            setError(undefined);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          <IconRefresh className="w-4 h-4" />
          נסה שוב
        </button>
      </div>
    );
  }

  // If rendering on server, show progress
  if (currentStatus === 'rendering') {
    return (
      <div
        className={`relative rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 aspect-video flex flex-col items-center justify-center gap-4 ${className}`}
        dir="rtl"
      >
        {/* Animated loader */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-violet-200 flex items-center justify-center">
            <IconLoader2 className="w-10 h-10 text-violet-500 animate-spin" />
          </div>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, #8B5CF6 ${renderProgress}%, transparent ${renderProgress}%)`,
              opacity: 0.3
            }}
          />
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-lg font-bold text-violet-700">יוצר את הסרטון...</p>
          <p className="text-sm text-violet-600 mt-1">
            {compositionInfo.icon} {compositionInfo.label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64">
          <div className="h-3 bg-violet-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500 rounded-full"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <p className="text-center text-sm text-violet-600 mt-2 font-medium">
            {renderProgress}%
          </p>
        </div>
      </div>
    );
  }

  // If pending without props, show waiting state
  if (currentStatus === 'pending' && !hasValidProps) {
    return (
      <div
        className={`relative rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 aspect-video flex flex-col items-center justify-center gap-4 ${className}`}
        dir="rtl"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-violet-200 flex items-center justify-center">
            <IconLoader2 className="w-10 h-10 text-violet-500 animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-violet-700">מתכונן ליצירת הסרטון...</p>
          <p className="text-sm text-violet-600 mt-1">
            {compositionInfo.icon} {compositionInfo.label}
          </p>
        </div>
      </div>
    );
  }

  // Preview mode - use Remotion Player for live preview
  // This is for pending status WITH valid props, or any other non-error state with props
  return (
    <div
      className={`relative rounded-2xl overflow-hidden shadow-lg ${className}`}
      dir="rtl"
    >
      <PlayerErrorBoundary onError={onError}>
        <Suspense
          fallback={
            <div className="aspect-video bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
              <IconLoader2 className="w-10 h-10 text-violet-500 animate-spin" />
            </div>
          }
        >
          <Player
            component={Composition}
            inputProps={content.props as any}
            durationInFrames={durationInFrames}
            compositionWidth={1920}
            compositionHeight={1080}
            fps={30}
            style={{
              width: '100%',
              aspectRatio: '16/9'
            }}
            controls={showControls}
            loop
            autoPlay={autoPlay}
          />
        </Suspense>
      </PlayerErrorBoundary>

      {/* Preview badge */}
      <div className="absolute top-4 right-4 flex gap-2">
        <span className="px-3 py-1.5 bg-violet-500/90 text-white text-sm font-medium rounded-full flex items-center gap-1.5">
          <span>{compositionInfo.icon}</span>
          <span>{compositionInfo.label}</span>
        </span>
        <span className="px-3 py-1.5 bg-amber-500/90 text-white text-sm font-medium rounded-full">
          תצוגה מקדימה
        </span>
      </div>
    </div>
  );
};

// Simple video player for already-rendered videos
interface SimpleVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  title?: string;
  className?: string;
}

export const SimpleVideoPlayer: React.FC<SimpleVideoPlayerProps> = ({
  videoUrl,
  thumbnailUrl,
  title,
  className = ''
}) => {
  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-lg bg-black ${className}`}>
      <video
        src={videoUrl}
        controls
        poster={thumbnailUrl}
        className="w-full aspect-video"
        title={title}
      />
      {title && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white font-medium text-right">{title}</p>
        </div>
      )}
    </div>
  );
};

export default RemotionVideoPlayer;
