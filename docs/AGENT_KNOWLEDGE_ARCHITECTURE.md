# Agent Knowledge System Architecture
## Making SmartCreationChat Truly Know and Execute All System Capabilities

### Current State Analysis

The current `SmartCreationChat` agent uses a **static 660-line system prompt** that attempts to describe all capabilities. This approach has critical limitations:

1. **Static knowledge** - Agent doesn't know about new features added after prompt was written
2. **Describe-only** - Can talk about capabilities but cannot execute them directly
3. **Context overflow** - Massive prompt consumes tokens but lacks depth per capability
4. **Maintenance burden** - Every new feature requires manual prompt updates
5. **No verification** - Agent may describe capabilities incorrectly

### Proposed Architecture: Dynamic Tool-Calling Agent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SmartCreationChat Agent                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │  Core System     │    │  Dynamic Context │    │  Tool Registry   │       │
│  │  Prompt (Slim)   │    │  Injector (RAG)  │    │  (Executable)    │       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘       │
│           │                       │                       │                  │
│           └───────────────────────┼───────────────────────┘                  │
│                                   │                                          │
│                         ┌─────────▼─────────┐                               │
│                         │   Gemini 2.0      │                               │
│                         │   with Function   │                               │
│                         │   Calling         │                               │
│                         └─────────┬─────────┘                               │
│                                   │                                          │
│                         ┌─────────▼─────────┐                               │
│                         │  Tool Executor    │                               │
│                         │  (Firebase Funcs) │                               │
│                         └───────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: Capability Registry

A Firestore collection that maintains all system capabilities with their execution details.

### Schema: `capabilities` collection

```typescript
interface Capability {
  id: string;                    // Unique ID (e.g., "generate_worksheet")
  name: string;                  // Human name: "Generate Worksheet"
  description: string;           // What it does (for RAG retrieval)
  category: CapabilityCategory;  // Category for filtering

  // Execution details
  execution: {
    type: 'firebase_function' | 'api_endpoint' | 'internal_service';
    target: string;              // Function name or endpoint URL
    method?: 'GET' | 'POST';
    requiresAuth: boolean;
  };

  // Parameters the agent needs to collect
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description: string;         // For agent to ask user
    enum?: string[];             // Valid options
    default?: any;
  }>;

  // Example usage for few-shot learning
  examples: Array<{
    userRequest: string;         // "צרי לי דף עבודה על שברים"
    parameters: Record<string, any>;
    response: string;
  }>;

  // Metadata
  keywords: string[];            // For RAG retrieval: ["דף עבודה", "worksheet", "תרגילים"]
  relatedCapabilities: string[]; // Related capability IDs
  minRole: 'teacher' | 'admin';  // Who can use it
  status: 'active' | 'beta' | 'deprecated';
  lastUpdated: Timestamp;
}

type CapabilityCategory =
  | 'content_generation'    // Create content (worksheets, exams, lessons)
  | 'knowledge_management'  // Upload/search knowledge base
  | 'curriculum'           // Query curriculum standards
  | 'adaptive_learning'    // Variants, mastery, adaptive decisions
  | 'analytics'            // Reports, statistics
  | 'media_generation'     // Images, infographics, audio
  | 'user_content_search'  // Search user's existing content
  | 'quality_assurance'    // Validate, test content
  | 'prompt_library';      // Access prompt templates
```

### Seeding the Registry

