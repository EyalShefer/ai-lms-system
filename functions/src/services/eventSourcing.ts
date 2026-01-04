import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

/**
 * Event Sourcing Service
 * Solves Firestore's 1 write/second limitation by using append-only event log
 *
 * Instead of:
 *   - 100 students → 100 writes to same assignment doc → THROTTLING
 *
 * We do:
 *   - 100 students → 100 writes to different event docs → NO THROTTLING
 *   - Background function aggregates events → 1 write to assignment doc
 */

export interface Event {
  id: string;
  type: string;
  aggregateId: string; // e.g., assignmentId, courseId
  data: any;
  userId: string;
  timestamp: number;
  processed: boolean;
}

const db = getFirestore();
const EVENTS_COLLECTION = 'events';
const BATCH_SIZE = 500; // Firestore limit

/**
 * Append event to log
 * This is fast and never conflicts - each student writes to their own event doc
 */
export async function appendEvent(
  type: string,
  aggregateId: string,
  data: any,
  userId: string
): Promise<string> {
  const event: Omit<Event, 'id'> = {
    type,
    aggregateId,
    data,
    userId,
    timestamp: Date.now(),
    processed: false,
  };

  const docRef = await db.collection(EVENTS_COLLECTION).add(event);
  logger.debug(`Event appended: ${type} for ${aggregateId}`);

  return docRef.id;
}

/**
 * Process pending events for a specific aggregate
 * Called by Cloud Function trigger or scheduled job
 */
export async function processEvents(aggregateId: string): Promise<number> {
  const eventsRef = db
    .collection(EVENTS_COLLECTION)
    .where('aggregateId', '==', aggregateId)
    .where('processed', '==', false)
    .orderBy('timestamp', 'asc')
    .limit(BATCH_SIZE);

  const snapshot = await eventsRef.get();

  if (snapshot.empty) {
    return 0;
  }

  // Aggregate events by type
  const eventsByType: Record<string, Event[]> = {};
  const eventIds: string[] = [];

  snapshot.docs.forEach((doc) => {
    const event = { id: doc.id, ...doc.data() } as Event;
    eventIds.push(event.id);

    if (!eventsByType[event.type]) {
      eventsByType[event.type] = [];
    }
    eventsByType[event.type].push(event);
  });

  // Apply events based on type
  await applyEvents(aggregateId, eventsByType);

  // Mark events as processed
  const batch = db.batch();
  eventIds.forEach((id) => {
    batch.update(db.collection(EVENTS_COLLECTION).doc(id), {
      processed: true,
      processedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  logger.info(`Processed ${eventIds.length} events for ${aggregateId}`);
  return eventIds.length;
}

/**
 * Apply aggregated events to the main document
 */
async function applyEvents(
  aggregateId: string,
  eventsByType: Record<string, Event[]>
): Promise<void> {
  const batch = db.batch();

  // STUDENT_ANSWERED events
  if (eventsByType['STUDENT_ANSWERED']) {
    const assignmentRef = db.collection('assignments').doc(aggregateId);

    // Aggregate all answers
    const answers: Record<string, any> = {};
    eventsByType['STUDENT_ANSWERED'].forEach((event) => {
      answers[event.userId] = {
        ...event.data,
        timestamp: event.timestamp,
      };
    });

    // Single write with all aggregated data
    batch.update(assignmentRef, {
      answers: FieldValue.arrayUnion(...Object.values(answers)),
      lastUpdated: FieldValue.serverTimestamp(),
      totalSubmissions: FieldValue.increment(Object.keys(answers).length),
    });
  }

  // COURSE_VIEWED events
  if (eventsByType['COURSE_VIEWED']) {
    const courseRef = db.collection('courses').doc(aggregateId);

    // Count unique viewers
    const uniqueViewers = new Set(
      eventsByType['COURSE_VIEWED'].map((e) => e.userId)
    );

    batch.update(courseRef, {
      viewCount: FieldValue.increment(uniqueViewers.size),
      lastViewedAt: FieldValue.serverTimestamp(),
    });
  }

  // XP_EARNED events
  if (eventsByType['XP_EARNED']) {
    const userIds = [...new Set(eventsByType['XP_EARNED'].map((e) => e.userId))];

    userIds.forEach((userId) => {
      const userEvents = eventsByType['XP_EARNED'].filter((e) => e.userId === userId);
      const totalXp = userEvents.reduce((sum, e) => sum + (e.data.amount || 0), 0);

      const userRef = db.collection('users').doc(userId);
      batch.update(userRef, {
        'gamification.xp': FieldValue.increment(totalXp),
        'gamification.lastEarned': FieldValue.serverTimestamp(),
      });
    });
  }

  await batch.commit();
}

/**
 * Get event statistics
 */
export async function getEventStats(): Promise<{
  total: number;
  pending: number;
  processed: number;
  oldestPending: number | null;
}> {
  const [totalSnap, pendingSnap] = await Promise.all([
    db.collection(EVENTS_COLLECTION).count().get(),
    db.collection(EVENTS_COLLECTION).where('processed', '==', false).count().get(),
  ]);

  const total = totalSnap.data().count;
  const pending = pendingSnap.data().count;

  let oldestPending: number | null = null;
  if (pending > 0) {
    const oldestSnap = await db
      .collection(EVENTS_COLLECTION)
      .where('processed', '==', false)
      .orderBy('timestamp', 'asc')
      .limit(1)
      .get();

    if (!oldestSnap.empty) {
      oldestPending = oldestSnap.docs[0].data().timestamp;
    }
  }

  return {
    total,
    pending,
    processed: total - pending,
    oldestPending,
  };
}

/**
 * Cleanup old processed events (run daily)
 */
export async function cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const snapshot = await db
    .collection(EVENTS_COLLECTION)
    .where('processed', '==', true)
    .where('timestamp', '<', cutoffTime)
    .limit(BATCH_SIZE)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  logger.info(`Cleaned up ${snapshot.size} old events`);
  return snapshot.size;
}
