# AI-LMS System - מסמך ארכיטקטורה מפורט

**גרסה:** 2.0.0
**תאריך עדכון אחרון:** ינואר 2026
**סטטוס:** Production

---

## תוכן עניינים

1. [סקירה כללית](#1-סקירה-כללית)
2. [מבנה הפרויקט](#2-מבנה-הפרויקט)
3. [Technology Stack](#3-technology-stack)
4. [ארכיטקטורת Frontend](#4-ארכיטקטורת-frontend)
5. [ארכיטקטורת Backend](#5-ארכיטקטורת-backend)
6. [סכמת מסד הנתונים](#6-סכמת-מסד-הנתונים)
7. [מערכת ה-AI](#7-מערכת-ה-ai)
8. [מערכת הלמידה האדפטיבית](#8-מערכת-הלמידה-האדפטיבית)
9. [אבטחה והרשאות](#9-אבטחה-והרשאות)
10. [אינטגרציות חיצוניות](#10-אינטגרציות-חיצוניות)
11. [ביצועים וסקלאביליות](#11-ביצועים-וסקלאביליות)
12. [תהליכי פיתוח ו-DevOps](#12-תהליכי-פיתוח-ו-devops)

---

## 1. סקירה כללית

### 1.1 מטרת המערכת

AI-LMS היא מערכת ניהול למידה (Learning Management System) מבוססת בינה מלאכותית, המיועדת ליצירת תוכן חינוכי אינטראקטיבי בעברית. המערכת משלבת יכולות AI מתקדמות ליצירת שיעורים, מבחנים ופעילויות למידה, עם מנגנון למידה אדפטיבית המתאים את רמת הקושי לכל תלמיד.

### 1.2 יכולות מרכזיות

| תחום | יכולות |
|------|--------|
| **יצירת תוכן** | הפקת שיעורים מ-PDF, יצירת מבחנים, 38 סוגי פעילויות אינטראקטיביות |
| **למידה אדפטיבית** | התאמת קושי בזמן אמת, מעקב אחר שליטה (Mastery), פיגומים לימודיים |
| **ניתוח נתונים** | אנליטיקות Bloom's Taxonomy, זיהוי התקשות, ניתוח שגיאות |
| **מולטימדיה** | הפקת וידאו (Remotion), המרת טקסט לדיבור (ElevenLabs), אינפוגרפיקות |
| **בחינות בגרות** | מערכת תרגול בגרויות ישראליות מלאה |

### 1.3 נתונים סטטיסטיים

```
├── קומפוננטות React: 177
├── שירותי Backend: 69+
├── שירותי Frontend: 55+
├── קולקציות Firestore: 21+
├── סוגי פעילויות: 38
├── שורות קוד Prompts: 30,000+
└── מודלי AI: Gemini 2.0 Flash, Gemini 3 Pro, Imagen 4
```

---

## 2. מבנה הפרויקט

### 2.1 מבנה תיקיות ראשי

```
ai-lms-system/
│
├── src/                              # Frontend - React Application
│   ├── App.tsx                       # Main router & initialization
│   ├── firebase.ts                   # Firebase SDK configuration
│   ├── components/                   # 177 React components
│   │   ├── CourseEditor.tsx          # עריכת קורסים (96KB)
│   │   ├── CoursePlayer.tsx          # נגן קורסים לתלמידים (104KB)
│   │   ├── admin/                    # ממשק מנהל
│   │   ├── dashboard/                # לוחות בקרה
│   │   ├── questions/                # סוגי שאלות אינטראקטיביים
│   │   ├── referenceExams/           # מערכת בגרויות
│   │   ├── ActivityBank/             # בנק פעילויות
│   │   └── ui/                       # UI components
│   │
│   ├── context/                      # React Context (State Management)
│   │   ├── AuthContext.tsx           # Authentication state
│   │   ├── CourseContext.tsx         # Course editing state
│   │   └── StudentCourseContext.tsx  # Student playback state
│   │
│   ├── services/                     # 55+ Frontend services
│   │   ├── adaptiveIntegrationService.ts
│   │   ├── adaptiveLoggingService.ts
│   │   ├── adaptivePolicyService.ts
│   │   ├── variantCacheService.ts
│   │   ├── streamingService.ts
│   │   └── ...
│   │
│   ├── hooks/                        # Custom React hooks
│   ├── prompts/                      # Client-side prompt templates
│   ├── remotion/                     # Video generation compositions
│   └── shared/                       # Shared types & utilities
│       ├── types/
│       │   ├── course.ts
│       │   ├── activityBlocks.ts
│       │   └── adaptive.ts
│       └── utils/
│
├── functions/                        # Backend - Firebase Cloud Functions
│   └── src/
│       ├── index.ts                  # Function exports & routing
│       ├── ai/
│       │   └── prompts.ts            # 30,000+ lines of AI prompts
│       ├── controllers/              # API controllers
│       ├── services/                 # 69+ Backend services
│       │   ├── geminiService.ts
│       │   ├── usageService.ts
│       │   └── ...
│       ├── streaming/                # SSE real-time streaming
│       ├── middleware/               # Rate limiting, auth
│       └── agent/                    # Curriculum agent & MCP tools
│
├── tests/                            # Test suites
│   ├── frontend/
│   └── backend/
│
├── docs/                             # Documentation
│
├── firestore.rules                   # Database security rules
├── firestore.indexes.json            # Query indexes
├── storage.rules                     # Storage security rules
├── firebase.json                     # Firebase configuration
├── package.json                      # Frontend dependencies
└── functions/package.json            # Backend dependencies
```

### 2.2 עקרונות ארגון הקוד

**הפרדת שכבות (Layered Architecture):**
```
┌─────────────────────────────────────────────┐
│              Presentation Layer             │
│         (React Components, UI/UX)           │
├─────────────────────────────────────────────┤
│              Application Layer              │
│    (Context, Hooks, Services - Frontend)    │
├─────────────────────────────────────────────┤
│               Domain Layer                  │
│      (Business Logic - Cloud Functions)     │
├─────────────────────────────────────────────┤
│            Infrastructure Layer             │
│    (Firebase, Gemini API, External APIs)    │
└─────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend Stack

```typescript
// Core Framework
React 18.2.0           // UI Framework
TypeScript 5.2.2       // Type Safety
Vite 5.2.0             // Build Tool
React Router DOM 6.22  // Client-side Routing

// State Management
React Context API      // Global State
Zustand               // Course Store
Custom Hooks          // Local State

// UI Framework
Tailwind CSS 3.4.3    // Utility-first CSS
Tabler Icons React    // Icon Library
Tiptap 3.14.0         // Rich Text Editor

// Data Visualization
Recharts 3.6.0        // Charts & Graphs
React Flow 11.11.4    // Node-based Diagrams

// Content Processing
react-markdown 10.1   // Markdown Rendering
KaTeX 0.16.27         // LaTeX Math
DOMPurify 3.3.1       // XSS Protection

// AI Integration
@google/generative-ai 0.24  // Gemini Client SDK
Remotion 4.0.409            // Video Generation

// PDF Processing
pdfjs-dist 4.10       // PDF Viewing
jsPDF 4.0.0           // PDF Generation
```

### 3.2 Backend Stack

```typescript
// Runtime & Framework
Node.js 22                    // Runtime
Firebase Functions 7.0.2      // Serverless Compute
Express 4.21.0                // HTTP Server (custom endpoints)
TypeScript 5.7.3              // Type Safety

// Database & Storage
Firebase Admin SDK 13.6       // Firestore Access
Cloud Storage                 // File Storage

// AI Services
@google-cloud/vertexai 1.10   // Vertex AI
@google/genai 1.35            // Gemini SDK
OpenAI 6.15 (legacy)          // Fallback

// Security
rate-limiter-flexible 5.0     // Rate Limiting
CORS 2.8.5                    // Cross-Origin

// Content Processing
pdf-lib 1.17                  // PDF Manipulation
pdf-parse 1.1                 // PDF Text Extraction
youtube-transcript 1.2        // YouTube Integration
```

### 3.3 External Services

| שירות | ספק | שימוש |
|-------|-----|-------|
| LLM Text Generation | Google Gemini 2.0 Flash | יצירת תוכן, תשובות AI |
| Advanced Reasoning | Google Gemini 3 Pro | היגיון מורכב |
| Image Generation | Gemini 3 Pro Image / Imagen 4 | אינפוגרפיקות |
| Text-to-Speech | ElevenLabs | הקראת תוכן בעברית |
| Video Generation | Remotion (self-hosted) | סרטוני הסבר |
| Authentication | Firebase Auth | Google OAuth, Email |
| Database | Firestore | NoSQL Database |
| File Storage | Cloud Storage | PDFs, Images, Videos |
| Hosting | Firebase Hosting | SPA Hosting |

---

## 4. ארכיטקטורת Frontend

### 4.1 Component Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        App.tsx                             │
│                    (Router + Providers)                    │
├────────────────────────────────────────────────────────────┤
│  AuthProvider → CourseProvider → StudentCourseProvider     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Admin Routes │  │Teacher Routes│  │Student Routes│     │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤     │
│  │AdminDashboard│  │ CourseEditor │  │ CoursePlayer │     │
│  │UsageDashboard│  │TeacherDashbrd│  │StudentDashbrd│     │
│  │ UserManager  │  │ BagrutEditor │  │BagrutPractice│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 4.2 State Management Pattern

```typescript
// AuthContext.tsx - Authentication State
interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  userRole: 'admin' | 'teacher' | 'student';
  usageStats: UsageStats;
  login: (method: AuthMethod) => Promise<void>;
  logout: () => Promise<void>;
}

// CourseContext.tsx - Course Editing State
interface CourseContextType {
  course: Course;
  currentModule: number;
  currentUnit: number;
  isDirty: boolean;
  updateUnit: (unit: LearningUnit) => void;
  addActivityBlock: (block: ActivityBlock) => void;
  saveCourse: () => Promise<void>;
}

// StudentCourseContext.tsx - Student Learning State
interface StudentCourseContextType {
  enrollment: Enrollment;
  currentUnit: LearningUnit;
  progress: UnitProgress;
  mastery: number;
  submitAnswer: (answer: Answer) => Promise<SubmissionResult>;
  nextActivity: () => void;
}
```

### 4.3 Key Components Deep Dive

#### CourseEditor.tsx (96KB)
```typescript
// Main teacher interface for course creation
// Responsibilities:
// - Module/Unit management with drag-drop
// - Activity block creation & editing
// - AI content generation triggers
// - Knowledge base integration
// - Preview mode

Key Features:
├── ModuleList - רשימת מודולים עם Drag & Drop
├── UnitEditor - עורך יחידת לימוד
├── ActivityBlockEditor - עורך פעילויות (38 סוגים)
├── AIGenerationPanel - לוח יצירת תוכן AI
├── PreviewMode - תצוגה מקדימה כתלמיד
└── SettingsPanel - הגדרות קורס
```

#### CoursePlayer.tsx (104KB)
```typescript
// Student course playback interface
// Responsibilities:
// - Sequential unit progression
// - Activity rendering & interaction
// - Answer submission & grading
// - Adaptive scaffolding display
// - Progress tracking

Key Features:
├── UnitRenderer - מרנדר יחידות לימוד
├── ActivityRenderer - מרנדר פעילויות (switch on 38 types)
├── ProgressBar - סרגל התקדמות
├── ScaffoldingModal - חלון פיגומים לימודיים
├── ScoreDisplay - תצוגת ציונים
└── NavigationControls - ניווט בין פעילויות
```

### 4.4 Service Layer Pattern

```typescript
// Frontend services follow this pattern:

// adaptiveLoggingService.ts
export const adaptiveLoggingService = {
  // Log student events to backend
  async logEvent(event: AdaptiveEvent): Promise<void> {
    await addDoc(collection(db, 'users', userId, 'adaptive_events'), {
      ...event,
      timestamp: serverTimestamp()
    });
  },

  // Get recent events for analysis
  async getRecentEvents(userId: string, limit = 50): Promise<AdaptiveEvent[]> {
    const q = query(
      collection(db, 'users', userId, 'adaptive_events'),
      orderBy('timestamp', 'desc'),
      limit(limit)
    );
    return (await getDocs(q)).docs.map(d => d.data() as AdaptiveEvent);
  }
};

// streamingService.ts - SSE Client
export const streamingService = {
  startStream(endpoint: string, onData: (chunk: string) => void): EventSource {
    const source = new EventSource(endpoint);
    source.onmessage = (e) => onData(e.data);
    return source;
  }
};
```

---

## 5. ארכיטקטורת Backend

### 5.1 Cloud Functions Architecture

```typescript
// functions/src/index.ts - Main exports

// === Callable Functions (onCall) ===
export const geminiChat = onCall(geminiChatHandler);
export const geminiChatFast = onCall(geminiChatFastHandler);
export const submitAdaptiveAnswer = onCall(submitAdaptiveAnswerHandler);
export const runAdaptiveSimulation = onCall(runAdaptiveSimulationHandler);
export const analyzeImageWithVision = onCall(analyzeImageHandler);

// === HTTP Functions (onRequest) ===
export const openaiProxy = onRequest(openaiProxyHandler);
export const elevenLabsProxy = onRequest(elevenLabsProxyHandler);
export const streamingContent = onRequest(streamingHandler);

// === Document Triggers ===
export const onLessonGenerationCreated = onDocumentCreated(
  'lesson_generation_queue/{docId}',
  lessonGenerationHandler
);
export const onExamGenerationCreated = onDocumentCreated(
  'exam_generation_queue/{docId}',
  examGenerationHandler
);

// === Scheduled Functions ===
export const processEventsTrigger = onSchedule('every 5 minutes', processEventsHandler);
export const updateAINews = onSchedule('every 6 hours', updateNewsHandler);
export const runNightlyQATests = onSchedule('every day 02:00', qaTestsHandler);
```

### 5.2 Service Layer Architecture

```typescript
// geminiService.ts - Core AI Service
export class GeminiService {
  private model: GenerativeModel;

  constructor() {
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-001'
    });
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096
      }
    });
    return result.response.text();
  }

  async generateJSON<T>(prompt: string, schema: Schema): Promise<T> {
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });
    return JSON.parse(result.response.text()) as T;
  }

  async generateWithVision(prompt: string, imageUrl: string): Promise<string> {
    const imageData = await fetchImageAsBase64(imageUrl);
    const result = await this.model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/png', data: imageData } }
        ]
      }]
    });
    return result.response.text();
  }
}
```

### 5.3 Streaming Architecture (SSE)

```typescript
// streaming/streamingServer.ts

