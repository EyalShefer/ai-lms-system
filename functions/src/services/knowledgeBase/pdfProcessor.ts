// pdfProcessor.ts - PDF Processing and Chunking for Knowledge Base

import OpenAI from 'openai';
import * as logger from 'firebase-functions/logger';
import { CHUNK_CONFIG, KnowledgeChunk } from './types';
import { estimateTokens } from './embeddingService';
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
    extractionMethod: 'vision' | 'text';
  };
}

export class PDFProcessor {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Extract text from PDF using pdf-parse library
   * Then use GPT to organize into chapters
   */
  async extractTextFromPDF(
    pdfBase64: string,
    fileName: string
  ): Promise<ProcessedPDF> {
    logger.info(`📄 Processing PDF: ${fileName}`);

    try {
      // Step 1: Extract raw text using pdf-parse
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const pdfData = await pdfParse(pdfBuffer);

      const rawText = pdfData.text;
      const pageCount = pdfData.numpages;

      logger.info(`📖 Extracted ${rawText.length} characters from ${pageCount} pages`);

      if (!rawText || rawText.trim().length < 100) {
        // If very little text extracted, it might be a scanned PDF
        // Return with minimal processing
        logger.warn('Very little text extracted - PDF might be scanned/image-based');
        return {
          fullText: rawText || '',
          chapters: [{
            name: 'תוכן כללי',
            content: rawText || 'לא ניתן לחלץ טקסט מהמסמך. ייתכן שזהו PDF סרוק.',
            chapterNumber: 1,
          }],
          metadata: {
            pageCount,
            extractionMethod: 'text',
          },
        };
      }

      // Step 2: Split text into chapters based on patterns
      // Instead of using GPT (which truncates content), we detect chapter boundaries ourselves
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
        while ((match = pattern.exec(rawText)) !== null) {
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
            : rawText.length;

          const chapterContent = rawText.substring(start, end).trim();

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
            content: rawText.substring(0, chapterBoundaries[0].index).trim(),
            chapterNumber: 0,
          });
        }
      }

      // If no chapters detected, create a single chapter with all content
      if (chapters.length === 0) {
        chapters.push({
          name: 'תוכן הספר',
          content: rawText,
          chapterNumber: 1,
        });
      }

      const fullText = rawText;

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
   */
  async processDocument(
    pdfBase64: string,
    fileName: string,
    metadata: {
      subject: KnowledgeChunk['subject'];
      grade: KnowledgeChunk['grade'];
      volume: number;
      volumeType: 'student' | 'teacher';
    }
  ): Promise<{
    chunks: Omit<KnowledgeChunk, 'id' | 'embedding' | 'createdAt' | 'updatedAt'>[];
    chapters: string[];
  }> {
    // Extract text from PDF
    const extracted = await this.extractTextFromPDF(pdfBase64, fileName);

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

    return { chunks, chapters: chapterNames };
  }
}
