import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// התיקון: אנחנו מייבאים את זה מתיקיית context
import { CourseProvider } from './context/CourseContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CourseProvider>
      <App />
    </CourseProvider>
  </React.StrictMode>,
)