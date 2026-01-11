// knowledgeService.ts - Main Knowledge Base Service

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as logger from 'firebase-functions/logger';
import { v4 as uuidv4 } from 'uuid';

import type {
  KnowledgeChunk,
  KnowledgeUploadRequest,
  KnowledgeUploadResponse,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
  ExtractionReview,
  ExtractionReviewPage,
} from './types';
import { EmbeddingService } from './embeddingService';
import { PDFProcessor } from './pdfProcessor';
import { FullExtractionResult } from './highQualityExtractor';

const COLLECTION_NAME = 'math_knowledge';
const REVIEWS_COLLECTION = 'extraction_reviews';

export class KnowledgeService {
  private db: FirebaseFirestore.Firestore;
  private embeddingService: EmbeddingService;
  private pdfProcessor: PDFProcessor;

  constructor(openaiApiKey: string, _geminiApiKey?: string) {
    this.db = getFirestore();
    this.embeddingService = new EmbeddingService(openaiApiKey);
    // Use Vertex AI for high-quality extraction (Gemini API key no longer needed)
    this.pdfProcessor = new PDFProcessor(openaiApiKey, true);
  }

  /**
   * Upload and process a document into the knowledge base
   */
  async uploadDocument(request: KnowledgeUploadRequest): Promise<KnowledgeUploadResponse> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      logger.info(`📤 Starting upload: ${request.fileName}`);

      // Get file content - either from base64 or from Storage URL
      let fileBase64: string;

