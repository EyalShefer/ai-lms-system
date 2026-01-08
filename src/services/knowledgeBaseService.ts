// knowledgeBaseService.ts - Client-side service for Knowledge Base

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface KnowledgeSearchResult {
  chunk: {
    id: string;
    grade: string;
    volume: number;
    volumeType: 'student' | 'teacher';
    chapter: string;
    content: string;
    contentType: string;
    source: string;
    keywords: string[];
  };
  similarity: number;
}

export interface KnowledgeSearchResponse {
  results: KnowledgeSearchResult[];
  query: string;
  processingTimeMs: number;
}

/**
 * Search the knowledge base for relevant content
 */
export async function searchKnowledge(
  query: string,
  filters?: {
    subject?: string;
    grade?: string;
    volumeType?: 'student' | 'teacher';
    contentType?: string;
  },
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  try {
    const searchFunc = httpsCallable(functions, 'searchKnowledge');
    const result = await searchFunc({
      query,
      filters: {
        subject: 'math',
        ...filters,
      },
      limit,
      minSimilarity: 0.65,
    });

    const data = result.data as KnowledgeSearchResponse;
    return data.results;
  } catch (error) {
    console.warn('Knowledge base search failed:', error);
    return [];
  }
}

/**
 * Get context from knowledge base for AI prompt augmentation
 */
export async function getKnowledgeContext(
  topic: string,
  grade: string,
  options?: {
    includeTeacherGuide?: boolean;
    maxChunks?: number;
  }
): Promise<string> {
  try {
    const getContextFunc = httpsCallable(functions, 'getKnowledgeContext');
    const result = await getContextFunc({
      topic,
      grade,
      includeTeacherGuide: options?.includeTeacherGuide ?? true,
      maxChunks: options?.maxChunks ?? 5,
    });

    const data = result.data as { context: string };
    return data.context;
  } catch (error) {
    console.warn('Failed to get knowledge context:', error);
    return '';
  }
}

/**
 * Check if knowledge base has content for a specific topic
 */
export async function hasKnowledgeFor(
  topic: string,
  grade: string
): Promise<boolean> {
  const results = await searchKnowledge(topic, { grade }, 1);
  return results.length > 0;
}

/**
 * Format knowledge context for inclusion in AI prompts
 */
export function formatKnowledgeForPrompt(context: string): string {
  if (!context || context.trim().length === 0) {
    return '';
  }

  return `
## מידע מבסיס הידע (השתמש בזה ליצירת תוכן מדויק ומותאם):

${context}

---
השתמש במידע למעלה כבסיס ליצירת התוכן. זכור:
- עקוב אחרי רמות הקושי והדרגתיות שמופיעות
- השתמש בטעויות נפוצות שצוינו בהנחיות למורה
- השתמש בדוגמאות ותבניות שמופיעות
`;
}
