/**
 * User Context Service
 *
 * Stores and retrieves teacher preferences (grade, subject, recent topics)
 * to improve the AI agent's suggestions and reduce repetitive questions.
 *
 * Storage: Firestore users/{userId}/preferences
 */

import { db, auth } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// ========== Types ==========

export interface TeacherPreferences {
    // Primary teaching context
    primaryGrade?: string;        // e.g., 'ד', 'ה', '5'
    primarySubject?: string;      // e.g., 'מתמטיקה', 'עברית'

    // Recent activity (auto-updated)
    recentTopics?: string[];      // Last 5 topics created
    recentGrades?: string[];      // Last 5 grades used
    recentSubjects?: string[];    // Last 5 subjects used

    // Usage patterns
    preferredActivityLength?: 'short' | 'medium' | 'long';
    preferredDifficulty?: 'support' | 'core' | 'enrichment' | 'all';

    // Timestamps
    createdAt?: any;
    updatedAt?: any;
}

export interface UserContext {
    userId: string;
    preferences: TeacherPreferences;
    isLoaded: boolean;
}

// ========== In-Memory Cache ==========

let cachedContext: UserContext | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let cacheTimestamp = 0;

// ========== Firestore Operations ==========

/**
 * Get the current user's ID
 */
function getCurrentUserId(): string | null {
    return auth.currentUser?.uid || null;
}

/**
 * Get the Firestore document reference for user preferences
 */
function getPreferencesRef(userId: string) {
    return doc(db, 'users', userId, 'settings', 'agentPreferences');
}

/**
 * Load teacher preferences from Firestore
 */
export async function loadUserContext(forceRefresh = false): Promise<UserContext | null> {
    const userId = getCurrentUserId();
    if (!userId) {
        console.log('[UserContext] No authenticated user');
        return null;
    }

    const now = Date.now();

    // Return cached if valid
    if (!forceRefresh && cachedContext && cachedContext.userId === userId && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedContext;
    }

    try {
        const docRef = getPreferencesRef(userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const preferences = docSnap.data() as TeacherPreferences;
            cachedContext = {
                userId,
                preferences,
                isLoaded: true
            };
        } else {
            // No preferences saved yet - return empty
            cachedContext = {
                userId,
                preferences: {},
                isLoaded: true
            };
        }

        cacheTimestamp = now;
        console.log('[UserContext] Loaded preferences:', cachedContext.preferences);
        return cachedContext;

    } catch (error) {
        console.error('[UserContext] Failed to load:', error);
        // Return empty context on error
        return {
            userId,
            preferences: {},
            isLoaded: false
        };
    }
}

/**
 * Save teacher preferences to Firestore
 */
export async function saveUserPreferences(preferences: Partial<TeacherPreferences>): Promise<boolean> {
    const userId = getCurrentUserId();
    if (!userId) {
        console.error('[UserContext] Cannot save - no authenticated user');
        return false;
    }

    try {
        const docRef = getPreferencesRef(userId);

        await setDoc(docRef, {
            ...preferences,
            updatedAt: serverTimestamp()
        }, { merge: true });

        // Update cache
        if (cachedContext && cachedContext.userId === userId) {
            cachedContext.preferences = {
                ...cachedContext.preferences,
                ...preferences
            };
        }

        console.log('[UserContext] Saved preferences');
        return true;

    } catch (error) {
        console.error('[UserContext] Failed to save:', error);
        return false;
    }
}

/**
 * Update recent usage (called after content creation)
 */
export async function updateRecentUsage(params: {
    topic?: string;
    grade?: string;
    subject?: string;
}): Promise<void> {
    const context = await loadUserContext();
    if (!context) return;

    const { topic, grade, subject } = params;
    const { preferences } = context;

    // Update recent topics (keep last 5)
    if (topic) {
        const recentTopics = preferences.recentTopics || [];
        const updated = [topic, ...recentTopics.filter(t => t !== topic)].slice(0, 5);
        preferences.recentTopics = updated;
    }

    // Update recent grades (keep last 5)
    if (grade) {
        const recentGrades = preferences.recentGrades || [];
        const updated = [grade, ...recentGrades.filter(g => g !== grade)].slice(0, 5);
        preferences.recentGrades = updated;
    }

    // Update recent subjects (keep last 5)
    if (subject) {
        const recentSubjects = preferences.recentSubjects || [];
        const updated = [subject, ...recentSubjects.filter(s => s !== subject)].slice(0, 5);
        preferences.recentSubjects = updated;
    }

    await saveUserPreferences(preferences);
}

/**
 * Set primary teaching context
 */
export async function setPrimaryContext(grade: string, subject: string): Promise<boolean> {
    return saveUserPreferences({
        primaryGrade: grade,
        primarySubject: subject
    });
}

/**
 * Clear the context cache
 */
export function clearUserContextCache(): void {
    cachedContext = null;
    cacheTimestamp = 0;
}

// ========== Helper Functions ==========

/**
 * Get default grade from context
 */
export function getDefaultGrade(context: UserContext | null): string | undefined {
    if (!context?.preferences) return undefined;

    return context.preferences.primaryGrade ||
        context.preferences.recentGrades?.[0];
}

/**
 * Get default subject from context
 */
export function getDefaultSubject(context: UserContext | null): string | undefined {
    if (!context?.preferences) return undefined;

    return context.preferences.primarySubject ||
        context.preferences.recentSubjects?.[0];
}

/**
 * Build prompt context from user preferences
 */
export function buildUserContextPrompt(context: UserContext | null): string {
    if (!context?.preferences) return '';

    const parts: string[] = [];

    if (context.preferences.primaryGrade) {
        parts.push(`כיתה: ${context.preferences.primaryGrade}`);
    }
    if (context.preferences.primarySubject) {
        parts.push(`תחום דעת: ${context.preferences.primarySubject}`);
    }
    if (context.preferences.recentTopics?.length) {
        parts.push(`נושאים אחרונים: ${context.preferences.recentTopics.slice(0, 3).join(', ')}`);
    }

    if (parts.length === 0) return '';

    return `\n### העדפות המורה:\n${parts.join('\n')}`;
}
