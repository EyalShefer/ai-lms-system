// knowledgeService.ts - Main Knowledge Base Service

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as logger from 'firebase-functions/logger';
import { v4 as uuidv4 } from 'uuid';

import {
  KnowledgeChunk,
  KnowledgeUploadRequest,
  KnowledgeUploadResponse,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
} from './types';
import { EmbeddingService } from './embeddingService';
import { PDFProcessor } from './pdfProcessor';

const COLLECTION_NAME = 'math_knowledge';

export class KnowledgeService {
  private db: FirebaseFirestore.Firestore;
  private embeddingService: EmbeddingService;
  private pdfProcessor: PDFProcessor;

  constructor(apiKey: string) {
    this.db = getFirestore();
    this.embeddingService = new EmbeddingService(apiKey);
    this.pdfProcessor = new PDFProcessor(apiKey);
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

      // 1. Process PDF into chunks
      const { chunks, chapters } = await this.pdfProcessor.processDocument(
        fileBase64,
        request.fileName,
        {
          subject: request.subject,
          grade: request.grade,
          volume: request.volume,
          volumeType: request.volumeType,
        }
      );

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

          const fullChunk: KnowledgeChunk = {
            id: chunkId,
            ...chunk,
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

      return {
        success: true,
        documentId,
        chunksCreated: savedCount,
        chaptersFound: chapters,
        processingTimeMs: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      };
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
      const { query, filters, limit = 5, minSimilarity = 0.7 } = request;

      // 1. Generate embedding for query
      logger.info(`🔍 Searching: "${query}"`);
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);

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
      const snapshot = await firestoreQuery.limit(500).get();

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
   * Search with automatic context building for AI prompts
   */
  async searchForPromptContext(
    topic: string,
    grade: KnowledgeChunk['grade'],
    options?: {
      includeTeacherGuide?: boolean;
      maxChunks?: number;
    }
  ): Promise<string> {
    const { includeTeacherGuide = true, maxChunks = 5 } = options || {};

    // Search for student content
    const studentResults = await this.search({
      query: topic,
      filters: {
        subject: 'math',
        grade,
        volumeType: 'student',
      },
      limit: Math.ceil(maxChunks * 0.6), // 60% from student book
    });

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
        limit: Math.ceil(maxChunks * 0.4), // 40% from teacher guide
      });
    }

    // Build context string
    let context = '';

    if (studentResults.results.length > 0) {
      context += '### מספר התלמיד:\n';
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
}
