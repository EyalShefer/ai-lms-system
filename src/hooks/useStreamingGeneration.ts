/**
 * useStreamingGeneration Hook
 *
 * React hook for streaming content generation with real-time UI updates.
 * Provides state management and callbacks for streaming responses.
 */

import { useState, useCallback, useRef } from 'react';
import {
  streamContent,
  streamDifferentiatedContent,
  streamLessonContent,
  streamPodcastContent,
  StreamContentOptions,
  DifferentiatedResult
} from '../services/streamingService';

// ============================================================
// TYPES
// ============================================================

export interface StreamingState {
  isStreaming: boolean;
  progress: string;
  currentLevel?: string;
  currentPart?: string;
  streamedText: string;
  error: string | null;
}

export interface UseStreamingGenerationResult {
  // State
  state: StreamingState;

  // Actions
  startStreaming: (
    prompt: string,
    systemPrompt?: string,
    options?: StreamContentOptions
  ) => Promise<string | any>;

  startDifferentiatedStreaming: (
    options: StreamContentOptions
  ) => Promise<DifferentiatedResult>;

  startLessonStreaming: (
    options: StreamContentOptions & { lessonParts?: string[] }
  ) => Promise<Record<string, any>>;

  startPodcastStreaming: (
    options: StreamContentOptions
  ) => Promise<any>;

  cancelStreaming: () => void;

  // Reset
  resetState: () => void;
}

// ============================================================
// INITIAL STATE
// ============================================================

const initialState: StreamingState = {
  isStreaming: false,
  progress: '',
  currentLevel: undefined,
  currentPart: undefined,
  streamedText: '',
  error: null
};

// ============================================================
// HOOK
// ============================================================