export const streamContent = async (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const { prompt, options } = req.body;

  try {
    const stream = await geminiService.generateContentStream(prompt);

    for await (const chunk of stream) {
      const text = chunk.text();
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};
```

### 5.4 Controller Pattern

```typescript
// controllers/adaptiveController.ts

export const submitAdaptiveAnswerHandler = async (request: CallableRequest) => {
  const { courseId, unitId, activityId, answer, responseTime } = request.data;
  const userId = request.auth?.uid;

  if (!userId) throw new HttpsError('unauthenticated', 'Must be logged in');

  // 1. Grade the answer
  const gradingResult = await gradingService.gradeAnswer(activityId, answer);

  // 2. Calculate mastery change
  const masteryUpdate = await masteryService.calculateMasteryChange(
    userId, unitId, gradingResult.isCorrect
  );

  // 3. Check scaffolding policy
  const scaffolding = await scaffoldingPolicy.evaluate(
    userId, masteryUpdate.newMastery, gradingResult
  );

  // 4. Log adaptive event
  await adaptiveLoggingService.logEvent({
    type: 'answer_submitted',
    userId, courseId, unitId, activityId,
    answer, isCorrect: gradingResult.isCorrect,
    masteryBefore: masteryUpdate.oldMastery,
    masteryAfter: masteryUpdate.newMastery,
    scaffoldingOffered: scaffolding ?? undefined,
    responseTime,
    timestamp: FieldValue.serverTimestamp()
  });

  // 5. Update student profile
  await profileService.updateAfterAnswer(userId, masteryUpdate, gradingResult);

  return {
    isCorrect: gradingResult.isCorrect,
    mastery: masteryUpdate.newMastery,
    feedback: gradingResult.feedback,
    scaffolding
  };
};
```

---

## 6. סכמת מסד הנתונים

### 6.1 Firestore Collections Overview

```
Firestore Database
│
├── users/{userId}                    # משתמשים
│   ├── profile/                      # פרופיל למידה
│   ├── adaptive_events/{eventId}     # אירועי למידה אדפטיבית
│   ├── sessions/{sessionId}          # סשנים
│   └── gamification/                 # משחוק
│
├── courses/{courseId}                # קורסים
│   ├── units/{unitId}                # יחידות לימוד
│   ├── assignments/{assignmentId}    # מטלות
│   └── resources/{resourceId}        # משאבים
│
├── enrollments/{enrollmentId}        # הרשמות לקורסים
├── submissions/{submissionId}        # הגשות
├── student_tasks/{taskId}            # משימות לתלמידים
├── activity_bank/{activityId}        # בנק פעילויות
│
├── lesson_generation_queue/{id}      # תור יצירת שיעורים
├── exam_generation_queue/{id}        # תור יצירת מבחנים
│
├── safety_alerts/{alertId}           # התראות בטיחות
├── feedback_logs/{feedbackId}        # משוב משתמשים
├── security_logs/{logId}             # לוג אבטחה
│
└── prompts/{promptId}                # תבניות Prompt
```

### 6.2 Document Schemas

#### User Document
```typescript
// users/{userId}
interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;

  // Roles
  roles: ('admin' | 'teacher' | 'student')[];
  isAdmin: boolean;
  teacherId?: string;
  institutionId?: string;

  // Licensing
  licenseTier: 'free' | 'pro' | 'enterprise';
  licenseStatus: 'active' | 'expired' | 'suspended';
  licenseExpiresAt?: Timestamp;

  // Usage
  monthlyUsage: {
    textTokens: number;
    imageTokens: number;
    audioMinutes: number;
    videoMinutes: number;
  };

  // Gamification
  totalPoints: number;
  totalXP: number;
  streakDays: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}
```

#### Course Document
```typescript
// courses/{courseId}
interface CourseDocument {
  id: string;
  teacherId: string;
  title: string;
  description?: string;
  subject?: string;
  gradeLevel?: string;
  targetAudience: string;

  // Structure
  syllabus: Module[];
  mode: 'learning' | 'practice' | 'assessment';

  // Settings
  showSourceToStudent: boolean;
  pdfSource?: string;
  fullBookContent?: string;

  // Stats
  enrollmentCount: number;
  totalCompletions: number;
  averageScore?: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

interface Module {
  id: string;
  title: string;
  description?: string;
  order: number;
  learningUnits: LearningUnit[];
}

interface LearningUnit {
  id: string;
  title: string;
  type: 'acquisition' | 'practice' | 'test';
  baseContent: string;
  learningObjectives?: string[];
  activityBlocks: ActivityBlock[];
  estimatedTime?: number;
  difficulty?: number;
}
```

#### Adaptive Event Document
```typescript
// users/{userId}/adaptive_events/{eventId}
interface AdaptiveEventDocument {
  eventId: string;
  userId: string;
  courseId: string;
  unitId: string;
  activityBlockId: string;

  type: 'answer_submitted' | 'scaffolding_offered' |
        'scaffolding_accepted' | 'scaffolding_declined' |
        'unit_started' | 'unit_completed';

  // For answers
  answer?: string;
  isCorrect?: boolean;
  masteryBefore?: number;
  masteryAfter?: number;

  // For scaffolding
  scaffoldingOffered?: {
    type: 'הבנה' | 'העמקה';
    content?: string;
    difficulty?: number;
  };
  scaffoldingAccepted?: boolean;

  // Context
  sessionDuration?: number;
  responseTime?: number;
  attemptNumber?: number;

  timestamp: Timestamp;
}
```

#### Student Profile Document
```typescript
// users/{userId}/profile
interface StudentProfileDocument {
  userId: string;

  // Aggregated Mastery
  totalMastery: number;           // 0-1
  engagementScore: number;        // 0-100
  learningVelocity: number;       // Speed of improvement

  // Scaffolding Patterns
  scaffoldingPatterns: {
    totalOffered: number;
    totalAccepted: number;
    totalDeclined: number;
    acceptanceRate: number;
    avgMasteryWhenOffered: number;
    avgMasteryWhenAccepted: number;
    avgMasteryWhenDeclined: number;
    preferredVariantType: 'הבנה' | 'העמקה' | null;
  };

  // Topic Mastery
  topicMastery: Record<string, number>;
  strugglingTopics: string[];

  // Session Data
  sessionCount: number;
  averageSessionDuration: number;

  // Gamification
  totalXP: number;
  level: number;
  badges: string[];

  lastUpdated: Timestamp;
}
```

### 6.3 Indexes

```json
// firestore.indexes.json - Key Indexes

[
  {
    "collectionGroup": "courses",
    "fields": [
      { "fieldPath": "teacherId", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "submissions",
    "fields": [
      { "fieldPath": "studentId", "order": "ASCENDING" },
      { "fieldPath": "submittedAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "adaptive_events",
    "fields": [
      { "fieldPath": "userId", "order": "ASCENDING" },
      { "fieldPath": "courseId", "order": "ASCENDING" },
      { "fieldPath": "timestamp", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "enrollments",
    "fields": [
      { "fieldPath": "studentId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  }
]
```

---

## 7. מערכת ה-AI

### 7.1 מודלים בשימוש

| מודל | שימוש | Latency | עלות |
|------|-------|---------|------|
| Gemini 2.0 Flash | יצירת תוכן, תשובות | 100-300ms | נמוכה |
| Gemini 3 Pro Preview | היגיון מורכב | 500-2000ms | בינונית |
| Gemini 3 Pro Image | אינפוגרפיקות | 2-5s | גבוהה |
| Imagen 4 | תמונות (fallback) | 3-8s | גבוהה |
| ElevenLabs | Text-to-Speech | 1-3s | לפי תווים |

### 7.2 Prompt Architecture

```typescript
// functions/src/ai/prompts.ts - 30,000+ lines

// Structure:
export const prompts = {
  // Lesson Generation
  lessonPlan: {
    system: (context: LessonContext) => `...`,
    generate: (content: string, options: LessonOptions) => `...`,
    refine: (draft: string, feedback: string) => `...`
  },

  // Activity Generation (38 types)
  activityBlocks: {
    multipleChoice: (topic: string, difficulty: number) => `...`,
    cloze: (topic: string, difficulty: number) => `...`,
    matching: (topic: string, difficulty: number) => `...`,
    openEnded: (topic: string, difficulty: number) => `...`,
    // ... 34 more types
  },

  // Exam Generation
  exams: {
    bagrut: (subject: string, topics: string[]) => `...`,
    quiz: (topic: string, numQuestions: number) => `...`,
    practice: (topic: string, difficulty: number) => `...`
  },

  // Grading
  grading: {
    openQuestion: (question: string, answer: string, rubric: string) => `...`,
    essay: (prompt: string, essay: string, criteria: string[]) => `...`
  },

  // Adaptive Content
  adaptive: {
    הבנה: (topic: string, level: number) => `...`,  // Basic understanding
    העמקה: (topic: string, level: number) => `...`  // Deep dive
  }
};
```

### 7.3 Content Generation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT GENERATION                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. INPUT PROCESSING                                         │
│    ├─ PDF text extraction                                   │
│    ├─ Content cleaning & normalization                      │
│    └─ Language detection (Hebrew/English)                   │
└──────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LESSON PLAN GENERATION                                   │
│    ├─ Identify key topics                                   │
│    ├─ Map to learning objectives                            │
│    ├─ Structure into modules/units                          │
│    └─ Estimate time & difficulty                            │
└──────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ACTIVITY GENERATION (per unit)                           │
│    ├─ Select activity types (from 38 types)                 │
│    ├─ Generate content for each type                        │
│    ├─ Create variants (הבנה + העמקה)                         │
│    └─ Add scaffolding hints                                 │
└──────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. VARIANT CACHING                                          │
│    ├─ Cache variants in Firestore                           │
│    ├─ Local cache in IndexedDB                              │
│    └─ TTL: 30 days                                          │
└──────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. DELIVERY                                                 │
│    ├─ Streaming via SSE (real-time)                         │
│    ├─ Batch save to Firestore                               │
│    └─ Notify teacher of completion                          │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 38 Activity Block Types

```typescript
type ActivityBlockType =
  // Text-based
  | 'multiple-choice'      // בחירה מרובה
  | 'true-false'           // נכון/לא נכון
  | 'cloze'                // השלמת חסר
  | 'matching'             // התאמה
  | 'ordering'             // סידור
  | 'categorization'       // מיון לקטגוריות

  // Open-ended
  | 'open-ended'           // שאלה פתוחה
  | 'short-answer'         // תשובה קצרה
  | 'essay'                // חיבור

  // Interactive
  | 'drag-drop'            // גרור ושחרר
  | 'hotspot'              // לחיצה על מיקום
  | 'slider'               // סקאלה
  | 'sortable-list'        // רשימה ניתנת למיון

  // Visual
  | 'image-labeling'       // תיוג תמונה
  | 'diagram-completion'   // השלמת דיאגרמה
  | 'timeline'             // ציר זמן
  | 'flowchart'            // תרשים זרימה

  // Math & Science
  | 'equation-solver'      // פתרון משוואות
  | 'graph-plotting'       // שרטוט גרפים
  | 'unit-conversion'      // המרת יחידות

  // Language
  | 'translation'          // תרגום
  | 'conjugation'          // הטיית פעלים
  | 'sentence-building'    // בניית משפטים

  // Advanced
  | 'code-editor'          // עורך קוד
  | 'simulation'           // סימולציה
  | 'virtual-lab'          // מעבדה וירטואלית

  // Content blocks (non-interactive)
  | 'text'                 // טקסט
  | 'video'                // וידאו
  | 'audio'                // אודיו
  | 'image'                // תמונה
  | 'infographic'          // אינפוגרפיקה
  | 'pdf-viewer'           // מציג PDF

  // Assessment
  | 'rubric-graded'        // מחוון
  | 'peer-review'          // הערכת עמיתים
  | 'self-assessment'      // הערכה עצמית

  // Gamified
  | 'flashcard'            // כרטיסיות
  | 'memory-game'          // משחק זיכרון
  | 'quiz-game';           // משחק חידון
```

---

## 8. מערכת הלמידה האדפטיבית

### 8.1 Adaptive Learning Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 ADAPTIVE LEARNING SYSTEM                    │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Event         │ │   Policy        │ │   Content       │
│   Logging       │ │   Engine        │ │   Variants      │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ adaptiveLogging │ │ adaptivePolicy  │ │ adaptiveContent │
│ Service.ts      │ │ Service.ts      │ │ Service.ts      │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │ Student Profile │
                   │ Aggregation     │
                   ├─────────────────┤
                   │ adaptiveIntegra │
                   │ tionService.ts  │
                   └─────────────────┘
```

### 8.2 Mastery Calculation

```typescript
// Mastery Model (0-1 scale)

interface MasteryModel {
  // Current mastery level
  currentMastery: number;  // 0-1

  // Update after answer
  updateMastery(isCorrect: boolean, difficulty: number): number {
    const impact = difficulty * 0.1;  // Higher difficulty = bigger impact

    if (isCorrect) {
      // Increase mastery, with diminishing returns near 1.0
      return Math.min(1, this.currentMastery + impact * (1 - this.currentMastery));
    } else {
      // Decrease mastery
      return Math.max(0, this.currentMastery - impact * 0.5);
    }
  }
}

// Thresholds
const MASTERY_THRESHOLDS = {
  STRUGGLING: 0.4,      // Below: Offer הבנה scaffolding
  LEARNING: 0.7,        // Between: Continue normally
  PROFICIENT: 0.85,     // Above: Consider העמקה
  MASTERED: 0.95        // Above: Skip or advance
};
```

### 8.3 Scaffolding Policy

```typescript
// adaptivePolicyService.ts

export const scaffoldingPolicy = {
  async evaluate(
    userId: string,
    currentMastery: number,
    gradingResult: GradingResult
  ): Promise<Scaffolding | null> {

    // 1. Check mastery thresholds
    let shouldOffer = false;
    let variantType: 'הבנה' | 'העמקה' | null = null;

    if (currentMastery < 0.4) {
      shouldOffer = true;
      variantType = 'הבנה';  // Basic understanding
    } else if (currentMastery >= 0.7 && currentMastery < 0.85) {
      shouldOffer = true;
      variantType = 'העמקה';  // Deep dive / enrichment
    }

    if (!shouldOffer) return null;

    // 2. Check student's scaffolding history
    const profile = await getStudentProfile(userId);
    const acceptanceRate = profile.scaffoldingPatterns.acceptanceRate;

    // If student rarely accepts, be more selective
    if (acceptanceRate < 0.3 && Math.random() > 0.5) {
      return null;
    }

    // 3. Check session context
    const sessionDuration = await getCurrentSessionDuration(userId);
    if (sessionDuration > 45 * 60 * 1000) {  // > 45 minutes
      // Student may be fatigued, reduce offers
      if (Math.random() > 0.6) return null;
    }

    // 4. Generate scaffolding content
    const scaffolding: Scaffolding = {
      type: variantType!,
      content: await generateVariantContent(
        gradingResult.topic,
        variantType!,
        currentMastery
      ),
      difficulty: adjustDifficulty(currentMastery, variantType!),
      timeout: 30 * 60 * 1000  // 30 minutes to respond
    };

    return scaffolding;
  }
};
```

### 8.4 Variant Types

```typescript
// Two main variant types for Hebrew education:

// הבנה (Havana) - Basic Understanding
// For struggling students (mastery < 0.4)
const הבנהVariant = {
  characteristics: [
    'Simpler language and shorter sentences',
    'More concrete examples',
    'Step-by-step explanations',
    'Visual aids and diagrams',
    'Lower cognitive load',
    'Frequent comprehension checks'
  ],
  promptModifiers: [
    'השתמש במילים פשוטות',
    'הוסף דוגמאות מחיי היומיום',
    'פרק לשלבים קטנים',
    'הוסף איורים'
  ]
};

// העמקה (Ha'amaka) - Deep Dive / Enrichment
// For proficient students (mastery 0.7-0.85)
const העמקהVariant = {
  characteristics: [
    'Advanced concepts and connections',
    'Real-world applications',
    'Critical thinking questions',
    'Research connections',
    'Cross-topic integration',
    'Higher cognitive load'
  ],
  promptModifiers: [
    'הוסף קשרים לנושאים מתקדמים',
    'שאל שאלות ביקורתיות',
    'קשר למחקר עדכני',
    'אתגר את התלמיד'
  ]
};
```

### 8.5 Profile Aggregation

```typescript
// adaptiveIntegrationService.ts

export const aggregateStudentProfile = async (userId: string): Promise<void> => {
  // Fetch recent adaptive events
  const events = await getRecentAdaptiveEvents(userId, 100);

  // Calculate aggregates
  const profile: StudentProfile = {
    // Overall mastery (weighted average)
    totalMastery: calculateWeightedMastery(events),

    // Engagement score (0-100)
    engagementScore: calculateEngagement(events),

    // Learning velocity (improvement rate)
    learningVelocity: calculateVelocity(events),

    // Scaffolding patterns
    scaffoldingPatterns: {
      totalOffered: events.filter(e => e.scaffoldingOffered).length,
      totalAccepted: events.filter(e => e.scaffoldingAccepted).length,
      totalDeclined: events.filter(e => e.scaffoldingAccepted === false).length,
      acceptanceRate: calculateAcceptanceRate(events),
      avgMasteryWhenOffered: avgMastery(events, 'offered'),
      avgMasteryWhenAccepted: avgMastery(events, 'accepted'),
      avgMasteryWhenDeclined: avgMastery(events, 'declined'),
      preferredVariantType: detectPreferredVariant(events)
    },

    // Topic-level analysis
    topicMastery: calculateTopicMastery(events),
    strugglingTopics: identifyStrugglingTopics(events),

    lastUpdated: FieldValue.serverTimestamp()
  };

  // Save to Firestore
  await db.doc(`users/${userId}/profile`).set(profile, { merge: true });
};
```

---

## 9. אבטחה והרשאות

### 9.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                      │
└─────────────────────────────────────────────────────────────┘

1. User Opens App
   │
   ▼
2. Firebase Auth: onAuthStateChanged()
   │
   ├─ Logged In ────────────────────────┐
   │                                    ▼
   │                        ┌─────────────────────┐
   │                        │ Fetch User Profile  │
   │                        │ from Firestore      │
   │                        └──────────┬──────────┘
   │                                   │
   │                                   ▼
   │                        ┌─────────────────────┐
   │                        │ Set AuthContext:    │
   │                        │ - currentUser       │
   │                        │ - roles             │
   │                        │ - usageStats        │
   │                        └──────────┬──────────┘
   │                                   │
   │                                   ▼
   │                        ┌─────────────────────┐
   │                        │ Route Based on Role │
   │                        └─────────────────────┘
   │
   └─ Not Logged In ────────────────────┐
                                        ▼
                            ┌─────────────────────┐
                            │ Show Login Page     │
                            │ - Google OAuth      │
                            │ - Email/Password    │
                            │ - Anonymous (dev)   │
                            └─────────────────────┘
```

### 9.2 Authorization Model

```typescript
// Role-Based Access Control

type UserRole = 'admin' | 'teacher' | 'student' | 'qa_tester';

interface Permissions {
  admin: {
    canManageUsers: true,
    canViewAllCourses: true,
    canViewAnalytics: true,
    canManageLicenses: true,
    canAccessDevTools: true
  },
  teacher: {
    canCreateCourses: true,
    canEditOwnCourses: true,
    canViewStudentData: true,  // Only own students
    canGenerateContent: true,
    canViewOwnAnalytics: true
  },
  student: {
    canEnrollInCourses: true,
    canSubmitAnswers: true,
    canViewOwnProgress: true,
    canViewOwnProfile: true
  },
  qa_tester: {
    canViewAllData: true,  // Read-only
    canRunSimulations: true,
    canViewAnalytics: true
  }
}
```

### 9.3 Firestore Security Rules

```javascript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid))
          .data.roles.hasAny(['admin']);
    }

    function isTeacher() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid))
          .data.roles.hasAny(['teacher', 'admin']);
    }

    function isTeacherOf(userId) {
      let user = get(/databases/$(database)/documents/users/$(userId)).data;
      return user.teacherId == request.auth.uid;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId) || isTeacherOf(userId) || isAdmin();
      allow create: if isAuthenticated();
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();

      // Profile sub-collection
      match /profile/{docId} {
        allow read: if isOwner(userId) || isTeacherOf(userId) || isAdmin();
        allow write: if isOwner(userId) || isAdmin();
      }

      // Adaptive events sub-collection
      match /adaptive_events/{eventId} {
        allow read: if isOwner(userId) || isTeacherOf(userId) || isAdmin();
        allow create: if isOwner(userId);
        allow update, delete: if false;  // Immutable
      }
    }

    // Courses collection
    match /courses/{courseId} {
      allow read: if isAuthenticated();
      allow create: if isTeacher() &&
        request.resource.data.teacherId == request.auth.uid;
      allow update, delete: if resource.data.teacherId == request.auth.uid ||
        isAdmin();

      // Units sub-collection
      match /units/{unitId} {
        allow read: if isAuthenticated();
        allow write: if get(/databases/$(database)/documents/courses/$(courseId))
          .data.teacherId == request.auth.uid || isAdmin();
      }
    }

    // Submissions collection
    match /submissions/{submissionId} {
      allow read: if resource.data.studentId == request.auth.uid ||
        isTeacherOf(resource.data.studentId) || isAdmin();
      allow create: if request.resource.data.studentId == request.auth.uid;
      allow update: if isTeacherOf(resource.data.studentId) || isAdmin();
    }

    // Activity bank - public read, teacher write
    match /activity_bank/{activityId} {
      allow read: if isAuthenticated();
      allow write: if isTeacher();
    }
  }
}
```

### 9.4 Rate Limiting

```typescript
// middleware/rateLimiter.ts

import { RateLimiterMemory } from 'rate-limiter-flexible';

// Different limits for different operations
const rateLimiters = {
  // AI generation - expensive, limit strictly
  aiGeneration: new RateLimiterMemory({
    points: 15,      // 15 requests
    duration: 60     // per minute
  }),

  // Regular API calls
  api: new RateLimiterMemory({
    points: 100,     // 100 requests
    duration: 60     // per minute
  }),

  // Auth attempts - prevent brute force
  auth: new RateLimiterMemory({
    points: 5,       // 5 attempts
    duration: 900    // per 15 minutes
  })
};

export const rateLimitMiddleware = (type: keyof typeof rateLimiters) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.uid || req.ip;

    try {
      await rateLimiters[type].consume(userId);
      next();
    } catch (error) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(error.msBeforeNext / 1000)
      });
    }
  };
};
```

### 9.5 License Enforcement

```typescript
// License tiers and quotas