```typescript
// Example capability entries
const capabilities: Capability[] = [
  {
    id: 'generate_static_content',
    name: 'יצירת תוכן סטטי',
    description: 'יצירת דף עבודה, מבחן להדפסה, מכתב, משוב, רובריקה או מערך שיעור',
    category: 'content_generation',
    execution: {
      type: 'firebase_function',
      target: 'generateStaticContent',
      method: 'POST',
      requiresAuth: true
    },
    parameters: [
      { name: 'contentType', type: 'string', required: true,
        description: 'סוג התוכן',
        enum: ['worksheet', 'test', 'lesson_plan', 'letter', 'feedback', 'rubric'] },
      { name: 'topic', type: 'string', required: true, description: 'הנושא' },
      { name: 'grade', type: 'string', required: false, description: 'כיתה' },
      { name: 'subject', type: 'string', required: false, description: 'מקצוע' },
      { name: 'additionalInstructions', type: 'string', required: false,
        description: 'הנחיות נוספות' }
    ],
    examples: [
      {
        userRequest: 'צרי לי דף עבודה על שברים לכיתה ד',
        parameters: { contentType: 'worksheet', topic: 'שברים', grade: 'ד', subject: 'מתמטיקה' },
        response: 'הנה דף העבודה שיצרתי על שברים לכיתה ד'
      }
    ],
    keywords: ['דף עבודה', 'מבחן מודפס', 'מכתב', 'משוב', 'רובריקה', 'מערך שיעור', 'להדפסה'],
    relatedCapabilities: ['search_prompts'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'generate_interactive_activity',
    name: 'יצירת פעילות אינטראקטיבית',
    description: 'יצירת פעילות דיגיטלית עם שאלות מגוונות, משחקים ומשוב מיידי',
    category: 'content_generation',
    execution: {
      type: 'internal_service',
      target: 'contentGenerationPipeline',
      requiresAuth: true
    },
    parameters: [
      { name: 'productType', type: 'string', required: true,
        enum: ['activity', 'exam', 'lesson', 'podcast'] },
      { name: 'topic', type: 'string', required: true },
      { name: 'grade', type: 'string', required: true },
      { name: 'difficultyLevel', type: 'string', required: false,
        enum: ['support', 'core', 'enrichment', 'all'] },
      { name: 'profile', type: 'string', required: false,
        enum: ['balanced', 'educational', 'game'] },
      { name: 'includeBot', type: 'boolean', required: false }
    ],
    examples: [...],
    keywords: ['פעילות', 'משחק', 'תרגול', 'מבחן דיגיטלי', 'שיעור'],
    relatedCapabilities: ['generate_static_content', 'search_curriculum'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'upload_knowledge',
    name: 'העלאת מסמך למאגר הידע',
    description: 'העלאת PDF, ספר לימוד או מסמך אחר למאגר הידע לשימוש ביצירת תוכן',
    category: 'knowledge_management',
    execution: {
      type: 'firebase_function',
      target: 'uploadKnowledge',
      requiresAuth: true
    },
    parameters: [
      { name: 'fileBase64', type: 'string', required: true, description: 'הקובץ בפורמט base64' },
      { name: 'fileName', type: 'string', required: true },
      { name: 'subject', type: 'string', required: true },
      { name: 'grade', type: 'string', required: true },
      { name: 'volumeType', type: 'string', required: true, enum: ['textbook', 'worksheet', 'exam', 'general'] }
    ],
    examples: [...],
    keywords: ['העלאה', 'קובץ', 'PDF', 'ספר לימוד', 'מאגר ידע'],
    relatedCapabilities: ['search_knowledge'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'search_knowledge',
    name: 'חיפוש במאגר הידע',
    description: 'חיפוש סמנטי במאגר הידע כולל ספרי לימוד, מסמכים וחומרי עזר',
    category: 'knowledge_management',
    execution: {
      type: 'firebase_function',
      target: 'searchKnowledge',
      requiresAuth: true
    },
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'מה לחפש' },
      { name: 'subject', type: 'string', required: false },
      { name: 'grade', type: 'string', required: false },
      { name: 'limit', type: 'number', required: false, default: 10 }
    ],
    keywords: ['חיפוש', 'מצא', 'מאגר ידע', 'ספר לימוד'],
    relatedCapabilities: ['upload_knowledge', 'get_textbook_context'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'search_curriculum',
    name: 'חיפוש בתוכניות לימודים',
    description: 'חיפוש תקני תוכנית לימודים של משרד החינוך לפי מקצוע, כיתה ונושא',
    category: 'curriculum',
    execution: {
      type: 'firebase_function',
      target: 'queryCurriculumStandards',
      requiresAuth: true
    },
    parameters: [
      { name: 'subject', type: 'string', required: true,
        enum: ['math', 'hebrew', 'english', 'bible', 'history', 'geography', 'civics', 'science', 'physics', 'chemistry', 'biology', 'cs', 'literature'] },
      { name: 'gradeLevel', type: 'string', required: true },
      { name: 'topic', type: 'string', required: false },
      { name: 'bloomLevels', type: 'array', required: false }
    ],
    keywords: ['תוכנית לימודים', 'תוכ"ל', 'תקנים', 'משרד החינוך', 'מה ללמד'],
    relatedCapabilities: ['generate_interactive_activity'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'search_user_content',
    name: 'חיפוש בתכנים שיצרתי',
    description: 'חיפוש בפעילויות, מבחנים ושיעורים שהמורה יצרה בעבר',
    category: 'user_content_search',
    execution: {
      type: 'firebase_function',
      target: 'searchUserContent',
      requiresAuth: true
    },
    parameters: [
      { name: 'query', type: 'string', required: true },
      { name: 'contentType', type: 'string', required: false,
        enum: ['activity', 'exam', 'lesson', 'podcast'] },
      { name: 'limit', type: 'number', required: false, default: 10 }
    ],
    keywords: ['חיפוש', 'תכנים קיימים', 'שימוש חוזר', 'מה יצרתי'],
    relatedCapabilities: [],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'search_prompts',
    name: 'חיפוש במאגר פרומפטים',
    description: 'חיפוש תבניות פרומפט שמורות אחרות יצרו ודירגו',
    category: 'prompt_library',
    execution: {
      type: 'firebase_function',
      target: 'searchRelevantPrompts',
      requiresAuth: true
    },
    parameters: [
      { name: 'keywords', type: 'string', required: true },
      { name: 'category', type: 'string', required: false,
        enum: ['יצירת מבחנים', 'דפי עבודה', 'הכנת שיעורים', 'למידה חברתית-רגשית (SEL)', 'תכנון ותכניות עבודה', 'תקשורת אישית'] },
      { name: 'limit', type: 'number', required: false, default: 5 }
    ],
    keywords: ['פרומפט', 'תבנית', 'ChatGPT', 'Gemini'],
    relatedCapabilities: ['generate_static_content'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'generate_infographic',
    name: 'יצירת אינפוגרפיקה',
    description: 'יצירת תמונת אינפוגרפיקה חזותית על נושא מסוים',
    category: 'media_generation',
    execution: {
      type: 'firebase_function',
      target: 'generateGemini3Infographic',
      requiresAuth: true
    },
    parameters: [
      { name: 'topic', type: 'string', required: true },
      { name: 'gradeLevel', type: 'string', required: true },
      { name: 'style', type: 'string', required: false,
        enum: ['educational', 'colorful', 'minimalist', 'infographic'] },
      { name: 'dataPoints', type: 'array', required: false }
    ],
    keywords: ['אינפוגרפיקה', 'תמונה', 'חזותי', 'גרף'],
    relatedCapabilities: ['generate_interactive_activity'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'generate_variants',
    name: 'יצירת גרסאות אדפטיביות',
    description: 'יצירת גרסאות שונות של תוכן: הוואנה (פישוט), העמקה (הרחבה)',
    category: 'adaptive_learning',
    execution: {
      type: 'internal_service',
      target: 'adaptiveContentService.generateContentVariants',
      requiresAuth: true
    },
    parameters: [
      { name: 'blockId', type: 'string', required: true },
      { name: 'variantType', type: 'string', required: false,
        enum: ['havana', 'haamaka', 'both'] },
      { name: 'count', type: 'number', required: false, default: 2 }
    ],
    keywords: ['הוואנה', 'העמקה', 'גרסאות', 'אדפטיבי', 'התאמה'],
    relatedCapabilities: ['generate_interactive_activity'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'run_qa_tests',
    name: 'הרצת בדיקות איכות',
    description: 'הרצת בדיקות איכות על תוכן: תקינות, הטיות, נגישות',
    category: 'quality_assurance',
    execution: {
      type: 'firebase_function',
      target: 'triggerQATests',
      requiresAuth: true
    },
    parameters: [
      { name: 'courseId', type: 'string', required: false },
      { name: 'unitId', type: 'string', required: false },
      { name: 'includeAll', type: 'boolean', required: false, default: false }
    ],
    keywords: ['בדיקה', 'איכות', 'QA', 'הטיות', 'נגישות'],
    relatedCapabilities: [],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'transcribe_youtube',
    name: 'תמלול סרטון יוטיוב',
    description: 'תמלול סרטון יוטיוב ליצירת תוכן על בסיסו',
    category: 'content_generation',
    execution: {
      type: 'firebase_function',
      target: 'transcribeYoutube',
      requiresAuth: true
    },
    parameters: [
      { name: 'videoUrl', type: 'string', required: true },
      { name: 'language', type: 'string', required: false, default: 'he' },
      { name: 'translateTo', type: 'string', required: false }
    ],
    keywords: ['יוטיוב', 'סרטון', 'תמלול', 'וידאו'],
    relatedCapabilities: ['generate_interactive_activity'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'get_analytics',
    name: 'קבלת אנליטיקס',
    description: 'קבלת סטטיסטיקות ונתונים על תלמידים, קורסים ופעילויות',
    category: 'analytics',
    execution: {
      type: 'internal_service',
      target: 'analyticsService.getStudentAnalytics',
      requiresAuth: true
    },
    parameters: [
      { name: 'studentId', type: 'string', required: false },
      { name: 'courseId', type: 'string', required: false },
      { name: 'timeRange', type: 'string', required: false,
        enum: ['week', 'month', 'semester', 'year'] }
    ],
    keywords: ['אנליטיקס', 'סטטיסטיקות', 'נתונים', 'דוח', 'ביצועים'],
    relatedCapabilities: ['export_data'],
    minRole: 'teacher',
    status: 'active'
  },

  {
    id: 'export_data',
    name: 'ייצוא נתונים',
    description: 'ייצוא נתוני תלמידים וביצועים לאקסל או CSV',
    category: 'analytics',
    execution: {
      type: 'internal_service',
      target: 'exportService.exportStudentsToExcel',
      requiresAuth: true
    },
    parameters: [
      { name: 'courseId', type: 'string', required: true },
      { name: 'format', type: 'string', required: false, enum: ['xlsx', 'csv'], default: 'xlsx' },
      { name: 'includeBloom', type: 'boolean', required: false, default: true }
    ],
    keywords: ['ייצוא', 'אקסל', 'CSV', 'דוח', 'הורדה'],
    relatedCapabilities: ['get_analytics'],
    minRole: 'teacher',
    status: 'active'
  }
];
```

