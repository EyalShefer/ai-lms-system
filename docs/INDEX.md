# 📑 מפת ניווט מלאה - Testing & CI/CD

**עדכון:** 2026-01-25

---

## 📌 מקורות אמת (Source of Truth)

> **חשוב:** לכל נושא יש מסמך מקור אמת אחד בלבד. תמיד התחל משם.

| נושא | מסמך מקור אמת | עדכון אחרון |
|------|--------------|-------------|
| **למידה אדפטיבית** | [ADAPTIVE_CURRENT_STATE.md](ADAPTIVE_CURRENT_STATE.md) | 2026-01-25 |
| **Testing & CI/CD** | מסמך זה (INDEX.md) | 2026-01-25 |

### ארכיון מסמכים ישנים

מסמכים שהועברו לארכיון ואינם מעודכנים נמצאים ב-[docs/archive/](archive/):

| מסמך ישן | סיבה | תאריך |
|----------|------|-------|
| ADAPTIVE_LEARNING_SYSTEM.md | הוחלף ב-ADAPTIVE_CURRENT_STATE | 2026-01-25 |
| ADAPTIVE_SYSTEM_SPEC.md | הוחלף ב-ADAPTIVE_CURRENT_STATE | 2026-01-25 |
| ADAPTIVE_LEARNING_AUDIT_REPORT.md | הוחלף ב-ADAPTIVE_CURRENT_STATE | 2026-01-25 |

---

## 🎯 איזה מסמך לקרוא? (מדריך מהיר)

### אני רוצה...

| מה אני רוצה | איזה מסמך | זמן קריאה |
|-------------|-----------|-----------|
| **להתחיל מאפס** | [GETTING_STARTED.md](GETTING_STARTED.md) | 5 דק' |
| **לראות מה הותקן** | [SETUP_COMPLETE.md](SETUP_COMPLETE.md) | 5 דק' |
| **פקודות מהירות** | [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) | 2 דק' |
| **להבין איך Testing עובד** | [TESTING_GUIDE.md](TESTING_GUIDE.md) - חלקים 1-5 | 15 דק' |
| **להבין Pre-commit Hook** | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) | 10 דק' |
| **להבין GitHub Actions** | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) | 10 דק' |
| **לשנות קוד קריטי** | [CRITICAL_CODE.md](CRITICAL_CODE.md) | 5 דק' |

---

## 📚 מסמכים לפי נושא

### 🎓 למידה והתחלה

#### 1. [GETTING_STARTED.md](GETTING_STARTED.md) - **התחל כאן!**
**מי צריך:** מפתח חדש במערכת
**מה בפנים:**
- ✅ 5 צעדים ראשונים
- ✅ Checklist למתחילים
- ✅ טיפים לשבוע הראשון

**תוכן עניינים:**
1. איפה אני?
2. המסמכים שיצרנו (4 מסמכים)
3. מה לעשות עכשיו? (5 צעדים)
4. Checklist
5. מה למדת?
6. טיפים לשבוע הראשון
7. מה אם משהו לא עובד?

---

#### 2. [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - **סיכום התקנה**
**מי צריך:** כולם - לראות מה הותקן
**מה בפנים:**
- ✅ תשתית Testing
- ✅ Pre-commit Hooks
- ✅ GitHub Actions
- ✅ 3 שכבות הגנה
- ✅ תוצאות הרצה ראשונה

**תוכן עניינים:**
1. מה הותקן במערכת?
2. תוצאות הרצה ראשונה
3. קבצים שנוצרו
4. תיעוד מלא (5 מסמכים)
5. מה לעשות עכשיו? (3 צעדים)
6. מה יש לך עכשיו? (3 שכבות הגנה)
7. איך זה מגן עליך?
8. מסלול למידה מומלץ
9. קישורים

---

### 🛠️ שימוש יומי

#### 3. [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) - **דף עזר**
**מי צריך:** כולם - כל יום
**מה בפנים:**
- ✅ טבלת פקודות מהירה
- ✅ תהליך עבודה (3 שלבים)
- ✅ פתרון בעיות מהיר

