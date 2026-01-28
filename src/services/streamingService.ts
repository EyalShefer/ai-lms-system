/**
 * Streaming Service - Client-side SSE handler
 *
 * This service connects to the Cloud Run streaming server
 * and provides real-time content updates to the UI.
 *
 * Features:
 * - EventSource-based SSE connection
 * - Automatic reconnection on failure
 * - Progress callbacks for UI updates
 * - JSON parsing for structured content
 * - Support for differentiated content levels
 */

import { auth, getAppCheckToken } from '../firebase';

// ============================================================
// CONFIGURATION
// ============================================================

// Always use production URL (local emulator not typically used for streaming)
const STREAMING_BASE_URL = 'https://us-central1-ai-lms-pro.cloudfunctions.net/streamingServer';

// ============================================================
// TYPES
// ============================================================

export interface StreamChunk {
  type: 'text' | 'json_partial' | 'json_complete' | 'error' | 'done' | 'progress';
  content: string;
  metadata?: {
    chunkIndex?: number;
    totalExpected?: number;
    itemType?: string;
    level?: string;
  };
}

export interface StreamCallbacks {
  onChunk?: (chunk: string, metadata?: StreamChunk['metadata']) => void;
  onProgress?: (message: string, metadata?: StreamChunk['metadata']) => void;
  onLevelStart?: (level: string) => void;
  onLevelComplete?: (level: string, content: any) => void;
  onPartStart?: (part: string) => void;
  onPartComplete?: (part: string, content: any) => void;
  onComplete?: (fullContent: string | any) => void;
  onError?: (error: string) => void;
}

export interface DifferentiatedResult {
  support: any[];
  core: any[];
  enrichment: any[];
}

export interface StreamContentOptions {
  temperature?: number;
  maxTokens?: number;
  gradeLevel?: string;
  subject?: string;
  topic?: string;
  isDifferentiated?: boolean;
  activityLength?: string;
  sourceText?: string;
  productType?: string;
  questionPreferences?: any;
  contentTone?: 'friendly' | 'professional' | 'playful' | 'neutral';
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get Firebase auth token for API calls
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.getIdToken();
}

/**
 * Get headers with both Auth and App Check tokens
 */
async function getSecureHeaders(): Promise<Record<string, string>> {
  const authToken = await getAuthToken();
  const appCheckToken = await getAppCheckToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  };

  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  return headers;
}

/**
 * Parse SSE data line
 */
function parseSSEData(line: string): StreamChunk | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  try {
    const jsonStr = line.slice(6); // Remove 'data: ' prefix
    return JSON.parse(jsonStr) as StreamChunk;
  } catch (e) {
    console.warn('Failed to parse SSE data:', line);
    return null;
  }
}

// ============================================================
// STREAMING FUNCTIONS
// ============================================================

/**
 * Stream generic content from the server
 *
 * @param prompt - The prompt to send
 * @param systemPrompt - Optional system prompt
 * @param options - Generation options
 * @param callbacks - Callbacks for streaming events
 * @returns AbortController to cancel the stream
 */
export async function streamContent(
  prompt: string,
  systemPrompt: string | undefined,
  options: StreamContentOptions,
  callbacks: StreamCallbacks
): Promise<AbortController> {
  const headers = await getSecureHeaders();
  const controller = new AbortController();

  const response = await fetch(`${STREAMING_BASE_URL}/stream/content`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: options.productType || 'activity',
      prompt,
      systemPrompt,
      options
    }),
    signal: controller.signal
  });

  if (!response.ok) {
    const error = await response.text();
    callbacks.onError?.(error);
    throw new Error(error);
  }

  // Process the stream
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Event type line - skip, we handle data lines
            continue;
          }

          const chunk = parseSSEData(line);
          if (!chunk) continue;

          switch (chunk.type) {
            case 'text':
              fullContent += chunk.content;
              callbacks.onChunk?.(chunk.content, chunk.metadata);
              break;

            case 'progress':
              callbacks.onProgress?.(chunk.content, chunk.metadata);
              break;

            case 'json_complete':
              try {
                const parsed = JSON.parse(chunk.content);
                callbacks.onComplete?.(parsed);
              } catch (e) {
                callbacks.onComplete?.(chunk.content);
              }
              break;

            case 'done':
              callbacks.onComplete?.(fullContent);
              break;

            case 'error':
              callbacks.onError?.(chunk.content);
              break;
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        callbacks.onError?.(error.message || 'Stream failed');
      }
    }
  })();

  return controller;
}