      if (request.fileUrl && request.storagePath) {
        // Download from Firebase Storage
        logger.info(`📥 Downloading from Storage: ${request.storagePath}`);
        const storage = getStorage();
        const bucket = storage.bucket();
        const file = bucket.file(request.storagePath);

        const [buffer] = await file.download();
        fileBase64 = buffer.toString('base64');
        logger.info(`📥 Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      } else if (request.fileBase64) {
        fileBase64 = request.fileBase64;
      } else {
        throw new Error('Either fileBase64 or fileUrl/storagePath must be provided');
      }

      // Create a progress document ID for real-time updates
      const progressId = `progress_${uuidv4()}`;
      let progressDocCreated = false;

      // Callback to update Firestore with real-time progress
      const onProgress = async (status: import('./highQualityExtractor').PageExtractionStatus) => {
        try {
          if (!progressDocCreated) {
            // Create initial progress document
            await this.db.collection('extraction_progress').doc(progressId).set({
              fileName: request.fileName,
              totalPages: 0,
              processedPages: 0,
              currentPage: status.pageNumber,
              status: 'processing',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });
            progressDocCreated = true;
          } else {
            // Update progress
            await this.db.collection('extraction_progress').doc(progressId).update({
              currentPage: status.pageNumber,
              status: status.status,
              updatedAt: Timestamp.now(),
            });
          }
        } catch (err) {
          // Don't fail the extraction if progress update fails
          logger.warn(`Failed to update progress: ${err}`);
        }
      };

      // 1. Process PDF into chunks using HIGH QUALITY extraction
      const result = await this.pdfProcessor.processDocument(
        fileBase64,
        request.fileName,
        {
          subject: request.subject,
          grade: request.grade,
          volume: request.volumeType === 'curriculum' ? 0 : request.volume, // Curriculum doesn't use volume
          volumeType: request.volumeType,
          // For curriculum, pass the grades array
          grades: request.grades,
        },
        {
          useHighQuality: true,  // Always use high quality for production
          onProgress,
        }
      );

      const { chunks, chapters, extractionMetadata, batchProgress, needsMoreBatches } = result;

      // Handle batch processing for large PDFs
      if (needsMoreBatches && batchProgress) {
        logger.warn(`⏳ Large PDF - batch processing in progress: ${batchProgress.processedPages}/${batchProgress.totalPages} pages`);

        // Update or create the batch progress document in Firestore
        await this.db.collection('extraction_progress').doc(progressId).set({
          ...batchProgress,
          metadata: {
            subject: request.subject,
            grade: request.grade,
            volume: request.volume,
            volumeType: request.volumeType,
            storagePath: request.storagePath,
          },
          createdAt: Timestamp.now(),
        });

        // Return partial success with progress info
        return {
          success: false,
          documentId: progressId,
          chunksCreated: 0,
          chaptersFound: [],
          processingTimeMs: Date.now() - startTime,
          errors: [`ספר גדול (${batchProgress.totalPages} עמודים) - עובד בחלקים. עמודים ${batchProgress.processedPages}/${batchProgress.totalPages} הושלמו. נא להמתין ולנסות שוב.`],
          extractionQuality: {
            method: 'batch_in_progress',
            averageConfidence: 0,
            pagesNeedingReview: [],
          },
          // Progress info for frontend to show continue button
          progress: {
            processedPages: batchProgress.processedPages,
            totalPages: batchProgress.totalPages,
            percentComplete: Math.round((batchProgress.processedPages / batchProgress.totalPages) * 100),
          },
        };
      }

      // Log extraction quality
      if (extractionMetadata) {
        logger.info(`📊 Extraction method: ${extractionMetadata.extractionMethod}`);
        if (extractionMetadata.averageConfidence !== undefined) {
          logger.info(`📊 Average confidence: ${(extractionMetadata.averageConfidence * 100).toFixed(1)}%`);
        }
        if (extractionMetadata.pagesNeedingReview && extractionMetadata.pagesNeedingReview.length > 0) {
          logger.warn(`⚠️ Pages needing manual review: ${extractionMetadata.pagesNeedingReview.join(', ')}`);
        }
      }

      if (chunks.length === 0) {
        throw new Error('No content extracted from document');
      }

      // 2. Generate embeddings for all chunks
      const texts = chunks.map(c => c.content);
      logger.info(`🔢 Generating embeddings for ${texts.length} chunks...`);

      const embeddingResults = await this.embeddingService.generateEmbeddingsBatch(texts);

      // 3. Save to Firestore in batches (max 10 per batch due to embedding size ~6KB each)
      const BATCH_SIZE = 10;
      let savedCount = 0;
      const documentId = uuidv4();

      // Process in batches
      for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
        const batch = this.db.batch();
        const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);

        for (let i = batchStart; i < batchEnd; i++) {
          const chunk = chunks[i];
          const embeddingResult = embeddingResults[i];

          if (!embeddingResult.embedding || embeddingResult.embedding.length === 0) {
            errors.push(`Failed to generate embedding for chunk ${i + 1}`);
            continue;
          }

          const chunkId = `${documentId}_${i}`;
          const docRef = this.db.collection(COLLECTION_NAME).doc(chunkId);

          const fullChunk: KnowledgeChunk & { storagePath?: string } = {
            id: chunkId,
            ...chunk,
            storagePath: request.storagePath, // Save the original PDF path for review
            embedding: embeddingResult.embedding,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          // Remove undefined values - Firestore doesn't accept them
          const cleanChunk = Object.fromEntries(
            Object.entries(fullChunk).filter(([_, v]) => v !== undefined)
          );

          batch.set(docRef, cleanChunk);
          savedCount++;
        }

        await batch.commit();
        logger.info(`💾 Saved batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
      }

      logger.info(`✅ Upload complete: ${savedCount} chunks saved`);

      // Clean up progress document if it was created
      if (progressDocCreated) {
        try {
          await this.db.collection('extraction_progress').doc(progressId).delete();
          logger.info(`🧹 Cleaned up progress document: ${progressId}`);
        } catch (err) {
          logger.warn(`Failed to clean up progress document: ${err}`);
        }
      }

      // Build response with extraction quality info
      const response: KnowledgeUploadResponse = {
        success: true,
        documentId,
        chunksCreated: savedCount,
        chaptersFound: chapters,
        processingTimeMs: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      };

      // Add extraction quality metrics if available
      if (extractionMetadata) {
        response.extractionQuality = {
          method: extractionMetadata.extractionMethod,
          averageConfidence: extractionMetadata.averageConfidence,
          pagesNeedingReview: extractionMetadata.pagesNeedingReview,
        };
      }

      return response;
    } catch (error: any) {
      logger.error('Upload failed:', error);
      return {
        success: false,
        documentId: '',
        chunksCreated: 0,
        chaptersFound: [],
        processingTimeMs: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Search the knowledge base using semantic similarity
   */
  async search(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResponse> {
    const startTime = Date.now();

    try {
      const { query, filters, limit = 5, minSimilarity = 0.2 } = request; // Very low threshold for Hebrew math

      // 1. Generate embedding for query
      logger.info(`🔍 Searching: "${query}" with minSimilarity=${minSimilarity}`);
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      logger.info(`✅ Generated query embedding (${queryEmbedding.length} dimensions)`);

      // 2. Build Firestore query with filters
      let firestoreQuery: FirebaseFirestore.Query = this.db.collection(COLLECTION_NAME);

      if (filters?.subject) {
        firestoreQuery = firestoreQuery.where('subject', '==', filters.subject);
      }
      if (filters?.grade) {
        firestoreQuery = firestoreQuery.where('grade', '==', filters.grade);
      }
      if (filters?.volume) {
        firestoreQuery = firestoreQuery.where('volume', '==', filters.volume);
      }
      if (filters?.volumeType) {
        firestoreQuery = firestoreQuery.where('volumeType', '==', filters.volumeType);
      }
      if (filters?.contentType) {
        firestoreQuery = firestoreQuery.where('contentType', '==', filters.contentType);
      }

      // 3. Fetch all matching documents (we'll filter by similarity in memory)
      // Note: For large collections, consider using Firestore Vector Search or Pinecone
      const snapshot = await firestoreQuery.limit(1000).get(); // Increased to cover all grade documents

      logger.info(`🔍 Firestore query returned ${snapshot.size} documents for filters: ${JSON.stringify(filters)}`);

      if (snapshot.empty) {
        logger.info('No documents match the filters');
        return {
          results: [],
          query,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // 4. Calculate similarities
      const candidates: { id: string; embedding: number[]; doc: FirebaseFirestore.DocumentData }[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.embedding && Array.isArray(data.embedding)) {
          candidates.push({
            id: doc.id,
            embedding: data.embedding,
            doc: data,
          });
        }
      });

      // 5. Find most similar
      const similarities = EmbeddingService.findMostSimilar(
        queryEmbedding,
        candidates,
        limit,
        minSimilarity
      );

      // Count by volumeType for debugging
      const studentCount = candidates.filter(c => c.doc.volumeType === 'student').length;
      const teacherCount = candidates.filter(c => c.doc.volumeType === 'teacher').length;
      const curriculumCount = candidates.filter(c => c.doc.volumeType === 'curriculum').length;
      logger.info(`🎯 Found ${similarities.length} results above ${minSimilarity} threshold from ${candidates.length} candidates (${studentCount} student, ${teacherCount} teacher, ${curriculumCount} curriculum)`);

      // 6. Build results
      const results: KnowledgeSearchResult[] = similarities.map((sim) => {
        const candidate = candidates.find((c) => c.id === sim.id)!;
        const { embedding, ...chunkWithoutEmbedding } = candidate.doc as KnowledgeChunk;

        return {
          chunk: chunkWithoutEmbedding,
          similarity: sim.similarity,
        };
      });

      // 7. Update usage counts (fire and forget)
      this.updateUsageCounts(results.map((r) => r.chunk.id));

      logger.info(`✅ Found ${results.length} results for "${query}"`);

      return {
        results,
        query,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('Search failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Search curriculum documents, including those that span multiple grades
   * Curriculum documents can have a 'grades' array field that lists all applicable grades
   */
  async searchCurriculum(request: {
    query: string;
    grade: KnowledgeChunk['grade'];
    limit?: number;
    minSimilarity?: number;
  }): Promise<KnowledgeSearchResponse> {
    const startTime = Date.now();
    const { query, grade, limit = 5, minSimilarity = 0.2 } = request;

    try {
      logger.info(`🔍 Searching curriculum for grade ${grade}: "${query}"`);

      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

      // Query 1: Documents with exact grade match (legacy)
      const exactGradeQuery = this.db.collection(COLLECTION_NAME)
        .where('volumeType', '==', 'curriculum')
        .where('grade', '==', grade);

      // Query 2: Documents where this grade is in the grades array
      const gradesArrayQuery = this.db.collection(COLLECTION_NAME)
        .where('volumeType', '==', 'curriculum')
        .where('grades', 'array-contains', grade);

      // Execute both queries
      const [exactSnapshot, arraySnapshot] = await Promise.all([
        exactGradeQuery.limit(500).get(),
        gradesArrayQuery.limit(500).get(),
      ]);

      // Combine results (remove duplicates by ID)
      const documentMap = new Map<string, FirebaseFirestore.DocumentData>();

      exactSnapshot.forEach((doc) => {
        documentMap.set(doc.id, doc.data());
      });

      arraySnapshot.forEach((doc) => {
        if (!documentMap.has(doc.id)) {
          documentMap.set(doc.id, doc.data());
        }
      });

      logger.info(`🔍 Found ${documentMap.size} curriculum documents for grade ${grade} (${exactSnapshot.size} exact, ${arraySnapshot.size} from array)`);

      if (documentMap.size === 0) {
        return {
          results: [],
          query,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Calculate similarities
      const candidates: { id: string; embedding: number[]; doc: FirebaseFirestore.DocumentData }[] = [];

      documentMap.forEach((data, id) => {
        if (data.embedding && Array.isArray(data.embedding)) {
          candidates.push({
            id,
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
      const results: KnowledgeSearchResult[] = similarities.map((sim) => {
        const candidate = candidates.find((c) => c.id === sim.id)!;
        const { embedding, ...chunkWithoutEmbedding } = candidate.doc as KnowledgeChunk;

        return {
          chunk: chunkWithoutEmbedding,
          similarity: sim.similarity,
        };
      });

      logger.info(`✅ Found ${results.length} curriculum results for grade ${grade}`);

      return {
        results,
        query,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('Curriculum search failed:', error);
      throw new Error(`Curriculum search failed: ${error.message}`);
    }
  }

  /**
   * Search with automatic context building for AI prompts
   */
  async searchForPromptContext(
    topic: string,
    grade: KnowledgeChunk['grade'],
    options?: {
      includeTeacherGuide?: boolean;
      includeCurriculum?: boolean;
      maxChunks?: number;
    }
  ): Promise<string> {
    const { includeTeacherGuide = true, includeCurriculum = true, maxChunks = 5 } = options || {};

    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`📚 KNOWLEDGE BASE SEARCH - DEBUG LOG`);
    logger.info(`${'='.repeat(60)}`);
    logger.info(`🔍 Topic: "${topic}"`);
    logger.info(`🎓 Grade: ${grade}`);
    logger.info(`⚙️ Options: includeCurriculum=${includeCurriculum}, includeTeacherGuide=${includeTeacherGuide}, maxChunks=${maxChunks}`);

    // Search for curriculum content FIRST (highest priority - defines what's allowed)
    // For curriculum, also search documents that have this grade in their grades array
    let curriculumResults: KnowledgeSearchResponse = { results: [], query: topic, processingTimeMs: 0 };
    if (includeCurriculum) {
      curriculumResults = await this.searchCurriculum({
        query: topic,
        grade,
        limit: Math.ceil(maxChunks * 0.3), // 30% from curriculum
      });
      logger.info(`\n📋 CURRICULUM RESULTS: ${curriculumResults.results.length} chunks found`);
      if (curriculumResults.results.length > 0) {
        curriculumResults.results.forEach((r, i) => {
          logger.info(`   [${i + 1}] Chapter: "${r.chunk.chapter}" | Similarity: ${(r.similarity * 100).toFixed(1)}%`);
          logger.info(`       Content preview: "${r.chunk.content.substring(0, 100)}..."`);
        });
      } else {
        logger.warn(`   ⚠️ NO CURRICULUM FOUND for grade ${grade}! Activity will be generated WITHOUT curriculum boundaries.`);
      }
    }

    // Search for student content
    const studentResults = await this.search({
      query: topic,
      filters: {
        subject: 'math',
        grade,
        volumeType: 'student',
      },
      limit: Math.ceil(maxChunks * 0.4), // 40% from student book
    });
    logger.info(`\n📖 STUDENT BOOK RESULTS: ${studentResults.results.length} chunks found`);
    if (studentResults.results.length > 0) {
      studentResults.results.forEach((r, i) => {
        logger.info(`   [${i + 1}] Chapter: "${r.chunk.chapter}" | Similarity: ${(r.similarity * 100).toFixed(1)}%`);
        logger.info(`       Content preview: "${r.chunk.content.substring(0, 100)}..."`);
      });
    } else {
      logger.warn(`   ⚠️ NO STUDENT BOOK FOUND for grade ${grade}!`);
    }

    // Search for teacher guide content
    let teacherResults: KnowledgeSearchResponse = { results: [], query: topic, processingTimeMs: 0 };
    if (includeTeacherGuide) {
      teacherResults = await this.search({
        query: topic,
        filters: {
          subject: 'math',
          grade,
          volumeType: 'teacher',
        },
        limit: Math.ceil(maxChunks * 0.3), // 30% from teacher guide
      });
      logger.info(`\n👨‍🏫 TEACHER GUIDE RESULTS: ${teacherResults.results.length} chunks found`);
      if (teacherResults.results.length > 0) {
        teacherResults.results.forEach((r, i) => {
          logger.info(`   [${i + 1}] Chapter: "${r.chunk.chapter}" | Similarity: ${(r.similarity * 100).toFixed(1)}%`);
          logger.info(`       Content preview: "${r.chunk.content.substring(0, 100)}..."`);
        });
      } else {
        logger.warn(`   ⚠️ NO TEACHER GUIDE FOUND for grade ${grade}!`);
      }
    }

    // Summary
    logger.info(`\n${'─'.repeat(60)}`);
    logger.info(`📊 SEARCH SUMMARY:`);
    logger.info(`   📋 Curriculum: ${curriculumResults.results.length} chunks ${curriculumResults.results.length === 0 ? '❌ MISSING!' : '✅'}`);
    logger.info(`   📖 Student Book: ${studentResults.results.length} chunks ${studentResults.results.length === 0 ? '❌ MISSING!' : '✅'}`);
    logger.info(`   👨‍🏫 Teacher Guide: ${teacherResults.results.length} chunks ${teacherResults.results.length === 0 ? '⚠️ missing' : '✅'}`);
    logger.info(`${'─'.repeat(60)}\n`);

    // Build context string - Curriculum FIRST as it defines boundaries
    let context = '';

    if (curriculumResults.results.length > 0) {
      context += '### תוכנית הלימודים (גבולות הגזרה - חובה לעקוב!):\n';
      for (const result of curriculumResults.results) {
        context += `[${result.chunk.chapter}]\n${result.chunk.content}\n\n`;
      }
    }

    if (studentResults.results.length > 0) {
      context += '\n### מספר התלמיד:\n';
      for (const result of studentResults.results) {
        context += `[${result.chunk.chapter}]\n${result.chunk.content}\n\n`;
      }
    }

    if (teacherResults.results.length > 0) {
      context += '\n### מדריך למורה:\n';
      for (const result of teacherResults.results) {
        context += `[${result.chunk.chapter}]\n${result.chunk.content}\n\n`;
      }
    }

    // Final context log
    if (context) {
      logger.info(`✅ FINAL CONTEXT LENGTH: ${context.length} characters`);
    } else {
      logger.error(`❌ NO CONTEXT BUILT! Activity will be generated with NO knowledge base grounding.`);
    }

    return context;
  }

  /**
   * Get statistics about the knowledge base
   */
  async getStats(): Promise<{
    totalChunks: number;
    byGrade: Record<string, number>;
    bySubject: Record<string, number>;
    byVolumeType: Record<string, number>;
  }> {
    const snapshot = await this.db.collection(COLLECTION_NAME).get();

    const stats = {
      totalChunks: snapshot.size,
      byGrade: {} as Record<string, number>,
      bySubject: {} as Record<string, number>,
      byVolumeType: {} as Record<string, number>,
    };

    snapshot.forEach((doc) => {
      const data = doc.data();

      // By grade
      const grade = data.grade || 'unknown';
      stats.byGrade[grade] = (stats.byGrade[grade] || 0) + 1;

      // By subject
      const subject = data.subject || 'unknown';
      stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;

      // By volume type
      const volumeType = data.volumeType || 'unknown';
      stats.byVolumeType[volumeType] = (stats.byVolumeType[volumeType] || 0) + 1;
    });

    return stats;
  }

  /**
   * Delete all chunks from a specific document upload
   */
  async deleteDocument(documentId: string): Promise<number> {
    const snapshot = await this.db
      .collection(COLLECTION_NAME)
      .where('id', '>=', documentId)
      .where('id', '<', documentId + '\uf8ff')
      .get();

    const batch = this.db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    logger.info(`🗑️ Deleted ${snapshot.size} chunks for document ${documentId}`);
    return snapshot.size;
  }

  /**
   * Update usage counts for retrieved chunks
   */
  private async updateUsageCounts(chunkIds: string[]): Promise<void> {
    try {
      const batch = this.db.batch();

      for (const id of chunkIds) {
        const ref = this.db.collection(COLLECTION_NAME).doc(id);
        batch.update(ref, {
          usageCount: FieldValue.increment(1),
          lastUsedAt: Timestamp.now(),
        });
      }

      await batch.commit();
    } catch (error) {
      // Non-critical, just log
      logger.warn('Failed to update usage counts:', error);
    }
  }

  // ============================================
  // EXTRACTION REVIEW METHODS
  // ============================================

  /**
   * Save extraction results for manual review
   */
  async saveExtractionReview(
    extractionResult: FullExtractionResult,
    metadata: {
      documentId: string;
      storagePath: string;
      grade: string;
      volume: number;
      volumeType: 'student' | 'teacher';
      subject: string;
    }
  ): Promise<string> {
    const reviewId = uuidv4();

    const pages: ExtractionReviewPage[] = extractionResult.pages.map(p => ({
      pageNumber: p.pageNumber,
      extractedText: p.consensusText,
      verificationText: p.verificationText,
      confidence: p.confidence,
      agreementScore: p.agreementScore,
      needsReview: p.needsReview,
    }));

    const review: Omit<ExtractionReview, 'id'> = {
      documentId: metadata.documentId,
      fileName: extractionResult.fileName,
      storagePath: metadata.storagePath,
      grade: metadata.grade,
      volume: metadata.volume,
      volumeType: metadata.volumeType,
      subject: metadata.subject,
      pages,
      totalPages: extractionResult.totalPages,
      averageConfidence: extractionResult.averageConfidence,
      pagesNeedingReview: extractionResult.pagesNeedingReview,
      status: extractionResult.pagesNeedingReview.length > 0 ? 'pending_review' : 'approved',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await this.db.collection(REVIEWS_COLLECTION).doc(reviewId).set({
      id: reviewId,
      ...review,
    });

    logger.info(`📝 Saved extraction review ${reviewId} with ${pages.length} pages`);
    return reviewId;
  }

  /**
   * Get extraction review by ID
   */
  async getExtractionReview(reviewId: string): Promise<ExtractionReview | null> {
    const doc = await this.db.collection(REVIEWS_COLLECTION).doc(reviewId).get();
    if (!doc.exists) return null;
    return doc.data() as ExtractionReview;
  }

  /**
   * Get all extraction reviews pending review
   */
  async getPendingReviews(): Promise<ExtractionReview[]> {
    console.log(`📋 Querying ${REVIEWS_COLLECTION} for pending_review status...`);
    try {
      const snapshot = await this.db
        .collection(REVIEWS_COLLECTION)
        .where('status', '==', 'pending_review')
        .orderBy('createdAt', 'desc')
        .get();

      console.log(`📋 Found ${snapshot.size} pending reviews`);
      return snapshot.docs.map(doc => doc.data() as ExtractionReview);
    } catch (error: any) {
      console.error('📋 Error getting pending reviews:', error.message);
      // If index is missing, try without orderBy
      if (error.message?.includes('index')) {
        console.log('📋 Retrying without orderBy (index may be building)...');
        const snapshot = await this.db
          .collection(REVIEWS_COLLECTION)
          .where('status', '==', 'pending_review')
          .get();
        console.log(`📋 Found ${snapshot.size} pending reviews (without ordering)`);
        return snapshot.docs.map(doc => doc.data() as ExtractionReview);
      }
      throw error;
    }
  }

  /**
   * Get all extraction reviews
   */
  async getAllReviews(): Promise<ExtractionReview[]> {
    console.log(`📋 Querying ${REVIEWS_COLLECTION} for all reviews...`);
    try {
      const snapshot = await this.db
        .collection(REVIEWS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      console.log(`📋 Found ${snapshot.size} total reviews`);
      return snapshot.docs.map(doc => doc.data() as ExtractionReview);
    } catch (error: any) {
      console.error('📋 Error getting all reviews:', error.message);
      // If index is missing, try without orderBy
      if (error.message?.includes('index')) {
        console.log('📋 Retrying without orderBy (index may be building)...');
        const snapshot = await this.db
          .collection(REVIEWS_COLLECTION)
          .limit(50)
          .get();
        console.log(`📋 Found ${snapshot.size} reviews (without ordering)`);
        return snapshot.docs.map(doc => doc.data() as ExtractionReview);
      }
      throw error;
    }
  }

  /**
   * Update a page's extracted text (manual correction)
   */
  async correctPageExtraction(
    reviewId: string,
    pageNumber: number,
    correctedText: string,
    correctedBy: string
  ): Promise<void> {
    const reviewRef = this.db.collection(REVIEWS_COLLECTION).doc(reviewId);
    const reviewDoc = await reviewRef.get();

    if (!reviewDoc.exists) {
      throw new Error('Review not found');
    }

    const review = reviewDoc.data() as ExtractionReview;
    const pageIndex = review.pages.findIndex(p => p.pageNumber === pageNumber);

    if (pageIndex === -1) {
      throw new Error(`Page ${pageNumber} not found`);
    }

    // Update the page
    review.pages[pageIndex].correctedText = correctedText;
    review.pages[pageIndex].correctedBy = correctedBy;
    review.pages[pageIndex].correctedAt = Timestamp.now();
    review.pages[pageIndex].needsReview = false;

    // Recalculate pages needing review
    const stillNeedReview = review.pages
      .filter(p => p.needsReview && !p.correctedText)
      .map(p => p.pageNumber);

    await reviewRef.update({
      pages: review.pages,
      pagesNeedingReview: stillNeedReview,
      status: stillNeedReview.length === 0 ? 'reviewed' : 'pending_review',
      updatedAt: Timestamp.now(),
    });

    logger.info(`✏️ Corrected page ${pageNumber} in review ${reviewId}`);
  }

  /**
   * Approve extraction review and regenerate chunks with corrections
   */
  async approveExtractionReview(
    reviewId: string,
    approvedBy: string
  ): Promise<{ chunksUpdated: number }> {
    const reviewRef = this.db.collection(REVIEWS_COLLECTION).doc(reviewId);
    const reviewDoc = await reviewRef.get();

    if (!reviewDoc.exists) {
      throw new Error('Review not found');
    }

    const review = reviewDoc.data() as ExtractionReview;

    // Build the full text from pages (using corrections where available)
    const fullText = review.pages
      .map(p => {
        const text = p.correctedText || p.extractedText;
        return `<!-- עמוד ${p.pageNumber} -->\n${text}`;
      })
      .join('\n\n---\n\n');

    // Delete existing chunks for this document
    const existingChunks = await this.db
      .collection(COLLECTION_NAME)
      .where('id', '>=', review.documentId)
      .where('id', '<', review.documentId + '\uf8ff')
      .get();

    const deletePromises = existingChunks.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    logger.info(`🗑️ Deleted ${existingChunks.size} old chunks`);

    // Create chunks directly from the corrected text (no PDF parsing needed)
    const chunks = this.createChunksFromText(fullText, {
      subject: review.subject as any,
      grade: review.grade as any,
      volume: review.volume,
      volumeType: review.volumeType,
      source: review.fileName,
    });

    // Generate new embeddings and save
    const texts = chunks.map(c => c.content);
    const embeddings = await this.embeddingService.generateEmbeddingsBatch(texts);

    let savedCount = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = this.db.batch();
      const batchEnd = Math.min(i + BATCH_SIZE, chunks.length);

      for (let j = i; j < batchEnd; j++) {
        const chunk = chunks[j];
        const embedding = embeddings[j];

        if (!embedding.embedding) continue;

        const chunkId = `${review.documentId}_${j}`;
        const docRef = this.db.collection(COLLECTION_NAME).doc(chunkId);

        batch.set(docRef, {
          id: chunkId,
          ...chunk,
          embedding: embedding.embedding,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        savedCount++;
      }

      await batch.commit();
    }

    // Mark review as approved
    await reviewRef.update({
      status: 'approved',
      reviewedBy: approvedBy,
      reviewedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    logger.info(`✅ Approved review ${reviewId}, created ${savedCount} new chunks`);

    return { chunksUpdated: savedCount };
  }

  /**
   * Create chunks directly from text (for approved reviews - no PDF parsing needed)
   */
  private createChunksFromText(
    fullText: string,
    metadata: {
      subject: string;
      grade: string;
      volume: number;
      volumeType: 'student' | 'teacher' | 'curriculum';
      source: string;
    }
  ): Omit<KnowledgeChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[] {
    const CHUNK_CONFIG = {
      maxTokens: 500,
      minChunkLength: 100,
    };

    const estimateTokens = (text: string) => Math.ceil(text.length / 3);

    // Parse chapters from text
    const chapters = this.parseChaptersFromText(fullText);
    const chunks: Omit<KnowledgeChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[] = [];

    for (const chapter of chapters) {
      const paragraphs = chapter.content.split(/\n\n+/);
      let currentChunk = '';
      let currentTokens = 0;

      for (const paragraph of paragraphs) {
        const paragraphTokens = estimateTokens(paragraph);

        if (currentTokens + paragraphTokens > CHUNK_CONFIG.maxTokens && currentChunk.length >= CHUNK_CONFIG.minChunkLength) {
          chunks.push({
            subject: metadata.subject as any,
            grade: metadata.grade as any,
            volume: metadata.volume,
            volumeType: metadata.volumeType,
            chapter: chapter.name,
            chapterNumber: chapter.chapterNumber,
            content: currentChunk.trim(),
            contentType: 'explanation',
            source: metadata.source,
            sourceType: 'pdf',
            keywords: [],
            relatedTopics: [],
            usageCount: 0,
          });

          const sentences = currentChunk.split(/[.!?。]/);
          const overlapText = sentences.length > 2 ? sentences.slice(-2).join('. ') : sentences[sentences.length - 1] || '';
          currentChunk = overlapText + '\n\n' + paragraph;
          currentTokens = estimateTokens(currentChunk);
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
          currentTokens += paragraphTokens;
        }
      }

      if (currentChunk.length >= CHUNK_CONFIG.minChunkLength) {
        chunks.push({
          subject: metadata.subject as any,
          grade: metadata.grade as any,
          volume: metadata.volume,
          volumeType: metadata.volumeType,
          chapter: chapter.name,
          chapterNumber: chapter.chapterNumber,
          content: currentChunk.trim(),
          contentType: 'explanation',
          source: metadata.source,
          sourceType: 'pdf',
          keywords: [],
          relatedTopics: [],
          usageCount: 0,
        });
      }
    }

    logger.info(`📚 Created ${chunks.length} chunks from corrected text`);
    return chunks;
  }

  /**
   * Parse chapters from text (helper for createChunksFromText)
   */
  private parseChaptersFromText(fullText: string): { name: string; content: string; chapterNumber: number }[] {
    const chapters: { name: string; content: string; chapterNumber: number }[] = [];

    const chapterPatterns = [
      /^(פרק\s+[\u05d0-\u05ea\d]+)/gm,
      /^(יחידה\s+[\u05d0-\u05ea\d]+)/gm,
      /^(נושא\s*:?\s*[\u05d0-\u05ea\d]+)/gm,
    ];

    let chapterBoundaries: { index: number; name: string }[] = [];

    for (const pattern of chapterPatterns) {
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        chapterBoundaries.push({
          index: match.index,
          name: match[1].trim(),
        });
      }
    }

    chapterBoundaries.sort((a, b) => a.index - b.index);
    chapterBoundaries = chapterBoundaries.filter((boundary, i) => {
      if (i === 0) return true;
      return boundary.index - chapterBoundaries[i - 1].index > 100;
    });

    if (chapterBoundaries.length > 0) {
      for (let i = 0; i < chapterBoundaries.length; i++) {
        const start = chapterBoundaries[i].index;
        const end = i < chapterBoundaries.length - 1 ? chapterBoundaries[i + 1].index : fullText.length;
        const chapterContent = fullText.substring(start, end).trim();

        if (chapterContent.length > 50) {
          chapters.push({
            name: chapterBoundaries[i].name,
            content: chapterContent,
            chapterNumber: i + 1,
          });
        }
      }

      if (chapterBoundaries[0].index > 200) {
        chapters.unshift({
          name: 'מבוא',
          content: fullText.substring(0, chapterBoundaries[0].index).trim(),
          chapterNumber: 0,
        });
      }
    }

    if (chapters.length === 0) {
      chapters.push({
        name: 'תוכן הספר',
        content: fullText,
        chapterNumber: 1,
      });
    }

    return chapters;
  }
}