interface LicenseTier {
  name: 'free' | 'pro' | 'enterprise';
  quotas: {
    textTokensPerMonth: number;
    imagesPerMonth: number;
    audioMinutesPerMonth: number;
    videosPerMonth: number;
    maxCourses: number;
  };
  features: string[];
}

const LICENSE_TIERS: Record<string, LicenseTier> = {
  free: {
    name: 'free',
    quotas: {
      textTokensPerMonth: 50_000,
      imagesPerMonth: 10,
      audioMinutesPerMonth: 10,
      videosPerMonth: 2,
      maxCourses: 5
    },
    features: ['basic_lesson_generation', 'student_analytics']
  },
  pro: {
    name: 'pro',
    quotas: {
      textTokensPerMonth: 500_000,
      imagesPerMonth: 100,
      audioMinutesPerMonth: 100,
      videosPerMonth: 20,
      maxCourses: 50
    },
    features: ['advanced_analytics', 'knowledge_base', 'bagrut_exams', 'api_access']
  },
  enterprise: {
    name: 'enterprise',
    quotas: {
      textTokensPerMonth: Infinity,
      imagesPerMonth: Infinity,
      audioMinutesPerMonth: Infinity,
      videosPerMonth: Infinity,
      maxCourses: Infinity
    },
    features: ['custom_training', 'dedicated_support', 'sla', 'white_label']
  }
};
```

---

## 10. אינטגרציות חיצוניות

### 10.1 Google Cloud Services

```typescript
// Service integrations

