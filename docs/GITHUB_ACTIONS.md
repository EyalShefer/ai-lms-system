# 🤖 GitHub Actions - CI/CD אוטומטי

**סטטוס:** ✅ **מוגדר ומוכן!**
**תאריך הגדרה:** 2026-01-23

---

## 🎯 מה זה GitHub Actions?

זו **מערכת CI/CD** שרצה **אוטומטית בענן** כל פעם שיש:
- 🔄 Push ל-branch main
- 🔀 Pull Request חדש
- ⚙️ הרצה ידנית (workflow_dispatch)

```
אתה:  git push origin feature-branch
      פותח Pull Request ב-GitHub
           ↓
🤖 GitHub Actions:
      ✓ Type Check (2 דקות)
      ✓ Lint (1 דקה)
      ✓ Frontend Tests (3 דקות)
      ✓ Functions Tests (4 דקות)
      ✓ Critical Tests (2 דקות)
      ✓ Build (3 דקות)
           ↓
      ✅ כפתור Merge פתוח!
      ❌ או חסום אם נכשל
```

---

## 🛠️ מה הוגדר?

### קובץ Workflow
```
.github/
└── workflows/
    └── ci.yml    ← הקובץ שמגדיר את כל הבדיקות
```

### 6 Jobs שרצים במקביל

| Job # | שם | מה זה בודק | זמן |
|-------|-----|------------|------|
| 1️⃣ | **type-check** | שגיאות TypeScript | ~2 דק' |
| 2️⃣ | **lint** | איכות קוד (ESLint) | ~1 דק' |
| 3️⃣ | **test-frontend** | טסטים Frontend + Coverage | ~3 דק' |
| 4️⃣ | **test-functions** | טסטים Backend + Coverage | ~4 דק' |
| 5️⃣ | **test-critical** | קוד קריטי (חייב לעבור!) | ~2 דק' |
| 6️⃣ | **build** | Build Frontend + Functions | ~3 דק' |

**סה"כ זמן:** ~5-7 דקות (רצים במקביל!)

---

## 🎬 איך זה עובד?

### תרחיש: יצרת feature חדש ורוצה לעשות Pull Request

#### שלב 1: Push הקוד
```bash
git checkout -b feature/new-validation
# עושה שינויים...
git add .
git commit -m "feat: add new validation"
git push origin feature/new-validation
```

#### שלב 2: פתיחת Pull Request
```
1. עבור ל-GitHub.com → הrepo שלך
2. לחץ "Compare & pull request"
3. כתוב תיאור
4. לחץ "Create pull request"
```

#### שלב 3: GitHub Actions מתחיל לרוץ אוטומטית! 🤖

בעמוד ה-PR תראה:

```
Checks — 7 total

Required checks:
  ⏳ type-check / TypeScript Type Check — In progress (1m 23s)
  ⏳ lint / ESLint Code Quality — In progress (45s)
  ⏳ test-frontend / Frontend Tests — In progress (2m 05s)
  ⏳ test-functions / Firebase Functions Tests — In progress (2m 30s)
  ⏳ test-critical / Critical Code Tests — In progress (1m 10s)
  ⏳ build / Build Check — In progress (2m 15s)
  ⏳ all-checks-passed / All Checks Passed ✓ — Waiting
```

#### שלב 4: תוצאות

**מוצלח ✅:**
```
Checks — 7 total

All checks have passed

  ✓ type-check / TypeScript Type Check (2m 15s)
  ✓ lint / ESLint Code Quality (1m 42s)
  ✓ test-frontend / Frontend Tests (3m 08s)
  ✓ test-functions / Firebase Functions Tests (4m 21s)
  ✓ test-critical / Critical Code Tests (2m 05s)
  ✓ build / Build Check (2m 55s)
  ✓ all-checks-passed / All Checks Passed ✓ (5s)

[Merge pull request] 🟢 כפתור ירוק זמין
```

**נכשל ❌:**
```
Checks — 7 total

Some checks were not successful

  ✓ type-check / TypeScript Type Check (2m 15s)
  ✓ lint / ESLint Code Quality (1m 42s)
  ✗ test-frontend / Frontend Tests (3m 08s) — Details
  ✓ test-functions / Firebase Functions Tests (4m 21s)
  ✓ test-critical / Critical Code Tests (2m 05s)
  ✓ build / Build Check (2m 55s)
  ✗ all-checks-passed / All Checks Passed ✓ (5s)

[Merge pull request] 🔴 כפתור חסום
```

לחץ על "Details" כדי לראות מה נכשל.

---

## 📊 פירוט Jobs

### 1️⃣ Type Check

**מה זה בודק:**
- שגיאות TypeScript
- טיפוסים לא תואמים
- משתנים לא מוגדרים