/**
 * Stream differentiated content (3 levels)
 *
 * This function streams content for support, core, and enrichment levels
 * one at a time, providing callbacks as each level completes.
 *
 * @param options - Generation options
 * @param callbacks - Callbacks for streaming events
 * @returns AbortController and a promise that resolves with the full result
 */
export async function streamDifferentiatedContent(
  options: StreamContentOptions,
  callbacks: StreamCallbacks
): Promise<{ controller: AbortController; result: Promise<DifferentiatedResult> }> {
  const headers = await getSecureHeaders();
  const controller = new AbortController();

  const result = new Promise<DifferentiatedResult>(async (resolve, reject) => {
    try {
      const response = await fetch(`${STREAMING_BASE_URL}/stream/differentiated`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: options.topic,
          gradeLevel: options.gradeLevel,
          subject: options.subject,
          sourceText: options.sourceText,
          productType: options.productType,
          activityLength: options.activityLength,
          questionPreferences: options.questionPreferences
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.text();
        callbacks.onError?.(error);
        reject(new Error(error));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error('No response body'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const levels: DifferentiatedResult = {
        support: [],
        core: [],
        enrichment: []
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();

            // Get the next data line
            const dataLineIndex = lines.indexOf(line) + 1;
            if (dataLineIndex < lines.length) {
              const dataLine = lines[dataLineIndex];
              const chunk = parseSSEData(dataLine);
              if (!chunk) continue;

              switch (eventType) {
                case 'level_start':
                  callbacks.onLevelStart?.(chunk.metadata?.level || '');
                  callbacks.onProgress?.(chunk.content, chunk.metadata);
                  break;

                case 'level_complete':
                  const level = chunk.metadata?.level as keyof DifferentiatedResult;
                  if (level && levels[level] !== undefined) {
                    try {
                      const parsed = JSON.parse(chunk.content);
                      // Handle new format (with steps array) or old format (direct array)
                      if (parsed.steps && Array.isArray(parsed.steps)) {
                        // New format: extract steps array from the full result object
                        levels[level] = parsed.steps;
                      } else if (Array.isArray(parsed)) {
                        // Old format: direct array of items
                        levels[level] = parsed;
                      } else {
                        // Fallback: wrap single object in array
                        levels[level] = [parsed];
                      }
                    } catch (e) {
                      levels[level] = [];
                    }
                    callbacks.onLevelComplete?.(level, levels[level]);
                  }
                  break;

                case 'chunk':
                  callbacks.onChunk?.(chunk.content, chunk.metadata);
                  break;

                case 'done':
                  callbacks.onComplete?.(levels);
                  resolve(levels);
                  return;

                case 'error':
                  callbacks.onError?.(chunk.content);
                  reject(new Error(chunk.content));
                  return;
              }
            }
            continue;
          }

          // Handle data lines that don't follow an event line
          const chunk = parseSSEData(line);
          if (!chunk) continue;

          if (chunk.type === 'text') {
            callbacks.onChunk?.(chunk.content, chunk.metadata);
          } else if (chunk.type === 'done') {
            callbacks.onComplete?.(levels);
            resolve(levels);
            return;
          } else if (chunk.type === 'error') {
            callbacks.onError?.(chunk.content);
            reject(new Error(chunk.content));
            return;
          }
        }
      }

      // If we got here without resolving, return what we have
      resolve(levels);

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        callbacks.onError?.(error.message || 'Stream failed');
        reject(error);
      }
    }
  });

  return { controller, result };
}

/**
 * Stream lesson plan content
 *
 * Streams lesson parts (hook, instruction, practice, summary) one at a time
 *
 * @param options - Generation options
 * @param callbacks - Callbacks for streaming events
 * @returns AbortController and a promise that resolves with the full lesson
 */
/**
 * Extended callbacks for lesson streaming
 */
export interface LessonStreamCallbacks extends StreamCallbacks {
  onPart1Ready?: (part1: any) => void;
  onPart2Ready?: (part2: any) => void;
}

