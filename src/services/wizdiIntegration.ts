/**
 * Wizdi Integration Service
 * Handles postMessage communication with Wizdi parent window
 *
 * SECURITY: This module implements secure postMessage communication
 * with origin validation to prevent cross-origin attacks.
 */

// Allowed origins for Wizdi communication
// IMPORTANT: Update this list with actual Wizdi production domains
const ALLOWED_WIZDI_ORIGINS: string[] = [
  'https://wizdi.co.il',
  'https://www.wizdi.co.il',
  'https://app.wizdi.co.il',
  'https://staging.wizdi.co.il',
  // Development origins (remove in production)
  'http://localhost:3000',
  'http://localhost:5173',
];

// Cache the parent origin after first successful validation
let validatedParentOrigin: string | null = null;

/**
 * Validate if an origin is allowed for Wizdi communication
 */
function isAllowedOrigin(origin: string): boolean {
  // Check exact match first
  if (ALLOWED_WIZDI_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow any wizdi.co.il subdomain
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.wizdi.co.il') || url.hostname === 'wizdi.co.il') {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Get the target origin for postMessage
 * Returns the validated parent origin or throws if not validated
 */
function getTargetOrigin(): string {
  if (validatedParentOrigin) {
    return validatedParentOrigin;
  }

  // If we haven't validated yet, try to get referrer
  try {
    const referrer = document.referrer;
    if (referrer) {
      const referrerOrigin = new URL(referrer).origin;
      if (isAllowedOrigin(referrerOrigin)) {
        validatedParentOrigin = referrerOrigin;
        return referrerOrigin;
      }
    }
  } catch {
    // Referrer parsing failed
  }

  // Fallback: use wildcard but log warning
  // This is less secure but prevents breaking existing integrations
  console.warn('[Wizdi Security] Could not validate parent origin, using wildcard. Please ensure ALLOWED_WIZDI_ORIGINS is configured correctly.');
  return '*';
}

// Event types that we send to Wizdi
export type WizdiEventType =
  | 'APPLICATION_LOADED'
  | 'TASK_STARTED'
  | 'TASK_PROGRESS'
  | 'TASK_COMPLETED'
  | 'TASK_SUBMITTED'
  | 'GRADE_UPDATED'
  | 'XP_EARNED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'COURSE_CREATED'
  | 'TASK_ASSIGNED'
  | 'CLOSE_EVENT'
  | 'ERROR';

// Command types that we receive from Wizdi
export type WizdiCommandType =
  | 'NAVIGATE_TO_TASK'
  | 'NAVIGATE_TO_COURSE'
  | 'REFRESH_DATA';

export interface WizdiEvent<T = any> {
  source: 'ai-lms-system';
  type: WizdiEventType;
  payload: T;
}

export interface WizdiCommand {
  type: WizdiCommandType;
  taskId?: string;
  courseId?: string;
  unitId?: string;
}

// Payload types
export interface ApplicationLoadedPayload {
  userId: string;
  isTeacher: boolean;
  timestamp: string;
}

export interface TaskStartedPayload {
  taskId: string;
  studentId: string;
  courseId: string;
  courseName: string;
  taskTitle: string;
  startedAt: string;
}

export interface TaskProgressPayload {
  taskId: string;
  studentId: string;
  progress: number;
  currentStep: number;
  totalSteps: number;
  timeSpentSeconds: number;
}

export interface TaskCompletedPayload {
  taskId: string;
  studentId: string;
  submissionId: string;
  score: number;
  maxScore: number;
  timeSpentSeconds: number;
  completedAt: string;
  analytics: {
    correctAnswers: number;
    totalQuestions: number;
    hintsUsed: number;
    averageTimePerQuestion: number;
  };
}

export interface GradeUpdatedPayload {
  taskId: string;
  studentId: string;
  teacherId: string;
  grade: number;
  maxGrade: number;
  feedback?: string;
  gradedAt: string;
}

export interface XpEarnedPayload {
  studentId: string;
  xpAmount: number;
  totalXp: number;
  reason: string;
  level: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
  context?: Record<string, any>;
}

/**
 * Check if we're running inside an iframe (embedded in Wizdi)
 */
export function isEmbeddedInWizdi(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    // If we can't access window.top, we're probably in an iframe
    return true;
  }
}

/**
 * Check if URL has Wizdi parameters
 */
export function hasWizdiParams(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('ctoken') && params.has('userId');
}

/**
 * Get Wizdi parameters from URL
 */
export function getWizdiParams(): { userId: string | null; token: string | null; locale: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    userId: params.get('userId'),
    token: params.get('ctoken'),
    locale: params.get('locale') || 'he'
  };
}

