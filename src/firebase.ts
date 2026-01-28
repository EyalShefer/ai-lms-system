import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { connectFirestoreEmulator } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
    initializeAppCheck,
    ReCaptchaEnterpriseProvider,
    ReCaptchaV3Provider,
    getToken
} from "firebase/app-check";

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
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Initialize Analytics (only in browser environment and if supported)
let analytics: any = null;
if (typeof window !== 'undefined') {
    isSupported().then(supported => {
        if (supported) {
            analytics = getAnalytics(app);
            console.log('📊 Firebase Analytics initialized');
        }
    }).catch(() => {
        console.log('📊 Firebase Analytics not supported in this environment');
    });
}

export { analytics };

// --- APP CHECK INITIALIZATION ---
// Protects backend APIs from abuse by verifying requests come from our app
// Setup: Enable App Check in Firebase Console and add reCAPTCHA site key
let appCheck: any = null;

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

if (typeof window !== 'undefined' && RECAPTCHA_SITE_KEY) {
    try {
        // Use debug token in development
        if (import.meta.env.DEV) {
            // @ts-ignore - Debug token for local development
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
        }

        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
            isTokenAutoRefreshEnabled: true
        });
        console.log('🛡️ Firebase App Check initialized');
    } catch (error) {
        console.warn('🛡️ Firebase App Check initialization failed:', error);
    }
}

export { appCheck };

/**
 * Get App Check token for manual API calls
 * Use this when calling external APIs that need verification
 */
export async function getAppCheckToken(): Promise<string | null> {
    if (!appCheck) {
        console.warn('App Check not initialized');
        return null;
    }

    try {
        const tokenResult = await getToken(appCheck, false);
        return tokenResult.token;
    } catch (error) {
        console.error('Failed to get App Check token:', error);
        return null;
    }
}

// --- LOCAL EMULATOR CONNECTION ---
// Emulator connection removed to deploy to production (Java missing locally)
// if (window.location.hostname === "localhost") {
//     console.log("🔧 Localhost detected! Connecting to Emulators...");
//     connectFunctionsEmulator(functions, "localhost", 5001);
//     connectFirestoreEmulator(db, "localhost", 8080);
// }

export default app;