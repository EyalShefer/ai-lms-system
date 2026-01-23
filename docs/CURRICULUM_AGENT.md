# Curriculum Agent - סוכן אוטונומי ליצירת פעילויות

## סקירה כללית

ה-Curriculum Agent הוא סוכן אוטונומי מבוסס Gemini שיוצר פעילויות לימודיות איכותיות בעברית ובמדעים לכיתות ה-ו, ושומר אותן במאגר פעילויות (Activity Bank) עצמאי מקורסים.

**עקרון מנחה:** דיוק ואיכות על פני כמות - יצירת 5-10 פעילויות איכותיות בכל הרצה.

---

## ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRICULUM AGENT SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │    │  Firestore   │    │   Gemini     │       │
│  │   (React)    │───▶│   Queue      │───▶│   Agent      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                  │                    │                │
│         │                  │              ┌─────┴─────┐          │
│         │                  │              │ MCP Tools │          │
│         │                  │              └───────────┘          │
│         │                  │                    │                │
│         │                  │         ┌──────────┴──────────┐     │
│         │                  │         │                     │     │
│         │                  ▼         ▼                     ▼     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    EXISTING PIPELINE                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │    │
│  │  │Architect │─▶│Generator │─▶│ Guardian │               │    │
│  │  └──────────┘  └──────────┘  └──────────┘               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ACTIVITY BANK (Firestore)                    │   │
│  │  - Independent of courses                                 │   │
│  │  - Quality scores & ratings                               │   │
│  │  - Browse/Search/Copy to courses                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ADMIN DASHBOARD                              │   │
│  │  - Real-time monitoring                                   │   │
│  │  - Quality metrics                                        │   │
│  │  - Generation controls                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## מבני נתונים (Firestore Collections)

### 1. `activity_bank` - מאגר הפעילויות

```typescript
interface BankActivity {
    id: string;
    version: number;

    // סיווג
    subject: 'hebrew' | 'science';
    gradeLevel: 'ה' | 'ו';
    topic: string;
    subtopic?: string;
    curriculumStandardId: string;

    // תוכן (ActivityBlock format)
    activityType: ActivityBlockType;
    content: StrictBlockContent;
    metadata: ActivityBlockMetadata;
    bloomLevel: BloomLevel;
    learningObjectives: string[];

    // איכות
    qualityScore: number;           // 0-100
    guardianResult: GuardianResult;
    reviewStatus: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';

    // מעקב שימוש
    usageCount: number;
    averageRating: number;
    ratingCount: number;
    copiedToCoursesCount: number;

    // מטא-דאטא
    generatedBy: 'curriculum_agent' | 'manual';
    createdAt: Timestamp;
    tags: string[];
    searchKeywords: string[];
}
```

### 2. `curriculum_standards` - תקני תוכנית לימודים

```typescript
interface CurriculumStandard {
    id: string;
    subject: 'hebrew' | 'science';
    gradeLevel: 'ה' | 'ו';
    domain: string;                    // "קריאה והבנה" / "מערכות בגוף"
    topic: string;
    title: string;
    description: string;
    learningObjectives: string[];
    recommendedActivityTypes: ActivityBlockType[];
    recommendedBloomLevels: BloomLevel[];
    embedding?: number[];              // לחיפוש סמנטי (עתידי)
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
```

### 3. `activity_generation_queue` - תור יצירת פעילויות

```typescript
interface ActivityGenerationRequest {
    id: string;
    userId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';

    // פרמטרים
    subject: 'hebrew' | 'science';
    gradeLevel: 'ה' | 'ו';
    topic?: string;
    activityCount: number;          // 5-10 מומלץ
    bloomLevels: BloomLevel[];
    activityTypes?: ActivityBlockType[];

    // תוצאות
    result?: {
        activitiesCreated: number;
        activityIds: string[];
        qualityScores: number[];
        errors?: string[];
    };

    error?: string;
    createdAt: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
}
```

### 4. `activity_ratings` - דירוגי מורים

```typescript
interface ActivityRating {
    id: string;
    activityId: string;
    userId: string;
    userName: string;
    rating: number;      // 1-5
    comment?: string;
    createdAt: Timestamp;
}
```

---

## MCP Tools - כלים לסוכן

