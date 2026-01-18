import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourseStore } from '../context/CourseContext';
import * as pdfjsLib from 'pdfjs-dist';
import CoursePlayer from './CoursePlayer';
import UnitEditor from './UnitEditor';
import TeacherCockpit from './TeacherCockpit';
import { IconEye, IconX } from '../icons';
import { AIStarsSpinner } from './ui/Loading/AIStarsSpinner';
import { TypewriterLoaderInline } from './ui/Loading/TypewriterLoader';
import IngestionWizard from './IngestionWizard';
import { generateCoursePlan, generateFullUnitContent, generateFullUnitContentWithVariants, generateDifferentiatedContent, generateCourseSyllabus, generateUnitSkeleton, generateStepContent, generatePodcastScript, generateTeacherStepContent, generateLessonVisuals, generateInteractiveBlocks, generateLessonPart1, generateLessonPart2, generateTeacherLessonParallel, extractTopicFromText } from '../gemini';
// import { generateUnitSkeleton, generateStepContent, generatePodcastScript } from '../services/ai/geminiApi';
import { mapSystemItemToBlock } from '../shared/utils/geminiParsers';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Keep db for direct doc updates if needed
import { saveCourseToFirestore, saveCourseToFirestoreImmediate, saveUnitToFirestore } from '../firebaseUtils';
import type { LearningUnit, ActivityBlock, Module } from '../shared/types/courseTypes';

// הגדרת ה-Worker עבור PDF.js (פתרון תואם Vite)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

const fileToBase64 = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve({ base64, mimeType: file.type });
        };
        reader.onerror = error => reject(error);
    });
};

const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 5);
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
};

/**
 * 🚀 PROGRESSIVE LOADING: Creates skeleton blocks for immediate display
 * Shows the lesson structure immediately while content loads in the background
 * Enhanced with clear visual feedback for the teacher
 */
const createLessonSkeletonBlocks = (lessonTitle: string): ActivityBlock[] => {
    const skeletonStyle = `
        <style>
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 8px rgba(99, 102, 241, 0.4); }
                50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.7); }
            }
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-3px); }
            }
            @keyframes progress-flow {
                0% { background-position: 0% 50%; }
                100% { background-position: 200% 50%; }
            }
            .skeleton-loading {
                background: linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%);
                background-size: 200% 100%;
                animation: shimmer 1.5s ease-in-out infinite;
                border-radius: 8px;
            }
            .skeleton-line {
                height: 14px;
                margin: 10px 0;
            }
            .skeleton-paragraph {
                height: 50px;
            }
            .building-container {
                background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%);
                border: 2px solid #c7d2fe;
                border-radius: 16px;
                padding: 20px;
                margin: 12px 0;
                position: relative;
                overflow: hidden;
            }
            .building-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #818cf8, #6366f1, #4f46e5, #6366f1, #818cf8);
                background-size: 200% 100%;
                animation: progress-flow 2s linear infinite;
            }
            .building-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            .building-icon {
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: float 2s ease-in-out infinite;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }
            .building-icon svg {
                width: 24px;
                height: 24px;
                color: white;
            }
            .building-text {
                flex: 1;
            }
            .building-title {
                font-size: 18px;
                font-weight: 700;
                color: #3730a3;
                margin: 0 0 4px 0;
            }
            .building-subtitle {
                font-size: 14px;
                color: #6366f1;
                margin: 0;
            }
            .building-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: white;
                border: 2px solid #a5b4fc;
                border-radius: 24px;
                padding: 8px 16px;
                font-size: 14px;
                font-weight: 600;
                color: #4f46e5;
                animation: pulse-glow 2s ease-in-out infinite;
            }
            .building-badge .spinner {
                width: 16px;
                height: 16px;
                border: 3px solid #c7d2fe;
                border-top-color: #4f46e5;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .section-preview {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 12px;
            }
            .preview-chip {
                background: white;
                border: 1px solid #e0e7ff;
                border-radius: 8px;
                padding: 6px 12px;
                font-size: 12px;
                color: #6b7280;
            }
        </style>
    `;

    const buildingIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>`;

    const magicIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>`;

    // Main loading block with enhanced visual feedback
    const mainLoadingBlock = `
        <div class="building-container">
            ${skeletonStyle}
            <div class="building-header">
                <div class="building-icon">${magicIcon}</div>
                <div class="building-text">
                    <h3 class="building-title">✨ בונה את מערך השיעור שלך</h3>
                    <p class="building-subtitle">הבינה המלאכותית יוצרת תוכן מותאם אישית</p>
                </div>
                <div class="building-badge">
                    <div class="spinner"></div>
                    עובד על זה...
                </div>
            </div>
            <div class="section-preview">
                <span class="preview-chip">🪝 פתיחה מעניינת</span>
                <span class="preview-chip">🎓 הוראה פרונטלית</span>
                <span class="preview-chip">🧑‍🏫 תרגול מודרך</span>
                <span class="preview-chip">💻 פעילויות אינטראקטיביות</span>
                <span class="preview-chip">💬 דיון</span>
                <span class="preview-chip">📝 סיכום</span>
            </div>
        </div>
    `;

    const buildingBadge = `<div class="building-badge"><div class="spinner"></div>בבנייה...</div>`;

    return [
        {
            id: crypto.randomUUID(),
            type: 'text',
            content: mainLoadingBlock,
            metadata: { time: '5 min', bloomLevel: 'remember', isLoading: true, isMainLoader: true }
        },
        {
            id: crypto.randomUUID(),
            type: 'text',
            content: `<div class="lesson-section hook">${skeletonStyle}<h3>🪝 פתיחה (The Hook)</h3>${buildingBadge}<div class="skeleton-loading skeleton-paragraph"></div><div class="skeleton-loading skeleton-line" style="width: 60%;"></div></div>`,
            metadata: { time: '5 min', bloomLevel: 'remember', isLoading: true }
        },
        {
            id: crypto.randomUUID(),
            type: 'text',
            content: `<div class="lesson-section instruction"><h3>🎓 הוראה פרונטלית (Direct Instruction)</h3>${buildingBadge}<div class="skeleton-loading skeleton-paragraph"></div><div class="skeleton-loading skeleton-line" style="width: 80%;"></div><div class="skeleton-loading skeleton-line" style="width: 65%;"></div></div>`,
            metadata: { time: '15 min', bloomLevel: 'understand', isLoading: true }
        },
        {
            id: crypto.randomUUID(),
            type: 'text',
            content: `<div class="lesson-section practice"><h3>🧑‍🏫 תרגול מודרך (Guided Practice)</h3>${buildingBadge}<div class="skeleton-loading skeleton-paragraph"></div></div>`,
            metadata: { time: '10 min', bloomLevel: 'apply', isLoading: true }
        },
        {
            id: crypto.randomUUID(),
            type: 'text',
            content: `<div class="lesson-section independent-practice"><h3>💻 תרגול עצמאי (Independent Practice)</h3>${buildingBadge}<div class="skeleton-loading skeleton-paragraph"></div></div>`,
            metadata: { time: '10 min', bloomLevel: 'apply', isLoading: true }
        },
        {
            id: crypto.randomUUID(),
            type: 'text',
            content: `<div class="lesson-section discussion"><h3>💬 דיון כיתתי (Discussion)</h3>${buildingBadge}<div class="skeleton-loading skeleton-line" style="width: 85%;"></div><div class="skeleton-loading skeleton-line" style="width: 75%;"></div></div>`,
            metadata: { time: '5 min', bloomLevel: 'evaluate', isLoading: true }
        },
        {
            id: crypto.randomUUID(),
            type: 'text',
            content: `<div class="lesson-section summary"><h3>📝 סיכום (Summary)</h3>${buildingBadge}<div class="skeleton-loading skeleton-line" style="width: 70%;"></div><div class="skeleton-loading" style="height: 120px; margin-top: 12px;"></div></div>`,
            metadata: { time: '5 min', bloomLevel: 'remember', isLoading: true }
        }
    ];
};


