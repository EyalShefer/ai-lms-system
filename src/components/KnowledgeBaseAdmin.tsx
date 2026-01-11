// KnowledgeBaseAdmin.tsx - Admin interface for managing the math knowledge base

import React, { useState, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import { functions, storage, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ReferenceExamUpload, ReferenceExamsList } from './referenceExams';

interface UploadResponse {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  chaptersFound: string[];
  processingTimeMs: number;
  errors?: string[];
  extractionQuality?: {
    method: string;
    averageConfidence?: number;
    pagesNeedingReview?: number[];
  };
  // For batch processing of large PDFs
  progress?: {
    processedPages: number;
    totalPages: number;
    percentComplete: number;
  };
}

interface SearchResult {
  chunk: {
    id: string;
    grade: string;
    volume: number;
    volumeType: 'student' | 'teacher' | 'curriculum';
    chapter: string;
    content: string;
    contentType: string;
    source: string;
    keywords: string[];
  };
  similarity: number;
}

interface Stats {
  totalChunks: number;
  byGrade: Record<string, number>;
  bySubject: Record<string, number>;
  byVolumeType: Record<string, number>;
}

const GRADES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];
const SUBJECTS = [
  { value: 'math', label: 'מתמטיקה' },
  { value: 'hebrew', label: 'עברית' },
  { value: 'english', label: 'אנגלית' },
  { value: 'science', label: 'מדעים' },
  { value: 'history', label: 'היסטוריה' },
  { value: 'other', label: 'אחר' },
];

interface KnowledgeBaseAdminProps {
  onNavigateToReview?: () => void;
}

