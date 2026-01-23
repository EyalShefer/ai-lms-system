# 🎓 AI-LMS System

מערכת ניהול למידה מבוססת AI לבניית תכנים חינוכיים אינטראקטיביים.

---

## 📚 תיעוד

### למפתחים חדשים - התחל כאן! 👋

1. **[📖 TESTING_GUIDE.md](docs/TESTING_GUIDE.md)** - המדריך המלא (קריאה חובה!)
   - כל מה שצריך לדעת על Testing
   - תהליך עבודה יומי
   - פתרון בעיות
   - 30 דקות קריאה

2. **[⚡ TESTING_QUICK_REFERENCE.md](docs/TESTING_QUICK_REFERENCE.md)** - דף עזר מהיר
   - פקודות יומיות
   - תהליך עבודה קצר
   - **תדפיס אותי!**

3. **[🔒 CRITICAL_CODE.md](docs/CRITICAL_CODE.md)** - קוד מוגן
   - רשימת קבצים קריטיים
   - Checklist לפני שינוי
   - דוגמאות לשינויים בטוחים/מסוכנים

4. **[📂 docs/](docs/)** - כל התיעוד במקום אחד

---

## 🚀 Quick Start - התחלה מהירה

### 1. התקנה

```bash
# Clone the repository
git clone <repository-url>
cd ai-lms-system

# Install dependencies
npm install
cd functions && npm install && cd ..
```

### 2. בדיקה ראשונה

```bash
# הרץ טסטים לוודא שהכל עובד
npm test

# צפוי: ✅ All tests pass
```

### 3. הפעלת הפרויקט

```bash
# בטרמינל ראשון - Frontend
npm run dev

# בטרמינל שני - Firebase Functions (אופציונלי)
cd functions
npm run serve
```

פתח דפדפן: `http://localhost:5173`

---

## 🛡️ Testing & Quality Assurance

### פקודות יומיות

```bash
# לפני כל commit - זה חובה!
npm test

# בדיקת כיסוי קוד
npm run test:coverage

# בדיקת TypeScript
npm run type-check

# בדיקת איכות קוד
npm run lint

# הכל ביחד (לפני PR)
npm run validate
```

**⚠️ חשוב:** ראה [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) לפרטים מלאים!

---

## 📂 מבנה הפרויקט

```
ai-lms-system/
├── src/                        # Frontend (React + TypeScript)
│   ├── components/            # רכיבי React
│   ├── context/               # Context providers
│   │   └── CourseContext.tsx  # 🔒 CRITICAL
│   ├── services/              # שירותים
│   └── hooks/                 # Custom hooks
│
├── functions/                  # Firebase Cloud Functions
│   └── src/
│       ├── ai/
│       │   └── prompts.ts     # 🔒 CRITICAL - AI prompts
│       ├── streaming/
│       │   └── streamingServer.ts  # 🔒 CRITICAL - SSE server
│       └── index.ts
│
├── docs/                       # 📚 תיעוד מלא
│   ├── TESTING_GUIDE.md       # מדריך Testing מלא
│   ├── TESTING_QUICK_REFERENCE.md  # דף עזר
│   └── CRITICAL_CODE.md       # קוד מוגן
│
├── jest.config.js             # תצורת Jest
├── package.json               # Dependencies + Scripts
└── README.md                  # אתה כאן!
```

**🔒 = קוד קריטי** - ראה [CRITICAL_CODE.md](docs/CRITICAL_CODE.md)

---

## 🔄 תהליך עבודה (Workflow)

```bash
┌─────────────────────────────────────────┐
│ 1. צור branch חדש                      │
│    git checkout -b feature/my-feature   │
├─────────────────────────────────────────┤
│ 2. עשה שינויים                         │
│    (עריכה ב-VSCode)                    │
├─────────────────────────────────────────┤
│ 3. בדוק שהכל עובד                      │
│    npm test                             │
├─────────────────────────────────────────┤
│ 4. Commit                               │
│    git add .                            │
│    git commit -m "הוספת פיצ'ר X"       │
│    (pre-commit hook יריץ טסטים!)       │
├─────────────────────────────────────────┤
│ 5. Push                                 │
│    git push origin feature/my-feature   │
├─────────────────────────────────────────┤
│ 6. פתח Pull Request                    │
│    (GitHub Actions יריץ כל הבדיקות)    │
├─────────────────────────────────────────┤
│ 7. Merge אחרי שכל הבדיקות עברו         │
└─────────────────────────────────────────┘
```

