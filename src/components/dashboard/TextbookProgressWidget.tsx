// TextbookProgressWidget.tsx - Dashboard widget showing textbook coverage progress

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ChevronRight,
  TrendingUp,
  Users,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  getTextbooks,
  TextbookListItem,
  getSubjectHebrew,
} from '../../services/textbookService';

interface TextbookProgressWidgetProps {
  onSelectTextbook?: (textbookId: string) => void;
  onCreateFromTextbook?: (textbookId: string) => void;
  grade?: string;
  compact?: boolean;
}

interface TextbookWithProgress extends TextbookListItem {
  coveredChapters: number;
  coveragePercent: number;
}

export default function TextbookProgressWidget({
  onSelectTextbook,
  onCreateFromTextbook,
  grade,
  compact = false,
}: TextbookProgressWidgetProps) {
  const [textbooks, setTextbooks] = useState<TextbookWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTextbooks();
  }, [grade]);

  const loadTextbooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const books = await getTextbooks({ grade });

      // For now, simulate coverage data - in production this would come from analytics
      const booksWithProgress: TextbookWithProgress[] = books.map(book => ({
        ...book,
        coveredChapters: Math.floor(Math.random() * book.chaptersCount),
        coveragePercent: Math.floor(Math.random() * 100),
      }));

      setTextbooks(booksWithProgress);
    } catch (err) {
      console.error('Failed to load textbooks:', err);
      setError('שגיאה בטעינת הספרים');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" dir="rtl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" dir="rtl">
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (textbooks.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="font-bold text-lg text-slate-800">ספרי הלימוד שלי</h3>
        </div>
        <div className="text-center py-6 text-slate-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>עוד לא הועלו ספרי לימוד</p>
          <p className="text-sm mt-1">העלה ספר דרך מאגר הידע כדי להתחיל</p>
        </div>
      </div>
    );
  }

  // Compact mode - just show summary
  if (compact) {
    const primaryBook = textbooks[0];
    return (
      <div
        className="bg-gradient-to-l from-indigo-50 to-white rounded-2xl p-4 border border-indigo-100 shadow-sm cursor-pointer hover:shadow-md transition-all"
        onClick={() => onSelectTextbook?.(primaryBook.id)}
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800">
                {getSubjectHebrew(primaryBook.subject)} כיתה {primaryBook.grade}
              </h4>
              <p className="text-sm text-slate-500">
                כרך {primaryBook.volume}
              </p>
            </div>
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold text-indigo-600">
              {primaryBook.coveragePercent}%
            </div>
            <p className="text-xs text-slate-400">כיסוי</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-indigo-500 to-indigo-400 transition-all duration-500"
            style={{ width: `${primaryBook.coveragePercent}%` }}
          />
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800">ספרי הלימוד שלי</h3>
            <p className="text-sm text-slate-500">{textbooks.length} ספרים זמינים</p>
          </div>
        </div>
        <TrendingUp className="w-5 h-5 text-green-500" />
      </div>

      {/* Textbook Cards */}
      <div className="space-y-4">
        {textbooks.slice(0, 3).map(book => (
          <div
            key={book.id}
            className="group p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer"
            onClick={() => onSelectTextbook?.(book.id)}
          >
            <div className="flex items-start gap-4">
              {/* Book Icon */}
              <div className={`w-12 h-16 rounded-lg flex items-center justify-center shrink-0 ${
                book.volumeType === 'teacher' ? 'bg-amber-100' : 'bg-indigo-100'
              }`}>
                {book.volumeType === 'teacher' ? (
                  <Users className="w-6 h-6 text-amber-600" />
                ) : (
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 truncate">
                    {getSubjectHebrew(book.subject)} כיתה {book.grade}
                  </h4>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>

                <p className="text-sm text-slate-500 mt-0.5">
                  כרך {book.volume} - {book.volumeType === 'teacher' ? 'מדריך למורה' : 'ספר תלמיד'}
                </p>

                {/* Progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">
                      {book.coveredChapters}/{book.chaptersCount} פרקים
                    </span>
                    <span className="font-bold text-indigo-600">{book.coveragePercent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-l from-indigo-500 to-indigo-400 transition-all duration-500"
                      style={{ width: `${book.coveragePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action */}
            {book.coveragePercent < 100 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFromTextbook?.(book.id);
                }}
                className="mt-3 w-full py-2 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
              >
                <Sparkles className="w-4 h-4" />
                צור פעילות לפרק הבא
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Show more link */}
      {textbooks.length > 3 && (
        <button className="mt-4 w-full py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
          הצג את כל הספרים ({textbooks.length})
        </button>
      )}
    </div>
  );
}