הסוכן משתמש בכלים הבאים לביצוע משימות:

| Tool | תיאור | Wraps |
|------|-------|-------|
| `load_curriculum_standards` | טעינת תקני תוכ"ל רלוונטיים | Firestore query |
| `generate_activity_skeleton` | יצירת שלד פעילות | `examArchitect.ts` |
| `generate_activity_content` | יצירת תוכן מלא | `examGenerator.ts` |
| `validate_activity` | בדיקת איכות | `examGuardian.ts` |
| `save_to_activity_bank` | שמירה למאגר | Firestore write |
| `search_existing_activities` | בדיקת כפילויות | Firestore query |

### Tool Schemas

```typescript
// functions/src/agent/mcpTools.ts

export const MCPToolSchemas = {
    load_curriculum_standards: {
        name: 'load_curriculum_standards',
        description: 'טעינת תקני תוכנית לימודים לפי מקצוע וכיתה',
        input_schema: {
            type: 'object',
            properties: {
                subject: { type: 'string', enum: ['hebrew', 'science'] },
                gradeLevel: { type: 'string', enum: ['ה', 'ו'] },
                topic: { type: 'string', description: 'נושא לחיפוש (אופציונלי)' }
            },
            required: ['subject', 'gradeLevel']
        }
    },

    generate_activity_skeleton: {
        name: 'generate_activity_skeleton',
        description: 'יצירת שלד פעילות לפי תקן תוכנית לימודים',
        input_schema: {
            type: 'object',
            properties: {
                standardId: { type: 'string' },
                activityType: { type: 'string' },
                bloomLevel: { type: 'string' },
                learningObjectives: { type: 'array', items: { type: 'string' } }
            },
            required: ['standardId', 'activityType', 'bloomLevel']
        }
    },

    generate_activity_content: {
        name: 'generate_activity_content',
        description: 'יצירת תוכן מלא לפעילות על בסיס שלד',
        input_schema: {
            type: 'object',
            properties: {
                skeleton: { type: 'object' },
                standard: { type: 'object' }
            },
            required: ['skeleton', 'standard']
        }
    },

    validate_activity: {
        name: 'validate_activity',
        description: 'בדיקת איכות פעילות לפני שמירה',
        input_schema: {
            type: 'object',
            properties: {
                activity: { type: 'object' }
            },
            required: ['activity']
        }
    },

    save_to_activity_bank: {
        name: 'save_to_activity_bank',
        description: 'שמירת פעילות שעברה בדיקת איכות למאגר',
        input_schema: {
            type: 'object',
            properties: {
                activity: { type: 'object' },
                qualityScore: { type: 'number' },
                guardianResult: { type: 'object' }
            },
            required: ['activity', 'qualityScore']
        }
    },

    search_existing_activities: {
        name: 'search_existing_activities',
        description: 'חיפוש פעילויות קיימות לבדיקת כפילויות',
        input_schema: {
            type: 'object',
            properties: {
                subject: { type: 'string' },
                gradeLevel: { type: 'string' },
                topic: { type: 'string' }
            },
            required: ['subject', 'gradeLevel']
        }
    }
};
```

---

## Cloud Function Trigger

הסוכן מופעל אוטומטית כשמסמך חדש נוצר ב-`activity_generation_queue`:

```typescript
// functions/src/index.ts

export const processActivityGenerationRequest = onDocumentCreated(
    {
        document: "activity_generation_queue/{docId}",
        secrets: [geminiApiKey, openAiApiKey],
        timeoutSeconds: 540,    // 9 דקות
        memory: "1GiB",
    },
    async (event) => {
        const data = event.data?.data() as ActivityGenerationRequest;
        if (!data || data.status !== "pending") return;

        // Mark as processing
        await event.data?.ref.update({
            status: "processing",
            startedAt: Timestamp.now()
        });

        try {
            const agent = new CurriculumAgent({
                geminiApiKey: geminiApiKey.value(),
                openaiApiKey: openAiApiKey.value(),
                maxIterations: 50,
                timeoutMs: 480000,
                activityCountPerRun: data.activityCount || 5
            });

            const result = await agent.generateActivities(data);

            await event.data?.ref.update({
                status: "completed",
                result,
                completedAt: Timestamp.now()
            });
        } catch (error: any) {
            await event.data?.ref.update({
                status: "failed",
                error: error.message,
                completedAt: Timestamp.now()
            });
        }
    }
);
```

