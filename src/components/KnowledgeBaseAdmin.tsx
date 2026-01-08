// KnowledgeBaseAdmin.tsx - Admin interface for managing the math knowledge base

import React, { useState, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface UploadResponse {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  chaptersFound: string[];
  processingTimeMs: number;
  errors?: string[];
}

interface SearchResult {
  chunk: {
    id: string;
    grade: string;
    volume: number;
    volumeType: 'student' | 'teacher';
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

export default function KnowledgeBaseAdmin() {
  const { currentUser } = useAuth();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [subject, setSubject] = useState('math');
  const [grade, setGrade] = useState('ב');
  const [volume, setVolume] = useState(1);
  const [volumeType, setVolumeType] = useState<'student' | 'teacher'>('student');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGrade, setSearchGrade] = useState('');
  const [searchVolumeType, setSearchVolumeType] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'upload' | 'search' | 'stats'>('upload');

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

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
        grade,
        volume,
        volumeType,
      });

      setUploadResult(result.data as UploadResponse);
      setUploadProgress('');

      // Refresh stats
      loadStats();
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

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">בסיס הידע - מתמטיקה</h1>
          <p className="text-gray-600 mt-2">
            ניהול תוכן מתמטי לשימוש ביצירת שאלות ותכנים חכמים
          </p>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    סוג
                  </label>
                  <select
                    value={volumeType}
                    onChange={(e) => setVolumeType(e.target.value as 'student' | 'teacher')}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="student">ספר תלמיד</option>
                    <option value="teacher">מדריך למורה</option>
                  </select>
                </div>
              </div>

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

              {/* Upload Result */}
              {uploadResult && (
                <div
                  className={`mt-4 p-4 rounded-md ${
                    uploadResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {uploadResult.success ? (
                    <>
                      <h3 className="font-medium text-green-800">העלאה הצליחה!</h3>
                      <ul className="mt-2 text-sm text-green-700">
                        <li>נוצרו {uploadResult.chunksCreated} קטעים</li>
                        <li>זמן עיבוד: {(uploadResult.processingTimeMs / 1000).toFixed(1)} שניות</li>
                        <li>
                          פרקים שנמצאו: {uploadResult.chaptersFound.join(', ') || 'לא זוהו פרקים'}
                        </li>
                      </ul>
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
                            {result.chunk.volumeType === 'teacher' ? ' מדריך למורה' : ' ספר תלמיד'})
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
                        <span>{type === 'student' ? 'ספר תלמיד' : type === 'teacher' ? 'מדריך למורה' : type}</span>
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
          </div>
        )}
      </div>
    </div>
  );
}
