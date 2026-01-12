import React, { useState, useEffect, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import Login from './components/Login';
import { useCourseStore, CourseProvider } from './context/CourseContext';
import { auth, db, storage } from './firebase';
import { collection, addDoc, setDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generateCoursePlan } from './gemini';
import type { Assignment } from './courseTypes';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Migration utilities (exposes migrateGameToActivity to window)
import './utils/migrations';

// --- Lazy Loading ---
const CourseEditor = React.lazy(() => import('./components/CourseEditor'));
const CoursePlayer = React.lazy(() => import('./components/CoursePlayer'));
const TeacherDashboard = React.lazy(() => import('./components/TeacherDashboard'));
const PedagogicalInsights = React.lazy(() => import('./components/PedagogicalInsights'));
const IngestionWizard = React.lazy(() => import('./components/IngestionWizard'));

// --- Responsive Components (auto-switch between desktop/mobile) ---
import {
    ResponsiveHomePage as HomePage,
    ResponsiveStudentHome as StudentHome,
    ResponsiveSequentialCoursePlayer as SequentialCoursePlayer,
    ResponsiveLandingPage as LandingPage
} from './components/ResponsiveWrappers';
const AdaptiveDashboard = React.lazy(() => import('./components/dashboard/AdaptiveDashboard').then(module => ({ default: module.AdaptiveDashboard })));
const TeacherControlCenter = React.lazy(() => import('./components/dashboard/TeacherControlCenter').then(module => ({ default: module.TeacherControlCenter })));
const PromptsLibrary = React.lazy(() => import('./components/PromptsLibrary'));
const QADashboard = React.lazy(() => import('./components/QADashboard'));
const WizdiRoutes = React.lazy(() => import('./components/wizdi/WizdiRouter'));
const KnowledgeBaseAdmin = React.lazy(() => import('./components/KnowledgeBaseAdmin'));
const ExtractionReviewPage = React.lazy(() => import('./components/ExtractionReviewPage'));
const TeachingAgentsLibrary = React.lazy(() => import('./components/TeachingAgentsLibrary'));
const UsageDashboard = React.lazy(() => import('./components/admin/UsageDashboard'));
import GeoGuard from './components/GeoGuard';
import LazyLoadErrorBoundary from './components/LazyLoadErrorBoundary'; // Import Error Boundary
import { IconSparkles } from './icons'; // Import IconSparkles
import * as pdfjsLib from 'pdfjs-dist';

// Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// Result type for PDF extraction
interface PDFExtractionResult {
  text: string;
  pageImages: Array<{ pageNum: number; base64: string; mimeType: string }>;
  hasImages: boolean;
}

const extractTextFromPDF = async (file: File): Promise<string> => {
  const result = await extractTextAndImagesFromPDF(file);
  return result.text;
};

// Enhanced PDF extraction - extracts both text and renders pages as images
const extractTextAndImagesFromPDF = async (file: File): Promise<PDFExtractionResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  const pageImages: Array<{ pageNum: number; base64: string; mimeType: string }> = [];

  // Limit to 5 pages
  const maxPages = Math.min(pdf.numPages, 5);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);

    // Extract text
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;

    // Check if page has minimal text (likely image-heavy or scanned)
    const textLength = pageText.trim().length;

    // Render page as image if it has little text (< 100 chars) or is the first page
    // First page often has important diagrams/headers
    if (textLength < 100 || i === 1) {
      try {
        const scale = 1.5; // Good balance between quality and size
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          // Convert to base64 (JPEG for smaller size)
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

          pageImages.push({
            pageNum: i,
            base64,
            mimeType: 'image/jpeg'
          });

          console.log(`📸 Rendered page ${i} as image (text length: ${textLength})`);
        }
      } catch (renderError) {
        console.warn(`Failed to render page ${i} as image:`, renderError);
      }
    }
  }

  return {
    text: fullText,
    pageImages,
    hasImages: pageImages.length > 0
  };
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
  const [cameFromStudentDashboard, setCameFromStudentDashboard] = useState(false); // Track if student came from dashboard
  const [wizardMode, setWizardMode] = useState<'learning' | 'exam' | null>(null);
  const [wizardProduct, setWizardProduct] = useState<'lesson' | 'podcast' | 'exam' | 'activity' | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false); // NEW: Simulate Guest
  const [showLoader, setShowLoader] = useState(false); // New state for Loader visibility
  const [loaderContext, setLoaderContext] = useState<{ sourceMode?: string; productType?: string }>({});
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);

  const { loadCourse } = useCourseStore();
  const { currentUser, isAdmin } = useAuth();

  useEffect(() => {
    // console.log("DEBUG: App wizardMode changed to:", wizardMode);
  }, [wizardMode]);

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
    console.log('[App] handleCourseSelect called with courseId:', courseId);
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
    // console.log("Selected assignment from dashboard:", assignmentId);
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
        setCameFromStudentDashboard(true); // Mark that student came from dashboard
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
  const handleWizardComplete = async (wizardData: any) => {
    if (!currentUser) return;

    // 1. Close Wizard Immediately & Show Loading
    setWizardMode(null);
    setLoaderContext({ sourceMode: wizardData.mode, productType: wizardData.settings?.productType });
    setShowLoader(false); // DIRECT ENTRY: Skip game loader, go straight to editor

    // Safety check: verify currentUser exists again just in case
    if (!currentUser) {
      alert("שגיאה: משתמש לא מחובר");
      return;
    }

    try {
      setIsGenerating(true);
      let fileUrl = null;
      let fileType = null;
      let fileName = null;

      // משתנים למעבר ל-AI
      let aiFileData: { base64: string; mimeType: string } | undefined = undefined;
      let aiSourceText: string | undefined = undefined;

      if (wizardData.file) {
        // console.log("Processing file:", wizardData.file.name, wizardData.file.type);
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
            // Enhanced PDF extraction with images
            console.log("📄 Processing PDF with enhanced extraction...");
            const pdfResult = await extractTextAndImagesFromPDF(file);
            aiSourceText = pdfResult.text;

            // If PDF has pages rendered as images (scanned/image-heavy), analyze them
            if (pdfResult.hasImages && pdfResult.pageImages.length > 0) {
              console.log(`🖼️ PDF has ${pdfResult.pageImages.length} image pages - sending to Vision API...`);

              try {
                const analyzeImageFn = httpsCallable(functions, 'analyzeImageWithVision');

                // Analyze each page image (limit to 3 to avoid timeout)
                const imagesToAnalyze = pdfResult.pageImages.slice(0, 3);
                const visionResults = await Promise.all(
                  imagesToAnalyze.map(async (pageImg) => {
                    try {
                      const result = await analyzeImageFn({
                        imageBase64: pageImg.base64,
                        mimeType: pageImg.mimeType,
                        context: `PDF Page ${pageImg.pageNum} - ${wizardData.topic || wizardData.title || fileName}`
                      });
                      return { pageNum: pageImg.pageNum, data: result.data as any };
                    } catch (e) {
                      console.warn(`Vision failed for page ${pageImg.pageNum}:`, e);
                      return null;
                    }
                  })
                );

                // Combine Vision results with extracted text
                const validResults = visionResults.filter(r => r && r.data?.success);
                if (validResults.length > 0) {
                  let visionText = "\n\n--- תוכן מתמונות (Vision AI) ---\n";
                  const allAnalysis: any[] = [];

                  validResults.forEach((result) => {
                    if (result && result.data) {
                      visionText += `\n[עמוד ${result.pageNum}]\n`;
                      visionText += result.data.sourceText || result.data.analysis?.educational_summary || "";
                      visionText += "\n";

                      if (result.data.analysis) {
                        allAnalysis.push({
                          page: result.pageNum,
                          ...result.data.analysis
                        });
                      }
                    }
                  });

                  // Append Vision text to PDF text
                  aiSourceText += visionText;
                  (wizardData as any).pdfImageAnalysis = allAnalysis;

                  console.log(`✅ Vision analysis added from ${validResults.length} pages. Total text: ${aiSourceText.length} chars`);
                }
              } catch (visionError) {
                console.warn("⚠️ PDF Vision analysis failed, using text only:", visionError);
              }
            }
          } else if (file.type.startsWith('image/')) {
            // NEW: Analyze image with Vision API
            console.log("🖼️ Analyzing image with Vision API...");
            aiFileData = await fileToGenerativePart(file);

            try {
              const analyzeImageFn = httpsCallable(functions, 'analyzeImageWithVision');
              const visionResult = await analyzeImageFn({
                imageBase64: aiFileData.base64,
                mimeType: aiFileData.mimeType,
                context: wizardData.topic || wizardData.title
              });

              const visionData = visionResult.data as any;
              if (visionData.success && visionData.sourceText) {
                aiSourceText = visionData.sourceText;
                console.log("✅ Image analyzed successfully. Extracted text length:", aiSourceText.length);

                // Store analysis metadata for later use
                (wizardData as any).imageAnalysis = visionData.analysis;
              }
            } catch (visionError) {
              console.warn("⚠️ Vision API failed, falling back to basic image handling:", visionError);
              // Keep aiFileData for fallback
            }
          } else if (file.type === 'text/plain') {
            aiSourceText = await file.text();
          }
        } catch (e) {
          console.error("Error processing file for AI", e);
        }
      } else if (wizardData.pastedText) {
        // console.log("Processing successfully pasted text");
        aiSourceText = wizardData.pastedText;
      }

      // --- לוג ביקורת ---
      // console.log("🚀 Generating with AI... Wizard Data:", JSON.stringify(wizardData, null, 2));

      // --- חילוץ חכם של הגיל (ROBUST EXTRACTION) ---
      let extractedGrade =
        (Array.isArray(wizardData.targetAudience) ? wizardData.targetAudience[0] : wizardData.targetAudience) ||
        (Array.isArray(wizardData.grade) ? wizardData.grade[0] : wizardData.grade) ||
        (Array.isArray(wizardData.gradeLevel) ? wizardData.gradeLevel[0] : wizardData.gradeLevel) ||
        (wizardData.settings?.targetAudience) ||
        (wizardData.settings?.grade) ||
        (wizardData.settings?.gradeLevel) ||
        "כללי";

      // console.log("🎯 Extracted Grade for AI (App.tsx):", extractedGrade);

      // Use originalTopic if available (for precise Topic Mode), otherwise title, or filename
      const topicForAI = wizardData.originalTopic || wizardData.topic || fileName || "נושא כללי";

      // The displayed title (can be different from the topic)
      const courseTitle = wizardData.title || wizardData.topic || fileName || "פעילות חדשה";

      const courseMode = wizardData.settings?.courseMode || 'learning';
      // console.log("🛠️ App.tsx: Detected Course Mode:", courseMode); // DEBUG LOG
      const activityLength = wizardData.settings?.activityLength || 'medium'; // NEW
      const userSubject = wizardData.settings?.subject || "כללי";

      let aiSyllabus = [];
      try {
        // --- NEW: Instant "Skeleton" Generation Strategy ---
        // Instead of waiting for Cloud Function, we create an EMPTY shell and let UnitEditor fill it.
        // console.log("🚀 Skipping Cloud Gen -> Starting Instant Skeleton Strategy");

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
        wizardData: { ...cleanWizardData, fileUrl, fileName, fileType }
      };

      // 2. Sanitize to remove undefined (safe because no timestamps yet)
      const safeData = JSON.parse(JSON.stringify(baseCourseData));

      // 3. Add Timestamp safely
      const dataToSave = {
        ...safeData,
        createdAt: serverTimestamp()
      };

      // console.log("🔥 Attempting to save to Firestore...");
      // FIX: Use setDoc with merge to avoid 'Document already exists' errors if retried or collides
      const newDocRef = doc(collection(db, "courses"));
      await setDoc(newDocRef, dataToSave, { merge: true });
      const docRef = newDocRef;
      // console.log("✅ Firestore Save Success! Doc ID:", docRef.id);

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
            // console.log("✅ Document Verified in Firestore.");
          } else {
            // console.log("⏳ Waiting for Firestore propagation...", attempts);
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
        // console.log("🔄 Switching to Editor Mode...");
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
          <img src="/WizdiLogo.png" alt="Wizdi AI" className="h-12 w-auto object-contain hover:opacity-90 transition-opacity" loading="lazy" decoding="async" />
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

          {/* Enter Student Area (For Link Students) */}
          {mode === 'student' && isStudentLink && (
            <button
              onClick={() => setMode('student-dashboard')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-bold cursor-pointer text-sm animate-pulse-slow"
            >
              <span>👨‍🎓</span> <span>כנס לאזור התלמיד</span>
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
            ) : isStudentLink ? <SequentialCoursePlayer assignment={currentAssignment || undefined} onExit={() => setMode('student-dashboard')} /> : (
              <>
                {mode === 'list' && <HomePage onCreateNew={(m: any, product?: 'lesson' | 'podcast' | 'exam' | 'activity') => { setWizardMode(m); setWizardProduct(product || null); }} onNavigateToDashboard={() => setMode('dashboard')} onEditCourse={handleCourseSelect} onNavigateToPrompts={() => setMode('prompts')} onNavigateToQA={isAdmin ? () => setMode('qa-admin') : undefined} onNavigateToKnowledgeBase={isAdmin ? () => setMode('knowledge-base') : undefined} onNavigateToAgents={() => setMode('agents')} onNavigateToUsage={isAdmin ? () => setMode('usage-admin') : undefined} />}
                {mode === 'editor' && <CourseEditor onBack={handleBackToList} />}
                {mode === 'student' && <SequentialCoursePlayer
                  assignment={currentAssignment || undefined}
                  simulateGuest={isGuestMode}
                  onExit={() => {
                    if (cameFromStudentDashboard) {
                      setCameFromStudentDashboard(false);
                      setMode('student-dashboard');
                    } else {
                      setMode('editor');
                    }
                  }}
                  onEdit={() => setMode('editor')}
                />}
                {mode === 'dashboard' && (
                  <TeacherDashboard
                    onEditCourse={handleCourseSelect}
                    onViewInsights={() => setMode('insights')}
                    // @ts-ignore
                    onNavigateToAnalytics={() => setMode('analytics')}
                  />
                )}
                {mode === 'prompts' && (
                  <PromptsLibrary
                    onBack={() => setMode('list')}
                  />
                )}
                {mode === 'agents' && (
                  <TeachingAgentsLibrary
                    onBack={() => setMode('list')}
                  />
                )}
                {mode === 'student-dashboard' && <StudentHome
                  onSelectAssignment={handleStudentAssignmentSelect}
                  highlightCourseId={currentAssignment?.courseId || (isStudentLink && !currentAssignment ? new URLSearchParams(window.location.search).get('studentCourseId') : undefined)}
                />}
                {mode === 'insights' && <PedagogicalInsights onBack={() => setMode('dashboard')} />}
                {mode === 'analytics' && <AdaptiveDashboard />}
                {mode === 'qa-admin' && <QADashboard onBack={() => setMode('list')} />}
                {mode === 'knowledge-base' && <KnowledgeBaseAdmin onNavigateToReview={() => setMode('extraction-review')} />}
                {mode === 'extraction-review' && <ExtractionReviewPage />}
                {mode === 'usage-admin' && <UsageDashboard />}
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
                  initialProduct={wizardProduct || undefined}
                  initialTopic=""
                  title="יצירת פעילות חדשה"
                  onComplete={handleWizardComplete}
                  onCancel={() => { setWizardMode(null); setWizardProduct(null); }}
                />
              </LazyLoadErrorBoundary>
            </Suspense>
          </div>
        </div>
      )}

      {/* Global Loading Overlay (Tic-Tac-Toe Zen Mode) */}
      {showLoader && (
        <TicTacToeLoader
          isLoading={isGenerating}
          onContinue={() => setShowLoader(false)}
          sourceMode={loaderContext.sourceMode as any}
          productType={loaderContext.productType as any}
        />
      )}
    </div>
  );
};

const AppWrapper = () => {
  const { currentUser, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 font-bold bg-gray-50">טוען מערכת...</div>;

  if (currentUser) {
    return (
      <GeoGuard bypassInDev={true} failOpen={true}>
        <AuthenticatedApp />
      </GeoGuard>
    );
  }

  return showLogin ? <Login /> : <LandingPage onLogin={() => setShowLogin(true)} />;
};

function App() {
  const location = useLocation();

  // Check if we're on a Wizdi route - these bypass normal auth
  const isWizdiRoute = location.pathname.startsWith('/wizdi');

  if (isWizdiRoute) {
    return (
      <Suspense fallback={<div className="h-screen flex items-center justify-center">טוען...</div>}>
        <Routes>
          <Route path="/wizdi/*" element={<WizdiRoutes />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <AuthProvider>
      <CourseProvider>
        <AppWrapper />
      </CourseProvider>
    </AuthProvider>
  );
}

export default App;