export async function streamLessonContent(
  options: StreamContentOptions & { lessonParts?: string[]; sourceType?: string },
  callbacks: LessonStreamCallbacks
): Promise<{ controller: AbortController; result: Promise<Record<string, any>> }> {
  const headers = await getSecureHeaders();
  const controller = new AbortController();

  const result = new Promise<Record<string, any>>(async (resolve, reject) => {
    try {
      const response = await fetch(`${STREAMING_BASE_URL}/stream/lesson`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: options.topic,
          gradeLevel: options.gradeLevel,
          subject: options.subject,
          sourceText: options.sourceText,
          sourceType: options.sourceType
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.text();
        callbacks.onError?.(error);
        reject(new Error(error));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error('No response body'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let part1Data: any = null;
      let part2Data: any = null;
      let fullLessonPlan: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        // Process lines using index-based loop for correct event/data pairing
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            console.log(`🔔 SSE Event received: ${eventType}`);
            const nextLine = lines[i + 1];

            // SSE format: event line followed by data line
            if (nextLine?.startsWith('data: ')) {
              const chunk = parseSSEData(nextLine);
              if (!chunk) {
                i++; // Skip the data line since we processed it
                continue;
              }

              switch (eventType) {
                case 'progress':
                  callbacks.onProgress?.(chunk.content, chunk.metadata);
                  break;

                case 'part_start':
                  callbacks.onPartStart?.(chunk.metadata?.itemType || '');
                  callbacks.onProgress?.(chunk.content, chunk.metadata);
                  break;

                case 'part1_complete':
                  // Part 1 ready: lesson_metadata, hook, direct_instruction
                  try {
                    part1Data = JSON.parse(chunk.content);
                    console.log('📥 Part1 received via streaming:', {
                      lesson_metadata: !!part1Data.lesson_metadata,
                      hook: !!part1Data.hook,
                      direct_instruction: !!part1Data.direct_instruction
                    });
                    callbacks.onPart1Ready?.(part1Data);
                    callbacks.onPartComplete?.('part1', part1Data);
                  } catch (e) {
                    console.warn('Failed to parse part1:', e);
                  }
                  break;

                case 'part2_complete':
                  // Part 2 ready: guided_practice, independent_practice, discussion, summary
                  try {
                    part2Data = JSON.parse(chunk.content);
                    console.log('📥 Part2 received via streaming:', {
                      guided_practice: !!part2Data.guided_practice,
                      independent_practice: !!part2Data.independent_practice,
                      independent_practice_blocks: part2Data.independent_practice?.interactive_blocks?.length || 0,
                      discussion: !!part2Data.discussion,
                      summary: !!part2Data.summary,
                      discussion_questions: part2Data.discussion?.questions?.length || 0
                    });
                    callbacks.onPart2Ready?.(part2Data);
                    callbacks.onPartComplete?.('part2', part2Data);
                  } catch (e) {
                    console.warn('Failed to parse part2:', e);
                  }
                  break;

                case 'chunk':
                  callbacks.onChunk?.(chunk.content, chunk.metadata);
                  break;

                case 'done':
                  // Full lesson plan is in the done event
                  try {
                    fullLessonPlan = JSON.parse(chunk.content);
                    console.log('📥 Full lesson plan received:', {
                      lesson_metadata: !!fullLessonPlan.lesson_metadata,
                      hook: !!fullLessonPlan.hook,
                      direct_instruction: !!fullLessonPlan.direct_instruction,
                      guided_practice: !!fullLessonPlan.guided_practice,
                      independent_practice: !!fullLessonPlan.independent_practice,
                      independent_practice_blocks: fullLessonPlan.independent_practice?.interactive_blocks?.length || 0,
                      discussion: !!fullLessonPlan.discussion,
                      summary: !!fullLessonPlan.summary,
                      discussion_questions: fullLessonPlan.discussion?.questions?.length || 0,
                      guided_practice_script: !!fullLessonPlan.guided_practice?.teacher_facilitation_script
                    });
                  } catch (e) {
                    console.warn('Failed to parse done event, using fallback merge');
                    // Fallback: combine part1 and part2
                    fullLessonPlan = {
                      ...(part1Data || {}),
                      ...(part2Data || {})
                    };
                  }
                  callbacks.onComplete?.(fullLessonPlan);
                  resolve(fullLessonPlan);
                  return;

                case 'error':
                  callbacks.onError?.(chunk.content);
                  reject(new Error(chunk.content));
                  return;
              }
              i++; // Skip the data line since we processed it
            }
            continue;
          }

          // Handle standalone data lines (fallback for non-event-prefixed data)
          const chunk = parseSSEData(line);
          if (!chunk) continue;

          if (chunk.type === 'done' || chunk.type === 'json_complete') {
            try {
              fullLessonPlan = JSON.parse(chunk.content);
              console.log('📥 Full lesson plan (standalone):', Object.keys(fullLessonPlan));
            } catch (e) {
              fullLessonPlan = { ...(part1Data || {}), ...(part2Data || {}) };
            }
            callbacks.onComplete?.(fullLessonPlan);
            resolve(fullLessonPlan);
            return;
          } else if (chunk.type === 'error') {
            callbacks.onError?.(chunk.content);
            reject(new Error(chunk.content));
            return;
          }
        }
      }

      // If we got here without done event, return what we have
      const finalResult = fullLessonPlan || { ...(part1Data || {}), ...(part2Data || {}) };
      resolve(finalResult);

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        callbacks.onError?.(error.message || 'Stream failed');
        reject(error);
      }
    }
  });

  return { controller, result };
}

