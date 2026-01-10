// highQualityExtractor.ts - High-accuracy PDF text extraction with multi-model consensus
// This is a ONE-TIME process per book that serves hundreds of thousands of queries
// Priority: MAXIMUM ACCURACY over speed or cost

import * as logger from 'firebase-functions/logger';
import { VertexAI } from '@google-cloud/vertexai';
import OpenAI from 'openai';
import { PDFDocument } from 'pdf-lib';

// Gemini has native PDF support - we send PDFs directly without image conversion
// This provides the best quality for Hebrew text extraction

export interface ExtractionResult {
  pageNumber: number;
  primaryText: string;        // Gemini extraction
  verificationText: string;   // GPT-4o verification
  consensusText: string;      // Final merged text
  confidence: 'high' | 'medium' | 'low';
  agreementScore: number;     // 0-1, how much the models agreed
  needsReview: boolean;
  extractionMethod: 'gemini_native' | 'gemini_image' | 'gpt4o_image';
}

export interface PageExtractionStatus {
  pageNumber: number;
  status: 'pending' | 'extracting' | 'verifying' | 'consensus' | 'completed' | 'needs_review' | 'error';
  confidence?: 'high' | 'medium' | 'low';
  error?: string;
}

export interface FullExtractionResult {
  fileName: string;
  totalPages: number;
  pages: ExtractionResult[];
  fullText: string;
  averageConfidence: number;
  pagesNeedingReview: number[];
  extractionTimeMs: number;
  modelsUsed: string[];
}

// For batch processing of large PDFs
export interface BatchExtractionProgress {
  fileName: string;
  totalPages: number;
  processedPages: number;
  lastProcessedPage: number;
  pages: ExtractionResult[];
  pagesNeedingReview: number[];
  startedAt: number;
  updatedAt: number;
  isComplete: boolean;
}

export interface BatchExtractionResult {
  progress: BatchExtractionProgress;
  needsMoreBatches: boolean;
  nextStartPage: number;
}

// Rate limit handling configuration
const RATE_LIMIT_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 10000,  // Start with 10 seconds
  maxDelayMs: 120000,     // Max 2 minutes
  delayBetweenPagesMs: 200,  // 0.2 seconds between pages (Vertex AI has higher limits)
  // For large PDFs, skip dual verification to fit within timeout
  largePdfThreshold: 50,  // PDFs with more than 50 pages skip verification
  // Maximum pages per batch to fit within Cloud Function timeout (9 min)
  // Each page takes ~5-7 seconds, so max ~40 pages per batch to leave buffer for save
  // 40 pages × 7 seconds = 280 seconds = ~4.7 minutes (leaving 4+ minutes buffer)
  maxPagesPerBatch: 40,
};

export class HighQualityExtractor {
  private vertexAI: VertexAI;
  private openai: OpenAI;
  private projectId: string;

