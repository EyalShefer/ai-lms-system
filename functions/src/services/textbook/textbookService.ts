// textbookService.ts - Textbook Management Service for Aligned Content Generation

import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

import type {
  Textbook,
  TocEntry,
  KnowledgeChunk,
  KnowledgeSearchResult,
  TextbookContextResponse,
} from '../knowledgeBase/types';
import { EmbeddingService } from '../knowledgeBase/embeddingService';

const TEXTBOOKS_COLLECTION = 'textbooks';
const KNOWLEDGE_COLLECTION = 'math_knowledge';

export class TextbookService {
  private db: FirebaseFirestore.Firestore;
  private embeddingService: EmbeddingService;
  private openai: OpenAI;

  constructor(openaiApiKey: string) {
    this.db = getFirestore();
    this.embeddingService = new EmbeddingService(openaiApiKey);
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  // ============================================
  // TEXTBOOK MANAGEMENT
  // ============================================

  /**
   * Create a textbook record after knowledge base upload completes
   * Extracts ToC structure from chunks using AI
   */
  async createTextbookFromUpload(
    documentId: string,
    metadata: {
      grade: string;
      volume: number;
      volumeType: 'student' | 'teacher';
      subject: string;
      fileName: string;
      storagePath?: string;
      uploadedBy: string;
      totalPages?: number;
    }
  ): Promise<Textbook> {
    const startTime = Date.now();
    logger.info(`📚 Creating textbook record for document ${documentId}`);

    // 1. Fetch all chunks for this document
    const chunksSnapshot = await this.db
      .collection(KNOWLEDGE_COLLECTION)
      .where('id', '>=', documentId)
      .where('id', '<', documentId + '\uf8ff')
      .get();

    const chunks = chunksSnapshot.docs.map(doc => doc.data() as KnowledgeChunk);
    logger.info(`📚 Found ${chunks.length} chunks for document`);

    if (chunks.length === 0) {
      throw new Error('No chunks found for document - cannot create textbook');
    }

    // 2. Extract Table of Contents using AI
    const tableOfContents = await this.extractTableOfContents(chunks);

    // 3. Link chunks to ToC entries
    const linkedToc = await this.linkChunksToToc(tableOfContents, chunks, documentId);

    // 4. Generate textbook title
    const gradeHebrew = metadata.grade;
    const volumeTypeHebrew = metadata.volumeType === 'student' ? 'ספר תלמיד' : 'מדריך למורה';
    const subjectHebrew = this.getSubjectHebrew(metadata.subject);
    const title = `${subjectHebrew} כיתה ${gradeHebrew} כרך ${metadata.volume} - ${volumeTypeHebrew}`;

    // 5. Create textbook record
    const textbookId = uuidv4();
    const textbook: Textbook = {
      id: textbookId,
      title,
      subject: metadata.subject as Textbook['subject'],
      grade: metadata.grade as Textbook['grade'],
      volume: metadata.volume,
      volumeType: metadata.volumeType,
      tableOfContents: linkedToc,
      documentId,
      totalChunks: chunks.length,
      totalPages: metadata.totalPages || this.estimatePagesFromChunks(chunks),
      uploadedBy: metadata.uploadedBy,
      uploadedAt: Timestamp.now(),
      isPublic: true, // Always public per design decision
      usageCount: 0,
    };

    // 6. Save to Firestore
    await this.db.collection(TEXTBOOKS_COLLECTION).doc(textbookId).set(textbook);

    // 7. Update chunks with textbook reference
    await this.updateChunksWithTextbookId(documentId, textbookId, linkedToc);

    logger.info(`📚 Created textbook ${textbookId} in ${Date.now() - startTime}ms`);
    return textbook;
  }

  /**
   * Get all textbooks with optional filters
   */
  async getTextbooks(filters?: {
    subject?: string;
    grade?: string;
    volumeType?: 'student' | 'teacher';
  }): Promise<Omit<Textbook, 'tableOfContents'>[]> {
    logger.info(`📚 getTextbooks called with filters:`, filters);

    // Simple query without orderBy to avoid index requirements
    let query: FirebaseFirestore.Query = this.db.collection(TEXTBOOKS_COLLECTION);

    if (filters?.subject) {
      query = query.where('subject', '==', filters.subject);
    }
    if (filters?.grade) {
      query = query.where('grade', '==', filters.grade);
    }
    if (filters?.volumeType) {
      query = query.where('volumeType', '==', filters.volumeType);
    }

    // Get all textbooks without orderBy (avoids composite index requirement)
    const snapshot = await query.get();
    logger.info(`📚 Found ${snapshot.size} textbooks`);

    // Return without full ToC to keep response size small
    return snapshot.docs.map(doc => {
      const data = doc.data() as Textbook;
      const { tableOfContents, ...rest } = data;
      return {
        ...rest,
        // Include only top-level ToC entries for preview
        chaptersCount: tableOfContents?.length || 0,
      };
    }) as any;
  }

  /**
   * Get full textbook details including ToC
   */
  async getTextbookDetails(textbookId: string): Promise<Textbook | null> {
    const doc = await this.db.collection(TEXTBOOKS_COLLECTION).doc(textbookId).get();
    if (!doc.exists) return null;

    // Increment usage count
    await doc.ref.update({
      usageCount: FieldValue.increment(1),
    });

    return doc.data() as Textbook;
  }

  /**
   * Delete a textbook and optionally its chunks
   */
  async deleteTextbook(textbookId: string, deleteChunks: boolean = false): Promise<void> {
    const textbook = await this.getTextbookDetails(textbookId);
    if (!textbook) {
      throw new Error('Textbook not found');
    }

    if (deleteChunks) {
      // Delete all chunks linked to this textbook
      const chunksSnapshot = await this.db
        .collection(KNOWLEDGE_COLLECTION)
        .where('textbookId', '==', textbookId)
        .get();

      const batch = this.db.batch();
      chunksSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      logger.info(`🗑️ Deleted ${chunksSnapshot.size} chunks for textbook ${textbookId}`);
    }

    await this.db.collection(TEXTBOOKS_COLLECTION).doc(textbookId).delete();
    logger.info(`🗑️ Deleted textbook ${textbookId}`);
  }

  // ============================================
  // CONTENT BROWSING & RETRIEVAL
  // ============================================

  /**
   * Get content chunks for a specific ToC entry (chapter/section)
   */
  async getChapterContent(
    textbookId: string,
    tocEntryId: string,
    options?: {
      includeChildren?: boolean;
      contentTypes?: string[];
    }
  ): Promise<KnowledgeChunk[]> {
    const textbook = await this.getTextbookDetails(textbookId);
    if (!textbook) {
      throw new Error('Textbook not found');
    }

    // Find the ToC entry and get all chunk IDs
    const chunkIds = this.getChunkIdsFromTocEntry(textbook.tableOfContents, tocEntryId, options?.includeChildren);

    if (chunkIds.length === 0) {
      return [];
    }

    // Fetch chunks in batches (Firestore 'in' limit is 30)
    const BATCH_SIZE = 30;
    const allChunks: KnowledgeChunk[] = [];

    for (let i = 0; i < chunkIds.length; i += BATCH_SIZE) {
      const batchIds = chunkIds.slice(i, i + BATCH_SIZE);
      const snapshot = await this.db
        .collection(KNOWLEDGE_COLLECTION)
        .where('id', 'in', batchIds)
        .get();

      snapshot.docs.forEach(doc => {
        const chunk = doc.data() as KnowledgeChunk;
        // Filter by content type if specified
        if (!options?.contentTypes || options.contentTypes.includes(chunk.contentType)) {
          // Remove embedding from response
          const { embedding, ...chunkWithoutEmbedding } = chunk;
          allChunks.push(chunkWithoutEmbedding as KnowledgeChunk);
        }
      });
    }

    return allChunks;
  }

  /**
   * Semantic search within a specific textbook
   */
  async searchWithinTextbook(
    textbookId: string,
    query: string,
    options?: {
      tocEntryIds?: string[];
      contentTypes?: string[];
      limit?: number;
      minSimilarity?: number;
    }
  ): Promise<KnowledgeSearchResult[]> {
    const { limit = 10, minSimilarity = 0.2 } = options || {};

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Build Firestore query
    let firestoreQuery: FirebaseFirestore.Query = this.db
      .collection(KNOWLEDGE_COLLECTION)
      .where('textbookId', '==', textbookId);

    // If specific ToC entries are selected, filter by tocEntryId
    // Note: Firestore doesn't support 'in' with other conditions well,
    // so we'll filter in memory for tocEntryIds

    const snapshot = await firestoreQuery.limit(500).get();

    // Filter and calculate similarities
    const candidates: { id: string; embedding: number[]; doc: any }[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      // Filter by tocEntryIds if specified
      if (options?.tocEntryIds && options.tocEntryIds.length > 0) {
        if (!options.tocEntryIds.includes(data.tocEntryId)) {
          return;
        }
      }

      // Filter by content types if specified
      if (options?.contentTypes && options.contentTypes.length > 0) {
        if (!options.contentTypes.includes(data.contentType)) {
          return;
        }
      }

      if (data.embedding && Array.isArray(data.embedding)) {
        candidates.push({
          id: doc.id,
          embedding: data.embedding,
          doc: data,
        });
      }
    });

    // Find most similar
    const similarities = EmbeddingService.findMostSimilar(
      queryEmbedding,
      candidates,
      limit,
      minSimilarity
    );

    // Build results
    return similarities.map(sim => {
      const candidate = candidates.find(c => c.id === sim.id)!;
      const { embedding, ...chunkWithoutEmbedding } = candidate.doc;

      return {
        chunk: chunkWithoutEmbedding,
        similarity: sim.similarity,
      };
    });
  }

