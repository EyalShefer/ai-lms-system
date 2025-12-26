import React, { useState, useEffect, Suspense } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './components/Login';
import { useCourseStore, CourseProvider } from './context/CourseContext';
import { auth, db, storage } from './firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateCoursePlan } from './gemini';

// --- Lazy Loading ---
const HomePage = React.lazy(() => import('./components/HomePage'));
const CourseEditor = React.lazy(() => import('./components/CourseEditor'));
const CoursePlayer = React.lazy(() => import('./components/CoursePlayer'));
const TeacherDashboard = React.lazy(() => import('./components/TeacherDashboard'));
const IngestionWizard = React.lazy(() => import('./components/IngestionWizard'));
import GeoGuard from './components/GeoGuard';
import { IconSparkles } from './icons'; // Import IconSparkles
import * as pdfjsLib from 'pdfjs-dist';

// Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  // Limit to 5 pages
  const maxPages = Math.min(pdf.numPages, 5);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }
  return fullText;
};

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

import TicTacToeLoader from './components/TicTacToeLoader'; // Import new Loader

// ... existing imports

const AuthenticatedApp = () => {
  const [mode, setMode] = useState('list');
  const [isStudentLink, setIsStudentLink] = useState(false);
  const [wizardMode, setWizardMode] = useState<'learning' | 'exam' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLoader, setShowLoader] = useState(false); // New state for Loader visibility
  const [currentAssignment, setCurrentAssignment] = useState<any>(null);

  const { loadCourse } = useCourseStore();
  const { currentUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studentLinkID = params.get('studentCourseId');
    const assignmentId = params.get('assignmentId');

    const init = async () => {
      if (assignmentId) {
        console.log("Detected assignmentId:", assignmentId); // DEBUG
        setIsStudentLink(true);
        try {
          const assignSnap = await getDoc(doc(db, "assignments", assignmentId));
          if (assignSnap.exists()) {
            const assignData = assignSnap.data();
            console.log("Assignment data loaded:", assignData); // DEBUG
            setCurrentAssignment(assignData);
            loadCourse(assignData.courseId);
            setMode('student');
          } else {
            console.warn("Assignment not found or expired"); // DEBUG
            alert("המשימה לא נמצאה or expired.");
            setMode('list');
          }
        } catch (e) {
          console.error("Error loading assignment", e);
          alert("שגיאה בטעינת המשימה");
        }
      } else if (studentLinkID) {
        setIsStudentLink(true);
        loadCourse(studentLinkID);
        setMode('student');
      }
    };
    init();
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
    setMode(mode === 'editor' ? 'student' : 'editor');
  };

  const fileToGenerativePart = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        if (typeof base64String === 'string') {
          const base64Data = base64String.split(',')[1];
          resolve({ base64: base64Data, mimeType: file.type });
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- הפונקציה המתוקנת ---
  const handleWizardComplete = async (wizardData: any) => {
    if (!currentUser) return;

    // 1. Close Wizard Immediately & Show Loading
    setWizardMode(null);
    setShowLoader(true); // Show the game loader
    setIsGenerating(true);

    try {
      let fileUrl = null;
      let fileType = null;
      let fileName = null;

      // משתנים למעבר ל-AI
      let aiFileData: { base64: string; mimeType: string } | undefined = undefined;
      let aiSourceText: string | undefined = undefined;

      if (wizardData.file) {
        console.log("Processing file:", wizardData.file.name, wizardData.file.type);
        const file = wizardData.file;
        fileType = file.type;
        fileName = file.name;

        // 1. העלאה ל-Storage (תמיד כדאי לשמור את המקור)
        try {
          const storageRef = ref(storage, `uploads/${currentUser.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          fileUrl = await getDownloadURL(snapshot.ref);
        } catch (e) {
          console.error("Storage upload failed", e);
        }

        // 2. עיבוד עבור ה-AI
        try {
          if (file.type === 'application/pdf') {
            aiSourceText = await extractTextFromPDF(file);
            console.log("PDF Text Extracted");
          } else if (file.type.startsWith('image/')) {
            aiFileData = await fileToGenerativePart(file);
          } else if (file.type === 'text/plain') {
            aiSourceText = await file.text();
          }
        } catch (e) {
          console.error("Error processing file for AI", e);
        }
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
      const activityLength = wizardData.settings?.activityLength || 'medium'; // NEW
      const userSubject = wizardData.settings?.subject || "כללי";

      let aiSyllabus = [];
      try {
        // --- קריאה ל-Generate Course Plan ---
        // ארגומנטים: topic, grade, imageFile, subject, sourceText
        aiSyllabus = await generateCoursePlan(
          topicForAI,
          extractedGrade,
          aiFileData,
          userSubject,
          aiSourceText,
          wizardData.settings?.includeBot ?? false
        );
        console.log("AI Success. Source Text Length:", aiSourceText?.length || 0);

        // --- CRITICAL FIX: Force Client-Side Content Generation (Activity Mode) ---
        // The Cloud generation provides the syllabus, but we want our NEW Activity Logic for the content.
        if (aiSyllabus.length > 0 && aiSyllabus[0].learningUnits.length > 0) {
          const firstUnit = aiSyllabus[0].learningUnits[0];
          console.log("🚀 FORCE GENERATING CONTENT CLIENT-SIDE FOR:", firstUnit.title);

          // Import this function dynamically or ensure it's imported at top
          const { generateFullUnitContent } = await import('./gemini');

          const newBlocks = await generateFullUnitContent(
            firstUnit.title,
            topicForAI,
            extractedGrade,
            aiFileData,
            userSubject,
            aiSourceText,
            { ...wizardData.settings?.taxonomy, botPersona: wizardData.settings?.botPersona },
            wizardData.settings?.includeBot,
            courseMode, // Explicitly pass the mode ('learning' or 'exam')
            activityLength // NEW: Pass length
          );

          // Overwrite the content in the syllabus
          aiSyllabus = aiSyllabus.map((mod: any) => ({
            ...mod,
            learningUnits: mod.learningUnits.map((u: any) =>
              u.id === firstUnit.id ? { ...u, activityBlocks: newBlocks } : u
            )
          }));
          console.log("✅ Client-Side Content Generation Complete");
        }

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
        activityLength, // NEW: Persist length
        createdAt: serverTimestamp(),
        // Persist Source Text Visibility & Content
        showSourceToStudent: wizardData.settings?.showSourceToStudent ?? true,
        fullBookContent: aiSourceText || "",
        pdfSource: fileUrl || null,
        wizardData: { ...cleanWizardData, fileUrl, fileName, fileType }
      };

      // Deep sanitize to remove any 'undefined' values (Firestore rejects them)
      const dataToSave = JSON.parse(JSON.stringify(newCourseData));

      const docRef = await addDoc(collection(db, "courses"), dataToSave);

      loadCourse(docRef.id);
      setMode('editor');

    } catch (error) {
      console.error("Error:", error);
      alert("שגיאה: " + error.message);
    } finally {
      setIsGenerating(false);
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
          {mode === 'student' && !isStudentLink && (
            <button onClick={toggleViewMode} className="bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow flex items-center gap-2 font-bold cursor-pointer text-sm">
              <IconEditSimple /> <span>חזור לעריכה</span>
            </button>
          )}
          <div className="h-6 w-px bg-gray-300 mx-1"></div>
          <button onClick={() => auth.signOut()} className="bg-red-50 hover:bg-red-100 text-red-500 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm" title="התנתק">
            <IconLogOutSimple />
            <span>התנתק</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Suspense fallback={<LoadingSpinner />}>
          {isStudentLink ? <CoursePlayer assignment={currentAssignment} /> : (
            <>
              {mode === 'list' && <HomePage onCreateNew={(m: any) => setWizardMode(m)} onNavigateToDashboard={() => setMode('dashboard')} />}
              {mode === 'editor' && <CourseEditor />}
              {mode === 'student' && <CoursePlayer assignment={currentAssignment} />}
              {mode === 'dashboard' && <TeacherDashboard onEditCourse={handleCourseSelect} />}
            </>
          )}
        </Suspense>
      </main>

      {wizardMode && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/50 backdrop-blur-sm">
          <div className="min-h-screen flex items-center justify-center p-4">
            <Suspense fallback={<div className="bg-white p-6 rounded-2xl"><LoadingSpinner /></div>}>
              <IngestionWizard
                initialMode={wizardMode}
                initialTopic=""
                title="יצירת פעילות חדשה"
                onComplete={handleWizardComplete}
                onCancel={() => setWizardMode(null)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Global Loading Overlay (Tic-Tac-Toe Zen Mode) */}
      {showLoader && (
        <TicTacToeLoader
          isLoading={isGenerating}
          onContinue={() => setShowLoader(false)}
        />
      )}
    </div>
  );
};

const AppWrapper = () => {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-bold bg-gray-50">טוען מערכת...</div>;
  return currentUser ? (
    <GeoGuard>
      <AuthenticatedApp />
    </GeoGuard>
  ) : <Login />;
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