  constructor(openaiApiKey: string, projectId: string = 'ai-lms-pro') {
    // Use Vertex AI instead of Google AI Studio for higher rate limits
    // Vertex AI has 60+ RPM vs Google AI Studio's 10-15 RPM
    this.vertexAI = new VertexAI({ project: projectId, location: 'us-central1' });
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.projectId = projectId;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with retry and exponential backoff for rate limits
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RATE_LIMIT_CONFIG.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.message?.includes('429') ||
                           error.message?.includes('RESOURCE_EXHAUSTED') ||
                           error.message?.includes('quota');

        if (isRateLimit && attempt < RATE_LIMIT_CONFIG.maxRetries) {
          // Calculate delay with exponential backoff
          const baseDelay = RATE_LIMIT_CONFIG.initialDelayMs * Math.pow(2, attempt - 1);
          const delay = Math.min(baseDelay, RATE_LIMIT_CONFIG.maxDelayMs);

          // Try to extract retry delay from error message
          const retryMatch = error.message?.match(/retryDelay.*?(\d+)s/);
          const suggestedDelay = retryMatch ? parseInt(retryMatch[1]) * 1000 : delay;
          const actualDelay = Math.max(delay, suggestedDelay);

          logger.warn(`⏳ Rate limit hit for ${operationName}, attempt ${attempt}/${RATE_LIMIT_CONFIG.maxRetries}. Waiting ${actualDelay/1000}s...`);
          await this.sleep(actualDelay);
        } else if (!isRateLimit) {
          // Non-rate-limit error, throw immediately
          throw error;
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after ${RATE_LIMIT_CONFIG.maxRetries} attempts`);
  }

  /**
   * Calculate Character Error Rate between two texts
   * Lower is better - 0 means identical
   */
  private calculateCER(text1: string, text2: string): number {
    const s1 = text1.replace(/\s+/g, ' ').trim();
    const s2 = text2.replace(/\s+/g, ' ').trim();

    if (s1 === s2) return 0;
    if (s1.length === 0 || s2.length === 0) return 1;

    // Simple Levenshtein-based CER
    const maxLen = Math.max(s1.length, s2.length);
    const distance = this.levenshteinDistance(s1, s2);
    return distance / maxLen;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // Use only two rows to save memory
    let prev = Array(n + 1).fill(0).map((_, i) => i);
    let curr = Array(n + 1).fill(0);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
        }
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  /**
   * Merge two extraction results, preferring the more reliable one
   */
  private mergeExtractions(primary: string, secondary: string): string {
    // If one is significantly longer, it probably captured more content
    const lenDiff = Math.abs(primary.length - secondary.length) / Math.max(primary.length, secondary.length);

    if (lenDiff > 0.3) {
      // More than 30% length difference - prefer the longer one
      return primary.length > secondary.length ? primary : secondary;
    }

    // Similar lengths - prefer Gemini (primary) as it has better Hebrew support
    return primary;
  }

  /**
   * Extract text from a single page using Vertex AI Gemini
   */
  private async extractPageWithGemini(
    pdfBase64: string,
    pageNumber: number,
    totalPages: number
  ): Promise<string> {
    const prompt = `אתה מחלץ טקסט מספר לימוד מתמטיקה בעברית. זהו עמוד ${pageNumber} מתוך ${totalPages}.

משימתך היא לחלץ את כל הטקסט בדיוק מקסימלי.

כללים קריטיים:
1. חלץ כל מילה, כל מספר, כל סימן - בדיוק כפי שהם מופיעים
2. שמור על סדר הקריאה הנכון (ימין לשמאל לעברית, שמאל לימין למספרים)
3. לכל תרגיל - כתוב את המספר המדויק ואת כל התוכן
4. משוואות מתמטיות - כתוב אותן בצורה ברורה (למשל: 5 + 3 = 8)
5. טבלאות - שמור על המבנה בפורמט Markdown
6. תמונות/איורים - תאר בסוגריים מרובעים: [תמונה: תיאור מפורט]
7. אל תדלג על שום תוכן - גם הערות קטנות וכותרות משנה
8. אם יש טקסט לא ברור - סמן אותו ב-[?לא ברור?]

פורמט הפלט:
- טקסט רגיל בעברית
- כותרות עם # (למשל: # פרק א)
- תרגילים ממוספרים כפי שהם בספר
- משוואות: \`5 + 3 = 8\` או בלוק נפרד אם מורכב

חלץ את כל הטקסט מהעמוד:`;

    return this.withRetry(async () => {
      // Use Vertex AI with gemini-2.0-flash-001 model
      const model = this.vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash-001',
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
        }
      });

      const response = await model.generateContent({
        contents: [{
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
        }]
      });

      // Extract text from response
      const result = response.response;
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text;
    }, `Vertex AI extraction page ${pageNumber}`);
  }

  /**
   * Extract text from a single page using GPT-4o (for verification)
   * Note: GPT-4o needs images, not PDFs directly
   */
  private async extractPageWithGPT4o(
    pageImageBase64: string,
    pageNumber: number,
    totalPages: number
  ): Promise<string> {
    const prompt = `אתה מחלץ טקסט מספר לימוד מתמטיקה בעברית. זהו עמוד ${pageNumber} מתוך ${totalPages}.

משימתך היא לחלץ את כל הטקסט בדיוק מקסימלי.

כללים קריטיים:
1. חלץ כל מילה, כל מספר, כל סימן - בדיוק כפי שהם מופיעים
2. שמור על סדר הקריאה הנכון (ימין לשמאל לעברית)
3. לכל תרגיל - כתוב את המספר המדויק ואת כל התוכן
4. משוואות מתמטיות - כתוב בצורה ברורה
5. טבלאות - שמור על המבנה
6. תמונות/איורים - תאר בסוגריים מרובעים
7. אם יש טקסט לא ברור - סמן [?לא ברור?]

חלץ את כל הטקסט:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${pageImageBase64}`,
                detail: 'high'
              }
            }
          ]
        }],
        max_tokens: 8000,
        temperature: 0,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      logger.error(`GPT-4o extraction failed for page ${pageNumber}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract a single page from PDF as a new PDF
   */
  private async extractSinglePage(pdfBuffer: Buffer, pageNumber: number): Promise<string> {
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const newPdf = await PDFDocument.create();

    // pdf-lib uses 0-based indexing
    const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNumber - 1]);
    newPdf.addPage(copiedPage);

    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes).toString('base64');
  }

  /**
   * Main extraction method - processes entire PDF with multi-model verification
   */
  async extractDocument(
    pdfBase64: string,
    fileName: string,
    onProgress?: (status: PageExtractionStatus) => void
  ): Promise<FullExtractionResult> {
    const startTime = Date.now();

    logger.info(`🚀 Starting high-quality extraction for: ${fileName}`);

    // Load PDF and get page count
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();

    logger.info(`📄 PDF loaded: ${totalPages} pages`);

    // For large PDFs, skip dual verification to fit within Cloud Function timeout
    const skipVerification = totalPages > RATE_LIMIT_CONFIG.largePdfThreshold;
    if (skipVerification) {
      logger.warn(`⚠️ Large PDF (${totalPages} pages) - skipping dual verification for speed. All pages will be marked for manual review.`);
    }

    const results: ExtractionResult[] = [];
    const pagesNeedingReview: number[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      onProgress?.({
        pageNumber: pageNum,
        status: 'extracting'
      });

      logger.info(`📑 Processing page ${pageNum}/${totalPages}...`);

      try {
        // Extract single page as PDF
        const singlePagePdf = await this.extractSinglePage(pdfBuffer, pageNum);

        // Primary extraction with Gemini (native PDF support)
        onProgress?.({
          pageNumber: pageNum,
          status: 'extracting'
        });

        const primaryText = await this.extractPageWithGemini(
          singlePagePdf,
          pageNum,
          totalPages
        );

        logger.info(`✅ Gemini extracted ${primaryText.length} chars for page ${pageNum}`);

        let verificationText = '';
        let agreementScore = 0;
        let confidence: 'high' | 'medium' | 'low' = 'low';
        let needsReview = true;

        // Skip verification for large PDFs to fit within timeout
        if (!skipVerification) {
          // Verification extraction
          onProgress?.({
            pageNumber: pageNum,
            status: 'verifying'
          });

          // Second pass with Gemini using slightly different prompt for verification
          verificationText = await this.extractPageWithGeminiVerification(
            singlePagePdf,
            pageNum,
            totalPages
          );

          logger.info(`✅ Verification extracted ${verificationText.length} chars for page ${pageNum}`);

          // Calculate consensus
          onProgress?.({
            pageNumber: pageNum,
            status: 'consensus'
          });

          const cer = this.calculateCER(primaryText, verificationText);
          agreementScore = 1 - cer;

          if (agreementScore >= 0.95) {
            confidence = 'high';
            needsReview = false;
          } else if (agreementScore >= 0.85) {
            confidence = 'medium';
            needsReview = false;
          } else {
            confidence = 'low';
            needsReview = true;
          }
        } else {
          // For large PDFs, mark all pages for review but still use the extraction
          confidence = 'medium';  // Assume medium confidence for single-pass
          agreementScore = 0.85;  // Nominal value
          needsReview = true;     // All pages need review for large PDFs
        }

        if (needsReview) {
          pagesNeedingReview.push(pageNum);
        }

        // Merge the extractions (or just use primary for large PDFs)
        const consensusText = skipVerification || agreementScore >= 0.90
          ? primaryText
          : this.mergeExtractions(primaryText, verificationText);

        results.push({
          pageNumber: pageNum,
          primaryText,
          verificationText,
          consensusText,
          confidence,
          agreementScore,
          needsReview,
          extractionMethod: 'gemini_native'
        });

        onProgress?.({
          pageNumber: pageNum,
          status: needsReview ? 'needs_review' : 'completed',
          confidence
        });

        logger.info(`📊 Page ${pageNum}: confidence=${confidence}, agreement=${(agreementScore * 100).toFixed(1)}%`);

        // Delay between pages to avoid rate limiting
        // For large PDFs (single call per page), we can use shorter delays
        if (pageNum < totalPages) {
          const delay = skipVerification
            ? RATE_LIMIT_CONFIG.delayBetweenPagesMs / 2  // 1 second for single-pass
            : RATE_LIMIT_CONFIG.delayBetweenPagesMs;     // 2 seconds for dual-pass
          await this.sleep(delay);
        }

      } catch (error: any) {
        logger.error(`❌ Failed to process page ${pageNum}:`, error.message);

        onProgress?.({
          pageNumber: pageNum,
          status: 'error',
          error: error.message
        });

        // Add placeholder for failed page
        results.push({
          pageNumber: pageNum,
          primaryText: '',
          verificationText: '',
          consensusText: `[שגיאה בחילוץ עמוד ${pageNum}: ${error.message}]`,
          confidence: 'low',
          agreementScore: 0,
          needsReview: true,
          extractionMethod: 'gemini_native'
        });

        pagesNeedingReview.push(pageNum);
      }
    }

    // Combine all pages into full text
    const fullText = results
      .map(r => `<!-- עמוד ${r.pageNumber} -->\n${r.consensusText}`)
      .join('\n\n---\n\n');

    // Calculate average confidence
    const avgConfidence = results.reduce((sum, r) => sum + r.agreementScore, 0) / results.length;

    const extractionTimeMs = Date.now() - startTime;

    logger.info(`🎉 Extraction complete: ${totalPages} pages, ${pagesNeedingReview.length} need review, avg confidence: ${(avgConfidence * 100).toFixed(1)}%`);

    return {
      fileName,
      totalPages,
      pages: results,
      fullText,
      averageConfidence: avgConfidence,
      pagesNeedingReview,
      extractionTimeMs,
      modelsUsed: ['vertex-ai/gemini-2.0-flash-001']
    };
  }

  /**
   * Extract document in batches - for very large PDFs that can't fit in one Cloud Function call
   * Returns progress that can be continued in subsequent calls
   */
  async extractDocumentBatch(
    pdfBase64: string,
    fileName: string,
    existingProgress?: BatchExtractionProgress,
    onProgress?: (status: PageExtractionStatus) => void
  ): Promise<BatchExtractionResult> {
    const startTime = Date.now();

    logger.info(`🚀 Starting batch extraction for: ${fileName}`);

    // Load PDF and get page count
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();

    logger.info(`📄 PDF loaded: ${totalPages} pages`);

    // Initialize or continue progress
    const progress: BatchExtractionProgress = existingProgress || {
      fileName,
      totalPages,
      processedPages: 0,
      lastProcessedPage: 0,
      pages: [],
      pagesNeedingReview: [],
      startedAt: startTime,
      updatedAt: startTime,
      isComplete: false,
    };

    // Determine which pages to process in this batch
    const startPage = progress.lastProcessedPage + 1;
    const endPage = Math.min(startPage + RATE_LIMIT_CONFIG.maxPagesPerBatch - 1, totalPages);

    logger.info(`📑 Processing pages ${startPage}-${endPage} of ${totalPages} (batch of ${endPage - startPage + 1})`);

    // Always skip dual verification for batch processing (too slow otherwise)
    const skipVerification = true;

    // Process pages in this batch
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      onProgress?.({
        pageNumber: pageNum,
        status: 'extracting'
      });

      logger.info(`📑 Processing page ${pageNum}/${totalPages}...`);

      try {
        // Extract single page as PDF
        const singlePagePdf = await this.extractSinglePage(pdfBuffer, pageNum);

        // Primary extraction with Vertex AI Gemini
        const primaryText = await this.extractPageWithGemini(
          singlePagePdf,
          pageNum,
          totalPages
        );

        logger.info(`✅ Extracted ${primaryText.length} chars for page ${pageNum}`);

        // For batch mode, mark all pages for review
        const confidence: 'high' | 'medium' | 'low' = 'medium';
        const agreementScore = 0.85;
        const needsReview = true;

        progress.pagesNeedingReview.push(pageNum);

        progress.pages.push({
          pageNumber: pageNum,
          primaryText,
          verificationText: '',
          consensusText: primaryText,
          confidence,
          agreementScore,
          needsReview,
          extractionMethod: 'gemini_native'
        });

        onProgress?.({
          pageNumber: pageNum,
          status: 'completed',
          confidence
        });

        logger.info(`📊 Page ${pageNum}: confidence=${confidence}`);

        // Short delay between pages
        if (pageNum < endPage) {
          await this.sleep(RATE_LIMIT_CONFIG.delayBetweenPagesMs);
        }

      } catch (error: any) {
        logger.error(`❌ Failed to process page ${pageNum}:`, error.message);

        onProgress?.({
          pageNumber: pageNum,
          status: 'error',
          error: error.message
        });

        // Add placeholder for failed page
        progress.pages.push({
          pageNumber: pageNum,
          primaryText: '',
          verificationText: '',
          consensusText: `[שגיאה בחילוץ עמוד ${pageNum}: ${error.message}]`,
          confidence: 'low',
          agreementScore: 0,
          needsReview: true,
          extractionMethod: 'gemini_native'
        });

        progress.pagesNeedingReview.push(pageNum);
      }

      progress.processedPages++;
      progress.lastProcessedPage = pageNum;
      progress.updatedAt = Date.now();
    }

    // Check if we're done
    const isComplete = progress.lastProcessedPage >= totalPages;
    progress.isComplete = isComplete;

    const processingTimeMs = Date.now() - startTime;
    logger.info(`📦 Batch complete: processed pages ${startPage}-${endPage} in ${(processingTimeMs / 1000).toFixed(1)}s`);

    if (isComplete) {
      logger.info(`🎉 Full extraction complete: ${totalPages} pages, ${progress.pagesNeedingReview.length} need review`);
    } else {
      logger.info(`⏳ More batches needed: ${totalPages - progress.lastProcessedPage} pages remaining`);
    }

    return {
      progress,
      needsMoreBatches: !isComplete,
      nextStartPage: isComplete ? -1 : progress.lastProcessedPage + 1,
    };
  }

  /**
   * Convert batch progress to full extraction result
   */
  batchProgressToFullResult(progress: BatchExtractionProgress): FullExtractionResult {
    // Sort pages by page number
    const sortedPages = [...progress.pages].sort((a, b) => a.pageNumber - b.pageNumber);

    // Combine all pages into full text
    const fullText = sortedPages
      .map(r => `<!-- עמוד ${r.pageNumber} -->\n${r.consensusText}`)
      .join('\n\n---\n\n');

    // Calculate average confidence
    const avgConfidence = sortedPages.length > 0
      ? sortedPages.reduce((sum, r) => sum + r.agreementScore, 0) / sortedPages.length
      : 0;

    return {
      fileName: progress.fileName,
      totalPages: progress.totalPages,
      pages: sortedPages,
      fullText,
      averageConfidence: avgConfidence,
      pagesNeedingReview: progress.pagesNeedingReview,
      extractionTimeMs: progress.updatedAt - progress.startedAt,
      modelsUsed: ['vertex-ai/gemini-2.0-flash-001']
    };
  }

  /**
   * Second extraction pass with Vertex AI Gemini using different prompt for verification
   */
  private async extractPageWithGeminiVerification(
    pdfBase64: string,
    pageNumber: number,
    totalPages: number
  ): Promise<string> {
    const prompt = `חלץ טקסט מעמוד ${pageNumber} מתוך ${totalPages} בספר מתמטיקה בעברית.

הוראות:
- העתק כל טקסט במדויק
- שמור מספור תרגילים
- רשום משוואות בצורה ברורה
- תאר תמונות ב-[תמונה: ...]
- סמן טקסט לא ברור ב-[?]

הטקסט המלא:`;

    try {
      return await this.withRetry(async () => {
        const model = this.vertexAI.getGenerativeModel({
          model: 'gemini-2.0-flash-001',
          generationConfig: {
            temperature: 0.1, // Slightly different temperature for variation
            maxOutputTokens: 8192,
          }
        });

        const response = await model.generateContent({
          contents: [{
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
          }]
        });

        const result = response.response;
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text;
      }, `Vertex AI verification page ${pageNumber}`);
    } catch (error: any) {
      logger.error(`Vertex AI verification failed for page ${pageNumber}:`, error.message);
      return ''; // Return empty on failure after all retries
    }
  }

  /**
   * Re-extract specific pages that need review
   * Uses more aggressive extraction with multiple attempts
   */
  async reExtractPages(
    pdfBase64: string,
    pageNumbers: number[],
    totalPages: number
  ): Promise<Map<number, ExtractionResult>> {
    const results = new Map<number, ExtractionResult>();
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    for (const pageNum of pageNumbers) {
      logger.info(`🔄 Re-extracting page ${pageNum}...`);

      try {
        const singlePagePdf = await this.extractSinglePage(pdfBuffer, pageNum);

        // Try 3 different extraction attempts
        const attempts: string[] = [];

        for (let attempt = 1; attempt <= 3; attempt++) {
          const text = await this.extractPageWithGemini(singlePagePdf, pageNum, totalPages);
          attempts.push(text);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Find the most common extraction (majority voting)
        const consensusText = this.findMajorityText(attempts);

        // Check agreement between attempts
        const agreements = attempts.map(a => 1 - this.calculateCER(consensusText, a));
        const avgAgreement = agreements.reduce((a, b) => a + b, 0) / agreements.length;

        results.set(pageNum, {
          pageNumber: pageNum,
          primaryText: attempts[0],
          verificationText: attempts[1],
          consensusText,
          confidence: avgAgreement >= 0.90 ? 'high' : avgAgreement >= 0.80 ? 'medium' : 'low',
          agreementScore: avgAgreement,
          needsReview: avgAgreement < 0.85,
          extractionMethod: 'gemini_native'
        });

      } catch (error: any) {
        logger.error(`Re-extraction failed for page ${pageNum}:`, error.message);
      }
    }

    return results;
  }

  /**
   * Find the text that is most similar to all others (majority voting)
   */
  private findMajorityText(texts: string[]): string {
    if (texts.length === 0) return '';
    if (texts.length === 1) return texts[0];

    let bestText = texts[0];
    let bestScore = -1;

    for (const candidate of texts) {
      let totalScore = 0;
      for (const other of texts) {
        totalScore += 1 - this.calculateCER(candidate, other);
      }
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestText = candidate;
      }
    }

    return bestText;
  }

  /**
   * Validate Hebrew text quality
   */
  validateHebrewText(text: string): {
    isValid: boolean;
    hebrewRatio: number;
    hasNumbers: boolean;
    suspiciousPatterns: string[];
  } {
    const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    const hebrewRatio = totalChars > 0 ? hebrewChars / totalChars : 0;

    const hasNumbers = /\d/.test(text);

    const suspiciousPatterns: string[] = [];

    // Check for common OCR errors in Hebrew
    if (text.includes('וו') && !text.includes('וו ')) {
      suspiciousPatterns.push('possible_vav_confusion');
    }
    if (/[a-zA-Z]{5,}/.test(text)) {
      suspiciousPatterns.push('unexpected_english_words');
    }
    if (text.includes('???') || text.includes('□□□')) {
      suspiciousPatterns.push('unrecognized_characters');
    }

    return {
      isValid: hebrewRatio > 0.3 && suspiciousPatterns.length < 2,
      hebrewRatio,
      hasNumbers,
      suspiciousPatterns
    };
  }
}
