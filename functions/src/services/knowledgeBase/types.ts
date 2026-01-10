// types.ts - Knowledge Base Types for Math RAG System

// ============================================
// Textbook Types - For Textbook-Aligned Content Generation
// ============================================

/**
 * Represents a textbook in the knowledge base
 * Enables teachers to browse, select chapters, and generate aligned content
 */
export interface Textbook {
  id: string;
  title: string;                    // "מתמטיקה לכיתה ב׳ כרך 1"
  subject: 'math' | 'hebrew' | 'english' | 'science' | 'history' | 'other';
  grade: 'א' | 'ב' | 'ג' | 'ד' | 'ה' | 'ו' | 'ז' | 'ח' | 'ט' | 'י' | 'יא' | 'יב';
  volume: number;
  volumeType: 'student' | 'teacher';
  publisher?: string;               // "מטח" / "יעל"
  coverImageUrl?: string;           // Thumbnail from first page

  // Hierarchical structure extracted from PDF
  tableOfContents: TocEntry[];

  // Links to math_knowledge chunks
  documentId: string;               // Links to original upload
  totalChunks: number;
  totalPages: number;

  // Metadata
  uploadedBy: string;               // teacherId who uploaded
  uploadedAt: FirebaseFirestore.Timestamp;
  isPublic: boolean;                // Visible to all teachers (always true per design)
  usageCount: number;
}

/**
 * Table of Contents entry for textbook browsing
 * Supports 3 levels: פרק > נושא > תת-נושא
 */
export interface TocEntry {
  id: string;
  level: 1 | 2 | 3;                 // 1 = פרק, 2 = נושא, 3 = תת-נושא
  title: string;                    // "פרק א׳: חיבור עד 100"
  pageStart: number;
  pageEnd?: number;
  chunkIds: string[];               // Links to math_knowledge chunk IDs
  children?: TocEntry[];

  // For topic search within chapter
  keywords: string[];
  summary?: string;                 // AI-generated summary of this section
}

/**
 * Request parameters for textbook-aligned content generation
 */
export interface TextbookAlignment {
  textbookId: string;
  selectedTocEntryIds: string[];
  alignmentLevel: 'flexible' | 'strict';  // flexible = inspiration, strict = only textbook content
  useTextbookStyle: boolean;              // Mimic pedagogical style
  includeTextbookExercises: boolean;      // Adapt exercises from book
}

/**
 * Response for textbook context retrieval
 */
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

// ============================================
// Knowledge Chunk Types
// ============================================

export interface KnowledgeChunk {
  id: string;

  // Location in curriculum
  subject: 'math' | 'hebrew' | 'english' | 'science' | 'history' | 'other';
  grade: 'א' | 'ב' | 'ג' | 'ד' | 'ה' | 'ו' | 'ז' | 'ח' | 'ט' | 'י' | 'יא' | 'יב';
  volume: number;  // כרך (1, 2, 3, 4...)
  volumeType: 'student' | 'teacher';  // ספר תלמיד או מדריך למורה

  // Location in book
  chapter: string;  // שם הפרק
  chapterNumber?: number;
  unitReference?: string;  // אם זה מדריך למורה - התייחסות ליחידה בספר תלמיד
  pageRange?: string;  // "עמ' 45-52"

  // Content
  content: string;  // הטקסט עצמו
  contentType: 'explanation' | 'example' | 'exercise' | 'solution' | 'tip' | 'common_mistake' | 'definition' | 'rule' | 'summary';

  // Vector embedding
  embedding: number[];  // 1536 dimensions for OpenAI text-embedding-3-small

  // Metadata
  source: string;  // שם הקובץ המקורי
  sourceType: 'pdf' | 'docx' | 'manual';
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;

  // Quality & Usage
  quality?: number;  // 1-5 rating
  usageCount: number;  // כמה פעמים נשלף
  lastUsedAt?: FirebaseFirestore.Timestamp;

  // Search optimization
  keywords: string[];  // מילות מפתח לחיפוש
  relatedTopics: string[];  // נושאים קשורים

  // Textbook linking (for textbook-aligned generation)
  textbookId?: string;      // Link back to parent textbook
  tocEntryId?: string;      // Link to specific ToC entry
  pageNumber?: number;      // Specific page number (not range)
}

export interface KnowledgeUploadRequest {
  // Option 1: Direct base64 (for small files)
  fileBase64?: string;
  // Option 2: Storage URL (for large files - recommended)
  fileUrl?: string;
  storagePath?: string;

  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  fileName: string;

