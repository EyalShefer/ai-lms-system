export interface UserProfile {
    uid: string;
    displayName: string;
    email?: string;
    photoURL?: string;

    // Gamification
    xp: number;
    streak: number;
    lastLearnDate: string; // YYYY-MM-DD
}
