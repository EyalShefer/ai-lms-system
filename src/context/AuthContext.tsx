import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    isAdmin: boolean;
    mockLogin: () => void;
    googleClassroomToken: string | null;
    connectClassroom: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [googleClassroomToken, setGoogleClassroomToken] = useState<string | null>(null);

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
            } else {
                setCurrentUser(user);

                // Check if user is admin
                if (user) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', user.uid));
                        const userData = userDoc.data();
                        const hasAdminRole = userData?.roles?.includes('admin') || userData?.isAdmin === true;
                        setIsAdmin(hasAdminRole);
                        console.log("👤 Admin status:", hasAdminRole);
                    } catch (error) {
                        console.warn("Failed to check admin status:", error);
                        setIsAdmin(false);
                    }
                } else {
                    setIsAdmin(false);
                }
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

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
        <AuthContext.Provider value={{ currentUser, loading, isAdmin, mockLogin, googleClassroomToken, connectClassroom }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