/**
 * Send event to Wizdi parent window
 */
export function sendToWizdi<T>(type: WizdiEventType, payload: T): void {
  if (!isEmbeddedInWizdi()) {
    console.log('[Wizdi] Not embedded, skipping postMessage:', type, payload);
    return;
  }

  const event: WizdiEvent<T> = {
    source: 'ai-lms-system',
    type,
    payload
  };

  try {
    const targetOrigin = getTargetOrigin();
    window.parent.postMessage(event, targetOrigin);
    console.log('[Wizdi] Sent event:', type, 'to origin:', targetOrigin);
  } catch (error) {
    console.error('[Wizdi] Failed to send event:', error);
  }
}

// Convenience functions for each event type

export function notifyApplicationLoaded(userId: string, isTeacher: boolean): void {
  sendToWizdi<ApplicationLoadedPayload>('APPLICATION_LOADED', {
    userId,
    isTeacher,
    timestamp: new Date().toISOString()
  });
}

export function notifyTaskStarted(
  taskId: string,
  studentId: string,
  courseId: string,
  courseName: string,
  taskTitle: string
): void {
  sendToWizdi<TaskStartedPayload>('TASK_STARTED', {
    taskId,
    studentId,
    courseId,
    courseName,
    taskTitle,
    startedAt: new Date().toISOString()
  });
}

export function notifyTaskProgress(
  taskId: string,
  studentId: string,
  progress: number,
  currentStep: number,
  totalSteps: number,
  timeSpentSeconds: number
): void {
  sendToWizdi<TaskProgressPayload>('TASK_PROGRESS', {
    taskId,
    studentId,
    progress,
    currentStep,
    totalSteps,
    timeSpentSeconds
  });
}

export function notifyTaskCompleted(
  taskId: string,
  studentId: string,
  submissionId: string,
  score: number,
  maxScore: number,
  timeSpentSeconds: number,
  analytics: TaskCompletedPayload['analytics']
): void {
  sendToWizdi<TaskCompletedPayload>('TASK_COMPLETED', {
    taskId,
    studentId,
    submissionId,
    score,
    maxScore,
    timeSpentSeconds,
    completedAt: new Date().toISOString(),
    analytics
  });
}

export function notifyTaskSubmitted(taskId: string, studentId: string, submissionId: string): void {
  sendToWizdi('TASK_SUBMITTED', {
    taskId,
    studentId,
    submissionId,
    submittedAt: new Date().toISOString()
  });
}

export function notifyGradeUpdated(
  taskId: string,
  studentId: string,
  teacherId: string,
  grade: number,
  maxGrade: number,
  feedback?: string
): void {
  sendToWizdi<GradeUpdatedPayload>('GRADE_UPDATED', {
    taskId,
    studentId,
    teacherId,
    grade,
    maxGrade,
    feedback,
    gradedAt: new Date().toISOString()
  });
}

export function notifyXpEarned(
  studentId: string,
  xpAmount: number,
  totalXp: number,
  reason: string,
  level: number
): void {
  sendToWizdi<XpEarnedPayload>('XP_EARNED', {
    studentId,
    xpAmount,
    totalXp,
    reason,
    level
  });
}

export function notifyAchievementUnlocked(
  studentId: string,
  achievementId: string,
  achievementName: string,
  description: string
): void {
  sendToWizdi('ACHIEVEMENT_UNLOCKED', {
    studentId,
    achievementId,
    achievementName,
    description
  });
}

