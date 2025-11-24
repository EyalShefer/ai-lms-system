import React, { useState } from 'react';
import CourseEditor from './components/CourseEditor';
import CoursePlayer from './components/CoursePlayer'; // <--- עכשיו זה יעבוד כי יצרנו את הקובץ!
import { useCourseStore } from './context/CourseContext';

function App() {
  const [mode, setMode] = useState<'editor' | 'student'>('editor');
  const { course } = useCourseStore();

  return (
    <div className="min-h-screen bg-gray-100 text-right font-sans" dir="rtl">

      <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10 mb-4">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          🚀 AI-LMS: <span className="font-normal text-gray-600">{course.title}</span>
        </h1>

        <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-bold">
          <button
            onClick={() => setMode('editor')}
            className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${mode === 'editor' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span>✏️</span> עורך (מורה)
          </button>
          <button
            onClick={() => setMode('student')}
            className={`px-4 py-2 rounded-md transition-all flex items-center gap-2 ${mode === 'student' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span>👨‍🎓</span> לומד (תלמיד)
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-8">
        {mode === 'editor' ? <CourseEditor /> : <CoursePlayer />}
      </main>
    </div>
  );
}

export default App;