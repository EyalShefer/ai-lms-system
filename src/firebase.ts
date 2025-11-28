import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- שלב הדיבאג: בדיקה מה השרת רואה ---
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// זה יקפיץ חלון מיד כשהאתר עולה
if (typeof window !== "undefined") {
    alert(
        `Baudika Debug:\n` +
        `1. האם המפתח קיים? ${apiKey ? "כן" : "לא"}\n` +
        `2. 5 תווים ראשונים: ${apiKey ? apiKey.substring(0, 5) : "כלום"}`
    );
}
// ----------------------------------------

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);