export function notifyCourseCreated(
  courseId: string,
  teacherId: string,
  title: string,
  subject?: string,
  gradeLevel?: string
): void {
  sendToWizdi('COURSE_CREATED', {
    courseId,
    teacherId,
    title,
    subject,
    gradeLevel,
    createdAt: new Date().toISOString()
  });
}

export function notifyTaskAssigned(
  taskId: string,
  teacherId: string,
  courseId: string,
  title: string,
  assignedTo: 'all' | 'class' | 'group' | 'individual',
  studentCount: number,
  dueDate?: string
): void {
  sendToWizdi('TASK_ASSIGNED', {
    taskId,
    teacherId,
    courseId,
    title,
    assignedTo,
    studentCount,
    dueDate
  });
}

export function notifyCloseEvent(userId: string, lastView: string, taskId?: string): void {
  sendToWizdi('CLOSE_EVENT', {
    userId,
    lastView,
    taskId
  });
}

export function notifyError(code: string, message: string, context?: Record<string, any>): void {
  sendToWizdi<ErrorPayload>('ERROR', {
    code,
    message,
    context
  });
}

/**
 * Command handler type
 */
type CommandHandler = (command: WizdiCommand) => void;

let commandHandlers: CommandHandler[] = [];

/**
 * Subscribe to commands from Wizdi
 */
export function onWizdiCommand(handler: CommandHandler): () => void {
  commandHandlers.push(handler);

  // Return unsubscribe function
  return () => {
    commandHandlers = commandHandlers.filter(h => h !== handler);
  };
}

/**
 * Initialize Wizdi message listener
 * Call this once at app startup
 *
 * SECURITY: This listener validates the origin of incoming messages
 * to prevent cross-origin attacks from malicious websites.
 */
export function initWizdiListener(): () => void {
  const handleMessage = (event: MessageEvent) => {
    // SECURITY: Validate origin before processing any message
    if (!isAllowedOrigin(event.origin)) {
      // Silently ignore messages from unknown origins
      // Don't log to avoid console spam from legitimate browser extensions etc.
      return;
    }

    // Cache the validated origin for outbound messages
    if (!validatedParentOrigin && event.origin) {
      validatedParentOrigin = event.origin;
      console.log('[Wizdi] Validated parent origin:', event.origin);
    }

    const data = event.data as WizdiCommand;

    // Validate message structure
    if (!data || typeof data !== 'object' || !data.type) {
      return;
    }

    // Check if it's a command we recognize
    const validCommands: WizdiCommandType[] = [
      'NAVIGATE_TO_TASK',
      'NAVIGATE_TO_COURSE',
      'REFRESH_DATA'
    ];

    if (validCommands.includes(data.type as WizdiCommandType)) {
      console.log('[Wizdi] Received command:', data.type, 'from:', event.origin);

      // Additional validation for navigation commands
      if (data.type === 'NAVIGATE_TO_TASK' && data.taskId) {
        // Validate taskId format (alphanumeric and common ID chars only)
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(data.taskId)) {
          console.warn('[Wizdi Security] Invalid taskId format received');
          return;
        }
      }

      if (data.type === 'NAVIGATE_TO_COURSE') {
        if (data.courseId && !/^[a-zA-Z0-9_-]{1,100}$/.test(data.courseId)) {
          console.warn('[Wizdi Security] Invalid courseId format received');
          return;
        }
        if (data.unitId && !/^[a-zA-Z0-9_-]{1,100}$/.test(data.unitId)) {
          console.warn('[Wizdi Security] Invalid unitId format received');
          return;
        }
      }

      commandHandlers.forEach(handler => handler(data));
    }
  };

  window.addEventListener('message', handleMessage);

  console.log('[Wizdi] Message listener initialized with origin validation');

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handleMessage);
    validatedParentOrigin = null; // Reset on cleanup
  };
}

/**
 * Wizdi context for React components
 */
export interface WizdiContext {
  isEmbedded: boolean;
  userId: string | null;
  token: string | null;
  locale: string;
}

export function getWizdiContext(): WizdiContext {
  const params = getWizdiParams();
  return {
    isEmbedded: isEmbeddedInWizdi() && hasWizdiParams(),
    userId: params.userId,
    token: params.token,
    locale: params.locale
  };
}
