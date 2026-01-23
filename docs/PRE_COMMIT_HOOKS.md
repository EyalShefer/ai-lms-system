# 🪝 Pre-commit Hooks - הגנה אוטומטית לפני Commit

**סטטוס:** ✅ **מותקן ופעיל!**
**תאריך התקנה:** 2026-01-23

---

## 🎯 מה זה Pre-commit Hook?

זו **בדיקה אוטומטית** שרצה **לפני כל commit**.

```
אתה:  git commit -m "update"
           ↓
🤖 Hook:  רץ טסטים על הקבצים ששונו
           ↓
     ✅ עבר → Commit מצליח!
     ✗ נכשל → Commit נחסם!
```

---

## 🛠️ מה הותקן?

### 1. **Husky** - מנהל Git Hooks
```bash
# התיקייה:
.husky/
├── _/
└── pre-commit    ← הקובץ שרץ לפני commit
```

### 2. **lint-staged** - בודק רק קבצים ששונו
מוגדר ב-`package.json`:
```json
"lint-staged": {
  "*.{ts,tsx}": [
    "npx jest --bail --findRelatedTests --passWithNoTests"
  ]
}
```

**מה זה אומר:**
- `*.{ts,tsx}` = כל קובץ TypeScript/TSX שנשנה
- `--findRelatedTests` = מצא טסטים רלוונטיים לקובץ
- `--bail` = עצור בטסט הראשון שנכשל
- `--passWithNoTests` = אם אין טסטים, עבור

---

## 🎬 איך זה עובד? (דוגמה)

### תרחיש: אתה משנה את `CourseEditor.tsx`

```bash
# 1. אתה משנה קוד
code src/components/CourseEditor.tsx

# 2. אתה מוסיף לgit
git add src/components/CourseEditor.tsx

# 3. אתה מנסה לעשות commit
git commit -m "fix: update course editor"

# 🤖 Husky מתעורר!
```

**מה קורה מאחורי הקלעים:**

```
[STARTED] Backing up original state...
[COMPLETED] Backed up original state in git stash (abc1234)

[STARTED] Hiding unstaged changes to partially staged files...
[COMPLETED] Hiding unstaged changes...

[STARTED] Running tasks for staged files...
[STARTED] *.{ts,tsx} — 1 file
[STARTED] npx jest --bail --findRelatedTests --passWithNoTests

# Jest בודק:
# 1. מצא טסט: src/components/__tests__/CourseEditor.test.tsx
# 2. רץ את הטסט
# 3. התוצאה: ✓ passed

[COMPLETED] npx jest --bail --findRelatedTests --passWithNoTests
[COMPLETED] Running tasks for staged files...

[STARTED] Applying modifications from tasks...
[COMPLETED] Applying modifications from tasks...

[STARTED] Restoring unstaged changes...
[COMPLETED] Restoring unstaged changes...

[STARTED] Cleaning up temporary files...
[COMPLETED] Cleaning up temporary files...

# ✅ הכל עבר!
[main f7e8a9b] fix: update course editor
 1 file changed, 15 insertions(+), 5 deletions(-)
```

**זמן ריצה:** 2-5 שניות (תלוי בכמות הקבצים)

---

## ✅ דוגמה מוצלחת

```bash
$ git commit -m "fix: improve validation"

[STARTED] Running tasks for staged files...
[STARTED] *.{ts,tsx} — 2 files
[STARTED] npx jest --bail --findRelatedTests --passWithNoTests
[COMPLETED] All tests passed!

[main 7a8b9c0] fix: improve validation
 2 files changed, 20 insertions(+), 8 deletions(-)
```

✅ **ה-commit עבר בהצלחה!**

---

## ❌ דוגמה כושלת

```bash
$ git commit -m "fix: add new feature"

[STARTED] Running tasks for staged files...
[STARTED] *.{ts,tsx} — 1 file
[STARTED] npx jest --bail --findRelatedTests --passWithNoTests
[FAILED] npx jest --bail --findRelatedTests --passWithNoTests

✖ npx jest --bail --findRelatedTests --passWithNoTests:

FAIL functions/src/ai/__tests__/prompts.test.ts
  ● getSkeletonPrompt › should include all required sections

    expect(received).toContain(expected)

    Expected substring: "BLOOM TAXONOMY"
    Received string: "Skeleton prompt without BLOOM..."

      at Object.<anonymous> (prompts.test.ts:42:25)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 27 passed, 28 total

husky - pre-commit script failed (code 1)
```

❌ **ה-commit נחסם!**

**מה לעשות:**
1. קרא את שגיאת הטסט
2. תקן את הקוד
3. הרץ `npm test` כדי לוודא שהתיקון עבד
4. נסה commit שוב

---

## 🚫 איך לדלג על ה-Hook? (לא מומלץ!)

אם **באמת** צריך לעשות commit בלי הבדיקה:

```bash
git commit -m "update" --no-verify
```

