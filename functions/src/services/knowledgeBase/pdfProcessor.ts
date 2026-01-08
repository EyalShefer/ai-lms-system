// pdfProcessor.ts - PDF Processing and Chunking for Knowledge Base

import OpenAI from 'openai';
import * as logger from 'firebase-functions/logger';
import { CHUNK_CONFIG, KnowledgeChunk } from './types';
import { estimateTokens } from './embeddingService';

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
   * Extract text from PDF using GPT-4o Vision
   * This handles both text-based PDFs and scanned documents
   */
  async extractTextFromPDF(
    pdfBase64: string,
    fileName: string
  ): Promise<ProcessedPDF> {
    logger.info(`📄 Processing PDF: ${fileName}`);

    // For PDFs, we need to convert pages to images first
    // Since we can't do that directly in Cloud Functions without additional libraries,
    // we'll use a text extraction approach via GPT-4o

    const systemPrompt = `אתה מומחה לחילוץ תוכן מספרי לימוד במתמטיקה.

משימתך:
1. חלץ את **כל הטקסט** מהמסמך
2. זהה **פרקים/יחידות** לפי כותרות
3. שמור על המבנה המקורי

פלט בפורמט JSON:
{
  "chapters": [
    {
      "name": "שם הפרק/יחידה",
      "chapterNumber": 1,
      "content": "כל התוכן של הפרק...",
      "pageRange": "עמ' 1-5"
    }
  ],
  "metadata": {
    "bookTitle": "שם הספר אם מופיע",
    "grade": "כיתה אם מופיע",
    "subject": "מקצוע"
  }
}

כללים:
- חלץ הכל - אל תדלג על תוכן
- שמור על עברית תקינה
- אם אין חלוקה לפרקים, צור פרק אחד עם כל התוכן
- זהה דפוסים כמו: "פרק א", "יחידה 1", "נושא:", "שיעור"`;

    try {
      // Note: For actual PDF processing, you'd need to:
      // 1. Convert PDF to images using pdf-lib or similar
      // 2. Send each page to Vision API
      // 3. Combine results

      // For now, we'll use the file API approach if available,
      // or fall back to a simpler text extraction

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `חלץ את התוכן מהמסמך הבא. שם הקובץ: ${fileName}`,
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
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      const chapters: ExtractedChapter[] = (parsed.chapters || []).map(
        (ch: any, index: number) => ({
          name: ch.name || `פרק ${index + 1}`,
          content: ch.content || '',
          pageRange: ch.pageRange,
          chapterNumber: ch.chapterNumber || index + 1,
        })
      );

      // If no chapters found, create one with all content
      if (chapters.length === 0 && parsed.content) {
        chapters.push({
          name: 'תוכן כללי',
          content: parsed.content,
          chapterNumber: 1,
        });
      }

      const fullText = chapters.map((ch) => ch.content).join('\n\n');

      return {
        fullText,
        chapters,
        metadata: {
          extractionMethod: 'vision',
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
