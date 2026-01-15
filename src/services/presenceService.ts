/**
 * Presence Service
 * מעקב אחר תלמידים מחוברים בזמן אמת
 * שימוש ב-Firebase Realtime Database לביצועים אופטימליים
 */

import { getDatabase, ref, onValue, set, onDisconnect, serverTimestamp, off, Database } from 'firebase/database';
import { getApp } from 'firebase/app';

// Types
export interface PresenceData {
    online: boolean;
    lastSeen: number;
    currentCourseId?: string | null;
    currentActivity?: string | null;
}

export interface ClassPresence {
    [userId: string]: PresenceData;
}

// Singleton database reference
let rtdb: Database | null = null;

const getRealtimeDb = (): Database => {
    if (!rtdb) {
        rtdb = getDatabase(getApp());
    }
    return rtdb;
};

/**
 * סימון משתמש כמחובר
 * כולל הגדרת onDisconnect לסימון אוטומטי כמנותק
 */
export const goOnline = async (
    userId: string,
    courseId?: string,
    activity?: string
): Promise<void> => {
    const db = getRealtimeDb();
    const presenceRef = ref(db, `presence/${userId}`);

    const presenceData: PresenceData = {
        online: true,
        lastSeen: Date.now(),
        currentCourseId: courseId || null,
        currentActivity: activity || null
    };

    // Set current presence
    await set(presenceRef, presenceData);

    // Set up disconnect handler
    const disconnectData: PresenceData = {
        online: false,
        lastSeen: Date.now(),
        currentCourseId: null,
        currentActivity: null
    };

    await onDisconnect(presenceRef).set(disconnectData);
};

/**
 * סימון משתמש כמנותק
 */
export const goOffline = async (userId: string): Promise<void> => {
    const db = getRealtimeDb();
    const presenceRef = ref(db, `presence/${userId}`);

    await set(presenceRef, {
        online: false,
        lastSeen: Date.now(),
        currentCourseId: null,
        currentActivity: null
    });
};

/**
 * עדכון הפעילות הנוכחית
 */
export const updateActivity = async (
    userId: string,
    courseId: string,
    activity?: string
): Promise<void> => {
    const db = getRealtimeDb();
    const presenceRef = ref(db, `presence/${userId}`);

    await set(presenceRef, {
        online: true,
        lastSeen: Date.now(),
        currentCourseId: courseId,
        currentActivity: activity || null
    });
};

/**
 * מעקב אחר נוכחות של תלמיד בודד
 */
export const subscribeToUserPresence = (
    userId: string,
    callback: (presence: PresenceData | null) => void
): (() => void) => {
    const db = getRealtimeDb();
    const presenceRef = ref(db, `presence/${userId}`);

    const handler = onValue(presenceRef, (snapshot) => {
        const data = snapshot.val() as PresenceData | null;
        callback(data);
    });

    // Return unsubscribe function
    return () => off(presenceRef, 'value', handler);
};

/**
 * מעקב אחר נוכחות של מספר תלמידים (לכיתה)
 */
export const subscribeToClassPresence = (
    studentIds: string[],
    callback: (presence: ClassPresence) => void
): (() => void) => {
    const db = getRealtimeDb();
    const unsubscribers: (() => void)[] = [];
    const presenceMap: ClassPresence = {};

    // Initialize all students as offline
    studentIds.forEach(id => {
        presenceMap[id] = {
            online: false,
            lastSeen: 0,
            currentCourseId: null
        };
    });

    // Subscribe to each student
    studentIds.forEach(studentId => {
        const presenceRef = ref(db, `presence/${studentId}`);

        const handler = onValue(presenceRef, (snapshot) => {
            const data = snapshot.val() as PresenceData | null;

            if (data) {
                presenceMap[studentId] = data;
            } else {
                presenceMap[studentId] = {
                    online: false,
                    lastSeen: 0,
                    currentCourseId: null
                };
            }

            // Call callback with updated presence map
            callback({ ...presenceMap });
        });

        unsubscribers.push(() => off(presenceRef, 'value', handler));
    });

    // Return combined unsubscribe function
    return () => {
        unsubscribers.forEach(unsub => unsub());
    };
};

/**
 * קבלת רשימת תלמידים מחוברים בקורס מסוים
 */
export const getOnlineStudentsInCourse = async (
    courseId: string,
    studentIds: string[]
): Promise<string[]> => {
    const db = getRealtimeDb();
    const onlineStudents: string[] = [];

    const promises = studentIds.map(async (studentId) => {
        const presenceRef = ref(db, `presence/${studentId}`);

        return new Promise<void>((resolve) => {
            onValue(presenceRef, (snapshot) => {
                const data = snapshot.val() as PresenceData | null;

                if (data?.online && data.currentCourseId === courseId) {
                    onlineStudents.push(studentId);
                }

                resolve();
            }, { onlyOnce: true });
        });
    });

    await Promise.all(promises);
    return onlineStudents;
};

/**
 * מספר תלמידים מחוברים כעת
 */
export const getOnlineCount = async (studentIds: string[]): Promise<number> => {
    const db = getRealtimeDb();
    let count = 0;

    const promises = studentIds.map(async (studentId) => {
        const presenceRef = ref(db, `presence/${studentId}`);

        return new Promise<void>((resolve) => {
            onValue(presenceRef, (snapshot) => {
                const data = snapshot.val() as PresenceData | null;

                if (data?.online) {
                    count++;
                }

                resolve();
            }, { onlyOnce: true });
        });
    });

    await Promise.all(promises);
    return count;
};

// Export service object for convenience
export const presenceService = {
    goOnline,
    goOffline,
    updateActivity,
    subscribeToUserPresence,
    subscribeToClassPresence,
    getOnlineStudentsInCourse,
    getOnlineCount
};

export default presenceService;
