import React, { useState } from 'react';
import type { Course, Module, LearningUnit } from '../shared/types/courseTypes';
import { v4 as uuidv4 } from 'uuid';
import {
    IconPlus, IconEdit, IconTrash, IconArrowUp, IconArrowDown,
    IconRobot, IconEye, IconPrinter, IconShare, IconPlayerPlay, IconBook,
    IconClock, IconChat, IconJoystick, IconFlag, IconSparkles
} from '../icons';
// import { useCourseStore } from '../context/CourseContext'; // Remove unused import if not needed
import { ShareModal } from './ShareModal';
import TeacherCockpit from './TeacherCockpit'; // Import Cockpit

interface LessonPlanOverviewProps {
    course: Course;
    onUpdateCourse: (updatedCourse: Course) => void;
    onSelectUnit: (unitId: string) => void;
    onUnitUpdate?: (unit: LearningUnit) => void;
    onGenerateWithAI?: (type: 'unit' | 'module', id: string, instruction?: string) => void;
}

export const LessonPlanOverview: React.FC<LessonPlanOverviewProps> = ({
    course,
    onUpdateCourse,
    onSelectUnit,
    onUnitUpdate,
    onGenerateWithAI
}) => {
    // Local state for inline accordion expansion
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

    const toggleUnitExpansion = (unitId: string) => {
        const newSet = new Set(expandedUnits);
        if (newSet.has(unitId)) {
            newSet.delete(unitId);
        } else {
            newSet.add(unitId);
        }
        setExpandedUnits(newSet);
    };

    const handleBlockUpdateInUnit = (unit: LearningUnit, blockId: string, newContent: any) => {
        if (!onUnitUpdate) return;

        const updatedBlocks = unit.activityBlocks?.map(b =>
            b.id === blockId ? { ...b, content: newContent } : b
        ) || [];

        const updatedUnit = { ...unit, activityBlocks: updatedBlocks };
        onUnitUpdate(updatedUnit);
    };

    // --- Actions ---

    const handleAddModule = () => {
        const newModule: Module = {
            id: uuidv4(),
            title: `New Phase ${course.syllabus.length + 1}`,
            learningUnits: []
        };
        const updatedCourse = { ...course, syllabus: [...course.syllabus, newModule] };
        onUpdateCourse(updatedCourse);
    };

    const handleDeleteModule = (moduleId: string) => {
        if (!confirm('Are you sure you want to delete this phase and all its units?')) return;
        const updatedSyllabus = course.syllabus.filter(m => m.id !== moduleId);
        onUpdateCourse({ ...course, syllabus: updatedSyllabus });
    };

    const handleMoveModule = (index: number, direction: 'up' | 'down') => {
        const newSyllabus = [...course.syllabus];
        if (direction === 'up' && index > 0) {
            [newSyllabus[index - 1], newSyllabus[index]] = [newSyllabus[index], newSyllabus[index - 1]];
        } else if (direction === 'down' && index < newSyllabus.length - 1) {
            [newSyllabus[index + 1], newSyllabus[index]] = [newSyllabus[index], newSyllabus[index + 1]];
        }
        onUpdateCourse({ ...course, syllabus: newSyllabus });
    };

    const handleAddUnit = (moduleId: string) => {
        const newUnit: LearningUnit = {
            id: uuidv4(),
            title: 'New Activity',
            type: 'practice',
            baseContent: '',
            activityBlocks: []
        };

        const updatedSyllabus = course.syllabus.map(m => {
            if (m.id === moduleId) {
                return { ...m, learningUnits: [...m.learningUnits, newUnit] };
            }
            return m;
        });

        onUpdateCourse({ ...course, syllabus: updatedSyllabus });
    };

    const handleDeleteUnit = (moduleId: string, unitId: string) => {
        if (!confirm('Delete this activity?')) return;
        const updatedSyllabus = course.syllabus.map(m => {
            if (m.id === moduleId) {
                return { ...m, learningUnits: m.learningUnits.filter(u => u.id !== unitId) };
            }
            return m;
        });
        onUpdateCourse({ ...course, syllabus: updatedSyllabus });
    };

    const handleMoveUnit = (moduleId: string, unitIndex: number, direction: 'up' | 'down') => {
        const updatedSyllabus = course.syllabus.map(m => {
            if (m.id === moduleId) {
                const newUnits = [...m.learningUnits];
                if (direction === 'up' && unitIndex > 0) {
                    [newUnits[unitIndex - 1], newUnits[unitIndex]] = [newUnits[unitIndex], newUnits[unitIndex - 1]];
                } else if (direction === 'down' && unitIndex < newUnits.length - 1) {
                    [newUnits[unitIndex + 1], newUnits[unitIndex]] = [newUnits[unitIndex], newUnits[unitIndex + 1]];
                }
                return { ...m, learningUnits: newUnits };
            }
            return m;
        });
        onUpdateCourse({ ...course, syllabus: updatedSyllabus });
    };

    const [shareOptions, setShareOptions] = useState<{
        courseTitle: string;
        courseId: string;
        unitId?: string;
        unitTitle?: string;
        initialTab?: 'link' | 'classroom' | 'collab';
    } | null>(null);

    // --- Toolbar Actions ---
    const handlePrint = () => {
        window.print();
    };

    const handleShare = (unitId?: string, unitTitle?: string, initialTab: 'link' | 'classroom' | 'collab' = 'link') => {
        setShareOptions({
            courseTitle: course.title,
            courseId: course.id,
            unitId,
            unitTitle,
            initialTab
        });
    };

    const handlePreview = () => {
        // This functionality needs to be wired up to a Student View (CoursePlayer)
        alert('Opening Student Preview...');
        // In a real implementation, this would trigger a modal or navigation to a preview route.
    };



    // --- Teacher Cockpit Helpers ---
    const getPhaseIcon = (index: number, total: number) => {
        // Specific mapping based on User Spec
        // Phase 1: Opening (Clock)
        // Phase 2: Teaching (Speech)
        // Phase 3: Practice (Joystick)
        // Phase 4: Summary (Flag)

        // If we have more or fewer, we adapt best effort
        if (index === 0) return <IconClock className="w-6 h-6 text-indigo-600" />;
        if (index === total - 1) return <IconFlag className="w-6 h-6 text-red-600" />;

        // Middle items
        if (index === 1) return <IconChat className="w-6 h-6 text-blue-600" />;
        return <IconJoystick className="w-6 h-6 text-purple-600" />;
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto custom-scrollbar print:p-0 print:overflow-visible" dir="rtl">
            {/* Header */}
            <header className="mb-8 print:mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 print:text-black">
                            {course.title || "מערך שיעור ללא שם"}
                        </h1>
                        <div className="flex gap-4 mt-2 text-gray-500 font-medium print:text-sm">
                            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm print:border print:border-gray-300">
                                {course.gradeLevel || "גיל לא הוגדר"}
                            </span>
                            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm print:border print:border-gray-300">
                                {course.subject || "כללי"}
                            </span>
                            {(course.mode === 'lesson' || course.wizardData?.settings?.productType === 'lesson') && <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm print:hidden">מערך שיעור</span>}
                        </div>
                    </div>

                    {/* Toolbar Actions */}
                    <div className="flex items-center gap-3 print:hidden">
                        <button
                            onClick={handlePreview}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors tooltip"
                            title="תצוגת תלמיד דמו"
                        >
                            <IconEye className="w-[22px] h-[22px]" />
                        </button>
                        <button
                            onClick={handlePrint}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors tooltip"
                            title="הדפסת מערך"
                        >
                            <IconPrinter className="w-[22px] h-[22px]" />
                        </button>
                        <button
                            onClick={() => handleShare(undefined, undefined, 'collab')}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors tooltip"
                            title="שתף עם עמית"
                        >
                            <IconShare className="w-[22px] h-[22px]" />
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        {/* Course Level AI Actions */}
                        <button
                            onClick={() => onGenerateWithAI?.('module', 'course', 'Expand entire syllabus')}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                            <IconRobot className="w-5 h-5" />
                            <span>סייע AI</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Timeline / Modules */}
            <div className="space-y-6 relative print:space-y-4">
                {/* Vertical Line for Timeline Effect (Hidden in Print) */}
                <div className="absolute right-6 top-4 bottom-4 w-0.5 bg-gray-200 -z-10 print:hidden" />

                {course.syllabus.map((module, mIndex) => (
                    <div key={module.id} className="relative pr-4 md:pr-14 group print:pr-0">
                        {/* Timeline Icon (Replaces Dot) */}
                        <div className="absolute right-3 top-6 w-10 h-10 rounded-full bg-white border-2 border-indigo-100 z-10 shadow-sm flex items-center justify-center print:hidden">
                            {getPhaseIcon(mIndex, course.syllabus.length)}
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 relative overflow-hidden print:shadow-none print:border-gray-300 print:break-inside-avoid">
                            {/* Glassmorphism Background Accent (Hidden in Print) */}
                            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-transparent opacity-50 rounded-br-full -z-0 pointer-events-none print:hidden" />

                            {/* Module Header */}
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {module.title}
                                    </h2>
                                    <button className="text-gray-400 hover:text-blue-600 transition-colors print:hidden">
                                        <IconEdit className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 print:hidden">
                                    {onGenerateWithAI && (
                                        <button
                                            onClick={() => onGenerateWithAI('module', module.id)}
                                            className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"
                                            title="ערוך שלב עם AI"
                                        >
                                            <IconRobot className="w-3.5 h-3.5" /> AI עריכה
                                        </button>
                                    )}
                                    <div className="h-4 w-px bg-gray-300 mx-1" />
                                    <button onClick={() => handleMoveModule(mIndex, 'up')} disabled={mIndex === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                        <IconArrowUp className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleMoveModule(mIndex, 'down')} disabled={mIndex === course.syllabus.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                        <IconArrowDown className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteModule(module.id)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-2">
                                        <IconTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Units List */}
                            <div className="space-y-3 relative z-10">
                                {module.learningUnits.length === 0 ? (
                                    <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl print:hidden">
                                        <p className="text-gray-400 text-sm mb-2">אין פעילויות בשלב זה עדיין.</p>
                                        <button
                                            onClick={() => handleAddUnit(module.id)}
                                            className="text-blue-600 text-sm hover:underline font-medium"
                                        >
                                            + הוסף פעילות
                                        </button>
                                    </div>
                                ) : (
                                    module.learningUnits.map((unit, uIndex) => {
                                        // DEBUG LOG
                                        console.log(`[LPO Render] Unit: ${unit.title} (${unit.id}) | Status: ${unit.metadata?.status} | Blocks: ${unit.activityBlocks?.length}`);

                                        const isBuilding = unit.metadata?.status === 'generating' || unit.metadata?.status === 'pending' || (unit.activityBlocks?.length === 0 && unit.baseContent === "PENDING_GENERATION");

                                        if (isBuilding) {
                                            return (
                                                <div key={unit.id} className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-50/50 to-transparent w-full animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                                                    <div className="flex items-center gap-4 relative z-10">
                                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400">
                                                            <IconSparkles className="w-5 h-5 animate-pulse" />
                                                        </div>
                                                        <div className="flex-1 space-y-2">
                                                            <div className="h-5 bg-slate-100 rounded-md w-1/3 animate-pulse"></div>
                                                            <div className="h-3 bg-slate-50 rounded-md w-1/4 animate-pulse"></div>
                                                        </div>
                                                        <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full animate-pulse">
                                                            {unit.title || "בונה יחידה..."}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const isExpanded = expandedUnits.has(unit.id);

                                        return (
                                            <div
                                                key={unit.id}
                                                className={`flex flex-col bg-gray-50 rounded-xl border transition-all group/unit
                                                    ${isExpanded ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-50' : 'border-gray-100 hover:border-indigo-200 hover:bg-white'}
                                                `}
                                            >
                                                {/* Unit Header (Click to Expand) */}
                                                <div
                                                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 cursor-pointer"
                                                    onClick={() => toggleUnitExpansion(unit.id)}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`
                                                            w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                                                            ${unit.type === 'test' ? 'bg-red-100 text-red-600' :
                                                                unit.type === 'acquisition' ? 'bg-green-100 text-green-600' :
                                                                    isExpanded ? 'bg-indigo-600 text-white' : 'bg-blue-100 text-blue-600'}
                                                        `}>
                                                            {unit.type === 'test' ? <IconBook className="w-5 h-5" /> : <IconPlayerPlay className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <h3 className={`font-semibold ${isExpanded ? 'text-indigo-900' : 'text-gray-800'}`}>{unit.title}</h3>
                                                            <p className="text-xs text-gray-500 capitalize flex items-center gap-2">
                                                                <span>{unit.activityBlocks?.length || 0} רכיבים</span>
                                                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                <span>{unit.type === 'practice' ? 'תרגול' : unit.type === 'test' ? 'מבחן' : 'למידה'}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end print:hidden">
                                                        {onGenerateWithAI && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onGenerateWithAI('unit', unit.id); }}
                                                                className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors tooltip"
                                                                title="שפר עם AI"
                                                            >
                                                                <IconRobot className="w-[18px] h-[18px]" />
                                                            </button>
                                                        )}

                                                        <div className="flex items-center gap-1 mx-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveUnit(module.id, uIndex, 'up'); }}
                                                                disabled={uIndex === 0}
                                                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30"
                                                            >
                                                                <IconArrowUp className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveUnit(module.id, uIndex, 'down'); }}
                                                                disabled={uIndex === module.learningUnits.length - 1}
                                                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30"
                                                            >
                                                                <IconArrowDown className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteUnit(module.id, unit.id); }}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="מחק יחידה"
                                                        >
                                                            <IconTrash className="w-[18px] h-[18px]" />
                                                        </button>

                                                        <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                            <IconArrowDown className="w-5 h-5 text-gray-400" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Inline Editor (Accordion Body) */}
                                                {isExpanded && (
                                                    <div className="border-t border-indigo-100" onClick={(e) => e.stopPropagation()}>
                                                        <TeacherCockpit
                                                            unit={unit}
                                                            embedded={true}
                                                            onUpdateBlock={(blockId, content) => handleBlockUpdateInUnit(unit, blockId, content)}
                                                        // onEdit removed to prevent redundant "Advanced Settings" button
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Add Unit Bottom Action */}
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center print:hidden">
                                <button
                                    onClick={() => handleAddUnit(module.id)}
                                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors px-4 py-1 rounded-full hover:bg-indigo-50"
                                >
                                    <IconPlus className="w-3.5 h-3.5" /> הוסף פעילות לשלב
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Phase Main Button */}
                <div className="pr-4 md:pr-14 print:hidden">
                    <button
                        onClick={handleAddModule}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                    >
                        <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                            <IconPlus className="w-[18px] h-[18px]" />
                        </div>
                        <span className="font-semibold">הוסף שלב חדש</span>
                    </button>
                </div>
            </div>

            <div className="h-20" /> {/* Bottom spacer */}

            <ShareModal
                isOpen={shareOptions !== null}
                onClose={() => setShareOptions(null)}
                courseId={course.id}
                courseTitle={course.title}
                unitId={shareOptions?.unitId}
                unitTitle={shareOptions?.unitTitle}
                initialTab={shareOptions?.initialTab}
            />
        </div>
    );
};
