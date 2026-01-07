export interface UserProfile {
    uid: string;
    displayName: string;
    email?: string;
    photoURL?: string;

    // Gamification
    xp: number;
    streak: number;
    lastLearnDate: string; // YYYY-MM-DD

    // Teacher settings
    emailReportsEnabled?: boolean; // Receive email reports when task due dates pass
}
