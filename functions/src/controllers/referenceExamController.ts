// referenceExamController.ts - Cloud Functions for Reference Exams

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';

import { ReferenceExamService } from '../services/knowledgeBase/referenceExamService';
import type {
  ReferenceExamUploadRequest,
  Grade,
  Subject,
  ExamType,
} from '../services/knowledgeBase/types';

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
 * Upload a reference exam (Admin only)
 * Extracts DNA and saves to Firestore
 */
export const uploadReferenceExam = onCall(
  {
    cors: true,
    memory: '2GiB',
    timeoutSeconds: 540, // 9 minutes for DNA extraction
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
    const data = request.data as ReferenceExamUploadRequest;

    if (!data.fileBase64 && (!data.fileUrl || !data.storagePath)) {
      throw new HttpsError('invalid-argument', 'חסר קובץ');
    }
    if (!data.fileName) {
      throw new HttpsError('invalid-argument', 'חסר שם קובץ');
    }
    if (!data.linkedTextbookId) {
      throw new HttpsError('invalid-argument', 'חסר שיוך לספר לימוד');
    }
    if (!data.chapters || data.chapters.length === 0) {
      throw new HttpsError('invalid-argument', 'חסרים פרקים');
    }
    if (!data.examType) {
      throw new HttpsError('invalid-argument', 'חסר סוג מבחן');
    }

    logger.info(`📤 Admin ${request.auth.uid} uploading reference exam: ${data.fileName}`);

    try {
      const service = new ReferenceExamService();
      const result = await service.uploadReferenceExam(data, request.auth.uid);

      if (!result.success) {
        throw new HttpsError('internal', result.errors?.join(', ') || 'Upload failed');
      }

      logger.info(`✅ Reference exam uploaded: ${result.examId}`);
      return result;
    } catch (error: any) {
      logger.error('Upload reference exam failed:', error);
      throw new HttpsError('internal', `שגיאה בהעלאה: ${error.message}`);
    }
  }
);

/**
 * Get a reference exam by ID
 */
export const getReferenceExam = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { examId } = request.data as { examId: string };
    if (!examId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה מבחן');
    }

    try {
      const service = new ReferenceExamService();
      const exam = await service.getReferenceExam(examId);

      if (!exam) {
        throw new HttpsError('not-found', 'מבחן לא נמצא');
      }

      return exam;
    } catch (error: any) {
      logger.error('Get reference exam failed:', error);
      throw new HttpsError('internal', `שגיאה: ${error.message}`);
    }
  }
);

/**
 * List reference exams with optional filters
 */
export const listReferenceExams = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const filters = request.data?.filters as {
      grade?: Grade;
      subject?: Subject;
      textbookId?: string;
      examType?: ExamType;
    } | undefined;

    try {
      const service = new ReferenceExamService();
      const exams = await service.listReferenceExams(filters);
      return { exams };
    } catch (error: any) {
      logger.error('List reference exams failed:', error);
      throw new HttpsError('internal', `שגיאה: ${error.message}`);
    }
  }
);

/**
 * Delete a reference exam (Admin only)
 */
export const deleteReferenceExam = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const isUserAdmin = await isAdmin(request.auth.uid);
    if (!isUserAdmin) {
      throw new HttpsError('permission-denied', 'נדרשות הרשאות מנהל');
    }

    const { examId } = request.data as { examId: string };
    if (!examId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה מבחן');
    }

    try {
      const service = new ReferenceExamService();
      await service.deleteReferenceExam(examId);
      logger.info(`🗑️ Admin ${request.auth.uid} deleted reference exam: ${examId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('Delete reference exam failed:', error);
      throw new HttpsError('internal', `שגיאה במחיקה: ${error.message}`);
    }
  }
);

/**
 * Find matching reference exams for given textbook and chapters
 * Used during exam generation to find templates
 */
export const findMatchingReferenceExams = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    const { textbookId, chapters } = request.data as {
      textbookId: string;
      chapters: number[];
    };

    if (!textbookId) {
      throw new HttpsError('invalid-argument', 'חסר מזהה ספר');
    }
    if (!chapters || chapters.length === 0) {
      throw new HttpsError('invalid-argument', 'חסרים פרקים');
    }

    try {
      const service = new ReferenceExamService();
      const exams = await service.findMatchingExams(textbookId, chapters);
      return { exams };
    } catch (error: any) {
      logger.error('Find matching exams failed:', error);
      throw new HttpsError('internal', `שגיאה: ${error.message}`);
    }
  }
);

/**
 * Get reference exam statistics
 */
export const getReferenceExamStats = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    try {
      const service = new ReferenceExamService();
      const stats = await service.getStats();
      return stats;
    } catch (error: any) {
      logger.error('Get reference exam stats failed:', error);
      throw new HttpsError('internal', `שגיאה: ${error.message}`);
    }
  }
);

/**
 * Get available textbooks for linking
 */
export const getAvailableTextbooks = onCall(
  {
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'נדרשת הזדהות');
    }

    try {
      const service = new ReferenceExamService();
      const textbooks = await service.getAvailableTextbooks();
      return { textbooks };
    } catch (error: any) {
      logger.error('Get available textbooks failed:', error);
      throw new HttpsError('internal', `שגיאה: ${error.message}`);
    }
  }
);
