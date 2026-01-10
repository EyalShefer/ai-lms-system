// knowledgeController.ts - Cloud Functions for Knowledge Base

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import {
  KnowledgeService,
  KnowledgeUploadRequest,
  KnowledgeSearchRequest,
} from '../services/knowledgeBase';

const openAiApiKey = defineSecret('OPENAI_API_KEY');
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const auth = getAuth();
const db = getFirestore();

// Helper to check if user is admin
async function isAdmin(uid: string): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    return userData?.role === 'admin' || userData?.isAdmin === true;
  } catch {
    return false;
  }
}

/**
 * Upload a document to the knowledge base
 * Admin only
 */
export const uploadKnowledge = onCall(
  {
    cors: true,
    secrets: [openAiApiKey, geminiApiKey],
    memory: '2GiB',  // Increased for high-quality extraction
    timeoutSeconds: 540, // 9 minutes for large PDFs with high-quality extraction
  },
  async (request) => {
    // 1. Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    // 2. Verify admin role
    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    // 3. Validate request
    const {
      fileBase64,
      fileUrl,
      storagePath,
      mimeType,
      fileName,
      subject,
      grade,
      volume,
      volumeType,
    } = request.data as KnowledgeUploadRequest;

    // Either base64 or Storage URL must be provided
    if (!fileBase64 && (!fileUrl || !storagePath)) {
      throw new HttpsError('invalid-argument', 'חסר קובץ');
    }
    if (!fileName) {
      throw new HttpsError('invalid-argument', 'חסר שם קובץ');
    }

    if (!subject || !grade || !volume || !volumeType) {
      throw new HttpsError('invalid-argument', 'חסרים פרטי מטא-דאטה');
    }

    logger.info(`📤 Admin ${request.auth.uid} uploading: ${fileName}`);

    try {
      // Use both OpenAI and Gemini API keys for high-quality extraction
      const service = new KnowledgeService(openAiApiKey.value(), geminiApiKey.value());

      logger.info(`🚀 Starting HIGH QUALITY extraction for ${fileName}`);

      const result = await service.uploadDocument({
        fileBase64,
        fileUrl,
        storagePath,
        mimeType: mimeType || 'application/pdf',
        fileName,
        subject,
        grade,
        volume,
        volumeType,
      });

      return result;
    } catch (error: any) {
      logger.error('Upload failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Search the knowledge base
 * Available to all authenticated users
 */
export const searchKnowledge = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
    memory: '512MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    // 1. Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    // 2. Validate request
    const { query, filters, limit, minSimilarity } = request.data as KnowledgeSearchRequest;

    if (!query || query.trim().length < 2) {
      throw new HttpsError('invalid-argument', 'שאילתת חיפוש קצרה מדי');
    }

    logger.info(`🔍 User ${request.auth.uid} searching: "${query}" with filters: ${JSON.stringify(filters)}`);

    try {
      const service = new KnowledgeService(openAiApiKey.value());

      // Use client-provided minSimilarity or default to very low threshold
      const effectiveMinSimilarity = minSimilarity ?? 0.2; // Very low for Hebrew math

      const result = await service.search({
        query,
        filters,
        limit: Math.min(limit || 5, 20), // Max 20 results
        minSimilarity: effectiveMinSimilarity,
      });

      logger.info(`✅ Search completed: ${result.results.length} results found`);
      return result;
    } catch (error: any) {
      logger.error('Search failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get context for AI generation
 * Internal use - called by generation functions
 */
export const getKnowledgeContext = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
    memory: '512MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { topic, grade, includeTeacherGuide, maxChunks } = request.data;

    if (!topic || !grade) {
      throw new HttpsError('invalid-argument', 'חסרים נושא או כיתה');
    }

    try {
      const service = new KnowledgeService(openAiApiKey.value());

      const context = await service.searchForPromptContext(topic, grade, {
        includeTeacherGuide: includeTeacherGuide !== false,
        maxChunks: maxChunks || 5,
      });

      return { context };
    } catch (error: any) {
      logger.error('Context retrieval failed:', error);
      // Return empty context instead of failing
      return { context: '' };
    }
  }
);

/**
 * Get knowledge base statistics
 * Admin only
 */
export const getKnowledgeStats = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    try {
      const service = new KnowledgeService(openAiApiKey.value());
      const stats = await service.getStats();
      return stats;
    } catch (error: any) {
      logger.error('Stats retrieval failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Delete a document from knowledge base
 * Admin only
 */
export const deleteKnowledgeDocument = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { documentId } = request.data;

    if (!documentId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה מסמך');
    }

    logger.info(`🗑️ Admin ${request.auth.uid} deleting document: ${documentId}`);

    try {
      const service = new KnowledgeService(openAiApiKey.value());
      const deletedCount = await service.deleteDocument(documentId);
      return { success: true, deletedCount };
    } catch (error: any) {
      logger.error('Delete failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get list of uploaded books in knowledge base
 * Admin only
 */
export const getKnowledgeBooks = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    try {
      const snapshot = await db.collection('math_knowledge').get();

      // Group by unique book (grade + volume + volumeType)
      const booksMap = new Map<string, {
        grade: string;
        volume: number;
        volumeType: string;
        subject: string;
        chunksCount: number;
        source?: string;
      }>();

      snapshot.forEach(doc => {
        const data = doc.data();
        const key = `${data.grade}-${data.volume}-${data.volumeType}`;

        if (booksMap.has(key)) {
          const existing = booksMap.get(key)!;
          existing.chunksCount++;
        } else {
          booksMap.set(key, {
            grade: data.grade,
            volume: data.volume || 1,
            volumeType: data.volumeType,
            subject: data.subject || 'math',
            chunksCount: 1,
            source: data.source,
          });
        }
      });

      const books = Array.from(booksMap.values()).sort((a, b) => {
        // Sort by grade, then volume, then type
        const gradeOrder = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];
        const gradeCompare = gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
        if (gradeCompare !== 0) return gradeCompare;

        const volumeCompare = a.volume - b.volume;
        if (volumeCompare !== 0) return volumeCompare;

        return a.volumeType.localeCompare(b.volumeType);
      });

      return { books };
    } catch (error: any) {
      logger.error('Get books failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Delete a specific book from knowledge base
 * Admin only - deletes by grade + volume + volumeType combination
 */
export const deleteKnowledgeBook = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { grade, volume, volumeType } = request.data;

    if (!grade || !volumeType) {
      throw new HttpsError('invalid-argument', 'חסרים פרטי הספר');
    }

    logger.info(`🗑️ Admin ${request.auth.uid} deleting book: grade=${grade}, volume=${volume}, type=${volumeType}`);

    try {
      // Query specific book chunks
      let query = db.collection('math_knowledge')
        .where('grade', '==', grade)
        .where('volumeType', '==', volumeType);

      if (volume) {
        query = query.where('volume', '==', volume);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        return { success: true, deletedCount: 0, message: 'לא נמצאו רשומות למחיקה' };
      }

      logger.info(`Found ${snapshot.size} chunks to delete`);

      // Delete documents one by one to avoid "Transaction too big" error
      // (documents contain large embedding arrays that make batches exceed limits)
      let deletedCount = 0;
      const docs = snapshot.docs;

      for (const doc of docs) {
        await doc.ref.delete();
        deletedCount++;

        // Log progress every 50 deletions
        if (deletedCount % 50 === 0) {
          logger.info(`Deleted ${deletedCount}/${docs.length} chunks...`);
        }
      }

      const bookName = volumeType === 'teacher' ? 'מדריך למורה' : 'ספר תלמיד';
      logger.info(`✅ Deleted ${deletedCount} chunks for ${bookName} כיתה ${grade}`);

      return {
        success: true,
        deletedCount,
        message: `נמחקו ${deletedCount} רשומות מ${bookName} כיתה ${grade}'`,
      };
    } catch (error: any) {
      logger.error('Delete book failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Continue batch extraction for a large PDF
 * Admin only - automatically continues from saved progress
 */
export const continueKnowledgeExtraction = onCall(
  {
    cors: true,
    secrets: [openAiApiKey, geminiApiKey],
    memory: '2GiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { progressId } = request.data;

    if (!progressId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה התקדמות');
    }

    logger.info(`📤 Admin ${request.auth.uid} continuing extraction: ${progressId}`);

    try {
      // Get saved progress
      const progressDoc = await db.collection('extraction_progress').doc(progressId).get();
      if (!progressDoc.exists) {
        throw new HttpsError('not-found', 'לא נמצאה התקדמות שמורה');
      }

      const progressData = progressDoc.data()!;
      const { metadata, createdAt, ...batchProgressData } = progressData;

      // Import type and cast properly
      type BatchProgress = import('../services/knowledgeBase/highQualityExtractor').BatchExtractionProgress;
      const batchProgress = batchProgressData as BatchProgress;

      // Get the PDF from storage
      const { getStorage } = await import('firebase-admin/storage');
      const storage = getStorage();
      const bucket = storage.bucket();
      const file = bucket.file(metadata.storagePath);
      const [buffer] = await file.download();
      const pdfBase64 = buffer.toString('base64');

      logger.info(`📥 Downloaded PDF, continuing from page ${batchProgress.lastProcessedPage + 1}`);

      // Continue processing
      const { PDFProcessor } = await import('../services/knowledgeBase/pdfProcessor');
      const pdfProcessor = new PDFProcessor(openAiApiKey.value(), true);

      const result = await pdfProcessor.continueBatchExtraction(
        pdfBase64,
        batchProgress
      );

      if (result.needsMoreBatches && result.batchProgress) {
        // Save updated progress
        await db.collection('extraction_progress').doc(progressId).update({
          ...result.batchProgress,
          updatedAt: new Date(),
        });

        return {
          success: false,
          documentId: progressId,
          chunksCreated: 0,
          chaptersFound: [],
          processingTimeMs: Date.now() - progressData.startedAt,
          progress: {
            processedPages: result.batchProgress.processedPages,
            totalPages: result.batchProgress.totalPages,
            percentComplete: Math.round((result.batchProgress.processedPages / result.batchProgress.totalPages) * 100),
          },
          errors: [`עיבוד בהתקדמות: ${result.batchProgress.processedPages}/${result.batchProgress.totalPages} עמודים. נא להמשיך.`],
        };
      }

      // Extraction complete - now create chunks and save
      logger.info(`🎉 Extraction complete! Creating chunks...`);

      // Get the final pages from either result or the saved progress
      // When extraction completes, pages are in result.batchProgress OR in the original batchProgress
      const finalPages = result.batchProgress?.pages || batchProgress.pages;

      if (!finalPages || finalPages.length === 0) {
        throw new Error('No pages found after extraction completed');
      }

      logger.info(`📄 Processing ${finalPages.length} extracted pages`);

      // Delete progress document
      await db.collection('extraction_progress').doc(progressId).delete();

      // Use KnowledgeService to complete the upload
      const service = new KnowledgeService(openAiApiKey.value(), geminiApiKey.value());

      // Build the full text from all pages
      const fullText = finalPages
        .sort((a: any, b: any) => a.pageNumber - b.pageNumber)
        .map((p: any) => `<!-- עמוד ${p.pageNumber} -->\n${p.consensusText}`)
        .join('\n\n---\n\n');

      // Re-process to create chunks (this uses the extracted text, not re-extracts)
      const { EmbeddingService } = await import('../services/knowledgeBase/embeddingService');
      const embeddingService = new EmbeddingService(openAiApiKey.value());

      // Parse chapters from full text
      const chapters = parseChaptersFromText(fullText);

      // Create chunks
      const chunks = createChunksFromChapters(chapters, {
        subject: metadata.subject,
        grade: metadata.grade,
        volume: metadata.volume,
        volumeType: metadata.volumeType,
        source: batchProgress.fileName,
      });

      if (chunks.length === 0) {
        throw new Error('לא נוצרו chunks מהטקסט המחולץ');
      }

      // Generate embeddings
      logger.info(`🔢 Generating embeddings for ${chunks.length} chunks...`);
      const texts = chunks.map((c: any) => c.content);
      const embeddingResults = await embeddingService.generateEmbeddingsBatch(texts);

      // Save to Firestore
      const { v4: uuidv4 } = await import('uuid');
      const { Timestamp } = await import('firebase-admin/firestore');
      const documentId = uuidv4();
      const BATCH_SIZE = 10;
      let savedCount = 0;

      for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
        const batch = db.batch();
        const batchEnd = Math.min(batchStart + BATCH_SIZE, chunks.length);

        for (let i = batchStart; i < batchEnd; i++) {
          const chunk = chunks[i];
          const embeddingResult = embeddingResults[i];

          if (!embeddingResult.embedding || embeddingResult.embedding.length === 0) {
            continue;
          }

          const chunkId = `${documentId}_${i}`;
          const docRef = db.collection('math_knowledge').doc(chunkId);

          batch.set(docRef, {
            id: chunkId,
            ...chunk,
            embedding: embeddingResult.embedding,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          savedCount++;
        }

        await batch.commit();
        logger.info(`💾 Saved batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`);
      }

      logger.info(`✅ Upload complete: ${savedCount} chunks saved`);

      // Calculate confidence from finalPages
      const avgConfidence = finalPages.reduce((sum: number, p: any) => sum + (p.agreementScore || 0.85), 0) / finalPages.length;
      const pagesNeedingReview = result.batchProgress?.pagesNeedingReview || batchProgress.pagesNeedingReview || [];

      // Save extraction review for manual inspection
      try {
        const extractionResultForReview = {
          fileName: batchProgress.fileName,
          totalPages: finalPages.length,
          averageConfidence: avgConfidence,
          pagesNeedingReview: pagesNeedingReview,
          pages: finalPages.map((p: any) => ({
            pageNumber: p.pageNumber,
            consensusText: p.consensusText,
            verificationText: p.verificationText || '',
            confidence: p.confidence || 'medium',
            agreementScore: p.agreementScore || 0.85,
            needsReview: pagesNeedingReview.includes(p.pageNumber),
          })),
        };

        await service.saveExtractionReview(extractionResultForReview as any, {
          documentId,
          storagePath: metadata.storagePath,
          grade: metadata.grade,
          volume: metadata.volume,
          volumeType: metadata.volumeType,
          subject: metadata.subject,
        });
        logger.info(`📝 Saved extraction review for manual inspection`);
      } catch (reviewError: any) {
        logger.warn(`⚠️ Failed to save extraction review: ${reviewError.message}`);
      }

      return {
        success: true,
        documentId,
        chunksCreated: savedCount,
        chaptersFound: chapters.map((c: any) => c.name),
        processingTimeMs: Date.now() - progressData.startedAt,
        extractionQuality: {
          method: 'high_quality_batch',
          averageConfidence: avgConfidence,
          pagesNeedingReview: pagesNeedingReview,
        },
      };
    } catch (error: any) {
      logger.error('Continue extraction failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// Helper function to parse chapters from text
function parseChaptersFromText(fullText: string): { name: string; content: string; chapterNumber: number }[] {
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

// Helper function to create chunks from chapters
function createChunksFromChapters(
  chapters: { name: string; content: string; chapterNumber: number }[],
  metadata: { subject: string; grade: string; volume: number; volumeType: string; source: string }
): any[] {
  const CHUNK_CONFIG = {
    maxTokens: 500,
    minChunkLength: 100,
  };

  const estimateTokens = (text: string) => Math.ceil(text.length / 3);

  const chunks: any[] = [];

  for (const chapter of chapters) {
    const paragraphs = chapter.content.split(/\n\n+/);
    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = estimateTokens(paragraph);

      if (currentTokens + paragraphTokens > CHUNK_CONFIG.maxTokens && currentChunk.length >= CHUNK_CONFIG.minChunkLength) {
        chunks.push({
          subject: metadata.subject,
          grade: metadata.grade,
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
        subject: metadata.subject,
        grade: metadata.grade,
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

  return chunks;
}

// ============================================
// EXTRACTION REVIEW FUNCTIONS
// ============================================

/**
 * Create extraction review for an existing book (one-time migration)
 * Admin only
 */
export const createReviewForExistingBook = onCall(
  {
    cors: true,
    secrets: [openAiApiKey, geminiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { grade, volume, volumeType } = request.data;

    logger.info(`📝 Creating review for existing book: grade=${grade}, volume=${volume}, type=${volumeType}`);

    try {
      // Get all chunks for the specified book
      const chunksSnapshot = await db.collection('math_knowledge')
        .where('grade', '==', grade)
        .where('volume', '==', volume)
        .where('volumeType', '==', volumeType)
        .get();

      if (chunksSnapshot.empty) {
        throw new HttpsError('not-found', 'לא נמצאו קטעים לספר זה');
      }

      logger.info(`Found ${chunksSnapshot.size} chunks`);

      // Extract page numbers and content from chunks
      const pageMap = new Map<number, string>();
      let totalPages = 0;

      chunksSnapshot.forEach(doc => {
        const data = doc.data();
        // Try to extract page number from content
        const pageMatches = data.content?.match(/עמוד (\d+)/g) || [];
        pageMatches.forEach((match: string) => {
          const pageNum = parseInt(match.replace('עמוד ', ''));
          if (!pageMap.has(pageNum)) {
            pageMap.set(pageNum, data.content);
          }
          if (pageNum > totalPages) totalPages = pageNum;
        });
      });

      // If no pages found from content, estimate from chunks
      if (totalPages === 0) {
        totalPages = Math.max(chunksSnapshot.size * 2, 100); // Estimate
      }

      logger.info(`Estimated total pages: ${totalPages}`);

      // Create pages array
      const pages = [];
      for (let i = 1; i <= totalPages; i++) {
        pages.push({
          pageNumber: i,
          extractedText: pageMap.get(i) || `תוכן עמוד ${i}`,
          verificationText: '',
          confidence: 'medium',
          agreementScore: 0.85,
          needsReview: true,
        });
      }

      // Get document ID from first chunk
      const firstChunk = chunksSnapshot.docs[0].data();
      const documentId = firstChunk.id?.split('_')[0] || `book-${grade}-${volume}-${volumeType}`;

      // Create review document
      const { v4: uuidv4 } = await import('uuid');
      const { Timestamp } = await import('firebase-admin/firestore');
      const reviewId = uuidv4();

      const review = {
        id: reviewId,
        documentId,
        fileName: `ספר ${volumeType === 'teacher' ? 'מורה' : 'תלמיד'} כיתה ${grade} כרך ${volume}.pdf`,
        storagePath: `knowledge_pdfs/${documentId}.pdf`,
        grade,
        volume,
        volumeType,
        subject: 'math',
        pages,
        totalPages,
        averageConfidence: 0.85,
        pagesNeedingReview: Array.from({length: totalPages}, (_, i) => i + 1),
        status: 'pending_review',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await db.collection('extraction_reviews').doc(reviewId).set(review);

      logger.info(`✅ Created review ${reviewId} with ${totalPages} pages`);

      return {
        success: true,
        reviewId,
        totalPages,
        chunksFound: chunksSnapshot.size,
      };
    } catch (error: any) {
      logger.error('Create review failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get all extraction reviews (pending and completed)
 * Admin only
 */
export const getExtractionReviews = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { pendingOnly } = request.data || {};

    logger.info(`📋 Getting extraction reviews, pendingOnly: ${pendingOnly}`);

    try {
      const service = new KnowledgeService(openAiApiKey.value());

      const reviews = pendingOnly
        ? await service.getPendingReviews()
        : await service.getAllReviews();

      logger.info(`📋 Found ${reviews.length} reviews`);

      // Don't send full page data in list view - too large
      const summaries = reviews.map(r => ({
        id: r.id,
        documentId: r.documentId,
        fileName: r.fileName,
        grade: r.grade,
        volume: r.volume,
        volumeType: r.volumeType,
        totalPages: r.totalPages,
        averageConfidence: r.averageConfidence,
        pagesNeedingReview: r.pagesNeedingReview,
        status: r.status,
        createdAt: r.createdAt,
      }));

      return { reviews: summaries };
    } catch (error: any) {
      logger.error('Get reviews failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get a specific extraction review with all page data
 * Admin only
 */
export const getExtractionReview = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { reviewId } = request.data;

    if (!reviewId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה סקירה');
    }

    try {
      const service = new KnowledgeService(openAiApiKey.value());
      const review = await service.getExtractionReview(reviewId);

      if (!review) {
        throw new HttpsError('not-found', 'סקירה לא נמצאה');
      }

      return { review };
    } catch (error: any) {
      logger.error('Get review failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Correct extracted text for a specific page
 * Admin only
 */
export const correctPageExtraction = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { reviewId, pageNumber, correctedText } = request.data;

    if (!reviewId || !pageNumber || correctedText === undefined) {
      throw new HttpsError('invalid-argument', 'חסרים פרטים');
    }

    logger.info(`✏️ Admin ${request.auth.uid} correcting page ${pageNumber} in review ${reviewId}`);

    try {
      const service = new KnowledgeService(openAiApiKey.value());
      await service.correctPageExtraction(
        reviewId,
        pageNumber,
        correctedText,
        request.auth.uid
      );

      return { success: true };
    } catch (error: any) {
      logger.error('Correct page failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Approve extraction review and regenerate chunks
 * Admin only
 */
export const approveExtractionReview = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { reviewId } = request.data;

    if (!reviewId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה סקירה');
    }

    logger.info(`✅ Admin ${request.auth.uid} approving review ${reviewId}`);

    try {
      const service = new KnowledgeService(openAiApiKey.value());
      const result = await service.approveExtractionReview(reviewId, request.auth.uid);

      return {
        success: true,
        chunksUpdated: result.chunksUpdated,
      };
    } catch (error: any) {
      logger.error('Approve review failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);
