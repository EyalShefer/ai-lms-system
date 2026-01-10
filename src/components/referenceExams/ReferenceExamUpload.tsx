// ReferenceExamUpload.tsx - Upload form for reference exams

import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, storage } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import ExamDnaViewer from './ExamDnaViewer';

interface TextbookOption {
  id: string;
  name: string;
  grade: string;
  subject: string;
  volume?: number;
}

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

interface UploadResponse {
  success: boolean;
  examId: string;
  examDna: ExamDNA | null;
  linkedTextbookName: string;
  processingTimeMs: number;
  errors?: string[];
}

const EXAM_TYPES = [
  { value: 'unit_exam', label: 'מבחן יחידה / סיכום פרק' },
  { value: 'midterm', label: 'מבחן אמצע' },
  { value: 'final', label: 'מבחן מסכם' },
  { value: 'quiz', label: 'בוחן קצר' },
];

const GRADES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];

const VOLUMES = [1, 2, 3, 4, 5];

const SUBJECTS = [
  { value: 'math', label: 'מתמטיקה' },
  { value: 'hebrew', label: 'עברית' },
  { value: 'english', label: 'אנגלית' },
  { value: 'science', label: 'מדעים' },
  { value: 'history', label: 'היסטוריה' },
  { value: 'other', label: 'אחר' },
];

interface ReferenceExamUploadProps {
  onUploadComplete?: (result: UploadResponse) => void;
}

export default function ReferenceExamUpload({ onUploadComplete }: ReferenceExamUploadProps) {
  const { currentUser } = useAuth();

  // File state
  const [file, setFile] = useState<File | null>(null);

  // Metadata state
  const [subject, setSubject] = useState('math');
  const [grade, setGrade] = useState('ב');
  const [volume, setVolume] = useState<number>(1);
  const [selectedTextbook, setSelectedTextbook] = useState('');
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [examType, setExamType] = useState('unit_exam');
  const [source, setSource] = useState('');
  const [year, setYear] = useState<number | ''>('');

  // Available textbooks
  const [textbooks, setTextbooks] = useState<TextbookOption[]>([]);
  const [loadingTextbooks, setLoadingTextbooks] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load available textbooks on mount and when grade/subject/volume changes
  useEffect(() => {
    loadTextbooks();
  }, [grade, subject, volume]);

  const loadTextbooks = async () => {
    setLoadingTextbooks(true);
    try {
      const getAvailableTextbooks = httpsCallable(functions, 'getAvailableTextbooks');
      const result = await getAvailableTextbooks({});
      const data = result.data as { textbooks: TextbookOption[] };

      // Filter by current grade, subject, and volume
      const filtered = data.textbooks.filter(
        (t) => t.grade === grade && t.subject === subject && (t.volume === volume || t.id.includes(`_${volume}_`))
      );
      setTextbooks(filtered);

      // Auto-select first if available
      if (filtered.length > 0 && !selectedTextbook) {
        setSelectedTextbook(filtered[0].id);
      }
    } catch (err) {
      console.error('Failed to load textbooks:', err);
    } finally {
      setLoadingTextbooks(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError('יש לבחור קובץ PDF בלבד');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleChapterToggle = (chapter: number) => {
    setSelectedChapters((prev) =>
      prev.includes(chapter) ? prev.filter((c) => c !== chapter) : [...prev, chapter].sort((a, b) => a - b)
    );
  };

  const handleUpload = async () => {
    if (!file) {
      setError('יש לבחור קובץ');
      return;
    }
    if (!selectedTextbook) {
      setError('יש לבחור ספר לימוד');
      return;
    }
    if (selectedChapters.length === 0) {
      setError('יש לבחור לפחות פרק אחד');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress('מעלה קובץ...');

    try {
      // 1. Upload file to Firebase Storage
      const timestamp = Date.now();
      const storagePath = `reference-exams/${currentUser?.uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      setUploadProgress('מחלץ DNA מהמבחן...');

      // 2. Call Cloud Function to process
      const uploadReferenceExam = httpsCallable(functions, 'uploadReferenceExam');
      const result = await uploadReferenceExam({
        fileUrl,
        storagePath,
        mimeType: 'application/pdf',
        fileName: file.name,
        subject,
        grade,
        linkedTextbookId: selectedTextbook,
        chapters: selectedChapters,
        examType,
        source: source || undefined,
        year: year || undefined,
      });

      const response = result.data as UploadResponse;
      setUploadResult(response);
      setUploadProgress('');

      if (response.success) {
        // Reset form
        setFile(null);
        setSelectedChapters([]);
        setSource('');
        setYear('');

        if (onUploadComplete) {
          onUploadComplete(response);
        }
      } else {
        setError(response.errors?.join(', ') || 'שגיאה בהעלאה');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'שגיאה בהעלאת הקובץ');
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">העלאת מבחן ייחוס</h2>
      <p className="text-gray-600 text-sm mb-6">
        העלה מבחן קיים (מהמדריך למורה או ממשרד החינוך) והמערכת תחלץ את ה-DNA שלו - מבנה, סוגי שאלות, רמות קושי.
        בהמשך, המערכת תשתמש ב-DNA הזה כתבנית ליצירת מבחנים חדשים.
      </p>

      <div className="space-y-4">
        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">קובץ PDF של המבחן</label>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          {file && (
            <p className="mt-1 text-sm text-gray-500">
              נבחר: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Subject, Grade, and Volume */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מקצוע</label>
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSelectedTextbook('');
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כיתה</label>
            <select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setSelectedTextbook('');
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  כיתה {g}׳
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כרך / ספר</label>
            <select
              value={volume}
              onChange={(e) => {
                setVolume(parseInt(e.target.value));
                setSelectedTextbook('');
              }}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {VOLUMES.map((v) => (
                <option key={v} value={v}>
                  ספר {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Textbook Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שיוך לספר לימוד</label>
          {loadingTextbooks ? (
            <p className="text-gray-500 text-sm">טוען ספרים...</p>
          ) : textbooks.length === 0 ? (
            <p className="text-orange-600 text-sm">
              לא נמצאו ספרים לכיתה {grade}׳ במקצוע {SUBJECTS.find((s) => s.value === subject)?.label}, ספר {volume}.
              יש להעלות ספר לימוד קודם.
            </p>
          ) : (
            <select
              value={selectedTextbook}
              onChange={(e) => setSelectedTextbook(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">בחר ספר...</option>
              {textbooks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Chapters Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">פרקים שהמבחן מכסה</label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => handleChapterToggle(ch)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedChapters.includes(ch)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                פרק {ch}
              </button>
            ))}
          </div>
          {selectedChapters.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">נבחרו: פרקים {selectedChapters.join(', ')}</p>
          )}
        </div>

        {/* Exam Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">סוג המבחן</label>
          <select
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {EXAM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Optional: Source and Year */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מקור (אופציונלי)</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="מדריך למורה, משרד החינוך..."
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שנה (אופציונלי)</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="2024"
              min={2000}
              max={2030}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-blue-700 text-sm">{uploadProgress}</p>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={uploading || !file || !selectedTextbook || selectedChapters.length === 0}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'מעבד...' : 'העלה וחלץ DNA'}
        </button>

        {/* Upload Result */}
        {uploadResult?.success && uploadResult.examDna && (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 text-green-700">DNA חולץ בהצלחה!</h3>
            <ExamDnaViewer dna={uploadResult.examDna} />
          </div>
        )}
      </div>
    </div>
  );
}
