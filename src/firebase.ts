import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// לוג בדיקה - יופיע בקונסול של הדפדפן
const key = import.meta.env.VITE_FIREBASE_API_KEY;
console.log("🔥 Firebase Key Check:", key ? "OK (Exists)" : "MISSING (Undefined)");

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// אתחול רק אם יש מפתח (מונע קריסה מכוערת)
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);