# Streaming Architecture - ארכיטקטורת יצירת תוכן

## תוכן עניינים
1. [סקירה כללית](#1-סקירה-כללית)
2. [Endpoints](#2-endpoints)
3. [טבלת קריטריונים - Activity vs Differentiated](#3-טבלת-קריטריונים)
4. [ה-Prompts המשותפים](#4-ה-prompts-המשותפים)
5. [Learning Level Parameter](#5-learning-level-parameter)
6. [Flow Diagrams](#6-flow-diagrams)

---

## 1. סקירה כללית

מערכת ה-streaming מאפשרת יצירת תוכן לימודי בזמן אמת באמצעות Server-Sent Events (SSE).
התוכן נוצר על ידי Gemini AI ומוזרם ישירות לקליינט.

### עקרונות מנחים:
- **איכות אחידה**: פעילות רגילה ופעילות דיפרנציאלית משתמשות באותם prompts
- **Parallel Generation**: כל ה-steps נוצרים במקביל לחיסכון בזמן
- **Skeleton-first**: תמיד נוצר מבנה (skeleton) לפני התוכן המלא

---

## 2. Endpoints

### `/stream/activity`
יצירת פעילות רגילה (יחידה אחת).

**Request:**
```json
{
  "topic": "נושא הפעילות",
  "gradeLevel": "כיתה ה",
  "subject": "היסטוריה",
  "sourceText": "טקסט מקור (אופציונלי)",
  "activityLength": "short|medium|long",
  "productType": "activity|lesson|exam",
  "questionPreferences": { "allowedTypes": ["multiple_choice", "categorization"] }
}
```

**Response Events:**
- `progress` - עדכוני התקדמות
- `skeleton_complete` - מבנה הפעילות
- `step_complete` - כל step שהושלם
- `done` - סיום עם התוצאה המלאה

---

### `/stream/differentiated`
יצירת פעילות דיפרנציאלית (3 רמות: הבנה, יישום, העמקה).

**Request:**
```json
{
  "topic": "נושא הפעילות",
  "gradeLevel": "כיתה ה",
  "subject": "היסטוריה",
  "sourceText": "טקסט מקור",
  "activityLength": "short|medium|long",
  "productType": "activity|lesson|exam",
  "questionPreferences": { "allowedTypes": ["multiple_choice", "categorization"] }
}
```

**Response Events:**
- `progress` - עדכוני התקדמות
- `level_start` - התחלת רמה (support/core/enrichment)
- `level_complete` - סיום רמה עם skeleton + steps
- `done` - סיום כל 3 הרמות

---

## 3. טבלת קריטריונים

טבלה זו מוודאת שפעילות דיפרנציאלית עומדת באותם קריטריונים של פעילות רגילה.

| קריטריון | Activity | Differentiated | מימוש |
|----------|----------|----------------|-------|
| **Skeleton generation** | ✅ | ✅ | `buildActivitySkeletonPrompt()` → `getSkeletonPrompt()` |
| **Step count by length** | ✅ (3/5/7) | ✅ (3/5/7) | `activityLength === 'short' ? 3 : (activityLength === 'long' ? 7 : 5)` |
| **Bloom distribution** | ✅ | ✅ | מותאם לפי `learningLevel` בשורות 1157-1169 |
| **Interaction diversity** | ✅ | ✅ | `getSkeletonPrompt()` rule 9: "NEVER use same type twice in a row" |
| **15+ question type formats** | ✅ | ✅ | `getStepContentPrompt()` - פורמט JSON מפורט לכל סוג |
| **Linguistic constraints** | ✅ | ✅ | `getLinguisticConstraintsByGrade()` - CEFR by grade |
| **Fallback logic** | ✅ | ✅ | `getStepContentPrompt()` rule 8: PEDAGOGICAL SAFETY VALVE |
| **Context image** | ✅ | ✅ | `skeleton.context_image_prompt` |
| **Hebrew writing rules** | ✅ | ✅ | `getStepContentPrompt()` - HEBREW WRITING QUALITY RULES |
| **JSON format per type** | ✅ | ✅ | `getStepContentPrompt()` comments - 15 סוגי שאלות |
| **Learning level mapping** | ✅ | ✅ | `learningLevel` parameter בכל prompt |
| **Client parsing** | ✅ | ✅ | `streamDifferentiatedContent()` - תומך בשני formats |

---

## 4. ה-Prompts המשותפים

שני ה-endpoints משתמשים באותם prompts מ-`functions/src/ai/prompts.ts`:

### `getSkeletonPrompt()`
יוצר את מבנה הפעילות (skeleton) עם:
- חלוקה ל-steps
- Bloom levels לכל step
- סוג אינטראקציה מומלץ
- `context_image_prompt` לתמונת פתיחה

### `getStepContentPrompt()`
יוצר את התוכן המלא לכל step עם:
- שאלה/אינטראקציה בפורמט JSON מדויק
- Hints ו-scaffolding
- `learning_level` בתוצאה

### `getLinguisticConstraintsByGrade()`
מחזיר הנחיות שפה לפי גיל:
- כיתות א'-ב': CEFR Pre-A1 to A1
- כיתות ג'-ד': CEFR A1-A2
- כיתות ה'-ו': CEFR A2-B1
- חטיבה: CEFR B1-B2
- תיכון: CEFR B2-C1

---

## 5. Learning Level Parameter

פרמטר `learningLevel` מאפשר התאמת התוכן לרמות שונות:

### הבנה (Support)
```
- Bloom Levels: Remember, Understand
- שפה פשוטה יותר
- יותר hints ו-scaffolding
- מסיחים פחות מבלבלים
```

### יישום (Core)
```
- Bloom Levels: Apply, Analyze
- שפה ברמת הכיתה
- scaffolding סטנדרטי (2-3 hints)
- אתגר מתון
```

### העמקה (Enrichment)
```
- Bloom Levels: Evaluate, Create
- אוצר מילים אקדמי
- מינימום hints
- שאלות פתוחות ומאתגרות
```

### שימוש בקוד:
```typescript
// ב-buildActivitySkeletonPrompt:
if (learningLevel === 'הבנה') {
  bloomLevels = ['Remember', 'Understand', 'Remember', 'Understand', 'Remember'];
} else if (learningLevel === 'העמקה') {
  bloomLevels = ['Apply', 'Analyze', 'Evaluate', 'Create', 'Evaluate'];
} else {
  bloomLevels = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'];
}
```

---

## 6. Flow Diagrams

### פעילות רגילה (`/stream/activity`):
```
Request
   │
   ▼
┌─────────────────────────────────┐
│  Phase 1: Skeleton Generation   │
│  (Gemini Flash - fast)          │
└─────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────┐
│  Phase 2: Parallel Steps        │
│  (Gemini Pro - quality)         │
│  Step 1 ──┐                     │
│  Step 2 ──┼── Promise.all()     │
│  Step 3 ──┘                     │
└─────────────────────────────────┘
   │
   ▼
Response (skeleton + steps)
```

### פעילות דיפרנציאלית (`/stream/differentiated`):
```
Request
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│              Parallel Level Generation                   │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   הבנה      │  │   יישום     │  │   העמקה     │     │
│  │  (Support)  │  │   (Core)    │  │(Enrichment) │     │
│  │             │  │             │  │             │     │
│  │ Skeleton    │  │ Skeleton    │  │ Skeleton    │     │
│  │    ↓        │  │    ↓        │  │    ↓        │     │
│  │ Steps[]     │  │ Steps[]     │  │ Steps[]     │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│         │               │               │              │
│         └───────────────┼───────────────┘              │
│                         │                              │
│                  Promise.all()                         │
└─────────────────────────────────────────────────────────┘
   │
   ▼
Response (3 levels, each with skeleton + steps)
```

---

## קבצים רלוונטיים

| קובץ | תפקיד |
|------|-------|
| `functions/src/streaming/streamingServer.ts` | ה-endpoints עצמם |
| `functions/src/ai/prompts.ts` | ה-prompts המשותפים |
| `src/services/streamingService.ts` | Client-side SSE handler |
| `src/hooks/useStreamingGeneration.ts` | React hook לשימוש ב-streaming |
| `src/components/CourseEditor.tsx` | שימוש ב-differentiated streaming |

---

**Last Updated:** 2026-01-22
**Document Version:** 1.0