// --- תצוגה מקדימה פשוטה - גרסה נקייה (Flex Shell) ---
const UnitPreviewModal: React.FC<{ unit: any, onClose: () => void }> = ({ unit, onClose }) => {
    // מניעת גלילה של הדף הראשי
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-gray-50 h-screen w-full flex flex-col animate-fade-in" dir="rtl">
            <style>{`
                .preview-scroll::-webkit-scrollbar {
                    width: 16px;
                    display: block; /* Force display */
                }
                .preview-scroll::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-left: 1px solid #e5e7eb;
                }
                .preview-scroll::-webkit-scrollbar-thumb {
                    background-color: #9ca3af;
                    border-radius: 4px;
                    border: 3px solid #f1f1f1;
                }
                .preview-scroll::-webkit-scrollbar-thumb:hover {
                    background-color: #6b7280;
                }
            `}</style>

            {/* כותרת קבועה (לא נגללת) */}
            <div className="relative flex-none h-16 bg-white border-b border-gray-200 flex justify-between items-center px-6 shadow-sm z-[200]">
                <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                    <IconEye className="w-5 h-5 text-indigo-600" />
                    תצוגה מקדימה: {unit.title}
                </h3>
                <button
                    onClick={onClose}
                    className="flex items-center justify-center w-10 h-10 bg-gray-900 hover:bg-black text-white rounded-full transition-transform hover:scale-110 shadow-lg"
                    title="סגור תצוגה"
                >
                    <span className="font-bold text-lg">X</span>
                </button>
            </div>

            {/* אזור התוכן - תופס את כל שאר המקום וגולל עצמאית */}
            <div className="flex-1 w-full overflow-y-scroll preview-scroll bg-gray-50 relative">
                <div className="w-full max-w-5xl mx-auto pb-32 pt-8 px-4 min-h-full">
                    <CoursePlayer
                        reviewMode={true}
                        studentData={{
                            studentName: "תצוגה מקדימה",
                            answers: {}
                        }}
                        onExitReview={onClose}
                        forcedUnitId={unit.id}
                        unitOverride={unit} // Inject the specific unit object (saved or unsaved)
                        hideReviewHeader={true}
                    />
                    {/* מרווח תחתון */}
                    <div className="h-20 w-full" />
                </div>
            </div>
        </div>
    );
};




import { LessonPlanOverview } from './LessonPlanOverview';

// ... existing imports ...

interface CourseEditorProps {
    onBack?: () => void;
}

