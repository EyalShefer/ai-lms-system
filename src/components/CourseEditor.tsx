import React, { useState, useEffect, useRef } from 'react';
import { useCourseStore } from '../context/CourseContext';
import UnitEditor from './UnitEditor';
import IngestionWizard from './IngestionWizard';
import { generateCoursePlan, generateFullUnitContent } from '../gemini';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { LearningUnit, ActivityBlock } from '../courseTypes';
import {
    IconEdit, IconSparkles, IconTrash,
    IconArrowBack, IconBook, IconRobot, IconWand, IconList, IconX
} from '../icons';

const IconEyeLocal = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);

const getUnitLabel = (type: string) => {
    switch (type) {
        case 'acquisition': return 'יחידת לימוד';
        case 'practice': return 'יחידת תרגול';
        case 'test': return 'מבחן';
        case 'remedial': return 'יחידת חיזוק';
        default: return 'כללי';
    }
};

const UnitPreviewModal: React.FC<{ unit: LearningUnit; onClose: () => void }> = ({ unit, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-800">{unit.title} <span className="text-sm font-normal text-gray-500">(תצוגה מקדימה)</span></h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><IconX className="w-5 h-5" /></button>
                </div>
                <div className="p-6 overflow-y-auto bg-gray-50/50 space-y-6">
                    {unit.activityBlocks?.length === 0 && <div className="text-center text-gray-400 py-10">אין תוכן להצגה</div>}
                    {unit.activityBlocks?.map(block => (
                        <div key={block.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            {block.type === 'text' && <div className="prose max-w-none text-right whitespace-pre-wrap">{block.content}</div>}
                            {block.type === 'image' && <img src={block.content} alt="" className="w-full h-auto rounded-lg" />}
                            {block.type === 'video' && <div className="aspect-video bg-black rounded-lg"></div>}
                            {(block.type === 'multiple-choice' || block.type === 'open-question') && (
                                <div>
                                    <h4 className="font-bold text-lg mb-2">{block.content.question}</h4>
                                    {block.type === 'multiple-choice' && (
                                        <div className="space-y-2">
                                            {block.content.options?.map((opt: string, i: number) => (
                                                <div key={i} className="p-2 border border-gray-200 rounded bg-gray-50">{opt}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const CourseEditor: React.FC = () => {
    const { course, loadCourse, setCourse } = useCourseStore();
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [previewUnit, setPreviewUnit] = useState<LearningUnit | null>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // משתנה לעקיפת התצוגה
    const [forcedGrade, setForcedGrade] = useState<string>("");

    const wizardHasRun = useRef(false);
    const hasAutoSelected = useRef(false);

    // --- התיקון הקריטי למניעת 429 ולולאות ---
    useEffect(() => {
        // הגנה ראשונית: אם כבר רץ וויזארד או שיש תהליך יצירה, עוצרים
        if (wizardHasRun.current || isGenerating) return;

        // הגנה משנית: אם אין קורס כלל
        if (!course) return;

        // בדיקה האם הקורס מאוכלס בסילבוס
        const hasSyllabus = course.syllabus && course.syllabus.length > 0;

        // בדיקה האם זה קורס אמיתי (שיש לו כבר שם שנשמר ב-DB)
        // זה מונע מצב שבו הקורס נטען מחדש ופותח שוב את הוויזארד
        const isRealCourse = course.title && course.title !== "New Course" && course.title !== "קורס חדש";

        if (hasSyllabus && !showWizard && !hasAutoSelected.current) {
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
            // פותחים את הוויזארד רק אם זה קורס חדש לחלוטין (ללא שם וללא תוכן)
            if (!isRealCourse && !showWizard) {
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

            const updatedCourseState = {
                ...course,
                title: topicToUse,
                subject: userSubject,
                gradeLevel: extractedGrade,
                mode: data.settings?.courseMode || 'learning'
            };

            setCourse(updatedCourseState);

            await updateDoc(doc(db, "courses", course.id), {
                title: topicToUse,
                subject: userSubject,
                gradeLevel: extractedGrade,
                mode: updatedCourseState.mode
            });

            // יצירת סילבוס עם ה-subject
            const syllabus = await generateCoursePlan(topicToUse, extractedGrade, data.file, userSubject);

            const courseWithSyllabus = { ...updatedCourseState, syllabus };
            setCourse(courseWithSyllabus);
            await updateDoc(doc(db, "courses", course.id), { syllabus });

            if (syllabus.length > 0 && syllabus[0].learningUnits.length > 0) {
                const firstUnit = syllabus[0].learningUnits[0];

                // יצירת תוכן ראשוני עם ה-subject
                const newBlocks = await generateFullUnitContent(
                    firstUnit.title,
                    topicToUse,
                    extractedGrade,
                    data.file,
                    userSubject
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
        setIsSaving(true);
        try { await updateDoc(doc(db, "courses", course.id), { syllabus: newSyllabus }); }
        catch (e) { console.error("Save error:", e); }
        finally { setIsSaving(false); }
    };

    const handleExitEditor = () => {
        setSelectedUnitId(null);
    };

    const handleDeleteUnit = async (unitId: string) => {
        if (!window.confirm("למחוק את היחידה?")) return;
        const newSyllabus = course.syllabus.map(mod => ({
            ...mod,
            learningUnits: mod.learningUnits.filter(u => u.id !== unitId)
        }));
        const updatedCourse = { ...course, syllabus: newSyllabus };
        setCourse(updatedCourse);
        await updateDoc(doc(db, "courses", course.id), { syllabus: newSyllabus });
    };

    const activeUnit = course.syllabus?.flatMap(m => m.learningUnits).find(u => u.id === selectedUnitId);

    if (activeUnit) {
        return (
            <UnitEditor
                unit={activeUnit}
                gradeLevel={displayGrade}
                onSave={handleSaveUnit}
                onCancel={handleExitEditor}
                cancelLabel="חזרה"
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans pb-24">

            {showWizard && !isGenerating && (
                <IngestionWizard
                    onComplete={handleWizardComplete}
                    onCancel={() => setShowWizard(false)}
                    initialTopic={course.title}
                    title="הגדרות"
                    cancelLabel="חזרה להגדרות"
                    cancelIcon={<IconArrowBack className="w-6 h-6" />}
                />
            )}

            {previewUnit && (
                <UnitPreviewModal unit={previewUnit} onClose={() => setPreviewUnit(null)} />
            )}

            {isGenerating && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative">
                        <div className="w-24 h-24 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center"><IconSparkles className="w-8 h-8 text-indigo-600 animate-pulse" /></div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mt-6">ה-AI בונה את הפעילות שלך...</h2>
                    <p className="text-gray-500 mt-2">מתאים את התוכן ל{displayGrade}...</p>
                    <p className="text-gray-400 text-sm mt-1">במבט של: {course.subject || "כללי"}</p>
                </div>
            )}

            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900 flex items-center gap-3">
                            <span className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><IconEdit className="w-8 h-8" /></span>
                            עורך הפעילות: <span className="text-indigo-600">{course.title || "טוען..."}</span>
                        </h1>
                        <p className="text-gray-500 mt-2 text-lg">נהל את רכיבי הפעילות</p>

                        <div className="flex gap-2 mt-3">
                            {course.subject && <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100">{course.subject}</span>}
                            <span className="text-xs font-bold bg-purple-50 text-purple-600 px-2 py-1 rounded border border-purple-100">
                                {displayGrade}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowWizard(true)} className="bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center gap-2">
                            <IconWand className="w-5 h-5" /> ערוך הגדרות
                        </button>
                    </div>
                </div>

                <div className="space-y-8">
                    {course.syllabus?.length === 0 && !isGenerating && (
                        <div className="text-center py-20 bg-white/60 glass rounded-3xl border border-dashed border-gray-300">
                            <IconRobot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-600">הפעילות ריקה</h3>
                            <button onClick={() => setShowWizard(true)} className="mt-4 text-indigo-600 font-bold hover:underline">לחץ כאן להפעלת אשף היצירה</button>
                        </div>
                    )}
                    {course.syllabus?.map((module, mIndex) => (
                        <div key={module.id} className="glass bg-white/80 rounded-2xl border border-white/60 shadow-sm overflow-hidden animate-slide-up" style={{ animationDelay: `${mIndex * 100}ms` }}>
                            <div className="p-4 space-y-3">
                                {module.learningUnits.map((unit) => (
                                    <div key={unit.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${unit.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                {unit.type === 'test' ? <IconList className="w-5 h-5" /> : <IconBook className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-800">{unit.title}</h4>
                                                <div className="flex gap-2 mt-1">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded border ${unit.type === 'test' ? 'bg-red-50 text-red-600 border-red-100' :
                                                        unit.type === 'practice' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                            'bg-gray-100 text-gray-500 border-gray-200'
                                                        }`}>
                                                        {getUnitLabel(unit.type)}
                                                    </span>
                                                    {unit.activityBlocks?.length > 0 && (
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            • {unit.activityBlocks.length} רכיבים
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 transition-opacity">
                                            <button onClick={() => setPreviewUnit(unit)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="תצוגה מקדימה"><IconEyeLocal className="w-5 h-5" /></button>
                                            <button onClick={() => setSelectedUnitId(unit.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-indigo-700 transition-colors flex items-center gap-2"><IconEdit className="w-4 h-4" /> ערוך</button>
                                            <button onClick={() => handleDeleteUnit(unit.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><IconTrash className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CourseEditor;