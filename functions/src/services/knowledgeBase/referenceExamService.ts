// referenceExamService.ts - CRUD operations for Reference Exams

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as logger from 'firebase-functions/logger';
import { v4 as uuidv4 } from 'uuid';

import type {
  ReferenceExam,
  ReferenceExamUploadRequest,
  ReferenceExamUploadResponse,
  ExamDNA,
  Grade,
  Subject,
  ExamType,
} from './types';
import { ExamDnaExtractor, createDefaultExamDNA } from './examDnaExtractor';

const COLLECTION_NAME = 'reference_exams';
const TEXTBOOKS_COLLECTION = 'textbooks';
const KNOWLEDGE_COLLECTION = 'math_knowledge';

export class ReferenceExamService {
  private db: FirebaseFirestore.Firestore;
  private dnaExtractor: ExamDnaExtractor;

  constructor(projectId: string = 'ai-lms-pro') {
    this.db = getFirestore();
    this.dnaExtractor = new ExamDnaExtractor(projectId);
  }

  /**
   * Upload a reference exam and extract its DNA
   */
  async uploadReferenceExam(
    request: ReferenceExamUploadRequest,
    uploadedBy: string
  ): Promise<ReferenceExamUploadResponse> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      logger.info(`📤 Starting reference exam upload: ${request.fileName}`);

      // 1. Get file content
      let fileBase64: string;

