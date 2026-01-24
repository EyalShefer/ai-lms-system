/**
 * RemotionVideoEditor Component
 * UI for creating and editing Remotion video blocks
 */

import React, { useState } from 'react';
import {
  IconVideo,
  IconWand,
  IconPlayerPlay,
  IconSettings,
  IconLoader2,
  IconCheck,
  IconX,
  IconSparkles
} from '@tabler/icons-react';
import {
  requestVideoGeneration,
  generateVideoPropsFromContent,
  createRemotionBlock,
  COMPOSITION_LABELS,
  getEstimatedRenderTime
} from '../services/remotionService';
import { RemotionVideoPlayer } from './RemotionVideoPlayer';
import type {
  RemotionCompositionType,
  RemotionVideoBlock,
  RemotionVideoContent
} from '../shared/types/courseTypes';

interface RemotionVideoEditorProps {
  lessonContent: string;
  lessonTitle: string;
  targetAudience: string;
  courseId: string;
  unitId: string;
  onVideoCreated: (block: RemotionVideoBlock) => void;
  existingBlock?: RemotionVideoBlock;
  onCancel?: () => void;
}

const COMPOSITION_OPTIONS: RemotionCompositionType[] = [
  'explainer',
  'math-visualization',
  'timeline',
  'lesson-summary',
  // New composition types
  'assignment-steps',
  'objectives-intro',
  'vocabulary',
  'process-steps',
  'comparison'
];