---

## Component 2: Dynamic Context Injector (RAG)

Instead of a massive static prompt, inject only relevant capabilities based on user query.

### Implementation

```typescript
// src/services/ai/capabilityRAG.ts

import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface RetrievedCapability {
  capability: Capability;
  relevanceScore: number;
}

/**
 * Retrieve relevant capabilities based on user query
 */
export async function retrieveRelevantCapabilities(
  userQuery: string,
  conversationContext: string,
  maxResults: number = 5
): Promise<RetrievedCapability[]> {
  // 1. Extract keywords from query
  const keywords = extractKeywords(userQuery);

  // 2. Query capabilities by keywords
  const capabilitiesRef = collection(db, 'capabilities');
  const q = query(
    capabilitiesRef,
    where('status', '==', 'active'),
    orderBy('lastUpdated', 'desc'),
    limit(20)
  );

  const snapshot = await getDocs(q);
  const allCapabilities = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Capability));

  // 3. Score by relevance
  const scored = allCapabilities.map(cap => ({
    capability: cap,
    relevanceScore: calculateRelevance(cap, keywords, conversationContext)
  }));

  // 4. Return top N
  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

function extractKeywords(text: string): string[] {
  // Hebrew-aware keyword extraction
  const stopWords = new Set(['את', 'של', 'על', 'עם', 'אני', 'רוצה', 'צריך', 'לי', 'בבקשה']);
  return text
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(word => word.toLowerCase());
}

function calculateRelevance(
  capability: Capability,
  keywords: string[],
  context: string
): number {
  let score = 0;

  // Keyword match in capability keywords
  for (const keyword of keywords) {
    if (capability.keywords.some(k => k.includes(keyword) || keyword.includes(k))) {
      score += 10;
    }
    if (capability.description.includes(keyword)) {
      score += 5;
    }
    if (capability.name.includes(keyword)) {
      score += 8;
    }
  }

  // Context relevance (recent conversation mentions)
  if (context.includes(capability.name) ||
      capability.keywords.some(k => context.includes(k))) {
    score += 15;
  }

  return score;
}

/**
 * Build context injection for the agent
 */
export function buildCapabilityContext(
  capabilities: RetrievedCapability[]
): string {
  if (capabilities.length === 0) {
    return '';
  }

  let context = `\n## יכולות רלוונטיות שזיהיתי:\n`;

  for (const { capability } of capabilities) {
    context += `\n### ${capability.name}\n`;
    context += `${capability.description}\n`;
    context += `פרמטרים נדרשים:\n`;

    for (const param of capability.parameters) {
      const required = param.required ? '(חובה)' : '(אופציונלי)';
      const options = param.enum ? ` [${param.enum.join(', ')}]` : '';
      context += `- ${param.name} ${required}: ${param.description}${options}\n`;
    }

    if (capability.examples.length > 0) {
      context += `דוגמה: "${capability.examples[0].userRequest}"\n`;
    }
  }

  return context;
}
```

---

## Component 3: Slim Core System Prompt

A minimal system prompt that focuses on behavior, not capability listing.

```typescript
// src/services/ai/coreSystemPrompt.ts

