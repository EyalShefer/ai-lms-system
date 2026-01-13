// examDnaExtractor.ts - Extract Exam DNA (structure, distributions) from reference exams
// Uses AI to analyze exam structure without storing actual questions

import * as logger from 'firebase-functions/logger';
import { GoogleGenAI } from '@google/genai';
import { Timestamp } from 'firebase-admin/firestore';
import { ExamDNA, Grade, Subject } from './types';

/**
 * Raw analysis result from AI before normalization
 */
interface RawExamAnalysis {
  questionCount: number;
  totalPoints: number;
  estimatedDurationMinutes: number;

  // Raw counts (will be converted to percentages)
  questionTypes: {
    multiple_choice: number;
    true_false: number;
    open_question: number;
    fill_in_blanks: number;
    ordering: number;
    categorization: number;
  };

  bloomLevels: {
    remember: number;
    understand: number;
    apply: number;
    analyze: number;
    evaluate: number;
    create: number;
  };

  difficultyLevels: {
    easy: number;
    medium: number;
    hard: number;
  };

  style: {
    averageQuestionLengthWords: number;
    usesRealWorldContext: boolean;
    usesVisualElements: boolean;
    formalityLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * ExamDnaExtractor - Extracts structural DNA from reference exams
 *
 * This service analyzes uploaded exam PDFs and extracts their "DNA":
 * - Question count and types
 * - Difficulty distribution
 * - Bloom taxonomy distribution
 * - Linguistic style patterns
 *
 * Important: We do NOT store the actual questions, only the structural patterns.
 */
export class ExamDnaExtractor {
  private genAI: GoogleGenAI;

  constructor(_projectId: string = 'ai-lms-pro') {
    this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with retry and exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.message?.includes('429') ||
                           error.message?.includes('RESOURCE_EXHAUSTED') ||
                           error.message?.includes('quota');

        if (isRateLimit && attempt < maxRetries) {
          const delay = Math.min(10000 * Math.pow(2, attempt - 1), 60000);
          logger.warn(`Rate limit hit for ${operationName}, attempt ${attempt}/${maxRetries}. Waiting ${delay/1000}s...`);
          await this.sleep(delay);
        } else if (!isRateLimit) {
          throw error;
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
  }

  /**
   * Convert counts to percentages, ensuring they sum to 100
   */
  private toPercentages(counts: Record<string, number>): Record<string, number> {
    const total = Object.values(counts).reduce((sum, val) => sum + val, 0);
    if (total === 0) {
      // Return equal distribution if no data
      const keys = Object.keys(counts);
      const equalShare = Math.floor(100 / keys.length);
      const result: Record<string, number> = {};
      keys.forEach((key, index) => {
        result[key] = index === keys.length - 1
          ? 100 - (equalShare * (keys.length - 1))
          : equalShare;
      });
      return result;
    }

    const result: Record<string, number> = {};
    let sumSoFar = 0;
    const keys = Object.keys(counts);

    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        // Last item gets the remainder to ensure sum is exactly 100
        result[key] = 100 - sumSoFar;
      } else {
        result[key] = Math.round((counts[key] / total) * 100);
        sumSoFar += result[key];
      }
    });

    return result;
  }

  /**
   * Build the extraction prompt
   */
  private buildExtractionPrompt(grade: string, subject: string): string {
    return `אתה מנתח מבחנים חינוכיים. נתח את המבחן הבא וחלץ את המאפיינים המבניים שלו.

מידע על המבחן:
- כיתה: ${grade}
- מקצוע: ${subject}

משימתך:
1. זהה את כל השאלות במבחן
2. סווג כל שאלה לפי הקטגוריות הבאות
3. החזר JSON מובנה (בלבד, ללא טקסט נוסף)

קטגוריות סוגי שאלות:
- multiple_choice: שאלת רב-ברירה (בחירה מתוך אפשרויות)
- true_false: נכון/לא נכון
- open_question: שאלה פתוחה (דורשת הסבר או חישוב מפורט)
- fill_in_blanks: השלמת חסר
- ordering: סידור/מיון לפי סדר
- categorization: מיון לקטגוריות

רמות בלום:
- remember: זכירה (שליפת עובדות)
- understand: הבנה (הסבר במילים שלהם)
- apply: יישום (פתרון בעיות)
- analyze: ניתוח (פירוק לחלקים)
- evaluate: הערכה (שיפוט, השוואה)
- create: יצירה (חידוש, הרכבה)

רמות קושי:
- easy: קל (שליפה ישירה או חישוב פשוט)
- medium: בינוני (דורש כמה שלבים)
- hard: קשה (דורש חשיבה מורכבת)

סגנון:
- formalityLevel: רמת הפורמליות (low/medium/high)
- usesRealWorldContext: האם יש הקשר יומיומי (true/false)
- usesVisualElements: האם יש תמונות/טבלאות/גרפים (true/false)

החזר JSON בפורמט הבא בלבד:
{
  "questionCount": <מספר>,
  "totalPoints": <מספר>,
  "estimatedDurationMinutes": <מספר>,
  "questionTypes": {
    "multiple_choice": <כמות>,
    "true_false": <כמות>,
    "open_question": <כמות>,
    "fill_in_blanks": <כמות>,
    "ordering": <כמות>,
    "categorization": <כמות>
  },
  "bloomLevels": {
    "remember": <כמות>,
    "understand": <כמות>,
    "apply": <כמות>,
    "analyze": <כמות>,
    "evaluate": <כמות>,
    "create": <כמות>
  },
  "difficultyLevels": {
    "easy": <כמות>,
    "medium": <כמות>,
    "hard": <כמות>
  },
  "style": {
    "averageQuestionLengthWords": <מספר>,
    "usesRealWorldContext": <true/false>,
    "usesVisualElements": <true/false>,
    "formalityLevel": "<low/medium/high>"
  }
}

חשוב: החזר רק את ה-JSON, ללא הסברים או טקסט נוסף.`;
  }