**פקודה:**
```bash
npm run type-check
```

**דוגמה לשגיאה:**
```
error TS2322: Type 'string' is not assignable to type 'number'.
  prompts.ts(45,3): The expected type comes from property 'count'
```

---

### 2️⃣ Lint

**מה זה בודק:**
- איכות קוד
- עקביות סטייל
- best practices

**פקודה:**
```bash
npm run lint
```

**דוגמה לשגיאה:**
```
error: Unexpected any. Specify a different type
  prompts.ts:67:15
```

---

### 3️⃣ Test Frontend

**מה זה בודק:**
- כל הטסטים ב-`src/`
- מריץ עם coverage
- מעלה דוח ל-Codecov (אופציונלי)

**פקודה:**
```bash
npm run test:coverage
```

**דוגמה לפלט:**
```
Test Suites: 3 passed, 3 total
Tests:       45 passed, 45 total
Snapshots:   5 passed, 5 total
Time:        12.345 s

Coverage:
  Statements   : 72% (150/208)
  Branches     : 65% (45/69)
  Functions    : 70% (28/40)
  Lines        : 72% (145/201)
```

---

### 4️⃣ Test Functions

**מה זה בודק:**
- כל הטסטים ב-`functions/src/`
- מריץ עם coverage
- בודק Backend logic

**פקודה:**
```bash
cd functions
npm run test:coverage
```

**קבצים חשובים:**
- `functions/src/ai/__tests__/prompts.test.ts`
- (עוד טסטים בעתיד)

---

### 5️⃣ Test Critical

**מה זה בודק:**
- **רק** הקוד הקריטי ביותר:
  - `prompts.ts`
  - `streamingServer.ts`
  - `CourseContext.tsx`

**למה נפרד?**
- כי זה **חייב** לעבור!
- אם זה נכשל, אסור לעשות merge

**פקודות:**
```bash
cd functions && npm run test:critical
npm run test:critical
```

---

### 6️⃣ Build

**מה זה בודק:**
- Frontend build עובד
- Functions build עובד
- אין שגיאות compilation

**פקודות:**
```bash
npm run build
cd functions && npm run build
```

---

## 🔒 הגנת Branch

### להוסיף Branch Protection Rules

1. עבור ל-GitHub → Settings → Branches
2. לחץ "Add rule"
3. Branch name pattern: `main`
4. סמן:
   - ✅ **Require status checks to pass before merging**
     - ✅ `type-check`
     - ✅ `lint`
     - ✅ `test-frontend`
     - ✅ `test-functions`
     - ✅ `test-critical`
     - ✅ `build`
   - ✅ **Require branches to be up to date before merging**
5. לחץ "Create"

**תוצאה:**
- ❌ אי אפשר לעשות merge אם יש שגיאות
- ❌ אי אפשר לעשות push ישירות ל-main
- ✅ חייבים לעבור דרך Pull Request

---

## 🎯 תרחישים נפוצים

### תרחיש 1: "הטסטים עברו local אבל נכשלים ב-CI"

**סיבות אפשריות:**
1. **גרסאות שונות של Node.js**
   - Local: Node 20
   - CI: Node 22
   - **פתרון:** השתמש באותה גרסה

2. **קבצים לא נוספו ל-git**
   - הקובץ קיים local אבל לא ב-repo
   - **פתרון:** `git add` את כל הקבצים

3. **Environment variables חסרים**
   - Local יש `.env`, CI לא
   - **פתרון:** הוסף secrets ב-GitHub

4. **בדיקות רצות מספר פעמים**
   - Jest cache בעיות
   - **פתרון:** נקה cache

---

### תרחיש 2: "רוצה לרוץ workflow ידנית"

```
1. עבור ל-GitHub → Actions tab
2. בחר workflow: "CI - Tests and Validation"
3. לחץ "Run workflow"
4. בחר branch
5. לחץ "Run workflow" (ירוק)
```

---

### תרחיש 3: "Job נכשל - איך לראות לוג מפורט?"

```
1. עבור ל-Pull Request
2. לחץ "Checks" (למעלה)
3. בחר את ה-job שנכשל
4. לחץ על השלב שנכשל
5. ראה את הלוג המלא
```

**דוגמה:**
```
Run npm run test:critical
  cd functions
  npm run test:critical

FAIL src/ai/__tests__/prompts.test.ts
  ● getSkeletonPrompt › should include BLOOM

    expect(received).toContain(expected)

    Expected substring: "BLOOM TAXONOMY"
    Received string: "Skeleton prompt..."

      at Object.<anonymous> (prompts.test.ts:42:25)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 27 passed, 28 total
Error: Process completed with exit code 1.
```