export const CORE_SYSTEM_PROMPT = `אתה עוזר חכם ליצירת תוכן לימודי במערכת Wizdi.

## התפקיד שלך
לעזור למורים ליצור תוכן לימודי, לחפש מידע, ולבצע פעולות במערכת.

## כללי התנהגות
1. היה קצר, חם וידידותי
2. שאל שאלות ממוקדות כשחסר מידע
3. לפני יצירה - סכם מה הבנת מהמורה
4. **חשוב**: השתמש בכלים (tools) לביצוע פעולות - אל תתאר רק מה אפשר לעשות

## זיהוי סוג תוכן
- **אינטראקטיבי** (פעילות, מבחן דיגיטלי, שיעור): השתמש ב-generate_interactive_activity
- **סטטי** (דף עבודה, מבחן להדפסה, מכתב): השתמש ב-generate_static_content

## כשאינך בטוח
שאל: "אתם מתכוונים לתוכן דיגיטלי במערכת או משהו להדפסה?"

## פורמט תשובה
כשמבצע פעולה - החזר JSON עם:
{
  "action": "tool_call",
  "tool": "שם_הכלי",
  "parameters": {...},
  "userMessage": "הודעה למורה"
}

כששואל שאלה - החזר JSON עם:
{
  "action": "question",
  "message": "השאלה",
  "quickReplies": ["אפשרות 1", "אפשרות 2"]
}

## יכולות דינמיות
היכולות הרלוונטיות לשאלה שלך יוזרקו בהמשך. השתמש בהן!`;
```

---

## Component 4: Tool Executor

Execute capabilities as Gemini function calls.

```typescript
// src/services/ai/toolExecutor.ts

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

