// TextbookSelector.tsx - Compact textbook selector for IngestionWizard

import { useState, useEffect } from 'react';
import {
  IconBook as BookOpen,
  IconChevronDown as ChevronDown,
  IconUser as Users,
  IconLoader as Loader2,
  IconX as X,
  IconSparkles as Sparkles,
} from '../icons';
import {
  getTextbooks,
  getTextbookDetails,
  getSubjectHebrew,
  buildTextbookSelection,
} from '../services/textbookService';
import type {
  TextbookListItem,
  Textbook,
  TocEntry,
  TextbookSelection,
} from '../services/textbookService';

interface TextbookSelectorProps {
  onSelect: (selection: TextbookSelection) => void;
  onClear?: () => void;
  subject?: string;
  grade?: string;
  compact?: boolean;
  selectedValue?: TextbookSelection | null;
}

export default function TextbookSelector({
  onSelect,
  onClear,
  subject,
  grade,
  compact = true,
  selectedValue,
}: TextbookSelectorProps) {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [textbooks, setTextbooks] = useState<TextbookListItem[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [selectedTocIds, setSelectedTocIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [alignmentLevel, setAlignmentLevel] = useState<'flexible' | 'strict'>('flexible');
  const [step, setStep] = useState<'books' | 'chapters'>('books');

  // Load textbooks when opening
  useEffect(() => {
    if (isOpen && textbooks.length === 0) {
      loadTextbooks();
    }
  }, [isOpen]);

  const loadTextbooks = async () => {
    setLoading(true);
    console.log('📚 Loading textbooks with filters:', { subject, grade });
    try {
      const books = await getTextbooks({
        subject,
        grade,
      });
      console.log('📚 Loaded textbooks:', books.length, books);
      setTextbooks(books);
    } catch (error) {
      console.error('❌ Failed to load textbooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextbookSelect = async (book: TextbookListItem) => {
    setLoadingDetails(true);
    try {
      const details = await getTextbookDetails(book.id);
      if (details) {
        setSelectedTextbook(details);
        setStep('chapters');
        // Pre-select first chapter by default
        if (details.tableOfContents.length > 0) {
          setSelectedTocIds(new Set([details.tableOfContents[0].id]));
        }
      }
    } catch (error) {
      console.error('Failed to load textbook:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTocToggle = (entryId: string) => {
    const newSelected = new Set(selectedTocIds);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedTocIds(newSelected);
  };

  const handleConfirm = () => {
    if (!selectedTextbook || selectedTocIds.size === 0) return;

    const selection = buildTextbookSelection(
      selectedTextbook,
      Array.from(selectedTocIds),
      alignmentLevel
    );

    onSelect(selection);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedTextbook(null);
    setSelectedTocIds(new Set());
    setStep('books');
    onClear?.();
  };

  const renderTocList = () => {
    if (!selectedTextbook) return null;

    const renderEntry = (entry: TocEntry, depth: number = 0) => {
      const isSelected = selectedTocIds.has(entry.id);

      return (
        <div key={entry.id}>
          <label
            className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
              isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
            }`}
            style={{ paddingRight: 12 + depth * 16 }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleTocToggle(entry.id)}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <span className={`text-sm ${entry.level === 1 ? 'font-medium' : ''}`}>
              {entry.title}
            </span>
            {entry.pageStart && (
              <span className="text-xs text-gray-400 mr-auto">
                עמ' {entry.pageStart}
              </span>
            )}
          </label>
          {entry.children?.map(child => renderEntry(child, depth + 1))}
        </div>
      );
    };

    return (
      <div className="max-h-60 overflow-y-auto">
        {selectedTextbook.tableOfContents.map(entry => renderEntry(entry))}
      </div>
    );
  };

  // If already selected, show summary
  if (selectedValue && !isOpen) {
    return (
      <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-indigo-900">{selectedValue.textbookTitle}</p>
              <p className="text-sm text-indigo-600">
                {selectedValue.selectedTocEntries.length} פרקים נבחרו
                {' · '}
                {selectedValue.alignmentLevel === 'strict' ? 'צמוד לספר' : 'גמיש'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              ערוך
            </button>
            <button
              onClick={handleClear}
              className="p-1 hover:bg-indigo-100 rounded-lg"
            >
              <X className="w-4 h-4 text-indigo-500" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" dir="rtl">
      {/* Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
        >
          <div className="flex items-center justify-center gap-3 text-gray-500 group-hover:text-indigo-600">
            <BookOpen className="w-6 h-6" />
            <span className="font-medium">בחר מספר הלימוד</span>
            <Sparkles className="w-4 h-4" />
          </div>
        </button>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="border border-gray-200 rounded-xl bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span className="font-medium text-gray-700">
                {step === 'books' ? 'בחר ספר' : 'בחר פרקים'}
              </span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                if (!selectedValue) handleClear();
              }}
              className="p-1 hover:bg-gray-200 rounded-lg"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3">
            {step === 'books' ? (
              // Book Selection
              loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : textbooks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">לא נמצאו ספרים</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {textbooks.map(book => (
                    <button
                      key={book.id}
                      onClick={() => handleTextbookSelect(book)}
                      disabled={loadingDetails}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-right"
                    >
                      <div className={`p-2 rounded-lg ${
                        book.volumeType === 'teacher' ? 'bg-amber-100' : 'bg-indigo-100'
                      }`}>
                        {book.volumeType === 'teacher' ? (
                          <Users className="w-4 h-4 text-amber-600" />
                        ) : (
                          <BookOpen className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-800">
                          {getSubjectHebrew(book.subject)} כיתה {book.grade}
                        </p>
                        <p className="text-xs text-gray-500">
                          כרך {book.volume} · {book.chaptersCount} פרקים
                        </p>
                      </div>
                      {loadingDetails ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
                      )}
                    </button>
                  ))}
                </div>
              )
            ) : (
              // Chapter Selection
              <>
                {/* Selected book header */}
                <button
                  onClick={() => setStep('books')}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 mb-3"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                  {selectedTextbook?.title}
                </button>

                {/* Chapter list */}
                {renderTocList()}

                {/* Alignment toggle */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">רמת התאמה:</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAlignmentLevel('flexible')}
                      className={`flex-1 py-1.5 px-2 text-xs rounded-lg border ${
                        alignmentLevel === 'flexible'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      גמיש
                    </button>
                    <button
                      onClick={() => setAlignmentLevel('strict')}
                      className={`flex-1 py-1.5 px-2 text-xs rounded-lg border ${
                        alignmentLevel === 'strict'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      צמוד לספר
                    </button>
                  </div>
                </div>

                {/* Confirm button */}
                <button
                  onClick={handleConfirm}
                  disabled={selectedTocIds.size === 0}
                  className="w-full mt-3 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {selectedTocIds.size === 0
                    ? 'בחר לפחות פרק אחד'
                    : `אשר בחירה (${selectedTocIds.size} פרקים)`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
