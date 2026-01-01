import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import type { GamificationProfile } from "../shared/types/courseTypes";

const USERS_COLLECTION = "users";

export const DEFAULT_GAMIFICATION_PROFILE: GamificationProfile = {
    xp: 0,
    level: 1,
    currentStreak: 0,
    lastActivityDate: new Date().toISOString(),
    frozenDays: 0,
    gems: 0,
    leagueTier: 'BRONZE',
    leagueWeeklyXp: 0,
    unlockedThemes: ['default'],
    equippedTheme: 'default'
};



export const getInitialProfile = (): GamificationProfile => ({ ...DEFAULT_GAMIFICATION_PROFILE });

/**
 * Calculates new state for optimistic UI updates.
 * Returns the new profile and any events (level up).
 */
export const addXp = (
    currentProfile: GamificationProfile,
    amount: number,
    reason: string
): { newProfile: GamificationProfile, events: string[] } => {
    const events: string[] = [];
    const newProfile = { ...currentProfile };

    newProfile.xp += amount;
    newProfile.leagueWeeklyXp = (newProfile.leagueWeeklyXp || 0) + amount;

    const newLevel = calculateLevel(newProfile.xp);
    if (newLevel > newProfile.level) {
        newProfile.level = newLevel;
        newProfile.gems = (newProfile.gems || 0) + 50; // Level up bonus
        events.push('LEVEL_UP');
    }

    return { newProfile, events };
};

/**
 * Calculates level based on XP.
 * Simple formula: Level = floor(sqrt(XP / 100)) + 1
 */
export const calculateLevel = (xp: number): number => {
    return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
};

/**
 * Syncs user progress (XP, Gems) to Firestore.
 * Handles level up checks and returns the updated profile.
 */
export const syncProgress = async (
    uid: string,
    xpDelta: number,
    gemsDelta: number
): Promise<GamificationProfile | null> => {
    if (!uid) return null;

    const userRef = doc(db, USERS_COLLECTION, uid);

    try {
        const docSnap = await getDoc(userRef);
        let profile: GamificationProfile;

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Merge with default to ensure all fields exist
            profile = { ...DEFAULT_GAMIFICATION_PROFILE, ...(data.gamification || {}) };
        } else {
            profile = { ...DEFAULT_GAMIFICATION_PROFILE };
        }

        // Update stats
        profile.xp = (profile.xp || 0) + xpDelta;
        profile.gems = (profile.gems || 0) + gemsDelta;
        profile.leagueWeeklyXp = (profile.leagueWeeklyXp || 0) + xpDelta;

        // Recalculate level
        const newLevel = calculateLevel(profile.xp);
        if (newLevel > profile.level) {
            profile.level = newLevel;
            // Bonus gems for leveling up?
            profile.gems += 50;
        }

        // Update Streak Timestamp
        profile.lastActivityDate = new Date().toISOString();

        // Save to Firestore
        // We use setDoc with merge to ensure we don't overwrite other user fields
        await setDoc(userRef, { gamification: profile }, { merge: true });

        return profile;

    } catch (error) {
        console.error("Error syncing gamification progress:", error);
        return null;
    }
};

/**
 * Checks and updates the daily streak.
 * Should be called when the user logs in or starts a session.
 */
export const checkDailyStreak = async (uid: string): Promise<{ currentStreak: number; frozenDays: number; status: 'maintained' | 'frozen_used' | 'reset' }> => {
    if (!uid) return { currentStreak: 0, frozenDays: 0, status: 'reset' };

    const userRef = doc(db, USERS_COLLECTION, uid);

    try {
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return { currentStreak: 0, frozenDays: 0, status: 'reset' };

        const data = docSnap.data();
        const profile: GamificationProfile = { ...DEFAULT_GAMIFICATION_PROFILE, ...(data.gamification || {}) };

        const lastDate = new Date(profile.lastActivityDate);
        const today = new Date();

        // Normalize dates to midnight for comparison
        const lastDateMidnight = new Date(lastDate);
        lastDateMidnight.setHours(0, 0, 0, 0);

        const todayMidnight = new Date(today);
        todayMidnight.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(todayMidnight.getTime() - lastDateMidnight.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status: 'maintained' | 'frozen_used' | 'reset' = 'maintained';

        if (diffDays === 0) {
            // Already active today
            return { currentStreak: profile.currentStreak, frozenDays: profile.frozenDays, status: 'maintained' };
        } else if (diffDays === 1) {
            // Consecutive day
            // We assume calling this implies activity or check on load.
            // Ideally we don't increment until they DO something, but this function just checks status.
        } else {
            // Missed one or more days
            const missedDays = diffDays - 1;
            if (profile.frozenDays >= missedDays) {
                // Use freeze(s)
                profile.frozenDays -= missedDays;
                status = 'frozen_used';
            } else {
                // Not enough freezes
                profile.currentStreak = 0;
                status = 'reset';
            }
        }

        if (status !== 'maintained') {
            await updateDoc(userRef, {
                "gamification.currentStreak": profile.currentStreak,
                "gamification.frozenDays": profile.frozenDays
            });
        }

        return { currentStreak: profile.currentStreak, frozenDays: profile.frozenDays, status };

    } catch (error) {
        console.error("Error checking streak:", error);
        return { currentStreak: 0, frozenDays: 0, status: 'reset' };
    }
};

/**
 * Buys a Streak Freeze item.
 * Deducts gems and adds to inventory.
 */
export const buyStreakFreeze = async (uid: string): Promise<{ success: boolean; message: string; newBalance?: number }> => {
    const PRICE = 50;
    const userRef = doc(db, USERS_COLLECTION, uid);

    try {
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) return { success: false, message: "User not found" };

        const data = docSnap.data();
        const profile: GamificationProfile = { ...DEFAULT_GAMIFICATION_PROFILE, ...(data.gamification || {}) };

        if (profile.gems < PRICE) {
            return { success: false, message: "אין מספיק יהלומים" };
        }

        // Transaction-like update
        await updateDoc(userRef, {
            "gamification.gems": increment(-PRICE),
            "gamification.frozenDays": increment(1)
        });

        return { success: true, message: "מקפיא רצף נרכש בהצלחה!", newBalance: profile.gems - PRICE };

    } catch (error) {
        console.error("Error purchasing item:", error);
        return { success: false, message: "שגיאה ברכישה" };
    }
};