interface ToolCall {
  tool: string;
  parameters: Record<string, any>;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Execute a tool call from the agent
 */
export async function executeToolCall(
  toolCall: ToolCall,
  userId: string
): Promise<ToolResult> {
  const { tool, parameters } = toolCall;

  // Get capability definition
  const capability = await getCapability(tool);
  if (!capability) {
    return { success: false, error: `Tool ${tool} not found` };
  }

  // Validate required parameters
  for (const param of capability.parameters) {
    if (param.required && !(param.name in parameters)) {
      return { success: false, error: `Missing required parameter: ${param.name}` };
    }
  }

  try {
    switch (capability.execution.type) {
      case 'firebase_function':
        return await executeFirebaseFunction(capability.execution.target, parameters);

      case 'api_endpoint':
        return await executeApiCall(capability.execution.target, capability.execution.method, parameters);

      case 'internal_service':
        return await executeInternalService(capability.execution.target, parameters);

      default:
        return { success: false, error: 'Unknown execution type' };
    }
  } catch (error) {
    console.error(`Tool execution error for ${tool}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

async function executeFirebaseFunction(
  functionName: string,
  parameters: Record<string, any>
): Promise<ToolResult> {
  const func = httpsCallable(functions, functionName);
  const result = await func(parameters);
  return { success: true, data: result.data };
}

async function executeApiCall(
  endpoint: string,
  method: string = 'POST',
  parameters: Record<string, any>
): Promise<ToolResult> {
  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parameters)
  });

  if (!response.ok) {
    return { success: false, error: `API error: ${response.status}` };
  }

  const data = await response.json();
  return { success: true, data };
}

async function executeInternalService(
  target: string,
  parameters: Record<string, any>
): Promise<ToolResult> {
  // Parse service.method format
  const [serviceName, methodName] = target.split('.');

  // Dynamic import based on service name
  const services: Record<string, any> = {
    adaptiveContentService: () => import('../adaptiveContentService'),
    analyticsService: () => import('../analyticsService'),
    exportService: () => import('../exportService'),
    // ... add more services
  };

  if (!services[serviceName]) {
    return { success: false, error: `Service ${serviceName} not found` };
  }

  const service = await services[serviceName]();
  if (!service[methodName]) {
    return { success: false, error: `Method ${methodName} not found in ${serviceName}` };
  }

  const result = await service[methodName](parameters);
  return { success: true, data: result };
}
```

---

## Component 5: Enhanced SmartCreationService

Integrate RAG + tools into the existing service.

```typescript
// src/services/ai/smartCreationServiceV2.ts

import { callGeminiJSONFast, type ChatMessage } from '../ProxyService';
import { retrieveRelevantCapabilities, buildCapabilityContext } from './capabilityRAG';
import { executeToolCall } from './toolExecutor';
import { CORE_SYSTEM_PROMPT } from './coreSystemPrompt';

export interface EnhancedAIResponse {
  type: 'question' | 'action' | 'result' | 'info';
  message: string;
  quickReplies?: string[];

  // For action type
  toolCall?: {
    tool: string;
    parameters: Record<string, any>;
  };

  // For result type (after tool execution)
  result?: {
    success: boolean;
    data?: any;
    error?: string;
  };

  collectedData?: Partial<CollectedData>;
}

export async function analyzeTeacherIntentV2(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  currentData: CollectedData,
  userId: string
): Promise<EnhancedAIResponse> {
  // 1. Build conversation context
  const historyText = conversationHistory
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'מורה' : 'עוזר'}: ${m.content}`)
    .join('\n');

  // 2. Retrieve relevant capabilities via RAG
  const relevantCapabilities = await retrieveRelevantCapabilities(
    userMessage,
    historyText,
    5 // Max 5 capabilities to inject
  );

  // 3. Build dynamic context
  const capabilityContext = buildCapabilityContext(relevantCapabilities);

  // 4. Build tool definitions for Gemini function calling
  const tools = buildToolDefinitions(relevantCapabilities.map(r => r.capability));

  // 5. Call Gemini with function calling enabled
  const messages: ChatMessage[] = [
    { role: 'system', content: CORE_SYSTEM_PROMPT + capabilityContext },
    {
      role: 'user',
      content: `היסטוריית שיחה:\n${historyText || '(שיחה חדשה)'}\n\nהודעה חדשה: "${userMessage}"`
    }
  ];

  const response = await callGeminiWithTools(messages, tools);

  // 6. If response contains a tool call, execute it
  if (response.toolCall) {
    const result = await executeToolCall(response.toolCall, userId);

    return {
      type: 'result',
      message: result.success
        ? formatSuccessMessage(response.toolCall.tool, result.data)
        : `סליחה, הייתה בעיה: ${result.error}`,
      result,
      collectedData: response.collectedData
    };
  }

  return response;
}

function buildToolDefinitions(capabilities: Capability[]): ToolDefinition[] {
  return capabilities.map(cap => ({
    name: cap.id,
    description: cap.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        cap.parameters.map(p => [
          p.name,
          {
            type: p.type,
            description: p.description,
            enum: p.enum
          }
        ])
      ),
      required: cap.parameters.filter(p => p.required).map(p => p.name)
    }
  }));
}

