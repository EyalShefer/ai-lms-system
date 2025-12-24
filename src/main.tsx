import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx' // מחברים חזרה את הלב של המערכת
import './index.css'

// בדיקה בקונסול
console.log("🚀 Main: טוען את App...");

const root = document.getElementById('root');

import { BrowserRouter } from 'react-router-dom';

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
} else {
  console.error("❌ שגיאה קריטית: אלמנט root חסר");
}