export const RemotionVideoEditor: React.FC<RemotionVideoEditorProps> = ({
  lessonContent,
  lessonTitle,
  targetAudience,
  courseId,
  unitId,
  onVideoCreated,
  existingBlock,
  onCancel
}) => {
  const [selectedType, setSelectedType] = useState<RemotionCompositionType>(
    existingBlock?.content.compositionType || 'explainer'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingProps, setIsGeneratingProps] = useState(false);
  const [generatedProps, setGeneratedProps] = useState<Record<string, unknown> | null>(
    existingBlock?.content.props || null
  );
  const [previewBlock, setPreviewBlock] = useState<RemotionVideoBlock | null>(
    existingBlock || null
  );
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');

  const selectedInfo = COMPOSITION_LABELS[selectedType];
  const estimatedTime = getEstimatedRenderTime(selectedType);

  // Generate props using AI
  const handleGenerateProps = async () => {
    setIsGeneratingProps(true);
    setError(null);

    try {
      const props = await generateVideoPropsFromContent(
        lessonContent,
        selectedType,
        targetAudience
      );

      setGeneratedProps(props);

      // Create preview block
      const block = createRemotionBlock(selectedType, {
        ...props,
        title: lessonTitle,
        direction: 'rtl'
      });
      setPreviewBlock(block);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת התוכן');
    } finally {
      setIsGeneratingProps(false);
    }
  };

  // Start video generation
  const handleGenerate = async () => {
    if (!generatedProps) {
      setError('יש ליצור תוכן קודם');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Request video generation
      const { jobId } = await requestVideoGeneration({
        compositionType: selectedType,
        props: { ...generatedProps, direction: 'rtl' },
        courseId,
        unitId,
        lessonTitle
      });

      // Create block with rendering status
      const block = createRemotionBlock(
        selectedType,
        { ...generatedProps, direction: 'rtl' },
        { jobId, status: 'rendering' }
      );

      onVideoCreated(block);
    } catch (err: any) {
      setError(err.message || 'שגיאה ביצירת הסרטון');
      setIsGenerating(false);
    }
  };

  // Use preview block directly (no server rendering)
  const handleUsePreview = () => {
    if (!previewBlock) return;

    // Create block with pending status (preview only)
    const block = createRemotionBlock(
      selectedType,
      previewBlock.content.props,
      { status: 'pending' }
    );

    onVideoCreated(block);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-indigo-500 p-4 text-white">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <IconVideo className="w-6 h-6" />
          יצירת סרטון לימודי
        </h3>
        <p className="text-violet-100 text-sm mt-1">
          צור סרטון אנימטיבי מותאם אישית לשיעור
        </p>
      </div>

      {/* Steps indicator */}
      <div className="px-6 py-3 bg-gray-50 border-b flex justify-center gap-8">
        {[
          { id: 'select', label: 'בחירת סוג' },
          { id: 'configure', label: 'יצירת תוכן' },
          { id: 'preview', label: 'תצוגה מקדימה' }
        ].map((s, index) => (
          <div
            key={s.id}
            className={`flex items-center gap-2 ${
              step === s.id ? 'text-violet-600 font-medium' : 'text-gray-400'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === s.id
                  ? 'bg-violet-500 text-white'
                  : steps.indexOf(step) > index
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {steps.indexOf(step) > index ? <IconCheck className="w-5 h-5" /> : index + 1}
            </div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="p-6">
        {/* Step 1: Select composition type */}
        {step === 'select' && (
          <>
            <p className="text-gray-600 mb-4">בחר את סוג הסרטון שברצונך ליצור:</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {COMPOSITION_OPTIONS.map(type => {
                const info = COMPOSITION_LABELS[type];
                const isSelected = selectedType === type;

                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`p-4 rounded-xl border-2 transition-all text-right ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50 shadow-md'
                        : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-3xl">{info.icon}</span>
                    <p className="font-bold text-gray-800 mt-2">{info.label}</p>
                    <p className="text-sm text-gray-500">{info.description}</p>
                    <p className="text-xs text-violet-500 mt-2">
                      משך: ~{getEstimatedRenderTime(type).label}
                    </p>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setStep('configure');
                handleGenerateProps();
              }}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <IconSparkles className="w-5 h-5" />
              המשך ליצירת תוכן
            </button>
          </>
        )}

        {/* Step 2: Generating content */}
        {step === 'configure' && isGeneratingProps && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-violet-200 flex items-center justify-center">
                <IconWand className="w-10 h-10 text-violet-500 animate-pulse" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-violet-300 animate-ping opacity-50" />
            </div>
            <p className="text-lg font-bold text-violet-700 mt-6">
              יוצר תוכן מותאם אישית...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              ה-AI מנתח את תוכן השיעור ויוצר סרטון {selectedInfo.label}
            </p>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && previewBlock && (
          <>
            <div className="mb-4">
              <p className="text-gray-600 mb-2">תצוגה מקדימה של הסרטון:</p>
              <RemotionVideoPlayer
                content={previewBlock.content}
                showControls
                className="w-full"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUsePreview}
                className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <IconCheck className="w-5 h-5" />
                הוסף לשיעור (תצוגה מקדימה)
              </button>

              <button
                disabled={true}
                title="רנדור מלא לקובץ וידאו - בקרוב!"
                className="flex-1 py-3 bg-gradient-to-r from-gray-400 to-gray-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
              >
                <IconPlayerPlay className="w-5 h-5" />
                רנדר סרטון מלא
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-3">
              * רנדור לקובץ וידאו יהיה זמין בקרוב
            </p>

            {/* Back button */}
            <button
              onClick={() => {
                setStep('select');
                setGeneratedProps(null);
                setPreviewBlock(null);
              }}
              className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← חזור לבחירת סוג
            </button>
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
            <IconX className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">שגיאה</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with cancel */}
      {onCancel && (
        <div className="px-6 py-3 bg-gray-50 border-t">
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            ביטול
          </button>
        </div>
      )}
    </div>
  );
};

// Helper for steps comparison
const steps = ['select', 'configure', 'preview'];

// Compact version for inline editing
interface CompactVideoEditorProps {
  onSelect: (type: RemotionCompositionType) => void;
  selectedType?: RemotionCompositionType;
}

export const CompactVideoEditor: React.FC<CompactVideoEditorProps> = ({
  onSelect,
  selectedType
}) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {COMPOSITION_OPTIONS.map(type => {
        const info = COMPOSITION_LABELS[type];
        const isSelected = selectedType === type;

        return (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
              isSelected
                ? 'border-violet-500 bg-violet-50 text-violet-700'
                : 'border-gray-200 hover:border-violet-300 text-gray-600'
            }`}
          >
            <span>{info.icon}</span>
            <span className="text-sm font-medium">{info.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default RemotionVideoEditor;
