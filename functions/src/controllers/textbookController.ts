// textbookController.ts - Cloud Functions for Textbook Management

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';

import { TextbookService } from '../services/textbook/textbookService';

const openAiApiKey = defineSecret('OPENAI_API_KEY');
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

// Helper to check if user is a teacher
async function isTeacher(uid: string): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    return userData?.role === 'teacher' || userData?.role === 'admin' || userData?.isAdmin === true;
  } catch {
    return false;
  }
}

/**
 * Get list of available textbooks
 * Available to all teachers
 */
export const getTextbooks = onCall(
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

    // 2. Verify teacher role
    const userIsTeacher = await isTeacher(request.auth.uid);
    if (!userIsTeacher) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מורה');
    }

    const { subject, grade, volumeType } = request.data || {};

    logger.info(`📚 User ${request.auth.uid} fetching textbooks with filters: subject=${subject}, grade=${grade}, volumeType=${volumeType}`);

    try {
      const service = new TextbookService(openAiApiKey.value());
      const textbooks = await service.getTextbooks({
        subject,
        grade,
        volumeType,
      });

      return { textbooks };
    } catch (error: any) {
      logger.error('Get textbooks failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get full textbook details including table of contents
 * Available to all teachers
 */
export const getTextbookDetails = onCall(
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

    const userIsTeacher = await isTeacher(request.auth.uid);
    if (!userIsTeacher) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מורה');
    }

    const { textbookId } = request.data;

    if (!textbookId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה ספר');
    }

    logger.info(`📚 User ${request.auth.uid} fetching textbook details: ${textbookId}`);

    try {
      const service = new TextbookService(openAiApiKey.value());
      const textbook = await service.getTextbookDetails(textbookId);

      if (!textbook) {
        throw new HttpsError('not-found', 'ספר לא נמצא');
      }

      return { textbook };
    } catch (error: any) {
      logger.error('Get textbook details failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get content for a specific chapter/section
 * Available to all teachers
 */
export const getChapterContent = onCall(
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

    const userIsTeacher = await isTeacher(request.auth.uid);
    if (!userIsTeacher) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מורה');
    }

    const { textbookId, tocEntryId, includeChildren, contentTypes } = request.data;

    if (!textbookId || !tocEntryId) {
      throw new HttpsError('invalid-argument', 'חסרים מזהה ספר או פרק');
    }

    logger.info(`📚 User ${request.auth.uid} fetching chapter content: ${textbookId}/${tocEntryId}`);

    try {
      const service = new TextbookService(openAiApiKey.value());
      const chunks = await service.getChapterContent(textbookId, tocEntryId, {
        includeChildren: includeChildren !== false,
        contentTypes,
      });

      return { chunks };
    } catch (error: any) {
      logger.error('Get chapter content failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Semantic search within a specific textbook
 * Available to all teachers
 */
export const searchWithinTextbook = onCall(
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

    const userIsTeacher = await isTeacher(request.auth.uid);
    if (!userIsTeacher) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מורה');
    }

    const { textbookId, query, tocEntryIds, contentTypes, limit } = request.data;

    if (!textbookId || !query) {
      throw new HttpsError('invalid-argument', 'חסרים מזהה ספר או שאילתת חיפוש');
    }

    logger.info(`🔍 User ${request.auth.uid} searching in textbook ${textbookId}: "${query}"`);

    try {
      const service = new TextbookService(openAiApiKey.value());
      const results = await service.searchWithinTextbook(textbookId, query, {
        tocEntryIds,
        contentTypes,
        limit: Math.min(limit || 10, 30),
      });

      return { results };
    } catch (error: any) {
      logger.error('Search within textbook failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Get textbook-aligned context for AI generation
 * Available to all teachers
 */
export const getTextbookContext = onCall(
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

    const userIsTeacher = await isTeacher(request.auth.uid);
    if (!userIsTeacher) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מורה');
    }

    const {
      textbookId,
      tocEntryIds,
      topic,
      includeTeacherGuide,
      prioritizeExamples,
      prioritizeExercises,
      maxChunks,
    } = request.data;

    if (!textbookId || !tocEntryIds || tocEntryIds.length === 0) {
      throw new HttpsError('invalid-argument', 'חסרים מזהה ספר או פרקים נבחרים');
    }

    logger.info(`📚 User ${request.auth.uid} getting textbook context: ${textbookId}, chapters: ${tocEntryIds.length}`);

    try {
      const service = new TextbookService(openAiApiKey.value());
      const response = await service.searchForTextbookContext(textbookId, tocEntryIds, {
        topic,
        includeTeacherGuide: includeTeacherGuide !== false,
        prioritizeExamples,
        prioritizeExercises,
        maxChunks: maxChunks || 10,
      });

      return response;
    } catch (error: any) {
      logger.error('Get textbook context failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Create textbook record from existing knowledge base upload
 * Admin only - used for migrating existing uploads
 */
export const createTextbookFromDocument = onCall(
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

    const { documentId, grade, volume, volumeType, subject, fileName } = request.data;

    if (!documentId || !grade || !volume || !volumeType || !subject) {
      throw new HttpsError('invalid-argument', 'חסרים פרטים');
    }

    logger.info(`📚 Admin ${request.auth.uid} creating textbook from document: ${documentId}`);

    try {
      const service = new TextbookService(openAiApiKey.value());
      const textbook = await service.createTextbookFromUpload(documentId, {
        grade,
        volume,
        volumeType,
        subject,
        fileName: fileName || `ספר ${grade} כרך ${volume}`,
        uploadedBy: request.auth.uid,
      });

      return {
        success: true,
        textbook: {
          id: textbook.id,
          title: textbook.title,
          chaptersCount: textbook.tableOfContents.length,
          totalChunks: textbook.totalChunks,
        },
      };
    } catch (error: any) {
      logger.error('Create textbook failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Delete a textbook (and optionally its chunks)
 * Admin only
 */
export const deleteTextbook = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { textbookId, deleteChunks } = request.data;

    if (!textbookId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה ספר');
    }

    logger.info(`🗑️ Admin ${request.auth.uid} deleting textbook: ${textbookId}, deleteChunks: ${deleteChunks}`);

    try {
      const service = new TextbookService(openAiApiKey.value());
      await service.deleteTextbook(textbookId, deleteChunks === true);

      return { success: true };
    } catch (error: any) {
      logger.error('Delete textbook failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

/**
 * Migrate all existing knowledge base books to textbook records
 * Admin only - one-time migration
 */
export const migrateKnowledgeBooksToTextbooks = onCall(
  {
    cors: true,
    secrets: [openAiApiKey],
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

    logger.info(`📚 Admin ${request.auth.uid} starting knowledge base migration to textbooks`);

    try {
      // Get all unique books from knowledge base
      const snapshot = await db.collection('math_knowledge').get();

      // Group by unique book (grade + volume + volumeType)
      const booksMap = new Map<string, {
        documentId: string;
        grade: string;
        volume: number;
        volumeType: 'student' | 'teacher';
        subject: string;
        source?: string;
      }>();

      snapshot.forEach(doc => {
        const data = doc.data();
        const key = `${data.grade}-${data.volume}-${data.volumeType}`;

        if (!booksMap.has(key)) {
          // Extract documentId from chunk ID (format: documentId_chunkIndex)
          const documentId = data.id?.split('_')[0] || key;

          booksMap.set(key, {
            documentId,
            grade: data.grade,
            volume: data.volume || 1,
            volumeType: data.volumeType,
            subject: data.subject || 'math',
            source: data.source,
          });
        }
      });

      logger.info(`📚 Found ${booksMap.size} unique books to migrate`);

      // Check which books already have textbook records
      const existingTextbooksSnapshot = await db.collection('textbooks').get();
      const existingBooks = new Set<string>();

      existingTextbooksSnapshot.forEach(doc => {
        const data = doc.data();
        existingBooks.add(`${data.grade}-${data.volume}-${data.volumeType}`);
      });

      // Create textbook records for books that don't have one
      const service = new TextbookService(openAiApiKey.value());
      const results: { key: string; success: boolean; error?: string }[] = [];

      for (const [key, bookData] of booksMap) {
        if (existingBooks.has(key)) {
          logger.info(`⏭️ Skipping ${key} - already has textbook record`);
          results.push({ key, success: true });
          continue;
        }

        try {
          await service.createTextbookFromUpload(bookData.documentId, {
            grade: bookData.grade,
            volume: bookData.volume,
            volumeType: bookData.volumeType,
            subject: bookData.subject,
            fileName: bookData.source || `ספר ${bookData.grade} כרך ${bookData.volume}`,
            uploadedBy: request.auth!.uid,
          });

          logger.info(`✅ Created textbook for ${key}`);
          results.push({ key, success: true });
        } catch (error: any) {
          logger.error(`❌ Failed to create textbook for ${key}:`, error);
          results.push({ key, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return {
        success: true,
        totalBooks: booksMap.size,
        created: successCount,
        failed: failCount,
        results,
      };
    } catch (error: any) {
      logger.error('Migration failed:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);
