import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { CourseProvider } from './context/CourseContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* עוטפים את האפליקציה בניהול המידע (Context) */}
    <CourseProvider>
      <App />
    </CourseProvider>
  </React.StrictMode>,
)