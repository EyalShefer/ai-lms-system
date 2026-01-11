// knowledgeBaseService.ts - Client-side service for Knowledge Base

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface KnowledgeSearchResult {
  chunk: {
    id: string;
    grade: string;
    volume: number;
    volumeType: 'student' | 'teacher' | 'curriculum';
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
    volumeType?: 'student' | 'teacher' | 'curriculum';
    contentType?: string;
  },
  limit: number = 5
): Promise<KnowledgeSearchResult[]> {
  try {
    const searchFunc = httpsCallable(functions, 'searchKnowledge');

    // Build filters - only include grade if specified, don't filter by subject
    // to allow broader searches when KB content might have different subject values
    const searchFilters: Record<string, string> = {};
    if (filters?.grade) {
      searchFilters.grade = filters.grade;
    }
    if (filters?.volumeType) {
      searchFilters.volumeType = filters.volumeType;
    }
    if (filters?.contentType) {
      searchFilters.contentType = filters.contentType;
    }
    // Only add subject filter if explicitly provided
    if (filters?.subject) {
      searchFilters.subject = filters.subject;
    }

    console.log(`🔍 KB Search: query="${query}", filters=`, searchFilters);

    const result = await searchFunc({
      query,
      filters: searchFilters,
      limit,
      minSimilarity: 0.25, // Very low threshold for Hebrew math content
    });

    const data = result.data as KnowledgeSearchResponse;
    console.log(`📚 KB Search results: ${data.results.length} found in ${data.processingTimeMs}ms`);
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

/**
 * Get structured math context for activity generation
 * Returns specific pedagogical elements from the knowledge base
 * Including language patterns, question styles, and student-facing phrasing
 */
export async function getMathPedagogicalContext(
  topic: string,
  grade: string
): Promise<{
  exercises: string[];
  commonMistakes: string[];
  progressionLevels: string[];
  mathLanguage: string[];
  examples: string[];
  questionPhrasing: string[];      // How questions are phrased for students
  studentAddressing: string[];     // How to address/talk to students
  explanationPatterns: string[];   // Patterns for explaining concepts
  rawContext: string;
}> {
  const result = {
    exercises: [] as string[],
    commonMistakes: [] as string[],
    progressionLevels: [] as string[],
    mathLanguage: [] as string[],
    examples: [] as string[],
    questionPhrasing: [] as string[],
    studentAddressing: [] as string[],
    explanationPatterns: [] as string[],
    rawContext: '',
  };

  try {
    // Search SEPARATELY for each source type to ensure we get curriculum!
    // This is critical - curriculum defines the boundaries of what's allowed
    console.log(`📚 Searching KB for topic "${topic}" grade ${grade} - querying all 3 source types...`);

    const [curriculumResults, studentResults, teacherResults] = await Promise.all([
      // Curriculum - HIGHEST PRIORITY (defines what's in scope)
      searchKnowledge(topic, { grade, volumeType: 'curriculum' }, 3),
      // Student book - main content examples
      searchKnowledge(topic, { grade, volumeType: 'student' }, 4),
      // Teacher guide - pedagogical guidance
      searchKnowledge(topic, { grade, volumeType: 'teacher' }, 3),
    ]);

    // Combine results - curriculum first!
    const searchResults = [...curriculumResults, ...studentResults, ...teacherResults];

    if (searchResults.length === 0) {
      console.log(`📚 No knowledge base results for "${topic}" grade ${grade}`);
      return result;
    }

    // Log what we found from each source type
    console.log(`📚 KB results: curriculum=${curriculumResults.length}, student=${studentResults.length}, teacher=${teacherResults.length}`);

    // Process each result to extract specific elements
    for (const res of searchResults) {
      const content = res.chunk.content;
      const sourceLabel = res.chunk.volumeType === 'curriculum' ? 'תכנית לימודים' :
                          res.chunk.volumeType === 'teacher' ? 'מדריך למורה' : 'ספר תלמיד';
      result.rawContext += `[${sourceLabel} - ${res.chunk.chapter}]\n${content}\n\n`;

      // Extract curriculum boundaries (from curriculum docs) - HIGHEST PRIORITY
      if (res.chunk.volumeType === 'curriculum') {
        // Extract scope/boundary definitions
        const boundaryPatterns = content.match(/(?:עד|בטווח|בתחום|מ-|עד ל-|לא יותר מ)[^\n]+/g);
        if (boundaryPatterns) {
          result.progressionLevels.push(...boundaryPatterns);
        }
        // Extract required topics
        const requiredPatterns = content.match(/(?:חובה|נדרש|יש ללמד|התלמיד יידע|יוכל)[^\n]+/g);
        if (requiredPatterns) {
          result.mathLanguage.push(...requiredPatterns);
        }
      }

      // Extract exercises (look for numbered patterns or exercise keywords)
      const exercisePatterns = content.match(/(?:תרגיל|תרגול|פתור|חשב|מצא)[^\n]+(?:\n[^\n]+)?/g);
      if (exercisePatterns) {
        result.exercises.push(...exercisePatterns.slice(0, 3));
      }

      // Extract common mistakes (from teacher guides)
      if (res.chunk.volumeType === 'teacher') {
        const mistakePatterns = content.match(/(?:טעות נפוצה|שגיאה נפוצה|זהירות|תלמידים נוטים)[^\n]+(?:\n[^\n]+)?/g);
        if (mistakePatterns) {
          result.commonMistakes.push(...mistakePatterns);
        }

        // Extract progression guidance
        const progressionPatterns = content.match(/(?:רמת קושי|הדרגתיות|שלב ראשון|שלב שני|מתחילים ב)[^\n]+/g);
        if (progressionPatterns) {
          result.progressionLevels.push(...progressionPatterns);
        }
      }

      // Extract mathematical language/terms
      const mathTerms = content.match(/(?:נקרא|מכונה|הוא|היא|הגדרה)[^\n]{10,60}/g);
      if (mathTerms) {
        result.mathLanguage.push(...mathTerms.slice(0, 3));
      }

      // Extract examples
      const examplePatterns = content.match(/(?:דוגמה|דוגמא|למשל|לדוגמה)[^\n]+(?:\n[^\n]+)?/g);
      if (examplePatterns) {
        result.examples.push(...examplePatterns.slice(0, 3));
      }

      // NEW: Extract question phrasing patterns (how questions are asked in the textbook)
      const questionPatterns = content.match(/(?:כמה|מה|איזה|האם|מי|מדוע|למה|כיצד|איך|השלם|סמן|בחר|התאם|סדר|מיין)[^\n?]+\??/g);
      if (questionPatterns) {
        result.questionPhrasing.push(...questionPatterns.slice(0, 5));
      }

      // NEW: Extract student addressing patterns (how the book talks to students)
      const addressingPatterns = content.match(/(?:נחשוב|נסתכל|בוא נ|בואו נ|נמצא|נחשב|נזכור|שים לב|זכור|חשוב ש)[^\n]+/g);
      if (addressingPatterns) {
        result.studentAddressing.push(...addressingPatterns);
      }

      // NEW: Extract explanation patterns (how concepts are explained)
      const explanationPats = content.match(/(?:כלומר|זאת אומרת|פירוש|משמעות|כאשר|אם.*אז|ניתן לומר|אפשר לומר)[^\n]+/g);
      if (explanationPats) {
        result.explanationPatterns.push(...explanationPats);
      }
    }

    // Deduplicate all arrays
    result.exercises = [...new Set(result.exercises)].slice(0, 5);
    result.commonMistakes = [...new Set(result.commonMistakes)].slice(0, 5);
    result.progressionLevels = [...new Set(result.progressionLevels)].slice(0, 3);
    result.mathLanguage = [...new Set(result.mathLanguage)].slice(0, 5);
    result.examples = [...new Set(result.examples)].slice(0, 5);
    result.questionPhrasing = [...new Set(result.questionPhrasing)].slice(0, 5);
    result.studentAddressing = [...new Set(result.studentAddressing)].slice(0, 5);
    result.explanationPatterns = [...new Set(result.explanationPatterns)].slice(0, 5);

    console.log(`📚 Extracted from KB: ${result.exercises.length} exercises, ${result.commonMistakes.length} mistakes, ${result.questionPhrasing.length} question patterns, ${result.studentAddressing.length} addressing patterns, ${result.progressionLevels.length} progression levels (from curriculum)`);

  } catch (error) {
    console.warn('Failed to get math pedagogical context:', error);
  }

  return result;
}

/**
 * Format pedagogical context for AI prompts with structured guidance
 * Emphasizes language patterns, phrasing style, and student-facing communication
 */
export function formatPedagogicalContextForPrompt(context: Awaited<ReturnType<typeof getMathPedagogicalContext>>): string {
  if (!context.rawContext && context.exercises.length === 0) {
    return '';
  }

  let formatted = `
## 📚 הנחיות פדגוגיות מבסיס הידע - חובה לעקוב!

### 🗣️ סגנון הפנייה לתלמיד (חקה את הסגנון הזה!):
`;

  // Student addressing is most important for tone
  if (context.studentAddressing.length > 0) {
    formatted += `דוגמאות מהספר לאופן הפנייה:
${context.studentAddressing.map((s, i) => `• "${s}"`).join('\n')}

**הוראה:** פנה לתלמיד בגוף ראשון רבים ("נחשב", "נמצא", "בואו נראה") או ישירות ("שים לב", "זכור").
`;
  }

  // Question phrasing patterns
  if (context.questionPhrasing.length > 0) {
    formatted += `
### ❓ ניסוח שאלות - השתמש בסגנון דומה:
${context.questionPhrasing.map((q, i) => `• ${q}`).join('\n')}

`;
  }

  // Explanation patterns for teaching content
  if (context.explanationPatterns.length > 0) {
    formatted += `### 💡 תבניות להסבר מושגים:
${context.explanationPatterns.map((e, i) => `• ${e}`).join('\n')}

`;
  }

  if (context.exercises.length > 0) {
    formatted += `### 📝 דוגמאות לתרגילים מהספר (השתמש במבנה דומה):
${context.exercises.map((e, i) => `${i + 1}. ${e}`).join('\n')}

`;
  }

  if (context.examples.length > 0) {
    formatted += `### 📖 דוגמאות והסברים מהספר:
${context.examples.join('\n')}

`;
  }

  if (context.commonMistakes.length > 0) {
    formatted += `### ⚠️ טעויות נפוצות (צור מסיחים על בסיס אלו!):
${context.commonMistakes.map((m, i) => `${i + 1}. ${m}`).join('\n')}

`;
  }

  if (context.progressionLevels.length > 0) {
    formatted += `### 📈 הדרגתיות ורמות קושי:
${context.progressionLevels.join('\n')}

`;
  }

  if (context.mathLanguage.length > 0) {
    formatted += `### 🔢 מונחים ושפה מתמטית לשימוש:
${context.mathLanguage.join('\n')}

`;
  }

  formatted += `---
## ⚡ הוראות קריטיות ליצירת התוכן:
1. **שפה ראשית:** השתמש בדיוק בשפה ובניסוחים מהספר - אל תמציא מונחים חדשים
2. **סגנון פנייה:** פנה לתלמיד בסגנון הספר (ר' דוגמאות למעלה)
3. **ניסוח שאלות:** נסח שאלות בדומה לדוגמאות מהספר
4. **מסיחים:** בנה מסיחים על בסיס הטעויות הנפוצות שצוינו
5. **רמת קושי:** שמור על רמת הקושי המתאימה לכיתה כפי שמופיעה בספר
6. **הסברים:** השתמש בתבניות ההסבר מהספר ("כלומר...", "זאת אומרת...")
`;

  return formatted;
}
