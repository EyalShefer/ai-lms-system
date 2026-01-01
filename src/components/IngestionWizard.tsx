import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    IconBrain, IconArrowBack, IconSparkles,
    IconCheck, IconX, IconBook, IconWand, IconCloudUpload, IconVideo,
    IconHeadphones, IconTarget, IconJoystick
} from '../icons';
import { MultimodalService } from '../services/multimodalService';

// --- רשימות מיושרות עם הדשבורד ---
const GRADES = [
    "כיתה א׳", "כיתה ב׳", "כיתה ג׳", "כיתה ד׳", "כיתה ה׳", "כיתה ו׳",
    "כיתה ז׳", "כיתה ח׳", "כיתה ט׳",
    "כיתה י׳", "כיתה י״א", "כיתה י״ב",
    "מכינה", "סטודנטים", "הכשרה מקצועית"
];

const SUBJECTS = [
    "חינוך לשוני (עברית)", "מתמטיקה", "אנגלית", "מדע וטכנולוגיה",
    "היסטוריה", "אזרחות", "תנ״ך", "ספרות", "גיאוגרפיה",
    "פיזיקה", "כימיה", "ביולוגיה", "מדעי המחשב", "הנדסת תוכנה", "רובוטיקה",
    "חינוך גופני", "חינוך פיננסי", "אמנות", "תקשורת", "פסיכולוגיה", "סוציולוגיה", "אחר"
];

type ProductType = 'lesson' | 'podcast' | 'exam' | 'game' | null;

const PRODUCT_CONFIG: Record<string, {
    titleLabel: string;
    lengthLabel: string;
    headerLabel: string;
    defaultTitleName: string;
    lengthOptions: { id: string; label: string }[];
}> = {
    lesson: {
        titleLabel: "כותרת השיעור",
        lengthLabel: "היקף השיעור",
        headerLabel: "יצירת מערך שיעור",
        defaultTitleName: "שיעור חדש",
        lengthOptions: [
            { id: 'short', label: 'קצר (ממוקד)' },
            { id: 'medium', label: 'בינוני (סטנדרטי)' },
            { id: 'long', label: 'ארוך (מקיף)' }
        ]
    },
    exam: {
        titleLabel: "כותרת המבחן",
        lengthLabel: "היקף המבחן",
        headerLabel: "יצירת מבחן",
        defaultTitleName: "מבחן חדש",
        lengthOptions: [
            { id: 'short', label: 'קצר' },
            { id: 'medium', label: 'בינוני' },
            { id: 'long', label: 'ארוך' }
        ]
    },
    game: {
        titleLabel: "כותרת המשחק",
        lengthLabel: "משך המשחק",
        headerLabel: "יצירת משחק",
        defaultTitleName: "משחק חדש",
        lengthOptions: [
            { id: 'short', label: 'קצר' },
            { id: 'medium', label: 'בינוני' },
            { id: 'long', label: 'ארוך' }
        ]
    },
    podcast: {
        titleLabel: "כותרת הפודקאסט",
        lengthLabel: "משך הפרק",
        headerLabel: "יצירת פודקאסט",
        defaultTitleName: "פודקאסט חדש",
        lengthOptions: [
            { id: 'short', label: 'קצר' },
            { id: 'medium', label: 'בינוני' },
            { id: 'long', label: 'ארוך' }
        ]
    }
};

const DEFAULT_CONFIG = {
    titleLabel: "כותרת הפעילות",
    lengthLabel: "אורך הפעילות",
    headerLabel: "יצירת פעילות חדשה",
    defaultTitleName: "פעילות חדשה",
    lengthOptions: [
        { id: 'short', label: 'קצרה' },
        { id: 'medium', label: 'בינונית' },
        { id: 'long', label: 'ארוכה' }
    ]
};

interface IngestionWizardProps {
    onComplete: (data: any) => void;
    onCancel: () => void;
    initialTopic?: string;
    initialMode?: 'learning' | 'exam';
    title?: string;
    cancelLabel?: string;
    cancelIcon?: React.ReactNode;
}

// --- UI Components ---
const StepIndicator = ({ num, label, isActive, isCompleted }: any) => (
    <div className={`flex flex-col items-center gap-2 relative z-10 ${isActive ? 'scale-110' : 'opacity-80'}`}>
        <div className={`
            w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300
            ${isActive ? 'bg-white text-wizdi-royal shadow-lg ring-4 ring-blue-500/20' :
                isCompleted ? 'bg-wizdi-lime text-wizdi-royal' : 'bg-blue-800/50 text-white border-2 border-blue-400/30'}
        `}>
            {isCompleted ? <IconCheck className="w-6 h-6" /> : num}
        </div>
        <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-blue-200'}`}>
            {label}
        </span>
    </div>
);