// Gemini API
const gemini = {
  endpoint: 'generativelanguage.googleapis.com',
  models: [
    'gemini-2.0-flash-001',      // Primary - fast text
    'gemini-3-pro-preview',      // Advanced reasoning
    'gemini-3-pro-image-preview' // Image generation
  ],
  rateLimit: '15 requests/minute/model'
};

// Cloud Storage
const storage = {
  bucket: 'ai-lms-pro.firebasestorage.app',
  paths: {
    pdfs: 'courses/{courseId}/pdfs/',
    images: 'courses/{courseId}/images/',
    videos: 'courses/{courseId}/videos/',
    exports: 'users/{userId}/exports/'
  },
  security: 'Signed URLs with 1-hour expiration'
};

// Cloud Scheduler
const scheduler = {
  jobs: [
    { name: 'processEventsTrigger', schedule: 'every 5 minutes' },
    { name: 'updateAINews', schedule: 'every 6 hours' },
    { name: 'runNightlyQATests', schedule: 'every day 02:00' },
    { name: 'checkDueTasksAndSendReports', schedule: 'every day 08:00' }
  ]
};
```

### 10.2 Third-Party Services

```typescript
// ElevenLabs - Text-to-Speech
const elevenLabs = {
  api: 'api.elevenlabs.io',
  voices: {
    hebrew: ['Dinah', 'Daniel', 'Gadi'],
    english: ['Rachel', 'Adam']
  },
  pricing: '$0.30 per 1,000 characters',
  usage: 'Lesson narration, podcast generation'
};

