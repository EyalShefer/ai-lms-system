import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { CourseProvider } from './context/CourseContext'
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* AuthProvider חייב לעטוף את הכל כדי שנדע מי המשתמש */}
    <AuthProvider>
      <CourseProvider>
        <App />
      </CourseProvider>
    </AuthProvider>
  </React.StrictMode>,
)