# מערכת למידה אדפטיבית - תיעוד טכני

> **מטרת המסמך:** תיעוד מערכת הפרופיל האדפטיבי לצורך בדיקה ואימות שהמערכת עובדת כמתוכנן.
>
> **תאריך בדיקה אחרונה:** 17 בינואר 2026

---

## ⚠️ סיכום בדיקה בפועל - הפער בין תיאוריה למציאות

### מה נמצא בקוד (תיאוריה):
| רכיב | קיים בקוד? | מחובר ועובד? |
|------|-----------|--------------|
| **BKT Cloud Function** | ✅ כן (`functions/src/index.ts:1356`) | ✅ כן - נקרא מה-Player |
| **ProfileService** | ✅ כן (`src/services/profileService.ts`) | ✅ כן - `onSessionComplete` נקרא |
| **Variants Generation** | ✅ כן (`enrichBlockWithVariants`) | ⚠️ חלקי - נקרא רק ב-`generateFullUnitContentWithVariants` |
| **Variant Selection בזמן ריצה** | ✅ כן (`selectVariant` in Player) | ⚠️ צריך בדיקה - תלוי אם הווריאנטים נוצרו |
| **Analytics Service** | ✅ כן - קורא מ-Firestore | ⚠️ תלוי בנתונים קיימים |

### תיקונים שבוצעו (17 בינואר 2026):

#### נוספה תצוגת מסלול למורה ב-TaskDetailDashboard:
- **מסלול התחלתי:** המורה רואה באיזה מסלול התלמיד התחיל (תגבור/מקורי/העשרה)
- **התפלגות מסלולים:** גרף המראה כמה שאלות קיבל מכל סוג וריאנט
- **טבלת מסלול מלא:** כל שלב במסע הלמידה מציג את סוג הוריאנט שנבחר
- **Tooltip בויזואליזציה:** ריחוף על עיגול מציג את סוג הוריאנט

### 🔴 בעיות שעדיין קיימות:

#### 1. וריאנטים לא נוצרים אוטומטית לכל התוכן
- הפונקציה `generateFullUnitContentWithVariants` קיימת אבל **נקראת רק מ-CourseEditor**
- תוכן ישן שנוצר לפני 10 בינואר **לא יכלול וריאנטים**
- **משמעות:** רוב התלמידים לא יקבלו התאמה דינמית

#### 2. דשבורד מורה ראשי - אין פרופיל אדפטיבי ישיר (תוקן חלקית)
- `TeacherDashboard.tsx` כעת מכיל טאב "פרופיל אדפטיבי" ב-StudentInsightsModal
- ב-**TaskDetailDashboard** (לוח משימה ספציפי) יש כעת:
  - מסלול התחלתי של התלמיד (✅ חדש!)
  - התפלגות וריאנטים (✅ חדש!)
  - ויזואליזציה של מסע הלמידה עם סוג וריאנט (✅ חדש!)
  - ציונים (✅)
  - התקדמות (✅)
  - חוזקות/חולשות AI-generated (✅)

#### 3. הפרדה בין Analytics ל-Profile
- `analyticsService.ts` **כן קורא** מ-Firestore (`profile/stats`, `proficiency_vector`)
- TaskDetailDashboard כעת מציג נתוני מסלול מורחבים
- המורה צריך להיכנס לפעילות ספציפית כדי לראות נתונים מעמיקים

---