  /**
   * Extract DNA from exam PDF using Gemini
   */
  async extractDNA(
    pdfBase64: string,
    metadata: { grade: Grade; subject: Subject }
  ): Promise<ExamDNA> {
    const startTime = Date.now();
    logger.info(`Starting DNA extraction for ${metadata.subject} grade ${metadata.grade}`);

    try {
      const rawAnalysis = await this.analyzeExamWithAI(pdfBase64, metadata);

      // Convert counts to percentages
      const questionTypeDistribution = this.toPercentages(rawAnalysis.questionTypes) as ExamDNA['questionTypeDistribution'];
      const bloomDistribution = this.toPercentages(rawAnalysis.bloomLevels) as ExamDNA['bloomDistribution'];
      const difficultyDistribution = this.toPercentages(rawAnalysis.difficultyLevels) as ExamDNA['difficultyDistribution'];

      const examDna: ExamDNA = {
        questionCount: rawAnalysis.questionCount,
        totalPoints: rawAnalysis.totalPoints,
        estimatedDurationMinutes: rawAnalysis.estimatedDurationMinutes,
        questionTypeDistribution,
        bloomDistribution,
        difficultyDistribution,
        linguisticStyle: {
          averageQuestionLengthWords: rawAnalysis.style.averageQuestionLengthWords,
          usesRealWorldContext: rawAnalysis.style.usesRealWorldContext,
          usesVisualElements: rawAnalysis.style.usesVisualElements,
          formalityLevel: rawAnalysis.style.formalityLevel,
        },
        extractedAt: Timestamp.now(),
        extractionConfidence: 0.85, // Base confidence, could be improved with multi-model consensus
      };

      const processingTime = Date.now() - startTime;
      logger.info(`DNA extraction completed in ${processingTime}ms. Found ${examDna.questionCount} questions.`);

      return examDna;
    } catch (error: any) {
      logger.error('DNA extraction failed:', error);
      throw new Error(`Failed to extract exam DNA: ${error.message}`);
    }
  }

  /**
   * Call Gemini to analyze the exam
   */
  private async analyzeExamWithAI(
    pdfBase64: string,
    metadata: { grade: string; subject: string }
  ): Promise<RawExamAnalysis> {
    const prompt = this.buildExtractionPrompt(metadata.grade, metadata.subject);

    return this.withRetry(async () => {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfBase64
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0.1, // Low temperature for consistent analysis
          maxOutputTokens: 4096,
        }
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as RawExamAnalysis;

      // Validate required fields
      if (typeof parsed.questionCount !== 'number' || parsed.questionCount < 1) {
        throw new Error('Invalid questionCount in response');
      }

      return parsed;
    }, 'Gemini exam analysis');
  }

  /**
   * Validate that a DNA object has valid distributions
   */
  validateDNA(dna: ExamDNA): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check question count
    if (dna.questionCount < 1) {
      errors.push('Question count must be at least 1');
    }

    // Check distributions sum to ~100 (allowing small rounding errors)
    const checkSum = (dist: Record<string, number>, name: string) => {
      const sum = Object.values(dist).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 1) {
        errors.push(`${name} distribution sums to ${sum}, expected 100`);
      }
    };

    checkSum(dna.questionTypeDistribution, 'Question type');
    checkSum(dna.bloomDistribution, 'Bloom taxonomy');
    checkSum(dna.difficultyDistribution, 'Difficulty');

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Create default ExamDNA for fallback scenarios
 */
export function createDefaultExamDNA(questionCount: number = 10): ExamDNA {
  return {
    questionCount,
    totalPoints: questionCount * 10,
    estimatedDurationMinutes: questionCount * 5,
    questionTypeDistribution: {
      multiple_choice: 40,
      true_false: 10,
      open_question: 30,
      fill_in_blanks: 10,
      ordering: 5,
      categorization: 5,
    },
    bloomDistribution: {
      remember: 20,
      understand: 25,
      apply: 30,
      analyze: 15,
      evaluate: 7,
      create: 3,
    },
    difficultyDistribution: {
      easy: 30,
      medium: 50,
      hard: 20,
    },
    linguisticStyle: {
      averageQuestionLengthWords: 20,
      usesRealWorldContext: true,
      usesVisualElements: false,
      formalityLevel: 'medium',
    },
    extractedAt: Timestamp.now(),
    extractionConfidence: 0.5, // Low confidence for default
  };
}
