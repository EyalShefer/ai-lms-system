# 📚 תיקיית Documentation - AI-LMS System

ברוכים הבאים לתיקיית התיעוד של מערכת AI-LMS!

---

## 🗺️ מפת ניווט

**לא יודע איזה מסמך לקרוא?** ← **[INDEX.md](INDEX.md)** - מפת ניווט מלאה! ⭐

המסמך INDEX מכיל:
- ✅ טבלת "אני רוצה..." → איזה מסמך
- ✅ מפת נושאים מפורטת
- ✅ מסלול קריאה מומלץ
- ✅ מטריצת החלטות

**💡 המלצה:** התחל ב-[INDEX.md](INDEX.md) כדי להבין איפה למצוא כל דבר!

---

## 📖 מסמכים לפי סוג

### 🎓 למידה והתחלה

#### [GETTING_STARTED.md](GETTING_STARTED.md) - מדריך התחלה (5 דק')
**למי:** מפתח חדש במערכת
**מה בפנים:** 5 צעדים ראשונים, Checklist, טיפים

#### [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - סיכום התקנה (5 דק')
**למי:** כולם - לראות מה הותקן
**מה בפנים:** תשתית, Pre-commit, GitHub Actions, 3 שכבות

---

### 🛠️ שימוש יומי

#### [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) - דף עזר (2 דק')
**למי:** כולם - כל יום
**מה בפנים:** טבלת פקודות, תהליך עבודה, פתרון בעיות
**💡 הדפס ושמור ליד המחשב!**

---

### 📖 מדריכים מקיפים

#### [TESTING_GUIDE.md](TESTING_GUIDE.md) - המדריך המלא (30 דק')
**למי:** למידה מעמיקה, פתרון בעיות
**מה בפנים:** הסבר מפורט, דוגמאות פלט, 3 שכבות הגנה, שאלות נפוצות
**חלק חשוב:** חלק 7 - 3 שכבות ההגנה

#### [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - Husky ספציפי (10 דק')
**למי:** כדי להבין Pre-commit Hook
**מה בפנים:** מה זה Hook, איך עובד, דוגמאות מוצלח/כושל, הגדרות
**קרא אם:** Commit נחסם ולא ברור למה

#### [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) - CI/CD ספציפי (10 דק')
**למי:** כדי להבין GitHub Actions
**מה בפנים:** מה זה Actions, 6 Jobs במפורט, Branch Protection, פתרון בעיות
**קרא אם:** PR נחסם ולא ברור למה

#### [CRITICAL_CODE.md](CRITICAL_CODE.md) - קוד מוגן (5 דק')
**למי:** לפני שינוי בקבצים קריטיים
**מה בפנים:** 3 קבצים קריטיים, Checklist חובה, דוגמאות בטוחות/מסוכנות
**קרא לפני:** שינוי ב-`prompts.ts`, `streamingServer.ts`, `CourseContext.tsx`

---

## 🎯 איפה להתחיל?