## 📋 תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [מבנה פרופיל הלומד](#מבנה-פרופיל-הלומד)
3. [מנגנון הסיווג - 3 שכבות](#מנגנון-הסיווג---3-שכבות)
4. [מנגנון ההתאמה בזמן אמת](#מנגנון-ההתאמה-בזמן-אמת)
5. [וריאנטים של תוכן](#וריאנטים-של-תוכן)
6. [סגנונות למידה](#סגנונות-למידה)
7. [נקודות לבדיקה](#נקודות-לבדיקה)
8. [קבצים מרכזיים](#קבצים-מרכזיים)

---

## סקירה כללית

המערכת מיישמת **למידה אדפטיבית רב-שכבתית** שמתאימה את התוכן לתלמיד ב-3 רמות:

| שכבה | מה מותאם | מתי מתעדכן |
|------|----------|------------|
| **גלובלית** | קבוצת התלמיד (מתקשה/רגיל/מתקדם) | לפי ציון כללי |
| **נושאית** | רמת שליטה בנושא ספציפי | אחרי כל סשן |
| **שאלה** | גרסת התוכן (קל/רגיל/מאתגר) | אחרי כל תשובה |

### תרשים זרימה כללי

```
תלמיד נכנס לפעילות
        ↓
[בדיקת פרופיל גלובלי] → קבוצה: remediation/standard/challenge
        ↓
[בדיקת mastery בנושא] → proficiency_vector[topicId]
        ↓
[בחירת וריאנט התחלתי] → scaffolding/original/enrichment
        ↓
    ┌─────────────────────────────────────┐
    │         לולאת למידה                  │
    │  ┌─────────────────────────────┐    │
    │  │ הצגת שאלה (בוריאנט שנבחר)  │    │
    │  │            ↓                │    │
    │  │ תלמיד עונה                  │    │
    │  │            ↓                │    │
    │  │ [עדכון BKT mastery]        │    │
    │  │            ↓                │    │
    │  │ [בחירת וריאנט הבא]         │    │
    │  └─────────────────────────────┘    │
    └─────────────────────────────────────┘
        ↓
[עדכון פרופיל בסוף סשן]
```

---

## מבנה פרופיל הלומד

### קובץ: `src/types/studentProfile.ts`

```typescript
export interface StudentProfile {
  id: string;
  userId: string;

  // מדדי ביצועים
  performance: {
    average_response_time_sec: number;    // זמן תגובה ממוצע (Rolling Average)
    global_accuracy_rate: number;          // דיוק כללי (0.0-1.0)
    error_rate_by_topic: Record<string, number>; // שגיאות לפי נושא
    total_questions_attempted: number;
    total_correct_answers: number;
  };

  // דפוסי התנהגות
  behavioral: {
    hint_dependency_score: number;   // תלות ברמזים (0.0-1.0)
    retry_persistence: number;       // התמדה בניסיונות חוזרים (0.0-1.0)
    media_preference: {              // העדפות מדיה
      text: number;    // 0-1
      video: number;   // 0-1
      gamified: number; // 0-1
    };
  };

  // מעורבות
  engagement: {
    total_learning_time_sec: number;
    completed_lessons_count: number;
    last_active_at: Timestamp;
  };

  // וקטור שליטה בנושאים (מתווסף בזמן ריצה)
  proficiency_vector?: Record<string, number>; // topicId → mastery (0-1)

  // טביעת אצבע שגיאות
  error_fingerprint?: Record<string, number>; // error_type → count
}
```

### איפה נשמר?
- **Firestore:** `student_profiles/{userId}`
- **עדכון:** `profileService.updateStudentProfile()`

---

## מנגנון הסיווג - 3 שכבות

### שכבה 1: סיווג גלובלי (קבוצות)

**קובץ:** `src/services/LessonDistributor.ts`

```typescript
export type GroupType = 'remediation' | 'standard' | 'challenge';

// חוקי הסיווג (מ-SmartGroupingPanel):
function classifyStudent(score: number): GroupType {
  if (score < 60) return 'remediation';  // מתקשה
  if (score < 90) return 'standard';      // רגיל
  return 'challenge';                      // מתקדם
}
```

**קונפיגורציית AI לכל קבוצה:**

| קבוצה | רמת קושי | Bloom Levels | טון |
|-------|----------|--------------|-----|
| remediation | easy | Remember, Understand | מעודד, תומך |
| standard | medium | Apply, Analyze | מאוזן |
| challenge | hard | Analyze, Evaluate, Create | אינטלקטואלי |

**איפה משתמשים?**
- `LessonDistributor.generateGroupConfig()` - יצירת שיעורים
- `SmartGroupingPanel.tsx` - ממשק למורה

---

### שכבה 2: שליטה נושאית (Proficiency Vector)

**קובץ:** `src/services/profileService.ts`

```typescript
// עדכון שליטה בנושא ספציפי
async function updateProficiencyVector(
  userId: string,
  topicId: string,
  newMastery: number
): Promise<void> {
  // שומר ב-Firestore
  // proficiency_vector: { [topicId]: mastery }
}
```

**שימושים:**
- בחירת וריאנט התחלתי לשיעור
- דילוג על נושאים שנשלטו (mastery skip)
- בדיקת דרישות קדם

---

### שכבה 3: התאמה ברמת השאלה

**קובץ:** `src/services/adaptivePolicyService.ts`

```typescript
function selectVariant(
  block: EnrichedBlock,
  mastery: number,
  recentAccuracy: number
): 'scaffolding' | 'original' | 'enrichment' {

  // מתקשה → תמיכה
  if (mastery < 0.4 && recentAccuracy < 0.5) {
    return 'scaffolding';
  }

  // מצטיין → אתגר
  if (mastery > 0.8 && recentAccuracy > 0.9) {
    return 'enrichment';
  }

  return 'original';
}
```

---

## מנגנון ההתאמה בזמן אמת

### תהליך BKT (Bayesian Knowledge Tracing)

**קובץ:** `src/components/SequentialCoursePlayer.tsx` (שורות 615-645)

```typescript
// בכל תשובה נשלח לפונקציית Cloud:
const result = await submitAdaptiveAnswer({
  userId,
  blockId,
  isCorrect,
  responseTime,
  hintsUsed,
  selectedAnswer
});

// התוצאה כוללת:
result = {
  newMastery: 0.72,           // רמת שליטה מעודכנת
  bktAction: 'continue',       // הפעולה המומלצת
  // אפשרויות: 'continue' | 'challenge' | 'remediate' | 'mastered'
}
```

### פעולות אדפטיביות לפי BKT Action

| Action | משמעות | מה קורה |
|--------|--------|---------|
| `continue` | המשך רגיל | עוברים לשאלה הבאה |
| `challenge` | התלמיד מצטיין | מפעילים Challenge Mode - דילוג על שאלות קלות |
| `remediate` | התלמיד מתקשה | הזרקת בלוק תרגול/הסבר נוסף |
| `mastered` | שליטה מלאה בנושא | דילוג לנושא הבא (Mastery Skip) |

### Challenge Mode

**קובץ:** `src/services/adaptivePolicyService.ts`

```typescript
function applyChallengeMode(blocks: Block[], currentIndex: number): number {
  // מזהה 2-5 בלוקים קלים רצופים (Remember/Understand)
  // מחזיר את האינדקס לדלג אליו
  // מציג toast: "🚀 Challenge Mode! You're excelling!"
}
```

---

## וריאנטים של תוכן

### יצירת וריאנטים

**קובץ:** `src/services/adaptiveContentService.ts`

לכל שאלה מיוצרים 2 וריאנטים נוספים:

#### Scaffolding (קל יותר)
```typescript
scaffolding_variant: {
  // שינויים:
  - שפה פשוטה יותר
  - דוגמאות מפורטות
  - רמזים מובנים (3 רמות: עדין → ספציפי → כמעט תשובה)
  - מסיחים פחות מבלבלים
  - difficulty_level: original - 0.2
}
```

#### Enrichment (מאתגר יותר)
```typescript
enrichment_variant: {
  // שינויים:
  - מורכבות קוגניטיבית גבוהה
  - יישום בעולם האמיתי
  - מסיחים יותר סבירים
  - שאלות "למה/איך"
  - difficulty_level: original + 0.2
  - Bloom level: Analyze/Evaluate
}
```

### בחירת וריאנט התחלתי

**קובץ:** `src/components/SequentialCoursePlayer.tsx`

```typescript
function getInitialVariant(topicMastery: number, block: Block): VariantType {
  if (topicMastery > 0.75 && block.enrichment_variant) {
    return 'enrichment';  // תלמיד חזק בנושא → מתחיל מאתגר
  }
  if (topicMastery < 0.35 && block.scaffolding_variant) {
    return 'scaffolding'; // תלמיד חלש בנושא → מתחיל עם תמיכה
  }
  return 'original';
}
```

---

## סגנונות למידה

### מה נאסף

**קובץ:** `src/services/profileService.ts`

```typescript
// סיווג אינטראקציות לפי סוג:
const mediaCategories = {
  text: ['text', 'pdf', 'open-question'],
  video: ['video', 'podcast'],
  gamified: ['memory_game', 'interactive-chat', 'categorization', 'ordering']
};

// חישוב העדפה:
newPreference = 0.7 * historicalPreference + 0.3 * sessionPreference;
```

### ⚠️ סטטוס נוכחי

| פיצ'ר | סטטוס | הערות |
|-------|-------|-------|
| איסוף נתוני העדפה | ✅ פעיל | נשמר ב-profile |
| הצגה למורה | ❓ לבדוק | האם יש UI? |
| התאמת תוכן אוטומטית | ❌ לא פעיל | המערכת לא בוחרת תוכן לפי סגנון |

---

## נקודות לבדיקה

### 🔍 בדיקה 1: האם הפרופיל נשמר?

```javascript
// ב-Firebase Console או בקוד:
const profile = await getStudentProfile(userId);
console.log('Profile:', profile);

// לבדוק:
// - האם performance מתעדכן?
// - האם proficiency_vector קיים?
// - האם media_preference משתנה?
```

**צפי:** אחרי כל סשן, הפרופיל צריך להתעדכן.

---

### 🔍 בדיקה 2: האם הוריאנטים נוצרים?

```javascript
// לאחר יצירת שיעור עם AI:
const lesson = await getLesson(lessonId);
lesson.blocks.forEach(block => {
  console.log('Block:', block.id);
  console.log('Has scaffolding:', !!block.scaffolding_variant);
  console.log('Has enrichment:', !!block.enrichment_variant);
});
```

**צפי:** בלוקים מסוג שאלה צריכים לכלול שני וריאנטים.

---

### 🔍 בדיקה 3: האם הוריאנט הנכון נבחר?

**בדיקה ידנית:**
1. צור תלמיד עם mastery נמוך בנושא (< 0.35)
2. התחל פעילות בנושא
3. **צפי:** התלמיד צריך לראות scaffolding variant

**בדיקה בקוד:**
```javascript
// ב-SequentialCoursePlayer, הוסף log:
console.log('Selected variant:', currentVariant);
console.log('Mastery:', topicMastery);
console.log('Recent accuracy:', recentAccuracy);
```

---

### 🔍 בדיקה 4: האם BKT עובד?

**תרחיש:**
1. תלמיד עונה נכון 5 פעמים ברצף
2. **צפי:**
   - mastery עולה
   - bktAction משתנה ל-'challenge' או 'mastered'

**לוג לבדיקה:**
```javascript
// אחרי submitAdaptiveAnswer:
console.log('BKT Result:', {
  newMastery: result.newMastery,
  action: result.bktAction,
  previousMastery: previousMastery
});
```

---

### 🔍 בדיקה 5: האם Challenge Mode פועל?

**תרחיש:**
1. תלמיד מצטיין (mastery > 0.8, accuracy > 0.9)
2. יש בלוקים ברמת Remember/Understand
3. **צפי:** המערכת מדלגת על בלוקים קלים

**סימנים:**
- Toast מופיע: "🚀 Challenge Mode!"
- בלוקים נדלגים ב-log

---

### 🔍 בדיקה 6: האם ההקצאה לפי קבוצה עובדת?

**תרחיש:**
1. מורה יוצר פעילות ומקצה ל-"support" group
2. **צפי:** רק תלמידים בקבוצת support רואים את הפעילות

**לבדוק ב-Firestore:**
```javascript
// ב-task_assignments collection:
{
  assignedTo: 'group',
  groupType: 'support',
  // ...
}
```

---

## קבצים מרכזיים

| קובץ | תפקיד | קריטיות |
|------|-------|---------|
| `src/types/studentProfile.ts` | הגדרת מבנה הפרופיל | 🔴 גבוהה |
| `src/services/profileService.ts` | שמירה ועדכון פרופיל | 🔴 גבוהה |
| `src/services/adaptivePolicyService.ts` | מנוע קבלת החלטות | 🔴 גבוהה |
| `src/services/adaptiveContentService.ts` | יצירת וריאנטים | 🟡 בינונית |
| `src/components/SequentialCoursePlayer.tsx` | הפעלה בזמן ריצה | 🔴 גבוהה |
| `src/services/LessonDistributor.ts` | סיווג קבוצות | 🟡 בינונית |
| `src/services/taskAssignmentService.ts` | הקצאת משימות | 🟡 בינונית |
| `src/components/SmartGroupingPanel.tsx` | UI קיבוץ | 🟢 נמוכה |

---

## שאלות פתוחות לבירור

1. **האם Cloud Function של BKT קיימת ופעילה?**
   - לבדוק ב-Firebase Functions

2. **האם יש לוגים/אנליטיקס על החלטות אדפטיביות?**
   - חשוב למעקב ודיבוג

3. **מה קורה כשאין פרופיל קיים?**
   - האם נוצר ברירת מחדל?

4. **האם הוריאנטים נוצרים בזמן יצירת השיעור או בזמן ריצה?**
   - משפיע על ביצועים ועלויות AI

5. **האם יש UI למורה לראות פרופילי תלמידים?**
   - חשוב לשקיפות

---

## היסטוריית שינויים

| תאריך | שינוי | מבצע |
|-------|-------|------|
| 2026-01-17 | יצירת מסמך ראשוני + בדיקה בפועל | Claude |
| 2026-01-17 | הוספת Adaptive Logging Service | Claude |
| 2026-01-17 | הוספת StudentLearningProfile לדשבורד מורה | Claude |
| 2026-01-17 | יצירת סקריפט לבדיקת נתונים | Claude |

---

## 🧪 תוצאות בדיקה בפועל (17 בינואר 2026)

### ✅ מה **כן** עובד:

#### 1. BKT Cloud Function
```
מיקום: functions/src/index.ts:1356
export const submitAdaptiveAnswer = onCall({ cors: true }, async (request) => {
```
- ✅ הפונקציה קיימת ומיוצאת
- ✅ נקראת מ-SequentialCoursePlayer
- ✅ מחשבת mastery לפי BKT
- ✅ מחזירה action (continue/challenge/remediate/mastered)

#### 2. ProfileService - שמירת פרופיל
```
מיקום: src/services/profileService.ts
```
- ✅ `onSessionComplete()` נקרא בסוף כל סשן
- ✅ שומר ל-Firestore: `users/{userId}/profile/stats`
- ✅ מחשב rolling averages
- ✅ עדכון proficiency_vector
- ✅ עדכון error_fingerprint

#### 3. Variants Generation
```
מיקום: src/gemini.ts:3070
export const generateFullUnitContentWithVariants = async (...)
```
- ✅ הפונקציה קיימת
- ✅ נקראת מ-CourseEditor
- ✅ קוראת ל-`enrichBlockWithVariants` לכל בלוק שאלה

#### 4. Variant Selection בזמן ריצה
```
מיקום: src/components/SequentialCoursePlayer.tsx:273
```
- ✅ קורא וריאנטים מ-`block.metadata.scaffolding_variant`
- ✅ מחליף את התוכן בתור לפי המלצת `selectVariant()`

#### 5. Analytics Service
```
מיקום: src/services/analyticsService.ts
```
- ✅ קורא מ-Firestore: profile/stats, proficiency_vector, error_fingerprint
- ✅ משמש ב-TaskDetailDashboard

---

### ⚠️ מה **לא** עובד / חסר:

#### 1. דשבורד מורה - אין פרופיל לומד
**בעיה:** `TeacherDashboard.tsx` לא מציג את הנתונים האדפטיביים

**מה רואים:**
- ציון כללי ✅
- התקדמות ✅
- חוזקות/חולשות (מיוצר ע"י AI) ✅

**מה לא רואים:**
- `hint_dependency_score` ❌
- `media_preference` (טקסט/וידאו/משחקי) ❌
- `error_fingerprint` (דפוסי שגיאות) ❌
- `proficiency_vector` לפי נושאים ❌

**איפה כן אפשר לראות:**
רק ב-`TaskDetailDashboard` (בתוך פעילות ספציפית)

#### 2. וריאנטים לא קיימים לתוכן ישן
**בעיה:** רק תוכן שנוצר **אחרי** 10 בינואר 2026 יכלול וריאנטים

**מה קורה:**
```typescript
// ב-CourseEditor.tsx:1407
generateFullUnitContentWithVariants(...)  // נקרא רק ביצירה חדשה
```

**משמעות:**
- תלמידים בקורסים קיימים **לא** יקבלו התאמה דינמית
- ה-selectVariant יחזיר תמיד 'original' כי אין variants

#### 3. אין לוגים של החלטות אדפטיביות
**בעיה:** אין logging מרוכז של:
- איזה וריאנט נבחר לכל תלמיד
- כמה פעמים הופעל Challenge Mode
- כמה בלוקי remediation הוזרקו

**למה זה חשוב:**
- אי אפשר לדעת אם המערכת באמת עובדת
- אי אפשר למדוד את האפקטיביות

#### 4. סגנונות למידה - נאספים אבל לא משפיעים
**בעיה:** `media_preference` נשמר ב-profile אבל:
- לא מוצג למורה
- לא משפיע על בחירת תוכן

---

### 📋 המלצות לתיקון

#### עדיפות קריטית:

1. **הוסף תצוגת פרופיל לומד בדשבורד מורה**
   - קומפוננטה חדשה: `StudentLearningProfile`
   - מציג: hint_dependency, media_preference, error_fingerprint
   - מיקום: בתוך StudentInsightsModal

2. **הוסף logging לאירועים אדפטיביים**
   - לשמור: variant_selected, challenge_mode_activated, remediation_injected
   - מיקום: `users/{userId}/adaptive_events`

3. **כלי migration לתוכן קיים**
   - סקריפט שרץ על קורסים קיימים
   - מייצר variants לבלוקים שחסרים להם

#### עדיפות בינונית:

4. **התאמת תוכן לפי סגנון למידה**
   - אם תלמיד מעדיף video (70%) - להציע סרטון לפני טקסט
   - לוגיקה ב-SequentialCoursePlayer

5. **דשבורד אדפטיבי עצמאי**
   - טאב חדש: "התקדמות אדפטיבית"
   - מראה: proficiency_vector כ-heatmap

---

### 🔬 בדיקות לביצוע ידני

#### בדיקה א': האם Firestore מתעדכן?

1. פתח Firebase Console → Firestore
2. נווט ל: `users/{studentId}/profile/stats`
3. בקש מתלמיד לסיים פעילות
4. **צפי:** המסמך מתעדכן עם `lastUpdated` חדש

#### בדיקה ב': האם וריאנטים נוצרים?

1. צור פעילות חדשה (לא קורס קיים!)
2. ב-Firebase Console, נווט ל: `courses/{courseId}`
3. פתח את `units[0].blocks[0]`
4. **צפי:** יש `metadata.scaffolding_variant` ו-`metadata.enrichment_variant`

#### בדיקה ג': האם ההתאמה עובדת?

1. פתח DevTools → Console
2. התחל פעילות כתלמיד
3. חפש logs עם: "Selected variant", "BKT Result"
4. **צפי:** רואים את ההחלטות בזמן אמת

**אם אין logs:** צריך להוסיף console.log ל-SequentialCoursePlayer

---

## 🛠️ שינויים שבוצעו (17 בינואר 2026)

### 1. Adaptive Logging Service (חדש)
**קובץ:** `src/services/adaptiveLoggingService.ts`

שירות חדש ששומר את כל האירועים האדפטיביים ל-Firestore:

```typescript
// סוגי אירועים שנשמרים:
type AdaptiveEventType =
    | 'variant_selected'      // כשנבחר scaffolding/enrichment
    | 'bkt_update'           // כש-BKT מחשב mastery חדש
    | 'challenge_mode'       // כשמופעל Challenge Mode
    | 'mastery_skip'         // כשנדלג נושא שנשלט
    | 'remediation_injected' // כשמוזרק בלוק תיקון
```

**מיקום ב-Firestore:**
- `users/{userId}/adaptive_events/{auto-id}` - אירועים מפורטים
- `users/{userId}/profile/adaptive_stats` - סטטיסטיקות מצטברות

### 2. StudentLearningProfile Component (חדש)
**קובץ:** `src/components/dashboard/StudentLearningProfile.tsx`

קומפוננטה חדשה שמציגה למורה את כל נתוני הפרופיל האדפטיבי:

**מה מוצג:**
- 📊 מדדי ביצוע (דיוק, זמן תגובה, שאלות, שיעורים)
- 📈 דפוסי התנהגות (תלות ברמזים, התמדה)
- 🎨 סגנון למידה מועדף (טקסט/וידאו/משחקי)
- ⚠️ דפוסי שגיאות נפוצים
- 🎯 שליטה לפי נושאים (מ-proficiency_vector)
- 🔄 סטטיסטיקות התאמה (מהלוגים החדשים)

### 3. שילוב בדשבורד מורה
**קובץ:** `src/components/TeacherDashboard.tsx`

הוספת טאב "פרופיל אדפטיבי" ל-StudentInsightsModal:
- טאב "ניתוח AI" - כמו קודם (חוזקות/חולשות מ-AI)
- טאב "פרופיל אדפטיבי" - **חדש** (נתונים אמיתיים מ-Firestore)

### 4. Logging ב-SequentialCoursePlayer
**קובץ:** `src/components/SequentialCoursePlayer.tsx`

הוספת קריאות ל-logging service במקומות הבאים:
- בחירת variant → `logVariantSelected()`
- עדכון BKT → `logBktUpdate()`
- Challenge mode → `logChallengeMode()`
- Mastery skip → `logMasterySkip()`
- Remediation → `logRemediationInjected()`

### 5. סקריפט בדיקה
**קובץ:** `scripts/check-adaptive-data.cjs`

סקריפט להפעלה ב-terminal:
```bash
node scripts/check-adaptive-data.cjs [userId]
```

**מה בודק:**
- האם profile/stats קיים ומעודכן
- האם proficiency_vector קיים
- האם error_fingerprint קיים
- האם adaptive_events נשמרים
- האם לקורסים יש variants

---

## 📋 מה נותר לעשות

1. **להריץ build ולבדוק שאין שגיאות** ✅ עבר בהצלחה
2. **לבדוק ב-Firestore** אם הנתונים מתחילים להישמר
3. **ליצור פעילות חדשה** ולוודא שווריאנטים נוצרים
4. **לבדוק את הדשבורד** - האם המורה רואה את הטאב החדש

---

## ✅ אימות חיבורים (17 בינואר 2026)

### בדיקת קוד - כל הרכיבים מחוברים:

| רכיב | קובץ | שורות | סטטוס |
|------|------|-------|-------|
| **Logging Service** | `adaptiveLoggingService.ts` | - | ✅ נוצר |
| **Import ב-Player** | `SequentialCoursePlayer.tsx` | 22 | ✅ מחובר |
| **logVariantSelected** | `SequentialCoursePlayer.tsx` | 292 | ✅ נקרא |
| **logBktUpdate** | `SequentialCoursePlayer.tsx` | 646, 886 | ✅ נקרא |
| **logRemediationInjected** | `SequentialCoursePlayer.tsx` | 696 | ✅ נקרא |
| **logChallengeMode** | `SequentialCoursePlayer.tsx` | 726 | ✅ נקרא |
| **logMasterySkip** | `SequentialCoursePlayer.tsx` | 728 | ✅ נקרא |
| **StudentLearningProfile** | `TeacherDashboard.tsx` | 26, 196 | ✅ מחובר |
| **טאב "פרופיל אדפטיבי"** | `TeacherDashboard.tsx` | 121 | ✅ מוצג |
| **generateFullUnitContentWithVariants** | `CourseEditor.tsx` | 1407 | ✅ נקרא |
| **enrichBlockWithVariants** | `gemini.ts` | 3111 | ✅ נקרא |

### מה עדיין צריך לבדוק ידנית:

1. **ב-DevTools Console** - כשתלמיד עונה על שאלה, לראות:
   ```
   📊 [Adaptive Log] bkt_update: {...}
   🧠 BKT Update: {...}
   ```

2. **ב-Firebase Console** - אחרי שתלמיד מסיים פעילות:
   - `users/{userId}/adaptive_events/` - אירועים חדשים
   - `users/{userId}/profile/adaptive_stats` - מונים מצטברים

3. **בדשבורד מורה** - ללחוץ על תלמיד ולראות:
   - שני טאבים: "ניתוח AI" ו"פרופיל אדפטיבי"
   - הטאב השני מציג נתונים מ-Firestore

4. **ביצירת פעילות חדשה** - ב-Console:
   ```
   🔄 Generating adaptive variants for X blocks...
   ✅ Generated variants for block xyz: scaffolding=true, enrichment=true
   ```