async function callGeminiWithTools(
  messages: ChatMessage[],
  tools: ToolDefinition[]
): Promise<EnhancedAIResponse> {
  // Use Gemini 2.0 with function calling
  // Implementation depends on your Gemini SDK version
  // ...
}

function formatSuccessMessage(tool: string, data: any): string {
  // Format success messages based on tool type
  switch (tool) {
    case 'generate_static_content':
      return `מעולה! הנה ${data.contentType} שיצרתי על "${data.topic}"`;
    case 'search_curriculum':
      return `מצאתי ${data.length} תקנים רלוונטיים`;
    // ... more cases
    default:
      return 'הפעולה בוצעה בהצלחה!';
  }
}
```

---

## Component 6: Auto-Registration of New Capabilities

Automatically register new capabilities when features are added.

```typescript
// functions/src/utils/registerCapability.ts

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Decorator to auto-register a Firebase function as a capability
 */
export function registerCapability(config: Partial<Capability>) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // Register capability on cold start
    const db = getFirestore();
    const capabilityId = config.id || propertyKey;

    db.collection('capabilities').doc(capabilityId).set({
      ...config,
      id: capabilityId,
      execution: {
        type: 'firebase_function',
        target: propertyKey,
        requiresAuth: true
      },
      lastUpdated: FieldValue.serverTimestamp(),
      status: 'active'
    }, { merge: true }).catch(err => {
      console.warn(`Failed to register capability ${capabilityId}:`, err);
    });

    return descriptor;
  };
}

