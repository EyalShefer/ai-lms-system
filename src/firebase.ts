import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- הוסף את זה ---
const debugKey = import.meta.env.VITE_FIREBASE_API_KEY;
console.log("🔍 Firebase Debug Check:");
console.log("1. Key Exists?", !!debugKey); // יחזיר true או false
console.log("2. Key First 5 chars:", debugKey ? debugKey.substring(0, 5) : "MISSING");
console.log("3. Auth Domain:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
// ------------------

// טעינת המשתנים מהסביבה (עובד גם במחשב וגם ב-Vercel)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// אתחול האפליקציה
const app = initializeApp(firebaseConfig);

// ייצוא השירותים (ללא persistence שגורם לתקיעות)
export const db = getFirestore(app);
export const auth = getAuth(app);