/**
 * Stream podcast script content
 *
 * Streams podcast dialogue generation (Dan & Noa format)
 *
 * @param options - Generation options
 * @param callbacks - Callbacks for streaming events
 * @returns AbortController and a promise that resolves with the script
 */
export async function streamPodcastContent(
  options: StreamContentOptions,
  callbacks: StreamCallbacks
): Promise<{ controller: AbortController; result: Promise<any> }> {
  const headers = await getSecureHeaders();
  const controller = new AbortController();

  const result = new Promise<any>(async (resolve, reject) => {
    try {
      const response = await fetch(`${STREAMING_BASE_URL}/stream/podcast`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: options.topic,
          gradeLevel: options.gradeLevel,
          sourceText: options.sourceText,
          activityLength: options.activityLength
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.text();
        callbacks.onError?.(error);
        reject(new Error(error));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error('No response body'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            const dataLineIndex = lines.indexOf(line) + 1;

            if (dataLineIndex < lines.length) {
              const dataLine = lines[dataLineIndex];
              const chunk = parseSSEData(dataLine);
              if (!chunk) continue;

              switch (eventType) {
                case 'progress':
                  callbacks.onProgress?.(chunk.content, chunk.metadata);
                  break;

                case 'chunk':
                  fullContent += chunk.content;
                  callbacks.onChunk?.(chunk.content, chunk.metadata);
                  break;

                case 'done':
                  try {
                    const parsed = JSON.parse(chunk.content);
                    callbacks.onComplete?.(parsed);
                    resolve(parsed);
                  } catch (e) {
                    callbacks.onComplete?.(fullContent);
                    resolve(fullContent);
                  }
                  return;

                case 'error':
                  callbacks.onError?.(chunk.content);
                  reject(new Error(chunk.content));
                  return;
              }
            }
            continue;
          }

          // Handle data lines without event prefix
          const chunk = parseSSEData(line);
          if (!chunk) continue;

          if (chunk.type === 'text') {
            fullContent += chunk.content;
            callbacks.onChunk?.(chunk.content, chunk.metadata);
          } else if (chunk.type === 'json_complete' || chunk.type === 'done') {
            try {
              const parsed = JSON.parse(chunk.content);
              callbacks.onComplete?.(parsed);
              resolve(parsed);
            } catch (e) {
              callbacks.onComplete?.(fullContent);
              resolve(fullContent);
            }
            return;
          } else if (chunk.type === 'error') {
            callbacks.onError?.(chunk.content);
            reject(new Error(chunk.content));
            return;
          }
        }
      }

      // If we got here, try to parse what we have
      resolve(fullContent);

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        callbacks.onError?.(error.message || 'Stream failed');
        reject(error);
      }
    }
  });

  return { controller, result };
}

// ============================================================
// SINGLE ACTIVITY STREAMING
// ============================================================

export interface ActivityStreamResult {
  title: string;
  steps: any[];
  skeleton?: any;
  metadata?: {
    topic: string;
    gradeLevel: string;
    stepCount: number;
    generationTime: number;
    method: string;
  };
}

export interface ActivityStreamCallbacks {
  onProgress?: (message: string, metadata?: any) => void;
  onSkeletonComplete?: (skeleton: any) => void;
  onStepComplete?: (step: any, stepNumber: number, totalSteps: number) => void;
  onComplete?: (result: ActivityStreamResult) => void;
  onError?: (error: string) => void;
}

