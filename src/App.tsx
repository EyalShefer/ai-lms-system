import React, { useState, useEffect, Suspense } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './components/Login';
import { useCourseStore, CourseProvider } from './context/CourseContext';
import { auth, db, storage } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateCoursePlan } from './gemini';

// --- Lazy Loading ---
const HomePage = React.lazy(() => import('./components/HomePage'));
const CourseEditor = React.lazy(() => import('./components/CourseEditor'));
const CoursePlayer = React.lazy(() => import('./components/CoursePlayer'));
const TeacherDashboard = React.lazy(() => import('./components/TeacherDashboard'));
const IngestionWizard = React.lazy(() => import('./components/IngestionWizard'));

// --- Icons ---
const IconBackSimple = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>;
const IconLogOutSimple = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
const IconEyeSimple = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
const IconEditSimple = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
    <span>טוען רכיב...</span>
  </div>
);

const AuthenticatedApp = () => {
  const [mode, setMode] = useState('list');
  const [isStudentLink, setIsStudentLink] = useState(false);
  const [wizardMode, setWizardMode] = useState(null);

  const { loadCourse } = useCourseStore();
  const { currentUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studentLinkID = params.get('studentCourseId');

    if (studentLinkID) {
      setIsStudentLink(true);
      loadCourse(studentLinkID);
      setMode('student');
    }
  }, [loadCourse]);

  const handleCourseSelect = (courseId) => {
    loadCourse(courseId);
    setMode('editor');
  };

  const handleBackToList = () => {
    setMode('list');
    window.history.pushState({}, '', '/');
  };

  const toggleViewMode = () => {
    setMode(mode === 'editor' ? 'student' : 'editor');
  };

  const fileToGenerativePart = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        const base64Data = base64String.split(',')[1];
        resolve({ base64: base64Data, mimeType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- הפונקציה המתוקנת ---
  const handleWizardComplete = async (wizardData) => {
    if (!currentUser) return;

    try {
      let fileUrl = null;
      let fileType = null;
      let fileName = null;
      let aiFileData = undefined;

      if (wizardData.file) {
        console.log("Processing file...");
        try {
          aiFileData = await fileToGenerativePart(wizardData.file);
        } catch (e) { console.error("Error converting file", e); }

        const storageRef = ref(storage, `uploads/${currentUser.uid}/${Date.now()}_${wizardData.file.name}`);
        const snapshot = await uploadBytes(storageRef, wizardData.file);
        fileUrl = await getDownloadURL(snapshot.ref);
        fileType = wizardData.file.type;
        fileName = wizardData.file.name;
      }

      // --- לוג ביקורת ---
      console.log("🚀 Generating with AI... Wizard Data:", wizardData);

      // --- חילוץ חכם של הגיל ---
      let extractedGrade = "כללי";
      if (wizardData.grade) extractedGrade = wizardData.grade;
      else if (wizardData.gradeLevel) extractedGrade = wizardData.gradeLevel;
      else if (wizardData.settings?.grade) extractedGrade = wizardData.settings.grade;

      if (Array.isArray(extractedGrade)) extractedGrade = extractedGrade[0];

      console.log("🎯 Extracted Grade for AI:", extractedGrade);

      const topicForAI = wizardData.topic || fileName || "נושא כללי";
      const courseMode = wizardData.settings?.courseMode || 'learning';
      const userSubject = wizardData.settings?.subject || "כללי";

      let aiSyllabus = [];
      try {
        // --- התיקון כאן: הוספת userSubject כפרמטר רביעי ---
        // זה מבטיח שהיצירה הראשונית כבר תהיה מותאמת למקצוע
        aiSyllabus = await generateCoursePlan(topicForAI, extractedGrade, aiFileData, userSubject);
        console.log("AI Success");
      } catch (aiError) {
        console.error("AI Failed:", aiError);
        aiSyllabus = [{ id: "fallback-" + Date.now(), title: "מבוא (ידני)", learningUnits: [] }];
        alert("ה-AI נתקל בבעיה, נוצר שלד בסיסי.");
      }

      const { file, ...cleanWizardData } = wizardData;
      const newCourseData = {
        title: topicForAI,
        teacherId: currentUser.uid,
        targetAudience: extractedGrade,
        subject: userSubject,
        gradeLevel: extractedGrade,
        syllabus: aiSyllabus,
        mode: courseMode,
        createdAt: serverTimestamp(),
        wizardData: { ...cleanWizardData, fileUrl, fileName, fileType }
      };

      const docRef = await addDoc(collection(db, "courses"), newCourseData);

      setWizardMode(null);
      loadCourse(docRef.id);
      setMode('editor');

    } catch (error) {
      console.error("Error:", error);
      alert("שגיאה: " + error.message);
    }
  };

  const headerClass = mode === 'student' && !isStudentLink
    ? "sticky top-0 z-50 bg-indigo-50/90 backdrop-blur-md border-b border-indigo-100 shadow-sm px-6 py-4 flex justify-between items-center transition-all"
    : "sticky top-0 z-50 glass border-b border-white/40 shadow-sm px-6 py-4 flex justify-between items-center transition-all";

  return (
    <div className="min-h-screen bg-gray-50 text-right font-sans" dir="rtl">
      <header className={headerClass}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleBackToList}>
          <img src="/WizdiLogo.png" alt="Wizdi Studio" className="h-12 w-auto object-contain hover:opacity-90 transition-opacity" />
        </div>
        <div className="flex items-center gap-4">
          {mode !== 'list' && !isStudentLink && (
            <button onClick={handleBackToList} className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer text-sm">
              <IconBackSimple /> <span>חזרה</span>
            </button>
          )}
          {(mode === 'editor' || mode === 'student') && !isStudentLink && (
            <button onClick={toggleViewMode} className={`px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer text-sm ${mode === 'editor' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'}`}>
              {mode === 'editor' ? <><IconEyeSimple /> <span>תצוגת תלמיד</span></> : <><IconEditSimple /> <span>חזור לעריכה</span></>}
            </button>
          )}
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button onClick={() => auth.signOut()} className="bg-red-50 hover:bg-red-100 text-red-500 p-2.5 rounded-xl transition-colors" title="התנתק">
            <IconLogOutSimple />
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Suspense fallback={<LoadingSpinner />}>
          {isStudentLink ? <CoursePlayer /> : (
            <>
              {mode === 'list' && <HomePage onCreateNew={(m) => setWizardMode(m)} onNavigateToDashboard={() => setMode('dashboard')} />}
              {mode === 'editor' && <CourseEditor onBack={handleBackToList} />}
              {mode === 'student' && <CoursePlayer />}
              {mode === 'dashboard' && <TeacherDashboard onEditCourse={handleCourseSelect} />}
            </>
          )}
        </Suspense>
      </main>

      {wizardMode && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/50 backdrop-blur-sm">
          <div className="min-h-screen flex items-center justify-center p-4">
            <Suspense fallback={<div className="bg-white p-6 rounded-2xl"><LoadingSpinner /></div>}>
              <IngestionWizard initialMode={wizardMode} onComplete={handleWizardComplete} onCancel={() => setWizardMode(null)} />
            </Suspense>
          </div>
        </div>
      )}
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