import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// פונקציית עזר למציאת המשתנה (מנסה גם import.meta וגם process.env)
const getEnv = (key: string) => {
    return import.meta.env[key] || (process.env[key] as string);
};

// --- דיבאג ---
const apiKey = getEnv('VITE_FIREBASE_API_KEY');
if (typeof window !== "undefined") {
    console.log("Firebase Key Check:", apiKey ? "OK" : "MISSING");
}
// -------------

const firebaseConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID'),
    measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID')
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);