const CourseEditor: React.FC<CourseEditorProps> = ({ onBack }) => {
    const navigate = useNavigate();
    const { course, setCourse } = useCourseStore();
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [previewUnit, setPreviewUnit] = useState<LearningUnit | null>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    // Loader removed by user request
    // const [showLoader, setShowLoader] = useState(false); 

    // משתנה לעקיפת התצוגה
    const [forcedGrade, setForcedGrade] = useState<string>("");

    const wizardHasRun = useRef(false);
    const hasAutoSelected = useRef(false);

    // --- התיקון לקריטי למניעת 429 ולולאות ---
    // --- התיקון לקריטי למניעת 429 ולולאות ---
    useEffect(() => {
        // הגנה ראשונית: אם כבר רץ וויזארד או שיש תהליך יצירה, עוצרים
        if (wizardHasRun.current || isGenerating) return;

        // הגנה משנית: אם אין קורס כלל או שהוא בטעינה
        if (!course || course.id === 'loading') return;

        // בדיקה האם הקורס מאוכלס בסילבוס
        const hasSyllabus = course.syllabus && course.syllabus.length > 0;

        // Detect Lesson Mode
        const isLessonMode = course.wizardData?.settings?.productType === 'lesson' || course.mode === 'lesson';

        // 🚀 AUTO-GENERATION TRIGGER FOR FRESH SHELLS
        // If we have a shell syllabus (from App.tsx) but it's empty, AND we have wizard data -> GENERATE!
        const firstUnit = course.syllabus?.[0]?.learningUnits?.[0];
        const isFreshShell = hasSyllabus && firstUnit && (!firstUnit.activityBlocks || firstUnit.activityBlocks.length === 0);

        if (isFreshShell && course.wizardData && isLessonMode) {
            // console.log("🚀 Detected Fresh Lesson Shell. Triggering V4 Auto-Generation...");
            handleWizardComplete(course.wizardData);
            return;
        }

        if (hasSyllabus && !hasAutoSelected.current) {
            if (firstUnit && !selectedUnitId) {
                // CRITICAL: Prevent auto-select for Lesson Plans
                if (!isLessonMode) {
                    setSelectedUnitId(firstUnit.id);
                    hasAutoSelected.current = true;
                }
            }
        }
        else if (!hasSyllabus) {
            // אם אין תוכן - פותחים את הוויזארד אוטומטית תמיד
            if (!showWizard && !isGenerating) {
                setShowWizard(true);
            }
        }
    }, [course, showWizard, isGenerating, selectedUnitId]);

    const handleGenerateWithAI = async (type: 'unit' | 'module', id: string, _instruction?: string) => {
        if (type === 'unit') {
            // console.log(`🤖 Manual AI Trigger for Unit ${id}`);
            const unit = course.syllabus.flatMap((m: Module) => m.learningUnits).find((u: LearningUnit) => u.id === id);
            if (!unit) return;

            // 1. Set Generating State
            setCourse((prev: any) => {
                const newSyllabus = prev.syllabus.map((m: Module) => ({
                    ...m,
                    learningUnits: m.learningUnits.map((u: LearningUnit) => u.id === id ? { ...u, metadata: { ...u.metadata, status: 'generating' } } : u)
                }));
                return { ...prev, syllabus: newSyllabus };
            });

            // 2. Generate Content
            try {
                const skeleton = await generateUnitSkeleton(
                    unit.title,
                    course.gradeLevel || "General",
                    course.activityLength || 'medium',
                    course.fullBookContent,
                    course.mode === 'lesson' ? 'learning' : course.mode,
                    undefined,
                    course.wizardData?.settings?.productType
                );

                if (skeleton && skeleton.steps) {
                    const totalSteps = skeleton.steps.length;
                    const stepPromises = skeleton.steps.map(async (step: any) => {
                        const content = await generateStepContent(unit.title, step, course.gradeLevel || "General", course.fullBookContent, undefined, 'learning', undefined, totalSteps);
                        return mapSystemItemToBlock(content);
                    });
                    const newBlocksRaw = await Promise.all(stepPromises);
                    let newBlocks = newBlocksRaw.filter((b: any) => b !== null);

                    // FALLBACK: If AI Failed completely
                    if (newBlocks.length === 0) {
                        newBlocks = [{
                            id: crypto.randomUUID(),
                            type: 'text',
                            content: "⚠️ **שגיאה ביצירת התוכן**\n\nהמערכת לא הצליחה לייצר תוכן עבור יחידה זו. ייתכן שישנה בעיה בחיבור ל-AI או שהתוכן המקורי לא הספיק.\n\nאנא נסו ללחוץ שוב על כפתור 'עריכה עם AI' או הוסיפו תוכן ידנית.",
                            metadata: { score: 0, bloomLevel: 'evaluation' }
                        }];
                    }

                    // 3. Save
                    setCourse((prev: any) => {
                        const newSyllabus = prev.syllabus.map((m: Module) => ({
                            ...m,
                            learningUnits: m.learningUnits.map((u: LearningUnit) => u.id === id ? { ...u, activityBlocks: newBlocks, metadata: { ...u.metadata, status: 'ready' } } : u)
                        }));
                        const final = { ...prev, syllabus: newSyllabus };
                        saveCourseToFirestore(final);
                        return final;
                    });
                }
            } catch (e) {
                console.error("Manual Gen Error", e);
                alert("Generation failed");
                setCourse((prev: any) => {
                    const newSyllabus = prev.syllabus.map((m: Module) => ({
                        ...m,
                        learningUnits: m.learningUnits.map((u: LearningUnit) => u.id === id ? { ...u, metadata: { ...u.metadata, status: 'error' } } : u)
                    }));
                    return { ...prev, syllabus: newSyllabus };
                });
            }
        }
    };

    if (!course) return <div className="flex items-center justify-center h-screen text-gray-500">נא לבחור שיעור...</div>;

    const displayGrade = forcedGrade || course.gradeLevel || course.targetAudience || "כללי";


    // --- Progressive Generation Helper ---
    const processLessonPlanQueue = async (
        initialSyllabus: Module[],
        sourceText: string,
        grade: string,
        activityLength: 'short' | 'medium' | 'long',
        mode: 'learning' | 'exam' | 'lesson',
        taxonomy?: any,
        productType?: any
    ) => {
        // We iterate sequentially to manage rate limits and UX flow
        const flatUnits = initialSyllabus.flatMap(m => m.learningUnits).filter(u => !u.activityBlocks || u.activityBlocks.length === 0);

        for (const unit of flatUnits) {
            // 1. Mark as Generating
            setCourse((currentCourse: any) => {
                if (!currentCourse) return currentCourse;
                const updatedSyllabus = currentCourse.syllabus.map((m: Module) => ({
                    ...m,
                    learningUnits: m.learningUnits.map((u: LearningUnit) =>
                        u.id === unit.id ? { ...u, metadata: { ...u.metadata, status: 'generating' } } : u
                    )
                }));
                return { ...currentCourse, syllabus: updatedSyllabus };
            });

            try {
                // === TEACHER LESSON MODE (Master Teacher V2) ===
                if (mode === 'lesson' || productType === 'lesson') {
                    // 1. Determine Source Type
                    let sourceType: 'YOUTUBE' | 'TEXT_FILE' | 'TOPIC_ONLY' = 'TOPIC_ONLY';
                    const wizardData = course?.wizardData;

                    if (wizardData) {
                        // Check for Youtube (mediaType or transcript marker in text)
                        if (wizardData.mediaType === 'youtube' || (wizardData.pastedText && wizardData.pastedText.includes("TRANSCRIPT:"))) {
                            sourceType = 'YOUTUBE';
                        }
                        // Check for Text File - use pastedText from wizard (not sourceText)
                        // Also check the sourceText parameter passed to this function
                        else if ((wizardData.pastedText && wizardData.pastedText.length > 100) || (sourceText && sourceText.length > 100)) {
                            sourceType = 'TEXT_FILE';
                        }
                    } else if (sourceText && sourceText.length > 100) {
                        // Fallback: if no wizardData but sourceText was passed
                        sourceType = 'TEXT_FILE';
                    }

                    // 🚀 PROGRESSIVE LOADING STEP 1: Show skeleton blocks IMMEDIATELY
                    console.log("🚀 Progressive Loading: Creating skeleton blocks...");
                    const skeletonBlocks = createLessonSkeletonBlocks(unit.title);

                    // Update UI immediately with skeleton
                    setCourse((currentCourse: any) => {
                        if (!currentCourse) return currentCourse;
                        const updatedSyllabus = currentCourse.syllabus.map((m: Module) => ({
                            ...m,
                            learningUnits: m.learningUnits.map((u: LearningUnit) =>
                                u.id === unit.id ? {
                                    ...u,
                                    activityBlocks: skeletonBlocks,
                                    metadata: { ...u.metadata, status: 'loading-content' }
                                } : u
                            )
                        }));
                        return { ...currentCourse, syllabus: updatedSyllabus };
                    });

                    // 🚀 PERFORMANCE OPTIMIZATION: Generate content with PARALLEL API calls
                    // Part 1 (Hook + Direct Instruction) and Part 2 (Practice + Summary) run simultaneously
                    // This reduces total generation time from 8-15s to ~5-7s
                    // Falls back to sequential generation if parallel fails

                    let lessonPlan = null;
                    let useParallel = true; // Can be toggled for debugging

                    // Helper to build Part 1 blocks (Hook + Direct Instruction)
                    const buildPart1Blocks = (part1: any): ActivityBlock[] => {
                        const hookBlock: ActivityBlock = {
                            id: crypto.randomUUID(),
                            type: 'text',
                            content: `
                                <div class="lesson-section hook">
                                    <h3>🪝 פתיחה (The Hook)</h3>
                                    ${part1.lesson_metadata?.learning_objectives ? `
                                        <div class="learning-objectives">
                                            <strong>🎯 מטרות הלמידה:</strong>
                                            <ul>${part1.lesson_metadata.learning_objectives.map((obj: string) => `<li>${obj}</li>`).join('')}</ul>
                                        </div>
                                    ` : ''}
                                    <p class="teacher-script">${part1.hook.script_for_teacher}</p>
                                    ${part1.hook.classroom_management_tip ? `<div class="management-tip">💡 ${part1.hook.classroom_management_tip}</div>` : ''}
                                    <div class="visual-placeholder">🎨 יוצר תמונה...</div>
                                </div>
                            `,
                            metadata: { time: '5 min', bloomLevel: 'remember' }
                        };

                        const slideBlocks: ActivityBlock[] = part1.direct_instruction.slides.map((slide: any) => ({
                            id: crypto.randomUUID(),
                            type: 'text' as const,
                            content: `
                                <div class="lesson-section instruction">
                                    <h3>🎓 הוראה פרונטלית: ${slide.slide_title}</h3>
                                    <div class="board-points">
                                        <strong>📝 על הלוח:</strong>
                                        <ul>${slide.bullet_points_for_board.map((p: string) => `<li>${p}</li>`).join('')}</ul>
                                    </div>
                                    <p class="teacher-script"><strong>🗣️ למורה:</strong> ${slide.script_to_say}</p>
                                    ${slide.differentiation_note ? `<div class="diff-note">💡 ${slide.differentiation_note}</div>` : ''}
                                </div>
                            `,
                            metadata: { time: slide.timing_estimate || '5 min', bloomLevel: 'understand' }
                        }));

                        return [hookBlock, ...slideBlocks];
                    };

                    // Try parallel generation first, fallback to sequential if it fails
                    if (useParallel) {
                        try {
                            console.log("🚀 Trying parallel generation...");
                            lessonPlan = await generateTeacherLessonParallel(
                                unit.title,
                                sourceText,
                                grade,
                                sourceType,
                                // 🔥 This callback fires when Part1 is ready (~3-4 seconds)
                                (part1) => {
                                    if (!part1) return;
                                    console.log("⚡ Part1 ready! Updating UI immediately...");

                                    const part1Blocks = buildPart1Blocks(part1);

                                    // Update UI with Part1 content immediately
                                    // Keep skeleton placeholders for Part2 sections
                                    setCourse((currentCourse: any) => {
                                        if (!currentCourse) return currentCourse;
                                        const updatedSyllabus = currentCourse.syllabus.map((m: Module) => ({
                                            ...m,
                                            learningUnits: m.learningUnits.map((u: LearningUnit) =>
                                                u.id === unit.id ? {
                                                    ...u,
                                                    activityBlocks: [
                                                        ...part1Blocks,
                                                        // Keep skeleton placeholders for Part2 sections
                                                        {
                                                            id: crypto.randomUUID(),
                                                            type: 'text',
                                                            content: `<div class="lesson-section practice"><h3>🧑‍🏫 תרגול מודרך (Guided Practice)</h3><div class="building-badge"><div class="spinner"></div>בבנייה...</div></div>`,
                                                            metadata: { time: '10 min', bloomLevel: 'apply', isLoading: true }
                                                        },
                                                        {
                                                            id: crypto.randomUUID(),
                                                            type: 'text',
                                                            content: `<div class="lesson-section independent-practice"><h3>💻 תרגול עצמאי</h3><div class="building-badge"><div class="spinner"></div>בבנייה...</div></div>`,
                                                            metadata: { time: '10 min', bloomLevel: 'apply', isLoading: true }
                                                        },
                                                        {
                                                            id: crypto.randomUUID(),
                                                            type: 'text',
                                                            content: `<div class="lesson-section summary"><h3>📝 סיכום</h3><div class="building-badge"><div class="spinner"></div>בבנייה...</div></div>`,
                                                            metadata: { time: '5 min', bloomLevel: 'remember', isLoading: true }
                                                        }
                                                    ],
                                                    metadata: { ...u.metadata, status: 'loading-part2' }
                                                } : u
                                            )
                                        }));
                                        return { ...currentCourse, syllabus: updatedSyllabus };
                                    });
                                }
                            );
                        } catch (parallelError) {
                            console.warn("⚠️ Parallel generation failed, falling back to sequential:", parallelError);
                            lessonPlan = null;
                        }
                    }

                    // Fallback to sequential generation if parallel failed or disabled
                    if (!lessonPlan) {
                        console.log("🔄 Using sequential generation (fallback)...");
                        lessonPlan = await generateTeacherStepContent(
                            unit.title,
                            sourceText,
                            grade,
                            sourceType,
                            wizardData?.fileData
                        );
                    }

                    if (lessonPlan) {
                        // 2.5 🚀 Generate AI Images ASYNCHRONOUSLY (don't block content display!)
                        // Start visual generation in background - don't await it!
                        const visualPromise = generateLessonVisuals(lessonPlan).then(async (planWithVisuals) => {
                            console.log("✅ Visual assets generation completed (background)");
                            // Update the visual_summary URL in the existing blocks
                            setCourse((currentCourse: any) => {
                                if (!currentCourse?.syllabus) return currentCourse;
                                const updatedSyllabus = currentCourse.syllabus.map((m: Module) => {
                                    if (!m?.learningUnits) return m;
                                    return {
                                        ...m,
                                        learningUnits: m.learningUnits.map((u: LearningUnit) => {
                                            if (!u || u.id !== unit.id) return u;
                                            if (!u.activityBlocks?.length) return u;
                                            // Find and update both Hook and Summary blocks with visual URLs
                                            const updatedBlocks = u.activityBlocks
                                                .filter(block => block !== null)
                                                .map(block => {
                                                    // Update Hook block with curiosity image
                                                    if (block?.type === 'text' && block?.content?.includes('lesson-section hook')) {
                                                        const hookUrl = planWithVisuals.hook?.media_asset?.url;
                                                        if (hookUrl) {
                                                            // Replace the media-badge placeholder with actual image
                                                            let updatedContent = block.content.replace(
                                                                /<div class="media-badge">📺[^<]*<\/div>/,
                                                                `<div class="generated-visual"><img src="${hookUrl}" alt="Hook Visual" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" /></div>`
                                                            );
                                                            // Also handle case where there's a visual-placeholder
                                                            updatedContent = updatedContent.replace(
                                                                '<div class="visual-placeholder">🎨 יוצר תמונה...</div>',
                                                                `<div class="generated-visual"><img src="${hookUrl}" alt="Hook Visual" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" /></div>`
                                                            );
                                                            return { ...block, content: updatedContent };
                                                        }
                                                    }
                                                    // Update Summary block with infographic
                                                    if (block?.type === 'text' && block?.content?.includes('lesson-section summary')) {
                                                        // Inject the visual URL into the summary block
                                                        const visualUrl = planWithVisuals.summary.visual_summary?.url;
                                                        if (visualUrl) {
                                                            const updatedContent = block.content.replace(
                                                                '<div class="visual-placeholder">🎨 יוצר אינפוגרפיקה...</div>',
                                                                `<div class="generated-visual"><img src="${visualUrl}" alt="Summary Visual" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" /></div>`
                                                            );
                                                            return { ...block, content: updatedContent };
                                                        }
                                                    }
                                                    return block;
                                                });
                                            return { ...u, activityBlocks: updatedBlocks };
                                        })
                                    };
                                });
                                return { ...currentCourse, syllabus: updatedSyllabus };
                            });
                        }).catch(e => console.error("Background visual generation error:", e));

                        console.log("🎨 Visual generation started in background (not blocking content display)");

                        // 2.6 Process Independent Practice Interactive Blocks (NEW!)
                        let independentPracticeBlocks: any[] = [];
                        if (lessonPlan.independent_practice?.interactive_blocks && lessonPlan.independent_practice.interactive_blocks.length > 0) {
                            console.log("🎮 Processing independent practice interactive blocks...");
                            // Map the AI-generated blocks to ActivityBlocks format and filter out nulls
                            independentPracticeBlocks = lessonPlan.independent_practice.interactive_blocks
                                .map((block: any) => {
                                    return mapSystemItemToBlock({
                                        type: block.type,
                                        selected_interaction: block.type,
                                        ...block.data
                                    });
                                })
                                .filter((block: any) => block !== null && block !== undefined);
                            console.log(`✅ Processed ${independentPracticeBlocks.length} independent practice blocks`);
                        }

                        // 3. Map to Blocks (Visual Guide)
                        const newBlocks = [
                            {
                                id: crypto.randomUUID(),
                                type: 'text',
                                content: `
                                    <div class="lesson-section hook">
                                        <h3>🪝 פתיחה (The Hook)</h3>
                                        ${lessonPlan.lesson_metadata.learning_objectives ? `
                                            <div class="learning-objectives">
                                                <strong>🎯 מטרות הלמידה:</strong>
                                                <ul>${lessonPlan.lesson_metadata.learning_objectives.map(obj => `<li>${obj}</li>`).join('')}</ul>
                                            </div>
                                        ` : ''}
                                        <p class="teacher-script">${lessonPlan.hook.script_for_teacher}</p>
                                        ${lessonPlan.hook.classroom_management_tip ? `<div class="management-tip">💡 ${lessonPlan.hook.classroom_management_tip}</div>` : ''}
                                        ${lessonPlan.hook.media_asset?.url ? `
                                            <div class="generated-visual">
                                                <img src="${lessonPlan.hook.media_asset.url}" alt="Hook Visual" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" />
                                            </div>
                                        ` : lessonPlan.hook.media_asset ? `<div class="visual-placeholder">🎨 יוצר תמונה...</div>` : ''}
                                    </div>
                                `,
                                metadata: { time: '5 min', bloomLevel: 'remember' }
                            },
                            // DIRECT INSTRUCTION - Each slide as separate block
                            ...lessonPlan.direct_instruction.slides.map((slide, idx) => ({
                                id: crypto.randomUUID(),
                                type: 'text' as const,
                                content: `
                                    <div class="lesson-section instruction">
                                        <h3>🎓 הוראה פרונטלית: ${slide.slide_title}</h3>
                                        <div class="board-points">
                                            <strong>📝 על הלוח:</strong>
                                            <ul>${slide.bullet_points_for_board.map(p => `<li>${p}</li>`).join('')}</ul>
                                        </div>
                                        <p class="teacher-script"><strong>🗣️ למורה:</strong> ${slide.script_to_say}</p>
                                        ${slide.differentiation_note ? `<div class="diff-note">💡 ${slide.differentiation_note}</div>` : ''}
                                        ${slide.media_asset?.url ? `
                                            <div class="generated-visual">
                                                <img src="${slide.media_asset.url}" alt="${slide.slide_title}" style="max-width: 100%; border-radius: 8px; margin-top: 1rem;" />
                                            </div>
                                        ` : slide.media_asset ? `<div class="media-badge">📺 ${slide.media_asset.content}</div>` : ''}
                                    </div>
                                `,
                                metadata: { time: slide.timing_estimate || '5 min', bloomLevel: 'understand' }
                            })),
                            {
                                id: crypto.randomUUID(),
                                type: 'text',
                                content: `
                                    <div class="lesson-section practice">
                                        <h3>🧑‍🏫 תרגול מודרך (Guided Practice - In-Class)</h3>
                                        <p><strong>🎯 הנחיה להנחיית התרגול:</strong> ${lessonPlan.guided_practice.teacher_facilitation_script}</p>

                                        ${lessonPlan.guided_practice.example_questions && lessonPlan.guided_practice.example_questions.length > 0 ? `
                                            <div class="example-questions" style="margin: 15px 0; background: #EFF6FF; padding: 15px; border-radius: 8px; border-right: 4px solid #2B59C3;">
                                                <strong style="color: #2B59C3; font-size: 16px;">❓ שאלות להקראה בכיתה:</strong>
                                                ${lessonPlan.guided_practice.example_questions.map((q: any, i: number) => `
                                                    <div style="margin: 12px 0; padding: 12px; background: white; border-radius: 5px;">
                                                        <p style="margin: 0; font-weight: bold; color: #1E40AF;">שאלה ${i + 1}: ${q.question_text}</p>
                                                        <p style="margin: 8px 0 5px 0; color: #166534;">✓ <strong>תשובה צפויה:</strong> ${q.expected_answer}</p>
                                                        ${q.common_mistakes && q.common_mistakes.length > 0 ? `<p style="margin: 5px 0; color: #DC2626;">⚠️ <strong>טעויות נפוצות:</strong> ${q.common_mistakes.join(' | ')}</p>` : ''}
                                                        ${q.follow_up_prompt ? `<p style="margin: 5px 0; color: #7C3AED;">🔄 <strong>שאלת המשך:</strong> ${q.follow_up_prompt}</p>` : ''}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}

                                        ${lessonPlan.guided_practice.worked_example ? `
                                            <div class="worked-example" style="margin: 15px 0; background: #FEF3C7; padding: 15px; border-radius: 8px; border: 2px solid #F59E0B;">
                                                <strong style="color: #B45309; font-size: 16px;">📝 דוגמה מעשית (לפתרון על הלוח):</strong>
                                                <p style="margin: 10px 0; font-weight: bold;">${lessonPlan.guided_practice.worked_example.problem}</p>
                                                <div style="background: white; padding: 12px; border-radius: 5px; margin: 10px 0;">
                                                    <strong>שלבי הפתרון:</strong>
                                                    <ol style="margin: 8px 0;">${lessonPlan.guided_practice.worked_example.solution_steps.map((step: string) => `<li style="margin: 5px 0;">${step}</li>`).join('')}</ol>
                                                </div>
                                                ${lessonPlan.guided_practice.worked_example.key_points && lessonPlan.guided_practice.worked_example.key_points.length > 0 ? `
                                                    <div style="margin-top: 10px;">
                                                        <strong style="color: #B45309;">💡 נקודות להדגשה:</strong>
                                                        <ul style="margin: 5px 0;">${lessonPlan.guided_practice.worked_example.key_points.map((point: string) => `<li>${point}</li>`).join('')}</ul>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}

                                        ${lessonPlan.guided_practice.differentiation_strategies ? `
                                            <div class="differentiation">
                                                <strong>🎯 דיפרנציאציה:</strong>
                                                <p>👥 <strong>תלמידים מתקשים:</strong> ${lessonPlan.guided_practice.differentiation_strategies.for_struggling_students}</p>
                                                <p>🚀 <strong>תלמידים מתקדמים:</strong> ${lessonPlan.guided_practice.differentiation_strategies.for_advanced_students}</p>
                                            </div>
                                        ` : ''}
                                        ${lessonPlan.guided_practice.assessment_tips && lessonPlan.guided_practice.assessment_tips.length > 0 ? `
                                            <div class="assessment-tips">
                                                <strong>📊 על מה לשים לב במהלך התרגול:</strong>
                                                <ul>${lessonPlan.guided_practice.assessment_tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
                                            </div>
                                        ` : ''}
                                    </div>
                                `,
                                metadata: { time: '10 min', bloomLevel: 'apply' }
                            },
                            // INDEPENDENT PRACTICE - Header block
                            {
                                id: crypto.randomUUID(),
                                type: 'text',
                                content: `
                                    <div class="lesson-section independent-practice">
                                        <h3>💻 תרגול עצמאי (Independent Practice)</h3>
                                        <p><strong>📝 הנחיות:</strong> ${lessonPlan.independent_practice?.introduction_text || 'בצעו את הפעילויות האינטראקטיביות הבאות'}</p>
                                        ${lessonPlan.independent_practice?.estimated_duration ? `<div class="duration-badge">⏱️ משך משוער: ${lessonPlan.independent_practice.estimated_duration}</div>` : ''}
                                    </div>
                                `,
                                metadata: { time: '10 min', bloomLevel: 'apply' }
                            },
                            // INTERACTIVE BLOCKS - Each as separate component!
                            ...independentPracticeBlocks,
                            {
                                id: crypto.randomUUID(),
                                type: 'text',
                                content: `
                                    <div class="lesson-section discussion">
                                        <h3>💬 דיון כיתתי (Discussion)</h3>
                                        <div class="discussion-questions">
                                            <ul>${lessonPlan.discussion.questions.map(q => {
                                                // Handle both string and object formats
                                                if (typeof q === 'string') return `<li>❓ ${q}</li>`;
                                                if (typeof q === 'object' && q !== null) {
                                                    const questionText = q.question || q.text || q.question_text || JSON.stringify(q);
                                                    return `<li>❓ ${questionText}</li>`;
                                                }
                                                return '';
                                            }).join('')}</ul>
                                        </div>
                                        ${lessonPlan.discussion.facilitation_tips ? `
                                            <div class="facilitation-tips">
                                                <strong>🎯 טיפים להנחיה:</strong>
                                                <ul>${lessonPlan.discussion.facilitation_tips.map(tip => `<li>${typeof tip === 'string' ? tip : (tip?.text || tip?.tip || '')}</li>`).join('')}</ul>
                                            </div>
                                        ` : ''}
                                    </div>
                                `,
                                metadata: { time: '5 min', bloomLevel: 'evaluate' }
                            },
                            {
                                id: crypto.randomUUID(),
                                type: 'text',
                                content: `
                                    <div class="lesson-section summary">
                                        <h3>📝 סיכום (Summary)</h3>
                                        <p class="takeaway"><strong>💡 משפט סיכום למחברת:</strong> "${lessonPlan.summary.takeaway_sentence}"</p>
                                        <div class="visual-placeholder">🎨 יוצר אינפוגרפיקה...</div>
                                        ${lessonPlan.summary.homework_suggestion ? `
                                            <div class="homework">
                                                <strong>📚 הצעה לשיעורי בית:</strong> ${lessonPlan.summary.homework_suggestion}
                                            </div>
                                        ` : ''}
                                    </div>
                                `,
                                metadata: { time: '5 min', bloomLevel: 'remember' }
                            }
                        ];

                        // 4. Save
                        setCourse((prev: any) => {
                            if (!prev) return prev;
                            const newSyllabus = prev.syllabus.map((m: Module) => ({
                                ...m,
                                learningUnits: m.learningUnits.map((u: LearningUnit) =>
                                    u.id === unit.id ? { ...u, activityBlocks: newBlocks, metadata: { ...u.metadata, status: 'ready' } } : u
                                )
                            }));
                            const newCourse = { ...prev, syllabus: newSyllabus };
                            saveCourseToFirestore(newCourse);
                            return newCourse;
                        });

                        continue; // Skip the rest of the loop (Skeleton generation)
                    }
                }

                // === STUDENT ACTIVITY MODE (Legacy / Gamification) ===
                // 2. Generate Skeleton
                const skeleton = await generateUnitSkeleton(
                    unit.title,
                    grade,
                    activityLength,
                    sourceText,
                    mode === 'lesson' ? 'learning' : mode,
                    taxonomy,
                    productType
                );

                if (skeleton && skeleton.steps) {
                    const totalSteps = skeleton.steps.length;

                    const stepPromises = skeleton.steps.map(async (step: any) => {

                        const content = await generateStepContent(
                            unit.title,
                            step,
                            grade,
                            sourceText,
                            undefined,
                            'learning',
                            undefined,
                            totalSteps
                        );


                        const mapped = mapSystemItemToBlock(content);
                        // console.log(`🧩 [Step ${step.step_number}] Mapped Block:`, mapped);
                        return mapped;
                    });

                    const newBlocksRaw = await Promise.all(stepPromises);
                    // DEBUG: Instead of filtering, map failures to Error Blocks
                    let newBlocks = newBlocksRaw.map((b: any, idx) => {
                        if (b === null) {
                            return {
                                id: crypto.randomUUID(),
                                type: 'text',
                                content: `⚠️ **Debug: Block Generation Failed for Step ${idx + 1}**\n\nCheck console logs for 'step content' or 'mapping' errors.`,
                                metadata: { score: 0, bloomLevel: 'evaluation' }
                            };
                        }
                        return b;
                    });



                    if (newBlocks.length === 0) {
                        console.warn("Generation yielded 0 blocks. Inserting Error Block.");
                        newBlocks = [{
                            id: crypto.randomUUID(),
                            type: 'text',
                            content: "⚠️ **תקלה ביצירה**\n\nלא הצלחנו לייצר את שלבי השיעור באופן אוטומטי. אנא נסו לייצר שוב ידנית.\n\n(Debug Info: API returned null or empty blocks)",
                            metadata: { score: 0, bloomLevel: 'evaluation' }
                        }];
                    }

                    // 4. Save Ready Unit
                    setCourse((prev: any) => {
                        if (!prev) return prev;
                        // DEEP DEBUG: Check if we find the unit
                        let updateFound = false;
                        const newSyllabus = prev.syllabus.map((m: Module) => ({
                            ...m,
                            learningUnits: m.learningUnits.map((u: LearningUnit) => {
                                if (u.id === unit.id) {
                                    updateFound = true;

                                    return { ...u, activityBlocks: newBlocks, metadata: { ...u.metadata, status: 'ready' } };
                                }
                                return u;
                            })
                        }));

                        if (!updateFound) console.error(`❌ [State Update] Unit ${unit.id} NOT FOUND in current state! IDs mismatch.`);

                        const newCourse = { ...prev, syllabus: newSyllabus };
                        saveCourseToFirestore(newCourse).catch((e: any) => console.error("Auto-save failed", e));
                        return newCourse;
                    });

                } else {
                    console.warn("Skeleton generation failed for", unit.title);
                }

            } catch (err) {
                console.error("Error building unit", unit.title, err);
            }
        }
    };

    const handleWizardComplete = async (data: any) => {
        if (isGenerating) return; // מניעת לחיצות כפולות

        wizardHasRun.current = true;
        setShowWizard(false);
        // setShowLoader(true); // Removed by user request
        setIsGenerating(true);

        // console.log("📦 Full Wizard Data Output:", JSON.stringify(data, null, 2));

        try {
            const extractedGrade =
                (Array.isArray(data.targetAudience) ? data.targetAudience[0] : data.targetAudience) ||
                (Array.isArray(data.gradeLevel) ? data.gradeLevel[0] : data.gradeLevel) ||
                (Array.isArray(data.grade) ? data.grade[0] : data.grade) ||
                (data.settings?.targetAudience) ||
                (data.settings?.gradeLevel) ||
                (data.settings?.grade) ||
                "כללי";

            // console.log("🎯 FINAL GRADE DETECTED:", extractedGrade);

            const userSubject = data.settings?.subject || data.subject || "כללי";

            setForcedGrade(extractedGrade);

            // --- עיבוד הקובץ לפני השליחה (הוזז למעלה כדי לשמור ב-DB) ---
            let processedFileData = undefined; // עבור תמונות
            let processedSourceText = undefined; // עבור טקסט/PDF

            if (data.file) {
                const file = data.file;
                // console.log("Processing file:", file.name, file.type);

                try {
                    if (file.type === 'application/pdf') {
                        // חילוץ טקסט מ-PDF
                        processedSourceText = await extractTextFromPDF(file);
                        // console.log("PDF Text Extracted (First 5 pages)");
                    } else if (file.type.startsWith('image/')) {
                        // המרה ל-Base64 עבור תמונות
                        processedFileData = await fileToBase64(file);
                    } else if (file.type === 'text/plain') {
                        // קריאת קובץ טקסט
                        processedSourceText = await file.text();
                    } else {
                        console.warn("Unsupported file type for AI analysis, using metadata solely.");
                    }
                } catch (fileError) {
                    console.error("File processing failed:", fileError);
                    alert("שגיאה בעיבוד הקובץ. המערכת תמשיך על בסיס הנושא בלבד.");
                }
            } else if (data.pastedText) {
                console.log("📝 Using pasted text as source, length:", data.pastedText.length);
                processedSourceText = data.pastedText;
            }

            // DEBUG: Log what we're sending to AI
            console.log("🔍 DEBUG - processedSourceText:", processedSourceText ? `${processedSourceText.substring(0, 200)}... (${processedSourceText.length} chars)` : "UNDEFINED");

            // --- חילוץ נושא מטקסט מודבק אם לא סופק נושא ---
            let topicToUse = data.topic || data.title || course.title;
            if ((!topicToUse || topicToUse === "פעילות טקסט חופשי" || topicToUse === "נושא כללי") && processedSourceText && processedSourceText.length > 100) {
                console.log("🔍 No topic provided, extracting from pasted text...");
                topicToUse = await extractTopicFromText(processedSourceText);
                console.log("✅ Extracted topic:", topicToUse);
            }
            topicToUse = topicToUse || "נושא כללי";

            const updatedCourseState = {
                ...course,
                title: topicToUse,
                subject: userSubject,
                gradeLevel: extractedGrade,
                mode: data.settings?.courseMode || 'learning',
                activityLength: data.settings?.activityLength || 'medium',
                botPersona: data.settings?.botPersona || null,
                showSourceToStudent: data.settings?.showSourceToStudent || false,
                fullBookContent: processedSourceText || course.fullBookContent || "", // שמירת התוכן המחולץ
                wizardData: data // CRITICAL: Save full wizard data including settings.productType
            };

            setCourse(updatedCourseState);

            // SANITIZE FOR FIRESTORE (Remove undefined)
            const cleanDataForFirestore = JSON.parse(JSON.stringify({
                title: topicToUse,
                subject: userSubject,
                gradeLevel: extractedGrade,
                mode: updatedCourseState.mode,
                activityLength: updatedCourseState.activityLength,
                botPersona: updatedCourseState.botPersona,
                showSourceToStudent: updatedCourseState.showSourceToStudent,
                fullBookContent: updatedCourseState.fullBookContent,
                wizardData: data // CRITICAL: Persist to DB
            }));

            await updateDoc(doc(db, "courses", course.id), cleanDataForFirestore);

            // יצירת סילבוס (מבנה בלבד עבור מערך שיעור, מלא עבור אחרים)
            let syllabus: Module[] = [];

            if (data.settings?.productType === 'lesson') {
                // progressive loading strategy
                // console.log("🏗️ Building Skeleton Syllabus (Client-Side)...");
                syllabus = await generateCourseSyllabus(
                    topicToUse,
                    extractedGrade,
                    data.settings?.activityLength || 'medium',
                    userSubject,
                    processedSourceText,
                    data.settings?.productType
                );


                // --- PROGRESSIVE QUEUE TRIGGER ---
                processLessonPlanQueue(
                    syllabus,
                    processedSourceText || topicToUse,
                    extractedGrade,
                    data.settings?.activityLength || 'medium',
                    'lesson',
                    null,
                    data.settings?.productType
                ).catch(e => console.error("Queue Error:", e));

            } else {
                // legacy / cloud function strategy (games, exams)
                syllabus = await generateCoursePlan(
                    topicToUse,
                    extractedGrade,
                    processedFileData,
                    userSubject,
                    processedSourceText,
                    data.settings?.includeBot !== false, // includeBot
                    data.settings?.productType, // 🆕 Product Type (will route to exam_generation_queue if 'exam')
                    data.settings?.activityLength, // 🆕 Activity Length
                    data.settings?.taxonomy, // 🆕 Taxonomy
                    data.settings?.questionPreferences // 🆕 הגדרות מתקדמות לסוגי שאלות
                );
            }

            const courseWithSyllabus = { ...updatedCourseState, syllabus };
            setCourse(courseWithSyllabus);

            // ARCHITECT FIX: Use immediate save for wizard completion (critical checkpoint)
            await saveCourseToFirestoreImmediate(courseWithSyllabus);

            if (syllabus.length > 0 && syllabus[0].learningUnits.length > 0) {
                const firstUnit = syllabus[0].learningUnits[0];
                // console.log("🧠 Starting V4 Generation for:", firstUnit.title);

                // --- PODCAST PRODUCT HANDLER ---
                if (data.settings?.productType === 'podcast') {
                    // console.log("🎙️ Generating Podcast Product...");
                    const script = await generatePodcastScript(
                        processedSourceText || '',  // Empty string triggers auto-generation in backend
                        topicToUse,
                        extractedGrade,  // Pass grade level for language adaptation
                        data.settings?.activityLength || 'medium'  // Pass podcast length
                    );

                    if (script) {
                        const podcastBlock: ActivityBlock = {
                            id: crypto.randomUUID(),
                            type: 'podcast',
                            content: {
                                title: `פודקאסט: ${topicToUse}`,
                                script: script,
                                audioUrl: null // Generated later
                            },
                            metadata: {
                                bloomLevel: 'synthesis',
                                score: 100,
                                difficultyLevel: 3,
                                generatedBy: 'wizdi-wizard-v4'
                            }
                        };

                        const syllabusWithPodcast = syllabus.map((mod: any) => ({
                            ...mod,
                            learningUnits: mod.learningUnits.map((u: any) =>
                                u.id === firstUnit.id ? { ...u, activityBlocks: [podcastBlock] } : u
                            )
                        }));


                        const finalCourse = { ...courseWithSyllabus, syllabus: syllabusWithPodcast };
                        setCourse(finalCourse);
                        // ARCHITECT FIX: Use immediate save for podcast completion
                        await saveCourseToFirestoreImmediate(finalCourse);
                        setSelectedUnitId(firstUnit.id);
                    } else {
                        alert("שגיאה ביצירת הפודקאסט. נסה שוב.");
                    }
                }
                // --- DIFFERENTIATED INSTRUCTION HANDLER ---
                else if (data.settings?.isDifferentiated) {
                    // console.log("🧬 Starting Differentiated Instruction Generation...");

                    const diffContent = await generateDifferentiatedContent(
                        topicToUse,
                        extractedGrade,
                        processedSourceText || course.title,
                        userSubject,
                        data.settings?.productType || 'activity', // Pass product type for exam vs activity
                        data.settings?.activityLength || 'medium' // Pass activity length
                    );

                    if (diffContent) {
                        // Helper to create a unit from raw items
                        const isExam = data.settings?.productType === 'exam';
                        const createDiffUnit = (levelName: string, items: any[]) => {
                            const blocks = items.map(item => mapSystemItemToBlock({ data: item } as any)).filter(b => b !== null);
                            return {
                                id: crypto.randomUUID(),
                                title: `${firstUnit.title} (${levelName})`,
                                // duration: "45 דק", // Removed: Not in interface
                                // isCompleted: false, // Removed: Not in interface
                                baseContent: processedSourceText || "", // Required
                                activityBlocks: blocks,
                                type: isExam ? 'test' : 'practice' // 'acquisition' | 'practice' | 'test'
                            } as LearningUnit;
                        };

                        const unitSupport = createDiffUnit("הבנה", diffContent.support);
                        const unitCore = createDiffUnit("יישום", diffContent.core);
                        const unitEnrichment = createDiffUnit("העמקה", diffContent.enrichment);

                        // Replace the single placeholder unit with our 3 new units
                        const syllabusWithDiff = syllabus.map((mod: any) => ({
                            ...mod,
                            learningUnits: mod.learningUnits.map((u: any) =>
                                u.id === firstUnit.id ? [unitSupport, unitCore, unitEnrichment] : u
                            ).flat()
                        }));

                        const finalCourse = { ...courseWithSyllabus, syllabus: syllabusWithDiff };
                        setCourse(finalCourse);
                        // ARCHITECT FIX: Use immediate save for differentiated completion
                        await saveCourseToFirestoreImmediate(finalCourse);

                        // Select the Core unit by default
                        setSelectedUnitId(unitCore.id);

                        // Auto-preview Core unit if it's a lesson
                        if (data.settings?.productType === 'lesson') {
                            // setShowLoader(false);
                            setPreviewUnit(unitCore);
                        }
                    } else {
                        alert("שגיאה ביצירת תוכן דיפרנציאלי.");
                    }
                }
                // --- STANDARD UNIT HANDLER ---
                else {
                    // console.log("🧠 Starting V4 Generation...");

                    // CHECK FOR LESSON MODE -> PROGRESSIVE BUILD
                    if (data.settings?.productType === 'lesson' || updatedCourseState.mode === 'lesson') {
                        // Lesson Mode: We want to build the WHOLE plan progressively.
                        // 1. We already have the Syllabus (Schema) saved above.
                        // 2. Close the loader immediately so user sees the "Schema" in Overview.
                        // setShowLoader(false);
                        setSelectedUnitId(null); // Ensure Overview is shown

                        // 3. Trigger Background Progressive Build
                        processLessonPlanQueue(
                            syllabus, // Use the fresh syllabus
                            processedSourceText || updatedCourseState.fullBookContent,
                            extractedGrade,
                            updatedCourseState.activityLength || 'medium',
                            updatedCourseState.mode || 'learning',
                            data.settings?.taxonomy,
                            data.settings?.productType
                        );
                        return; // Exit here, queue runs in background
                    }

                    // ORIGINAL SINGLE UNIT LOGIC (For Legacy/Game Modes)
                    // console.log("🧠 Starting Standard Single Unit Generation for:", firstUnit.title);

                    // 1. BRAIN: Generate Skeleton
                    const skeleton = await generateUnitSkeleton(
                        firstUnit.title,
                        extractedGrade,
                        updatedCourseState.activityLength || 'medium', // Default to medium
                        processedSourceText || updatedCourseState.fullBookContent, // GROUNDING FIX: Fallback to stored content
                        updatedCourseState.mode || 'learning',
                        data.settings?.taxonomy, // Pass Dynamic Bloom Preferences
                        data.settings?.productType // Pass product type (lesson/game/exam)
                    );

                    if (skeleton && skeleton.steps) {
                        // 2. HANDS: Generate Step Content (Parallel)
                        const totalSteps = skeleton.steps.length;
                        const stepPromises = skeleton.steps.map(async (step: any) => {
                            const stepContent = await generateStepContent(
                                firstUnit.title,
                                step, // Pass the skeleton step info
                                extractedGrade,
                                processedSourceText || updatedCourseState.fullBookContent,
                                processedFileData, // Images if any
                                'learning',
                                undefined,
                                totalSteps // For scaffolding
                            );

                            // 3. NORMALIZE: Map to UI Block
                            return mapSystemItemToBlock(stepContent);
                        });

                        // Wait for all hands to finish
                        const newBlocksRaw = await Promise.all(stepPromises);

                        // Filter out nulls (failures)
                        const newBlocks = newBlocksRaw.filter((b: any) => b !== null);

                        const syllabusWithContent = syllabus.map((mod: any) => ({
                            ...mod,
                            learningUnits: mod.learningUnits.map((u: any) =>
                                u.id === firstUnit.id ? { ...u, activityBlocks: newBlocks } : u
                            )
                        }));

                        const finalCourse = { ...courseWithSyllabus, syllabus: syllabusWithContent };
                        setCourse(finalCourse);
                        // ARCHITECT FIX: Use immediate save for final content
                        await saveCourseToFirestoreImmediate(finalCourse);

                        setSelectedUnitId(firstUnit.id);
                    } else {
                        console.error("❌ Skeleton Generation Failed");
                        setSelectedUnitId(firstUnit.id);
                    }
                }
            }

        } catch (error) {
            console.error("Error generating content:", error);
            // CRITICAL FIX: Close loader IMMEDIATELY before alert
            // setShowLoader(false);
            // Small timeout to allow React to render the closed state before alert blocks thread
            setTimeout(() => {
                alert("אירעה שגיאה ביצירת התוכן. ייתכן שיש עומס על השרת.");
            }, 100);
        } finally {
            setIsGenerating(false);
        }
    };




    const handleSaveUnit = async (updatedUnit: LearningUnit) => {
        console.log('[handleSaveUnit] Called with unit:', updatedUnit.id, updatedUnit.title);
        console.log('[handleSaveUnit] isGenerating:', isGenerating);
        console.log('[handleSaveUnit] activityBlocks:', updatedUnit.activityBlocks?.length);

        // Note: We no longer block on isGenerating to allow manual block additions
        // during AI generation. Only automatic next-unit generation is blocked.

        const newSyllabus = course.syllabus.map((mod: any) => ({
            ...mod,
            learningUnits: mod.learningUnits.map((u: any) => u.id === updatedUnit.id ? updatedUnit : u)
        }));

        let nextUnitToGenerate = null;
        let foundCurrent = false;

        // Only look for next unit to auto-generate if not currently generating
        if (!isGenerating) {
            for (const mod of newSyllabus) {
                for (const unit of mod.learningUnits) {
                    if (foundCurrent && (!unit.activityBlocks || unit.activityBlocks.length === 0)) {
                        nextUnitToGenerate = unit;
                        break;
                    }
                    if (unit.id === updatedUnit.id) foundCurrent = true;
                }
                if (nextUnitToGenerate) break;
            }
        }

        if (nextUnitToGenerate) {
            const currentSubject = course.subject || "כללי";

            // Use the variant-enabled generator for adaptive content
            generateFullUnitContentWithVariants(
                nextUnitToGenerate.title,
                course.title,
                displayGrade,
                undefined,
                currentSubject,
                undefined, // sourceText
                undefined, // taxonomy
                true, // includeBot (default)
                course.mode || 'learning', // Pass course mode
                course.activityLength || 'medium',
                true // generateVariants - enable adaptive variants
            ).then((newBlocks: ActivityBlock[]) => {
                if (newBlocks.length > 0) {
                    const backgroundSyllabus = newSyllabus.map((m: any) => ({
                        ...m,
                        learningUnits: m.learningUnits.map((u: any) =>
                            u.id === nextUnitToGenerate!.id ? { ...u, activityBlocks: newBlocks } : u
                        )
                    }));
                    // ARCHITECT FIX: Save only the specific generated unit
                    const unitToSave = backgroundSyllabus
                        .flatMap((m: any) => m.learningUnits)
                        .find((u: any) => u.id === nextUnitToGenerate!.id);

                    if (unitToSave) {
                        saveUnitToFirestore(course.id, unitToSave).catch(e => console.error("Background unit save failed", e));
                    }

                    // Update state
                    setCourse({ ...course, syllabus: backgroundSyllabus });
                }
            });
        }

        const updatedCourse = { ...course, syllabus: newSyllabus };
        setCourse(updatedCourse);

        try {
            // ARCHITECT FIX: Save specific unit instead of full doc
            await saveUnitToFirestore(course.id, updatedUnit);
        }
        catch (e) { console.error("Save error:", e); }
    };



    const activeUnit = course.syllabus?.flatMap((m: any) => m.learningUnits).find((u: any) => u.id === selectedUnitId);

    // --- Single Activity Logic ---
    // Fallback: If no unit is selected but units exist, default to the first one immediately ONLY IF NOT LESSON MODE.
    const defaultUnit = course.syllabus?.[0]?.learningUnits?.[0];
    const isLessonMode = course.wizardData?.settings?.productType === 'lesson' || course.mode === 'lesson';
    // FIX: Lesson Mode should ALWAYS show the unit (Single Unit). Legacy modes might vary.
    // For now, we restrict the "Always Open" behavior to Lesson Mode to avoid trapping Game Mode users.
    const unitToRender = activeUnit || (isLessonMode ? defaultUnit : null);

    // console.log("DEBUG: Editor Render. active:", !!activeUnit, "default:", !!defaultUnit, "isLesson:", isLessonMode, "RENDER:", unitToRender ? "UnitEditor" : "Overview");

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Wizard Overlay - ALWAYS available on top */}
            {showWizard && !isGenerating && (
                <IngestionWizard
                    onComplete={handleWizardComplete}
                    onCancel={() => {
                        setShowWizard(false);
                        // אם עדיין אין תוכן וביטלנו, חוזרים הביתה
                        if (!course?.syllabus?.length) {
                            navigate('/');
                        }
                    }}
                    initialTopic={course.title}
                    title="הגדרות פעילות"
                    cancelLabel="סגור"
                    cancelIcon={<IconX className="w-6 h-6" />}
                />
            )}

            {/* Global Loading Overlay (Tic-Tac-Toe Zen Mode) */}
            {/* Global Loading Overlay Removed by User Request */}
            {/* {showLoader && (
                <TicTacToeLoader
                    isLoading={isGenerating}
                    onContinue={() => setShowLoader(false)}
                />
            )} */}

            {/* Preview Modal */}
            {previewUnit && (
                <UnitPreviewModal
                    unit={previewUnit}
                    onClose={() => setPreviewUnit(null)}
                />
            )}

            {/* Main Content Area */}
            {/* Main Content Area */}
            {unitToRender ? (
                // Logic: Check if we should show TeacherCockpit (Lesson Mode) or UnitEditor (Builder Mode)
                (course.wizardData?.settings?.productType === 'lesson' || course.mode === 'lesson') ? (
                    <TeacherCockpit
                        unit={unitToRender}
                        courseId={course.id}
                        onExit={() => {
                            if (onBack) {
                                onBack();
                            } else {
                                window.location.href = '/';
                            }
                        }}
                        onUnitUpdate={handleSaveUnit}
                        onUpdateBlock={async (blockId: string, content: any) => {
                            // Handle AI Refinement Updates from Cockpit
                            const updatedUnit = {
                                ...unitToRender,
                                activityBlocks: unitToRender.activityBlocks.map((b: any) => b.id === blockId ? { ...b, content } : b)
                            };
                            handleSaveUnit(updatedUnit);
                        }}
                    />
                ) : (
                    <UnitEditor
                        unit={unitToRender}
                        gradeLevel={displayGrade}
                        subject={course.subject}
                        onSave={handleSaveUnit}
                        onCancel={() => {
                            navigate('/'); // חזרה לדף הבית
                        }}
                        onPreview={(unitData) => setPreviewUnit(unitData || unitToRender)}
                        cancelLabel="הגדרות"
                    />
                )
            ) : (
                // Empty State OR Lesson Plan Overview
                (course.wizardData?.settings?.productType === 'lesson' || course.mode === 'lesson') ? (
                    <LessonPlanOverview
                        course={course}
                        onUpdateCourse={(updated) => {
                            setCourse(updated);
                            saveCourseToFirestore(updated).catch(console.error);
                        }}
                        onSelectUnit={(id) => setSelectedUnitId(id)}
                        onUnitUpdate={(unit) => handleSaveUnit(unit)}
                        onGenerateWithAI={handleGenerateWithAI}
                        onBack={onBack}
                    />
                ) : (
                    // Classic Loading State with Typewriter effect
                    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-center px-4">
                        <AIStarsSpinner size="xl" color="primary" className="mb-4" />
                        <p className="text-gray-600 font-medium text-lg mb-3">טוען את הפעילות...</p>
                        {/* Typewriter status messages */}
                        <div className="min-h-[1.5rem] mb-3">
                            <TypewriterLoaderInline
                                contentType={
                                    course.wizardData?.settings?.productType === 'exam' ? 'exam' :
                                    course.wizardData?.settings?.productType === 'lesson' ? 'lesson' :
                                    'activity'
                                }
                                isVisible={true}
                                className="text-indigo-600 font-medium"
                            />
                        </div>
                        <p className="text-gray-400 text-sm mt-2 max-w-md">הנתונים מתעדכנים מהענן. אם זה לוקח זמן רב, נסה לרענן.</p>
                        <button onClick={() => window.location.reload()} className="mt-6 text-indigo-600 hover:text-indigo-800 text-sm font-bold underline">
                            רענן עמוד
                        </button>
                    </div>
                )
            )}
        </div>
    );
};

export default CourseEditor;