  /**
   * Get formatted context for AI generation from selected textbook chapters
   */
  async searchForTextbookContext(
    textbookId: string,
    tocEntryIds: string[],
    options?: {
      includeTeacherGuide?: boolean;
      prioritizeExamples?: boolean;
      prioritizeExercises?: boolean;
      maxChunks?: number;
      topic?: string;
    }
  ): Promise<TextbookContextResponse> {
    const { maxChunks = 10 } = options || {};

    const textbook = await this.getTextbookDetails(textbookId);
    if (!textbook) {
      throw new Error('Textbook not found');
    }

    // Get all chunks from selected ToC entries
    let allChunks: KnowledgeChunk[] = [];

    for (const tocEntryId of tocEntryIds) {
      const chunks = await this.getChapterContent(textbookId, tocEntryId, {
        includeChildren: true,
      });
      allChunks.push(...chunks);
    }

    // If topic is specified, search within the chunks for relevance
    if (options?.topic && allChunks.length > maxChunks) {
      const searchResults = await this.searchWithinTextbook(textbookId, options.topic, {
        tocEntryIds,
        limit: maxChunks,
      });
      allChunks = searchResults.map(r => r.chunk as KnowledgeChunk);
    }

    // Prioritize by content type if requested
    if (options?.prioritizeExamples) {
      allChunks.sort((a, b) => {
        if (a.contentType === 'example' && b.contentType !== 'example') return -1;
        if (a.contentType !== 'example' && b.contentType === 'example') return 1;
        return 0;
      });
    }
    if (options?.prioritizeExercises) {
      allChunks.sort((a, b) => {
        if (a.contentType === 'exercise' && b.contentType !== 'exercise') return -1;
        if (a.contentType !== 'exercise' && b.contentType === 'exercise') return 1;
        return 0;
      });
    }

    // Limit chunks
    allChunks = allChunks.slice(0, maxChunks);

    // Build context string
    let context = `### תוכן מספר הלימוד: ${textbook.title}\n\n`;

    const sources: TextbookContextResponse['sources'] = [];
    const selectedChapters = new Set<string>();

    for (const chunk of allChunks) {
      context += `[${chunk.chapter} | ${this.getContentTypeHebrew(chunk.contentType)}]\n`;
      context += chunk.content + '\n\n';

      sources.push({
        chunkId: chunk.id,
        page: chunk.pageNumber || 0,
        chapter: chunk.chapter,
        contentType: chunk.contentType,
      });

      selectedChapters.add(chunk.chapter);
    }

    // If teacher guide is requested and this is a student book, try to find matching teacher guide
    if (options?.includeTeacherGuide && textbook.volumeType === 'student') {
      const teacherGuideContext = await this.getMatchingTeacherGuideContext(
        textbook,
        tocEntryIds,
        Math.ceil(maxChunks * 0.4)
      );

      if (teacherGuideContext) {
        context += '\n### מדריך למורה:\n' + teacherGuideContext;
      }
    }

    return {
      context,
      sources,
      textbookTitle: textbook.title,
      selectedChapters: Array.from(selectedChapters),
    };
  }

