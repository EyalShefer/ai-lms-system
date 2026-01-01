import React, { useState, useEffect, Suspense } from 'react';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './components/Login';
import { useCourseStore, CourseProvider } from './context/CourseContext';
import { auth, db, storage } from './firebase';
import { collection, addDoc, setDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateCoursePlan, generateLessonPlan } from './gemini';
import type { Assignment } from './courseTypes';

// --- Lazy Loading ---
const HomePage = React.lazy(() => import('./components/HomePage'));
const CourseEditor = React.lazy(() => import('./components/CourseEditor'));
const CoursePlayer = React.lazy(() => import('./components/CoursePlayer'));
const TeacherDashboard = React.lazy(() => import('./components/TeacherDashboard'));
const StudentHome = React.lazy(() => import('./components/StudentHome'));
const PedagogicalInsights = React.lazy(() => import('./components/PedagogicalInsights'));
const IngestionWizard = React.lazy(() => import('./components/IngestionWizard'));
const SequentialCoursePlayer = React.lazy(() => import('./components/SequentialCoursePlayer'));
const AdaptiveDashboard = React.lazy(() => import('./components/dashboard/AdaptiveDashboard').then(module => ({ default: module.AdaptiveDashboard })));
import GeoGuard from './components/GeoGuard';
import LazyLoadErrorBoundary from './components/LazyLoadErrorBoundary'; // Import Error Boundary
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

// TicTacToeLoader removed

// ... existing imports

