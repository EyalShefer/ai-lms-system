import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // טעינת משתנים (כולל משתני מערכת של ורסל)
  const env = loadEnv(mode, process.cwd(), '');

  // --- מלשין: הדפסה ללוג של השרת ---
  console.log("---------------------------------------------------");
  console.log("🔍 VERCEL BUILD DEBUG:");
  console.log("API KEY Exists?", !!env.VITE_FIREBASE_API_KEY);
  console.log("API KEY Start:", env.VITE_FIREBASE_API_KEY ? env.VITE_FIREBASE_API_KEY.substring(0, 5) : "MISSING");
  console.log("---------------------------------------------------");
  // ------------------------------------

  return {
    plugins: [react()],
    // הזרקה בטוחה
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': JSON.stringify(env.VITE_FIREBASE_MEASUREMENT_ID),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    }
  }
})