// YouTube API
const youtube = {
  features: ['Search videos', 'Extract transcripts', 'Get metadata'],
  quota: '10,000 units/day',
  usage: 'Embed educational videos in courses'
};

// Google Classroom (In Development)
const googleClassroom = {
  features: [
    'Sync student rosters',
    'Post assignments',
    'Import submissions'
  ],
  status: 'Beta'
};
```

### 10.3 Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                    │
└─────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Google Cloud  │ │  Third-Party    │ │   Future        │
│   Services      │ │  APIs           │ │   Integrations  │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ • Gemini API    │ │ • ElevenLabs    │ │ • Google Class  │
│ • Cloud Storage │ │ • YouTube       │ │ • Microsoft 365 │
│ • Scheduler     │ │ • OpenAI (leg)  │ │ • Canvas LMS    │
│ • Firestore     │ │                 │ │ • Moodle        │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │ Cloud Functions │
                   │ (Proxy Layer)   │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    Frontend     │
                   │   Application   │
                   └─────────────────┘
```

---

## 11. ביצועים וסקלאביליות

### 11.1 Performance Metrics

| מדד | יעד | נוכחי |
|-----|-----|-------|
| Time to First Byte (TTFB) | < 200ms | ~150ms |
| Largest Contentful Paint (LCP) | < 2.5s | ~2.1s |
| First Input Delay (FID) | < 100ms | ~50ms |
| Cumulative Layout Shift (CLS) | < 0.1 | ~0.05 |
| AI Generation Latency | < 3s | ~1.5s |
| API Response Time | < 500ms | ~200ms |

