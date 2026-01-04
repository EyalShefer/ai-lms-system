import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * Event Service (Frontend)
 * Appends events to Firestore instead of direct writes
 * This solves the 1 write/second limitation
 */

interface EventData {
  type: string;
  aggregateId: string;
  data: any;
}

/**
 * Submit student answer as event
 * Instead of writing to assignment doc (conflicts with other students),
 * we append an event that will be processed by backend
 */
export async function submitAnswerEvent(
  assignmentId: string,
  questionId: string,
  answer: any
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const event: EventData = {
    type: 'STUDENT_ANSWERED',
    aggregateId: assignmentId,
    data: {
      questionId,
      answer,
      studentId: userId,
    },
  };

  await appendEvent(event);
  console.debug('[Event] Student answer submitted:', questionId);
}

/**
 * Track course view as event
 */
export async function trackCourseViewEvent(courseId: string): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const event: EventData = {
    type: 'COURSE_VIEWED',
    aggregateId: courseId,
    data: {
      viewedAt: Date.now(),
    },
  };

  await appendEvent(event);
}

/**
 * Track XP earned as event
 */
export async function trackXPEarnedEvent(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  const event: EventData = {
    type: 'XP_EARNED',
    aggregateId: userId,
    data: {
      amount,
      reason,
    },
  };

  await appendEvent(event);
  console.debug('[Event] XP earned:', amount, reason);
}

/**
 * Track block completion as event
 */
export async function trackBlockCompletionEvent(
  courseId: string,
  blockId: string,
  timeSpent: number
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const event: EventData = {
    type: 'BLOCK_COMPLETED',
    aggregateId: courseId,
    data: {
      blockId,
      timeSpent,
      studentId: userId,
    },
  };

  await appendEvent(event);
}

/**
 * Generic event append function
 */
async function appendEvent(event: EventData): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    await addDoc(collection(db, 'events'), {
      ...event,
      userId,
      timestamp: Date.now(),
      processed: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Event] Failed to append event:', error);
    // Don't throw - events are non-critical
    // Fallback to direct write could be implemented here
  }
}

/**
 * Optimistic UI update helper
 * Updates local state immediately, then appends event
 * Backend will eventually process and make it permanent
 */
export function withOptimisticUpdate<T>(
  optimisticUpdate: () => void,
  eventFn: () => Promise<void>
): void {
  // Update UI immediately
  optimisticUpdate();

  // Append event in background
  eventFn().catch((error) => {
    console.error('[Event] Background event failed:', error);
    // TODO: Revert optimistic update if needed
  });
}

/**
 * Example usage in component:
 *
 * const handleSubmitAnswer = (answer: any) => {
 *   withOptimisticUpdate(
 *     // Optimistic update - instant UI feedback
 *     () => {
 *       setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
 *       showSuccessToast('תשובה נשלחה!');
 *     },
 *     // Event append - processed later
 *     () => submitAnswerEvent(assignmentId, questionId, answer)
 *   );
 * };
 */
