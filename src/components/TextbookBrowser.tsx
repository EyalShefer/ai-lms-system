// TextbookBrowser.tsx - Full textbook browser for selecting content

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  FileText,
  Users,
  Loader2,
  X,
  Filter,
} from 'lucide-react';
import {
  getTextbooks,
  getTextbookDetails,
  searchWithinTextbook,
  getSubjectHebrew,
  TextbookListItem,
  Textbook,
  TocEntry,
  TextbookSelection,
  buildTextbookSelection,
} from '../services/textbookService';

interface TextbookBrowserProps {
  onSelectContent: (selection: TextbookSelection) => void;
  onCancel?: () => void;
  subject?: string;
  grade?: string;
  mode?: 'browse' | 'select';
  initialTextbookId?: string;
}

export default function TextbookBrowser({
  onSelectContent,
  onCancel,
  subject,
  grade,
  mode = 'select',
  initialTextbookId,
}: TextbookBrowserProps) {
  // State
  const [textbooks, setTextbooks] = useState<TextbookListItem[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [selectedTocIds, setSelectedTocIds] = useState<Set<string>>(new Set());
  const [expandedTocIds, setExpandedTocIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [gradeFilter, setGradeFilter] = useState(grade || '');
  const [alignmentLevel, setAlignmentLevel] = useState<'flexible' | 'strict'>('flexible');
  const [previewContent, setPreviewContent] = useState<string>('');

  // Load textbooks on mount
  useEffect(() => {
    loadTextbooks();
  }, [subject, gradeFilter]);

  // Load initial textbook if provided
  useEffect(() => {
    if (initialTextbookId && !selectedTextbook) {
      loadTextbookDetails(initialTextbookId);
    }
  }, [initialTextbookId]);

  const loadTextbooks = async () => {
    setLoading(true);
    try {
      const books = await getTextbooks({
        subject,
        grade: gradeFilter || undefined,
      });
      setTextbooks(books);
    } catch (error) {
      console.error('Failed to load textbooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTextbookDetails = async (textbookId: string) => {
    setLoadingDetails(true);
    try {
      const details = await getTextbookDetails(textbookId);
      if (details) {
        setSelectedTextbook(details);
        // Expand first level by default
        const firstLevelIds = new Set(details.tableOfContents.map(e => e.id));
        setExpandedTocIds(firstLevelIds);
      }
    } catch (error) {
      console.error('Failed to load textbook details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTextbookSelect = (textbook: TextbookListItem) => {
    loadTextbookDetails(textbook.id);
    setSelectedTocIds(new Set());
    setPreviewContent('');
  };

  const handleTocToggle = (entry: TocEntry) => {
    const newExpanded = new Set(expandedTocIds);
    if (newExpanded.has(entry.id)) {
      newExpanded.delete(entry.id);
    } else {
      newExpanded.add(entry.id);
    }
    setExpandedTocIds(newExpanded);
  };

  const handleTocSelect = (entry: TocEntry, checked: boolean) => {
    const newSelected = new Set(selectedTocIds);

    const toggleEntry = (e: TocEntry, select: boolean) => {
      if (select) {
        newSelected.add(e.id);
      } else {
        newSelected.delete(e.id);
      }
      // Also toggle children
      if (e.children) {
        e.children.forEach(child => toggleEntry(child, select));
      }
    };

    toggleEntry(entry, checked);
    setSelectedTocIds(newSelected);

    // Update preview
    if (checked && entry.summary) {
      setPreviewContent(prev => prev + '\n\n' + entry.summary);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedTextbook) return;

    setSearching(true);
    try {
      const results = await searchWithinTextbook(
        selectedTextbook.id,
        searchQuery,
        { limit: 10 }
      );
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmSelection = () => {
    if (!selectedTextbook || selectedTocIds.size === 0) return;

    const selection = buildTextbookSelection(
      selectedTextbook,
      Array.from(selectedTocIds),
      alignmentLevel
    );

    onSelectContent(selection);
  };

  const renderTocEntry = (entry: TocEntry, depth: number = 0) => {
    const isExpanded = expandedTocIds.has(entry.id);
    const isSelected = selectedTocIds.has(entry.id);
    const hasChildren = entry.children && entry.children.length > 0;

    return (
      <div key={entry.id} style={{ paddingRight: depth * 16 }}>
        <div
          className={`flex items-center py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
            isSelected ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
          }`}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={() => handleTocToggle(entry)}
              className="p-1 hover:bg-gray-200 rounded ml-2"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-6 ml-2" />
          )}

          {/* Checkbox */}
          <label className="flex items-center flex-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleTocSelect(entry, e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
            />
            <span className="mr-3 text-sm text-gray-700">{entry.title}</span>
          </label>

          {/* Page info */}
          {entry.pageStart && (
            <span className="text-xs text-gray-400">
              עמ' {entry.pageStart}
              {entry.pageEnd ? `-${entry.pageEnd}` : ''}
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-r border-gray-200 mr-4">
            {entry.children!.map(child => renderTocEntry(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const gradeOptions = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-l from-indigo-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">בחירת תוכן מספר הלימוד</h2>
            <p className="text-sm text-gray-500">בחר ספר ופרקים ליצירת תוכן מותאם</p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Textbook List */}
        <div className="w-1/3 border-l overflow-y-auto bg-gray-50">
          {/* Grade Filter */}
          <div className="p-3 border-b bg-white sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="flex-1 text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">כל הכיתות</option>
                {gradeOptions.map(g => (
                  <option key={g} value={g}>כיתה {g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Textbook Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : textbooks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>לא נמצאו ספרים</p>
              <p className="text-sm mt-1">העלה ספרים דרך מאגר הידע</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {textbooks.map(book => (
                <div
                  key={book.id}
                  onClick={() => handleTextbookSelect(book)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    selectedTextbook?.id === book.id
                      ? 'bg-white shadow-md border-2 border-indigo-500'
                      : 'bg-white hover:shadow-sm border border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Cover placeholder */}
                    <div className={`w-12 h-16 rounded-lg flex items-center justify-center ${
                      book.volumeType === 'teacher'
                        ? 'bg-amber-100'
                        : 'bg-indigo-100'
                    }`}>
                      {book.volumeType === 'teacher' ? (
                        <Users className="w-6 h-6 text-amber-600" />
                      ) : (
                        <BookOpen className="w-6 h-6 text-indigo-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 text-sm truncate">
                        {getSubjectHebrew(book.subject)} כיתה {book.grade}
                      </h3>
                      <p className="text-xs text-gray-500">
                        כרך {book.volume} - {book.volumeType === 'teacher' ? 'מדריך למורה' : 'ספר תלמיד'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                          {book.chaptersCount} פרקים
                        </span>
                        <span className="text-xs text-gray-400">
                          {book.totalPages} עמ'
                        </span>
                      </div>
                    </div>

                    {selectedTextbook?.id === book.id && (
                      <Check className="w-5 h-5 text-indigo-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - ToC & Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedTextbook ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                <p>בחר ספר מהרשימה</p>
              </div>
            </div>
          ) : loadingDetails ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="p-3 border-b bg-white">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="חיפוש בספר..."
                      className="w-full pr-10 pl-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {searching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'חפש'
                    )}
                  </button>
                </div>
              </div>

              {/* ToC */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-700">תוכן העניינים</h3>
                  <span className="text-sm text-indigo-600">
                    {selectedTocIds.size} נבחרו
                  </span>
                </div>

                {selectedTextbook.tableOfContents.map(entry => renderTocEntry(entry))}
              </div>

              {/* Alignment Options */}
              <div className="p-3 border-t bg-gray-50">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  רמת התאמה לספר:
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAlignmentLevel('flexible')}
                    className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                      alignmentLevel === 'flexible'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    גמיש
                    <span className="block text-xs text-gray-500 mt-0.5">
                      הספר כהשראה
                    </span>
                  </button>
                  <button
                    onClick={() => setAlignmentLevel('strict')}
                    className={`flex-1 py-2 px-3 text-sm rounded-lg border transition-colors ${
                      alignmentLevel === 'strict'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    צמוד
                    <span className="block text-xs text-gray-500 mt-0.5">
                      רק תוכן מהספר
                    </span>
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-4 border-t bg-white">
                <button
                  onClick={handleConfirmSelection}
                  disabled={selectedTocIds.size === 0}
                  className="w-full py-3 bg-gradient-to-l from-indigo-600 to-indigo-500 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                  {selectedTocIds.size === 0
                    ? 'בחר לפחות פרק אחד'
                    : `צור תוכן מ-${selectedTocIds.size} פרקים`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