  // ============================================
  // TOC EXTRACTION (AI-Powered)
  // ============================================

  /**
   * Extract Table of Contents from chunks using AI
   */
  private async extractTableOfContents(chunks: KnowledgeChunk[]): Promise<TocEntry[]> {
    // Group chunks by chapter
    const chapterGroups = new Map<string, KnowledgeChunk[]>();

    for (const chunk of chunks) {
      const chapter = chunk.chapter || 'ללא פרק';
      if (!chapterGroups.has(chapter)) {
        chapterGroups.set(chapter, []);
      }
      chapterGroups.get(chapter)!.push(chunk);
    }

    // Build ToC from chapters
    const tocEntries: TocEntry[] = [];
    let order = 0;

    for (const [chapterName, chapterChunks] of chapterGroups) {
      order++;

      // Extract keywords from chunk content
      const keywords = this.extractKeywordsFromChunks(chapterChunks);

      // Generate summary using AI
      const summary = await this.generateChapterSummary(chapterName, chapterChunks);

      // Estimate page range
      const pageNumbers = chapterChunks
        .map(c => c.pageNumber)
        .filter((p): p is number => p !== undefined);

      const pageStart = pageNumbers.length > 0 ? Math.min(...pageNumbers) : order;
      const pageEnd = pageNumbers.length > 1 ? Math.max(...pageNumbers) : null;

      const tocEntry: TocEntry = {
        id: uuidv4(),
        level: 1,
        title: chapterName,
        pageStart,
        pageEnd, // null instead of undefined for Firestore compatibility
        chunkIds: chapterChunks.map(c => c.id),
        children: [],
        keywords,
        summary: summary || '', // Ensure not undefined
      };

      // Try to extract sub-topics within the chapter
      const subTopics = await this.extractSubTopicsFromChunks(chapterChunks);
      if (subTopics.length > 0) {
        tocEntry.children = subTopics;
      }

      tocEntries.push(tocEntry);
    }

    logger.info(`📖 Extracted ${tocEntries.length} ToC entries`);
    return tocEntries;
  }