### 11.2 Caching Strategy

```typescript
// Multi-layer caching

// Layer 1: Browser Cache (IndexedDB)
const browserCache = {
  storage: 'IndexedDB via idb library',
  data: ['Content variants', 'User preferences', 'Offline content'],
  ttl: '24 hours'
};

// Layer 2: Firestore Cache
const firestoreCache = {
  storage: 'Firestore documents',
  data: ['Generated content', 'Course data', 'User profiles'],
  ttl: '30 days'
};

// Layer 3: Gemini API Cache
const geminiCache = {
  storage: 'Gemini implicit caching',
  data: ['Similar prompts', 'Common generations'],
  ttl: 'Automatic'
};

// Cache invalidation
const invalidation = {
  onContentUpdate: 'Clear related variants',
  onSchemaChange: 'Clear all cached content',
  manual: 'Admin can clear caches'
};
```

### 11.3 Scalability Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SCALABILITY DESIGN                       │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │    Firebase     │
                    │    Hosting      │
                    │  (CDN Global)   │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │     Cloud Functions      │
              │    (Auto-scaling)        │
              │                          │
              │  Min instances: 0        │
              │  Max instances: 1000     │
              │  Memory: 256MB-4GB       │
              │  Timeout: 540s           │
              └──────────────┬───────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Firestore     │ │  Cloud Storage  │ │   Gemini API    │
