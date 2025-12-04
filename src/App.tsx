import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import CourseEditor from './components/CourseEditor';
import CoursePlayer from './components/CoursePlayer';
import TeacherDashboard from './components/TeacherDashboard';
import Login from './components/Login';
import CourseList from './components/CourseList';
import IngestionWizard from './components/IngestionWizard';
import { useCourseStore, CourseProvider } from './context/CourseContext';
import { auth, db, storage } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateCoursePlan } from './gemini';
import { IconBack, IconLogOut, IconEdit, IconChart } from './icons';

// אייקון עין לתצוגה מקדימה
const IconEye = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);

const AuthenticatedApp = () => {
  const [mode, setMode] = useState<'list' | 'editor' | 'student' | 'dashboard'>('list');
  const [isStudentLink, setIsStudentLink] = useState(false);
  const [wizardMode, setWizardMode] = useState<'learning' | 'exam' | null>(null);

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

  const handleCourseSelect = (courseId: string) => {
    loadCourse(courseId);
    setMode('editor');
  };

  const handleBackToList = () => {
    setMode('list');
    window.history.pushState({}, '', '/');
  };

  const toggleViewMode = () => {
    if (mode === 'editor') {
      setMode('student');
    } else {
      setMode('editor');
    }
  };

  const fileToGenerativePart = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve({ base64: base64Data, mimeType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleWizardComplete = async (wizardData: any) => {
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

      console.log("Generating with AI...");
      const topicForAI = wizardData.topic || fileName || "נושא כללי";
      const courseMode = wizardData.settings?.courseMode || 'learning';

      let aiSyllabus = [];
      try {
        aiSyllabus = await generateCoursePlan(topicForAI, courseMode, aiFileData);
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
        targetAudience: wizardData.settings?.grade || "כללי",
        subject: wizardData.settings?.subject || "כללי",
        syllabus: aiSyllabus,
        mode: courseMode,
        createdAt: serverTimestamp(),
        wizardData: { ...cleanWizardData, fileUrl, fileName, fileType }
      };

      const docRef = await addDoc(collection(db, "courses"), newCourseData);
      setWizardMode(null);
      loadCourse(docRef.id);
      setMode('editor');

    } catch (error: any) {
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

        {/* לוגו בלבד */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleBackToList}>
          <img
            src="/WizdiLogo.png"
            alt="Wizdi Studio"
            className="h-12 w-auto object-contain hover:opacity-90 transition-opacity"
          />
        </div>

        <div className="flex items-center gap-4">

          {/* כפתור לוח בקרת מורה - מופיע רק בדף הבית */}
          {mode === 'list' && !isStudentLink && (
            <button
              onClick={() => setMode('dashboard')}
              className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer text-sm"
            >
              <IconChart className="w-5 h-5" /> <span>לוח בקרת מורה</span>
            </button>
          )}

          {/* כפתור חזרה לרשימה - מופיע בכל שאר המצבים */}
          {mode !== 'list' && !isStudentLink && (
            <button onClick={handleBackToList} className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer text-sm">
              <IconBack className="w-5 h-5 rotate-180" /> <span>רשימה</span>
            </button>
          )}

          {(mode === 'editor' || mode === 'student') && !isStudentLink && (
            <button
              onClick={toggleViewMode}
              className={`px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer text-sm ${mode === 'editor'
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'
                }`}
            >
              {mode === 'editor' ? (
                <>
                  <IconEye className="w-5 h-5" /> <span>תצוגת תלמיד</span>
                </>
              ) : (
                <>
                  <IconEdit className="w-5 h-5" /> <span>חזור לעריכה</span>
                </>
              )}
            </button>
          )}

          <div className="h-6 w-px bg-gray-300 mx-1"></div>

          <button onClick={() => auth.signOut()} className="bg-red-50 hover:bg-red-100 text-red-500 p-2.5 rounded-xl transition-colors" title="התנתק">
            <IconLogOut className="w-5 h-5" />
          </button>
        </div>

      </header>

      <main className="container mx-auto px-4 py-8">
        {isStudentLink ? <CoursePlayer /> : (
          <>
            {mode === 'list' && (
              <CourseList
                onSelectCourse={handleCourseSelect}
                onCreateNew={(m) => setWizardMode(m)}
              />
            )}

            {mode === 'editor' && <CourseEditor />}

            {mode === 'student' && <CoursePlayer />}

            {mode === 'dashboard' && <TeacherDashboard />}
          </>
        )}
      </main>

      {wizardMode && (
        <IngestionWizard initialMode={wizardMode} onComplete={handleWizardComplete} onCancel={() => setWizardMode(null)} />
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