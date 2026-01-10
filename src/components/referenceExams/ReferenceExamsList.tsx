// ReferenceExamsList.tsx - List of uploaded reference exams

import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import ExamDnaViewer from './ExamDnaViewer';

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

interface ReferenceExam {
  id: string;
  documentType: 'reference_exam';
  linkedTextbookId: string;
  linkedTextbookName: string;
  chapters: number[];
  subject: string;
  grade: string;
  examType: string;
  fileName: string;
  examDna: ExamDNA;
  source?: string;
  year?: number;
  uploadedBy: string;
  uploadedAt: any;
  usageCount: number;
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  unit_exam: 'מבחן יחידה',
  midterm: 'מבחן אמצע',
  final: 'מבחן מסכם',
  quiz: 'בוחן',
};

export default function ReferenceExamsList() {
  const [exams, setExams] = useState<ReferenceExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [deletingExam, setDeletingExam] = useState<string | null>(null);

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const listReferenceExams = httpsCallable(functions, 'listReferenceExams');
      const result = await listReferenceExams({});
      const data = result.data as { exams: ReferenceExam[] };
      setExams(data.exams || []);
    } catch (err: any) {
      console.error('Failed to load exams:', err);
      setError(err.message || 'שגיאה בטעינת מבחנים');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (examId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את מבחן הייחוס הזה?')) {
      return;
    }

    setDeletingExam(examId);
    try {
      const deleteReferenceExam = httpsCallable(functions, 'deleteReferenceExam');
      await deleteReferenceExam({ examId });
      setExams((prev) => prev.filter((e) => e.id !== examId));
    } catch (err: any) {
      console.error('Failed to delete exam:', err);
      alert('שגיאה במחיקה: ' + err.message);
    } finally {
      setDeletingExam(null);
    }
  };

  const toggleExpand = (examId: string) => {
    setExpandedExam((prev) => (prev === examId ? null : examId));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center">טוען מבחני ייחוס...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-red-600 text-center">{error}</p>
        <button onClick={loadExams} className="mt-4 text-blue-600 hover:underline mx-auto block">
          נסה שוב
        </button>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">אין עדיין מבחני ייחוס</p>
          <p className="text-sm">העלה מבחן קיים כדי ליצור תבנית לייצור מבחנים חדשים</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">מבחני ייחוס ({exams.length})</h3>
        <button onClick={loadExams} className="text-blue-600 hover:underline text-sm">
          רענן
        </button>
      </div>

      {exams.map((exam) => (
        <div key={exam.id} className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header - always visible */}
          <div
            className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
            onClick={() => toggleExpand(exam.id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h4 className="font-medium text-gray-800">{exam.linkedTextbookName}</h4>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {EXAM_TYPE_LABELS[exam.examType] || exam.examType}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                פרקים: {exam.chapters.join(', ')} | {exam.examDna.questionCount} שאלות |{' '}
                {exam.examDna.totalPoints} נקודות
                {exam.usageCount > 0 && (
                  <span className="text-green-600 mr-2">({exam.usageCount} שימושים)</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(exam.id);
                }}
                disabled={deletingExam === exam.id}
                className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                title="מחק"
              >
                {deletingExam === exam.id ? '...' : '🗑️'}
              </button>
              <span className="text-gray-400">{expandedExam === exam.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Expanded content */}
          {expandedExam === exam.id && (
            <div className="border-t p-4 bg-gray-50">
              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-500">קובץ:</span>
                  <p className="text-gray-800">{exam.fileName}</p>
                </div>
                {exam.source && (
                  <div>
                    <span className="text-gray-500">מקור:</span>
                    <p className="text-gray-800">{exam.source}</p>
                  </div>
                )}
                {exam.year && (
                  <div>
                    <span className="text-gray-500">שנה:</span>
                    <p className="text-gray-800">{exam.year}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">שימושים:</span>
                  <p className="text-gray-800">{exam.usageCount}</p>
                </div>
              </div>

              {/* DNA Visualization */}
              <ExamDnaViewer dna={exam.examDna} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
