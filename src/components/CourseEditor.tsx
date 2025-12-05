import React, { useState, useEffect } from 'react';
import { useCourseStore } from '../context/CourseContext';
import UnitEditor from './UnitEditor';
import IngestionWizard from './IngestionWizard';
import { generateCoursePlan, generateFullUnitContent, generateChatbotPersonas } from '../gemini';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { LearningUnit, ActivityBlock } from '../courseTypes';
import {
    IconEdit, IconPlus, IconSparkles, IconTrash,
    IconArrowBack, IconBook, IconWand, IconList, IconX, IconCheck
} from '../icons';

// --- הגדרות מקומיות לאייקונים חסרים (למניעת קריסה) ---
const IconEye = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IconRobot = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="12" x="3" y="6" rx="2" /><circle cx="9" cy="10" r="1" /><circle cx="15" cy="10" r="1" /><path d="M12 2v4" /><path d="M12 14v4" /></svg>
);
const IconChat = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
);

// --- קומפוננטת הגדרות הבוט (פנימית לקובץ זה) ---
interface ChatbotConfigProps {
    unitContent: string;
    unitTitle: string;
    onSaveConfig: (config: any) => void;
    currentConfig?: any;
}

const ChatbotConfigPanel: React.FC<ChatbotConfigProps> = ({ unitContent, unitTitle, onSaveConfig, currentConfig }) => {
    const [scope, setScope] = useState(currentConfig?.scope || 'strict');
    const [selectedPersonaId, setSelectedPersonaId] = useState(currentConfig?.persona?.id || 'tutor');
    const [personas, setPersonas] = useState<any[]>(currentConfig?.availablePersonas || []);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (personas.length === 0 && unitContent) {
            setLoading(true);
            generateChatbotPersonas(unitContent, unitTitle).then(generatedPersonas => {
                setPersonas(generatedPersonas);
                setLoading(false);
            });
        }
    }, [unitContent]);

    useEffect(() => {
        const selectedPersona = personas.find(p => p.id === selectedPersonaId);
        if (selectedPersona) {
            onSaveConfig({
                scope,
                persona: selectedPersona,
                availablePersonas: personas
            });
        }
    }, [scope, selectedPersonaId, personas]);

    return (
        <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mt-6 animate-fade-in">
            <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-4">
                <IconRobot className="w-5 h-5" /> הגדרות הצ'אט-בוט של היחידה
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">מה גבולות הידע של הבוט?</label>
                    <div className="space-y-3">
                        {[
                            { id: 'strict', label: 'ממוקד ליחידה בלבד', desc: 'ענה אך ורק על בסיס הטקסט של יחידת הלימוד הזו.' },
                            { id: 'broad', label: 'חינוכי רחב', desc: 'ענה על שאלות בתחום הדעת הכללי, גם אם אינן בטקסט.' },
                            { id: 'exam', label: 'בוחן קפדן', desc: 'אל תענה לשאלות, אלא רק תבחן את התלמיד על החומר.' }
                        ].map(opt => (
                            <div
                                key={opt.id}
                                onClick={() => setScope(opt.id)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${scope === opt.id ? 'bg-white border-indigo-500 shadow-sm ring-1 ring-indigo-500' : 'bg-white/50 border-gray-200 hover:border-indigo-300'}`}
                            >
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${scope === opt.id ? 'border-indigo-600' : 'border-gray-300'}`}>
                                    {scope === opt.id && <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800 text-sm">{opt.label}</div>
                                    <div className="text-xs text-gray-500">{opt.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">מי הדמות שתשוחח עם התלמיד?</label>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500 text-sm flex flex-col items-center">
                            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mb-2"></div>
                            ה-AI בונה אישיויות מותאמות לתוכן...
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {personas.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedPersonaId(p.id)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${selectedPersonaId === p.id ? 'bg-white border-purple-500 shadow-sm ring-1 ring-purple-500' : 'bg-white/50 border-gray-200 hover:border-purple-300'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${selectedPersonaId === p.id ? 'border-purple-600' : 'border-gray-300'}`}>
                                        {selectedPersonaId === p.id && <div className="w-3 h-3 bg-purple-600 rounded-full"></div>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                            {p.name}
                                            {p.id === 'role' && <IconSparkles className="w-3 h-3 text-yellow-500" />}
                                        </div>
                                        <div className="text-xs text-gray-500">{p.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- לוגיקה ראשית ---

const getUnitLabel = (type: string) => {
    switch (type) {
        case 'acquisition': return 'יחידת לימוד';
        case 'practice': return 'יחידת תרגול';
        case 'test': return 'מבחן';
        case 'remedial': return 'יחידת חיזוק';
        case 'chatbot': return 'צ\'אט בוט';
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
                    {unit.metadata?.chatbotConfig ? (
                        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 text-center">
                            <IconRobot className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                            <h4 className="font-bold text-lg text-indigo-900">הבוט מוכן לשיחה</h4>
                            <p className="text-sm text-indigo-700 mt-2">
                                <strong>פרסונה:</strong> {unit.metadata.chatbotConfig.persona?.name}<br />
                                <strong>היקף:</strong> {unit.metadata.chatbotConfig.scope === 'strict' ? 'ממוקד יחידה' : 'רחב'}
                            </p>
                            <button className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-sm">התחל שיחה (הדגמה)</button>
                        </div>
                    ) : (
                        unit.activityBlocks?.map(block => (
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
                        ))
                    )}
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

    useEffect(() => {
        if (course && (!course.syllabus || course.syllabus.length === 0)) {
            setShowWizard(true);
        } else {
            setShowWizard(false);
        }
    }, [course?.id]);

    if (!course) return <div className="flex items-center justify-center h-screen text-gray-500">נא לבחור שיעור...</div>;

    const handleWizardComplete = async (data: any) => {
        setShowWizard(false);
        setIsGenerating(true);

        try {
            const topicToUse = data.topic || course.title || "General Topic";
            const syllabus = await generateCoursePlan(topicToUse, data.mode);

            const updatedCourse = {
                ...course,
                syllabus,
                mode: data.settings?.courseMode || 'learning'
            };

            setCourse(updatedCourse);
            await updateDoc(doc(db, "courses", course.id), {
                syllabus,
                mode: data.settings?.courseMode || 'learning'
            });

            if (syllabus.length > 0 && syllabus[0].learningUnits.length > 0) {
                const firstUnit = syllabus[0].learningUnits[0];
                generateFullUnitContent(firstUnit.title, topicToUse).then((newBlocks: ActivityBlock[]) => {
                    const syllabusWithContent = syllabus.map((mod: any) => ({
                        ...mod,
                        learningUnits: mod.learningUnits.map((u: any) =>
                            u.id === firstUnit.id ? { ...u, activityBlocks: newBlocks } : u
                        )
                    }));
                    setCourse({ ...updatedCourse, syllabus: syllabusWithContent });
                    updateDoc(doc(db, "courses", course.id), { syllabus: syllabusWithContent });
                });
            }

        } catch (error) {
            console.error("Failed to generate course:", error);
            alert("הייתה בעיה ביצירת השיעור. נסה שוב.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveUnit = async (updatedUnit: LearningUnit) => {
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
            generateFullUnitContent(nextUnitToGenerate.title, course.title).then((newBlocks: ActivityBlock[]) => {
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
        catch (e) { console.error("Save error:", e); alert("שגיאה בשמירה"); }
        finally {
            setIsSaving(false);
        }
    };

    // שמירת הגדרות הבוט
    const handleSaveChatbotConfig = async (unitId: string, config: any) => {
        const newSyllabus = course.syllabus.map(mod => ({
            ...mod,
            learningUnits: mod.learningUnits.map(u =>
                u.id === unitId
                    ? { ...u, metadata: { ...u.metadata, chatbotConfig: config } }
                    : u
            )
        }));

        const updatedCourse = { ...course, syllabus: newSyllabus };
        setCourse(updatedCourse);
        await updateDoc(doc(db, "courses", course.id), { syllabus: newSyllabus });
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
            <div className="space-y-6">
                <UnitEditor
                    unit={activeUnit}
                    onSave={handleSaveUnit}
                    onCancel={handleExitEditor}
                    cancelLabel="חזרה לסילבוס"
                />

                {/* הצגת פאנל הבוט */}
                <div className="max-w-4xl mx-auto pb-20">
                    <ChatbotConfigPanel
                        unitContent={activeUnit.activityBlocks?.map(b => b.content).join('\n') || ""}
                        unitTitle={activeUnit.title}
                        onSaveConfig={(config) => handleSaveChatbotConfig(activeUnit.id, config)}
                        currentConfig={activeUnit.metadata?.chatbotConfig}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans pb-24">

            {showWizard && (
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
                    <h2 className="text-2xl font-bold text-gray-800 mt-6">ה-AI בונה את השיעור שלך...</h2>
                    <p className="text-gray-500 mt-2">כותב סילבוס, מכין מערכים ומייצר שאלות.</p>
                </div>
            )}

            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900 flex items-center gap-3">
                            <span className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><IconEdit className="w-8 h-8" /></span>
                            עורך השיעור: <span className="text-indigo-600">{course.title}</span>
                        </h1>
                        <p className="text-gray-500 mt-2 text-lg">נהל את הפרקים, היחידות והתוכן של השיעור</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowWizard(true)} className="bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold shadow-sm hover:shadow transition-all flex items-center gap-2">
                            <IconWand className="w-5 h-5" /> הגדרות
                        </button>
                    </div>
                </div>

                <div className="space-y-8">
                    {course.syllabus?.length === 0 && !isGenerating && (
                        <div className="text-center py-20 bg-white/60 glass rounded-3xl border border-dashed border-gray-300">
                            <IconRobot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-600">השיעור ריק</h3>
                            <button onClick={() => setShowWizard(true)} className="mt-4 text-indigo-600 font-bold hover:underline">לחץ כאן להפעלת אשף היצירה האוטומטי</button>
                        </div>
                    )}
                    {course.syllabus?.map((module, mIndex) => (
                        <div key={module.id} className="glass bg-white/80 rounded-2xl border border-white/60 shadow-sm overflow-hidden animate-slide-up" style={{ animationDelay: `${mIndex * 100}ms` }}>
                            <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex justify-between items-center backdrop-blur-sm">
                                <h3 className="text-xl font-bold text-indigo-900 flex items-center gap-2"><span className="bg-indigo-200 text-indigo-700 w-8 h-8 flex items-center justify-center rounded-lg text-sm">{mIndex + 1}</span>{module.title}</h3>
                                <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">פרק לימוד</div>
                            </div>
                            <div className="p-4 space-y-3">
                                {module.learningUnits.map((unit) => (
                                    <div key={unit.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${unit.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                {/* שינוי אייקון בהתאם לסוג */}
                                                {unit.metadata?.chatbotConfig ? <IconChat className="w-5 h-5" /> : (unit.type === 'test' ? <IconList className="w-5 h-5" /> : <IconBook className="w-5 h-5" />)}
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
                                                    {unit.metadata?.chatbotConfig && (
                                                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded border border-indigo-200">
                                                            בוט מוגדר: {unit.metadata.chatbotConfig.persona?.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 transition-opacity">
                                            <button onClick={() => setPreviewUnit(unit)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="תצוגה מקדימה"><IconEye className="w-5 h-5" /></button>
                                            <button onClick={() => setSelectedUnitId(unit.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-indigo-700 transition-colors flex items-center gap-2"><IconEdit className="w-4 h-4" /> ערוך</button>
                                            <button onClick={() => handleDeleteUnit(unit.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><IconTrash className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                ))}
                                <button className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"><IconPlus className="w-5 h-5" /> הוסף יחידת לימוד ידנית</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CourseEditor;