**תוכן עניינים:**
1. פקודות יומיות (טבלה)
2. איך לקרוא תוצאות (✅/❌/⚠️)
3. תהליך עבודה מהיר
4. מה לעשות כש... (טסט נכשל, commit נחסם, coverage נמוך)
5. מטרות Coverage
6. טיפים
7. הכלל הזהב

**💡 הדפס אותו ושמור ליד המחשב!**

---

### 📖 מדריכים מקיפים

#### 4. [TESTING_GUIDE.md](TESTING_GUIDE.md) - **המדריך המלא**
**מי צריך:** למידה מעמיקה, פתרון בעיות
**מה בפנים:**
- ✅ הסבר מפורט על כל כלי
- ✅ דוגמאות פלט (מוצלח + כושל)
- ✅ תהליך עבודה יומי
- ✅ 3 שכבות הגנה
- ✅ פתרון בעיות
- ✅ שאלות נפוצות

**תוכן עניינים:**
1. מבוא - מה זה ולמה חשוב
2. התקנה ראשונית (בוצע)
3. Quick Start
4. פקודות בסיסיות (npm test, test:coverage, validate)
5. תהליך עבודה יומי
6. דוגמאות פלט
7. **3 שכבות הגנה** ← חלק חשוב!
   - שכבה 1: Local
   - שכבה 2: GitHub Actions
   - שכבה 3: Production
8. פתרון בעיות
9. תחזוקה שוטפת
10. שאלות נפוצות

**מתי לקרוא:**
- ✅ בפעם הראשונה (חלקים 1-5)
- ✅ כשיש שאלה או בעיה (חלק 8-10)
- ✅ כדי להבין את שכבות ההגנה (חלק 7)

---

#### 5. [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - **Husky ספציפי**
**מי צריך:** כדי להבין איך הhook עובד
**מה בפנים:**
- ✅ מה זה pre-commit hook (הגדרה)
- ✅ מה הותקן (Husky + lint-staged)
- ✅ איך זה עובד (דוגמאות מלאות)
- ✅ דוגמה מוצלחת
- ✅ דוגמה כושלת + מה לעשות
- ✅ איך לדלג (--no-verify)
- ✅ מה נבדק
- ✅ הגדרות מתקדמות
- ✅ שאלות נפוצות

**תוכן עניינים:**
1. מה זה Pre-commit Hook?
2. מה הותקן?
3. איך זה עובד? (דוגמה)
4. דוגמה מוצלחת ✅
5. דוגמה כושלת ❌
6. איך לדלג על הhook? (לא מומלץ)
7. מה הhook בודק?
8. הגדרות מתקדמות
9. שאלות נפוצות
10. תועלות (לפני vs אחרי)

**מתי לקרוא:**
- ✅ כשהcommit נחסם ולא ברור למה
- ✅ רוצה להבין מה הhook בודק בדיוק
- ✅ רוצה לשנות את ההגדרות

---

#### 6. [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - **CI/CD ספציפי**
**מי צריך:** כדי להבין איך GitHub Actions עובד
**מה בפנים:**
- ✅ מה זה GitHub Actions (הגדרה)
- ✅ מה הוגדר (.github/workflows/ci.yml)
- ✅ 6 Jobs במפורט
- ✅ איך זה עובד (תרחיש מלא)
- ✅ איך לקרוא תוצאות
- ✅ Branch Protection
- ✅ תרחישים נפוצים
- ✅ Coverage Reports
- ✅ שאלות נפוצות
- ✅ התאמה אישית

**תוכן עניינים:**
1. מה זה GitHub Actions?
2. מה הוגדר?
3. איך זה עובד? (תרחיש: יצירת PR)
4. פירוט 6 Jobs:
   - Job 1: Type Check
   - Job 2: Lint
   - Job 3: Test Frontend
   - Job 4: Test Functions
   - Job 5: Test Critical
   - Job 6: Build
