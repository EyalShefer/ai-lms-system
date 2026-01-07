/**
 * Wizdi Integration Service
 * Handles postMessage communication with Wizdi parent window
 */

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
    window.parent.postMessage(event, '*');
    console.log('[Wizdi] Sent event:', type);
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
 */
export function initWizdiListener(): () => void {
  const handleMessage = (event: MessageEvent) => {
    // We accept messages from any origin when embedded
    // In production, you might want to validate event.origin

    const data = event.data as WizdiCommand;

    if (!data || !data.type) return;

    // Check if it's a command we recognize
    const validCommands: WizdiCommandType[] = [
      'NAVIGATE_TO_TASK',
      'NAVIGATE_TO_COURSE',
      'REFRESH_DATA'
    ];

    if (validCommands.includes(data.type as WizdiCommandType)) {
      console.log('[Wizdi] Received command:', data.type);
      commandHandlers.forEach(handler => handler(data));
    }
  };

  window.addEventListener('message', handleMessage);

  console.log('[Wizdi] Message listener initialized');

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handleMessage);
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
