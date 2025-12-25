import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCourseStore } from '../context/CourseContext';
import CoursePlayer from './CoursePlayer';
import UnitEditor from './UnitEditor';
import { IconEye, IconX } from '../icons';
import IngestionWizard from './IngestionWizard';
import { generateCoursePlan, generateFullUnitContent } from '../gemini';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { LearningUnit, ActivityBlock } from '../courseTypes';
import * as pdfjsLib from 'pdfjs-dist';

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
                        hideReviewHeader={true}
                    />
                    {/* מרווח תחתון */}
                    <div className="h-20 w-full" />
                </div>
            </div>
        </div>
    );
};



import TicTacToeLoader from './TicTacToeLoader';

// ... existing imports ...

const CourseEditor: React.FC = () => {
    const navigate = useNavigate();
    const { course, setCourse } = useCourseStore();
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [previewUnit, setPreviewUnit] = useState<LearningUnit | null>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showLoader, setShowLoader] = useState(false); // New state logic

    // משתנה לעקיפת התצוגה
    const [forcedGrade, setForcedGrade] = useState<string>("");

    const wizardHasRun = useRef(false);
    const hasAutoSelected = useRef(false);

    // --- התיקון לקריטי למניעת 429 ולולאות ---
    useEffect(() => {
        // הגנה ראשונית: אם כבר רץ וויזארד או שיש תהליך יצירה, עוצרים
        if (wizardHasRun.current || isGenerating) return;

        // הגנה משנית: אם אין קורס כלל או שהוא בטעינה
        if (!course || course.id === 'loading') return;

        // בדיקה האם הקורס מאוכלס בסילבוס
        const hasSyllabus = course.syllabus && course.syllabus.length > 0;

        if (hasSyllabus && !hasAutoSelected.current) {
            const firstModule = course.syllabus[0];
            if (firstModule.learningUnits?.length > 0) {
                const firstUnit = firstModule.learningUnits[0];
                if (!selectedUnitId) {
                    setSelectedUnitId(firstUnit.id);
                    hasAutoSelected.current = true;
                }
            }
        }
        else if (!hasSyllabus) {
            // אם אין תוכן - פותחים את הוויזארד אוטומטית תמיד
            if (!showWizard) {
                setShowWizard(true);
            }
        }
    }, [course, showWizard, isGenerating, selectedUnitId]);

    if (!course) return <div className="flex items-center justify-center h-screen text-gray-500">נא לבחור שיעור...</div>;

    const displayGrade = forcedGrade || course.gradeLevel || course.targetAudience || "כללי";

    const handleWizardComplete = async (data: any) => {
        if (isGenerating) return; // מניעת לחיצות כפולות

        wizardHasRun.current = true;
        setShowWizard(false);
        setShowLoader(true); // Start game loader
        setIsGenerating(true);

        console.log("📦 Full Wizard Data Output:", JSON.stringify(data, null, 2));

        try {
            const topicToUse = data.topic || course.title || "נושא כללי";

            let extractedGrade = "כללי";
            if (data.grade) extractedGrade = data.grade;
            else if (data.gradeLevel) extractedGrade = data.gradeLevel;
            else if (data.targetAudience) extractedGrade = data.targetAudience;
            else if (data.settings?.grade) extractedGrade = data.settings.grade;
            else if (data.settings?.gradeLevel) extractedGrade = data.settings.gradeLevel;
            else if (data.settings?.targetAudience) extractedGrade = data.settings.targetAudience;

            if (Array.isArray(extractedGrade)) {
                extractedGrade = extractedGrade[0];
            }

            console.log("🎯 FINAL GRADE DETECTED:", extractedGrade);

            const userSubject = data.settings?.subject || data.subject || "כללי";

            setForcedGrade(extractedGrade);

            // --- עיבוד הקובץ לפני השליחה (הוזז למעלה כדי לשמור ב-DB) ---
            let processedFileData = undefined; // עבור תמונות
            let processedSourceText = undefined; // עבור טקסט/PDF

            if (data.file) {
                const file = data.file;
                console.log("Processing file:", file.name, file.type);

                try {
                    if (file.type === 'application/pdf') {
                        // חילוץ טקסט מ-PDF
                        processedSourceText = await extractTextFromPDF(file);
                        console.log("PDF Text Extracted (First 5 pages)");
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
            }

            const updatedCourseState = {
                ...course,
                title: topicToUse,
                subject: userSubject,
                gradeLevel: extractedGrade,
                mode: data.settings?.courseMode || 'learning',
                botPersona: data.settings?.botPersona || null,
                showSourceToStudent: data.settings?.showSourceToStudent || false,
                fullBookContent: processedSourceText || course.fullBookContent || "" // שמירת התוכן המחולץ
            };

            setCourse(updatedCourseState);

            await updateDoc(doc(db, "courses", course.id), {
                title: topicToUse,
                subject: userSubject,
                gradeLevel: extractedGrade,
                mode: updatedCourseState.mode,
                botPersona: data.settings?.botPersona || null,
                showSourceToStudent: data.settings?.showSourceToStudent || false,
                fullBookContent: processedSourceText || course.fullBookContent || "" // שמירה לדאטהבייס
            });

            // יצירת סילבוס עם הנתונים המעובדים
            const syllabus = await generateCoursePlan(
                topicToUse,
                extractedGrade,
                processedFileData, // לתמונות
                userSubject,
                processedSourceText // לטקסט מחולץ
            );

            const courseWithSyllabus = { ...updatedCourseState, syllabus };
            setCourse(courseWithSyllabus);
            await updateDoc(doc(db, "courses", course.id), { syllabus });

            if (syllabus.length > 0 && syllabus[0].learningUnits.length > 0) {
                const firstUnit = syllabus[0].learningUnits[0];

                // יצירת תוכן ראשוני
                const newBlocks = await generateFullUnitContent(
                    firstUnit.title,
                    topicToUse,
                    extractedGrade,
                    processedFileData,
                    userSubject,
                    processedSourceText, // העברת הטקסט המחולץ גם לכאן
                    { ...data.settings?.taxonomy, botPersona: data.settings?.botPersona } // Pass taxonomy settings with persona
                );

                const syllabusWithContent = syllabus.map((mod: any) => ({
                    ...mod,
                    learningUnits: mod.learningUnits.map((u: any) =>
                        u.id === firstUnit.id ? { ...u, activityBlocks: newBlocks } : u
                    )
                }));

                const finalCourse = { ...courseWithSyllabus, syllabus: syllabusWithContent };
                setCourse(finalCourse);
                await updateDoc(doc(db, "courses", course.id), { syllabus: syllabusWithContent });

                setSelectedUnitId(firstUnit.id);
            }

        } catch (error) {
            console.error("Error generating content:", error);
            alert("אירעה שגיאה ביצירת התוכן. ייתכן שיש עומס על השרת.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveUnit = async (updatedUnit: LearningUnit) => {
        if (isGenerating) return;

        const newSyllabus = course.syllabus.map(mod => ({
            ...mod,
            learningUnits: mod.learningUnits.map(u => u.id === updatedUnit.id ? updatedUnit : u)
        }));

        let nextUnitToGenerate = null;
        let foundCurrent = false;

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

        if (nextUnitToGenerate) {
            const currentSubject = course.subject || "כללי";

            generateFullUnitContent(
                nextUnitToGenerate.title,
                course.title,
                displayGrade,
                undefined,
                currentSubject
            ).then((newBlocks: ActivityBlock[]) => {
                if (newBlocks.length > 0) {
                    const backgroundSyllabus = newSyllabus.map(m => ({
                        ...m,
                        learningUnits: m.learningUnits.map(u =>
                            u.id === nextUnitToGenerate!.id ? { ...u, activityBlocks: newBlocks } : u
                        )
                    }));
                    setCourse({ ...course, syllabus: backgroundSyllabus });
                    updateDoc(doc(db, "courses", course.id), { syllabus: backgroundSyllabus });
                }
            });
        }

        const updatedCourse = { ...course, syllabus: newSyllabus };
        setCourse(updatedCourse);
        try { await updateDoc(doc(db, "courses", course.id), { syllabus: newSyllabus }); }
        catch (e) { console.error("Save error:", e); }
    };



    const activeUnit = course.syllabus?.flatMap(m => m.learningUnits).find(u => u.id === selectedUnitId);

    // --- Single Activity Logic ---
    // Fallback: If no unit is selected but units exist, default to the first one immediately.
    const defaultUnit = course.syllabus?.[0]?.learningUnits?.[0];
    const unitToRender = activeUnit || defaultUnit;

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
            {showLoader && (
                <TicTacToeLoader
                    isLoading={isGenerating}
                    onContinue={() => setShowLoader(false)}
                />
            )}

            {/* Preview Modal */}
            {previewUnit && (
                <UnitPreviewModal
                    unit={previewUnit}
                    onClose={() => setPreviewUnit(null)}
                />
            )}

            {/* Main Content Area */}
            {unitToRender ? (
                <UnitEditor
                    unit={unitToRender}
                    gradeLevel={displayGrade}
                    subject={course.subject}
                    onSave={handleSaveUnit}
                    onCancel={() => setShowWizard(true)} // "Back" opens Settings
                    onPreview={() => setPreviewUnit(unitToRender)}
                    cancelLabel="הגדרות" // RENAME BACK BUTTON
                />
            ) : (
                // Empty State (Only if no units exist) - Minimal loading
                <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-center px-4">
                    <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-400 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-600 font-medium text-lg">טוען את הפעילות...</p>
                    <p className="text-gray-400 text-sm mt-2 max-w-md">הנתונים מתעדכנים מהענן. אם זה לוקח זמן רב, נסה לרענן.</p>
                    <button onClick={() => window.location.reload()} className="mt-6 text-indigo-600 hover:text-indigo-800 text-sm font-bold underline">
                        רענן עמוד
                    </button>
                    {/* Debug Info (Hidden in Prod) */}
                    <div className="hidden mt-4 text-xs text-left text-gray-300 font-mono">
                        ID: {course?.id}<br />
                        Syllabus: {course?.syllabus?.length || 0}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseEditor;