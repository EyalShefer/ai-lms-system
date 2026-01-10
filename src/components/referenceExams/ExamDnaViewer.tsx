// ExamDnaViewer.tsx - Visualization of extracted Exam DNA

import React from 'react';

interface ExamDNA {
  questionCount: number;
  totalPoints: number;
  estimatedDurationMinutes: number;
  questionTypeDistribution: Record<string, number>;
  bloomDistribution: Record<string, number>;
  difficultyDistribution: Record<string, number>;
  linguisticStyle: {
    averageQuestionLengthWords: number;
    usesRealWorldContext: boolean;
    usesVisualElements: boolean;
    formalityLevel: string;
  };
  extractionConfidence: number;
}

interface ExamDnaViewerProps {
  dna: ExamDNA;
  compact?: boolean;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'רב-ברירה',
  true_false: 'נכון/לא נכון',
  open_question: 'שאלה פתוחה',
  fill_in_blanks: 'השלמה',
  ordering: 'סידור',
  categorization: 'מיון',
};

const BLOOM_LABELS: Record<string, string> = {
  remember: 'זכירה',
  understand: 'הבנה',
  apply: 'יישום',
  analyze: 'ניתוח',
  evaluate: 'הערכה',
  create: 'יצירה',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'קל',
  medium: 'בינוני',
  hard: 'קשה',
};

const FORMALITY_LABELS: Record<string, string> = {
  low: 'לא פורמלי',
  medium: 'בינוני',
  high: 'פורמלי',
};

// Simple bar component for distribution visualization
function DistributionBar({
  label,
  percentage,
  color,
}: {
  label: string;
  percentage: number;
  color: string;
}) {
  if (percentage === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-sm text-gray-600 w-20 text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-700 w-10">{percentage}%</span>
    </div>
  );
}

export default function ExamDnaViewer({ dna, compact = false }: ExamDnaViewerProps) {
  const confidenceColor =
    dna.extractionConfidence >= 0.8
      ? 'text-green-600'
      : dna.extractionConfidence >= 0.6
      ? 'text-yellow-600'
      : 'text-red-600';

  if (compact) {
    // Compact view for lists
    return (
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>{dna.questionCount} שאלות</span>
        <span>{dna.totalPoints} נקודות</span>
        <span>~{dna.estimatedDurationMinutes} דקות</span>
        <span className={confidenceColor}>
          רמת ביטחון: {Math.round(dna.extractionConfidence * 100)}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{dna.questionCount}</p>
          <p className="text-sm text-gray-600">שאלות</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{dna.totalPoints}</p>
          <p className="text-sm text-gray-600">נקודות</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600">~{dna.estimatedDurationMinutes}</p>
          <p className="text-sm text-gray-600">דקות</p>
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <span className="text-sm text-gray-600">רמת ביטחון בחילוץ:</span>
        <span className={`font-semibold ${confidenceColor}`}>
          {Math.round(dna.extractionConfidence * 100)}%
        </span>
      </div>

      {/* Question Type Distribution */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">התפלגות סוגי שאלות</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          {Object.entries(dna.questionTypeDistribution)
            .filter(([_, pct]) => pct > 0)
            .map(([type, pct]) => (
              <DistributionBar
                key={type}
                label={QUESTION_TYPE_LABELS[type] || type}
                percentage={pct}
                color="bg-blue-500"
              />
            ))}
        </div>
      </div>

      {/* Bloom Distribution */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">התפלגות רמות בלום</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          {Object.entries(dna.bloomDistribution)
            .filter(([_, pct]) => pct > 0)
            .map(([level, pct]) => (
              <DistributionBar
                key={level}
                label={BLOOM_LABELS[level] || level}
                percentage={pct}
                color="bg-green-500"
              />
            ))}
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">התפלגות רמות קושי</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          {Object.entries(dna.difficultyDistribution)
            .filter(([_, pct]) => pct > 0)
            .map(([level, pct]) => (
              <DistributionBar
                key={level}
                label={DIFFICULTY_LABELS[level] || level}
                percentage={pct}
                color={
                  level === 'easy' ? 'bg-green-400' : level === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
                }
              />
            ))}
        </div>
      </div>

      {/* Linguistic Style */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">סגנון לשוני</h4>
        <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">אורך שאלה ממוצע</p>
            <p className="font-medium">{dna.linguisticStyle.averageQuestionLengthWords} מילים</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">רמת פורמליות</p>
            <p className="font-medium">
              {FORMALITY_LABELS[dna.linguisticStyle.formalityLevel] || dna.linguisticStyle.formalityLevel}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">הקשר יומיומי</p>
            <p className="font-medium">{dna.linguisticStyle.usesRealWorldContext ? 'כן' : 'לא'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">אלמנטים ויזואליים</p>
            <p className="font-medium">{dna.linguisticStyle.usesVisualElements ? 'כן' : 'לא'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
