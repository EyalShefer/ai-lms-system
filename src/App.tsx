import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import CourseEditor from './components/CourseEditor';
import CoursePlayer from './components/CoursePlayer';
import TeacherDashboard from './components/TeacherDashboard';
import Login from './components/Login';
import CourseList from './components/CourseList';
import { useCourseStore } from './context/CourseContext';
import { auth } from './firebase';

const AuthenticatedApp = () => {
  const [mode, setMode] = useState<'list' | 'editor' | 'student' | 'dashboard'>('list');
  const [isStudentLink, setIsStudentLink] = useState(false); // זיהוי האם הגיע מקישור תלמיד
  const { course, loadCourse } = useCourseStore();
  const { currentUser } = useAuth();

  // בדיקת קישור כניסה (Deep Link) - רץ פעם אחת בעלייה
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studentLinkID = params.get('studentCourseId');

    if (studentLinkID) {
      console.log("Student link detected:", studentLinkID);
      setIsStudentLink(true); // סימון שאנחנו במצב תלמיד
      loadCourse(studentLinkID);
      setMode('student'); // מעבר אוטומטי לנגן
    }
  }, []);

  const handleCourseSelect = (courseId: string) => {
    loadCourse(courseId);
    setMode('editor');
  };

  const handleBackToList = () => {
    setMode('list');
    // ניקוי URL אם צריך
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="min-h-screen bg-gray-100 text-right font-sans" dir="rtl">

      <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {/* כפתור חזור - מוצג רק אם זה לא מסך הרשימה ורק אם זה לא תלמיד */}
          {mode !== 'list' && !isStudentLink && (
            <button onClick={handleBackToList} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors" title="חזור לרשימת הקורסים">
              🔙
            </button>
          )}

          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🚀 AI-LMS: <span className="font-normal text-gray-600">
              {/* כותרת דינמית בהתאם למצב */}
              {isStudentLink ? course.title : (mode === 'list' ? 'המרכז למורה' : course.title)}
            </span>
          </h1>
        </div>

        <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-bold items-center gap-2">

          {/* --- האזור הקריטי: הסתרת כפתורי מורה לתלמידים --- */}
          {!isStudentLink && (
            <>
              <button onClick={() => setMode('editor')} className={`px-4 py-2 rounded-md transition-all ${mode === 'editor' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>✏️ עורך</button>
              <button onClick={() => setMode('student')} className={`px-4 py-2 rounded-md transition-all ${mode === 'student' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>👨‍🎓 תלמיד</button>
              <button onClick={() => setMode('dashboard')} className={`px-4 py-2 rounded-md transition-all ${mode === 'dashboard' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>📊 דשבורד</button>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
            </>
          )}

          {/* כפתור יציאה - קיים תמיד */}
          <div className="flex flex-col items-end text-xs px-2">
            <span className="text-gray-400">{currentUser?.email}</span>
            <button onClick={() => auth.signOut()} className="text-red-500 hover:underline">יציאה</button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-8">
        {/* אם זה קישור תלמיד - מציגים רק את הנגן. אחרת - את כל האופציות */}
        {isStudentLink ? (
          <CoursePlayer />
        ) : (
          <>
            {mode === 'list' && <CourseList onSelectCourse={handleCourseSelect} />}
            {mode === 'editor' && <CourseEditor />}
            {mode === 'student' && <CoursePlayer />}
            {mode === 'dashboard' && <TeacherDashboard />}
          </>
        )}
      </main>
    </div>
  );
};

const AppWrapper = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center">טוען...</div>;
  return currentUser ? <AuthenticatedApp /> : <Login />;
};

function App() {
  return <AppWrapper />;
}


export default App;