  // Metadata from admin
  subject: KnowledgeChunk['subject'];
  grade: KnowledgeChunk['grade'];
  volume: number;
  volumeType: 'student' | 'teacher';

  // Optional overrides
  chapterOverrides?: {
    [chapterName: string]: {
      unitReference?: string;
      contentType?: KnowledgeChunk['contentType'];
    };
  };
}

export interface KnowledgeUploadResponse {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  chaptersFound: string[];
  processingTimeMs: number;
  errors?: string[];
  // Extraction quality metrics (for high-quality extraction)
  extractionQuality?: {
    method: string;
    averageConfidence?: number;  // 0-1, higher is better
    pagesNeedingReview?: number[];  // Page numbers that had low confidence
  };
  // ID of the extraction review document (for manual review)
  extractionReviewId?: string;
  // Progress info for batch processing of large PDFs
  progress?: {
    processedPages: number;
    totalPages: number;
    percentComplete: number;
  };
}

/**
 * Stored extraction result for manual review
 * Allows admin to see original PDF pages alongside extracted text
 */
export interface ExtractionReview {
  id: string;
  documentId: string;  // Links to the upload
  fileName: string;
  storagePath: string;  // Path to original PDF in Storage
  grade: string;
  volume: number;
  volumeType: 'student' | 'teacher';
  subject: string;

  // Page-level extraction results
  pages: ExtractionReviewPage[];

  // Overall stats
  totalPages: number;
  averageConfidence: number;
  pagesNeedingReview: number[];

  // Status
  status: 'pending_review' | 'reviewed' | 'approved';
  reviewedBy?: string;
  reviewedAt?: FirebaseFirestore.Timestamp;

  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface ExtractionReviewPage {
  pageNumber: number;
  extractedText: string;
  verificationText?: string;  // Second pass extraction
  confidence: 'high' | 'medium' | 'low';
  agreementScore: number;
  needsReview: boolean;

  // Manual corrections
  correctedText?: string;
  correctedBy?: string;
  correctedAt?: FirebaseFirestore.Timestamp;
}

export interface KnowledgeSearchRequest {
  query: string;
  filters?: {
    subject?: KnowledgeChunk['subject'];
    grade?: KnowledgeChunk['grade'];
    volume?: number;
    volumeType?: 'student' | 'teacher';
    contentType?: KnowledgeChunk['contentType'];
  };
  limit?: number;  // default 5
  minSimilarity?: number;  // default 0.7
}

export interface KnowledgeSearchResult {
  chunk: Omit<KnowledgeChunk, 'embedding'>;  // לא מחזירים את הוקטור
  similarity: number;  // 0-1
}

export interface KnowledgeSearchResponse {
  results: KnowledgeSearchResult[];
  query: string;
  processingTimeMs: number;
}

export interface ProcessedDocument {
  fileName: string;
  totalChunks: number;
  chapters: {
    name: string;
    chunkCount: number;
    pageRange?: string;
  }[];
  extractedText: string;
  processingTimeMs: number;
}

// Chunk configuration
export const CHUNK_CONFIG = {
  maxTokens: 500,  // ~375 words in Hebrew
  overlapTokens: 50,  // overlap between chunks for context
  minChunkLength: 100,  // minimum characters for a valid chunk

  // Chapter detection patterns for Hebrew math books
  chapterPatterns: [
    /^פרק\s+[\u05d0-\u05ea\d]+[:\s]/m,  // פרק א: / פרק 1:
    /^יחידה\s+[\u05d0-\u05ea\d]+[:\s]/m,  // יחידה א:
    /^נושא\s+[\u05d0-\u05ea\d]+[:\s]/m,  // נושא 1:
    /^שיעור\s+[\u05d0-\u05ea\d]+[:\s]/m,  // שיעור 1:
  ],

  // Content type detection patterns
  contentTypePatterns: {
    example: [/דוגמה/, /דוגמא/, /למשל/, /לדוגמה/],
    exercise: [/תרגיל/, /תרגול/, /פתור/, /חשב/, /מצא/],
    solution: [/פתרון/, /תשובה/, /פיתרון/],
    tip: [/טיפ/, /רמז/, /שים לב/, /חשוב לזכור/],
    common_mistake: [/טעות נפוצה/, /שגיאה נפוצה/, /זהירות/, /אל תשכח/],
    definition: [/הגדרה/, /מהו/, /מהי/, /נקרא/],
    rule: [/כלל/, /חוק/, /נוסחה/, /נוסחא/],
    summary: [/סיכום/, /לסיכום/, /בקיצור/],
  }
} as const;

// Grade-topic mapping for better search
export const GRADE_TOPICS: Record<string, string[]> = {
  'א': ['מספרים 1-20', 'חיבור וחיסור עד 10', 'צורות בסיסיות', 'מדידת אורך', 'מספרים סודרים'],
  'ב': ['מספרים עד 100', 'חיבור וחיסור עד 100', 'כפל פשוט', 'שעון', 'כסף', 'מדידה'],
  'ג': ['מספרים עד 1000', 'לוח הכפל', 'חילוק', 'שברים פשוטים', 'היקף'],
  'ד': ['מספרים עד 10000', 'כפל וחילוק מרובה ספרות', 'שברים', 'שטח', 'היקף', 'זוויות'],
  'ה': ['מספרים עשרוניים', 'אחוזים', 'שברים מורכבים', 'נפח', 'ממוצע', 'גרפים'],
  'ו': ['מספרים שליליים', 'יחס ופרופורציה', 'אחוזים מתקדם', 'גיאומטריה', 'משוואות פשוטות'],
};

// ============================================
// Reference Exam Types - For Exam DNA Extraction
// ============================================

/**
 * Document type for Knowledge Base entries
 */
export type DocumentType = 'textbook' | 'teacher_guide' | 'reference_exam';

/**
 * Type of reference exam
 */
export type ExamType = 'unit_exam' | 'midterm' | 'final' | 'quiz';

/**
 * Subject type (reusable)
 */
export type Subject = KnowledgeChunk['subject'];

/**
 * Grade type (reusable)
 */
export type Grade = KnowledgeChunk['grade'];

/**
 * ExamDNA - The extracted "DNA" from a reference exam
 * Contains structural and pedagogical information for exam generation
 * Note: Does NOT store actual questions, only distributions and patterns
 */
export interface ExamDNA {
  // General structure
  questionCount: number;
  totalPoints: number;
  estimatedDurationMinutes: number;