// Usage example:
@registerCapability({
  name: 'יצירת פודקאסט',
  description: 'יצירת תסריט פודקאסט עם שני מגישים',
  category: 'content_generation',
  parameters: [
    { name: 'topic', type: 'string', required: true, description: 'נושא הפודקאסט' },
    { name: 'targetAudience', type: 'string', required: false, description: 'קהל יעד' }
  ],
  keywords: ['פודקאסט', 'אודיו', 'שמיעה', 'דן ונועה']
})
export const generatePodcastScript = onCall(async (request) => {
  // ... implementation
});
```

---

## Migration Plan

### Phase 1: Build Foundation (Week 1)
1. Create `capabilities` Firestore collection
2. Seed initial capabilities from exploration results
3. Implement `capabilityRAG.ts` service

### Phase 2: Integrate Tools (Week 2)
1. Implement `toolExecutor.ts`
2. Create `smartCreationServiceV2.ts`
3. Update `SmartCreationChat.tsx` to use V2 service

### Phase 3: Test & Iterate (Week 3)
1. A/B test V1 vs V2 with teachers
2. Monitor tool execution success rates
3. Refine capability descriptions based on retrieval accuracy

### Phase 4: Auto-Registration (Week 4)
1. Add `@registerCapability` decorator
2. Retrofit existing functions
3. Implement capability health checks

---

## Benefits of This Architecture

1. **Always Up-to-Date**: New features auto-register as capabilities
2. **Executable**: Agent can actually DO things, not just describe
3. **Efficient**: Only inject relevant capabilities (token-efficient)
4. **Maintainable**: Capabilities are data, not hardcoded prompts
5. **Testable**: Each capability can be unit tested
6. **Extensible**: Easy to add new capabilities
7. **Observable**: Track which capabilities are used most

---

## Example Conversation Flow

**Teacher**: "רוצה ליצור דף עבודה על שברים לכיתה ד"

**RAG Retrieval**:
- `generate_static_content` (score: 35)
- `search_prompts` (score: 20)

**Agent Response**:
```json
{
  "action": "tool_call",
  "tool": "generate_static_content",
  "parameters": {
    "contentType": "worksheet",
    "topic": "שברים",
    "grade": "ד",
    "subject": "מתמטיקה"
  },
  "userMessage": "מייצרת לך דף עבודה על שברים לכיתה ד..."
}
```

**Tool Executor**: Calls `generateStaticContent` Firebase function

**Final Response**: "הנה דף העבודה שיצרתי על שברים! [Preview]"

---

## Summary

This architecture transforms the SmartCreationChat from a "describe-only" assistant to a **capable agent** that:
- Dynamically knows about ALL system capabilities
- Can execute actions directly via tool calling
- Stays current as new features are added
- Uses tokens efficiently via RAG retrieval
- Provides a better teacher experience with actual results, not just descriptions
