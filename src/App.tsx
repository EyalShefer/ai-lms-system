import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import CourseEditor from './components/CourseEditor';
import CoursePlayer from './components/CoursePlayer';
import TeacherDashboard from './components/TeacherDashboard';
import Login from './components/Login';
import CourseList from './components/CourseList';
import { useCourseStore, CourseProvider } from './context/CourseContext';
import { auth, db } from './firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import {
  IconEdit, IconStudent, IconChart,
  IconBack, IconLogOut
} from './icons';

const PERFORM_WIPE = false;

const AuthenticatedApp = () => {
  const [mode, setMode] = useState<'list' | 'editor' | 'student' | 'dashboard'>('list');
  const [isStudentLink, setIsStudentLink] = useState(false);
  const { course, loadCourse } = useCourseStore();
  const { currentUser } = useAuth();

  // בדיקת קישור תלמיד
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studentLinkID = params.get('studentCourseId');

    if (studentLinkID) {
      setIsStudentLink(true);
      loadCourse(studentLinkID);
      setMode('student');
    }
  }, []);

  const handleCourseSelect = (courseId: string) => {
    loadCourse(courseId);
    setMode('editor');
  };

  const handleBackToList = () => {
    setMode('list');
    // איפוס ה-URL אם היה בו מזהה קורס
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-right font-sans" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/40 shadow-sm px-6 py-4 flex justify-between items-center transition-all">

        {/* צד ימין: לוגו וכפתור חזרה */}
        <div className="flex items-center gap-6">
          {/* כפתור חזרה - מופיע תמיד כשאנחנו לא ברשימה הראשית ולא בקישור תלמיד חיצוני */}
          {mode !== 'list' && !isStudentLink && (
            <button
              onClick={handleBackToList}
              className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer"
              title="חזור לרשימת הקורסים"
            >
              <IconBack className="w-5 h-5 rotate-180" />
              <span>חזור לרשימה</span>
            </button>
          )}

          {/* לוגו - לחיצה עליו גם מחזירה לרשימה */}
          <div
            className={`flex items-center gap-3 tracking-tight ${!isStudentLink ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={!isStudentLink ? handleBackToList : undefined}
          >
            <img
              src="/Logowizdi.png"
              alt="Wizdi Studio Logo"
              className="h-10 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
              Wizdi Studio
            </span>
            {course?.title && mode !== 'list' && (
              <span className="font-normal text-gray-400 text-lg border-r border-gray-300 pr-3 mr-1 hidden md:inline-block">
                {course.title}
              </span>
            )}
          </div>
        </div>

        {/* מרכז: תפריט ניווט (מופיע רק כשאנחנו בתוך קורס) */}
        <div className="flex items-center gap-2">
          {mode !== 'list' && !isStudentLink && (
            <div className="flex items-center gap-2 bg-white/40 p-1.5 rounded-2xl border border-white/50 backdrop-blur-md shadow-inner">
              <button
                onClick={() => setMode('editor')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${mode === 'editor'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
                  }`}
              >
                <IconEdit className="w-4 h-4" /> <span className="hidden sm:inline">עורך</span>
              </button>

              <button
                onClick={() => setMode('student')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${mode === 'student'
                  ? 'bg-white text-green-600 shadow-md'
                  : 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
                  }`}
              >
                <IconStudent className="w-4 h-4" /> <span className="hidden sm:inline">תלמיד</span>
              </button>

              <button
                onClick={() => setMode('dashboard')}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-sm ${mode === 'dashboard'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:bg-white/50 hover:text-gray-800'
                  }`}
              >
                <IconChart className="w-4 h-4" /> <span className="hidden sm:inline">דשבורד</span>
              </button>
            </div>
          )}
        </div>

        {/* צד שמאל: משתמש ויציאה */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-sm font-bold text-gray-700">{currentUser?.email?.split('@')[0]}</span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">מחובר</span>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="bg-red-50 hover:bg-red-100 text-red-500 p-2.5 rounded-xl transition-colors border border-red-100 shadow-sm"
            title="יציאה מהמערכת"
          >
            <IconLogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-8">
        {PERFORM_WIPE ? (
          <div className="p-10 text-center bg-red-50 border border-red-200 rounded-xl mt-10">
            <h2 className="text-2xl font-bold text-red-600 mb-2">☢️ מצב ניקוי מופעל</h2>
            <p>הנתונים נמחקים כעת...</p>
          </div>
        ) : isStudentLink ? (
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
  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-bold bg-gray-50">טוען מערכת...</div>;
  return currentUser ? <AuthenticatedApp /> : <Login />;
};

function App() {
  return (
    <AuthProvider>
      <CourseProvider>
        <AppWrapper />
      </CourseProvider>
    </AuthProvider>
  );
}

export default App;