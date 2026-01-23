# 🔒 Protected Code Registry - רשימת קוד קריטי

**אזהרה:** הקבצים הבאים משפיעים ישירות על כל המשתמשים במערכת.
שינוי בלי בדיקה יסודית עלול לגרום לבעיות רחבות היקף.

---

## 📋 תוכן עניינים

1. [AI Prompt System](#1-ai-prompt-system)
2. [Streaming Server](#2-streaming-server)
3. [Course Context](#3-course-context)
4. [היסטוריית שינויים](#היסטוריית-שינויים)

---

## 1️⃣ AI Prompt System

### 📁 קבצים

- [functions/src/ai/prompts.ts](../functions/src/ai/prompts.ts)

### 🔴 רמת הגנה: CRITICAL

### 💥 למה זה קריטי?

```
prompts.ts משפיע על:
  ↓
יצירת כל הפעילויות החינוכיות
  ↓
כל המורים והתלמידים במערכת
  ↓
שינוי קטן = השפעה על אלפי משתמשים
```

**השפעה:**
- ✅ שינוי טוב: איכות תוכן משתפרת לכולם
- ❌ שינוי רע: כל הפעילויות החדשות פגומות

### ⚠️ לפני שמשנים - Checklist חובה!

```bash
□ 1. הבנת ההשפעה
   "האם השינוי משנה את מבנה ה-prompt?"
   "האם זה משנה את שדות הפלט?"

□ 2. הרצת טסטים
   npm test -- prompts.test.ts

   צפוי: ✅ All tests pass

□ 3. בדיקה ידנית עם דוגמאות אמיתיות
   צור 3-5 פעילויות בנושאים שונים
   בדוק שהפלט איכותי

□ 4. בדיקת אורך Token
   השתמש ב-https://platform.openai.com/tokenizer
   וודא שהprompt לא חורג מהמקסימום

□ 5. Code Review
   בקש ממפתח נוסף לבדוק את השינוי

□ 6. תיעוד
   עדכן את [CRITICAL_CODE.md](CRITICAL_CODE.md)
   רשום מה שונה ולמה

□ 7. Deploy בזהירות
   Deploy ל-staging קודם
   בדוק שם לפני production
```

### 📊 טסטים רלוונטיים

- [functions/src/ai/__tests__/prompts.test.ts](../functions/src/ai/__tests__/prompts.test.ts)

**כיסוי נדרש:** 85%+

**הרצה:**
```bash
cd functions
npm test -- prompts.test.ts
npm run test:coverage -- prompts.ts
```

### 📝 פונקציות קריטיות

| פונקציה | מה היא עושה | רמת סיכון |
|---------|-------------|-----------|
| `getSkeletonPrompt()` | יוצרת מבנה פעילות | 🔴 גבוה מאוד |
| `getStepContentPrompt()` | יוצרת תוכן צעד | 🔴 גבוה מאוד |
| `getLinguisticConstraintsByGrade()` | התאמת שפה לגיל | 🟡 בינוני |
| `BOT_PERSONAS` | פרסונות צ'אט | 🟢 נמוך |

### 🚨 דוגמאות לשינויים מסוכנים

❌ **אל תעשה:**
```typescript
// הסרת שדה שהקוד מצפה לו
export const getSkeletonPrompt = (...) => {
  return `Create skeleton...`;
  // חסר: unit_title, steps, context_image_prompt
};
```

❌ **אל תעשה:**
```typescript
// שינוי מבנה JSON הפלט
// הקוד מצפה ל-"steps" אתה שינית ל-"items"
Output JSON Structure:
{
  "items": [ ... ] // ❌ היה "steps"
}
```

✅ **כן, זה בסדר:**
```typescript
// שיפור הנוסח של prompt
return `
  Task: Create a comprehensive skeleton...
  // הוספת הבהרות, דוגמאות, הנחיות נוספות
`;
```

✅ **כן, זה בסדר:**
```typescript
// הוספת בדיקת קלט
export const getSkeletonPrompt = (...) => {
  if (!topic || !gradeLevel) {
    throw new Error('Missing required parameters');
  }
  // ...
};
```

---

## 2️⃣ Streaming Server

### 📁 קבצים

- [functions/src/streaming/streamingServer.ts](../functions/src/streaming/streamingServer.ts)

### 🔴 רמת הגנה: CRITICAL

### 💥 למה זה קריטי?

```
streamingServer.ts אחראי על:
  ↓
כל הגנרציה בזמן אמת (SSE)
  ↓
חיבור בין AI למשתמש
  ↓
שינוי רע = המערכת לא עובדת בכלל
```

**השפעה:**
- ✅ שינוי טוב: גנרציה מהירה/יציבה יותר
- ❌ שינוי רע: timeout, memory leaks, נתונים שגויים

### ⚠️ לפני שמשנים - Checklist

```bash
□ 1. הרצת טסטים
   cd functions
   npm test -- streamingServer.test.ts

□ 2. בדיקת Logic Validation
   וודא שפונקציות validateAndFix* עובדות

   npm test -- streamingServer.test.ts -t "validateAndFixActivityStep"

□ 3. בדיקה עם Emulator
   npm run serve
   בצע streaming request אמיתי
   וודא שהנתונים זורמים נכון

□ 4. בדיקת Memory Leaks
   השתמש ב-Chrome DevTools
   וודא שאין דליפות זיכרון

□ 5. בדיקת Error Handling
   נסה להשליח request לא תקין
   וודא שהשגיאה מטופלת יפה

□ 6. בדיקת Timeout
   נסה streaming ארוך (10+ צעדים)
   וודא שלא timeout
```

### 📊 טסטים רלוונטיים

- [functions/src/streaming/__tests__/streamingServer.test.ts](../functions/src/streaming/__tests__/streamingServer.test.ts) *(ייווצר)*

**כיסוי נדרש:** 80%+

### 📝 פונקציות קריטיות

| פונקציה | מה היא עושה | רמת סיכון |
|---------|-------------|-----------|
| `streamFromGemini()` | חיבור ל-Gemini API | 🔴 גבוה מאוד |
| `validateAndFixActivityStep()` | תיקון פלט AI | 🔴 גבוה מאוד |
| `validateMultipleChoice()` | וידוא שאלות רב-ברירה | 🟡 בינוני |
| `sendSSE()` | שליחת אירועי SSE | 🟡 בינוני |

### 🚨 דוגמאות לשינויים מסוכנים

❌ **אל תעשה:**
```typescript
// שינוי טיפוס בלי לעדכן את הקוד התלוי
export interface StreamChunk {
  // type: 'text' | 'json_partial' | ... // ❌ מחקת שדה
  content: string;
}
```

❌ **אל תעשה:**
```typescript
// החזרת ערך שגוי מפונקציית validation
function validateMultipleChoice(data) {
  return null; // ❌ צריך להחזיר data תקין!
}
```

✅ **כן, זה בסדר:**
```typescript
// שיפור טיפול בשגיאות
try {
  const response = await gemini.generate(...);
} catch (error) {
  logger.error('Gemini error:', error);
  sendSSE(res, 'error', {
    type: 'error',
    content: 'Generation failed, please retry'
  });
}
```

---

## 3️⃣ Course Context

### 📁 קבצים

- [src/context/CourseContext.tsx](../src/context/CourseContext.tsx)

### 🟡 רמת הגנה: HIGH

### 💥 למה זה חשוב?

```
CourseContext.tsx מנהל:
  ↓
כל נתוני הקורסים באפליקציה
  ↓
שמירה/טעינה מ-Firestore
  ↓
שינוי רע = אובדן נתונים, race conditions
```

**השפעה:**
- ✅ שינוי טוב: שמירה יעילה יותר, פחות race conditions
- ❌ שינוי רע: אובדן נתונים, נתונים לא מסונכרנים

### ⚠️ לפני שמשנים - Checklist

```bash
□ 1. הרצת טסטים
   npm test -- CourseContext.test.tsx

□ 2. בדיקת Debounce Logic
   וודא ש-saveToCloud לא נקרא פעמים רבות מדי

□ 3. בדיקת Race Condition Protection
   וודא שה-isLocalUpdateRef עובד נכון

□ 4. בדיקה עם Firestore Emulator
   npm run dev
   צור קורס, ערוך, שמור
   בדוק ש-Firestore מעודכן נכון

□ 5. בדיקת Lazy Loading
   בדוק שיחידות גדולות נטענות נכון

□ 6. בדוק Snapshot Handling
   בצע שינויים במהירות
   וודא שהם לא נדרסים
```

### 📊 טסטים רלוונטיים

- [src/context/__tests__/CourseContext.test.tsx](../src/context/__tests__/CourseContext.test.tsx) *(ייווצר)*

**כיסוי נדרש:** 70%+

### 📝 פונקציות קריטיות

| פונקציה | מה היא עושה | רמת סיכון |
|---------|-------------|-----------|
| `sanitizeCourseData()` | ניקוי נתוני Firestore | 🔴 גבוה |
| `saveToCloud()` | שמירה ל-Firestore | 🟡 בינוני |
| `setCourse()` | עדכון state מקומי | 🟡 בינוני |
| `loadCourse()` | טעינת קורס | 🟢 נמוך |

### 🚨 דוגמאות לשינויים מסוכנים

❌ **אל תעשה:**
```typescript
// הסרת ה-debounce
const saveToCloud = (newCourse) => {
  // שמירה מיידית - ❌ תגרום ל-write stream exhaustion!
  await setDoc(doc(db, "courses", id), newCourse);
};
```

❌ **אל תעשה:**
```typescript
// שינוי מבנה הנתונים בלי migration
const sanitizeCourseData = (data) => {
  return {
    // ...data, // ❌ שכחת להעתיק שדות קיימים
    newField: 'value'
  };
};
```

✅ **כן, זה בסדר:**
```typescript
// הוספת שדה חדש עם fallback
const sanitizeCourseData = (data) => {
  return {
    ...data,
    newField: data.newField || 'default value', // ✅ תומך במבנה ישן
  };
};
```

---

## 📜 היסטוריית שינויים

### 2026-01-23 - הוספת Differentiated Learning Support

**קובץ:** `functions/src/ai/prompts.ts`
**שונה על ידי:** @eyal
**Commit:** `abc1234`

**מה שונה:**
- הוספת פרמטר `learningLevel` ל-`getSkeletonPrompt()`
- הוספת פרמטר `learningLevel` ל-`getStepContentPrompt()`
- הוספת בדיקות בטסטים

**טסטים:**
```bash
✅ All tests passed
✅ Coverage: 87% (above threshold)
```

**בדיקה ידנית:**
- ✅ נבדק עם 5 קורסים שונים
- ✅ כל 3 הרמות (הבנה, יישום, העמקה) עובדות

---

### 2026-01-20 - תיקון Race Condition ב-CourseContext

**קובץ:** `src/context/CourseContext.tsx`
**שונה על ידי:** @eyal
**Commit:** `xyz789`

**מה שונה:**
- הוספת `isLocalUpdateRef` למניעת override מ-Firestore
- שיפור לוגיקת ה-debounce

**טסטים:**
```bash
✅ Manual testing - no data loss
✅ Firestore writes reduced by 80%
```

---

## 🎯 כללי הגנה כלליים

### DO ✅

1. **תמיד הרץ טסטים לפני commit**
   ```bash
   npm run test:critical
   ```

2. **בדוק coverage**
   ```bash
   npm run test:coverage
   ```
   ודא שלא ירד מהסף

3. **כתוב טסט חדש לכל שינוי**
   שינית פונקציה? הוסף טסט שבודק אותה

4. **תעד שינויים**
   עדכן את הקובץ הזה אחרי כל שינוי קריטי

5. **בקש code review**
   שינוי קריטי = 2 עיניים לפחות

### DON'T ❌

1. **אל תדלג על טסטים**
   ```bash
   git commit --no-verify # ❌ מסוכן!
   ```

2. **אל תשנה מבנה JSON בלי migration**
   ```typescript
   // ❌ קוד ישן יישבר!
   return { newStructure: ... };
   ```

3. **אל תמחק שדות בלי לוודא שאף אחד לא משתמש**
   ```typescript
   // ❌ אולי יש קוד שמשתמש ב-oldField
   delete data.oldField;
   ```

4. **אל תעשה deploy ישירות ל-production**
   ```bash
   # ❌ בדוק ב-staging קודם!
   firebase deploy --only functions
   ```

---

## 🔔 התראות ועדכונים

### כשלהוסיף קובץ חדש לרשימה:

1. ערוך את [CRITICAL_CODE.md](CRITICAL_CODE.md)
2. הוסף סעיף חדש עם:
   - רמת הגנה
   - למה זה קריטי
   - Checklist
   - טסטים רלוונטיים
3. עדכן את [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) אם נדרש

### כשמסירים קובץ מהרשימה:

1. וודא שהוא באמת לא קריטי יותר
2. עדכן את המסמך
3. בצע commit עם הסבר

---

## 📞 שאלות?

אם אתה לא בטוח אם קובץ הוא קריטי - **התייחס אליו כאילו הוא כן!**

טוב יותר להיזהר מדי מאשר לגרום לבאגים.

---

**עדכון אחרון:** 2026-01-23
**גרסה:** 1.0
**מתחזק:** @eyal
