import React, { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { IconX, IconSparkles, IconArrowBack, IconCheck, IconWand } from '@tabler/icons-react';
import type { MicroActivityType, MicroActivity, MicroActivitySource } from '../../shared/types/microActivityTypes';
import MicroTypeSelector from './MicroTypeSelector';
import MicroSourceInput from './MicroSourceInput';

interface MicroActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivityCreated?: (courseData: any) => void; // Called when activity is generated - passes data for course creation
  initialGradeLevel?: string;
  initialSubject?: string;
}

type WizardStep = 1 | 2;

// Step Indicator Component (matching IngestionWizard style)
const StepIndicator = ({ num, label, isActive, isCompleted }: { num: string; label: string; isActive: boolean; isCompleted: boolean }) => (
  <div className={`flex flex-col items-center gap-2 relative z-10 ${isActive ? 'scale-110' : 'opacity-80'}`}>
    <div className={`
      w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-lg transition-all duration-300
      ${isActive ? 'bg-white text-emerald-600 shadow-lg ring-4 ring-emerald-500/20' :
        isCompleted ? 'bg-lime-400 text-emerald-800' : 'bg-emerald-800/50 text-white border-2 border-emerald-400/30'}
    `}>
      {isCompleted ? <IconCheck className="w-5 h-5 md:w-6 md:h-6" /> : num}
    </div>
    <span className={`text-xs md:text-sm font-medium hidden md:block ${isActive ? 'text-white' : 'text-emerald-200'}`}>
      {label}
    </span>
  </div>
);

const StepLine = ({ isCompleted }: { isCompleted: boolean }) => (
  <div className={`
    h-1 flex-1 mx-2 rounded-full transition-all duration-500 relative top-[-14px]
    ${isCompleted ? 'bg-lime-400' : 'bg-emerald-800/30'}
  `} />
);

export default function MicroActivityModal({
  isOpen,
  onClose,
  onActivityCreated,
  initialGradeLevel = 'ו',
  initialSubject
}: MicroActivityModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedType, setSelectedType] = useState<MicroActivityType | null>(null);
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setStep(1);
    setSelectedType(null);
    setError(null);
    onClose();
  }, [onClose]);

  // Handle type selection
  const handleTypeSelect = (type: MicroActivityType) => {
    setSelectedType(type);
  };

  // Handle source submission and generate activity
  const handleSourceSubmit = useCallback(async (source: MicroActivitySource, subject: string) => {
    if (!selectedType) return;

    setIsGenerating(true);
    setError(null);

    try {
      const generateFn = httpsCallable(functions, 'generateMicroActivityEndpoint');
      const result = await generateFn({
        type: selectedType,
        source,
        gradeLevel,
        subject: subject || initialSubject
      });

      const data = result.data as { success: boolean; microActivity?: MicroActivity; error?: string };

      if (data.success && data.microActivity) {
        // Convert micro activity to course data format for the editor
        const courseData = {
          title: data.microActivity.title,
          mode: 'topic',
          topic: source.type === 'topic' ? source.content : data.microActivity.title,
          settings: {
            subject: subject || initialSubject || 'כללי',
            grade: `כיתה ${gradeLevel}׳`,
            targetAudience: `כיתה ${gradeLevel}׳`,
            activityLength: 'short',
            productType: 'activity',
            courseMode: 'learning'
          },
          // Pass the generated block so the editor can use it
          generatedBlocks: [data.microActivity.block],
          microActivityData: data.microActivity
        };

        // Close modal and trigger course creation
        handleClose();
        onActivityCreated?.(courseData);
      } else {
        setError(data.error || 'שגיאה ביצירת הפעילות');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'שגיאה ביצירת הפעילות');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedType, gradeLevel, initialSubject, handleClose, onActivityCreated]);

  // Navigation
  const canProceed = () => {
    if (step === 1) return !!selectedType;
    return true;
  };

  const handleNext = () => {
    if (step === 1 && selectedType) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      handleClose();
    }
  };

  if (!isOpen) return null;

  // Step subtitles
  const stepSubtitles: Record<WizardStep, string> = {
    1: 'בחרו את סוג הפעילות שתרצו ליצור',
    2: 'הזינו את התוכן לפעילות'
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-0 md:p-4 md:pt-8 animate-fade-in overflow-y-auto bg-slate-900/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-50 w-full max-w-4xl md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col h-full md:h-auto md:min-h-[600px] relative transition-all duration-500">

        {/* Header (Emerald/Green theme) */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 pt-6 pb-12 md:p-8 md:pt-10 md:pb-16 relative overflow-hidden shrink-0 shadow-lg">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-10 -translate-y-10 animate-pulse">
            <IconWand className="w-64 h-64 text-white" />
          </div>

          <div className="relative z-10 flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                <IconSparkles className="w-8 h-8 text-lime-300 animate-wiggle" />
                מיקרו פעילות
              </h2>
              <p className="text-emerald-100/80 font-medium text-lg">
                {stepSubtitles[step]}
              </p>
            </div>
            <button onClick={handleClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-md text-white">
              <IconX className="w-6 h-6" />
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center max-w-md mx-auto relative z-10">
            <StepIndicator num="1" label="סוג פעילות" isActive={step === 1} isCompleted={step > 1} />
            <StepLine isCompleted={step > 1} />
            <StepIndicator num="2" label="תוכן והגדרות" isActive={step === 2} isCompleted={false} />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-4 md:p-8 pb-24 md:pb-32 flex-1 overflow-y-auto custom-scrollbar -mt-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-medium">סגור</button>
            </div>
          )}

          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div className="animate-slide-up">
              <MicroTypeSelector
                onSelect={handleTypeSelect}
                selectedType={selectedType}
              />
            </div>
          )}

          {/* Step 2: Source Input */}
          {step === 2 && selectedType && (
            <div className="animate-slide-up">
              <MicroSourceInput
                type={selectedType}
                gradeLevel={gradeLevel}
                onGradeLevelChange={setGradeLevel}
                onSubmit={handleSourceSubmit}
                isLoading={isGenerating}
              />
            </div>
          )}
        </div>

        {/* Footer (Actions) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-white border-t border-slate-100 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleBack}
            className="text-slate-400 hover:text-emerald-600 font-bold px-2 md:px-4 transition-colors flex items-center gap-2 text-sm md:text-base"
          >
            <IconArrowBack className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
            חזרה
          </button>

          {/* Show next button only for step 1 */}
          {step === 1 && (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`
                bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold
                px-6 md:px-12 py-3 md:py-4 text-lg md:text-xl rounded-xl
                flex items-center gap-2 md:gap-3 shadow-xl w-full md:w-auto justify-center ml-2
                transition-all duration-200
                ${!canProceed() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-2xl'}
              `}
            >
              המשך
              <IconArrowBack className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
