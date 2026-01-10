// textbookService.ts - Client-side service for Textbook Management
// Types and functions for textbook integration

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// ============================================
// TYPES
// ============================================

export interface TocEntry {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  pageStart: number;
  pageEnd?: number;
  chunkIds: string[];
  children?: TocEntry[];
  keywords: string[];
  summary?: string;
}

export interface Textbook {
  id: string;
  title: string;
  subject: 'math' | 'hebrew' | 'english' | 'science' | 'history' | 'other';
  grade: string;
  volume: number;
  volumeType: 'student' | 'teacher';
  publisher?: string;
  coverImageUrl?: string;
  tableOfContents: TocEntry[];
  documentId: string;
  totalChunks: number;
  totalPages: number;
  uploadedBy: string;
  uploadedAt: any;
  isPublic: boolean;
  usageCount: number;
  chaptersCount?: number; // Added in list view
}

export interface TextbookListItem extends Omit<Textbook, 'tableOfContents'> {
  chaptersCount: number;
}

export interface KnowledgeChunk {
  id: string;
  grade: string;
  volume: number;
  volumeType: 'student' | 'teacher';
  chapter: string;
  content: string;
  contentType: string;
  source: string;
  keywords: string[];
  pageNumber?: number;
}

export interface TextbookSearchResult {
  chunk: KnowledgeChunk;
  similarity: number;
}

export interface TextbookContextResponse {
  context: string;
  sources: {
    chunkId: string;
    page: number;
    chapter: string;
    contentType: string;
  }[];
  textbookTitle: string;
  selectedChapters: string[];
}