│ (Multi-region)  │ │   (Regional)    │ │  (us-central1)  │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ Automatic       │ │ Automatic       │ │ Rate limited    │
│ sharding        │ │ scaling         │ │ with backoff    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 11.4 Load Handling

```typescript
// Strategies for high load

// 1. Queue-based processing
const queueStrategy = {
  collections: ['lesson_generation_queue', 'exam_generation_queue'],
  trigger: 'onDocumentCreated',
  benefit: 'Decouple request from processing'
};

// 2. Streaming responses
const streamingStrategy = {
  method: 'Server-Sent Events (SSE)',
  benefit: 'Progressive content delivery',
  implementation: 'streamingServer.ts'
};

// 3. Batch operations
const batchStrategy = {
  firestore: 'Batched writes (500 ops/batch)',
  benefit: 'Reduced round trips'
};

// 4. Cold start mitigation
const coldStartMitigation = {
  minInstances: 1,  // Keep 1 instance warm
  codeOptimization: 'Lazy imports',
  bundleSize: 'Split functions into separate deployments'
};
```

---

## 12. תהליכי פיתוח ו-DevOps

### 12.1 Development Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

1. Local Development
   │
   ├─ npm run dev          # Vite dev server (frontend)
   ├─ npm run emulators    # Firebase emulators (backend)
   └─ npm run test:watch   # Jest watch mode
   │
   ▼