export default function KnowledgeBaseAdmin({ onNavigateToReview }: KnowledgeBaseAdminProps) {
  const { currentUser } = useAuth();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [subject, setSubject] = useState('math');
  const [grade, setGrade] = useState('ב');
  const [volume, setVolume] = useState(1);
  const [volumeType, setVolumeType] = useState<'student' | 'teacher' | 'curriculum'>('student');
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['ב']); // For curriculum - multiple grades
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [batchProgressId, setBatchProgressId] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [liveProgress, setLiveProgress] = useState<{
    processedPages: number;
    totalPages: number;
    currentPage?: number;
    status?: string;
  } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGrade, setSearchGrade] = useState('');
  const [searchVolumeType, setSearchVolumeType] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Books state
  const [books, setBooks] = useState<Array<{
    grade: string;
    volume: number;
    volumeType: string;
    subject: string;
    chunksCount: number;
    source?: string;
    grades?: string[]; // For curriculum - multiple grades
  }>>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [deletingBook, setDeletingBook] = useState<string | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; message: string } | null>(null);

  // Migration state
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<'upload' | 'search' | 'stats' | 'reference_exams'>('upload');

  // Load stats, books, and pending progress on mount
  useEffect(() => {
    loadStats();
    loadBooks();
    loadPendingProgress();
  }, []);

  // Real-time progress listener
  useEffect(() => {
    if (!batchProgressId) {
      setLiveProgress(null);
      return;
    }

    const progressRef = doc(db, 'extraction_progress', batchProgressId);
    const unsubscribe = onSnapshot(progressRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setLiveProgress({
          processedPages: data.processedPages || 0,
          totalPages: data.totalPages || 0,
          currentPage: data.currentPage,
          status: data.status,
        });
      }
    }, (error) => {
      console.error('Progress listener error:', error);
    });

    return () => unsubscribe();
  }, [batchProgressId]);

  // Load any pending extraction progress from Firestore
  const loadPendingProgress = async () => {
    try {
      const progressQuery = query(
        collection(db, 'extraction_progress'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(progressQuery);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();

        // Set the progress state
        setBatchProgressId(doc.id);
        setUploadResult({
          success: false,
          documentId: doc.id,
          chunksCreated: 0,
          chaptersFound: [],
          processingTimeMs: 0,
          progress: {
            processedPages: data.processedPages || 0,
            totalPages: data.totalPages || 0,
            percentComplete: data.totalPages ? Math.round((data.processedPages / data.totalPages) * 100) : 0,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load pending progress:', error);
    }
  };

  const loadBooks = async () => {
    setLoadingBooks(true);
    try {
      const getBooksFunc = httpsCallable(functions, 'getKnowledgeBooks');
      const result = await getBooksFunc({});
      const data = result.data as { books: typeof books };
      setBooks(data.books);
    } catch (error: any) {
      console.error('Failed to load books:', error);
    } finally {
      setLoadingBooks(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const getStatsFunc = httpsCallable(functions, 'getKnowledgeStats');
      const result = await getStatsFunc({});
      setStats(result.data as Stats);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !currentUser) return;

    setUploading(true);
    setUploadResult(null);
    setUploadProgress('מעלה קובץ ל-Storage...');

    try {
      // Step 1: Upload to Firebase Storage first (bypasses Cloud Function size limits)
      const timestamp = Date.now();
      const storagePath = `knowledge-base/${currentUser.uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      setUploadProgress('מעבד את הקובץ עם AI...');

      // Step 2: Call Cloud Function with Storage URL (not base64)
      const uploadFunc = httpsCallable(functions, 'uploadKnowledge', { timeout: 300000 });
      const result = await uploadFunc({
        fileUrl,
        storagePath,
        mimeType: file.type,
        fileName: file.name,
        subject,
        grade: volumeType === 'curriculum' ? selectedGrades[0] : grade, // For curriculum, use first selected grade as primary
        volume: volumeType === 'curriculum' ? 0 : volume, // Curriculum doesn't use volume
        volumeType,
        // For curriculum, pass all selected grades
        ...(volumeType === 'curriculum' && { grades: selectedGrades }),
      });

      const response = result.data as UploadResponse;
      setUploadResult(response);
      setUploadProgress('');

      // Check if batch processing is in progress
      if (!response.success && response.documentId && response.progress) {
        setBatchProgressId(response.documentId);
      } else {
        setBatchProgressId(null);
      }

      // Refresh stats
      if (response.success) {
        loadStats();
        loadBooks();
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadProgress('');
      setUploadResult({
        success: false,
        documentId: '',
        chunksCreated: 0,
        chaptersFound: [],
        processingTimeMs: 0,
        errors: [error.message],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const searchFunc = httpsCallable(functions, 'searchKnowledge');
      const result = await searchFunc({
        query: searchQuery,
        filters: {
          subject: 'math',
          ...(searchGrade && { grade: searchGrade }),
          ...(searchVolumeType && { volumeType: searchVolumeType }),
        },
        limit: 10,
      });

      const data = result.data as { results: SearchResult[] };
      setSearchResults(data.results);
    } catch (error: any) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleContinueBatch = async () => {
    if (!batchProgressId || !currentUser) return;

    setContinuing(true);
    setUploadProgress('ממשיך בעיבוד הספר...');

    try {
      const continueFunc = httpsCallable(functions, 'continueKnowledgeExtraction', { timeout: 600000 });
      const result = await continueFunc({ progressId: batchProgressId });

      const response = result.data as UploadResponse;
      setUploadResult(response);
      setUploadProgress('');

      // Check if still needs more batches
      if (!response.success && response.documentId && response.progress) {
        setBatchProgressId(response.documentId);
      } else {
        setBatchProgressId(null);
        // Refresh stats if complete
        if (response.success) {
          loadStats();
          loadBooks();
        }
      }
    } catch (error: any) {
      console.error('Continue batch failed:', error);
      setUploadProgress('');
      setUploadResult({
        success: false,
        documentId: batchProgressId,
        chunksCreated: 0,
        chaptersFound: [],
        processingTimeMs: 0,
        errors: [error.message],
      });
    } finally {
      setContinuing(false);
    }
  };

  const handleDeleteBook = async (book: typeof books[0]) => {
    const bookName = book.volumeType === 'teacher' ? 'מדריך למורה' : 'ספר תלמיד';
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את ${bookName} כיתה ${book.grade}' כרך ${book.volume}?\n\nפעולה זו אינה הפיכה!`)) {
      return;
    }

    const bookKey = `${book.grade}-${book.volume}-${book.volumeType}`;
    setDeletingBook(bookKey);
    setDeleteResult(null);

    try {
      const deleteFunc = httpsCallable(functions, 'deleteKnowledgeBook', { timeout: 300000 });
      const result = await deleteFunc({
        grade: book.grade,
        volume: book.volume,
        volumeType: book.volumeType,
      });
      const data = result.data as { success: boolean; message: string; deletedCount: number };

      setDeleteResult({
        success: data.success,
        message: data.message,
      });

      // Refresh stats and books after deletion
      loadStats();
      loadBooks();
    } catch (error: any) {
      console.error('Delete failed:', error);
      setDeleteResult({
        success: false,
        message: error.message || 'שגיאה במחיקה',
      });
    } finally {
      setDeletingBook(null);
    }
  };

  // Migrate knowledge books to textbooks
  const handleMigrateToTextbooks = async () => {
    if (!window.confirm('האם לסנכרן את כל הספרים מבסיס הידע למערכת הספרים?\n\nפעולה זו תיצור רשומות ספר עבור כל הספרים שקיימים בבסיס הידע.')) {
      return;
    }

    setMigrating(true);
    setMigrationResult(null);

    try {
      const migrateFunc = httpsCallable(functions, 'migrateKnowledgeBooksToTextbooks', { timeout: 540000 });
      const result = await migrateFunc({});
      const data = result.data as {
        success: boolean;
        totalBooks: number;
        created: number;
        failed: number;
        results: Array<{ key: string; success: boolean; error?: string }>;
      };

      setMigrationResult({
        success: data.success,
        message: `סנכרון הושלם!\nנמצאו ${data.totalBooks} ספרים\nנוצרו ${data.created} רשומות חדשות\nנכשלו ${data.failed}`,
      });

      // Refresh books list
      loadBooks();
    } catch (error: any) {
      console.error('Migration failed:', error);
      setMigrationResult({
        success: false,
        message: error.message || 'שגיאה בסנכרון',
      });
    } finally {
      setMigrating(false);
    }
  };

  // Create review for a book
  const [creatingReview, setCreatingReview] = useState<string | null>(null);

  const handleCreateReview = async (book: typeof books[0]) => {
    const bookKey = `${book.grade}-${book.volume}-${book.volumeType}`;
    setCreatingReview(bookKey);

    try {
      const createReviewFunc = httpsCallable(functions, 'createReviewForExistingBook');
      const result = await createReviewFunc({
        grade: book.grade,
        volume: book.volume,
        volumeType: book.volumeType,
        // For curriculum, pass the grades array
        ...(book.volumeType === 'curriculum' && book.grades && { grades: book.grades }),
      });
      const data = result.data as { success: boolean; reviewId: string; totalPages: number };

      if (data.success) {
        alert(`נוצרה סקירה בהצלחה!\nמזהה: ${data.reviewId}\nעמודים: ${data.totalPages}`);
        // Navigate to review page if available
        if (onNavigateToReview) {
          onNavigateToReview();
        }
      }
    } catch (error: any) {
      console.error('Create review failed:', error);
      alert('שגיאה ביצירת סקירה: ' + error.message);
    } finally {
      setCreatingReview(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">בסיס הידע - מתמטיקה</h1>
            <p className="text-gray-600 mt-2">
              ניהול תוכן מתמטי לשימוש ביצירת שאלות ותכנים חכמים
            </p>
          </div>
          {onNavigateToReview && (
            <button
              onClick={onNavigateToReview}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
            >
              <span>🔍</span>
              סקירת חילוץ טקסט
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'upload'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            העלאת ספר
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'search'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            חיפוש
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'stats'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            סטטיסטיקות
          </button>
          <button
            onClick={() => setActiveTab('reference_exams')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'reference_exams'
                ? 'border-b-2 border-purple-500 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            מבחני ייחוס
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">העלאת ספר חדש</h2>

            <div className="space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  קובץ PDF
                </label>
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

              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    מקצוע
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    סוג
                  </label>
                  <select
                    value={volumeType}
                    onChange={(e) => setVolumeType(e.target.value as 'student' | 'teacher' | 'curriculum')}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="student">ספר תלמיד</option>
                    <option value="teacher">מדריך למורה</option>
                    <option value="curriculum">תוכנית לימודים</option>
                  </select>
                </div>

                {/* For textbooks: single grade + volume */}
                {volumeType !== 'curriculum' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        כיתה
                      </label>
                      <select
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        כרך
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value) || 1)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* For curriculum: multi-grade selection */}
              {volumeType === 'curriculum' && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <label className="block text-sm font-medium text-green-800 mb-2">
                    שכבות (ניתן לבחור מספר כיתות)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GRADES.map((g) => {
                      const isSelected = selectedGrades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              // Don't allow deselecting if it's the last one
                              if (selectedGrades.length > 1) {
                                setSelectedGrades(selectedGrades.filter(sg => sg !== g));
                              }
                            } else {
                              setSelectedGrades([...selectedGrades, g]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-green-600 text-white'
                              : 'bg-white text-green-700 border border-green-300 hover:bg-green-100'
                          }`}
                        >
                          {g}׳
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-green-600">
                    נבחרו: {selectedGrades.sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)).map(g => `${g}׳`).join(', ')}
                  </p>
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full py-3 px-4 rounded-md font-medium text-white ${
                  !file || uploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    {uploadProgress || 'מעבד... (זה יכול לקחת כמה דקות)'}
                  </span>
                ) : (
                  'העלה וארגן'
                )}
              </button>

              {/* Real-time Progress Bar */}
              {(uploading || continuing) && liveProgress && liveProgress.totalPages > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">
                      מעבד עמוד {liveProgress.currentPage || liveProgress.processedPages} מתוך {liveProgress.totalPages}
                    </span>
                    <span className="text-sm font-bold text-blue-600">
                      {Math.round((liveProgress.processedPages / liveProgress.totalPages) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-blue-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(liveProgress.processedPages / liveProgress.totalPages) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-blue-600">
                    {liveProgress.status === 'processing' ? 'מחלץ טקסט עם AI...' :
                     liveProgress.status === 'saving' ? 'שומר לבסיס הנתונים...' :
                     'מעבד...'}
                  </p>
                </div>
              )}

              {/* Upload Result */}
              {uploadResult && (
                <div
                  className={`mt-4 p-4 rounded-md ${
                    uploadResult.success
                      ? 'bg-green-50 border border-green-200'
                      : uploadResult.progress
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {uploadResult.success ? (
                    <>
                      <h3 className="font-medium text-green-800">העלאה הצליחה!</h3>
                      <ul className="mt-2 text-sm text-green-700 space-y-1">
                        <li>נוצרו {uploadResult.chunksCreated} קטעים</li>
                        <li>זמן עיבוד: {(uploadResult.processingTimeMs / 1000).toFixed(1)} שניות</li>
                        <li>
                          פרקים שנמצאו: {uploadResult.chaptersFound.join(', ') || 'לא זוהו פרקים'}
                        </li>
                      </ul>

                      {/* Extraction Quality Metrics */}
                      {uploadResult.extractionQuality && (
                        <div className="mt-4 pt-3 border-t border-green-200">
                          <h4 className="font-medium text-green-800 mb-2">איכות החילוץ:</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-green-700">שיטה:</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                uploadResult.extractionQuality.method === 'high_quality' ||
                                uploadResult.extractionQuality.method === 'high_quality_batch'
                                  ? 'bg-green-200 text-green-800'
                                  : 'bg-yellow-200 text-yellow-800'
                              }`}>
                                {uploadResult.extractionQuality.method === 'high_quality'
                                  ? 'חילוץ באיכות גבוהה (Gemini)'
                                  : uploadResult.extractionQuality.method === 'high_quality_batch'
                                  ? 'חילוץ באיכות גבוהה - Batch (Gemini)'
                                  : uploadResult.extractionQuality.method}
                              </span>
                            </div>

                            {uploadResult.extractionQuality.averageConfidence !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-green-700">רמת ודאות:</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        uploadResult.extractionQuality.averageConfidence >= 0.9
                                          ? 'bg-green-500'
                                          : uploadResult.extractionQuality.averageConfidence >= 0.8
                                          ? 'bg-yellow-500'
                                          : 'bg-red-500'
                                      }`}
                                      style={{ width: `${uploadResult.extractionQuality.averageConfidence * 100}%` }}
                                    />
                                  </div>
                                  <span className={`text-sm font-medium ${
                                    uploadResult.extractionQuality.averageConfidence >= 0.9
                                      ? 'text-green-700'
                                      : uploadResult.extractionQuality.averageConfidence >= 0.8
                                      ? 'text-yellow-700'
                                      : 'text-red-700'
                                  }`}>
                                    {(uploadResult.extractionQuality.averageConfidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            )}

                            {uploadResult.extractionQuality.pagesNeedingReview &&
                             uploadResult.extractionQuality.pagesNeedingReview.length > 0 && (
                              <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded">
                                <p className="text-sm text-yellow-800 font-medium">
                                  עמודים הדורשים בדיקה ידנית:
                                </p>
                                <p className="text-sm text-yellow-700">
                                  עמודים {uploadResult.extractionQuality.pagesNeedingReview.join(', ')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : uploadResult.progress ? (
                    // Batch processing in progress
                    <>
                      <h3 className="font-medium text-blue-800 flex items-center gap-2">
                        <span>📚</span>
                        עיבוד ספר גדול בהתקדמות
                      </h3>
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-blue-700">התקדמות:</span>
                          <div className="flex-1 h-4 bg-blue-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${uploadResult.progress.percentComplete}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-blue-800">
                            {uploadResult.progress.percentComplete}%
                          </span>
                        </div>
                        <p className="text-sm text-blue-700">
                          עמודים: {uploadResult.progress.processedPages} / {uploadResult.progress.totalPages}
                        </p>
                        <p className="text-xs text-blue-600">
                          ספרים גדולים מעובדים בחלקים (40 עמודים בכל פעם) בגלל מגבלות זמן.
                        </p>
                        <button
                          onClick={handleContinueBatch}
                          disabled={continuing}
                          className={`w-full py-3 px-4 rounded-md font-medium text-white ${
                            continuing
                              ? 'bg-blue-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          {continuing ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                              {uploadProgress || 'ממשיך בעיבוד...'}
                            </span>
                          ) : (
                            '▶️ המשך עיבוד'
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="font-medium text-red-800">העלאה נכשלה</h3>
                      <ul className="mt-2 text-sm text-red-700">
                        {uploadResult.errors?.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">חיפוש בבסיס הידע</h2>

            <div className="space-y-4">
              {/* Search Input */}
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חפש נושא... (למשל: חיבור עד 100, שברים, שטח מלבן)"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {searching ? 'מחפש...' : 'חפש'}
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-4">
                <select
                  value={searchGrade}
                  onChange={(e) => setSearchGrade(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">כל הכיתות</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      כיתה {g}׳
                    </option>
                  ))}
                </select>

                <select
                  value={searchVolumeType}
                  onChange={(e) => setSearchVolumeType(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">כל הסוגים</option>
                  <option value="student">ספר תלמיד</option>
                  <option value="teacher">מדריך למורה</option>
                  <option value="curriculum">תוכנית לימודים</option>
                </select>
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="font-medium text-gray-700">
                    נמצאו {searchResults.length} תוצאות:
                  </h3>

                  {searchResults.map((result, index) => (
                    <div
                      key={result.chunk.id}
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{result.chunk.chapter}</span>
                          <span className="text-sm text-gray-500 mr-2">
                            (כיתה {result.chunk.grade}׳, כרך {result.chunk.volume},
                            {result.chunk.volumeType === 'teacher' ? ' מדריך למורה' : result.chunk.volumeType === 'curriculum' ? ' תוכנית לימודים' : ' ספר תלמיד'})
                          </span>
                        </div>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {(result.similarity * 100).toFixed(0)}% התאמה
                        </span>
                      </div>

                      <p className="text-gray-600 text-sm line-clamp-3">
                        {result.chunk.content}
                      </p>

                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {result.chunk.contentType}
                        </span>
                        {result.chunk.keywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && searchQuery && !searching && (
                <p className="text-gray-500 text-center py-8">
                  לא נמצאו תוצאות. נסה מונחים אחרים.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">סטטיסטיקות בסיס הידע</h2>
              <button
                onClick={loadStats}
                disabled={loadingStats}
                className="text-blue-600 hover:text-blue-800"
              >
                {loadingStats ? 'טוען...' : 'רענן'}
              </button>
            </div>

            {stats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-blue-900">סה״כ קטעים</h3>
                  <p className="text-4xl font-bold text-blue-600 mt-2">
                    {stats.totalChunks.toLocaleString()}
                  </p>
                </div>

                {/* By Grade */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-green-900">לפי כיתה</h3>
                  <div className="mt-2 space-y-1">
                    {Object.entries(stats.byGrade)
                      .sort(([a], [b]) => GRADES.indexOf(a) - GRADES.indexOf(b))
                      .map(([g, count]) => (
                        <div key={g} className="flex justify-between text-sm">
                          <span>כיתה {g}׳</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* By Type */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-purple-900">לפי סוג</h3>
                  <div className="mt-2 space-y-1">
                    {Object.entries(stats.byVolumeType).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span>{type === 'student' ? 'ספר תלמיד' : type === 'teacher' ? 'מדריך למורה' : type === 'curriculum' ? 'תוכנית לימודים' : type}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                {loadingStats ? 'טוען סטטיסטיקות...' : 'אין נתונים עדיין'}
              </p>
            )}

            {/* Books List Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">ספרים בבסיס הידע</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleMigrateToTextbooks}
                    disabled={migrating}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                      migrating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {migrating ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        מסנכרן...
                      </span>
                    ) : (
                      '🔄 סנכרן למערכת ספרים'
                    )}
                  </button>
                  <button
                    onClick={loadBooks}
                    disabled={loadingBooks}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {loadingBooks ? 'טוען...' : 'רענן'}
                  </button>
                </div>
              </div>

              {/* Migration Result */}
              {migrationResult && (
                <div
                  className={`mb-4 p-3 rounded-md whitespace-pre-line ${
                    migrationResult.success
                      ? 'bg-green-100 border border-green-300'
                      : 'bg-red-100 border border-red-300'
                  }`}
                >
                  <p className={migrationResult.success ? 'text-green-800' : 'text-red-800'}>
                    {migrationResult.message}
                  </p>
                </div>
              )}

              {/* Delete Result */}
              {deleteResult && (
                <div
                  className={`mb-4 p-3 rounded-md ${
                    deleteResult.success
                      ? 'bg-green-100 border border-green-300'
                      : 'bg-red-100 border border-red-300'
                  }`}
                >
                  <p className={deleteResult.success ? 'text-green-800' : 'text-red-800'}>
                    {deleteResult.message}
                  </p>
                </div>
              )}

              {loadingBooks ? (
                <p className="text-gray-500 text-center py-4">טוען רשימת ספרים...</p>
              ) : books.length === 0 ? (
                <p className="text-gray-500 text-center py-4">אין ספרים בבסיס הידע</p>
              ) : (
                <div className="space-y-2">
                  {books.map((book) => {
                    const bookKey = `${book.grade}-${book.volume}-${book.volumeType}`;
                    const isDeleting = deletingBook === bookKey;
                    const bookName = book.volumeType === 'teacher' ? 'מדריך למורה' : book.volumeType === 'curriculum' ? 'תוכנית לימודים' : 'ספר תלמיד';
                    const bgColor = book.volumeType === 'teacher' ? 'bg-purple-50 border-purple-200' : book.volumeType === 'curriculum' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200';
                    const textColor = book.volumeType === 'teacher' ? 'text-purple-700' : book.volumeType === 'curriculum' ? 'text-green-700' : 'text-blue-700';

                    return (
                      <div
                        key={bookKey}
                        className={`flex items-center justify-between p-3 rounded-lg border ${bgColor}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-2xl">
                            {book.volumeType === 'teacher' ? '👨‍🏫' : book.volumeType === 'curriculum' ? '📋' : '📖'}
                          </span>
                          <div>
                            <div className={`font-medium ${textColor}`}>
                              {book.volumeType === 'curriculum'
                                ? `${bookName} - ${book.grades && book.grades.length > 0
                                    ? `כיתות ${book.grades.join('׳, ')}׳`
                                    : `כיתה ${book.grade}׳`}`
                                : `${bookName} - כיתה ${book.grade}׳ כרך ${book.volume}`}
                            </div>
                            <div className="text-sm text-gray-500">
                              {book.chunksCount} קטעים
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCreateReview(book)}
                            disabled={creatingReview === bookKey}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                              creatingReview === bookKey
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            }`}
                          >
                            {creatingReview === bookKey ? 'יוצר...' : '🔍 סקירה'}
                          </button>
                          <button
                            onClick={() => handleDeleteBook(book)}
                            disabled={isDeleting}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                              isDeleting
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                        >
                          {isDeleting ? (
                            <span className="flex items-center gap-1">
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                />
                              </svg>
                              מוחק...
                            </span>
                          ) : (
                            '🗑️ מחק'
                          )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reference Exams Tab */}
        {activeTab === 'reference_exams' && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-800 mb-2">מבחני ייחוס</h3>
              <p className="text-purple-700 text-sm">
                מבחני ייחוס הם מבחנים קיימים (מדריכי מורה, משרד החינוך) שמשמשים כתבניות ליצירת מבחנים חדשים.
                המערכת מחלצת את ה-DNA של המבחן (מבנה, סוגי שאלות, רמות קושי) ומשתמשת בו לייצר מבחנים עם אותו
                מבנה אבל שאלות חדשות מתוכן הספר.
              </p>
            </div>

            {/* Upload Form */}
            <ReferenceExamUpload
              onUploadComplete={() => {
                // Refresh the list after successful upload
              }}
            />

            {/* Existing Exams List */}
            <ReferenceExamsList />
          </div>
        )}
      </div>
    </div>
  );
}