const StepLine = ({ isCompleted }: any) => (
    <div className={`
        h-1 flex-1 mx-2 rounded-full transition-all duration-500 relative top-[-14px]
        ${isCompleted ? 'bg-wizdi-lime' : 'bg-blue-800/30'}
    `} />
);

// --- Improved Styling Maps (to ensure Tailwind JIT picks them up) ---
const THEMES: Record<string, any> = {
    blue: {
        active: "border-blue-500 bg-blue-50 ring-blue-200",
        hover: "hover:border-blue-400",
        iconActive: "bg-blue-100 text-blue-600",
        iconHover: "group-hover:bg-blue-50 group-hover:text-blue-600",
        check: "text-blue-500"
    },
    green: {
        active: "border-green-500 bg-green-50 ring-green-200",
        hover: "hover:border-green-400",
        iconActive: "bg-green-100 text-green-600",
        iconHover: "group-hover:bg-green-50 group-hover:text-green-600",
        check: "text-green-500"
    },
    red: {
        active: "border-red-500 bg-red-50 ring-red-200",
        hover: "hover:border-red-400",
        iconActive: "bg-red-100 text-red-600",
        iconHover: "group-hover:bg-red-50 group-hover:text-red-600",
        check: "text-red-500"
    },
    purple: {
        active: "border-purple-500 bg-purple-50 ring-purple-200",
        hover: "hover:border-purple-400",
        iconActive: "bg-purple-100 text-purple-600",
        iconHover: "group-hover:bg-purple-50 group-hover:text-purple-600",
        check: "text-purple-500"
    },
    orange: {
        active: "border-orange-500 bg-orange-50 ring-orange-200",
        hover: "hover:border-orange-400",
        iconActive: "bg-orange-100 text-orange-600",
        iconHover: "group-hover:bg-orange-50 group-hover:text-orange-600",
        check: "text-orange-500"
    },
    indigo: {
        active: "border-indigo-500 bg-indigo-50 ring-indigo-200",
        hover: "hover:border-indigo-400",
        iconActive: "bg-indigo-100 text-indigo-600",
        iconHover: "group-hover:bg-indigo-50 group-hover:text-indigo-600",
        check: "text-indigo-500"
    },
    pink: {
        active: "border-pink-500 bg-pink-50 ring-pink-200",
        hover: "hover:border-pink-400",
        iconActive: "bg-pink-100 text-pink-600",
        iconHover: "group-hover:bg-pink-50 group-hover:text-pink-600",
        check: "text-pink-500"
    }
};

const SourceCard = ({ label, icon: Icon, color, isActive, onClick, innerRef, children, ...props }: any) => {
    const theme = THEMES[color] || THEMES['blue'];
    return (
        <div
            ref={innerRef}
            {...props}
            onClick={onClick}
            className={`
                group relative p-6 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden
                flex flex-col items-center text-center gap-4 h-full
                ${isActive
                    ? `${theme.active} shadow-md ring-1`
                    : `border-slate-200 bg-white ${theme.hover} hover:shadow-lg hover:-translate-y-1`
                }
            `}
        >
            <div className={`
                w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110
                ${isActive ? theme.iconActive : `bg-slate-50 text-slate-500 ${theme.iconHover}`}
            `}>
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <h4 className={`text-lg font-bold mb-1 ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{label}</h4>
                <div className="text-sm text-slate-500">{children}</div>
            </div>
            {isActive && <div className={`absolute top-3 right-3 ${theme.check}`}><IconCheck className="w-5 h-5" /></div>}
        </div>
    );
};

const ProductCard = ({ label, icon: Icon, color, desc, isActive, onClick }: any) => {
    // const theme = THEMES[color] || THEMES['blue'];
    return (
        <div
            onClick={onClick}
            className={`
                relative p-6 rounded-2xl border transition-all duration-200 cursor-pointer
                flex flex-col items-center text-center h-full
                ${isActive
                    ? 'border-wizdi-royal bg-blue-50/50 shadow-lg ring-2 ring-wizdi-royal'
                    : `border-slate-200 bg-white hover:border-blue-300 hover:shadow-md`
                }
            `}
        >
            <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform
                ${isActive ? `bg-white shadow-sm text-${color}-600` : `bg-${color}-50 text-${color}-600`}
            `}>
                <Icon className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">{label}</h4>
            <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>

            {isActive && (
                <div className="absolute top-4 right-4 bg-wizdi-royal text-white p-1 rounded-full shadow-sm animate-pop">
                    <IconCheck className="w-4 h-4" />
                </div>
            )}
        </div>
    );
};


