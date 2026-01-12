import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { User } from 'firebase/auth';
import type { LicenseTier } from '../types/licensing';

// Usage stats interface
interface UsageStats {
    tier: LicenseTier;
    status: string;
    usage: {
        textTokens: { used: number; limit: number; percent: number };
        images: { used: number; limit: number; percent: number };
        audio: { used: number; limit: number; percent: number };
        podcasts: { used: number; limit: number; percent: number };
    };
    features: Record<string, boolean>;
    resetDate: string;
}

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    isAdmin: boolean;
    institutionId: string | null;
    userRole: 'admin' | 'teacher' | 'student' | null;
    usageStats: UsageStats | null;
    refreshUsageStats: () => Promise<void>;
    mockLogin: () => void;
    googleClassroomToken: string | null;
    connectClassroom: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [institutionId, setInstitutionId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<'admin' | 'teacher' | 'student' | null>(null);
    const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
    const [googleClassroomToken, setGoogleClassroomToken] = useState<string | null>(null);

    // Function to refresh usage stats
    const refreshUsageStats = async () => {
        if (!currentUser) {
            setUsageStats(null);
            return;
        }

        try {
            const getMyUsageStats = httpsCallable(functions, 'getMyUsageStats');
            const result = await getMyUsageStats();
            setUsageStats(result.data as UsageStats);
        } catch (error) {
            console.warn('Failed to fetch usage stats:', error);
            // Set default free tier stats on error
            setUsageStats({
                tier: 'free',
                status: 'active',
                usage: {
                    textTokens: { used: 0, limit: 50000, percent: 0 },
                    images: { used: 0, limit: 10, percent: 0 },
                    audio: { used: 0, limit: 10, percent: 0 },
                    podcasts: { used: 0, limit: 2, percent: 0 },
                },
                features: {
                    lessonGeneration: true,
                    examGeneration: true,
                    imageGeneration: true,
                    podcastGeneration: true,
                    mindMapGeneration: true,
                    knowledgeBase: false,
                    advancedAnalytics: false,
                },
                resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
            });
        }
    };

    useEffect(() => {
        console.log("🔵 AuthProvider: מאזין לשינויי התחברות...");
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log("🟢 AuthProvider: סטטוס משתמש השתנה:", user ? "מחובר (" + (user.email || 'Anonymous') + ")" : "מנותק");

            if (user && user.isAnonymous) {
                // Decorate anonymous user to look like Dev User in UI
                const devUser = Object.create(user);
                Object.defineProperty(devUser, 'email', { value: 'dev@test.com' });
                Object.defineProperty(devUser, 'displayName', { value: 'Wizdi Developer (Anon)' });
                setCurrentUser(devUser);
                setIsAdmin(false);
                setInstitutionId(null);
                setUserRole('teacher');
            } else {
                setCurrentUser(user);

                // Check if user is admin and get institution info
                if (user) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        const userData = userDoc.data();
                        const hasAdminRole = userData?.roles?.includes('admin') || userData?.isAdmin === true;
                        setIsAdmin(hasAdminRole);
                        setInstitutionId(userData?.institutionId || null);
                        setUserRole(userData?.role || 'teacher');
                        console.log("👤 Admin status:", hasAdminRole, "| Institution:", userData?.institutionId || 'none');
                    } catch (error) {
                        console.warn("Failed to check admin status:", error);
                        setIsAdmin(false);
                        setInstitutionId(null);
                        setUserRole(null);
                    }
                } else {
                    setIsAdmin(false);
                    setInstitutionId(null);
                    setUserRole(null);
                    setUsageStats(null);
                }
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    // Fetch usage stats when user changes
    useEffect(() => {
        if (currentUser && !currentUser.isAnonymous) {
            refreshUsageStats();
        }
    }, [currentUser]);

    // לוג בדיקה בכל רינדור
    console.log("🟡 AuthProvider Render: Loading =", loading, "| User =", currentUser?.email);

    const mockLogin = async () => {
        console.log("⚡ Dev Login Activated (Anonymous Auth)");
        try {
            await signInAnonymously(auth);
            // State update handled by onAuthStateChanged
        } catch (error) {
            console.error("Dev Login Failed:", error);
            alert("שגיאה בהתחברות למצב פיתוח");
        }
    };

    const connectClassroom = async () => {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
        provider.addScope('https://www.googleapis.com/auth/classroom.coursework.students');
        provider.addScope('https://www.googleapis.com/auth/classroom.rosters.readonly'); // Optional, helpful for names

        try {
            // We use signInWithPopup to re-authenticate/link or just get the token
            // Note: If user is already signed in, this might prompt them to select account again
            // prompting 'select_account' ensures we get the right one for Classroom
            provider.setCustomParameters({ prompt: 'select_account' });

            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;

            if (token) {
                setGoogleClassroomToken(token);
                console.log("✅ Google Classroom Token Acquired");
            }
        } catch (error) {
            console.error("❌ Failed to connect to Classroom:", error);
            alert("החיבור לגוגל קלאסרום נכשל. אנא נסה שוב.");
        }
    };

    return (
        <AuthContext.Provider value={{
            currentUser,
            loading,
            isAdmin,
            institutionId,
            userRole,
            usageStats,
            refreshUsageStats,
            mockLogin,
            googleClassroomToken,
            connectClassroom
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