⚠️ **אזהרה:**
- זה עוקף את כל הבדיקות!
- השתמש רק במקרי חירום
- הטסטים עדיין יכשלו ב-GitHub Actions

**מתי אפשר להשתמש:**
- ✅ Commit דוקומנטציה בלבד (*.md)
- ✅ תיקון דחוף בייצור (hotfix)
- ❌ **לא** כשיש טסט שנכשל!

---

## 📊 מה ה-Hook בודק?

| מה נבדק | כן ✓ | לא ✗ |
|---------|------|------|
| קבצים ששונו בcommit | ✓ | |
| כל הקבצים בפרויקט | | ✗ |
| טסטים רלוונטיים בלבד | ✓ | |
| כל הטסטים במערכת | | ✗ |
| TypeScript compilation | | ✗ * |
| ESLint | | ✗ * |

\* כרגע ה-hook מריץ רק טסטים. אפשר להוסיף בעתיד.

---

## 🔧 הגדרות מתקדמות

### להוסיף בדיקות נוספות

ערוך את `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": [
    "npm run type-check",           // הוסף type check
    "npm run lint -- --max-warnings=0",  // הוסף lint
    "npx jest --bail --findRelatedTests --passWithNoTests"
  ]
}
```

### לבדוק רק טסטים קריטיים

```json
"lint-staged": {
  "functions/src/ai/**/*.ts": [
    "npm run test:critical"
  ],
  "*.{ts,tsx}": [
    "npx jest --bail --findRelatedTests --passWithNoTests"
  ]
}
```

### להשבית זמנית

```bash
# מחק או שנה שם את .husky/pre-commit
mv .husky/pre-commit .husky/pre-commit.disabled

# לאפשר שוב:
mv .husky/pre-commit.disabled .husky/pre-commit
```

---

## ❓ שאלות נפוצות

### ש: למה זה לוקח זמן?
**ת:** זה מריץ טסטים אמיתיים! אבל:
- רק על הקבצים ששינית
- בדרך כלל 2-10 שניות
- הרבה יותר מהיר מלגלות באג אחר כך

### ש: האם זה מריץ טסטים על כל הפרויקט?
**ת:** לא! רק על:
- הקבצים שהוספת ל-staging (`git add`)
- הטסטים הרלוונטיים לקבצים האלה

### ש: מה אם אני משנה רק README?
**ת:** ה-hook לא ירוץ כי `*.md` לא מוגדר ב-`lint-staged`

### ש: מה אם אני רוצה לעשות commit חלקי?
**ת:** זה עובד! ה-hook בודק רק את הקבצים ב-staging area

```bash
git add file1.ts
git commit -m "part 1"  # בודק רק file1.ts

git add file2.ts
git commit -m "part 2"  # בודק רק file2.ts
```

### ש: האם זה מונע ממני לעבוד?
**ת:** להיפך! זה מונע מכולם:
- לעשות commit של קוד שבור
- לגלות באגים 3 שעות אחרי ה-commit
- לבזבז זמן על דיבוג בייצור

---

## 🎯 תועלות

### לפני Pre-commit Hooks:
```
1. כותב קוד
2. git commit
3. git push
4. 💥 הטסטים נכשלים ב-CI
5. תקן
6. commit שוב
7. push שוב
8. ⏰ 10 דקות אבודות
```

### אחרי Pre-commit Hooks:
```
1. כותב קוד
2. git commit
3. 🤖 Hook מוצא את הבעיה מיד! (5 שניות)
4. תקן
5. commit שוב ✓
6. push ✓
7. ⏰ 5 שניות בלבד!
```

---

## 📈 סטטיסטיקות

מאז ההתקנה:
```
✅ Commits שעברו: [מעקב ידני]
❌ Commits שנחסמו: [מעקב ידני]
⏰ זמן ממוצע: 2-5 שניות
💡 באגים שנמנעו: ???
```

*(תעדכן לאורך זמן)*

---

## 🔗 קישורים

### תיעוד פנימי:
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - מידע מפורט על שכבות ההגנה
- [TESTING_QUICK_REFERENCE.md](TESTING_QUICK_REFERENCE.md) - תהליך עבודה יומי
- [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - מה הותקן במערכת

### תיעוד חיצוני:
- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)

---

## 📝 סיכום

✅ **Pre-commit Hooks מותקן ופעיל!**

```
איך זה עובד:
  git commit → 🤖 Hook → בדיקה → ✓/✗ → Commit/חסימה

מה זה בודק:
  - טסטים על הקבצים ששונו
  - רק אם הוספת קבצים ל-staging

למה זה חשוב:
  - מונע commit של קוד שבור
  - מהיר (2-5 שניות)
  - חוסך זמן בטווח הארוך
```

**הכלל הזהב:**
> "Pre-commit hook הוא החבר הכי טוב שלך - הוא מגן עליך מעצמך!"

---

**עדכון אחרון:** 2026-01-23
**גרסה:** 1.0
**סטטוס:** ✅ פעיל ועובד