/**
 * Stream a single activity generation
 *
 * This replaces the old flow of:
 * 1. generateStudentUnitSkeleton (Cloud Function)
 * 2. generateStepContent x N (Cloud Functions, sequential)
 *
 * With a single streaming call that generates everything in parallel
 *
 * @param options - Generation options
 * @param callbacks - Callbacks for streaming events
 * @returns AbortController and a promise that resolves with the full activity
 */
export async function streamActivityContent(
  options: StreamContentOptions,
  callbacks: ActivityStreamCallbacks
): Promise<{ controller: AbortController; result: Promise<ActivityStreamResult> }> {
  const headers = await getSecureHeaders();
  const controller = new AbortController();

  const result = new Promise<ActivityStreamResult>(async (resolve, reject) => {
    try {
      const response = await fetch(`${STREAMING_BASE_URL}/stream/activity`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: options.topic,
          gradeLevel: options.gradeLevel,
          subject: options.subject,
          sourceText: options.sourceText,
          activityLength: options.activityLength,
          // Send both mode (for exam enforcement) and productType (for content style)
          mode: options.productType === 'exam' ? 'exam' : 'learning',
          productType: options.productType || 'activity', // activity | lesson | exam
          questionPreferences: options.questionPreferences
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.text();
        callbacks.onError?.(error);
        reject(new Error(error));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        reject(new Error('No response body'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let skeleton: any = null;
      const steps: any[] = [];
      let finalResult: ActivityStreamResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            const nextLine = lines[i + 1];

            if (nextLine?.startsWith('data: ')) {
              const chunk = parseSSEData(nextLine);
              if (!chunk) continue;

              switch (eventType) {
                case 'progress':
                  callbacks.onProgress?.(chunk.content, chunk.metadata);
                  break;

                case 'skeleton_complete':
                  try {
                    skeleton = JSON.parse(chunk.content);
                    callbacks.onSkeletonComplete?.(skeleton);
                  } catch (e) {
                    console.warn('Failed to parse skeleton:', e);
                  }
                  break;

                case 'step_complete':
                  try {
                    const step = JSON.parse(chunk.content);
                    steps.push(step);
                    callbacks.onStepComplete?.(
                      step,
                      chunk.metadata?.stepNumber || steps.length,
                      chunk.metadata?.totalSteps || 5
                    );
                  } catch (e) {
                    console.warn('Failed to parse step:', e);
                  }
                  break;

                case 'done':
                  try {
                    finalResult = JSON.parse(chunk.content);
                    callbacks.onComplete?.(finalResult!);
                    resolve(finalResult!);
                    return;
                  } catch (e) {
                    // Construct result from collected data
                    finalResult = {
                      title: skeleton?.unit_title || options.topic || 'פעילות',
                      steps: steps,
                      skeleton: skeleton,
                      metadata: chunk.metadata
                    };
                    callbacks.onComplete?.(finalResult);
                    resolve(finalResult);
                    return;
                  }

                case 'error':
                  callbacks.onError?.(chunk.content);
                  reject(new Error(chunk.content));
                  return;
              }
              i++; // Skip the data line we just processed
            }
            continue;
          }

          // Handle standalone data lines
          const chunk = parseSSEData(line);
          if (!chunk) continue;

          if (chunk.type === 'done') {
            try {
              finalResult = JSON.parse(chunk.content);
            } catch (e) {
              finalResult = {
                title: skeleton?.unit_title || options.topic || 'פעילות',
                steps: steps,
                skeleton: skeleton
              };
            }
            callbacks.onComplete?.(finalResult!);
            resolve(finalResult!);
            return;
          } else if (chunk.type === 'error') {
            callbacks.onError?.(chunk.content);
            reject(new Error(chunk.content));
            return;
          }
        }
      }

      // If we got here without resolving, construct result from collected data
      if (!finalResult) {
        finalResult = {
          title: skeleton?.unit_title || options.topic || 'פעילות',
          steps: steps,
          skeleton: skeleton
        };
        callbacks.onComplete?.(finalResult);
        resolve(finalResult);
      }

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        callbacks.onError?.(error.message || 'Stream failed');
        reject(error);
      }
    }
  });

  return { controller, result };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if streaming is supported in the current environment
 */
export function isStreamingSupported(): boolean {
  return typeof ReadableStream !== 'undefined' && typeof fetch !== 'undefined';
}

/**
 * Get the streaming server URL
 */
export function getStreamingServerUrl(): string {
  return STREAMING_BASE_URL;
}
