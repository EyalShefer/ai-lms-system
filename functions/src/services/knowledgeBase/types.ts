// types.ts - Knowledge Base Types for Math RAG System

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