### ⭐ התחלה מהירה (מומלץ)
1. **[INDEX.md](INDEX.md)** - מפת ניווט (2 דק') ← **התחל כאן!**
2. **[GETTING_STARTED.md](GETTING_STARTED.md)** - 5 צעדים ראשונים (5 דק')
3. **[TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md)** - הדפס ושמור (2 דק')

### אם אתה חדש במערכת:
**מסלול מלא (50 דקות):**
1. [INDEX.md](INDEX.md) - 2 דק'
2. [GETTING_STARTED.md](GETTING_STARTED.md) - 5 דק'
3. [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - 5 דק'
4. [TESTING_GUIDE.md](TESTING_GUIDE.md) חלקים 1-7 - 30 דק'
5. [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - 10 דק' (אופציונלי)

### אם אתה מפתח ותיק:
- **יומי:** [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md)
- **שאלות:** [INDEX.md](INDEX.md) → חפש בטבלה
- **בעיות:** [TESTING_GUIDE.md](TESTING_GUIDE.md) - פתרון בעיות

---

## 📂 מבנה התיקייה

```
docs/
├── README.md                       ← אתה נמצא כאן!
├── INDEX.md                        ← ⭐ מפת ניווט מלאה (התחל כאן!)
│
├── GETTING_STARTED.md             ← 🎓 מדריך התחלה (5 דק')
├── SETUP_COMPLETE.md              ← 🎓 סיכום התקנה (5 דק')
│
├── TESTING_QUICK_REFERENCE.md     ← 🛠️ דף עזר יומי (2 דק') [הדפס!]
│
├── TESTING_GUIDE.md               ← 📖 המדריך המלא (30 דק')
├── PRE_COMMIT_HOOKS.md            ← 📖 Husky ספציפי (10 דק')
├── GITHUB_ACTIONS.md              ← 📖 CI/CD ספציפי (10 דק')
├── CRITICAL_CODE.md               ← 📖 קוד מוגן (5 דק')
│
├── STREAMING_ARCHITECTURE.md      ← 🏗️ ארכיטקטורה
└── CURRICULUM_AGENT.md            ← 🏗️ Curriculum Agent
```

**מקרא:**
- ⭐ = **התחל כאן** - מפת ניווט
- 🎓 = למידה והתחלה
- 🛠️ = שימוש יומי
- 📖 = מדריכים מקיפים
- 🏗️ = ארכיטקטורה

---

## 🔍 חיפוש מהיר

**"אני רוצה..."**

| מה אני רוצה | איזה מסמך | זמן |
|-------------|-----------|------|
| **למצוא איזה מסמך לקרוא** | [INDEX.md](INDEX.md) ⭐ | 2 דק' |
| **להתחיל מאפס** | [GETTING_STARTED.md](GETTING_STARTED.md) | 5 דק' |
| **לראות מה הותקן** | [SETUP_COMPLETE.md](SETUP_COMPLETE.md) | 5 דק' |
| **פקודות מהירות** | [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) | 2 דק' |
| **להבין Testing** | [TESTING_GUIDE.md](TESTING_GUIDE.md) | 30 דק' |
| **להבין Pre-commit Hook** | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) | 10 דק' |
| **להבין GitHub Actions** | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) | 10 דק' |
| **לשנות קוד קריטי** | [CRITICAL_CODE.md](CRITICAL_CODE.md) | 5 דק' |

**"יש לי בעיה..."**

| בעיה | איזה מסמך | חלק |
|------|-----------|-----|
| **טסט נכשל** | [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) | "מה לעשות כש..." |
| **Commit נחסם** | [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) | דוגמה כושלת |
| **PR נחסם** | [GITHUB_ACTIONS.md](GITHUB_ACTIONS.md) | תרחישים נפוצים |
| **לא יודע איפה למצוא** | [INDEX.md](INDEX.md) ⭐ | מפת נושאים |

---

## 🔗 קישורים שימושיים

### תיעוד חיצוני:
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### קבצים חשובים בפרויקט:
- [jest.config.js](../jest.config.js) - תצורת Jest (root)
- [functions/jest.config.js](../functions/jest.config.js) - תצורת Jest (functions)
- [package.json](../package.json) - כל הסקריפטים

---

## 💡 טיפ

**תדפיס את [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) ותשמור ליד המחשב!**

זה ייחסוך לך זמן כל יום.

---

## 📞 צריך עזרה?

### מצא תשובה במהירות:
1. **[INDEX.md](INDEX.md)** ⭐ - חפש בטבלת "אני רוצה..." או במפת נושאים
2. **[TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md)** - בעיות נפוצות
3. **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - פתרון בעיות + שאלות נפוצות
4. **חפש בקובץ** (Ctrl+F) - לפי מילת מפתח
5. **שאל את הצוות** - אם לא מצאת תשובה

---

**עדכון אחרון:** 2026-01-23
**גרסה:** 1.0