---

## Curriculum Agent - המנוע הראשי

```typescript
// functions/src/agent/curriculumAgent.ts

export class CurriculumAgent {
    private client: GoogleGenAI;
    private tools: MCPToolImplementations;
    private config: AgentConfig;

    constructor(config: AgentConfig) {
        this.config = config;
        this.client = new GoogleGenAI({
            apiKey: config.geminiApiKey || process.env.GEMINI_API_KEY
        });
        this.tools = new MCPToolImplementations(config);
    }

    async generateActivities(request: ActivityGenerationRequest): Promise<GenerationResult> {
        const systemPrompt = `
אתה סוכן מומחה ביצירת פעילויות לימודיות לתלמידי ישראל.

עקרונות:
1. איכות מעל כמות - כל פעילות חייבת לעבור בדיקת Guardian עם ציון 80+
2. התאמה לתוכנית הלימודים הישראלית
3. שפה מותאמת לגיל (כיתות ה-ו)
4. מגוון ברמות בלום וסוגי פעילויות

זרימת עבודה לכל פעילות:
1. load_curriculum_standards - טען תקנים רלוונטיים
2. search_existing_activities - בדוק שאין כפילויות
3. generate_activity_skeleton - צור שלד
4. generate_activity_content - צור תוכן מלא
5. validate_activity - בדוק איכות
6. אם ציון >= 80: save_to_activity_bank
   אם ציון 60-79: נסה לשפר ושמור
   אם ציון < 60: נסה מחדש עם פרמטרים שונים

יעד: ליצור ${request.activityCount} פעילויות איכותיות.
מקצוע: ${request.subject === 'hebrew' ? 'עברית' : 'מדעים'}
כיתה: ${request.gradeLevel}
${request.topic ? `נושא: ${request.topic}` : ''}
        `;

        // Agentic loop implementation...
    }
}
```

---

## סף איכות אוטומטי

```typescript
const QUALITY_THRESHOLDS = {
    AUTO_APPROVE: 80,      // אישור אוטומטי - נשמר למאגר
    PENDING_REVIEW: 60,    // ממתין לבדיקה ידנית
    AUTO_REJECT: 59        // דחייה אוטומטית - לא נשמר
};

// Review Status Logic
function determineReviewStatus(qualityScore: number): ReviewStatus {
    if (qualityScore >= QUALITY_THRESHOLDS.AUTO_APPROVE) {
        return 'auto_approved';
    } else if (qualityScore >= QUALITY_THRESHOLDS.PENDING_REVIEW) {
        return 'pending_review';
    } else {
        return 'rejected';
    }
}
```

---

## Firestore Rules

```javascript
// firestore.rules

// Activity Bank - Read-only for users, write only via Cloud Functions
match /activity_bank/{activityId} {
    allow read: if isAuthenticated();
    allow create: if false; // Only Cloud Functions
    allow update: if isAuthenticated() &&
        request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['usageCount', 'averageRating', 'ratingCount']);
    allow delete: if false;
}

// Curriculum Standards - Read-only
match /curriculum_standards/{standardId} {
    allow read: if isAuthenticated();
    allow write: if false; // Admin/seed only
}

// Activity Generation Queue
match /activity_generation_queue/{requestId} {
    allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;
    allow read: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
    allow update, delete: if false;
}

// Activity Ratings
match /activity_ratings/{ratingId} {
    allow read: if isAuthenticated();
    allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;
    allow update, delete: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
}
```

---

## Frontend Services

### Activity Bank Service

```typescript
// src/services/activityBankService.ts

// Browse activities
export async function getActivities(
    filters: ActivityFilters,
    limitCount?: number
): Promise<BankActivity[]>

// Get single activity
export async function getActivityById(id: string): Promise<BankActivity | null>

// Search activities
export async function searchActivities(query: string): Promise<BankActivity[]>

// Track usage when activity is copied to course
export async function trackActivityUsage(activityId: string): Promise<void>

// Rate an activity
export async function rateActivity(
    activityId: string,
    userId: string,
    userName: string,
    rating: number,
    comment?: string
): Promise<void>

// Convert bank activity to course block
export function convertBankActivityToBlock(activity: BankActivity): ActivityBlock

// Request new activity generation
export async function requestActivityGeneration(
    userId: string,
    params: GenerationRequestParams
): Promise<string>

// Subscribe to generation status
export function subscribeToGenerationStatus(
    requestId: string,
    callback: (status, result, error) => void
): () => void
```