      if (request.fileUrl && request.storagePath) {
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

      // 2. Get textbook name for display
      const textbookName = await this.getTextbookName(request.linkedTextbookId);

      // 3. Extract DNA from the exam
      logger.info('🧬 Extracting exam DNA...');
      let examDna: ExamDNA;
      try {
        examDna = await this.dnaExtractor.extractDNA(fileBase64, {
          grade: request.grade,
          subject: request.subject,
        });
      } catch (extractError: any) {
        logger.warn(`DNA extraction failed, using default: ${extractError.message}`);
        errors.push(`DNA extraction partial: ${extractError.message}`);
        examDna = createDefaultExamDNA();
      }

      // 4. Validate DNA
      const validation = this.dnaExtractor.validateDNA(examDna);
      if (!validation.valid) {
        logger.warn('DNA validation issues:', validation.errors);
        errors.push(...validation.errors);
      }

      // 5. Create reference exam document
      const examId = uuidv4();
      const referenceExam: ReferenceExam = {
        id: examId,
        documentType: 'reference_exam',
        linkedTextbookId: request.linkedTextbookId,
        linkedTextbookName: textbookName,
        chapters: request.chapters,
        subject: request.subject,
        grade: request.grade,
        examType: request.examType,
        fileName: request.fileName,
        storagePath: request.storagePath || '',
        examDna,
        source: request.source,
        year: request.year,
        uploadedBy,
        uploadedAt: Timestamp.now(),
        usageCount: 0,
      };

      // 6. Save to Firestore
      await this.db.collection(COLLECTION_NAME).doc(examId).set(referenceExam);
      logger.info(`✅ Reference exam saved: ${examId}`);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        examId,
        examDna,
        linkedTextbookName: textbookName,
        processingTimeMs: processingTime,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      logger.error('Reference exam upload failed:', error);
      return {
        success: false,
        examId: '',
        examDna: null,
        linkedTextbookName: '',
        processingTimeMs: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Get textbook name by ID
   * First tries the textbooks collection, then falls back to knowledge chunks
   */
  private async getTextbookName(textbookId: string): Promise<string> {
    // Try textbooks collection first
    const textbookDoc = await this.db.collection(TEXTBOOKS_COLLECTION).doc(textbookId).get();
    if (textbookDoc.exists) {
      const data = textbookDoc.data();
      return data?.title || 'ספר לא ידוע';
    }

    // Fall back to extracting info from textbookId format (e.g., "math_ב_1_student")
    const parts = textbookId.split('_');
    if (parts.length >= 4) {
      const subject = parts[0] === 'math' ? 'מתמטיקה' : parts[0];
      const grade = parts[1];
      const volume = parts[2];
      const type = parts[3] === 'student' ? 'ספר תלמיד' : 'מדריך למורה';
      return `${subject} כיתה ${grade}׳ כרך ${volume} (${type})`;
    }

    return textbookId;
  }

  /**
   * Find matching reference exams for given textbook and chapters
   * Used for automatic template selection during exam generation
   */
  async findMatchingExams(
    textbookId: string,
    chapters: number[]
  ): Promise<ReferenceExam[]> {
    logger.info(`🔍 Finding matching exams for textbook ${textbookId}, chapters: ${chapters.join(', ')}`);

    // Query exams for this textbook
    const snapshot = await this.db
      .collection(COLLECTION_NAME)
      .where('linkedTextbookId', '==', textbookId)
      .get();

    if (snapshot.empty) {
      logger.info('No reference exams found for this textbook');
      return [];
    }

    // Filter and score by chapter overlap
    const matches: { exam: ReferenceExam; score: number }[] = [];

    snapshot.forEach(doc => {
      const exam = doc.data() as ReferenceExam;

      // Calculate overlap score
      const examChapters = new Set(exam.chapters);
      const requestedChapters = new Set(chapters);

      // Count matching chapters
      const matchingChapters = chapters.filter(ch => examChapters.has(ch)).length;

      if (matchingChapters > 0) {
        // Score based on:
        // 1. Number of matching chapters
        // 2. Penalty for extra chapters in exam (too broad)
        // 3. Penalty for missing chapters (incomplete coverage)
        const overlapScore = matchingChapters / Math.max(examChapters.size, requestedChapters.size);

        matches.push({ exam, score: overlapScore });
      }
    });

    // Sort by score (highest first) and return
    matches.sort((a, b) => b.score - a.score);

    logger.info(`Found ${matches.length} matching exams`);
    return matches.map(m => m.exam);
  }

  /**
   * Get a specific reference exam by ID
   */
  async getReferenceExam(examId: string): Promise<ReferenceExam | null> {
    const doc = await this.db.collection(COLLECTION_NAME).doc(examId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as ReferenceExam;
  }

  /**
   * List all reference exams with optional filters
   */
  async listReferenceExams(filters?: {
    grade?: Grade;
    subject?: Subject;
    textbookId?: string;
    examType?: ExamType;
  }): Promise<ReferenceExam[]> {
    let query: FirebaseFirestore.Query = this.db.collection(COLLECTION_NAME);

    if (filters?.grade) {
      query = query.where('grade', '==', filters.grade);
    }
    if (filters?.subject) {
      query = query.where('subject', '==', filters.subject);
    }
    if (filters?.textbookId) {
      query = query.where('linkedTextbookId', '==', filters.textbookId);
    }
    if (filters?.examType) {
      query = query.where('examType', '==', filters.examType);
    }

    const snapshot = await query.orderBy('uploadedAt', 'desc').get();

    const exams: ReferenceExam[] = [];
    snapshot.forEach(doc => {
      exams.push(doc.data() as ReferenceExam);
    });

    return exams;
  }

  /**
   * Delete a reference exam
   */
  async deleteReferenceExam(examId: string): Promise<void> {
    const doc = await this.db.collection(COLLECTION_NAME).doc(examId).get();

    if (!doc.exists) {
      throw new Error(`Reference exam ${examId} not found`);
    }

    // Optionally delete the PDF from storage
    const exam = doc.data() as ReferenceExam;
    if (exam.storagePath) {
      try {
        const storage = getStorage();
        await storage.bucket().file(exam.storagePath).delete();
        logger.info(`Deleted storage file: ${exam.storagePath}`);
      } catch (storageError) {
        logger.warn(`Failed to delete storage file: ${storageError}`);
        // Continue with Firestore deletion even if storage deletion fails
      }
    }

    await this.db.collection(COLLECTION_NAME).doc(examId).delete();
    logger.info(`Deleted reference exam: ${examId}`);
  }

  /**
   * Increment usage count when an exam is used as a template
   */
  async incrementUsageCount(examId: string): Promise<void> {
    await this.db.collection(COLLECTION_NAME).doc(examId).update({
      usageCount: FieldValue.increment(1),
    });
  }

  /**
   * Get statistics about reference exams
   */
  async getStats(): Promise<{
    totalExams: number;
    byGrade: Record<string, number>;
    bySubject: Record<string, number>;
    byExamType: Record<string, number>;
    mostUsed: { examId: string; textbookName: string; usageCount: number }[];
  }> {
    const snapshot = await this.db.collection(COLLECTION_NAME).get();

    const stats = {
      totalExams: snapshot.size,
      byGrade: {} as Record<string, number>,
      bySubject: {} as Record<string, number>,
      byExamType: {} as Record<string, number>,
      mostUsed: [] as { examId: string; textbookName: string; usageCount: number }[],
    };

    const examsForSorting: { examId: string; textbookName: string; usageCount: number }[] = [];

    snapshot.forEach(doc => {
      const exam = doc.data() as ReferenceExam;

      // Count by grade
      stats.byGrade[exam.grade] = (stats.byGrade[exam.grade] || 0) + 1;

      // Count by subject
      stats.bySubject[exam.subject] = (stats.bySubject[exam.subject] || 0) + 1;

      // Count by exam type
      stats.byExamType[exam.examType] = (stats.byExamType[exam.examType] || 0) + 1;

      // Track for most used
      examsForSorting.push({
        examId: exam.id,
        textbookName: exam.linkedTextbookName,
        usageCount: exam.usageCount,
      });
    });

    // Get top 5 most used
    examsForSorting.sort((a, b) => b.usageCount - a.usageCount);
    stats.mostUsed = examsForSorting.slice(0, 5);

    return stats;
  }

  /**
   * Get list of available textbooks for linking
   * Returns textbook IDs and names from existing knowledge chunks
   */
  async getAvailableTextbooks(): Promise<{ id: string; name: string; grade: string; subject: string; volume: number }[]> {
    // Get unique combinations from knowledge chunks
    const snapshot = await this.db
      .collection(KNOWLEDGE_COLLECTION)
      .select('subject', 'grade', 'volume', 'volumeType')
      .get();

    const textbookMap = new Map<string, { id: string; name: string; grade: string; subject: string; volume: number }>();

    snapshot.forEach(doc => {
      const data = doc.data();
      const id = `${data.subject}_${data.grade}_${data.volume}_${data.volumeType}`;

      if (!textbookMap.has(id)) {
        const subjectName = data.subject === 'math' ? 'מתמטיקה' :
                          data.subject === 'hebrew' ? 'עברית' :
                          data.subject === 'english' ? 'אנגלית' :
                          data.subject === 'science' ? 'מדעים' :
                          data.subject === 'history' ? 'היסטוריה' : data.subject;
        const typeName = data.volumeType === 'student' ? 'ספר תלמיד' : 'מדריך למורה';

        textbookMap.set(id, {
          id,
          name: `${subjectName} כיתה ${data.grade}׳ כרך ${data.volume} (${typeName})`,
          grade: data.grade,
          subject: data.subject,
          volume: data.volume || 1,
        });
      }
    });

    return Array.from(textbookMap.values()).sort((a, b) => {
      // Sort by grade first, then by subject
      if (a.grade !== b.grade) {
        const gradeOrder = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב'];
        return gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
      }
      return a.subject.localeCompare(b.subject);
    });
  }
}