  // Question type distribution (percentages, sum = 100)
  questionTypeDistribution: {
    multiple_choice: number;
    true_false: number;
    open_question: number;
    fill_in_blanks: number;
    ordering: number;
    categorization: number;
  };

  // Bloom taxonomy distribution (percentages, sum = 100)
  bloomDistribution: {
    remember: number;
    understand: number;
    apply: number;
    analyze: number;
    evaluate: number;
    create: number;
  };

  // Difficulty distribution (percentages, sum = 100)
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };

  // Linguistic style patterns
  linguisticStyle: {
    averageQuestionLengthWords: number;
    usesRealWorldContext: boolean;
    usesVisualElements: boolean;
    formalityLevel: 'low' | 'medium' | 'high';
  };

  // Metadata
  extractedAt: FirebaseFirestore.Timestamp;
  extractionConfidence: number; // 0-1
}

/**
 * Reference Exam document stored in Firestore
 * Represents an uploaded exam that serves as a template for generating new exams
 */
export interface ReferenceExam {
  id: string;
  documentType: 'reference_exam';

  // Link to textbook
  linkedTextbookId: string;
  linkedTextbookName: string; // For display purposes
  chapters: number[]; // Chapter numbers covered by this exam

  // Metadata
  subject: Subject;
  grade: Grade;
  examType: ExamType;
  fileName: string;
  storagePath: string;

  // The extracted DNA (structure only, no questions)
  examDna: ExamDNA;

  // Optional source info
  source?: string; // "מדריך למורה", "משרד החינוך", etc.
  year?: number;

  // Tracking
  uploadedBy: string;
  uploadedAt: FirebaseFirestore.Timestamp;
  usageCount: number;
}

/**
 * Request to upload a reference exam
 */
export interface ReferenceExamUploadRequest {
  // File data (one of these is required)
  fileBase64?: string;
  fileUrl?: string;
  storagePath?: string;
  mimeType: 'application/pdf';
  fileName: string;

  // Required metadata
  subject: Subject;
  grade: Grade;
  linkedTextbookId: string;
  chapters: number[];
  examType: ExamType;

  // Optional metadata
  source?: string;
  year?: number;
}

/**
 * Response from reference exam upload
 */
export interface ReferenceExamUploadResponse {
  success: boolean;
  examId: string;
  examDna: ExamDNA | null;
  linkedTextbookName: string;
  processingTimeMs: number;
  errors?: string[];
}
