import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import CourseEditor from './components/CourseEditor';
import CoursePlayer from './components/CoursePlayer';
import { useCourseStore } from './context/CourseContext';

// רכיב עוטף לתצוגת הניווט העליון (רק למורה)
const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { course } = useCourseStore();

  // אם אנחנו במסך תלמיד, לא מציגים את הסרגל העליון של המורה!
  const isStudentView = location.pathname.includes('/course/');

  return (
    <div className="min-h-screen bg-gray-100 text-right font-sans" dir="rtl">
      {!isStudentView && (
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🚀 Studio: <span className="font-normal text-gray-600">{course.title}</span>
          </h1>

          <div className="flex gap-3">
            <Link to="/" className={`px-4 py-2 rounded-md font-bold transition-all ${location.pathname === '/' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              ✏️ עורך
            </Link>

            {/* כפתור "פרסם" שמייצר את הקישור */}
            <button
              onClick={() => {
                const url = `${window.location.origin}/course/view`;
                navigator.clipboard.writeText(url);
                alert(`הקישור לתלמיד הועתק ללוח!\n${url}\n(שלח אותו לתלמידים)`);
                window.open(url, '_blank'); // פותח בחלון חדש לבדיקה
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md font-bold shadow-sm hover:bg-green-700 flex items-center gap-2"
            >
              🔗 הפק קישור לתלמיד
            </button>
          </div>
        </header>
      )}

      <main className={isStudentView ? "h-screen w-screen" : "container mx-auto px-4 py-8"}>
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* נתיב ראשי: העורך של המורה */}
          <Route path="/" element={<CourseEditor />} />

          {/* נתיב ציבורי: הצד של התלמיד (נקי לגמרי) */}
          <Route path="/course/view" element={<CoursePlayer />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;