  /**
   * Generate chapter summary using AI
   */
  private async generateChapterSummary(
    chapterName: string,
    chunks: KnowledgeChunk[]
  ): Promise<string> {
    try {
      // Take first few chunks for summary
      const sampleContent = chunks
        .slice(0, 3)
        .map(c => c.content)
        .join('\n\n')
        .substring(0, 2000);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'אתה עוזר שמסכם תוכן מספרי לימוד. כתוב סיכום קצר (משפט אחד או שניים) של הפרק בעברית.',
          },
          {
            role: 'user',
            content: `סכם את הפרק "${chapterName}":\n\n${sampleContent}`,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      logger.warn('Failed to generate chapter summary:', error);
      return '';
    }
  }

  /**
   * Extract sub-topics from chapter chunks
   */
  private async extractSubTopicsFromChunks(chunks: KnowledgeChunk[]): Promise<TocEntry[]> {
    // Look for sub-topic patterns in content
    const subTopicPatterns = [
      /^(נושא\s+[\u05d0-\u05ea\d]+[:\s])/m,
      /^(תת[\s-]נושא\s+[\u05d0-\u05ea\d]+[:\s])/m,
      /^(\d+\.\s+[\u05d0-\u05ea]+)/m,
    ];

    const subTopics: TocEntry[] = [];
    const seenTitles = new Set<string>();

    for (const chunk of chunks) {
      for (const pattern of subTopicPatterns) {
        const match = chunk.content.match(pattern);
        if (match && !seenTitles.has(match[1])) {
          seenTitles.add(match[1]);

          subTopics.push({
            id: uuidv4(),
            level: 2,
            title: match[1].trim(),
            pageStart: chunk.pageNumber || 0,
            pageEnd: null, // Firestore requires explicit null, not undefined
            chunkIds: [chunk.id],
            children: [],
            keywords: this.extractKeywordsFromChunks([chunk]),
            summary: '', // Ensure not undefined
          });
        }
      }
    }

    return subTopics;
  }

  /**
   * Extract keywords from chunk content
   */
  private extractKeywordsFromChunks(chunks: KnowledgeChunk[]): string[] {
    const mathTerms = [
      'חיבור', 'חיסור', 'כפל', 'חילוק', 'שבר', 'עשרוני', 'אחוז',
      'משוואה', 'נעלם', 'היקף', 'שטח', 'נפח', 'זווית', 'משולש',
      'מרובע', 'מעגל', 'גרף', 'ממוצע', 'הסתברות', 'סטטיסטיקה',
      'מספר', 'ספרה', 'ערך מקום', 'סדר פעולות', 'חזקה', 'שורש',
    ];

    const foundKeywords = new Set<string>();

    for (const chunk of chunks) {
      for (const term of mathTerms) {
        if (chunk.content.includes(term)) {
          foundKeywords.add(term);
        }
      }

      // Also use chunk's own keywords
      if (chunk.keywords) {
        chunk.keywords.forEach(k => foundKeywords.add(k));
      }
    }

    return Array.from(foundKeywords).slice(0, 10);
  }

  /**
   * Link chunks to ToC entries and update chunk documents
   */
  private async linkChunksToToc(
    toc: TocEntry[],
    chunks: KnowledgeChunk[],
    documentId: string
  ): Promise<TocEntry[]> {
    // Create a map of chunk IDs to their ToC entry
    const chunkToTocMap = new Map<string, string>();

    const processEntry = (entry: TocEntry) => {
      for (const chunkId of entry.chunkIds) {
        chunkToTocMap.set(chunkId, entry.id);
      }
      if (entry.children) {
        for (const child of entry.children) {
          processEntry(child);
        }
      }
    };

    for (const entry of toc) {
      processEntry(entry);
    }

    return toc;
  }

