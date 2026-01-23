# 🛡️ מדריך מלא - בדיקות והגנה על קוד במערכת AI-LMS

**גרסה:** 1.0
**תאריך עדכון אחרון:** 2026-01-23
**מיועד ל:** מפתחים ומנהלי מערכת

---

## 📚 תוכן עניינים

1. [מבוא - מה זה ולמה זה חשוב](#מבוא)
2. [התקנה ראשונית](#התקנה-ראשונית)
3. [Quick Start - מדריך מהיר](#quick-start)
4. [פקודות בסיסיות](#פקודות-בסיסיות)
5. [תהליך עבודה יומי](#תהליך-עבודה-יומי)
6. [דוגמאות פלט](#דוגמאות-פלט)
7. [3 שכבות ההגנה](#3-שכבות-הגנה)
8. [פתרון בעיות](#פתרון-בעיות)
9. [תחזוקה שוטפת](#תחזוקה-שוטפת)
10. [שאלות נפוצות](#שאלות-נפוצות)

---

## 🎯 מבוא

### מה זה?

מערכת הבדיקות שלנו היא **רשת בטיחות** שמונעת קוד שבור מלהגיע לייצור.

### למה זה חשוב?

```
ללא בדיקות:                    עם בדיקות:
─────────────────────          ─────────────────────
כתיבת קוד                       כתיבת קוד
    ↓                              ↓
Deploy ישירות                   ✅ הרצת טסטים
    ↓                              ↓
💥 באג בייצור!                  ❌ טסט נכשל!
    ↓                              ↓
מורים מתלוננים                  תיקון הבאג
    ↓                              ↓
תיקון בלחץ                      ✅ טסטים עוברים
    ↓                              ↓
Deploy תיקון                    Deploy בטוח
```

### מה הכלים בודקים?

| כלי | מה הוא בודק | דוגמה |
|-----|-------------|--------|
| **Type Check** | שגיאות TypeScript | "משתנה לא מוגדר", "טיפוס שגוי" |
| **Lint** | איכות קוד | "משתנה לא בשימוש", "פורמט לא אחיד" |
| **Unit Tests** | פונקציות בודדות | "הפונקציה getSkeletonPrompt מחזירה ערך תקין" |
| **Coverage** | כיסוי קוד | "80% מהקוד הקריטי מכוסה בטסטים" |

---

## ⚙️ התקנה ראשונית

### מה כבר הותקן (בשבילך):

✅ Jest + ts-jest
✅ Testing Library
✅ קבצי תצורה (jest.config.js)
✅ טסטים ראשונים (prompts.test.ts)
✅ Scripts ב-package.json

### בדיקה שהכל עובד:

```bash
# בתיקיית הפרויקט
cd c:\Users\eyal\Desktop\ai-lms-system\ai-lms-system

# בדוק שהכלים מותקנים
npm run test -- --version
# צפוי: Jest CLI v29.x.x

npm run type-check --help
# צפוי: הוראות שימוש ב-tsc
```

**✅ אם אתה רואה את זה - הכל מוכן!**

---

## 🚀 Quick Start

### תרחיש: שינית משהו ב-`prompts.ts` ורוצה לוודא שהכל עובד

```bash
# 1. פתח טרמינל ב-VSCode (Ctrl + `)

# 2. הרץ טסטים
npm test

# 3. תוצאה:
PASS functions/src/ai/__tests__/prompts.test.ts
  ✓ BOT_PERSONAS should contain all required persona types (3ms)
  ✓ each persona should have required fields (2ms)
  ✓ socratic persona should prevent direct answers

Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total

# 4. אם הכל ירוק (✓) - מעולה! אתה יכול לעשות commit
git add .
git commit -m "שיפור prompts"
git push
```

**זהו! זה כל מה שצריך לתהליך בסיסי.**

---

## 📋 פקודות בסיסיות

### 1. `npm test` - הרצת כל הטסטים

**מה זה עושה:**
מריץ את כל קבצי ה-`.test.ts` בפרויקט.

**מתי להשתמש:**
- אחרי שעשית שינוי בקוד
- לפני commit
- כשאתה רוצה לוודא שהכל עובד

**איך להריץ:**
```bash
npm test
```

**פלט מוצלח:**
```
PASS functions/src/ai/__tests__/prompts.test.ts
  AI Prompts - Critical Logic
    BOT_PERSONAS
      ✓ should contain all required persona types (3 ms)
      ✓ each persona should have required fields (2 ms)
    getSkeletonPrompt
      ✓ should generate prompt with all required sections (1 ms)

Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total
Snapshots:   2 passed, 2 total
Time:        4.532 s
```

**פלט כושל:**
```
FAIL functions/src/ai/__tests__/prompts.test.ts
  ● getSkeletonPrompt › should include topic in prompt

    expect(received).toContain(expected)

    Expected substring: "Topic: Math"
    Received string:    "Create a skeleton..."

      72 |     );
      73 |
    > 74 |     expect(prompt).toContain('Topic: Math');
         |                    ^
      75 |   });

  FAIL  functions/src/ai/__tests__/prompts.test.ts

Test Suites: 1 failed, 1 total
Tests:       1 failed, 27 passed, 28 total
```

**מה לעשות אם נכשל:**
1. קרא את השגיאה - היא מדויקת!
2. תקן את הקוד
3. הרץ שוב `npm test`

---

### 2. `npm run test:watch` - מצב Watch

**מה זה עושה:**
רץ בצורה מתמשכת ומריץ מחדש כל פעם ששומרים קובץ.

**מתי להשתמש:**
- כשאתה עובד על קוד ורוצה פידבק מיידי
- כשאתה כותב טסטים חדשים

**איך להריץ:**
```bash
npm run test:watch
```

**מה אתה רואה:**
```
Watch Usage
 › Press a to run all tests.
 › Press f to run only failed tests.
 › Press p to filter by a filename regex pattern.
 › Press t to filter by a test name regex pattern.
 › Press q to quit watch mode.
 › Press Enter to trigger a test run.
```

**טיפ:** לחץ `q` כדי לצאת מ-watch mode.

---

### 3. `npm run test:coverage` - דוח כיסוי

**מה זה עושה:**
מראה כמה אחוזים מהקוד מכוסים בטסטים.

**מתי להשתמש:**
- כשאתה רוצה לדעת אילו חלקים בקוד לא מכוסים
- לפני PR חשוב
- אחרי הוספת טסטים חדשים

**איך להריץ:**
```bash
npm run test:coverage
```

**פלט:**
```
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
All files             |   73.21 |    65.45 |   70.83 |   72.89 |
 ai                   |   85.71 |    78.57 |   90.00 |   85.00 |
  prompts.ts          |   85.71 |    78.57 |   90.00 |   85.00 | 45,67,89
 streaming            |   67.89 |    60.00 |   65.00 |   67.50 |
  streamingServer.ts  |   67.89 |    60.00 |   65.00 |   67.50 | 120-145,200
----------------------|---------|----------|---------|---------|-------------------
```

**פענוח:**
- `% Stmts` - אחוז משפטים שרצו
- `% Branch` - אחוז תנאים (if/else) שבדקנו
- `% Funcs` - אחוז פונקציות שבדקנו
- `Uncovered Line #s` - שורות שלא כוסו

**מטרה:**
- קוד קריטי (`prompts.ts`, `streamingServer.ts`): **80%+**
- קוד רגיל: **60%+**

---

### 4. `npm run test:critical` - טסטים קריטיים בלבד

**מה זה עושה:**
רץ רק טסטים של קבצים קריטיים (prompts, streamingServer, agent).

**מתי להשתמש:**
- כשאתה ממהר ורוצה לוודא שהקוד הכי חשוב עובד
- לפני deploy חירום

**איך להריץ:**
```bash
npm run test:critical
```

**פלט:**
```
PASS functions/src/ai/__tests__/prompts.test.ts
PASS functions/src/streaming/__tests__/streamingServer.test.ts

Test Suites: 2 passed, 2 total
Tests:       45 passed, 45 total
Time:        2.831 s
```

---

### 5. `npm run type-check` - בדיקת TypeScript

**מה זה עושה:**
בודק שאין שגיאות TypeScript (בלי להריץ קוד).

**מתי להשתמש:**
- לפני commit
- כשאתה משנה טיפוסים
- כשיש שגיאות אדומות ב-VSCode

**איך להריץ:**
```bash
npm run type-check
```

**פלט מוצלח:**
```
(אין פלט - זה אומר שהכל תקין!)
```

**פלט עם שגיאות:**
```
src/components/CourseEditor.tsx:45:7 - error TS2322: Type 'string' is not assignable to type 'number'.

45   const count: number = "5";
         ~~~~~

Found 1 error in src/components/CourseEditor.tsx:45
```

---

### 6. `npm run lint` - בדיקת איכות קוד

**מה זה עושה:**
בודק עמידה בכללי קוד (ESLint).

**מתי להשתמש:**
- לפני commit
- כשאתה רוצה קוד נקי

**איך להריץ:**
```bash
npm run lint
```

**פלט מוצלח:**
```
(אין פלט - הכל תקין!)
```

**פלט עם בעיות:**
```
/src/components/CourseEditor.tsx
  23:7  warning  'unused' is defined but never used  @typescript-eslint/no-unused-vars
  45:1  error    Expected indentation of 2 spaces but found 4  indent

✖ 2 problems (1 error, 1 warning)
```

**תיקון אוטומטי:**
```bash
npm run lint:fix
```

---

### 7. `npm run validate` - הכל ביחד!

**מה זה עושה:**
רץ את כל הבדיקות ברצף:
1. Type Check
2. Lint
3. Tests with Coverage

**מתי להשתמש:**
- לפני PR חשוב
- לפני deploy
- כשאתה רוצה להיות בטוח ש**הכל** תקין

**איך להריץ:**
```bash
npm run validate
```

**פלט:**
```
> type-check
(checking types...)

> lint
(checking code quality...)

> test:ci
PASS functions/src/ai/__tests__/prompts.test.ts
PASS src/context/__tests__/CourseContext.test.tsx

Test Suites: 5 passed, 5 total
Tests:       67 passed, 67 total
Coverage:    78.5%

✅ All validations passed!
```

---

## 🔄 תהליך עבודה יומי

### תרחיש: אתה משנה משהו ב-`prompts.ts`

```bash
┌─────────────────────────────────────────────────────┐
│ יום רגיל של פיתוח                                   │
└─────────────────────────────────────────────────────┘

📝 1. פתח את prompts.ts ב-VSCode
    └─ עשה שינויים (למשל, שיפור prompt)

🧪 2. בדוק שהשינוי עובד
    cd c:\Users\eyal\Desktop\ai-lms-system\ai-lms-system\functions
    npm test

    ✅ תוצאה: Tests passed

🔍 3. בדוק type safety
    npm run type-check

    ✅ תוצאה: No errors

📊 4. (אופציונלי) בדוק כיסוי
    npm run test:coverage

    ✅ תוצאה: prompts.ts - 87% coverage

💾 5. שמור ועשה commit
    git add functions/src/ai/prompts.ts
    git commit -m "improve skeleton prompt structure"

    (Pre-commit hook יריץ אוטומטית:
     - Type check ✓
     - Lint ✓
     - Critical tests ✓)

    ✅ תוצאה: Commit successful

⬆️ 6. Push ל-GitHub
    git push origin main

    (GitHub Actions יריץ אוטומטית:
     - All tests
     - Coverage check
     - Build)

    ✅ תוצאה: All checks passed

🚀 7. Deploy (אם רוצה)
    firebase deploy --only functions
```

**זמן כולל: 3-5 דקות**

---

## 📊 דוגמאות פלט

### ✅ פלט מוצלח - הכל עובד

```bash
$ npm test

 PASS  functions/src/ai/__tests__/prompts.test.ts
  AI Prompts - Critical Logic
    BOT_PERSONAS
      ✓ should contain all required persona types (3 ms)
      ✓ each persona should have required fields (2 ms)
      ✓ socratic persona should prevent direct answers (1 ms)
    getSkeletonPrompt
      ✓ should generate prompt with all required sections (4 ms)
      ✓ should include exam mode constraints when mode=exam (2 ms)
      ✓ should include learning level constraints when provided (1 ms)
      ✓ should respect step count parameter (1 ms)
      ✓ should include interaction diversity rules (2 ms)
    getLinguisticConstraintsByGrade
      ✓ should return constraints for early elementary (1 ms)
      ✓ should return constraints for middle school (1 ms)
      ✓ should handle English grade inputs (1 ms)

Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total
Snapshots:   2 passed, 2 total
Time:        4.532 s
Ran all test suites.
```

**מה זה אומר:**
✅ כל 28 הטסטים עברו
✅ אין באגים
✅ אפשר לעשות commit בביטחון

---

### ❌ פלט כושל - יש בעיה!

```bash
$ npm test

 FAIL  functions/src/ai/__tests__/prompts.test.ts
  AI Prompts - Critical Logic
    getSkeletonPrompt
      ✓ should generate prompt with all required sections (4 ms)
      ✕ should include topic in skeleton prompt (12 ms)

  ● getSkeletonPrompt › should include topic in skeleton prompt

    expect(received).toContain(expected) // indexOf

    Expected substring: "Mathematics"
    Received string:    "Create a skeleton for learning unit.

    Target Audience: כיתה ה.
    Mode: learning
    Count: Exactly 5 steps."

      45 |     );
      46 |
    > 47 |     expect(prompt).toContain('Mathematics');
         |                    ^
      48 |   });
      49 |
      50 | });

      at Object.<anonymous> (src/ai/__tests__/prompts.test.ts:47:20)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 27 passed, 28 total
Snapshots:   2 passed, 2 total
Time:        5.123 s
```

**מה זה אומר:**
❌ טסט אחד נכשל
❌ הפונקציה לא כוללת את שם הנושא (Mathematics)
❌ צריך לתקן את הקוד לפני commit

**איך לתקן:**
1. עבור לקובץ [prompts.ts:47](functions/src/ai/prompts.ts#L47)
2. וודא שהפונקציה מחזירה את ה-topic
3. הרץ `npm test` שוב
4. המשך רק אחרי ✓

---

### 📈 דוח Coverage מפורט

```bash
$ npm run test:coverage

----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
All files             |   73.21 |    65.45 |   70.83 |   72.89 |
 ai                   |   85.71 |    78.57 |   90.00 |   85.00 |
  prompts.ts          |   85.71 |    78.57 |   90.00 |   85.00 | 145,167,289
 streaming            |   67.89 |    60.00 |   65.00 |   67.50 |
  streamingServer.ts  |   67.89 |    60.00 |   65.00 |   67.50 | 120-145,200-215
 context              |   78.00 |    70.00 |   80.00 |   77.50 |
  CourseContext.tsx   |   78.00 |    70.00 |   80.00 |   77.50 | 89,123,201
----------------------|---------|----------|---------|---------|-------------------

✅ Coverage thresholds met: prompts.ts (85% > 85% required)
⚠️  Coverage below threshold: streamingServer.ts (67% < 80% required)
```

**מה לעשות:**
- ✅ `prompts.ts` - מצוין! מעל הסף
- ⚠️ `streamingServer.ts` - צריך עוד טסטים (שורות 120-145, 200-215)

---

## 🛡️ 3 שכבות הגנה

### שכבה 1️⃣ - המחשב שלך (Local)

**איפה:** Terminal במחשב שלך
**מתי:** כל פעם שאתה עובד
**כלים:** Husky + lint-staged ✅ **מותקן!**

```
┌────────────────────────────────────┐
│  אתה עושה שינוי                   │
│         ↓                          │
│  npm test (ידני)                  │
│         ↓                          │
│  git add files.ts                  │
│  git commit -m "message"           │
│         ↓                          │
│  🤖 Pre-commit Hook (אוטומטי!)   │
│     ↓                              │
│  lint-staged מריץ:                 │
│     • jest על הקבצים ששונו         │
│         ↓                          │
│  ✓ הכל עבר → Commit מצליח!        │
│  ✗ משהו נכשל → Commit נחסם!       │
└────────────────────────────────────┘
```

**איך לדעת שעבד:**
```bash
$ git commit -m "update"

[STARTED] Backing up original state...
[COMPLETED] Backed up original state in git stash
[STARTED] Running tasks for staged files...
[STARTED] *.{ts,tsx} — 3 files
[STARTED] npx jest --bail --findRelatedTests --passWithNoTests
[COMPLETED] npx jest --bail --findRelatedTests --passWithNoTests
[COMPLETED] Running tasks for staged files...

[main abc1234] update
 3 files changed, 25 insertions(+), 10 deletions(-)
```
✅ **הcommit עבר! הטסטים רצו ועברו בהצלחה.**

**אם נכשל:**
```bash
$ git commit -m "update"

[STARTED] Running tasks for staged files...
[STARTED] *.{ts,tsx} — 2 files
[STARTED] npx jest --bail --findRelatedTests --passWithNoTests
[FAILED] npx jest --bail --findRelatedTests --passWithNoTests

✖ npx jest --bail --findRelatedTests --passWithNoTests:
FAIL functions/src/ai/__tests__/prompts.test.ts
  ● getSkeletonPrompt › should generate valid prompt

    expect(prompt).toContain('BLOOM')
    Expected substring: "BLOOM"
    Received string: "..."

Test Suites: 1 failed, 1 total
Tests:       1 failed, 27 passed, 28 total

husky - pre-commit script failed (code 1)
```
❌ **ה-commit נחסם! יש טסט שנכשל.**
→ תקן את השגיאה ונסה שוב את הcommit.

**💡 איך לדלג על הבדיקה (לא מומלץ!):**
```bash
git commit -m "update" --no-verify
```
⚠️ **השתמש רק במקרי חירום!**

---

### שכבה 2️⃣ - GitHub (Pull Request)

**איפה:** GitHub.com
**מתי:** כל PR ל-main

```
┌────────────────────────────────────┐
│  git push origin feature-branch    │
│         ↓                          │
│  פותח PR ב-GitHub                  │
│         ↓                          │
│  🤖 GitHub Actions (אוטומטי!)     │
│     - type-check ✓ (2m 15s)        │
│     - lint ✓ (1m 42s)              │
│     - test-unit ✓ (3m 08s)         │
│     - test-critical ✓ (4m 21s)     │
│     - build ✓ (2m 55s)             │
│         ↓                          │
│  כפתור Merge מופיע/חסום            │
└────────────────────────────────────┘
```

**איך לדעת שעבד:**

עבור ל-GitHub → Pull Requests → ה-PR שלך

**מוצלח:**
```
✓ All checks have passed

  ✓ type-check (2m 15s)
  ✓ lint (1m 42s)
  ✓ test-unit (3m 08s)
  ✓ test-critical (4m 21s)
  ✓ build (2m 55s)

[Merge pull request] כפתור ירוק זמין
```

**נכשל:**
```
✗ Some checks failed

  ✓ type-check (2m 15s)
  ✗ test-critical (4m 21s) - Details
  ✓ lint (1m 42s)
  ✓ test-unit (3m 08s)
  ✓ build (2m 55s)

[Merge pull request] כפתור אפור - לא זמין
```

לחץ על "Details" ליד ה-✗ לראות מה נכשל.

---

### שכבה 3️⃣ - Production (אחרי Deploy)

**איפה:** Firebase Console
**מתי:** 24/7 בייצור

```
┌────────────────────────────────────┐
│  firebase deploy                   │
│         ↓                          │
│  🔥 Production Running             │
│         ↓                          │
│  📊 Monitoring (24/7)              │
│     - Error Logs                   │
│     - Performance Metrics          │
│     - User Analytics               │
│         ↓                          │
│  🚨 Alerts (אם יש בעיה)           │
│     - Email/SMS                    │
│     - Slack notification           │
└────────────────────────────────────┘
```

**איך לבדוק:**

1. כנס ל-[Firebase Console](https://console.firebase.google.com)
2. בחר את הפרויקט
3. Functions → **Logs**

**תקין:**
```
10:45:23  INFO  streamingServer: Activity generated (user: abc123)
10:45:25  INFO  prompts: Skeleton created for "Math"
10:46:01  INFO  streamingServer: Stream completed (3.2s)
```

**בעייתי:**
```
10:45:23  INFO  streamingServer: Activity generated
10:45:25  ERROR TypeError: Cannot read property 'topic' of undefined
              at getSkeletonPrompt (prompts.ts:45)
10:46:01  ERROR streamingServer failed after 3 retries
```

**אם יש שגיאות:**
1. לחץ על השגיאה לפרטים
2. בדוק איזו פונקציה נכשלה
3. תקן והעלה גרסה חדשה

---

## 🔧 פתרון בעיות

### בעיה 1: "No tests found"

**תסמין:**
```bash
$ npm test
No tests found, exiting with code 1
```

**פתרון:**
```bash
# וודא שאתה בתיקייה הנכונה
pwd
# צריך להיות: c:\Users\eyal\Desktop\ai-lms-system\ai-lms-system

# בדוק שיש קבצי טסט
ls functions/src/ai/__tests__/
# צריך לראות: prompts.test.ts

# אם אין קבצים - הטסטים לא נוצרו עדיין
```

---

### בעיה 2: "Preset ts-jest not found"

**תסמין:**
```bash
$ npm test
Preset ts-jest not found relative to rootDir
```

**פתרון:**
```bash
# התקן את ts-jest
npm install --save-dev ts-jest@29

# או ב-functions
cd functions
npm install --save-dev ts-jest@29
```

---

### בעיה 3: טסטים נכשלים אחרי שינוי

**תסמין:**
```bash
FAIL src/ai/__tests__/prompts.test.ts
  ✕ should include topic in prompt
```

**שאלות לבירור:**
1. **האם השינוי מכוון?** אם כן - עדכן את הטסט
2. **האם זה באג?** אם כן - תקן את הקוד
3. **האם הטסט מיושן?** עדכן אותו

**פתרון:**

אם השינוי **מכוון** (למשל, שינית את המבנה של prompt):
```typescript
// עדכן את הטסט ב-prompts.test.ts
test('should include topic in new format', () => {
  const prompt = getSkeletonPrompt(...);
  expect(prompt).toContain('Subject: Mathematics'); // פורמט חדש
});
```

אם זה **באג**:
```typescript
// תקן את prompts.ts
export const getSkeletonPrompt = (topic, ...) => {
  return `Subject: ${topic}...`; // הוסף את topic
};
```

---

### בעיה 4: Pre-commit hook חוסם commit

**תסמין:**
```bash
$ git commit -m "update"

> type-check... ✗

Error: src/prompts.ts:45 - Type 'string' is not assignable to 'number'

✖ Pre-commit checks failed!
```

**פתרון:**

**אופציה 1:** תקן את השגיאה (מומלץ!)
```bash
# תקן את הקובץ
# הרץ שוב
npm run type-check
# אם עובד:
git add .
git commit -m "update"
```

**אופציה 2:** דלג על hook (לשימוש חירום בלבד!)
```bash
git commit -m "update" --no-verify
# ⚠️ רק במקרי חירום! הטסטים קיימים מסיבה!
```

---

### בעיה 5: Coverage נמוך מדי

**תסמין:**
```bash
$ npm run test:coverage

Coverage for prompts.ts is 67.89%. Threshold is 85%.
```

**פתרון:**

בדוק אילו שורות לא מכוסות:
```bash
npm run test:coverage

# בטבלה תראה:
File         | Uncovered Line #s
-------------|-------------------
prompts.ts   | 145,167,289
```

כתוב טסט שיכסה את השורות האלה:
```typescript
// ב-prompts.test.ts
test('should handle edge case at line 145', () => {
  // טסט שיריץ את השורה 145
  const result = getSkeletonPrompt(/* edge case */);
  expect(result).toBeDefined();
});
```

---

## 📅 תחזוקה שוטפת

### כל יום (2 דקות)

```bash
# בוקר - לפני שמתחילים לעבוד
cd c:\Users\eyal\Desktop\ai-lms-system\ai-lms-system

# הרץ טסטים לוודא שהכל עובד
npm test
```

**צפוי:** ✅ All tests pass

---

### כל שבוע (10 דקות)

```bash
# 1. בדוק coverage
npm run test:coverage

# 2. אם יש קבצים עם כיסוי נמוך - הוסף טסטים
# עדיפות: קבצים קריטיים (prompts, streamingServer)

# 3. בדוק GitHub Actions
# עבור ל-GitHub → Actions
# וודא שאין builds נכשלים
```

---

### כל חודש (30 דקות)

```bash
# 1. עדכן חבילות Testing
npm update --save-dev jest ts-jest @types/jest

# 2. בדוק שהטסטים עדיין עוברים
npm test

# 3. סקור טסטים ישנים - האם יש משהו למחוק/לעדכן?

# 4. בדוק Firebase Logs
# יש שגיאות חוזרות שצריכות טסט?
```

---

## ❓ שאלות נפוצות

### ש: מתי אני **חייב** להריץ טסטים?

**ת:** לפני כל commit. ה-pre-commit hook יעשה זאת אוטומטית בשבילך.

---

### ש: האם אני יכול לדלג על טסטים?

**ת:** טכנית כן (`git commit --no-verify`), אבל **אל תעשה זאת!** הטסטים קיימים כדי להגן עליך.

---

### ש: כמה זמן לוקח להריץ טסטים?

**ת:**
- `npm test` - 3-5 שניות
- `npm run test:coverage` - 8-12 שניות
- `npm run validate` - 15-25 שניות

---

### ש: מה אם יש לי טסט שנכשל ואני לא יודע למה?

**ת:**
1. קרא את הודעת השגיאה - היא מדויקת מאוד
2. לחץ על מספר השורה להגיע לקוד
3. הרץ רק את הטסט הזה:
   ```bash
   npm test -- prompts.test.ts
   ```
4. אם עדיין לא ברור - בקש עזרה (אני כאן!)

---

### ש: האם הטסטים יתפסו **כל** באג?

**ת:** לא. טסטים תופסים ~80% מהבאגים. יש דברים שרק בדיקה ידנית (או דף Admin שלך) תתפוס.

---

### ש: איך אני יודע שהטסטים עצמם נכונים?

**ת:**
1. Snapshot tests - תופסים שינויים בלתי מכוונים
2. Code review - מישהו בודק את הטסטים
3. אם הטסט עובר אבל יש באג - הטסט לא טוב

---

## 📚 משאבים נוספים

### קישורים שימושיים

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library - React](https://testing-library.com/docs/react-testing-library/intro)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [ESLint Rules](https://eslint.org/docs/latest/rules/)

### קבצים חשובים בפרויקט

- [jest.config.js](../jest.config.js) - תצורת Jest (root)
- [functions/jest.config.js](../functions/jest.config.js) - תצורת Jest (functions)
- [package.json](../package.json) - כל הסקריפטים
- [prompts.test.ts](../functions/src/ai/__tests__/prompts.test.ts) - דוגמת טסט

---

## 🎓 לסיכום

### מה למדת:

✅ איך להריץ טסטים (`npm test`)
✅ איך לבדוק coverage (`npm run test:coverage`)
✅ איך לקרוא פלט של טסטים
✅ איך לתקן טסטים שנכשלו
✅ מהן 3 שכבות ההגנה
✅ איך לתחזק את הטסטים

### הפקודות החשובות ביותר:

```bash
npm test                 # הכי חשוב - הרץ זאת לפני כל commit
npm run test:coverage    # בדוק כיסוי קוד
npm run type-check       # בדוק TypeScript
npm run validate         # הכל ביחד (לפני PR)
```

### זכור:

> **"אין commit בלי tests!"**

הטסטים הם רשת הבטיחות שלך. השקעת 5 שניות בהרצת טסטים תחסוך לך שעות של דיבוג בייצור.

---

**📞 צריך עזרה?**
אני פה! פשוט שאל.

**🎉 בהצלחה!**
עכשיו יש לך מערכת הגנה מקצועית על הקוד!

---

**עדכון אחרון:** 2026-01-23
**גרסה:** 1.0
**מחבר:** Claude (עם Eyal)