const IngestionWizard: React.FC<IngestionWizardProps> = ({
    onComplete,
    onCancel,
    initialTopic,
    initialMode = 'learning',
    //  cancelLabel = "חזרה",
    //  cancelIcon = <IconArrowBack className="w-4 h-4 rotate-180" />
}) => {
    // --- State ---
    const [step, setStep] = useState(1); // 1: Source, 2: Product, 3: Settings
    const [isProcessing, setIsProcessing] = useState(false);

    // Step 1: Source
    const [mode, setMode] = useState<'upload' | 'topic' | 'text' | 'multimodal' | null>(null);
    const [topic, setTopic] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [pastedText, setPastedText] = useState('');
    // const [subMode, setSubMode] = useState<'youtube' | 'audio' | null>(null);

    // Step 2: Product
    const [selectedProduct, setSelectedProduct] = useState<ProductType>(null);

    // Step 3: Settings
    const [customTitle, setCustomTitle] = useState('');
    const [grade, setGrade] = useState(GRADES[6]);
    const [subject, setSubject] = useState('חינוך לשוני (עברית)');
    const [activityLength, setActivityLength] = useState<'short' | 'medium' | 'long'>('medium');
    const [taxonomy, setTaxonomy] = useState<{ knowledge: number; application: number; evaluation: number }>({ knowledge: 30, application: 50, evaluation: 20 });
    const [includeBot] = useState(false); // Restore includeBot state
    const [botPersona] = useState('socratic');
    const [courseMode, setCourseMode] = useState<'learning' | 'exam'>(initialMode);
    // const [showSourceToStudent, setShowSourceToStudent] = useState(true);

    const config = (selectedProduct && PRODUCT_CONFIG[selectedProduct]) || DEFAULT_CONFIG;

    // --- Effects ---
    useEffect(() => {
        if (initialTopic && initialTopic !== "טוען..." && initialTopic.trim() !== "") {
            setTopic(initialTopic);
            setCustomTitle(initialTopic);
            setMode('topic');
            // If topic is provided, maybe jump? For now, stay at step 1 or 2.
            // Let's create a flow: if topic exists, source is chosen, go to Product selection.
            setStep(2);
        }
    }, [initialTopic]);

    // Update course mode based on product selection
    useEffect(() => {
        if (selectedProduct === 'exam') {
            setCourseMode('exam');
            setTaxonomy({ knowledge: 20, application: 40, evaluation: 40 });
        } else if (selectedProduct === 'game') {
            setCourseMode('learning');
            setTaxonomy({ knowledge: 20, application: 70, evaluation: 10 });
        } else {
            setCourseMode('learning');
            setTaxonomy({ knowledge: 30, application: 50, evaluation: 20 });
        }
    }, [selectedProduct]);

    const handleTaxonomyChange = (changedKey: keyof typeof taxonomy, newValue: number) => {
        const remainingSpace = 100 - newValue;
        const otherKeys = Object.keys(taxonomy).filter(k => k !== changedKey) as (keyof typeof taxonomy)[];
        const keyA = otherKeys[0];
        const keyB = otherKeys[1];
        const currentOthersTotal = taxonomy[keyA] + taxonomy[keyB];
        let newA, newB;
        if (currentOthersTotal === 0) { newA = remainingSpace / 2; newB = remainingSpace / 2; }
        else { const ratio = taxonomy[keyA] / currentOthersTotal; newA = Math.round(remainingSpace * ratio); newB = remainingSpace - newA; }
        setTaxonomy({ ...taxonomy, [changedKey]: newValue, [keyA]: newA, [keyB]: newB });
    };

    const { getRootProps, getInputProps, open } = useDropzone({
        accept: {
            'application/pdf': ['.pdf'],
            'text/plain': ['.txt'],
            'audio/mpeg': ['.mp3', '.mpga'],
            'audio/wav': ['.wav'],
            'audio/m4a': ['.m4a']
        },
        maxFiles: 1,
        maxSize: 10485760,
        noClick: true, // Manual click handling
        noKeyboard: true, // Manual keyboard handling
        onDropRejected: (rejectedFiles) => {
            const error = rejectedFiles[0]?.errors[0];
            if (error?.code === 'file-too-large') {
                alert("הקובץ גדול מדי (מקסימום 10MB).");
            } else {
                alert("שגיאה בהעלאת הקובץ.");
            }
        },
        onDrop: async (acceptedFiles) => {
            const f = acceptedFiles[0];
            if (!f) return;

            if (f.type.startsWith('audio/')) {
                setIsProcessing(true);
            }

            try {
                if (f.type.startsWith('audio/')) {
                    setMode('multimodal');
                    // setSubMode('audio');

                    const text = await MultimodalService.transcribeAudio(f);
                    if (text) {
                        setPastedText(text);
                        setTopic(f.name.replace(/\.[^/.]+$/, ""));
                    } else {
                        alert("תמלול הקובץ נכשל.");
                        // Reset to upload mode if failed? Or keep multimodal?
                    }
                } else {
                    // Standard file
                    setFile(f);
                    setMode('upload');
                    // Explicitly clear other states if needed
                    setPastedText('');
                }
            } catch (error) {
                console.error("Upload error:", error);
                alert("אירעה שגיאה בטעינת הקובץ.");
                setFile(null); // Reset file on critical error
            } finally {
                setIsProcessing(false);
            }
        }
    });

    const canProceed = () => {
        if (step === 1) {
            return mode && (
                (mode === 'topic' && topic) ||
                (mode === 'upload' && file) ||
                (mode === 'text' && pastedText) ||
                (mode === 'multimodal' && pastedText)
            );
        }
        if (step === 2) {
            return !!selectedProduct;
        }
        return true;
    };

    const updateTitleFromInput = () => {
        let suggestedTitle = customTitle;
        if (!suggestedTitle) {
            if (mode === 'upload' && file) {
                suggestedTitle = file.name.replace(/\.[^/.]+$/, "");
            } else if (mode === 'topic' && topic) {
                suggestedTitle = topic;
            } else if (mode === 'text' && pastedText) {
                suggestedTitle = topic || "פעילות טקסט חופשי";
            }
        }
        setCustomTitle(suggestedTitle);
    };

    const handleNext = async () => {
        if (step === 1 && canProceed()) {
            updateTitleFromInput();
            setStep(2);
        } else if (step === 2 && canProceed()) {
            setStep(3);
        } else if (step === 3) {
            setIsProcessing(true);
            const finalData = {
                mode,
                file,
                pastedText,
                title: customTitle || topic || config.defaultTitleName,
                originalTopic: topic,
                settings: {
                    subject: subject || "כללי",
                    grade: grade,
                    targetAudience: grade,
                    activityLength,
                    taxonomy,
                    includeBot,
                    botPersona: includeBot ? botPersona : null,

                    courseMode,
                    // showSourceToStudent,
                    productType: selectedProduct // Pass the product type!
                },
                targetAudience: grade
            };
            if (onComplete) await onComplete(finalData);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else onCancel();
    };


    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-8 animate-fade-in overflow-y-auto bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col min-h-[600px] relative transition-all duration-500">

                {/* --- Header (Deep Royal) --- */}
                <div className="bg-wizdi-royal p-8 pt-10 pb-16 relative overflow-hidden shrink-0 shadow-lg">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-10 -translate-y-10 animate-pulse">
                        <IconWand className="w-64 h-64 text-white" />
                    </div>

                    <div className="relative z-10 flex justify-between items-start mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                                <IconSparkles className="w-8 h-8 text-wizdi-lime animate-wiggle" />
                                {step === 3 ? config.headerLabel : "יצירת פעילות חדשה"}
                            </h2>
                            <p className="text-blue-100/80 font-medium text-lg">
                                {step === 1 && "בואו נתחיל! איך תרצו להזין את התוכן?"}
                                {step === 2 && "מה תרצו ליצור מהתוכן הזה?"}
                                {step === 3 && "כמעט סיימנו... דיוקים אחרונים."}
                            </p>
                        </div>
                        <button onClick={onCancel} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-md text-white">
                            <IconX className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center justify-center max-w-2xl mx-auto relative z-10">
                        <StepIndicator num="1" label="בחירת מקור" isActive={step === 1} isCompleted={step > 1} />
                        <StepLine isCompleted={step > 1} />
                        <StepIndicator num="2" label="סוג תוצר" isActive={step === 2} isCompleted={step > 2} />
                        <StepLine isCompleted={step > 2} />
                        <StepIndicator num="3" label="הגדרות" isActive={step === 3} isCompleted={step > 3} />
                    </div>
                </div>

                {/* --- Main Content Area --- */}
                <div className="p-8 pb-32 flex-1 overflow-y-auto custom-scrollbar -mt-6">

                    {/* Step 1: Input Selection */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
                            {(() => {
                                const dropzoneProps = getRootProps();

                                // SAFE: We configured dropzone with noClick/noKeyboard, 
                                // so getRootProps won't contain conflicting handlers.
                                // We safely spread everything to ensure state management (onFocus/onBlur/onDrop) works for the Input.
                                const { ref, ...spreadProps } = dropzoneProps as any;

                                return (
                                    <SourceCard
                                        id="upload"
                                        label="העלאת קובץ"
                                        icon={IconCloudUpload}
                                        color="blue"
                                        isActive={mode === 'upload'}
                                        innerRef={ref}
                                        {...spreadProps}
                                        onClick={(e: any) => {
                                            e.stopPropagation();
                                            open();
                                        }}
                                    >
                                        {file ? <span className="text-wizdi-royal font-bold">{file.name}</span> : "PDF, TXT, Audio"}
                                        <input {...getInputProps()} />
                                    </SourceCard>
                                );
                            })()}

                            <SourceCard
                                id="text"
                                label="הדבקת טקסט"
                                icon={IconBook}
                                color="green"
                                isActive={mode === 'text'}
                                onClick={() => setMode('text')}
                            >
                                הדבקת מאמר או סיכום
                            </SourceCard>

                            <SourceCard
                                id="multimodal"
                                label="יוטיוב / אודיו"
                                icon={IconVideo}
                                color="red"
                                isActive={mode === 'multimodal'}
                                onClick={() => setMode('multimodal')}
                            >
                                סרטון או הקלטה
                            </SourceCard>

                            <SourceCard
                                id="topic"
                                label="לפי נושא"
                                icon={IconBrain}
                                color="purple"
                                isActive={mode === 'topic'}
                                onClick={() => setMode('topic')}
                            >
                                מחולל AI חופשי
                            </SourceCard>

                            {/* Additional Inputs based on selection */}
                            <div className="col-span-full mt-4">
                                {mode === 'text' && (
                                    <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <textarea
                                            value={pastedText}
                                            onChange={(e) => setPastedText(e.target.value)}
                                            className="w-full h-40 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none"
                                            placeholder="הדביקו כאן את הטקסט..."
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {mode === 'topic' && (
                                    <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <input
                                            type="text"
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            className="w-full p-4 text-lg border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                            placeholder="על מה תרצו ליצור את הפעילות?"
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {mode === 'multimodal' && (
                                    <div className="animate-fade-in bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <div className="flex gap-2 mb-4">
                                            <input
                                                type="text"
                                                dir="ltr"
                                                className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-left"
                                                placeholder="https://www.youtube.com/..."
                                                id="youtube-input"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const url = e.currentTarget.value;
                                                        if (MultimodalService.validateYouTubeUrl(url)) {
                                                            setIsProcessing(true);
                                                            MultimodalService.processYoutubeUrl(url).then(text => {
                                                                if (text) { setPastedText(text); setTopic("YouTube Video"); }
                                                                setIsProcessing(false);
                                                            });
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    const input = document.getElementById('youtube-input') as HTMLInputElement;
                                                    const url = input?.value;
                                                    if (url && MultimodalService.validateYouTubeUrl(url)) {
                                                        setIsProcessing(true);
                                                        try {
                                                            const text = await MultimodalService.processYoutubeUrl(url);
                                                            if (text) {
                                                                setPastedText(text);
                                                                setTopic("YouTube Video");
                                                            } else {
                                                                // This case might be covered by catch, but just in case
                                                                alert("לא הצלחנו למשוך את הכתוביות מהסרטון. נסו להעתיק ידנית.");
                                                            }
                                                        } catch (error) {
                                                            console.error("YouTube Error:", error);
                                                            alert("לא הצלחנו למשוך את הכתוביות מהסרטון (שגיאת שרת או חסימה).\n\nטיפ: העתקו את התמליל ידנית (בחר 'הצג תמליל' ביוטיוב) והדביקו אותו בלשונית 'הדבקת טקסט'.");
                                                        } finally {
                                                            setIsProcessing(false);
                                                        }
                                                    } else {
                                                        alert("אנא הזינו קישור תקין ליוטיוב");
                                                    }
                                                }}
                                                disabled={isProcessing}
                                                className="bg-red-600 text-white px-4 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                            >
                                                {isProcessing ? 'מעבד...' : 'תמלל'}
                                            </button>
                                        </div>
                                        {pastedText && <div className="text-green-600 text-sm font-bold flex items-center gap-2 animate-bounce"><IconCheck className="w-4 h-4" /> התמלול התקבל בהצלחה ({pastedText.length} תווים)</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Product Selection */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
                            <ProductCard
                                id="lesson"
                                label="שיעור מלא"
                                desc="מערך שיעור מובנה עם שלבים, הסברים ושאלות הבנה."
                                icon={IconBook}
                                color="blue"
                                isActive={selectedProduct === 'lesson'}
                                onClick={() => setSelectedProduct('lesson')}
                            />
                            <ProductCard
                                id="podcast"
                                label="פודקאסט AI"
                                desc="יצירת פרק אודיו המבוסס על התוכן, להאזנה ולמידה."
                                icon={IconHeadphones}
                                color="orange"
                                isActive={selectedProduct === 'podcast'}
                                onClick={() => setSelectedProduct('podcast')}
                            />
                            <ProductCard
                                id="exam"
                                label="מבחן / בוחן"
                                desc="שאלון הערכה מסכם לבדיקת ידע, עם ציונים ומשוב."
                                icon={IconTarget}
                                color="indigo"
                                isActive={selectedProduct === 'exam'}
                                onClick={() => setSelectedProduct('exam')}
                            />
                            <ProductCard
                                id="game"
                                label="משחק / תרגול"
                                desc="פעילות משחקית לשינון וחזרה בצורה חוויתית."
                                icon={IconJoystick} // Using Joystick icon
                                color="pink"
                                isActive={selectedProduct === 'game'}
                                onClick={() => setSelectedProduct('game')}
                            />
                        </div>
                    )}

                    {/* Step 3: Settings (Old Step 2) */}
                    {step === 3 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up">
                            <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{config.titleLabel}</label>
                                    <input
                                        type="text"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        className="w-full p-3 border border-slate-200 rounded-xl focus:border-wizdi-royal outline-none font-bold text-slate-800"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">תחום דעת</label>
                                        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white">
                                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">קהל יעד</label>
                                        <select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl outline-none bg-white">
                                            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{config.lengthLabel}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {config.lengthOptions.map(o => (
                                            <button key={o.id} onClick={() => setActivityLength(o.id as any)} className={`p-2 rounded-xl text-sm font-bold transition-all ${activityLength === o.id ? 'bg-wizdi-royal text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                                {o.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <IconBrain className="w-5 h-5 text-wizdi-royal" />
                                    התאמה פדגוגית
                                </h3>
                                {/* Simple Sliders for taxonomy */}
                                {[
                                    { k: 'knowledge', l: 'ידע והבנה', c: 'green' },
                                    { k: 'application', l: 'יישום וניתוח', c: 'blue' },
                                    { k: 'evaluation', l: 'הערכה ויצירה', c: 'purple' }
                                ].map((t: any) => (
                                    <div key={t.k} className="mb-4">
                                        <div className="flex justify-between text-sm mb-1 px-1">
                                            <span className="font-medium text-slate-600">{t.l}</span>
                                            <span className="font-bold text-wizdi-royal">{(taxonomy as any)[t.k]}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            value={(taxonomy as any)[t.k]}
                                            onChange={(e) => handleTaxonomyChange(t.k, parseInt(e.target.value))}
                                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-wizdi-royal"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- Footer (Actions) --- */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex justify-between items-center z-50">
                    <button onClick={handleBack} className="text-slate-400 hover:text-wizdi-royal font-bold px-4 transition-colors flex items-center gap-2">
                        <IconArrowBack className="w-5 h-5 rotate-180" />
                        חזרה
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed() || isProcessing}
                        className={`
                            btn-lip-action px-12 py-4 text-xl flex items-center gap-3 shadow-xl
                            ${(!canProceed() || isProcessing) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
                        `}
                    >
                        {isProcessing ? (
                            <span className="animate-pulse">מעבד נתונים...</span>
                        ) : (
                            <>
                                {step === 3 ? 'סיום ויצירה' : 'המשך לשלב הבא'}
                                <IconArrowBack className="w-6 h-6" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;