2. Pre-commit Checks (Husky + lint-staged)
   │
   ├─ ESLint               # Code linting
   ├─ TypeScript           # Type checking
   └─ Prettier             # Code formatting
   │
   ▼
3. Git Commit & Push
   │
   ▼
4. CI/CD (GitHub Actions - if configured)
   │
   ├─ npm run build        # Build frontend
   ├─ npm run test         # Run all tests
   └─ npm run lint         # Lint check
   │
   ▼
5. Deployment
   │
   ├─ firebase deploy --only hosting     # Frontend
   └─ firebase deploy --only functions   # Backend
```

### 12.2 Testing Strategy

```typescript
// Test configuration

// jest.config.cjs
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/functions/src'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'functions/src/**/*.ts',
    '!**/*.test.ts',
    '!**/node_modules/**'
  ],

  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
};

// Test types
const testTypes = {
  unit: 'Individual function/component tests',
  integration: 'Service integration tests',
  e2e: 'End-to-end user flow tests',
  ai: 'AI prompt/response validation'
};
```

### 12.3 Deployment Configuration

```json
// firebase.json

{
  "functions": {
    "source": "functions",
    "predeploy": ["npm --prefix functions run build"],
    "runtime": "nodejs22"
  },

  "hosting": {
    "public": "dist",
    "predeploy": ["npm run build"],
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "X-XSS-Protection", "value": "1; mode=block" }
        ]
      }
    ]
  },

  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },

  "storage": {
    "rules": "storage.rules"
  }
}
```

### 12.4 Environment Configuration

```bash
# .env - Frontend (VITE_ prefix = public)

# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=ai-lms-pro.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ai-lms-pro
VITE_FIREBASE_STORAGE_BUCKET=ai-lms-pro.firebasestorage.app

# Feature Flags
VITE_ENABLE_GEMINI_IMAGE=true

# Backend Secrets (Firebase Secret Manager)
# Set via: firebase functions:secrets:set SECRET_NAME
# - GEMINI_API_KEY
# - OPENAI_API_KEY
# - ELEVENLABS_API_KEY
```

### 12.5 Monitoring & Logging

```typescript
// Monitoring setup

const monitoring = {
  // Firebase Console
  firebase: {
    functions: 'Invocations, errors, latency',
    firestore: 'Reads, writes, deletes',
    hosting: 'Bandwidth, requests',
    auth: 'Sign-ins, sign-ups'
  },

  // Custom logging
  customLogs: {
    collection: 'security_logs',
    events: ['auth_failure', 'rate_limit_hit', 'api_error'],
    retention: '90 days'
  },

  // Performance tracking
  performance: {
    collection: 'generationTimings',
    metrics: ['generation_time', 'token_count', 'model_used']
  }
};
```

---

## סיכום

מסמך זה מתאר את הארכיטקטורה המלאה של מערכת AI-LMS, מערכת ניהול למידה מבוססת בינה מלאכותית. המערכת בנויה על עקרונות מודרניים של פיתוח תוכנה:

| עיקרון | יישום |
|--------|-------|
| **Separation of Concerns** | הפרדה ברורה בין Frontend, Backend, ו-AI |
| **Type Safety** | TypeScript מקצה לקצה |
| **Scalability** | Cloud Functions עם auto-scaling |
| **Security** | Firebase Security Rules + Rate Limiting |
| **Maintainability** | קוד מודולרי עם תיעוד מקיף |
| **Performance** | Caching multi-layer, SSE streaming |
| **Accessibility** | תמיכה בעברית מלאה |

המערכת מוכנה להרחבה עתידית עם ארכיטקטורה גמישה שתומכת באינטגרציות חדשות ויכולות AI מתקדמות.

---

*מסמך זה נכתב ונבדק על ידי צוות הפיתוח*
*גרסה 2.0.0 | ינואר 2026*
