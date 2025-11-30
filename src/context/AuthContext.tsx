import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("🔵 AuthProvider: מאזין לשינויי התחברות...");
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("🟢 AuthProvider: סטטוס משתמש השתנה:", user ? "מחובר (" + user.email + ")" : "מנותק");
            setCurrentUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    // לוג בדיקה בכל רינדור
    console.log("🟡 AuthProvider Render: Loading =", loading, "| User =", currentUser?.email);

    return (
        <AuthContext.Provider value={{ currentUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};