5. הגנת Branch (Branch Protection Rules)
6. תרחישים נפוצים
7. Coverage Reports (Codecov)
8. שאלות נפוצות
9. התאמה אישית

**מתי לקרוא:**
- ✅ לפני יצירת Pull Request ראשון
- ✅ כשהPR נחסם ולא ברור למה
- ✅ רוצה להבין מה כל job בודק
- ✅ רוצה להוסיף job חדש

---

#### 7. [CRITICAL_CODE.md](CRITICAL_CODE.md) - **קוד מוגן**
**מי צריך:** לפני שינוי בקבצים קריטיים
**מה בפנים:**
- ✅ רשימת 3 קבצים קריטיים
- ✅ למה כל אחד קריטי
- ✅ Checklist חובה לפני שינוי
- ✅ דוגמאות לשינויים בטוחים/מסוכנים
- ✅ קישורים לטסטים

**תוכן עניינים:**
1. מה זה "קוד קריטי"?
2. הקבצים הקריטיים:
   - `functions/src/ai/prompts.ts`
   - `functions/src/streaming/streamingServer.ts`
   - `src/context/CourseContext.tsx`
3. לכל קובץ:
   - למה זה קריטי
   - Checklist לפני שינוי
   - דוגמאות בטוחות/מסוכנות
   - קישורים לטסטים
4. תהליך כללי
5. היסטוריית שינויים

**מתי לקרוא:**
- ✅ **חובה** לפני שינוי ב-`prompts.ts`
- ✅ **חובה** לפני שינוי ב-`streamingServer.ts`
- ✅ **חובה** לפני שינוי ב-`CourseContext.tsx`

---

## 🗺️ מפת נושאים

### נושא: "איך להריץ טסטים?"

| שאלה | איפה התשובה |
|------|-------------|
| איך להריץ טסט? | [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) - טבלת פקודות |
| מה המשמעות של התוצאה? | [TESTING_GUIDE.md](TESTING_GUIDE.md) - חלק 6: דוגמאות פלט |
| מה לעשות אם טסט נכשל? | [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) - "מה לעשות כש..." |

---

### נושא: "Pre-commit Hook"

| שאלה | איפה התשובה |
|------|-------------|
| מה זה pre-commit hook? | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - חלק 1 |
| למה הcommit שלי נחסם? | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - חלק 5: דוגמה כושלת |
| איך לדלג על הhook? | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - חלק 6 |
| מה הhook בודק? | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - חלק 7 |

---

### נושא: "GitHub Actions"

| שאלה | איפה התשובה |
|------|-------------|
| מה זה GitHub Actions? | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - חלק 1 |
| למה הPR שלי נחסם? | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - חלק 3: איך זה עובד |
| מה כל job בודק? | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - חלק 4: פירוט jobs |
| איך להוסיף job? | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - חלק 9: התאמה אישית |

---

### נושא: "קוד קריטי"

| שאלה | איפה התשובה |
|------|-------------|
| אילו קבצים קריטיים? | [CRITICAL_CODE.md](CRITICAL_CODE.md) - חלק 2 |
| מה לבדוק לפני שינוי? | [CRITICAL_CODE.md](CRITICAL_CODE.md) - Checklist לכל קובץ |
| איפה הטסטים לקובץ הזה? | [CRITICAL_CODE.md](CRITICAL_CODE.md) - קישורים לטסטים |

---

### נושא: "3 שכבות הגנה"

| שכבה | איפה מוסבר |
|------|-----------|
| **שכבה 1: Local** | [TESTING_GUIDE.md](TESTING_GUIDE.md) - חלק 7.1 |
| **שכבה 2: Pre-commit Hook** | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - המסמך כולו |
| **שכבה 3: GitHub Actions** | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - המסמך כולו |

---

## 📋 מסלול קריאה מומלץ

