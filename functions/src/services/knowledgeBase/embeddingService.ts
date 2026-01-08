// embeddingService.ts - OpenAI Embeddings for Knowledge Base

import OpenAI from 'openai';
import * as logger from 'firebase-functions/logger';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TOKENS_PER_REQUEST = 8191;
const BATCH_SIZE = 100; // OpenAI allows up to 2048, but we use smaller batches for safety

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokenCount: number;
}

export class EmbeddingService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Truncate if too long (rough estimate: 4 chars per token for Hebrew)
    const maxChars = MAX_TOKENS_PER_REQUEST * 3; // Hebrew is ~3 chars per token
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;

    try {
      const response = await this.openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: truncatedText,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      return response.data[0].embedding;
    } catch (error: any) {
      logger.error('Embedding generation failed:', error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const results: EmbeddingResult[] = [];
    const maxChars = MAX_TOKENS_PER_REQUEST * 3;

    // Process in batches
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const truncatedBatch = batch.map(text =>
        text.length > maxChars ? text.substring(0, maxChars) : text
      );

      try {
        logger.info(`Processing embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}`);

        const response = await this.openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: truncatedBatch,
          dimensions: EMBEDDING_DIMENSIONS,
        });

        for (let j = 0; j < response.data.length; j++) {
          results.push({
            text: batch[j],
            embedding: response.data[j].embedding,
            tokenCount: response.usage?.total_tokens
              ? Math.floor(response.usage.total_tokens / batch.length)
              : 0,
          });
        }

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error: any) {
        logger.error(`Batch ${i / BATCH_SIZE} failed:`, error.message);
        // Continue with next batch, mark failed ones
        for (const text of batch) {
          results.push({
            text,
            embedding: [],
            tokenCount: 0,
          });
        }
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar embeddings from a list
   */
  static findMostSimilar(
    queryEmbedding: number[],
    candidates: { id: string; embedding: number[] }[],
    limit: number = 5,
    minSimilarity: number = 0.7
  ): { id: string; similarity: number }[] {
    const similarities = candidates.map(candidate => ({
      id: candidate.id,
      similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding),
    }));

    return similarities
      .filter(s => s.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}

/**
 * Estimate tokens in Hebrew text (rough estimate)
 * Hebrew averages about 3 characters per token
 */
export function estimateTokens(text: string): number {
  // Hebrew characters
  const hebrewCount = (text.match(/[\u0590-\u05FF]/g) || []).length;
  // Other characters (English, numbers, punctuation)
  const otherCount = text.length - hebrewCount;

  // Hebrew: ~3 chars per token, Other: ~4 chars per token
  return Math.ceil(hebrewCount / 3 + otherCount / 4);
}
