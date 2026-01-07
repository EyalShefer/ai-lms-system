import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '../types/user';

export const GamificationService = {
    /**
     * Updates the user's streak based on their last learning date.
     * Should be called when a user starts or completes a significant learning action.
     */
    updateStreak: async (userId: string): Promise<{ streak: number, message?: string }> => {
        if (!userId) return { streak: 0 };

        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return { streak: 0 };
        }

        const data = userSnap.data() as UserProfile;
        const today = new Date().toISOString().split('T')[0];
        const lastLearnDate = data.lastLearnDate || '';

        if (lastLearnDate === today) {
            // Already learned today, no streak change
            return { streak: data.streak || 0 };
        }

        // Calculate difference in days
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak = data.streak || 0;
        let message = '';

        if (lastLearnDate === yesterdayStr) {
            // Continued streak
            newStreak += 1;
            message = 'Streak Increased! 🔥';
        } else {
            // Broken streak (or first time)
            newStreak = 1;
            // Only show broken message if they had a streak before
            if ((data.streak || 0) > 0) message = 'Streak Reset 😢';
            else message = 'First Day! 🚀';
        }

        await updateDoc(userRef, {
            streak: newStreak,
            lastLearnDate: today,
            lastActive: serverTimestamp()
        });

        return { streak: newStreak, message };
    },

    /**
     * Adds XP to the user account
     */
    addXP: async (userId: string, amount: number) => {
        if (!userId || amount <= 0) return;

        const userRef = doc(db, 'users', userId);

        // Use atomic increment
        await updateDoc(userRef, {
            xp: increment(amount),
            lastActive: serverTimestamp()
        });
    },

    /**
     * Get user profile
     */
    getUserProfile: async (userId: string): Promise<UserProfile | null> => {
        if (!userId) return null;
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) return snap.data() as UserProfile;
        return null;
    },

    /**
     * Update email reports setting for teacher
     */
    updateEmailReportsSetting: async (userId: string, enabled: boolean): Promise<void> => {
        if (!userId) return;
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            emailReportsEnabled: enabled
        });
    }
};