### יום 1 - ההתחלה (15 דקות)
1. ✅ [GETTING_STARTED.md](GETTING_STARTED.md) - 5 דקות
2. ✅ [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) - 2 דקות (הדפס!)
3. ✅ [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - 5 דקות
4. ✅ הרץ `npm test` לראות שעובד - 3 דקות

**מה למדת:** איפה אתה, מה יש, איך להריץ

---

### יום 2-3 - הבנה עמוקה (30 דקות)
1. ✅ [TESTING_GUIDE.md](TESTING_GUIDE.md) חלקים 1-7 - 30 דקות
   - שים לב במיוחד לחלק 7: **3 שכבות הגנה**

**מה למדת:** איך Testing עובד, מה זה מגן, 3 שכבות

---

### שבוע 2 - שכבות ההגנה (20 דקות)
1. ✅ [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - 10 דקות
2. ✅ [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - 10 דקות

**מה למדת:** איך Pre-commit Hook ו-GitHub Actions עובדים

---

### שבוע 3 - קוד קריטי (5 דקות)
1. ✅ [CRITICAL_CODE.md](CRITICAL_CODE.md) - 5 דקות

**מה למדת:** אילו קבצים דורשים זהירות יתר

---

## 🎯 מטריצת החלטות

### "אני רוצה להבין..."

| מה | מסמך | חלק |
|----|------|-----|
| **מה זה Testing בכלל** | TESTING_GUIDE.md | חלק 1: מבוא |
| **איך להריץ טסטים** | TESTING_QUICK_REFERENCE.md | טבלת פקודות |
| **מה זה Pre-commit Hook** | PRE_COMMIT_HOOKS.md | חלק 1 |
| **מה זה GitHub Actions** | GITHUB_ACTIONS.md | חלק 1 |
| **3 שכבות הגנה** | TESTING_GUIDE.md | חלק 7 |
| **מה התקנו** | SETUP_COMPLETE.md | כל המסמך |

### "יש לי בעיה..."

| בעיה | מסמך | חלק |
|------|------|-----|
| **טסט נכשל** | TESTING_QUICK_REFERENCE.md | "מה לעשות כש..." |
| **Commit נחסם** | PRE_COMMIT_HOOKS.md | חלק 5: דוגמה כושלת |
| **PR נחסם** | GITHUB_ACTIONS.md | חלק 6: תרחישים נפוצים |
| **Coverage נמוך** | TESTING_GUIDE.md | חלק 5: Coverage |

### "אני רוצה לשנות..."

| שינוי | מסמך | חלק |
|-------|------|-----|
| **קוד קריטי** | CRITICAL_CODE.md | Checklist לקובץ הספציפי |
| **הגדרות Hook** | PRE_COMMIT_HOOKS.md | חלק 8: הגדרות מתקדמות |
| **הגדרות Actions** | GITHUB_ACTIONS.md | חלק 9: התאמה אישית |

---

## ✅ Checklist - האם קראתי הכל?

```
□ GETTING_STARTED.md - הבנתי איפה אני
□ SETUP_COMPLETE.md - ראיתי מה הותקן
□ TESTING_QUICK_REFERENCE.md - הדפסתי ושמור ליד המחשב
□ TESTING_GUIDE.md חלקים 1-7 - הבנתי איך Testing עובד
□ PRE_COMMIT_HOOKS.md - הבנתי איך Hook עובד
□ GITHUB_ACTIONS.md - הבנתי איך Actions עובד
□ CRITICAL_CODE.md - יודע אילו קבצים זהירים
```

---

## 📞 עדיין לא ברור?

### מצא את התשובה:

1. **חפש במפת נושאים** (למעלה) - התשובה כנראה שם
2. **בדוק בחלק "מה אם..."** במסמך הרלוונטי
3. **קרא את השאלות הנפוצות** במסמך הרלוונטי
4. **שאל את הצוות**

---

**עדכון אחרון:** 2026-01-25
**גרסה:** 1.1

**💡 טיפ:** שמור את המסמך הזה כסימניה - זה המפתח לכל התיעוד!
