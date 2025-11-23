import React from 'react';
import CourseEditor from './components/CourseEditor';
import { CourseProvider } from './context/CourseContext';

function App() {
  return (
    <CourseProvider>
      <div className="min-h-screen bg-gray-100 text-right" dir="rtl">
        <header className="bg-blue-600 text-white p-4 shadow-lg">
          <h1 className="text-2xl font-bold text-center">מערכת AI-LMS (גרסת פיתוח)</h1>
        </header>

        <main className="py-8">
          <CourseEditor />
        </main>
      </div>
    </CourseProvider>
  );
}

export default App;
