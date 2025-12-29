import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'; // Import signInAnonymously
import type { User } from 'firebase/auth';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    mockLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("🔵 AuthProvider: מאזין לשינויי התחברות...");
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("🟢 AuthProvider: סטטוס משתמש השתנה:", user ? "מחובר (" + (user.email || 'Anonymous') + ")" : "מנותק");

            if (user && user.isAnonymous) {
                // Decorate anonymous user to look like Dev User in UI
                const devUser = Object.create(user);
                Object.defineProperty(devUser, 'email', { value: 'dev@test.com' });
                Object.defineProperty(devUser, 'displayName', { value: 'Wizdi Developer (Anon)' });
                setCurrentUser(devUser);
            } else {
                setCurrentUser(user);
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

    return (
        <AuthContext.Provider value={{ currentUser, loading, mockLogin }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};