export function useStreamingGeneration(): UseStreamingGenerationResult {
  const [state, setState] = useState<StreamingState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Reset state to initial values
   */
  const resetState = useCallback(() => {
    setState(initialState);
    abortControllerRef.current = null;
  }, []);

  /**
   * Cancel ongoing streaming
   */
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(prev => ({
        ...prev,
        isStreaming: false,
        progress: 'בוטל'
      }));
    }
  }, []);

  /**
   * Start generic content streaming
   */
  const startStreaming = useCallback(async (
    prompt: string,
    systemPrompt?: string,
    options?: StreamContentOptions
  ): Promise<string | any> => {
    resetState();

    setState(prev => ({
      ...prev,
      isStreaming: true,
      progress: 'מתחיל ליצור...'
    }));

    return new Promise(async (resolve, reject) => {
      try {
        let fullContent = '';

        const controller = await streamContent(
          prompt,
          systemPrompt,
          options || {},
          {
            onChunk: (chunk) => {
              fullContent += chunk;
              setState(prev => ({
                ...prev,
                streamedText: fullContent
              }));
            },
            onProgress: (message) => {
              setState(prev => ({
                ...prev,
                progress: message
              }));
            },
            onComplete: (content) => {
              setState(prev => ({
                ...prev,
                isStreaming: false,
                progress: 'הושלם!'
              }));
              resolve(content);
            },
            onError: (error) => {
              setState(prev => ({
                ...prev,
                isStreaming: false,
                error
              }));
              reject(new Error(error));
            }
          }
        );

        abortControllerRef.current = controller;

      } catch (error: any) {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: error.message
        }));
        reject(error);
      }
    });
  }, [resetState]);

  /**
   * Start differentiated content streaming (3 levels)
   */
  const startDifferentiatedStreaming = useCallback(async (
    options: StreamContentOptions
  ): Promise<DifferentiatedResult> => {
    resetState();

    setState(prev => ({
      ...prev,
      isStreaming: true,
      progress: 'מתחיל ליצור תוכן מותאם...'
    }));

    try {
      const { controller, result } = await streamDifferentiatedContent(
        options,
        {
          onChunk: (chunk, metadata) => {
            setState(prev => ({
              ...prev,
              streamedText: prev.streamedText + chunk,
              currentLevel: metadata?.level
            }));
          },
          onProgress: (message, metadata) => {
            setState(prev => ({
              ...prev,
              progress: message,
              currentLevel: metadata?.level
            }));
          },
          onLevelStart: (level) => {
            const levelNames: Record<string, string> = {
              support: 'הבנה',
              core: 'יישום',
              enrichment: 'העמקה'
            };
            setState(prev => ({
              ...prev,
              currentLevel: level,
              progress: `מייצר ${levelNames[level] || level}...`,
              streamedText: '' // Reset for new level
            }));
          },
          onLevelComplete: (level) => {
            const levelNames: Record<string, string> = {
              support: 'הבנה',
              core: 'יישום',
              enrichment: 'העמקה'
            };
            setState(prev => ({
              ...prev,
              progress: `✓ ${levelNames[level] || level} הושלמה`
            }));
          },
          onComplete: () => {
            setState(prev => ({
              ...prev,
              isStreaming: false,
              progress: 'כל הרמות הושלמו!',
              currentLevel: undefined
            }));
          },
          onError: (error) => {
            setState(prev => ({
              ...prev,
              isStreaming: false,
              error
            }));
          }
        }
      );

      abortControllerRef.current = controller;
      return await result;

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error.message
      }));
      throw error;
    }
  }, [resetState]);

  /**
   * Start lesson content streaming
   */
  const startLessonStreaming = useCallback(async (
    options: StreamContentOptions & { lessonParts?: string[] }
  ): Promise<Record<string, any>> => {
    resetState();

    setState(prev => ({
      ...prev,
      isStreaming: true,
      progress: 'מתחיל ליצור מערך שיעור...'
    }));

    try {
      const { controller, result } = await streamLessonContent(
        options,
        {
          onChunk: (chunk, metadata) => {
            setState(prev => ({
              ...prev,
              streamedText: prev.streamedText + chunk,
              currentPart: metadata?.itemType
            }));
          },
          onProgress: (message, metadata) => {
            setState(prev => ({
              ...prev,
              progress: message,
              currentPart: metadata?.itemType
            }));
          },
          onPartStart: (part) => {
            const partNames: Record<string, string> = {
              hook: 'פתיחה',
              instruction: 'הוראה',
              practice: 'תרגול',
              summary: 'סיכום'
            };
            setState(prev => ({
              ...prev,
              currentPart: part,
              progress: `מייצר ${partNames[part] || part}...`,
              streamedText: '' // Reset for new part
            }));
          },
          onPartComplete: (part) => {
            const partNames: Record<string, string> = {
              hook: 'פתיחה',
              instruction: 'הוראה',
              practice: 'תרגול',
              summary: 'סיכום'
            };
            setState(prev => ({
              ...prev,
              progress: `✓ ${partNames[part] || part} הושלם`
            }));
          },
          onComplete: () => {
            setState(prev => ({
              ...prev,
              isStreaming: false,
              progress: 'מערך השיעור הושלם!',
              currentPart: undefined
            }));
          },
          onError: (error) => {
            setState(prev => ({
              ...prev,
              isStreaming: false,
              error
            }));
          }
        }
      );

      abortControllerRef.current = controller;
      return await result;

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error.message
      }));
      throw error;
    }
  }, [resetState]);

  /**
   * Start podcast content streaming
   */
  const startPodcastStreaming = useCallback(async (
    options: StreamContentOptions
  ): Promise<any> => {
    resetState();

    setState(prev => ({
      ...prev,
      isStreaming: true,
      progress: 'מתחיל ליצור פודקאסט...'
    }));

    try {
      const { controller, result } = await streamPodcastContent(
        options,
        {
          onChunk: (chunk) => {
            setState(prev => ({
              ...prev,
              streamedText: prev.streamedText + chunk
            }));
          },
          onProgress: (message) => {
            setState(prev => ({
              ...prev,
              progress: message
            }));
          },
          onComplete: () => {
            setState(prev => ({
              ...prev,
              isStreaming: false,
              progress: 'הפודקאסט הושלם!'
            }));
          },
          onError: (error) => {
            setState(prev => ({
              ...prev,
              isStreaming: false,
              error
            }));
          }
        }
      );

      abortControllerRef.current = controller;
      return await result;

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error.message
      }));
      throw error;
    }
  }, [resetState]);

  return {
    state,
    startStreaming,
    startDifferentiatedStreaming,
    startLessonStreaming,
    startPodcastStreaming,
    cancelStreaming,
    resetState
  };
}