  /**
   * Update chunks with textbook and ToC references
   */
  private async updateChunksWithTextbookId(
    documentId: string,
    textbookId: string,
    toc: TocEntry[]
  ): Promise<void> {
    // Build map of chunk ID to ToC entry ID
    const chunkToTocMap = new Map<string, string>();

    const processEntry = (entry: TocEntry) => {
      for (const chunkId of entry.chunkIds) {
        chunkToTocMap.set(chunkId, entry.id);
      }
      if (entry.children) {
        for (const child of entry.children) {
          processEntry(child);
        }
      }
    };

    for (const entry of toc) {
      processEntry(entry);
    }

    // Update chunks in batches
    const chunksSnapshot = await this.db
      .collection(KNOWLEDGE_COLLECTION)
      .where('id', '>=', documentId)
      .where('id', '<', documentId + '\uf8ff')
      .get();

    const BATCH_SIZE = 500;
    let batch = this.db.batch();
    let count = 0;

    for (const doc of chunksSnapshot.docs) {
      const tocEntryId = chunkToTocMap.get(doc.id) || null;

      batch.update(doc.ref, {
        textbookId,
        tocEntryId,
      });

      count++;

      if (count % BATCH_SIZE === 0) {
        await batch.commit();
        batch = this.db.batch();
      }
    }

    if (count % BATCH_SIZE !== 0) {
      await batch.commit();
    }

    logger.info(`📚 Updated ${count} chunks with textbook reference`);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get all chunk IDs from a ToC entry (optionally including children)
   */
  private getChunkIdsFromTocEntry(
    toc: TocEntry[],
    targetId: string,
    includeChildren: boolean = true
  ): string[] {
    const findEntry = (entries: TocEntry[]): TocEntry | null => {
      for (const entry of entries) {
        if (entry.id === targetId) return entry;
        if (entry.children) {
          const found = findEntry(entry.children);
          if (found) return found;
        }
      }
      return null;
    };

    const entry = findEntry(toc);
    if (!entry) return [];

    const collectChunkIds = (e: TocEntry): string[] => {
      let ids = [...e.chunkIds];
      if (includeChildren && e.children) {
        for (const child of e.children) {
          ids = ids.concat(collectChunkIds(child));
        }
      }
      return ids;
    };

    return collectChunkIds(entry);
  }

  /**
   * Get matching teacher guide context for a student book
   */
  private async getMatchingTeacherGuideContext(
    studentBook: Textbook,
    tocEntryIds: string[],
    maxChunks: number
  ): Promise<string | null> {
    // Find teacher guide for same grade and volume
    const teacherGuides = await this.getTextbooks({
      subject: studentBook.subject,
      grade: studentBook.grade,
      volumeType: 'teacher',
    });

    const matchingGuide = teacherGuides.find(
      g => g.volume === studentBook.volume
    );

    if (!matchingGuide) return null;

    // Get chapter names from selected ToC entries
    const selectedChapters = tocEntryIds.map(id => {
      const findTitle = (entries: TocEntry[]): string | null => {
        for (const entry of entries) {
          if (entry.id === id) return entry.title;
          if (entry.children) {
            const found = findTitle(entry.children);
            if (found) return found;
          }
        }
        return null;
      };
      return findTitle(studentBook.tableOfContents);
    }).filter(Boolean);

    if (selectedChapters.length === 0) return null;

    // Search teacher guide for matching content
    const results = await this.searchWithinTextbook(
      matchingGuide.id,
      selectedChapters.join(' '),
      { limit: maxChunks }
    );

    if (results.length === 0) return null;

    return results
      .map(r => `[${r.chunk.chapter}]\n${r.chunk.content}`)
      .join('\n\n');
  }

  /**
   * Estimate page count from chunks
   */
  private estimatePagesFromChunks(chunks: KnowledgeChunk[]): number {
    const pageNumbers = chunks
      .map(c => c.pageNumber)
      .filter((p): p is number => p !== undefined);

    if (pageNumbers.length > 0) {
      return Math.max(...pageNumbers);
    }

    // Estimate: ~2 chunks per page
    return Math.ceil(chunks.length / 2);
  }

  /**
   * Get Hebrew subject name
   */
  private getSubjectHebrew(subject: string): string {
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
  private getContentTypeHebrew(contentType: string): string {
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
}