**פרטים:** [TESTING_GUIDE.md - תהליך עבודה יומי](docs/TESTING_GUIDE.md#תהליך-עבודה-יומי)

---

## 🧪 מבנה הטסטים

### Frontend Tests
```
src/
└── __tests__/
    ├── components/
    │   └── CourseEditor.test.tsx
    └── context/
        └── CourseContext.test.tsx
```

### Backend Tests
```
functions/src/
└── __tests__/
    ├── ai/
    │   └── prompts.test.ts       ✅ קיים
    └── streaming/
        └── streamingServer.test.ts  📝 בקרוב
```

**כיסוי נוכחי:**
- `prompts.ts` - 85%+ ✅
- `streamingServer.ts` - 67% ⚠️ (צריך שיפור)
- `CourseContext.tsx` - 78% ✅

---

## 🔥 Firebase Configuration

### Functions

```bash
# Development (עם Emulator)
cd functions
npm run serve

# Deploy to production
firebase deploy --only functions
```

### Firestore Rules

```bash
# Deploy security rules
firebase deploy --only firestore:rules
```

---

## 🛠️ פקודות שימושיות

### Development

```bash
npm run dev          # הפעלת dev server
npm run build        # בנייה לייצור
npm run preview      # preview של build
```

### Testing

```bash
npm test                    # כל הטסטים
npm run test:watch          # watch mode
npm run test:coverage       # עם coverage
npm run test:critical       # רק קוד קריטי
```

### Quality Checks

```bash
npm run type-check          # TypeScript
npm run lint                # ESLint
npm run lint:fix            # תיקון אוטומטי
npm run validate            # הכל ביחד!
```

### Functions

```bash
cd functions
npm run build               # בנייה
npm run serve               # הפעלה מקומית
npm run deploy              # deploy
npm test                    # טסטים
```

---

## 🎯 3 שכבות הגנה

### 1️⃣ Local (המחשב שלך)
- ✅ Pre-commit hooks
- ✅ טסטים ידניים
- ✅ Type checking

### 2️⃣ GitHub (Pull Requests)
- ✅ GitHub Actions CI/CD
- ✅ בדיקות אוטומטיות
- ✅ Code review

### 3️⃣ Production (Firebase)
- ✅ Error monitoring
- ✅ Performance tracking
- ✅ Alerts

**פרטים:** [TESTING_GUIDE.md - 3 שכבות הגנה](docs/TESTING_GUIDE.md#3-שכבות-הגנה)

---

## 📖 למידע נוסף

### תיעוד פנימי
- [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) - מדריך Testing מקיף
- [TESTING_QUICK_REFERENCE.md](docs/TESTING_QUICK_REFERENCE.md) - דף עזר
- [CRITICAL_CODE.md](docs/CRITICAL_CODE.md) - קוד מוגן
- [STREAMING_ARCHITECTURE.md](docs/STREAMING_ARCHITECTURE.md) - ארכיטקטורת Streaming
- [CURRICULUM_AGENT.md](docs/CURRICULUM_AGENT.md) - Curriculum Agent

### תיעוד חיצוני
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)

---

## 🤝 תרומה לפרויקט

### לפני שמגישים PR

```bash
# 1. וודא שהטסטים עוברים
npm run validate

# 2. עדכן תיעוד אם נדרש
# ערוך את docs/ במידת הצורך

# 3. בדוק שאין שינויים בקוד קריטי בלי Checklist
# ראה CRITICAL_CODE.md
```

### הנחיות

- ✅ כתוב טסטים לכל פיצ'ר חדש
- ✅ שמור על coverage מעל 60% (80% לקוד קריטי)
- ✅ עקוב אחרי הסגנון של הקוד הקיים
- ✅ תעד שינויים ב-CRITICAL_CODE.md אם רלוונטי

---

## ⚠️ זכור!

> **"אין commit בלי tests!"**

5 שניות של `npm test` = שעות של דיבוג נחסכות

---

## 📞 צריך עזרה?

1. בדוק ב-[TESTING_GUIDE.md](docs/TESTING_GUIDE.md) - רוב התשובות שם
2. חפש בקבצי התיעוד (Ctrl+F)
3. פנה לצוות הפיתוח

---

## 📜 רישיון

[הוסף רישיון כאן]

---

**עדכון אחרון:** 2026-01-23
**גרסה:** 1.0
**סטטוס:** ✅ Production Ready
