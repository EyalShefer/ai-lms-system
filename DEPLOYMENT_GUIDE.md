# 🚀 AI LMS Deployment Guide

מדריך פריסה מלא למערכת ה-AI LMS עם השיפורים החדשים.

---

## 📋 תוכן עניינים

1. [דרישות מקדימות](#דרישות-מקדימות)
2. [התקנה מקומית](#התקנה-מקומית)
3. [בדיקות לפני Deploy](#בדיקות-לפני-deploy)
4. [פריסה ל-Production](#פריסה-ל-production)
5. [אופטימיזציות נוספות](#אופטימיזציות-נוספות)
6. [פתרון בעיות](#פתרון-בעיות)

---

## 🔧 דרישות מקדימות

### תוכנות נדרשות
- **Node.js**: גרסה 18 ומעלה (מומלץ 22)
- **npm**: גרסה 8 ומעלה
- **Firebase CLI**: `npm install -g firebase-tools`
- **Git**: לניהול גרסאות

### חשבונות נדרשים
- **Firebase Project**: עם Blaze plan (שימוש ב-Cloud Functions)
- **OpenAI API Key**: עם credits מספקים
- **Google Cloud**: הפעלת Google Cloud Console

---

## 💻 התקנה מקומית

### 1. Clone הפרויקט

```bash
git clone <repository-url>
cd ai-lms-system
```

### 2. התקן Dependencies

```bash
# Root dependencies
npm install

# Functions dependencies
cd functions
npm install
cd ..
```

### 3. הגדר Environment Variables

צור קובץ `.env` בשורש הפרויקט:

```env
VITE_OPENAI_API_KEY=sk-...your-openai-key...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

**הערה חשובה**: בייצור, ה-OpenAI key צריך להיות רק ב-Firebase Secrets, לא ב-`.env`!

### 4. הגדר Firebase Secrets

```bash
# Login to Firebase
firebase login

# Set OpenAI API Key
firebase functions:secrets:set OPENAI_API_KEY
# הזן את המפתח כשתתבקש
```

### 5. הרץ Local Emulators

```bash
# Start all emulators
firebase emulators:start

# Or specific ones
firebase emulators:start --only functions,firestore,hosting
```

### 6. גש לאפליקציה

פתח דפדפן ב-`http://localhost:5173` (Vite dev server)

---

## 🧪 בדיקות לפני Deploy

### 1. בדוק Firestore Rules

```bash
# Test security rules
firebase emulators:exec --only firestore "npm test"
```

**בדיקות ידניות**:
- ✅ מורה יכול לגשת רק לקורסים שלו
- ✅ תלמיד יכול לגשת רק לקורסים שהוקצו לו
- ✅ לא ניתן לכתוב ל-cache collection מה-client

### 2. בדוק Rate Limiting

```bash
# Test with multiple requests
curl -X POST http://localhost:5001/<project-id>/us-central1/openaiProxy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}'
```

צפוי:
- ✅ בקשה 1-10: Success (200)
- ✅ בקשה 11: Rate Limited (429)
- ✅ כותרת `Retry-After` מוחזרת

### 3. בדוק Caching

```bash
# Generate same skeleton twice
# Should see cache hit on second request
```

בדוק logs:
```
Cache miss for skeleton: פוטוסינתזה:7:5:learning
Cache hit for skeleton: פוטוסינתזה:7:5:learning  ✅
```

### 4. בדוק Error Handling

```bash
# Simulate network error
# Should retry 3 times with exponential backoff
```

### 5. Run Tests

```bash
# Unit tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## 🌍 פריסה ל-Production

### שלב 1: Build

```bash
# Build frontend
npm run build

# Build functions
cd functions
npm run build
cd ..
```

### שלב 2: Deploy Firestore Rules & Indexes

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

⏱️ **הערה**: Indexes עלולים לקחת מספר דקות להיבנות. בדוק ב-Firebase Console.

### שלב 3: Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or specific function
firebase deploy --only functions:openaiProxy
```

**Functions שיפורסו**:
- ✅ `openaiProxy` - עם rate limiting
- ✅ `generateStudentUnitSkeleton` - עם caching
- ✅ `generateStepContent` - עם caching
- ✅ `generateTeacherLessonPlan`
- ✅ `transcribeYoutube`
- ✅ `generatePodcastScript`

### שלב 4: Deploy Hosting

```bash
firebase deploy --only hosting
```

### שלב 5: Verify Deployment

בדוק:
- ✅ Site live ב-`https://<project-id>.web.app`
- ✅ Functions פעילות ב-Firebase Console → Functions
- ✅ Indexes מוכנים ב-Firebase Console → Firestore → Indexes

---

## 🔍 אופטימיזציות נוספות

### 1. הפעל Cache Cleanup (אופציונלי)

צור Cloud Scheduler job לניקוי cache:

```bash
# Create schedule
gcloud scheduler jobs create pubsub clear-cache \
  --schedule="0 2 * * *" \
  --topic="cache-cleanup" \
  --message-body="cleanup"
```

### 2. הגדר Monitoring

```bash
# Enable Cloud Monitoring
gcloud services enable monitoring.googleapis.com

# Create uptime check
# Through Firebase Console → Hosting → Monitoring
```

### 3. הגדר Budget Alerts

ב-Google Cloud Console → Billing:
1. צור Budget Alert
2. הגדר סף: $50/חודש (למשל)
3. קבל התראות ב-email

### 4. אופטימיזציית Functions

ב-`functions/src/index.ts`:

```typescript
export const openaiProxy = onRequest({
  secrets: [openAiApiKey],
  cors: true,
  memory: "512MB",  // הגדל זיכרון אם נדרש
  timeoutSeconds: 300,  // 5 דקות max
  minInstances: 1  // Keep warm (עלות נוספת!)
}, ...);
```

---

## 🚨 פתרון בעיות

### בעיה: Rate Limiting לא עובד

**תסמינים**: משתמשים יכולים לשלוח בקשות ללא הגבלה

**פתרון**:
```bash
# ודא ש-middleware מיובא
grep "checkRateLimit" functions/src/index.ts

# ודא ש-dependency מותקן
cd functions && npm list rate-limiter-flexible
```

### בעיה: Cache לא עובד

**תסמינים**: כל בקשה מייצרת תוכן מחדש

**פתרון**:
1. בדוק ש-Firestore rules מאפשרים קריאה מ-`_cache`:
```rules
match /_cache/{cacheKey} {
  allow read: if request.auth != null;
}
```

2. בדוק logs:
```bash
firebase functions:log --only generateStudentUnitSkeleton
```

### בעיה: Streaming Chat לא עובד

**תסמינים**: Chat מחכה לתשובה מלאה

**פתרון**:
1. ודא ש-`stream: true` מועבר ל-API:
```typescript
const stream = await openai.chat.completions.create({
  model: MODEL_NAME,
  messages: apiMessages,
  stream: true  // ✅
});
```

2. בדוק שה-proxy תומך ב-streaming (currently not implemented in backend)

### בעיה: Firestore Permission Denied

**תסמינים**: `PERMISSION_DENIED: Missing or insufficient permissions`

**פתרון**:
```bash
# Deploy rules
firebase deploy --only firestore:rules

# Test in emulator first
firebase emulators:start --only firestore
```

### בעיה: Functions Timeout

**תסמינים**: Functions מתנתקות אחרי 60 שניות

**פתרון**:
```typescript
// Increase timeout
export const generateStudentUnitSkeleton = onCall({
  timeoutSeconds: 300,  // 5 minutes
  ...
}, ...);
```

### בעיה: High Costs

**תסמינים**: חיוב גבוה מהצפוי

**פתרון**:
1. בדוק cache hit rate:
```javascript
// In browser console
window.__monitoring.getPerformanceStats()
```

2. בדוק usage ב-OpenAI Dashboard
3. הפחת `minInstances` ל-0 ב-Functions (cold start vs cost tradeoff)

---

## 📊 KPIs למעקב

### ביצועים
- ⏱️ **Skeleton Generation Time**: < 15 שניות
- ⏱️ **Step Content Generation**: < 5 שניות
- ⏱️ **Chat Response Time**: < 3 שניות
- 📦 **Cache Hit Rate**: > 40%

### עלויות
- 💰 **AI API Costs**: ~$0.012 per skeleton
- 💰 **Functions Invocations**: Free tier: 2M/month
- 💰 **Firestore Reads**: Free tier: 50K/day

### זמינות
- ✅ **Uptime**: > 99.5%
- ✅ **Error Rate**: < 1%
- ✅ **Rate Limit Errors**: < 5% of requests

---

## 🔐 Security Checklist

לפני Production, ודא:

- [ ] `.env` לא ב-git (בדוק `.gitignore`)
- [ ] Firestore Rules מוגדרים נכון
- [ ] OpenAI Key רק ב-Firebase Secrets
- [ ] CORS מוגבל לדומיין שלך בלבד
- [ ] Rate limiting פעיל
- [ ] Budget alerts מוגדרים
- [ ] Monitoring פעיל

---

## 📚 משאבים נוספים

- [Firebase Documentation](https://firebase.google.com/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Rate Limiter Flexible](https://github.com/animir/node-rate-limiter-flexible)
- [Architecture Review](./ARCHITECTURE_REVIEW.md) - הדוח המלא

---

## 🆘 תמיכה

אם נתקלת בבעיות:
1. בדוק את ה-[Troubleshooting](#פתרון-בעיות)
2. בדוק Firebase logs: `firebase functions:log`
3. בדוק browser console לשגיאות frontend
4. פתח Issue ב-GitHub

---

**בהצלחה! 🚀**
