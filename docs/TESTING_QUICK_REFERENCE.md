# ⚡ דף עזר מהיר - פקודות Testing

**הדפס אותי ושמור ליד המחשב!**

---

## 📋 פקודות יומיות

| פקודה | מה זה עושה | מתי להשתמש |
|-------|------------|------------|
| `npm test` | רץ כל הטסטים | ✅ **לפני כל commit** |
| `npm run test:watch` | רץ בצורה מתמשכת | בזמן פיתוח |
| `npm run test:coverage` | הצג דוח כיסוי | לפני PR |
| `npm run test:critical` | רק טסטים קריטיים | כשממהרים |
| `npm run type-check` | בדוק TypeScript | לפני commit |
| `npm run lint` | בדוק איכות קוד | לפני commit |
| `npm run lint:fix` | תקן אוטומטית | אחרי lint נכשל |
| `npm run validate` | **הכל ביחד!** | ✅ **לפני PR חשוב** |

---

## 🚦 איך לקרוא תוצאות

### ✅ הצלחה
```
PASS functions/src/ai/__tests__/prompts.test.ts
  ✓ test 1 (3ms)
  ✓ test 2 (2ms)

Tests: 28 passed, 28 total
```
**→ מעולה! אפשר לעשות commit**

### ❌ כישלון
```
FAIL functions/src/ai/__tests__/prompts.test.ts
  ✕ test name (12ms)

    Expected: "Hello"
    Received: "Hi"

Tests: 1 failed, 27 passed, 28 total
```
**→ תקן את הקוד, הרץ שוב**

### ⚠️ אזהרה
```
Coverage: prompts.ts - 67% (threshold: 85%)
```
**→ צריך עוד טסטים לקובץ הזה**

---

## 🔄 תהליך עבודה מהיר

```bash
# 1. עשה שינוי בקוד
# (עורך קובץ ב-VSCode)

# 2. בדוק שעובד (אופציונלי)
npm test

# 3. commit
git add .
git commit -m "הודעה"

# 🤖 Pre-commit Hook רץ אוטומטית:
#   [STARTED] Running tasks for staged files...
#   [STARTED] npx jest --bail --findRelatedTests
#   [COMPLETED] Tests passed!
#
# ✅ Commit מצליח → עובר לשלב 4
# ❌ Commit נחסם → חזור לשלב 1, תקן ונסה שוב

# 4. push (רק אם commit עבר)
git push
```

**🎯 חשוב:** ה-hook מריץ **רק טסטים על הקבצים ששונו** - זה מהיר!

---

## 🛑 מה לעשות כש...

### ...טסט נכשל
1. קרא את השגיאה
2. לחץ על מספר השורה
3. תקן את הקוד
4. `npm test` שוב

### ...commit נחסם
```bash
> pre-commit hook failed

# 1. קרא מה נכשל
# 2. תקן
# 3. נסה commit שוב
```

### ...coverage נמוך
```bash
npm run test:coverage
# רשום אילו שורות חסרות
# כתוב טסט שמכסה אותן
```

---

## 📊 מטרות Coverage

| קובץ | מטרה | קריטיות |
|------|------|---------|
| `prompts.ts` | 85%+ | 🔴 CRITICAL |
| `streamingServer.ts` | 80%+ | 🔴 CRITICAL |
| `CourseContext.tsx` | 70%+ | 🟡 HIGH |
| שאר הקבצים | 60%+ | 🟢 NORMAL |

---

## 🆘 פתרון בעיות מהיר

| שגיאה | פתרון |
|-------|--------|
| `No tests found` | בדוק שאתה בתיקייה הנכונה |
| `Preset ts-jest not found` | `npm install --save-dev ts-jest` |
| `Type error` | `npm run type-check` לראות מה |
| `Lint failed` | `npm run lint:fix` |

---

## 📍 איפה הקבצים

```
ai-lms-system/
├── jest.config.js          ← תצורת Jest (root)
├── package.json            ← כל הסקריפטים
├── docs/
│   ├── TESTING_GUIDE.md   ← המדריך המלא
│   └── TESTING_QUICK_REFERENCE.md ← אני!
└── functions/
    ├── jest.config.js      ← תצורת Jest (functions)
    └── src/
        └── ai/
            ├── prompts.ts           ← קוד ייצור
            └── __tests__/
                └── prompts.test.ts  ← טסטים
```

---

## 💡 טיפים

✅ **תמיד** הרץ `npm test` לפני commit
✅ אם טסט נכשל - **תקן אותו**, אל תדלג
✅ `npm run validate` לפני PR חשוב
✅ שמור את הדף הזה פתוח בצד!

❌ **אל** תעשה `git commit --no-verify`
❌ **אל** תמחק טסטים רק כדי שיעברו
❌ **אל** תתעלם מ-coverage נמוך

---

## 🎯 הכלל הזהב

> **"אין commit בלי tests!"**

5 שניות של `npm test` = שעות של דיבוג נחסכות

---

**📞 שכחת משהו?** קרא את [TESTING_GUIDE.md](TESTING_GUIDE.md)

**גרסה:** 1.0 | **תאריך:** 2026-01-23