### Agent Monitoring Service

```typescript
// src/services/agentMonitoringService.ts

// Get all generation requests (admin)
export async function getAllGenerationRequests(
    limitCount?: number
): Promise<GenerationRequest[]>

// Subscribe to real-time updates
export function subscribeToGenerationRequests(
    callback: (requests: GenerationRequest[]) => void,
    limitCount?: number
): () => void

// Get activities from bank
export async function getAllActivities(
    limitCount?: number
): Promise<AgentActivity[]>

// Subscribe to activities updates
export function subscribeToActivities(
    callback: (activities: AgentActivity[]) => void,
    limitCount?: number
): () => void

// Get agent statistics
export async function getAgentStats(): Promise<AgentStats>

// Get curriculum standards
export async function getCurriculumStandards(): Promise<CurriculumStandard[]>
```

---

## React Hooks

```typescript
// src/hooks/useActivityBank.ts

// Browse and filter activities
export function useActivities(initialFilters?: ActivityFilters) {
    return {
        activities,
        loading,
        error,
        filters,
        updateFilters,
        clearFilters,
        refresh,
        search
    };
}

// Single activity with rating
export function useActivity(activityId: string | null) {
    return {
        activity,
        loading,
        error,
        rate,
        trackUsage
    };
}

// Activity generation
export function useActivityGeneration(userId: string | undefined) {
    return {
        requestId,
        status,      // 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
        result,
        error,
        startGeneration,
        reset,
        isGenerating
    };
}
```

---

## Frontend Components

### Activity Bank Components

| Component | תיאור | מיקום |
|-----------|-------|-------|
| `ActivityCard` | תצוגת פעילות בודדת | `src/components/ActivityBank/ActivityCard.tsx` |
| `ActivityBankBrowser` | עיון ופילטור מאגר | `src/components/ActivityBank/ActivityBankBrowser.tsx` |
| `ActivityGeneratorPanel` | ממשק הפעלת הסוכן | `src/components/ActivityBank/ActivityGeneratorPanel.tsx` |
| `ActivityPicker` | בחירת פעילויות להעתקה | `src/components/ActivityBank/ActivityPicker.tsx` |

### Admin Dashboard

| Component | תיאור | מיקום |
|-----------|-------|-------|
| `AgentDashboard` | דשבורד ניהול סוכן | `src/components/admin/AgentDashboard.tsx` |

**AgentDashboard Tabs:**
1. **סקירה כללית** - סטטיסטיקות, התפלגות איכות, פעילויות לפי מקצוע
2. **בקשות** - רשימת בקשות יצירה בזמן אמת
3. **פעילויות** - רשימת פעילויות שנוצרו
4. **תקנים** - תקני תוכנית לימודים שנטענו

---

## תקני תוכנית לימודים

המערכת כוללת 20 תקנים מובנים:

### עברית (10 תקנים)
- **כיתה ה:**
  - קריאה והבנה של טקסטים ספרותיים
  - זיהוי רעיון מרכזי ומסרים
  - כתיבה יצירתית
  - דקדוק - שם עצם ושם פועל
  - אוצר מילים והרחבה

- **כיתה ו:**
  - ניתוח טקסטים מורכבים
  - כתיבה עיונית ומבנה טיעון
  - דקדוק מתקדם - משפטים מורכבים
  - שפת המדיה והפרסומת
  - סיכום וציטוט מקורות

### מדעים (10 תקנים)
- **כיתה ה:**
  - מערכות בגוף האדם
  - חומרים ותכונותיהם
  - מצבי צבירה ומעברים
  - אנרגיה וסוגיה
  - כוחות ותנועה