---

## 📈 Coverage Reports

### מה זה Coverage?

אחוז הקוד שמכוסה בטסטים:

```
Coverage Summary:
  Statements   : 72% (150/208)   ← 150 מתוך 208 שורות נבדקות
  Branches     : 65% (45/69)     ← 45 מתוך 69 תנאים נבדקים
  Functions    : 70% (28/40)     ← 28 מתוך 40 פונקציות נבדקות
  Lines        : 72% (145/201)   ← 145 מתוך 201 שורות נבדקות
```

### Codecov Integration (אופציונלי)

אם תרצה דוחות מפורטים:

1. הירשם ל-[Codecov](https://codecov.io)
2. חבר את הrepo
3. הוסף `CODECOV_TOKEN` ל-GitHub Secrets
4. ה-workflow כבר מוגדר לעבוד עם Codecov

**מה זה נותן:**
- 📊 גרפים של coverage לאורך זמן
- 🔍 ראיית שורות שלא מכוסות
- 💬 תגובות אוטומטיות על PRs עם שינויי coverage

---

## ❓ שאלות נפוצות

### ש: למה זה לוקח כל כך הרבה זמן?
**ת:** 5-7 דקות זה תקין! זה מריץ:
- טסטים על כל הפרויקט
- Build שלם
- Type check על כל הקבצים
- בענן (לא המחשב שלך)

### ש: האם זה עולה כסף?
**ת:**
- Repos פומביים: **חינם ללא הגבלה** ✅
- Repos פרטיים: **2000 דקות חינם בחודש** ✅
- אם עוברים: ~$0.008 לדקה

**החישוב:**
- PR ממוצע: 7 דקות
- 100 PRs בחודש = 700 דקות
- **בטווח החינמי!** ✅

### ש: אפשר לדלג על בדיקה מסוימת?
**ת:** כן, אבל לא מומלץ:
```yaml
# ערוך .github/workflows/ci.yml
# הוסף if: false לjob
test-frontend:
  if: false  # ← ידלג על זה
  name: Frontend Tests
  ...
```

### ש: איך לעדכן את ה-workflow?
**ת:**
1. ערוך `.github/workflows/ci.yml`
2. Commit + Push
3. ה-workflow החדש ירוץ באוטומט

### ש: מה קורה אם שכחתי להגדיר Branch Protection?
**ת:** אפשר עדיין לעשות merge גם עם שגיאות.
**פתרון:** הגדר Branch Protection (ראה למעלה)

---

## 🔧 התאמה אישית

### להוסיף Job נוסף

ערוך `.github/workflows/ci.yml`:

```yaml
jobs:
  # ... jobs קיימים

  # Job חדש
  security-scan:
    name: Security Vulnerability Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=high

  # עדכן את all-checks-passed
  all-checks-passed:
    needs: [type-check, lint, test-frontend, test-functions, test-critical, build, security-scan]
    # ...
```

### לרוץ רק על קבצים מסוימים

```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - 'src/**'
      - 'functions/**'
      - '.github/workflows/**'
```

---

## 📊 סטטיסטיקות

מאז ההפעלה:
```
✅ Workflows שהצליחו: [מעקב ב-GitHub Actions tab]
❌ Workflows שנכשלו: [מעקב ב-GitHub Actions tab]
⏰ זמן ממוצע: 5-7 דקות
💡 באגים שנמנעו: ???
```

---

## 🔗 קישורים

### תיעוד פנימי:
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - שכבות הגנה
- [PRE_COMMIT_HOOKS.md](PRE_COMMIT_HOOKS.md) - Hook מקומי
- [SETUP_COMPLETE.md](SETUP_COMPLETE.md) - סיכום התקנה

### תיעוד GitHub:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

---

## 📝 סיכום

✅ **GitHub Actions מוגדר ומוכן!**

```
איך זה עובד:
  Push/PR → 🤖 GitHub Actions → 6 Jobs → ✓/✗ → Merge/חסימה

מה זה בודק:
  • Type Check (TypeScript)
  • Lint (ESLint)
  • Frontend Tests + Coverage
  • Functions Tests + Coverage
  • Critical Tests (חובה!)
  • Build (Frontend + Functions)

למה זה חשוב:
  • מונע merge של קוד שבור
  • בדיקה אוטומטית לכל PR
  • הגנה על branch main
  • ראיית coverage לאורך זמן
```

**הכלל הזהב:**
> "GitHub Actions הוא השומר האחרון לפני הייצור - אף שורת קוד לא עוברת בלעדיו!"

---

**עדכון אחרון:** 2026-01-23
**גרסה:** 1.0
**סטטוס:** ✅ מוגדר ומוכן