export interface TextbookSelection {
  textbookId: string;
  textbookTitle: string;
  grade: string;
  selectedTocEntries: {
    id: string;
    title: string;
    pageRange?: string;
  }[];
  alignmentLevel: 'flexible' | 'strict';
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get list of available textbooks
 */
export async function getTextbooks(filters?: {
  subject?: string;
  grade?: string;
  volumeType?: 'student' | 'teacher';
}): Promise<TextbookListItem[]> {
  try {
    const getTextbooksFunc = httpsCallable(functions, 'getTextbooks');
    const result = await getTextbooksFunc(filters || {});
    const data = result.data as { textbooks: TextbookListItem[] };
    console.log(`📚 Fetched ${data.textbooks.length} textbooks`);
    return data.textbooks;
  } catch (error) {
    console.error('Failed to get textbooks:', error);
    return [];
  }
}

/**
 * Get full textbook details including table of contents
 */
export async function getTextbookDetails(textbookId: string): Promise<Textbook | null> {
  try {
    const getDetailsFunc = httpsCallable(functions, 'getTextbookDetails');
    const result = await getDetailsFunc({ textbookId });
    const data = result.data as { textbook: Textbook };
    console.log(`📚 Fetched textbook details: ${data.textbook.title}`);
    return data.textbook;
  } catch (error) {
    console.error('Failed to get textbook details:', error);
    return null;
  }
}

/**
 * Get content for a specific chapter/section
 */
export async function getChapterContent(
  textbookId: string,
  tocEntryId: string,
  options?: {
    includeChildren?: boolean;
    contentTypes?: string[];
  }
): Promise<KnowledgeChunk[]> {
  try {
    const getContentFunc = httpsCallable(functions, 'getChapterContent');
    const result = await getContentFunc({
      textbookId,
      tocEntryId,
      ...options,
    });
    const data = result.data as { chunks: KnowledgeChunk[] };
    console.log(`📚 Fetched ${data.chunks.length} chunks for chapter`);
    return data.chunks;
  } catch (error) {
    console.error('Failed to get chapter content:', error);
    return [];
  }
}

/**
 * Semantic search within a specific textbook
 */
export async function searchWithinTextbook(
  textbookId: string,
  query: string,
  options?: {
    tocEntryIds?: string[];
    contentTypes?: string[];
    limit?: number;
  }
): Promise<TextbookSearchResult[]> {
  try {
    const searchFunc = httpsCallable(functions, 'searchWithinTextbook');
    const result = await searchFunc({
      textbookId,
      query,
      ...options,
    });
    const data = result.data as { results: TextbookSearchResult[] };
    console.log(`🔍 Found ${data.results.length} results in textbook`);
    return data.results;
  } catch (error) {
    console.error('Failed to search within textbook:', error);
    return [];
  }
}

/**
 * Get textbook-aligned context for AI generation
 */
export async function getTextbookContext(
  textbookId: string,
  tocEntryIds: string[],
  options?: {
    topic?: string;
    includeTeacherGuide?: boolean;
    prioritizeExamples?: boolean;
    prioritizeExercises?: boolean;
    maxChunks?: number;
  }
): Promise<TextbookContextResponse | null> {
  try {
    const getContextFunc = httpsCallable(functions, 'getTextbookContext');
    const result = await getContextFunc({
      textbookId,
      tocEntryIds,
      ...options,
    });
    const data = result.data as TextbookContextResponse;
    console.log(`📚 Got textbook context: ${data.sources.length} sources`);
    return data;
  } catch (error) {
    console.error('Failed to get textbook context:', error);
    return null;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get Hebrew subject name
 */
export function getSubjectHebrew(subject: string): string {
  const subjects: Record<string, string> = {
    math: 'מתמטיקה',
    hebrew: 'עברית',
    english: 'אנגלית',
    science: 'מדעים',
    history: 'היסטוריה',
    other: 'כללי',
  };
  return subjects[subject] || subject;
}

/**
 * Get Hebrew content type name
 */
export function getContentTypeHebrew(contentType: string): string {
  const types: Record<string, string> = {
    explanation: 'הסבר',
    example: 'דוגמה',
    exercise: 'תרגיל',
    solution: 'פתרון',
    tip: 'טיפ',
    common_mistake: 'טעות נפוצה',
    definition: 'הגדרה',
    rule: 'כלל',
    summary: 'סיכום',
  };
  return types[contentType] || contentType;
}

/**
 * Flatten ToC tree to array
 */
export function flattenToc(toc: TocEntry[]): TocEntry[] {
  const flat: TocEntry[] = [];

  const processEntry = (entry: TocEntry) => {
    flat.push(entry);
    if (entry.children) {
      entry.children.forEach(processEntry);
    }
  };

  toc.forEach(processEntry);
  return flat;
}

/**
 * Find ToC entry by ID
 */
export function findTocEntry(toc: TocEntry[], id: string): TocEntry | null {
  for (const entry of toc) {
    if (entry.id === id) return entry;
    if (entry.children) {
      const found = findTocEntry(entry.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get all parent entries for a ToC entry
 */
export function getTocPath(toc: TocEntry[], targetId: string): TocEntry[] {
  const path: TocEntry[] = [];

  const findPath = (entries: TocEntry[], currentPath: TocEntry[]): boolean => {
    for (const entry of entries) {
      const newPath = [...currentPath, entry];
      if (entry.id === targetId) {
        path.push(...newPath);
        return true;
      }
      if (entry.children && findPath(entry.children, newPath)) {
        return true;
      }
    }
    return false;
  };

  findPath(toc, []);
  return path;
}

/**
 * Build textbook selection object for generation
 */
export function buildTextbookSelection(
  textbook: Textbook,
  selectedTocIds: string[],
  alignmentLevel: 'flexible' | 'strict' = 'flexible'
): TextbookSelection {
  const selectedEntries = selectedTocIds
    .map(id => findTocEntry(textbook.tableOfContents, id))
    .filter((entry): entry is TocEntry => entry !== null)
    .map(entry => ({
      id: entry.id,
      title: entry.title,
      pageRange: entry.pageEnd
        ? `עמ' ${entry.pageStart}-${entry.pageEnd}`
        : `עמ' ${entry.pageStart}`,
    }));

  return {
    textbookId: textbook.id,
    textbookTitle: textbook.title,
    grade: textbook.grade,
    selectedTocEntries: selectedEntries,
    alignmentLevel,
  };
}

/**
 * Format textbook selection for display
 */
export function formatTextbookSelectionSummary(selection: TextbookSelection): string {
  const chaptersText = selection.selectedTocEntries
    .map(e => e.title)
    .join(', ');

  return `${selection.textbookTitle} | ${chaptersText}`;
}

/**
 * Check if textbooks are available for a grade/subject
 */
export async function hasTextbooksFor(
  grade: string,
  subject?: string
): Promise<boolean> {
  const textbooks = await getTextbooks({
    grade,
    subject,
  });
  return textbooks.length > 0;
}

/**
 * Get textbooks grouped by grade
 */
export async function getTextbooksByGrade(): Promise<Record<string, TextbookListItem[]>> {
  const textbooks = await getTextbooks();
  const grouped: Record<string, TextbookListItem[]> = {};

  for (const textbook of textbooks) {
    if (!grouped[textbook.grade]) {
      grouped[textbook.grade] = [];
    }
    grouped[textbook.grade].push(textbook);
  }

  // Sort grades
  const gradeOrder = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];
  const sortedGrouped: Record<string, TextbookListItem[]> = {};

  for (const grade of gradeOrder) {
    if (grouped[grade]) {
      sortedGrouped[grade] = grouped[grade];
    }
  }

  return sortedGrouped;
}
