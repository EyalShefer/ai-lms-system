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
// התיקון כאן: ייבוא מקובץ שכן (באותה תיקייה)
import { generateCoursePlan } from './gemini';
import {
  IconEdit, IconStudent, IconChart,
  IconBack, IconLogOut
} from './icons';

const PERFORM_WIPE = false;

const AuthenticatedApp = () => {
  const [mode, setMode] = useState<'list' | 'editor' | 'student' | 'dashboard'>('list');
  const [isStudentLink, setIsStudentLink] = useState(false);
  const [wizardMode, setWizardMode] = useState<'learning' | 'exam' | null>(null);

  const { course, loadCourse } = useCourseStore();
  const { currentUser } = useAuth();

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
    window.history.pushState({}, '', '/');
  };

  // המרת קובץ ל-Base64
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

      // 1. קובץ: העלאה + הכנה ל-AI
      if (wizardData.file) {
        console.log("מעבד קובץ...");
        try {
          aiFileData = await fileToGenerativePart(wizardData.file);
        } catch (e) { console.error("Error converting file", e); }

        const storageRef = ref(storage, `uploads/${currentUser.uid}/${Date.now()}_${wizardData.file.name}`);
        const snapshot = await uploadBytes(storageRef, wizardData.file);
        fileUrl = await getDownloadURL(snapshot.ref);
        fileType = wizardData.file.type;
        fileName = wizardData.file.name;
      }

      // 2. AI
      console.log("שולח ל-AI...");
      const topicForAI = wizardData.topic || fileName || "נושא כללי";
      const courseMode = wizardData.settings?.courseMode || 'learning';

      let aiSyllabus = [];
      try {
        aiSyllabus = await generateCoursePlan(topicForAI, courseMode, aiFileData);
        console.log("AI סיים בהצלחה");
      } catch (aiError) {
        console.error("AI נכשל:", aiError);
        aiSyllabus = [{ id: "fallback-" + Date.now(), title: "מבוא", learningUnits: [] }];
      }

      // 3. שמירה
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

  return (
    <div className="min-h-screen bg-gray-50 text-right font-sans" dir="rtl">
      <header className="sticky top-0 z-50 glass border-b border-white/40 shadow-sm px-6 py-4 flex justify-between items-center transition-all">
        <div className="flex items-center gap-6">
          {mode !== 'list' && !isStudentLink && (
            <button onClick={handleBackToList} className="bg-white hover:bg-gray-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer">
              <IconBack className="w-5 h-5 rotate-180" /> <span>חזור לרשימה</span>
            </button>
          )}
          <div className="flex items-center gap-3">
            <img src="/Logowizdi.png" alt="Logo" className="h-10 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">Wizdi Studio</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => auth.signOut()} className="bg-red-50 hover:bg-red-100 text-red-500 p-2.5 rounded-xl transition-colors"><IconLogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isStudentLink ? <CoursePlayer /> : (
          <>
            {mode === 'list' && <CourseList onSelectCourse={handleCourseSelect} onCreateNew={(m) => setWizardMode(m)} />}
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