const AuthenticatedApp = () => {
  const [mode, setMode] = useState('list');
  const [isStudentLink, setIsStudentLink] = useState(false);
  const [wizardMode, setWizardMode] = useState<'learning' | 'exam' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false); // NEW: Simulate Guest
  const [showLoader, setShowLoader] = useState(false); // New state for Loader visibility
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);

  const { loadCourse } = useCourseStore();
  const { currentUser } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const studentLinkID = params.get('studentCourseId');
    const assignmentId = params.get('assignmentId');

    const init = async () => {
      if (assignmentId) {
        setIsStudentLink(true);
        try {
          const assignSnap = await getDoc(doc(db, "assignments", assignmentId));
          if (assignSnap.exists()) {
            const assignData = { id: assignSnap.id, ...assignSnap.data() } as Assignment;
            setCurrentAssignment(assignData);
            loadCourse(assignData.courseId);
            setMode('student');
          } else {
            console.warn("Assignment not found or expired");
            alert("המשימה לא נמצאה או שפג תוקפה.");
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

  const handleStudentAssignmentSelect = async (assignmentId: string) => {
    console.log("Selected assignment from dashboard:", assignmentId);
    try {
      const assignSnap = await getDoc(doc(db, "assignments", assignmentId)); // Or assume it's valid if coming from the hook
      // Ideally we should just verify it exists or pass the full object if we want to avoid a read, 
      // but 'student' mode usually expects 'currentAssignment' to be set.

      // Let's just set the ID and let the Player load it? 
      // Actually, existing code for 'student' mode checks 'currentAssignment'. 
      // Let's reuse the loading logic or just set it if we have it.

      if (assignSnap.exists()) {
        const assignData = { id: assignSnap.id, ...assignSnap.data() } as Assignment;
        setCurrentAssignment(assignData);
        loadCourse(assignData.courseId);
        setMode('student');
      }
    } catch (e) {
      console.error("Error selecting assignment:", e);
      alert("שגיאה בטעינת המשימה");
    }
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

  // --- הפונקציה המתוקנת (v2 - Fixed Redirect Bug) ---
  // TicTacToeLoader removed

  const handleWizardComplete = async (wizardData: any) => {
    if (!currentUser) return;

    // 1. Close Wizard Immediately & Show Loading
    setWizardMode(null);
    setShowLoader(false);

    // Safety check: verify currentUser exists again just in case
    if (!currentUser) {
      alert("שגיאה: משתמש לא מחובר");
      return;
    }

    try {
      setIsGenerating(true);

      console.log("🛠️ App.tsx: Wizard Completion Data:", JSON.stringify(wizardData, null, 2));
      console.log("🛠️ App.tsx: Product Type:", wizardData.settings?.productType);
      console.log("🛠️ App.tsx: Teaching Style:", wizardData.settings?.teachingStyle);

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
      } else if (wizardData.pastedText) {
        console.log("Processing successfully pasted text");
        aiSourceText = wizardData.pastedText;
      }

      // --- לוג ביקורת ---
      console.log("🚀 Generating with AI... Wizard Data:", wizardData);

      // --- חילוץ חכם של הגיל (ROBUST EXTRACTION) ---
      let extractedGrade =
        (Array.isArray(wizardData.targetAudience) ? wizardData.targetAudience[0] : wizardData.targetAudience) ||
        (Array.isArray(wizardData.grade) ? wizardData.grade[0] : wizardData.grade) ||
        (Array.isArray(wizardData.gradeLevel) ? wizardData.gradeLevel[0] : wizardData.gradeLevel) ||
        (wizardData.settings?.targetAudience) ||
        (wizardData.settings?.grade) ||
        (wizardData.settings?.gradeLevel) ||
        "כללי";

      console.log("🎯 Extracted Grade for AI (App.tsx):", extractedGrade);

      // Use originalTopic if available (for precise Topic Mode), otherwise title, or filename
      const topicForAI = wizardData.originalTopic || wizardData.topic || fileName || "נושא כללי";

      // The displayed title (can be different from the topic)
      const courseTitle = wizardData.title || wizardData.topic || fileName || "פעילות חדשה";

      const courseMode = wizardData.settings?.courseMode || 'learning';
      console.log("🛠️ App.tsx: Detected Course Mode:", courseMode); // DEBUG LOG
      const activityLength = wizardData.settings?.activityLength || 'medium'; // NEW
      const userSubject = wizardData.settings?.subject || "כללי";

      let aiSyllabus = [];
      let lessonPlanContent: string | undefined = undefined;

      try {
        if (wizardData.settings?.productType === 'lesson') {
          console.log("🚀 Generating Lesson Plan via AI...");
          lessonPlanContent = await generateLessonPlan(
            aiSourceText || `Topic: ${topicForAI}`,
            topicForAI,
            extractedGrade,
            activityLength,
            wizardData.settings?.teachingStyle
          ) || "";

          // Empty syllabus for now, user will add units manually via the Lesson Plan interactions
          aiSyllabus = [];
        } else {
          // --- NEW: Instant "Skeleton" Generation Strategy ---
          // Instead of waiting for Cloud Function, we create an EMPTY shell and let UnitEditor fill it.
          console.log("🚀 Skipping Cloud Gen -> Starting Instant Skeleton Strategy");

          // Create a basic syllabus shell
          aiSyllabus = [{
            id: crypto.randomUUID(),
            title: "פעילות חדשה",
            learningUnits: [{
              id: crypto.randomUUID(),
              title: topicForAI,
              type: 'practice',
              activityBlocks: [] // Empty blocks trigger the UnitEditor's useEffect!
            }]
          }];
        }

      } catch (aiError) {
        console.error("AI Init Failed (Non-fatal):", aiError);
        // Fallback
        aiSyllabus = [{ id: "fallback-" + Date.now(), title: "פעילות חדשה", learningUnits: [] }];
      }

      const { file, ...cleanWizardData } = wizardData;

      // PREPARE DATA - SAFE SANITIZATION
      // 1. Create base object without timestamps
      const baseCourseData = {
        title: courseTitle,
        teacherId: currentUser.uid,
        targetAudience: extractedGrade,
        subject: userSubject,
        gradeLevel: extractedGrade,
        syllabus: aiSyllabus,
        mode: courseMode,
        activityLength,
        showSourceToStudent: wizardData.settings?.showSourceToStudent ?? true,
        fullBookContent: aiSourceText || "",
        pdfSource: fileUrl || null,
        lessonPlanContent: lessonPlanContent || undefined, // NEW
        teachingStyle: wizardData.settings?.teachingStyle, // NEW
        wizardData: { ...cleanWizardData, fileUrl, fileName, fileType }
      };

      // 2. Sanitize to remove undefined (safe because no timestamps yet)
      const safeData = JSON.parse(JSON.stringify(baseCourseData));

      // 3. Add Timestamp safely
      const dataToSave = {
        ...safeData,
        createdAt: serverTimestamp()
      };

      console.log("🔥 Attempting to save to Firestore...");
      // FIX: Use setDoc with merge to avoid 'Document already exists' errors if retried or collides
      const newDocRef = doc(collection(db, "courses"));
      await setDoc(newDocRef, dataToSave, { merge: true });
      const docRef = newDocRef;
      console.log("✅ Firestore Save Success! Doc ID:", docRef.id);

      // --- CRITICAL FIX: WAIT FOR PROPAGATION ---
      // We wait for getDoc to actually return the document before switching mode
      // This prevents the race condition where CourseContext loads 'null'
      let attempts = 0;
      let docFound = false;
      while (attempts < 5 && !docFound) {
        try {
          const snap = await getDoc(doc(db, "courses", docRef.id));
          if (snap.exists()) {
            docFound = true;
            console.log("✅ Document Verified in Firestore.");
          } else {
            console.log("⏳ Waiting for Firestore propagation...", attempts);
            await new Promise(r => setTimeout(r, 500));
          }
        } catch (e) {
          console.warn("Verify error", e);
        }
        attempts++;
      }

      // Explicitly Load
      loadCourse(docRef.id);

      // Force short delay to ensure React state updates don't clash
      setTimeout(() => {
        console.log("🔄 Switching to Editor Mode...");
        setMode('editor');
        setIsGenerating(false); // Stop spinner only after mode switch
      }, 100);

    } catch (error: any) {
      console.error("CRITICAL ERROR in handleWizardComplete:", error);
      alert("שגיאה ביצירת הפעילות: " + (error?.message || "שגיאה לא ידועה"));
      // Restore home page if everything fails
      // setMode('list'); // DISABLE REDIRECT FOR DEBUGGING
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

          {/* Temporary Switch for Dev / Demo */}
          {mode === 'list' && (
            <button
              onClick={() => setMode('student-dashboard')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors font-bold text-sm shadow-md"
            >
              תצוגת תלמיד 👨‍🎓
            </button>
          )}

          {/* Toggle Guest Mode (Only for Teachers inside Student Mode) */}
          {mode === 'student' && !isStudentLink && (
            <button
              onClick={() => setIsGuestMode(!isGuestMode)}
              className={`px-4 py-2 rounded-xl transition-colors font-bold text-sm border flex items-center gap-2 ${isGuestMode
                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50'
                }`}
              title="הדמה כניסת תלמיד חדש (ללא שם אוטומטי)"
            >
              {isGuestMode ? '🕵️ בטל מצב אורח' : '👨‍🎓 צפה כאורח'}
            </button>
          )}

          {mode === 'student-dashboard' && (
            <button
              onClick={() => setMode('list')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-xl transition-colors font-bold text-sm"
            >
              חזרה למורה 👨‍🏫
            </button>
          )}

          <button onClick={() => auth.signOut()} className="bg-red-50 hover:bg-red-100 text-red-500 px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm" title="התנתק">
            <IconLogOutSimple />
            <span>התנתק</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <LazyLoadErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <LoadingSpinner />
                <p className="mt-4 text-gray-500 font-medium animate-pulse">מכין את סביבת העבודה...</p>
              </div>
            ) : isStudentLink ? <SequentialCoursePlayer assignment={currentAssignment || undefined} /> : (
              <>
                {mode === 'list' && <HomePage onCreateNew={(m: any) => setWizardMode(m)} onNavigateToDashboard={() => setMode('dashboard')} />}
                {mode === 'editor' && <CourseEditor />}
                {mode === 'student' && <SequentialCoursePlayer assignment={currentAssignment || undefined} simulateGuest={isGuestMode} />}
                {mode === 'dashboard' && (
                  <TeacherDashboard
                    onEditCourse={handleCourseSelect}
                    onViewInsights={() => setMode('insights')}
                    // @ts-ignore
                    onNavigateToAnalytics={() => setMode('analytics')}
                  />
                )}
                {mode === 'student-dashboard' && <StudentHome onSelectAssignment={handleStudentAssignmentSelect} />}
                {mode === 'insights' && <PedagogicalInsights onBack={() => setMode('dashboard')} />}
                {mode === 'analytics' && <AdaptiveDashboard />}
              </>
            )}
          </Suspense>
        </LazyLoadErrorBoundary>
      </main>

      {wizardMode && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900/50 backdrop-blur-sm">
          <div className="min-h-screen flex items-center justify-center p-4">
            <Suspense fallback={<div className="bg-white p-6 rounded-2xl"><LoadingSpinner /></div>}>
              <LazyLoadErrorBoundary>
                <IngestionWizard
                  initialMode={wizardMode}
                  initialTopic=""
                  title="יצירת פעילות חדשה"
                  onComplete={handleWizardComplete}
                  onCancel={() => setWizardMode(null)}
                />
              </LazyLoadErrorBoundary>
            </Suspense>
          </div>
        </div>
      )}

      {/* Global Loading Overlay (Tic-Tac-Toe Removed) */}
      {showLoader && (
        <div className="fixed inset-0 z-[200] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center font-sans">
          <LoadingSpinner />
          <p className="mt-4 text-gray-500 font-bold">מכין את הפעילות...</p>
        </div>
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