import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Course, Module, LearningUnit } from '../shared/types/courseTypes';
import { v4 as uuidv4 } from 'uuid';
import {
    IconPlus, IconEdit, IconTrash, IconArrowUp, IconArrowDown,
    IconRobot, IconEye, IconShare, IconPlayerPlay, IconBook,
    IconClock, IconChat, IconJoystick, IconFlag, IconSparkles,
    IconArrowRight
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
    onBack?: () => void;
}

export const LessonPlanOverview: React.FC<LessonPlanOverviewProps> = ({
    course,
    onUpdateCourse,
    onSelectUnit,
    onUnitUpdate,
    onGenerateWithAI,
    onBack
}) => {
    const navigate = useNavigate();

    // Local state for inline accordion expansion
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

    // Presentation/View mode state
    const [viewingUnit, setViewingUnit] = useState<LearningUnit | null>(null);

    // State for differentiated unit tabs - tracks which level is selected for each group
    const [selectedDiffLevel, setSelectedDiffLevel] = useState<Record<string, 'הבנה' | 'יישום' | 'העמקה'>>({});

    // --- Differentiated Units Helpers ---
    const isDifferentiatedUnit = (unit: LearningUnit): boolean => {
        const title = unit.title || '';
        return title.includes('(הבנה)') || title.includes('(יישום)') || title.includes('(העמקה)');
    };

    const getUnitLevel = (unit: LearningUnit): 'הבנה' | 'יישום' | 'העמקה' | null => {
        const title = unit.title || '';
        if (title.includes('(הבנה)')) return 'הבנה';
        if (title.includes('(יישום)')) return 'יישום';
        if (title.includes('(העמקה)')) return 'העמקה';
        return null;
    };

    const getBaseTitle = (unit: LearningUnit): string => {
        return (unit.title || '').replace(/\s*\((הבנה|יישום|העמקה)\)\s*$/, '').trim();
    };

    // Group consecutive differentiated units with the same base title
    const groupDifferentiatedUnits = (units: LearningUnit[]): (LearningUnit | { type: 'diff-group'; baseTitle: string; units: LearningUnit[] })[] => {
        // DEBUG: Log all units to see if they have differentiated titles
        console.log('[groupDifferentiatedUnits] Input units:', units.map(u => ({ id: u.id, title: u.title, isDiff: isDifferentiatedUnit(u) })));

        const result: (LearningUnit | { type: 'diff-group'; baseTitle: string; units: LearningUnit[] })[] = [];
        let i = 0;

        while (i < units.length) {
            const unit = units[i];
            if (isDifferentiatedUnit(unit)) {
                const baseTitle = getBaseTitle(unit);
                const group: LearningUnit[] = [unit];

                // Look ahead for consecutive units with same base title
                while (i + 1 < units.length) {
                    const nextUnit = units[i + 1];
                    if (isDifferentiatedUnit(nextUnit) && getBaseTitle(nextUnit) === baseTitle) {
                        group.push(nextUnit);
                        i++;
                    } else {
                        break;
                    }
                }

                if (group.length > 1) {
                    // Sort by level order: הבנה, יישום, העמקה
                    const levelOrder = { 'הבנה': 0, 'יישום': 1, 'העמקה': 2 };
                    group.sort((a, b) => {
                        const levelA = getUnitLevel(a) || 'יישום';
                        const levelB = getUnitLevel(b) || 'יישום';
                        return levelOrder[levelA] - levelOrder[levelB];
                    });
                    console.log('[groupDifferentiatedUnits] Created diff-group:', { baseTitle, unitsCount: group.length });
                    result.push({ type: 'diff-group', baseTitle, units: group });
                } else {
                    console.log('[groupDifferentiatedUnits] Single diff unit, not grouping:', unit.title);
                    result.push(unit);
                }
            } else {
                result.push(unit);
            }
            i++;
        }

        return result;
    };

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
        initialTab?: 'link' | 'assign' | 'classroom' | 'collab';
    } | null>(null);

    // --- Toolbar Actions ---
    const handleShare = (unitId?: string, unitTitle?: string, initialTab: 'link' | 'assign' | 'classroom' | 'collab' = 'assign') => {
        setShareOptions({
            courseTitle: course.title,
            courseId: course.id,
            unitId,
            unitTitle,
            initialTab
        });
    };

    // Get all units in order for presentation mode
    const getAllUnitsInOrder = (): LearningUnit[] => {
        return course.syllabus.flatMap(module => module.learningUnits);
    };

    const handlePreview = (unit?: LearningUnit) => {
        // If specific unit passed, view that unit
        // Otherwise, view the first unit in presentation mode
        if (unit) {
            setViewingUnit(unit);
        } else {
            const allUnits = getAllUnitsInOrder();
            if (allUnits.length > 0) {
                setViewingUnit(allUnits[0]);
            }
        }
    };

    // Navigate to next/previous unit in presentation mode
    const handleNextUnit = () => {
        if (!viewingUnit) return;
        const allUnits = getAllUnitsInOrder();
        const currentIndex = allUnits.findIndex(u => u.id === viewingUnit.id);
        if (currentIndex < allUnits.length - 1) {
            setViewingUnit(allUnits[currentIndex + 1]);
        }
    };

    const handlePrevUnit = () => {
        if (!viewingUnit) return;
        const allUnits = getAllUnitsInOrder();
        const currentIndex = allUnits.findIndex(u => u.id === viewingUnit.id);
        if (currentIndex > 0) {
            setViewingUnit(allUnits[currentIndex - 1]);
        }
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
            <header className="sticky top-4 z-40 card-glass p-6 mb-8 print:mb-4 print:static print:shadow-none print:bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Back Button */}
                        <button
                            onClick={() => {
                                console.log('🔙 LessonPlanOverview back clicked, onBack:', typeof onBack);
                                if (onBack) {
                                    console.log('🔙 Calling onBack...');
                                    onBack();
                                } else {
                                    console.log('🔙 No onBack, reloading to home...');
                                    window.location.href = '/';
                                }
                            }}
                            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/80 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-600 transition-all shadow-sm print:hidden"
                            title="חזרה לדף הבית"
                        >
                            <IconArrowRight className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 print:text-black">
                                {course.title || "מערך שיעור ללא שם"}
                            </h1>
                            <div className="flex gap-4 mt-2 text-gray-500 font-medium print:text-sm">
                                <span className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-sm border border-white/40 shadow-sm print:border print:border-gray-300">
                                    {course.gradeLevel || "גיל לא הוגדר"}
                                </span>
                                <span className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-sm border border-white/40 shadow-sm print:border print:border-gray-300">
                                    {course.subject || "כללי"}
                                </span>
                                {(course.mode === 'lesson' || course.wizardData?.settings?.productType === 'lesson') && <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm print:hidden">מערך שיעור</span>}
                            </div>
                        </div>
                    </div>

                    {/* Toolbar Actions */}
                    <div className="flex items-center gap-3 print:hidden">
                        <button
                            onClick={() => handlePreview()}
                            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors shadow-sm border border-white/60 bg-white/50"
                            title="מצב הקרנה - תצוגת מערך השיעור למורה"
                        >
                            <IconEye className="w-[22px] h-[22px]" />
                            <span className="text-sm font-medium hidden md:inline">הקרנה</span>
                        </button>
                        <button
                            onClick={() => handleShare(undefined, undefined, 'collab')}
                            className="p-2 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors shadow-sm border border-white/60 bg-white/50"
                            title="שתף עם עמית"
                        >
                            <IconShare className="w-[22px] h-[22px]" />
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        {/* Course Level AI Actions */}
                        <button
                            onClick={() => onGenerateWithAI?.('module', 'course', 'Expand entire syllabus')}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-100 to-purple-100 text-purple-700 rounded-xl hover:from-violet-200 hover:to-purple-200 border border-purple-200 shadow-sm transition-colors"
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
                        <div className="absolute right-3 top-6 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm border-2 border-blue-200 z-10 shadow-md flex items-center justify-center print:hidden">
                            {getPhaseIcon(mIndex, course.syllabus.length)}
                        </div>

                        <div className="card-glass hover:shadow-lg transition-all p-6 relative overflow-hidden print:shadow-none print:border-gray-300 print:break-inside-avoid print:bg-white">
                            {/* Glassmorphism Background Accent (Hidden in Print) */}
                            <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-transparent opacity-50 rounded-br-full -z-0 pointer-events-none print:hidden" />

                            {/* Module Header */}
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {module.title}
                                    </h2>
                                    <button className="text-gray-400 hover:text-blue-600 transition-colors print:hidden p-1 hover:bg-blue-50 rounded shadow-sm border border-white/60 bg-white/50">
                                        <IconEdit className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 print:hidden">
                                    {onGenerateWithAI && (
                                        <button
                                            onClick={() => onGenerateWithAI('module', module.id)}
                                            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg hover:from-violet-100 hover:to-purple-100 border border-purple-100 shadow-sm"
                                            title="ערוך שלב עם AI"
                                        >
                                            <IconRobot className="w-3.5 h-3.5" /> AI עריכה
                                        </button>
                                    )}
                                    <div className="h-4 w-px bg-gray-300 mx-1" />
                                    <button onClick={() => handleMoveModule(mIndex, 'up')} disabled={mIndex === 0} className="p-1 hover:bg-blue-50 hover:text-blue-600 rounded disabled:opacity-30 bg-white/50 border border-white/60 shadow-sm">
                                        <IconArrowUp className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleMoveModule(mIndex, 'down')} disabled={mIndex === course.syllabus.length - 1} className="p-1 hover:bg-blue-50 hover:text-blue-600 rounded disabled:opacity-30 bg-white/50 border border-white/60 shadow-sm">
                                        <IconArrowDown className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteModule(module.id)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-2 bg-white/50 border border-white/60 shadow-sm">
                                        <IconTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Units List */}
                            <div className="space-y-3 relative z-10">
                                {module.learningUnits.length === 0 ? (
                                    <div className="text-center py-6 border-2 border-dashed border-blue-100 rounded-xl bg-blue-50/30 backdrop-blur-sm print:hidden">
                                        <p className="text-gray-400 text-sm mb-2">אין פעילויות בשלב זה עדיין.</p>
                                        <button
                                            onClick={() => handleAddUnit(module.id)}
                                            className="text-blue-600 text-sm hover:underline font-medium"
                                        >
                                            + הוסף פעילות
                                        </button>
                                    </div>
                                ) : (
                                    groupDifferentiatedUnits(module.learningUnits).map((item, itemIndex) => {
                                        // Handle differentiated group (3 levels with tabs)
                                        if ('type' in item && item.type === 'diff-group') {
                                            const groupKey = item.units[0].id;
                                            const currentLevel = selectedDiffLevel[groupKey] || 'יישום';
                                            const activeUnit = item.units.find(u => getUnitLevel(u) === currentLevel) || item.units[0];
                                            const isExpanded = expandedUnits.has(activeUnit.id);

                                            const levelConfig = {
                                                'הבנה': { bg: 'bg-emerald-600', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                                                'יישום': { bg: 'bg-blue-600', bgLight: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                                                'העמקה': { bg: 'bg-purple-600', bgLight: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
                                            };

                                            return (
                                                <div
                                                    key={groupKey}
                                                    className={`flex flex-col rounded-xl border transition-all group/unit overflow-hidden
                                                        ${isExpanded ? `card-glass ${levelConfig[currentLevel].border} shadow-lg ring-2 ring-opacity-50` : 'bg-white/60 border-white/60 backdrop-blur-sm hover:bg-white/80 shadow-sm'}
                                                    `}
                                                >
                                                    {/* Differentiated Level Tabs */}
                                                    <div className={`flex items-center justify-between px-4 py-2 ${levelConfig[currentLevel].bgLight} border-b ${levelConfig[currentLevel].border}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium text-gray-500">הוראה מותאמת:</span>
                                                            <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-lg shadow-sm">
                                                                {(['הבנה', 'יישום', 'העמקה'] as const).map(level => {
                                                                    const hasLevel = item.units.some(u => getUnitLevel(u) === level);
                                                                    if (!hasLevel) return null;
                                                                    return (
                                                                        <button
                                                                            key={level}
                                                                            onClick={() => setSelectedDiffLevel(prev => ({ ...prev, [groupKey]: level }))}
                                                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all
                                                                                ${currentLevel === level
                                                                                    ? `${levelConfig[level].bg} text-white shadow-sm`
                                                                                    : 'text-gray-500 hover:bg-gray-100'}`}
                                                                        >
                                                                            {level}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <span className={`text-xs font-medium ${levelConfig[currentLevel].text}`}>
                                                            {activeUnit.activityBlocks?.length || 0} רכיבים
                                                        </span>
                                                    </div>

                                                    {/* Unit Header (Click to Expand) */}
                                                    <div
                                                        className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 cursor-pointer"
                                                        onClick={() => toggleUnitExpansion(activeUnit.id)}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isExpanded ? levelConfig[currentLevel].bg + ' text-white' : levelConfig[currentLevel].bgLight + ' ' + levelConfig[currentLevel].text}`}>
                                                                <IconPlayerPlay className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h3 className={`font-semibold ${isExpanded ? 'text-gray-900' : 'text-gray-800'}`}>{item.baseTitle}</h3>
                                                                <p className="text-xs text-gray-500 flex items-center gap-2">
                                                                    <span>פעילות דיפרנציאלית</span>
                                                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                                    <span>{item.units.length} רמות</span>
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end print:hidden">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePreview(activeUnit); }}
                                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors bg-white/50 border border-white/60 shadow-sm"
                                                                title="תצוגת הקרנה"
                                                            >
                                                                <IconEye className="w-[18px] h-[18px]" />
                                                            </button>

                                                            <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                                <IconArrowDown className="w-5 h-5 text-gray-400" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Inline Editor (Accordion Body) */}
                                                    {isExpanded && (
                                                        <div className={`border-t ${levelConfig[currentLevel].border}`} onClick={(e) => e.stopPropagation()}>
                                                            <TeacherCockpit
                                                                unit={activeUnit}
                                                                courseId={course.id}
                                                                embedded={true}
                                                                onExit={() => toggleUnitExpansion(activeUnit.id)}
                                                                onUnitUpdate={onUnitUpdate}
                                                                onUpdateBlock={(blockId, content) => handleBlockUpdateInUnit(activeUnit, blockId, content)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // Regular unit (not differentiated)
                                        const unit = item as LearningUnit;
                                        const uIndex = module.learningUnits.findIndex(u => u.id === unit.id);

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
                                                className={`flex flex-col rounded-xl border transition-all group/unit
                                                    ${isExpanded ? 'card-glass border-blue-200 shadow-lg ring-2 ring-blue-50/50' : 'bg-white/60 border-white/60 backdrop-blur-sm hover:bg-white/80 hover:border-blue-200 shadow-sm'}
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
                                                        <div className="flex items-center gap-1 mx-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveUnit(module.id, uIndex, 'up'); }}
                                                                disabled={uIndex === 0}
                                                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 bg-white/50 border border-white/60 shadow-sm"
                                                            >
                                                                <IconArrowUp className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveUnit(module.id, uIndex, 'down'); }}
                                                                disabled={uIndex === module.learningUnits.length - 1}
                                                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 bg-white/50 border border-white/60 shadow-sm"
                                                            >
                                                                <IconArrowDown className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePreview(unit); }}
                                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors bg-white/50 border border-white/60 shadow-sm"
                                                            title="תצוגת הקרנה"
                                                        >
                                                            <IconEye className="w-[18px] h-[18px]" />
                                                        </button>

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteUnit(module.id, unit.id); }}
                                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors bg-white/50 border border-white/60 shadow-sm"
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
                                                    <div className="border-t border-blue-100" onClick={(e) => e.stopPropagation()}>
                                                        <TeacherCockpit
                                                            unit={unit}
                                                            courseId={course.id}
                                                            embedded={true}
                                                            onExit={() => toggleUnitExpansion(unit.id)}
                                                            onUnitUpdate={onUnitUpdate}
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
                            <div className="mt-4 pt-4 border-t border-blue-50 flex justify-center print:hidden">
                                <button
                                    onClick={() => handleAddUnit(module.id)}
                                    className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition-colors px-4 py-1.5 rounded-full hover:bg-blue-50 bg-white/50 border border-white/60 shadow-sm"
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
                        className="w-full py-4 border-2 border-dashed border-blue-200 rounded-2xl text-blue-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 backdrop-blur-sm bg-white/40 transition-all flex items-center justify-center gap-2 group"
                    >
                        <div className="w-8 h-8 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors shadow-sm">
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

            {/* Presentation/View Mode - TeacherCockpit Full Screen */}
            {viewingUnit && (
                <TeacherCockpit
                    unit={viewingUnit}
                    courseId={course.id}
                    embedded={false}
                    onExit={() => setViewingUnit(null)}
                    onUnitUpdate={(updatedUnit) => {
                        // Update the unit in the course
                        if (onUnitUpdate) {
                            onUnitUpdate(updatedUnit);
                        }
                        // Also update local state to reflect changes
                        setViewingUnit(updatedUnit);
                    }}
                />
            )}
        </div>
    );
};
