// pdfProcessor.ts - PDF Processing and Chunking for Knowledge Base

import OpenAI from 'openai';
import * as logger from 'firebase-functions/logger';
import { CHUNK_CONFIG, KnowledgeChunk } from './types';
import { estimateTokens } from './embeddingService';
import { PDFDocument } from 'pdf-lib';
import { HighQualityExtractor, FullExtractionResult, PageExtractionStatus, BatchExtractionProgress, BatchExtractionResult } from './highQualityExtractor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export interface ExtractedChapter {
  name: string;
  content: string;
  pageRange?: string;
  chapterNumber?: number;
}

export interface ProcessedPDF {
  fullText: string;
  chapters: ExtractedChapter[];
  metadata: {
    pageCount?: number;
    extractionMethod: 'vision' | 'text' | 'high_quality';
    averageConfidence?: number;
    pagesNeedingReview?: number[];
    extractionTimeMs?: number;
  };
}

export class PDFProcessor {
  private openai: OpenAI;
  private highQualityExtractor: HighQualityExtractor | null = null;

  constructor(openaiApiKey: string, useVertexAI: boolean = true) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    if (useVertexAI) {
      // Use Vertex AI for high-quality extraction (higher rate limits than Google AI Studio)
      this.highQualityExtractor = new HighQualityExtractor(openaiApiKey);
    }
  }

  /**
   * Check if extracted text is valid (not garbled)
   */
  private isTextValid(text: string): boolean {
    if (!text || text.trim().length < 100) return false;

    // Count Hebrew characters vs garbage characters
    const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;

    // If less than 20% Hebrew in a Hebrew document, it's probably garbled
    const hebrewRatio = totalChars > 0 ? hebrewChars / totalChars : 0;

    // Also check for too many special/garbage characters
    const garbageChars = (text.match(/[^\u0590-\u05FFa-zA-Z0-9\s.,!?:;\-()'"״׳+=%]/g) || []).length;
    const garbageRatio = totalChars > 0 ? garbageChars / totalChars : 0;

    logger.info(`📊 Text quality: ${(hebrewRatio * 100).toFixed(1)}% Hebrew, ${(garbageRatio * 100).toFixed(1)}% garbage`);

    return hebrewRatio > 0.15 && garbageRatio < 0.3;
  }

  /**
   * Extract a range of pages from a PDF as a new PDF in base64
   */
  private async extractPdfPages(
    pdfBuffer: Buffer,
    startPage: number,
    endPage: number
  ): Promise<string> {
    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const newPdf = await PDFDocument.create();

    // Copy pages (0-indexed in pdf-lib)
    const pageIndices = [];
    for (let i = startPage - 1; i < endPage && i < sourcePdf.getPageCount(); i++) {
      pageIndices.push(i);
    }

    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes).toString('base64');
  }

  /**
   * Extract text from PDF using GPT-4o Vision
   * Processes PDF in batches by splitting into smaller PDFs and sending to GPT-4o
   */
  async extractWithVision(
    pdfBase64: string,
    fileName: string,
    pageCount: number
  ): Promise<string> {
    logger.info(`🔍 Using GPT-4o Vision for PDF text extraction (${pageCount} pages)`);

    try {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');

      // Load PDF to get actual page count
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();
      logger.info(`📄 PDF loaded: ${totalPages} pages`);

      // Process pages in batches of 5 (GPT-4o works best with smaller PDFs)
      const PAGES_PER_BATCH = 5;
      const allExtractedText: string[] = [];

      for (let batchStart = 1; batchStart <= totalPages; batchStart += PAGES_PER_BATCH) {
        const batchEnd = Math.min(batchStart + PAGES_PER_BATCH - 1, totalPages);
        logger.info(`📑 Processing pages ${batchStart}-${batchEnd} of ${totalPages}...`);

        try {
          // Extract batch of pages as a new PDF
          const batchPdfBase64 = await this.extractPdfPages(pdfBuffer, batchStart, batchEnd);

          // Send to GPT-4o Vision
          const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `אלו עמודים ${batchStart}-${batchEnd} מתוך ${totalPages} מספר לימוד מתמטיקה בעברית.

המשימה שלך היא לחלץ את כל הטקסט מהעמודים האלה.

כללים חשובים:
1. חלץ את כל הטקסט בדיוק כפי שהוא מופיע - תרגילים, הסברים, כותרות
2. שמור על מבנה הפרקים - סמן כותרות פרקים ונושאים בבירור
3. לכל תרגיל, כתוב את מספר התרגיל ואת התוכן המלא שלו
4. אם יש תמונות או איורים, תאר אותם בקצרה בסוגריים מרובעים [תמונה: ...]
5. שמור על מספרים מדויקים - אלו הם תרגילי חשבון!
6. הפרד בין עמודים עם שורת "---"

החזר את כל הטקסט המחולץ בעברית.`,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:application/pdf;base64,${batchPdfBase64}`,
                      detail: 'high',
                    },
                  },
                ],
              },
            ],
            max_tokens: 16000,
            temperature: 0,
          });

          const batchText = response.choices[0]?.message?.content || '';
          if (batchText.length > 0) {
            allExtractedText.push(batchText);
            logger.info(`✅ Batch ${batchStart}-${batchEnd}: extracted ${batchText.length} characters`);
          }
        } catch (batchError: any) {
          logger.error(`Failed to process batch ${batchStart}-${batchEnd}:`, batchError.message);
          // Continue with next batch even if one fails
        }

        // Delay between batches to avoid rate limiting
        if (batchEnd < totalPages) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const fullText = allExtractedText.join('\n\n---\n\n');
      logger.info(`✅ Vision extraction complete: ${fullText.length} characters total from ${totalPages} pages`);

      return fullText;
    } catch (error: any) {
      logger.error('GPT-4o Vision extraction failed:', error.message);

      // Last resort: Try to clean garbled text from pdf-parse
      try {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const pdfData = await pdfParse(pdfBuffer);
        const rawText = pdfData.text;

        if (rawText && rawText.length > 100) {
          logger.info('Attempting to clean garbled text with GPT-4o-mini...');
          const cleanResponse = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'אתה מומחה בתיקון טקסט עברי משובש שחולץ מ-PDF. תקן את הטקסט והחזר גרסה קריאה.',
              },
              {
                role: 'user',
                content: `הטקסט הבא חולץ מספר מתמטיקה לכיתה א' אבל הוא משובש.
נסה לתקן אותו ולהפוך אותו לקריא. אם אתה לא מצליח לפענח חלקים - דלג עליהם.

טקסט משובש:
${rawText.substring(0, 15000)}

החזר טקסט מתוקן בעברית:`,
              },
            ],
            max_tokens: 8000,
            temperature: 0,
          });

          return cleanResponse.choices[0]?.message?.content || rawText;
        }
      } catch (cleanupError: any) {
        logger.error('Text cleanup also failed:', cleanupError.message);
      }

      throw error;
    }
  }

  /**
   * Extract text from PDF using Vision AI directly (without parsing PDF structure)
   * Used as fallback when PDF structure is invalid but the content is readable as images
   */
  async extractWithVisionOnly(
    pdfBase64: string,
    fileName: string
  ): Promise<ProcessedPDF> {
    logger.info(`🔍 Using Vision-only extraction for: ${fileName} (PDF structure invalid)`);

    try {
      // Send the entire PDF to GPT-4o Vision
      // GPT-4o can handle PDFs directly and extract text even if structure is corrupted
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `זהו ספר לימוד בעברית. הקובץ עלול להיות פגום במבנה שלו, אבל התוכן הוויזואלי קריא.

המשימה שלך היא לחלץ את כל הטקסט מהמסמך הזה.

כללים חשובים:
1. חלץ את כל הטקסט בדיוק כפי שהוא מופיע - תרגילים, הסברים, כותרות
2. סמן כותרות פרקים ונושאים בבירור
3. לכל תרגיל, כתוב את מספר התרגיל ואת התוכן המלא שלו
4. אם יש תמונות או איורים, תאר אותם בקצרה בסוגריים מרובעים [תמונה: ...]
5. שמור על מספרים מדויקים
6. הפרד בין עמודים עם שורת "---"

החזר את כל הטקסט המחולץ בעברית.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 16000,
        temperature: 0,
      });

      const extractedText = response.choices[0]?.message?.content || '';
      logger.info(`✅ Vision-only extraction complete: ${extractedText.length} characters`);

      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error('לא ניתן היה לחלץ טקסט מהמסמך');
      }

      // Parse chapters from extracted text
      const chapters = this.parseChaptersFromText(extractedText);

      return {
        fullText: extractedText,
        chapters,
        metadata: {
          pageCount: undefined, // Unknown since we couldn't parse the PDF
          extractionMethod: 'vision',
        },
      };
    } catch (error: any) {
      logger.error('Vision-only extraction failed:', error.message);
      throw new Error(`חילוץ Vision נכשל: ${error.message}`);
    }
  }

  /**
   * HIGH QUALITY EXTRACTION - Use this for production!
   * Extracts text using Gemini with multi-pass verification
   * This is a ONE-TIME process per book that serves hundreds of thousands of queries
   *
   * For large PDFs (>65 pages), uses batch processing to fit within Cloud Function timeout
   */
  async extractTextHighQuality(
    pdfBase64: string,
    fileName: string,
    onProgress?: (status: PageExtractionStatus) => void,
    existingProgress?: BatchExtractionProgress
  ): Promise<ProcessedPDF & { batchProgress?: BatchExtractionProgress; needsMoreBatches?: boolean }> {
    if (!this.highQualityExtractor) {
      logger.warn('⚠️ High quality extractor not available, falling back to standard extraction');
      return this.extractTextFromPDF(pdfBase64, fileName, true);
    }

    logger.info(`🚀 Starting HIGH QUALITY extraction for: ${fileName}`);

    try {
      // Check PDF size to determine if we need batch processing
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();

      // For very large PDFs, use batch extraction
      const MAX_PAGES_PER_CALL = 40;  // ~7 seconds per page = ~4.7 minutes for 40 pages (leaving buffer)

      if (totalPages > MAX_PAGES_PER_CALL || existingProgress) {
        logger.info(`📚 Large PDF detected (${totalPages} pages) - using batch extraction`);

        // Use batch extraction
        const batchResult = await this.highQualityExtractor.extractDocumentBatch(
          pdfBase64,
          fileName,
          existingProgress,
          onProgress
        );

        // If not complete, return partial result with progress info
        if (batchResult.needsMoreBatches) {
          logger.info(`⏳ Batch ${Math.ceil(batchResult.progress.processedPages / MAX_PAGES_PER_CALL)} complete. ${totalPages - batchResult.progress.processedPages} pages remaining.`);

          // Return partial result
          const partialResult = this.highQualityExtractor.batchProgressToFullResult(batchResult.progress);
          const chapters = this.parseChaptersFromText(partialResult.fullText);

          return {
            fullText: partialResult.fullText,
            chapters,
            metadata: {
              pageCount: totalPages,
              extractionMethod: 'high_quality',
              averageConfidence: partialResult.averageConfidence,
              pagesNeedingReview: partialResult.pagesNeedingReview,
              extractionTimeMs: partialResult.extractionTimeMs,
            },
            batchProgress: batchResult.progress,
            needsMoreBatches: true,
          };
        }

        // Extraction complete
        const fullResult = this.highQualityExtractor.batchProgressToFullResult(batchResult.progress);
        const chapters = this.parseChaptersFromText(fullResult.fullText);

        return {
          fullText: fullResult.fullText,
          chapters,
          metadata: {
            pageCount: totalPages,
            extractionMethod: 'high_quality',
            averageConfidence: fullResult.averageConfidence,
            pagesNeedingReview: fullResult.pagesNeedingReview,
            extractionTimeMs: fullResult.extractionTimeMs,
          },
          // Include batchProgress even when complete so controller can access pages
          batchProgress: batchResult.progress,
          needsMoreBatches: false,
        };
      }

      // For smaller PDFs, use regular extraction
      const result = await this.highQualityExtractor.extractDocument(
        pdfBase64,
        fileName,
        onProgress
      );

      logger.info(`✅ High quality extraction complete:`);
      logger.info(`   - Pages: ${result.totalPages}`);
      logger.info(`   - Average confidence: ${(result.averageConfidence * 100).toFixed(1)}%`);
      logger.info(`   - Pages needing review: ${result.pagesNeedingReview.length}`);
      logger.info(`   - Time: ${(result.extractionTimeMs / 1000).toFixed(1)}s`);

      // Parse chapters from the full text
      const chapters = this.parseChaptersFromText(result.fullText);

      return {
        fullText: result.fullText,
        chapters,
        metadata: {
          pageCount: result.totalPages,
          extractionMethod: 'high_quality',
          averageConfidence: result.averageConfidence,
          pagesNeedingReview: result.pagesNeedingReview,
          extractionTimeMs: result.extractionTimeMs,
        },
        needsMoreBatches: false,
      };
    } catch (error: any) {
      logger.error('High quality extraction failed:', error.message);

      // Check if this is a PDF structure error
      const isStructureError = error.message?.includes('Invalid PDF') ||
                               error.message?.includes('PDF structure') ||
                               error.message?.includes('Failed to parse');

      if (isStructureError) {
        logger.warn('⚠️ PDF structure is invalid - attempting Vision-only extraction...');
        try {
          // Use Vision AI directly without trying to parse PDF structure
          return await this.extractWithVisionOnly(pdfBase64, fileName);
        } catch (visionError: any) {
          logger.error('Vision-only extraction also failed:', visionError.message);
          throw new Error(`מבנה PDF לא תקין ולא ניתן לחלץ טקסט. נסה להמיר את הקובץ ל-PDF חדש או סרוק מחדש. שגיאה: ${error.message}`);
        }
      }

      logger.warn('Falling back to standard extraction...');
      return this.extractTextFromPDF(pdfBase64, fileName, true);
    }
  }

  /**
   * Continue batch extraction from existing progress
   */
  async continueBatchExtraction(
    pdfBase64: string,
    existingProgress: BatchExtractionProgress,
    onProgress?: (status: PageExtractionStatus) => void
  ): Promise<ProcessedPDF & { batchProgress?: BatchExtractionProgress; needsMoreBatches?: boolean }> {
    return this.extractTextHighQuality(pdfBase64, existingProgress.fileName, onProgress, existingProgress);
  }

  /**
   * Parse chapters from extracted full text
   */
  private parseChaptersFromText(fullText: string): ExtractedChapter[] {
    const chapters: ExtractedChapter[] = [];

    // Try to detect chapter boundaries using common Hebrew patterns
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

    // Sort by position in text
    chapterBoundaries.sort((a, b) => a.index - b.index);

    // Remove duplicates that are too close together
    chapterBoundaries = chapterBoundaries.filter((boundary, i) => {
      if (i === 0) return true;
      return boundary.index - chapterBoundaries[i - 1].index > 100;
    });

    if (chapterBoundaries.length > 0) {
      for (let i = 0; i < chapterBoundaries.length; i++) {
        const start = chapterBoundaries[i].index;
        const end = i < chapterBoundaries.length - 1
          ? chapterBoundaries[i + 1].index
          : fullText.length;

        const chapterContent = fullText.substring(start, end).trim();

        if (chapterContent.length > 50) {
          chapters.push({
            name: chapterBoundaries[i].name,
            content: chapterContent,
            chapterNumber: i + 1,
          });
        }
      }

      // Add intro content if exists
      if (chapterBoundaries[0].index > 200) {
        chapters.unshift({
          name: 'מבוא',
          content: fullText.substring(0, chapterBoundaries[0].index).trim(),
          chapterNumber: 0,
        });
      }
    }

    // If no chapters detected, create a single chapter
    if (chapters.length === 0) {
      chapters.push({
        name: 'תוכן הספר',
        content: fullText,
        chapterNumber: 1,
      });
    }

    logger.info(`📚 Parsed ${chapters.length} chapters from text`);
    return chapters;
  }

  /**
   * Extract text from PDF using pdf-parse library
   * Falls back to Vision AI if text extraction fails or produces garbage
   * NOTE: For production, prefer extractTextHighQuality() instead!
   */
  async extractTextFromPDF(
    pdfBase64: string,
    fileName: string,
    forceVision: boolean = false
  ): Promise<ProcessedPDF> {
    logger.info(`📄 Processing PDF: ${fileName}`);

    try {
      // Step 1: Extract raw text using pdf-parse
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const pdfData = await pdfParse(pdfBuffer);

      const rawText = pdfData.text;
      const pageCount = pdfData.numpages;

      logger.info(`📖 Extracted ${rawText.length} characters from ${pageCount} pages`);

      // Check if we need Vision AI fallback
      const needsVision = forceVision || !this.isTextValid(rawText);

      let finalText = rawText;
      let extractionMethod: 'vision' | 'text' = 'text';

      if (needsVision) {
        logger.warn('⚠️ Text extraction quality is low - using Vision AI for OCR');
        try {
          finalText = await this.extractWithVision(pdfBase64, fileName, pageCount);
          extractionMethod = 'vision';
          logger.info(`✅ Vision AI extracted ${finalText.length} characters`);
        } catch (visionError: any) {
          logger.error('Vision AI extraction failed:', visionError.message);
          // Fall back to whatever we got from pdf-parse
          finalText = rawText || '';
        }
      }

      if (!finalText || finalText.trim().length < 100) {
        logger.warn('Very little text extracted even with Vision AI');
        return {
          fullText: finalText || '',
          chapters: [{
            name: 'תוכן כללי',
            content: finalText || 'לא ניתן לחלץ טקסט מהמסמך.',
            chapterNumber: 1,
          }],
          metadata: {
            pageCount,
            extractionMethod,
          },
        };
      }

      // Step 2: Split text into chapters based on patterns
      // Use finalText (which may be from Vision AI) for chapter detection
      const chapters: ExtractedChapter[] = [];

      // Try to detect chapter boundaries using common Hebrew patterns
      const chapterPatterns = [
        /^(פרק\s+[\u05d0-\u05ea\d]+)/gm,  // פרק א / פרק 1
        /^(יחידה\s+[\u05d0-\u05ea\d]+)/gm,  // יחידה א
        /^(נושא\s*:?\s*[\u05d0-\u05ea\d]+)/gm,  // נושא: / נושא 1
      ];

      let chapterBoundaries: { index: number; name: string }[] = [];

      for (const pattern of chapterPatterns) {
        let match;
        while ((match = pattern.exec(finalText)) !== null) {
          chapterBoundaries.push({
            index: match.index,
            name: match[1].trim(),
          });
        }
      }

      // Sort by position in text
      chapterBoundaries.sort((a, b) => a.index - b.index);

      // Remove duplicates that are too close together (within 100 chars)
      chapterBoundaries = chapterBoundaries.filter((boundary, i) => {
        if (i === 0) return true;
        return boundary.index - chapterBoundaries[i - 1].index > 100;
      });

      if (chapterBoundaries.length > 0) {
        // Create chapters based on detected boundaries
        for (let i = 0; i < chapterBoundaries.length; i++) {
          const start = chapterBoundaries[i].index;
          const end = i < chapterBoundaries.length - 1
            ? chapterBoundaries[i + 1].index
            : finalText.length;

          const chapterContent = finalText.substring(start, end).trim();

          if (chapterContent.length > 50) {  // Only include if has real content
            chapters.push({
              name: chapterBoundaries[i].name,
              content: chapterContent,
              chapterNumber: i + 1,
            });
          }
        }

        // Add any content before first chapter
        if (chapterBoundaries[0].index > 200) {
          chapters.unshift({
            name: 'מבוא',
            content: finalText.substring(0, chapterBoundaries[0].index).trim(),
            chapterNumber: 0,
          });
        }
      }

      // If no chapters detected, create a single chapter with all content
      if (chapters.length === 0) {
        chapters.push({
          name: 'תוכן הספר',
          content: finalText,
          chapterNumber: 1,
        });
      }

      const fullText = finalText;

      logger.info(`📚 Organized into ${chapters.length} chapters`);

      return {
        fullText,
        chapters,
        metadata: {
          pageCount,
          extractionMethod: 'text',
        },
      };
    } catch (error: any) {
      logger.error('PDF extraction failed:', error.message);
      throw new Error(`Failed to extract PDF: ${error.message}`);
    }
  }

  /**
   * Split text into chunks suitable for embedding
   */
  chunkText(text: string, chapterName?: string): string[] {
    if (!text || text.trim().length < CHUNK_CONFIG.minChunkLength) {
      return [];
    }

    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);

    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = estimateTokens(paragraph);

      // If adding this paragraph would exceed max tokens
      if (
        currentTokens + paragraphTokens > CHUNK_CONFIG.maxTokens &&
        currentChunk.length >= CHUNK_CONFIG.minChunkLength
      ) {
        chunks.push(currentChunk.trim());

        // Start new chunk with overlap (last sentence or two)
        const sentences = currentChunk.split(/[.!?。]/);
        const overlapText =
          sentences.length > 2
            ? sentences.slice(-2).join('. ')
            : sentences[sentences.length - 1] || '';

        currentChunk = overlapText + '\n\n' + paragraph;
        currentTokens = estimateTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokens += paragraphTokens;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.length >= CHUNK_CONFIG.minChunkLength) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Detect content type based on text patterns
   */
  detectContentType(text: string): KnowledgeChunk['contentType'] {
    const lowerText = text.toLowerCase();

    for (const [type, patterns] of Object.entries(
      CHUNK_CONFIG.contentTypePatterns
    )) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return type as KnowledgeChunk['contentType'];
        }
      }
    }

    return 'explanation'; // default
  }

  /**
   * Extract keywords from text for search optimization
   */
  extractKeywords(text: string): string[] {
    // Common Hebrew math terms to look for
    const mathTerms = [
      'חיבור',
      'חיסור',
      'כפל',
      'חילוק',
      'שבר',
      'עשרוני',
      'אחוז',
      'משוואה',
      'היקף',
      'שטח',
      'נפח',
      'זווית',
      'משולש',
      'מלבן',
      'ריבוע',
      'עיגול',
      'ישר',
      'מספר',
      'ספרה',
      'עשרות',
      'יחידות',
      'מאות',
      'אלפים',
      'גדול',
      'קטן',
      'שווה',
      'סדר',
      'מיון',
      'ממוצע',
      'חציון',
      'גרף',
      'טבלה',
      'ציר',
      'נקודה',
      'קו',
      'קטע',
      'מעגל',
      'רדיוס',
      'קוטר',
    ];

    const found: string[] = [];
    for (const term of mathTerms) {
      if (text.includes(term)) {
        found.push(term);
      }
    }

    return [...new Set(found)]; // remove duplicates
  }

  /**
   * Process a complete PDF into chunks ready for embedding
   * Uses HIGH QUALITY extraction by default for maximum accuracy
   */
  async processDocument(
    pdfBase64: string,
    fileName: string,
    metadata: {
      subject: KnowledgeChunk['subject'];
      grade: KnowledgeChunk['grade'];
      volume: number;
      volumeType: 'student' | 'teacher';
    },
    options?: {
      useHighQuality?: boolean;  // Default: true
      onProgress?: (status: PageExtractionStatus) => void;
      existingProgress?: BatchExtractionProgress;  // For continuing batch extraction
    }
  ): Promise<{
    chunks: Omit<KnowledgeChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[];
    chapters: string[];
    extractionMetadata?: {
      averageConfidence?: number;
      pagesNeedingReview?: number[];
      extractionMethod: string;
    };
    // For batch processing
    batchProgress?: BatchExtractionProgress;
    needsMoreBatches?: boolean;
  }> {
    const useHighQuality = options?.useHighQuality !== false; // Default true

    // Extract text from PDF - prefer high quality extraction
    let extracted: ProcessedPDF & { batchProgress?: BatchExtractionProgress; needsMoreBatches?: boolean };

    if (useHighQuality && this.highQualityExtractor) {
      logger.info('📚 Using HIGH QUALITY extraction (recommended for production)');
      extracted = await this.extractTextHighQuality(pdfBase64, fileName, options?.onProgress, options?.existingProgress);
    } else {
      logger.info('📚 Using standard extraction (consider using high quality for better results)');
      extracted = await this.extractTextFromPDF(pdfBase64, fileName);
    }

    const chunks: Omit<KnowledgeChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[] = [];
    const chapterNames: string[] = [];

    // Process each chapter
    for (const chapter of extracted.chapters) {
      chapterNames.push(chapter.name);

      // Split chapter into chunks
      const textChunks = this.chunkText(chapter.content, chapter.name);

      for (const chunkText of textChunks) {
        chunks.push({
          subject: metadata.subject,
          grade: metadata.grade,
          volume: metadata.volume,
          volumeType: metadata.volumeType,
          chapter: chapter.name,
          chapterNumber: chapter.chapterNumber,
          pageRange: chapter.pageRange,
          content: chunkText,
          contentType: this.detectContentType(chunkText),
          source: fileName,
          sourceType: 'pdf',
          keywords: this.extractKeywords(chunkText),
          relatedTopics: [],
          usageCount: 0,
          quality: undefined,
        });
      }
    }

    logger.info(
      `📚 Processed ${fileName}: ${extracted.chapters.length} chapters, ${chunks.length} chunks`
    );

    // Include extraction metadata for quality tracking
    const result: {
      chunks: typeof chunks;
      chapters: string[];
      extractionMetadata?: {
        averageConfidence?: number;
        pagesNeedingReview?: number[];
        extractionMethod: string;
      };
      batchProgress?: BatchExtractionProgress;
      needsMoreBatches?: boolean;
    } = {
      chunks,
      chapters: chapterNames,
    };

    // Add extraction quality metadata if available
    if (extracted.metadata.extractionMethod === 'high_quality') {
      result.extractionMetadata = {
        averageConfidence: extracted.metadata.averageConfidence,
        pagesNeedingReview: extracted.metadata.pagesNeedingReview,
        extractionMethod: 'high_quality',
      };

      logger.info(`📊 Extraction quality: ${((extracted.metadata.averageConfidence || 0) * 100).toFixed(1)}% confidence`);

      if (extracted.metadata.pagesNeedingReview && extracted.metadata.pagesNeedingReview.length > 0) {
        logger.warn(`⚠️ Pages needing review: ${extracted.metadata.pagesNeedingReview.join(', ')}`);
      }
    } else {
      result.extractionMetadata = {
        extractionMethod: extracted.metadata.extractionMethod,
      };
    }

    // Add batch progress info if available
    if (extracted.batchProgress) {
      result.batchProgress = extracted.batchProgress;
      result.needsMoreBatches = extracted.needsMoreBatches;

      if (extracted.needsMoreBatches) {
        logger.info(`⏳ Batch processing in progress: ${extracted.batchProgress.processedPages}/${extracted.batchProgress.totalPages} pages complete`);
      }
    }

    return result;
  }
}
