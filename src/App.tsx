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

// --- הגדרות מערכת ---
const PERFORM_WIPE = false;
// -------------------------------------------------------

const AuthenticatedApp = () => {
  // הגדרת מצבים עם טיפוסים (TypeScript)
  const [mode, setMode] = useState<'list' | 'editor' | 'student' | 'dashboard'>('list');
  const [isStudentLink, setIsStudentLink] = useState(false);
  const { course, loadCourse } = useCourseStore();
  const { currentUser } = useAuth();

  // מנגנון מחיקת חירום (מושבת כרגע)
  useEffect(() => {
    const nukeCourses = async () => {
      if (PERFORM_WIPE && currentUser) {
        console.log("☢️ Starting Emergency Wipe...");
        try {
          const querySnapshot = await getDocs(collection(db, "courses"));
          if (querySnapshot.empty) {
            console.log("✅ No courses to delete.");
          } else {
            const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, "courses", d.id)));
            await Promise.all(deletePromises);
            console.log("✅ All courses deleted.");
            alert("ניקוי חירום בוצע בהצלחה.");
          }
        } catch (error) {
          console.error("❌ Wipe failed:", error);
        }
      }
    };
    nukeCourses();
  }, [currentUser]);

  // בדיקת קישור כניסה
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studentLinkID = params.get('studentCourseId');

    if (studentLinkID) {
      console.log("Student link detected:", studentLinkID);
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
    window.history.pushState({}, '', '/');
  };

  return (
    <div className="min-h-screen bg-gray-100 text-right font-sans" dir="rtl">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {mode !== 'list' && !isStudentLink && (
            <button onClick={handleBackToList} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-colors" title="חזור לרשימה">
              🔙
            </button>
          )}

          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🚀 AI-LMS: <span className="font-normal text-gray-600">
              {isStudentLink ? course?.title : (mode === 'list' ? 'המרכז למורה' : course?.title)}
            </span>
          </h1>
        </div>

        <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-bold items-center gap-2">
          {!isStudentLink && (
            <>
              <button onClick={() => setMode('editor')} className={`px-4 py-2 rounded-md transition-all ${mode === 'editor' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>✏️ עורך</button>
              <button onClick={() => setMode('student')} className={`px-4 py-2 rounded-md transition-all ${mode === 'student' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>👨‍🎓 תצוגת תלמיד</button>
              <button onClick={() => setMode('dashboard')} className={`px-4 py-2 rounded-md transition-all ${mode === 'dashboard' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>📊 דשבורד</button>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
            </>
          )}

          <div className="flex flex-col items-end text-xs px-2">
            <span className="text-gray-400">{currentUser?.email}</span>
            <button onClick={() => auth.signOut()} className="text-red-500 hover:underline">יציאה</button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-8">
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
  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-bold">טוען מערכת...</div>;
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