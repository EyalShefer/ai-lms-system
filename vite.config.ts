import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // טוען משתנים מקבצים (.env)
  const envFile = loadEnv(mode, process.cwd(), '');

  // פונקציית עזר: מחפשת גם בקובץ וגם במערכת של השרת (Vercel)
  const getEnv = (key: string) => {
    const val = envFile[key] || process.env[key];
    return JSON.stringify(val || ""); // אם לא נמצא, מחזיר מחרוזת ריקה כדי לא לשבור
  };

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': getEnv('VITE_FIREBASE_API_KEY'),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': getEnv('VITE_FIREBASE_PROJECT_ID'),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      'import.meta.env.VITE_FIREBASE_APP_ID': getEnv('VITE_FIREBASE_APP_ID'),
      'import.meta.env.VITE_FIREBASE_MEASUREMENT_ID': getEnv('VITE_FIREBASE_MEASUREMENT_ID'),
      'import.meta.env.VITE_GEMINI_API_KEY': getEnv('VITE_GEMINI_API_KEY'),
    }
  }
})