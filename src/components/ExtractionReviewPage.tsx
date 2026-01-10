// ExtractionReviewPage.tsx - Review and correct PDF text extraction
// Allows admin to see original PDF pages alongside extracted text and make corrections

import React, { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
import { functions, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface ExtractionReviewPage {
  pageNumber: number;
  extractedText: string;
  verificationText?: string;
  confidence: 'high' | 'medium' | 'low';
  agreementScore: number;
  needsReview: boolean;
  correctedText?: string;
  correctedBy?: string;
}

interface ExtractionReview {
  id: string;
  documentId: string;
  fileName: string;
  storagePath: string;
  grade: string;
  volume: number;
  volumeType: 'student' | 'teacher';
  totalPages: number;
  averageConfidence: number;
  pagesNeedingReview: number[];
  status: 'pending_review' | 'reviewed' | 'approved';
  pages: ExtractionReviewPage[];
}

interface ReviewSummary {
  id: string;
  fileName: string;
  grade: string;
  volume: number;
  volumeType: string;
  totalPages: number;
  averageConfidence: number;
  pagesNeedingReview: number[];
  status: string;
}

export default function ExtractionReviewPage() {
  const { currentUser } = useAuth();

  // List state
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showPendingOnly, setShowPendingOnly] = useState(true);

  // Detail state
  const [selectedReview, setSelectedReview] = useState<ExtractionReview | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // PDF viewer state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Edit state
  const [editedText, setEditedText] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  // Error state
  const [loadError, setLoadError] = useState<string | null>(null);

  // PDF fix state
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Load reviews list
  const loadReviews = useCallback(async () => {
    setLoadingList(true);
    setLoadError(null);
    try {
      console.log('📋 Loading extraction reviews, pendingOnly:', showPendingOnly);
      const getReviewsFunc = httpsCallable(functions, 'getExtractionReviews');
      const result = await getReviewsFunc({ pendingOnly: showPendingOnly });
      console.log('📋 Raw result:', result);
      const data = result.data as { reviews: ReviewSummary[] };
      console.log('📋 Reviews loaded:', data.reviews?.length || 0);
      setReviews(data.reviews || []);
    } catch (error: any) {
      console.error('Failed to load reviews:', error);
      setLoadError(error.message || 'שגיאה לא ידועה');
    } finally {
      setLoadingList(false);
    }
  }, [showPendingOnly]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Load specific review
  const loadReview = async (reviewId: string) => {
    setLoadingReview(true);
    setSelectedReview(null);
    setPdfUrl(null);

    try {
      const getReviewFunc = httpsCallable(functions, 'getExtractionReview');
      const result = await getReviewFunc({ reviewId });
      const data = result.data as { review: ExtractionReview };

      setSelectedReview(data.review);
      setCurrentPageIndex(0);

      // Set initial edited text
      const firstPage = data.review.pages[0];
      setEditedText(firstPage.correctedText || firstPage.extractedText);

      // Load PDF URL
      if (data.review.storagePath) {
        try {
          const storageRef = ref(storage, data.review.storagePath);
          const url = await getDownloadURL(storageRef);
          setPdfUrl(url);
        } catch (e) {
          console.error('Failed to load PDF:', e);
        }
      }
    } catch (error: any) {
      console.error('Failed to load review:', error);
    } finally {
      setLoadingReview(false);
    }
  };

  // Navigate pages
  const goToPage = (index: number) => {
    if (!selectedReview) return;
    setCurrentPageIndex(index);
    const page = selectedReview.pages[index];
    setEditedText(page.correctedText || page.extractedText);
  };

  // Save correction
  const saveCorrection = async () => {
    if (!selectedReview) return;

    const currentPage = selectedReview.pages[currentPageIndex];
    if (editedText === (currentPage.correctedText || currentPage.extractedText)) {
      return; // No changes
    }

    setSaving(true);
    try {
      const correctFunc = httpsCallable(functions, 'correctPageExtraction');
      await correctFunc({
        reviewId: selectedReview.id,
        pageNumber: currentPage.pageNumber,
        correctedText: editedText,
      });

      // Update local state
      const updatedPages = [...selectedReview.pages];
      updatedPages[currentPageIndex] = {
        ...currentPage,
        correctedText: editedText,
        needsReview: false,
      };

      setSelectedReview({
        ...selectedReview,
        pages: updatedPages,
        pagesNeedingReview: updatedPages
          .filter(p => p.needsReview && !p.correctedText)
          .map(p => p.pageNumber),
      });

    } catch (error: any) {
      console.error('Failed to save correction:', error);
      alert('שגיאה בשמירה: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Approve review
  const approveReview = async () => {
    if (!selectedReview) return;

    if (!window.confirm('האם אתה בטוח? פעולה זו תעדכן את כל ה-chunks בבסיס הידע.')) {
      return;
    }

    setApproving(true);
    try {
      const approveFunc = httpsCallable(functions, 'approveExtractionReview');
      const result = await approveFunc({ reviewId: selectedReview.id });
      const data = result.data as { chunksUpdated: number };

      alert(`אושר בהצלחה! עודכנו ${data.chunksUpdated} קטעים.`);

      // Go back to list
      setSelectedReview(null);
      loadReviews();
    } catch (error: any) {
      console.error('Failed to approve:', error);
      alert('שגיאה באישור: ' + error.message);
    } finally {
      setApproving(false);
    }
  };

  // Upload PDF to fix broken path
  const handleUploadPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedReview || !currentUser) return;

    setUploadingPdf(true);
    try {
      // Upload to storage
      const timestamp = Date.now();
      const storagePath = `knowledge-base/${currentUser.uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);

      // Update review with new path
      const updateFunc = httpsCallable(functions, 'updateReviewStoragePath');
      await updateFunc({
        reviewId: selectedReview.id,
        storagePath,
      });

      // Reload PDF
      const url = await getDownloadURL(storageRef);
      setPdfUrl(url);

      alert('PDF הועלה בהצלחה!');
    } catch (error: any) {
      console.error('Failed to upload PDF:', error);
      alert('שגיאה בהעלאת PDF: ' + error.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Render list view
  if (!selectedReview) {
    return (
      <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">סקירת חילוץ טקסט</h1>
            <p className="text-gray-600">בדוק ותקן טקסט שחולץ מספרים</p>
          </div>

          {/* Filters */}
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showPendingOnly}
                onChange={(e) => setShowPendingOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">הצג רק ממתינים לסקירה</span>
            </label>
            <button
              onClick={loadReviews}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              רענן
            </button>
          </div>

          {/* Reviews List */}
          {loadingList ? (
            <div className="text-center py-8 text-gray-500">טוען...</div>
          ) : loadError ? (
            <div className="text-center py-8 text-red-600 bg-red-50 rounded-lg">
              <p className="font-medium">שגיאה בטעינת סקירות:</p>
              <p className="text-sm mt-2">{loadError}</p>
              <button
                onClick={loadReviews}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                נסה שוב
              </button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {showPendingOnly ? 'אין סקירות ממתינות' : 'אין סקירות'}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ספר</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">עמודים</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ודאות</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">לבדיקה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reviews.map((review) => (
                    <tr key={review.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {review.volumeType === 'teacher' ? 'מדריך למורה' : 'ספר תלמיד'}
                        </div>
                        <div className="text-sm text-gray-500">
                          כיתה {review.grade}' כרך {review.volume}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {review.totalPages}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                review.averageConfidence >= 0.9 ? 'bg-green-500' :
                                review.averageConfidence >= 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${review.averageConfidence * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">
                            {(review.averageConfidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {review.pagesNeedingReview.length > 0 ? (
                          <span className="text-sm text-red-600 font-medium">
                            {review.pagesNeedingReview.length} עמודים
                          </span>
                        ) : (
                          <span className="text-sm text-green-600">תקין</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          review.status === 'approved' ? 'bg-green-100 text-green-800' :
                          review.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {review.status === 'approved' ? 'אושר' :
                           review.status === 'reviewed' ? 'נבדק' : 'ממתין'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => loadReview(review.id)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          פתח
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render review detail view
  const currentPage = selectedReview.pages[currentPageIndex];

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedReview(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ← חזרה
            </button>
            <div>
              <h1 className="text-lg font-bold">
                {selectedReview.volumeType === 'teacher' ? 'מדריך למורה' : 'ספר תלמיד'} -
                כיתה {selectedReview.grade}' כרך {selectedReview.volume}
              </h1>
              <p className="text-sm text-gray-500">{selectedReview.fileName}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              ודאות ממוצעת: {(selectedReview.averageConfidence * 100).toFixed(1)}%
            </span>
            <button
              onClick={approveReview}
              disabled={approving}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {approving ? 'מאשר...' : 'אשר ועדכן chunks'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* PDF Viewer (Left side) */}
        <div className="w-1/2 bg-gray-800 p-4 overflow-auto">
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#page=${currentPage.pageNumber}`}
              className="w-full h-full bg-white rounded"
              title="PDF Viewer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
              <p>לא ניתן לטעון PDF</p>
              <p className="text-sm">קובץ ה-PDF לא נמצא. ניתן להעלות את הקובץ:</p>
              <label className={`px-4 py-2 rounded-md cursor-pointer ${
                uploadingPdf
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
                {uploadingPdf ? 'מעלה...' : '📁 העלה PDF'}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleUploadPdf}
                  disabled={uploadingPdf}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Text Editor (Right side) */}
        <div className="w-1/2 flex flex-col">
          {/* Page navigation */}
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPageIndex - 1)}
                disabled={currentPageIndex === 0}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                ← הקודם
              </button>

              <span className="px-4 font-medium">
                עמוד {currentPage.pageNumber} מתוך {selectedReview.totalPages}
              </span>

              <button
                onClick={() => goToPage(currentPageIndex + 1)}
                disabled={currentPageIndex === selectedReview.pages.length - 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                הבא →
              </button>
            </div>

            <div className="flex items-center gap-4">
              <span className={`px-2 py-1 text-xs rounded ${getConfidenceColor(currentPage.confidence)}`}>
                {currentPage.confidence === 'high' ? 'ודאות גבוהה' :
                 currentPage.confidence === 'medium' ? 'ודאות בינונית' : 'ודאות נמוכה'}
                ({(currentPage.agreementScore * 100).toFixed(0)}%)
              </span>

              {currentPage.correctedText && (
                <span className="text-xs text-green-600">✓ תוקן</span>
              )}

              {currentPage.needsReview && !currentPage.correctedText && (
                <span className="text-xs text-red-600">⚠️ דורש בדיקה</span>
              )}
            </div>
          </div>

          {/* Page thumbnails */}
          <div className="bg-gray-100 px-4 py-2 overflow-x-auto flex gap-2">
            {selectedReview.pages.map((page, idx) => (
              <button
                key={page.pageNumber}
                onClick={() => goToPage(idx)}
                className={`flex-shrink-0 w-10 h-10 rounded text-xs font-medium ${
                  idx === currentPageIndex
                    ? 'bg-blue-600 text-white'
                    : page.correctedText
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : page.needsReview
                    ? 'bg-red-100 text-red-800 border border-red-300'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {page.pageNumber}
              </button>
            ))}
          </div>

          {/* Text editor */}
          <div className="flex-1 p-4 overflow-auto">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full h-full p-4 border rounded-lg resize-none font-mono text-sm leading-relaxed"
              placeholder="טקסט מחולץ..."
              dir="rtl"
            />
          </div>

          {/* Save button */}
          <div className="bg-white border-t px-4 py-3 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {editedText !== (currentPage.correctedText || currentPage.extractedText)
                ? 'יש שינויים שלא נשמרו'
                : ''}
            </div>
            <button
              onClick={saveCorrection}
              disabled={saving || editedText === (currentPage.correctedText || currentPage.extractedText)}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'שומר...' : 'שמור תיקון'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
