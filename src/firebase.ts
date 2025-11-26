import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// הנתונים שהעתקנו מהתמונה שלך:
const firebaseConfig = {
    apiKey: "AIzaSyAxISC0BPJ9kQks32QuanvhxoUB-ZQGsco",
    authDomain: "ai-lms-app-31c7e.firebaseapp.com",
    projectId: "ai-lms-app-31c7e",
    storageBucket: "ai-lms-app-31c7e.firebasestorage.app",
    messagingSenderId: "703290427762",
    appId: "1:703290427762:web:ea12e93f0ae7373dac75eb",
    measurementId: "G-SEZG6PBWHM"
};

// אתחול החיבור
const app = initializeApp(firebaseConfig);

// ייצוא המשתנה שמאפשר לשמור ולקרוא נתונים
export const db = getFirestore(app);