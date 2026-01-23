# 📚 תיקיית Documentation - AI-LMS System

ברוכים הבאים לתיקיית התיעוד של מערכת AI-LMS!

---

## 📖 מסמכים זמינים

### 1. [TESTING_GUIDE.md](TESTING_GUIDE.md) - **המדריך המלא** 📘

**לקריאה מלאה ומעמיקה** (30 דקות)

מכיל:
- ✅ הסבר מפורט על כל כלי Testing
- ✅ דוגמאות פלט מלאות
- ✅ תהליך עבודה יומי
- ✅ פתרון בעיות
- ✅ 3 שכבות ההגנה
- ✅ שאלות נפוצות

**מתי לקרוא:**
- בפעם הראשונה שמתחילים לעבוד עם Testing
- כשיש שאלה או בעיה
- כהדרכה למפתחים חדשים בצוות

---

### 2. [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) - **דף עזר מהיר** ⚡

**לשימוש יומי** (2 דקות)

מכיל:
- ✅ טבלת פקודות מהירה
- ✅ תהליך עבודה קצר
- ✅ פתרון בעיות מהיר
- ✅ הכלל הזהב

**מתי להשתמש:**
- כל יום לפני commit
- כשצריך לזכור פקודה
- כדף רמאות ליד המחשב (תדפיס!)

---

### 3. [CRITICAL_CODE.md](CRITICAL_CODE.md) - **רשימת קוד מוגן** 🔒

**לפני שמשנים קוד קריטי**

מכיל:
- ✅ רשימת כל הקבצים הקריטיים
- ✅ למה כל קובץ מוגן
- ✅ Checklist לפני שינוי
- ✅ קישורים לטסטים הרלוונטיים
- ✅ היסטוריית שינויים

**מתי לקרוא:**
- לפני שמשנים משהו ב-`prompts.ts`
- לפני שמשנים משהו ב-`streamingServer.ts`
- לפני שמשנים משהו ב-`CourseContext.tsx`

*(מסמך זה ייווצר בהמשך)*

---

## 🎯 איפה להתחיל?

### אם אתה חדש במערכת:
1. קרא [TESTING_GUIDE.md](TESTING_GUIDE.md) - המדריך המלא
2. שמור [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) פתוח
3. נסה להריץ `npm test` בפעם הראשונה

### אם אתה מפתח ותיק:
- השתמש ב-[TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) יום-יום
- חזור ל-[TESTING_GUIDE.md](TESTING_GUIDE.md) כשיש שאלות

---

## 📂 מבנה התיקייה

```
docs/
├── README.md                       ← אתה נמצא כאן!
├── TESTING_GUIDE.md               ← המדריך המלא (30 דק' קריאה)
├── TESTING_QUICK_REFERENCE.md     ← דף עזר (2 דק')
├── CRITICAL_CODE.md               ← (ייווצר בקרוב)
├── STREAMING_ARCHITECTURE.md      ← (קיים) ארכיטקטורת Streaming
└── CURRICULUM_AGENT.md            ← (קיים) תיעוד Curriculum Agent
```

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

אם משהו לא ברור או חסר במסמכים:
1. בדוק קודם ב-[TESTING_GUIDE.md](TESTING_GUIDE.md) - סביר שהתשובה שם
2. חפש בקובץ (Ctrl+F)
3. שאל את הצוות

---

**עדכון אחרון:** 2026-01-23
**גרסה:** 1.0
