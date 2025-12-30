import type { GamificationProfile, GamificationEventPayload } from '../courseTypes';

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500]; // Example curve

export class GamificationService {

    static getInitialProfile(): GamificationProfile {
        return {
            xp: 0,
            level: 1,
            currentStreak: 0,
            lastActivityDate: new Date(0).toISOString(), // Epoch
            frozenDays: 0, // Start with 0 freezes
            gems: 0,
            leagueTier: 'BRONZE',
            leagueWeeklyXp: 0,
            unlockedThemes: ['default'],
            equippedTheme: 'default'
        };
    }

    /**
     * Calculates new state after adding XP.
     * Returns the new profile and any events that occurred (e.g. Level Up).
     */
    static addXp(profile: GamificationProfile, amount: number, reason: string): { newProfile: GamificationProfile, events: GamificationEventPayload[] } {
        const events: GamificationEventPayload[] = [];

        let newXp = profile.xp + amount;
        let newLevel = profile.level;
        let newGems = profile.gems;
        let newWeeklyXp = (profile.leagueWeeklyXp || 0) + amount;

        // Check Level Up
        // Current Level N requires LEVEL_THRESHOLDS[N] XP is wrong mental model usually.
        // Let's say Level 1 is 0-99, Level 2 is 100-299.
        // So if newXp >= LEVEL_THRESHOLDS[newLevel], we level up.
        // We might level up multiple times.

        while (newLevel < LEVEL_THRESHOLDS.length && newXp >= LEVEL_THRESHOLDS[newLevel]) {
            newLevel++;
            events.push({ type: 'LEVEL_UP', newLevel, timestamp: Date.now() });

            // Level Up Reward? Gems?
            const gemReward = 10 * newLevel; // Simple reward
            newGems += gemReward;
            events.push({ type: 'GEM_EARNED', amount: gemReward, reason: `Level ${newLevel} Bonus`, timestamp: Date.now() });
        }

        events.push({ type: 'XP_GAIN', amount, reason, timestamp: Date.now() });

        const newProfile: GamificationProfile = {
            ...profile,
            xp: newXp,
            level: newLevel,
            gems: newGems,
            leagueWeeklyXp: newWeeklyXp
        };

        return { newProfile, events };
    }

    /**
     * Checks and updates streak based on current time.
     * Should be called on app load or activity.
     */
    static checkStreak(profile: GamificationProfile): { newProfile: GamificationProfile, events: GamificationEventPayload[] } {
        const events: GamificationEventPayload[] = [];
        const now = new Date();
        const lastActivity = new Date(profile.lastActivityDate);

        // Strip time
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastDate = new Date(lastActivity.getFullYear(), lastActivity.getMonth(), lastActivity.getDate());

        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let newStreak = profile.currentStreak;
        let newFrozenDays = profile.frozenDays;

        if (diffDays === 0) {
            // Already active today, no change to streak count yet (or maybe we already incremented it?)
            // We only increment streak on the FIRST activity of the day.
            // But here we rely on the fact that if diffDays === 0, we simply update the timestamp later.
            return { newProfile: profile, events: [] };
        } else if (diffDays === 1) {
            // Consecutive day!
            newStreak += 1;
            events.push({ type: 'STREAK_MAINTAINED', amount: newStreak, timestamp: Date.now() });
        } else if (diffDays > 1) {
            // Missed a day (or more)
            // Check for freezes
            const daysMissed = diffDays - 1;
            if (profile.frozenDays >= daysMissed) {
                // Thaw
                newFrozenDays -= daysMissed;
                // Streak preserved (but not incremented? or preserved as is?)
                // Usually streak just stays same, doesn't increment for missed days.
                // But today is a NEW active day, so we should increment if we survived the gap?
                // Logic: Missed yesterday. Used freeze. Today is active. So streak continues + 1.
                newStreak += 1;
                events.push({ type: 'STREAK_MAINTAINED', amount: newStreak, reason: 'Freeze Used', timestamp: Date.now() });
            } else {
                // Freeze broken
                newStreak = 1; // Reset to 1 (starting today)
                events.push({ type: 'STREAK_LOST', timestamp: Date.now() });
            }
        }

        const newProfile: GamificationProfile = {
            ...profile,
            currentStreak: newStreak,
            frozenDays: newFrozenDays,
            lastActivityDate: now.toISOString()
        };

        return { newProfile, events };
    }
}