- **כיתה ו:**
  - תאים ומבנה בסיסי
  - אקולוגיה ומערכות אקולוגיות
  - חשמל ומעגלים
  - כדור הארץ והיקום
  - תהליכים מדעיים ושיטת המחקר

---

## הפעלת הסוכן

### דרך ה-Admin Dashboard

1. היכנס לדף הבית כאדמין
2. לחץ על כפתור "סוכן AI" בתחתית הדף
3. בדשבורד, השתמש ב-ActivityGeneratorPanel:
   - בחר מקצוע (עברית/מדעים)
   - בחר כיתה (ה/ו)
   - בחר נושא (אופציונלי)
   - הגדר כמות פעילויות (5-10)
   - בחר רמות בלום
   - לחץ "התחל יצירה"

### דרך קוד

```typescript
import { requestActivityGeneration } from '../services/activityBankService';

// Request generation
const requestId = await requestActivityGeneration(userId, {
    subject: 'hebrew',
    gradeLevel: 'ה',
    topic: 'קריאה והבנה',
    activityCount: 5,
    bloomLevels: ['remember', 'understand', 'apply']
});

// Subscribe to status updates
const unsubscribe = subscribeToGenerationStatus(requestId, (status, result, error) => {
    console.log('Status:', status);
    if (status === 'completed') {
        console.log('Created activities:', result.activityIds);
    }
});
```

---

## Seeding Curriculum Standards

להרצת סקריפט ה-seeding:

```bash
cd functions
npx ts-node src/scripts/seedCurriculumStandards.ts
```

**דרישות:**
- קובץ `service-account-key.json` בתיקיית השורש
- הרשאות Firestore write

---

## מבנה קבצים

```
functions/src/
├── agent/
│   ├── curriculumAgent.ts      # Main agent orchestrator
│   ├── mcpTools.ts             # MCP tool implementations
│   └── types.ts                # Agent-specific types
├── services/
│   └── activityBank/
│       ├── types.ts            # BankActivity, CurriculumStandard
│       └── activityBankService.ts  # Backend CRUD
└── scripts/
    └── seedCurriculumStandards.ts  # Initial data seeding

src/
├── services/
│   ├── activityBankService.ts  # Frontend service
│   └── agentMonitoringService.ts  # Admin monitoring
├── hooks/
│   └── useActivityBank.ts      # React hooks
└── components/
    ├── ActivityBank/
    │   ├── index.ts
    │   ├── ActivityCard.tsx
    │   ├── ActivityBankBrowser.tsx
    │   ├── ActivityGeneratorPanel.tsx
    │   └── ActivityPicker.tsx
    └── admin/
        └── AgentDashboard.tsx
```

---

## טיפול בשגיאות

### שגיאות נפוצות

| שגיאה | סיבה | פתרון |
|-------|------|-------|
| `PERMISSION_DENIED` | חוסר הרשאות Firestore | בדוק rules והרשאות משתמש |
| `DEADLINE_EXCEEDED` | timeout בייצור | הקטן activityCount |
| `INVALID_ARGUMENT` | פרמטרים לא תקינים | בדוק subject/gradeLevel |
| Quality < 60 | פעילות לא עברה Guardian | הסוכן מנסה מחדש אוטומטית |

### Retry Logic

הסוכן כולל retry אוטומטי:
- עד 3 ניסיונות לכל פעילות
- שינוי פרמטרים בין ניסיונות
- דילוג על פעילות אחרי 3 כישלונות

---

## Monitoring & Debugging

### Logs

```bash
# View Cloud Function logs
firebase functions:log --only processActivityGenerationRequest
```

### Firestore Console

- `activity_generation_queue` - מעקב בקשות
- `activity_bank` - פעילויות שנוצרו
- `curriculum_standards` - תקנים טעונים

### Admin Dashboard

- סטטיסטיקות בזמן אמת
- היסטוריית בקשות
- התפלגות איכות

---

## שיפורים עתידיים

1. **Embeddings לחיפוש סמנטי** - הוספת embeddings לתקנים ופעילויות
2. **A/B Testing** - בדיקת גרסאות שונות של פעילויות
3. **Auto-scheduling** - יצירה אוטומטית תקופתית
4. **Teacher feedback loop** - למידה מדירוגי מורים
5. **Multi-language** - תמיכה בשפות נוספות
