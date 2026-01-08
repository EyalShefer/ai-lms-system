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
    secrets: [openAiApiKey],
    memory: '1GiB',
    timeoutSeconds: 300, // 5 minutes for large PDFs
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
      const service = new KnowledgeService(openAiApiKey.value());

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

    logger.info(`🔍 User ${request.auth.uid} searching: "${query}"`);

    try {
      const service = new KnowledgeService(openAiApiKey.value());

      const result = await service.search({
        query,
        filters,
        limit: Math.min(limit || 5, 20), // Max 20 results
        minSimilarity: minSimilarity || 0.7,
      });

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
