# מסמך טכני מקיף לצוות Wizdi
# AI LMS System Integration - Technical Overview

---

## תוכן עניינים
1. [מה זה AI LMS System?](#1-מה-זה-ai-lms-system)
2. [מה אנחנו נותנים לכם?](#2-מה-אנחנו-נותנים-לכם)
3. [הנתונים שאנחנו מייצרים](#3-הנתונים-שאנחנו-מייצרים)
4. [ארכיטקטורת החיבור](#4-ארכיטקטורת-החיבור)
5. [תהליך ההתחברות (Flow)](#5-תהליך-ההתחברות-flow)
6. [נקודות החיבור (Endpoints)](#6-נקודות-החיבור-endpoints)
7. [מה אתם צריכים לעשות](#7-מה-אתם-צריכים-לעשות)
8. [התוצאה הסופית](#8-התוצאה-הסופית)
9. [דוגמאות קוד מעשיות](#9-דוגמאות-קוד-מעשיות)

---

## 1. מה זה AI LMS System?

### בקצרה
מערכת למידה מבוססת AI שמאפשרת למורים ליצור תכנים ומשימות, ולתלמידים ללמוד ולבצע משימות - הכל עם תמיכת בינה מלאכותית.

### היכולות העיקריות

| עבור מורים | עבור תלמידים |
|------------|--------------|
| יצירת קורסים ויחידות לימוד | ביצוע משימות אינטראקטיביות |
| הקצאת משימות לכיתות | מעקב התקדמות אישי |
| מעקב אחר ציונים והתקדמות | צבירת נקודות XP והישגים |
| קבלת התראות על תלמידים בסיכון | קבלת משוב מיידי מה-AI |
| יצירת תכנים עם AI | Streak ימי למידה |

### סוגי המשימות שאנחנו תומכים

- **תרגול** - שאלות ותשובות עם משוב מיידי
- **טקסט חופשי** - כתיבת חיבורים עם בדיקת AI
- **מצגות** - צפייה בתכנים ומענה על שאלות
- **פרויקטים** - עבודות ארוכות טווח
- **בוחנים** - מבחנים עם ציון אוטומטי

---

## 2. מה אנחנו נותנים לכם?

### 2.1 ממשק משתמש מלא (iframe)

אתם מטמיעים את המערכת שלנו כ-iframe בתוך Wizdi:

```
┌─────────────────────────────────────────┐
│           WIZDI Dashboard               │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │     AI LMS System (iframe)        │  │
│  │                                   │  │
│  │   - כל ה-UI מוכן                  │  │
│  │   - עברית/ערבית                   │  │
│  │   - Responsive                    │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**התלמיד/מורה עובדים אצלנו** - אתם לא צריכים לבנות UI!

### 2.2 APIs לשליפת נתונים

אם אתם רוצים להציג נתונים בדשבורד שלכם (מחוץ ל-iframe):

| API | מה מחזיר |
|-----|----------|
| Student Stats | ציונים, XP, streak, התקדמות של תלמיד |
| Class Stats | סטטיסטיקות כיתתיות למורה |
| Teacher Dashboard | סיכום כללי למורה |
| Task Results | תוצאות משימה ספציפית |

### 2.3 Events בזמן אמת (PostMessage)

כל פעולה שקורה במערכת - אתם מקבלים עדכון:

```javascript
// דוגמה - תלמיד סיים משימה
{
  type: "TASK_COMPLETED",
  payload: {
    studentId: "student_789",
    taskId: "task_456",
    score: 85,
    timeSpentSeconds: 900
  }
}
```

---

## 3. הנתונים שאנחנו מייצרים

### 3.1 נתוני תלמיד

| נתון | תיאור | דוגמה |
|------|-------|-------|
| `completedTasks` | כמה משימות השלים | 15 |
| `pendingTasks` | כמה משימות בהמתנה | 3 |
| `averageScore` | ציון ממוצע | 82.5 |
| `totalXp` | סה"כ נקודות ניסיון | 1,250 |
| `currentLevel` | רמה נוכחית | 5 |
| `currentStreak` | ימי למידה רצופים | 7 |
| `longestStreak` | השיא של ימים רצופים | 14 |
| `totalTimeMinutes` | זמן למידה כולל (דקות) | 480 |
| `lastActiveAt` | מתי פעיל לאחרונה | 2024-01-07 |
| `progressBySubject` | התקדמות לפי מקצוע | [{math: 88%}, {hebrew: 75%}] |

### 3.2 נתוני כיתה (למורה)

| נתון | תיאור | דוגמה |
|------|-------|-------|
| `studentCount` | מספר תלמידים | 25 |
| `averageScore` | ציון ממוצע כיתתי | 78.3 |
| `averageCompletion` | אחוז השלמה ממוצע | 85% |
| `totalTasksAssigned` | משימות שהוקצו | 20 |
| `students[]` | רשימת תלמידים + ציונים | [...] |
| `alerts[]` | התראות על תלמידים בסיכון | [...] |

### 3.3 נתוני משימה

| נתון | תיאור | דוגמה |
|------|-------|-------|
| `totalAssigned` | כמה תלמידים קיבלו | 25 |
| `submitted` | כמה הגישו | 20 |
| `graded` | כמה נבדקו | 18 |
| `averageScore` | ציון ממוצע | 76.5 |
| `questionAnalysis` | ניתוח לפי שאלה | [{q1: 88% correct}] |

---

## 4. ארכיטקטורת החיבור

```
┌──────────────────────────────────────────────────────────────────┐
│                         WIZDI Platform                            │
│                                                                    │
│  ┌────────────────┐     ┌────────────────────────────────────┐   │
│  │   Wizdi        │     │        AI LMS (iframe)              │   │
│  │   Dashboard    │     │                                     │   │
│  │                │     │  Teacher View  │  Student View      │   │
│  │  - Shows our   │◄────│  - Create      │  - Do tasks        │   │
│  │    data        │     │  - Assign      │  - Track progress  │   │
│  │                │     │  - Grade       │  - Earn XP         │   │
│  └───────┬────────┘     └──────────┬─────────────────────────┘   │
│          │                         │                              │
│          │    postMessage          │                              │
│          │◄────────────────────────┘                              │
│          │                                                        │
│          │    REST API (optional)                                 │
│          ▼                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Wizdi Backend                              │  │
│  └───────────────────────┬────────────────────────────────────┘  │
│                          │                                        │
└──────────────────────────│────────────────────────────────────────┘
                           │
                           │ HTTPS
                           ▼
              ┌────────────────────────────┐
              │   AI LMS Cloud Functions   │
              │                            │
              │  - /wizdiAuth/login        │
              │  - /wizdiAuth/refresh      │
              │  - /wizdiApi/student/*     │
              │  - /wizdiApi/class/*       │
              │  - /wizdiApi/teacher/*     │
              └────────────────────────────┘
```

### שלושה ערוצי תקשורת:

| ערוץ | כיוון | שימוש |
|------|-------|-------|
| **Login API** | Wizdi → אנחנו | אימות והתחברות |
| **PostMessage** | אנחנו → Wizdi | עדכונים בזמן אמת |
| **REST APIs** | Wizdi → אנחנו | שליפת נתונים לדשבורד |

---

## 5. תהליך ההתחברות (Flow)

### Flow מלא - מרגע שמשתמש לוחץ עד שרואה את המערכת

```
משתמש ב-Wizdi לוחץ "פתח AI LMS"
              │
              ▼
┌─────────────────────────────────────┐
│  1. Wizdi Backend שולח Login       │
│                                     │
│  POST /wizdiAuth/login              │
│  {                                  │
│    apiKey: "wizdi_pk_...",          │
│    apiSecret: "wizdi_sk_...",       │
│    uid: "wizdi_user_123",           │
│    isTeacher: true/false,           │
│    classes: [...],                  │
│    schoolId: "school_456"           │
│  }                                  │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  2. אנחנו מחזירים Token             │
│                                     │
│  {                                  │
│    status: "success",               │
│    token: "eyJhbG...",              │
│    uid: "our_internal_id_abc",      │
│    expiresIn: 3600                  │
│  }                                  │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  3. Wizdi פותח iframe              │
│                                     │
│  <iframe src="                      │
│    https://ai-lms-system.web.app    │
│    /wizdi/student                   │
│    ?userId=our_internal_id_abc      │
│    &ctoken=eyJhbG...                │
│    &locale=he                       │
│  ">                                 │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  4. המערכת שלנו נטענת               │
│     ושולחת APPLICATION_LOADED       │
│                                     │
│  postMessage({                      │
│    source: "ai-lms-system",         │
│    type: "APPLICATION_LOADED",      │
│    payload: { userId, isTeacher }   │
│  })                                 │
└─────────────────┬───────────────────┘
                  │
                  ▼
        המשתמש רואה את המערכת
         ויכול לעבוד!
```

---

## 6. נקודות החיבור (Endpoints)

### 6.1 Authentication Endpoints

| Endpoint | Method | תיאור |
|----------|--------|-------|
| `/wizdiAuth/login` | POST | התחברות וקבלת token |
| `/wizdiAuth/refresh` | POST | חידוש token |

#### Login Request:
```json
{
  "apiKey": "wizdi_pk_live_xxxxx",
  "apiSecret": "wizdi_sk_live_xxxxx",
  "uid": "wizdi_user_123",
  "locale": "he",
  "isTeacher": false,
  "classes": [{ "id": "class_001", "name": "כיתה ו-1" }],
  "groups": [],
  "schoolName": "בית ספר הדגל",
  "schoolId": "school_456"
}
```

#### Login Response:
```json
{
  "status": "success",
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "uid": "our_internal_user_id_abc123",
  "expiresIn": 3600
}
```

### 6.2 Iframe URLs

| סוג | URL |
|-----|-----|
| **דשבורד מורה** | `/wizdi/teacher?userId={uid}&ctoken={token}&locale={locale}` |
| **דשבורד תלמיד** | `/wizdi/student?userId={uid}&ctoken={token}&locale={locale}` |
| **משימה ספציפית** | `/wizdi/task/{taskId}?userId={uid}&ctoken={token}` |
| **קורס ספציפי** | `/wizdi/course/{courseId}?userId={uid}&ctoken={token}` |

**Base URL:** `https://ai-lms-system.web.app`

### 6.3 Data APIs

**Base URL:** `https://us-central1-ai-lms-system.cloudfunctions.net/wizdiApi`

| Endpoint | תיאור |
|----------|-------|
| `POST /student/{studentId}/stats` | סטטיסטיקות תלמיד |
| `POST /class/{classId}/stats` | סטטיסטיקות כיתה |
| `POST /teacher/{teacherId}/dashboard` | דשבורד מורה מלא |
| `POST /task/{taskId}/results` | תוצאות משימה |
| `POST /activity` | לוג פעילויות |

כל קריאה דורשת:
```json
{
  "apiKey": "wizdi_pk_...",
  "apiSecret": "wizdi_sk_..."
}
```

### 6.4 PostMessage Events (מאיתנו אליכם)

| Event | מתי נשלח | מה ב-Payload |
|-------|----------|--------------|
| `APPLICATION_LOADED` | iframe נטען | userId, isTeacher |
| `TASK_STARTED` | תלמיד התחיל משימה | taskId, studentId, courseName |
| `TASK_PROGRESS` | עדכון התקדמות | taskId, progress (0-100) |
| `TASK_COMPLETED` | תלמיד סיים | taskId, score, analytics |
| `TASK_SUBMITTED` | הגשה לבדיקה | taskId, submissionId |
| `GRADE_UPDATED` | מורה ציין | studentId, grade, feedback |
| `XP_EARNED` | צבירת נקודות | studentId, xpAmount, level |
| `ACHIEVEMENT_UNLOCKED` | הישג חדש | achievementId, name |
| `COURSE_CREATED` | מורה יצר קורס | courseId, title |
| `TASK_ASSIGNED` | מורה הקצה משימה | taskId, studentCount |
| `CLOSE_EVENT` | משתמש יצא | lastView |
| `ERROR` | שגיאה | code, message |

### 6.5 PostMessage Commands (מכם אלינו)

| Command | מה עושה |
|---------|---------|
| `NAVIGATE_TO_TASK` | פותח משימה ספציפית |
| `NAVIGATE_TO_COURSE` | פותח קורס ספציפי |
| `REFRESH_DATA` | רענון הנתונים |

---

## 7. מה אתם צריכים לעשות

### 7.1 לפני שמתחילים

- [ ] **לספק לנו credentials** - API Key + Secret לסביבת production ו-sandbox
- [ ] **להוסיף domains ל-whitelist שלכם:**
  ```
  https://ai-lms-system.web.app
  https://ai-lms-system.firebaseapp.com
  https://us-central1-ai-lms-system.cloudfunctions.net
  ```

### 7.2 מימוש בצד שלכם

#### א. להוסיף iframe לדשבורד:

```html
<iframe
  id="ai-lms-iframe"
  src="[URL from login response]"
  allow="fullscreen; clipboard-write; microphone"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  style="width: 100%; height: 100%; border: none;"
/>
```

#### ב. להאזין ל-PostMessages:

```javascript
window.addEventListener('message', (event) => {
  // בדיקת origin
  if (!event.origin.includes('ai-lms-system')) return;

  const { source, type, payload } = event.data;
  if (source !== 'ai-lms-system') return;

  // טיפול באירועים
  switch (type) {
    case 'TASK_COMPLETED':
      // עדכון הדשבורד שלכם
      updateStudentProgress(payload);
      break;
    case 'GRADE_UPDATED':
      // הודעה למשתמש
      showNotification(`ציון חדש: ${payload.grade}`);
      break;
    // ... וכו'
  }
});
```

#### ג. לקרוא ל-Login API לפני פתיחת iframe:

```javascript
async function openAILMS(wizdiUser) {
  // 1. Login
  const response = await fetch('/wizdiAuth/login', {
    method: 'POST',
    body: JSON.stringify({
      apiKey: WIZDI_API_KEY,
      apiSecret: WIZDI_API_SECRET,
      uid: wizdiUser.id,
      isTeacher: wizdiUser.isTeacher,
      // ... rest of user data
    })
  });

  const { token, uid } = await response.json();

  // 2. Build iframe URL
  const view = wizdiUser.isTeacher ? 'teacher' : 'student';
  const iframeUrl = `https://ai-lms-system.web.app/wizdi/${view}?userId=${uid}&ctoken=${token}&locale=he`;

  // 3. Open iframe
  document.getElementById('ai-lms-iframe').src = iframeUrl;
}
```

---

## 8. התוצאה הסופית

### מה המשתמשים יראו

#### תלמיד:
```
┌─────────────────────────────────────────────────────────────┐
│  Wizdi Dashboard                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ╔═══════════════════════════════════════════════════╗│  │
│  │  ║  שלום דני! 👋                                     ║│  │
│  │  ║                                                   ║│  │
│  │  ║  ⭐ XP: 1,250    🔥 Streak: 7 ימים    📊 רמה 5   ║│  │
│  │  ║                                                   ║│  │
│  │  ║  המשימות שלי:                                     ║│  │
│  │  ║  ┌────────────────────────────────────────────┐  ║│  │
│  │  ║  │ 📝 חיבור שברים    [85/100]    ✓ הושלם     │  ║│  │
│  │  ║  │ 📝 גיאומטריה      [בתהליך]    ⏳ פתוח     │  ║│  │
│  │  ║  │ 📝 מבחן סיכום     [לא הותחל]  📌 חדש      │  ║│  │
│  │  ║  └────────────────────────────────────────────┘  ║│  │
│  │  ╚═══════════════════════════════════════════════════╝│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### מורה:
```
┌─────────────────────────────────────────────────────────────┐
│  Wizdi Dashboard                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ╔═══════════════════════════════════════════════════╗│  │
│  │  ║  דשבורד מורה - שרה כהן                            ║│  │
│  │  ║                                                   ║│  │
│  │  ║  👥 120 תלמידים   📚 5 קורסים   ⏰ 15 הגשות חדשות ║│  │
│  │  ║                                                   ║│  │
│  │  ║  כיתה ו-1:                   ממוצע: 78.3         ║│  │
│  │  ║  ┌────────────────────────────────────────────┐  ║│  │
│  │  ║  │ 🟢 דני כהן     92    מצטיין                │  ║│  │
│  │  ║  │ 🟢 מיכל לוי    75    טוב                   │  ║│  │
│  │  ║  │ 🔴 יוסי א.     60    דורש תשומת לב        │  ║│  │
│  │  ║  └────────────────────────────────────────────┘  ║│  │
│  │  ╚═══════════════════════════════════════════════════╝│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### מה Wizdi מקבל

1. **בזמן אמת (PostMessage):**
   - כל פעם שתלמיד מסיים משימה
   - כל פעם שמורה נותן ציון
   - כל פעם שמישהו צובר XP
   - התראות על שגיאות

2. **לפי דרישה (API):**
   - סטטיסטיקות מלאות לכל תלמיד
   - סיכומים כיתתיים
   - ניתוח ביצועים
   - לוג פעילויות

---

## 9. דוגמאות קוד מעשיות

### 9.1 מחלקת אינטגרציה מלאה (JavaScript)

```javascript
class AILMSIntegration {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = 'https://us-central1-ai-lms-system.cloudfunctions.net';
    this.iframeBaseUrl = 'https://ai-lms-system.web.app';
    this.currentToken = null;
    this.currentUserId = null;

    // הגדרת האזנה לאירועים
    this.setupMessageListener();
  }

  // ==== Authentication ====

  async login(wizdiUser) {
    const response = await fetch(`${this.baseUrl}/wizdiAuth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        uid: wizdiUser.id,
        locale: wizdiUser.locale || 'he',
        isTeacher: wizdiUser.isTeacher,
        classes: wizdiUser.classes,
        groups: wizdiUser.groups || [],
        schoolName: wizdiUser.schoolName,
        schoolId: wizdiUser.schoolId
      })
    });

    const data = await response.json();

    if (data.status === 'success') {
      this.currentToken = data.token;
      this.currentUserId = data.uid;
      return data;
    } else {
      throw new Error(data.message);
    }
  }

  async refreshToken() {
    const response = await fetch(`${this.baseUrl}/wizdiAuth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        token: this.currentToken
      })
    });

    const data = await response.json();
    if (data.status === 'success') {
      this.currentToken = data.token;
    }
    return data;
  }

  // ==== Iframe Management ====

  getIframeUrl(view = 'student', options = {}) {
    const params = new URLSearchParams({
      userId: this.currentUserId,
      ctoken: this.currentToken,
      locale: options.locale || 'he',
      ...options
    });

    return `${this.iframeBaseUrl}/wizdi/${view}?${params}`;
  }

  openInContainer(containerId, view = 'student', options = {}) {
    const container = document.getElementById(containerId);
    const iframe = document.createElement('iframe');

    iframe.src = this.getIframeUrl(view, options);
    iframe.allow = 'fullscreen; clipboard-write; microphone';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';

    container.innerHTML = '';
    container.appendChild(iframe);

    this.iframe = iframe;
    return iframe;
  }

  // ==== Communication ====

  sendCommand(type, data = {}) {
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage({ type, ...data }, '*');
    }
  }

  navigateToTask(taskId) {
    this.sendCommand('NAVIGATE_TO_TASK', { taskId });
  }

  navigateToCourse(courseId, unitId = null) {
    this.sendCommand('NAVIGATE_TO_COURSE', { courseId, unitId });
  }

  refreshData() {
    this.sendCommand('REFRESH_DATA');
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Verify origin
      if (!event.origin.includes('ai-lms-system')) return;

      const { source, type, payload } = event.data;
      if (source !== 'ai-lms-system') return;

      // Call appropriate handler
      const handler = this.eventHandlers[type];
      if (handler) {
        handler(payload);
      }

      // Also call generic handler
      if (this.onEvent) {
        this.onEvent(type, payload);
      }
    });
  }

  // Event handlers - override these
  eventHandlers = {
    APPLICATION_LOADED: (payload) => {
      console.log('AI LMS loaded:', payload);
    },
    TASK_COMPLETED: (payload) => {
      console.log('Task completed:', payload);
    },
    GRADE_UPDATED: (payload) => {
      console.log('Grade updated:', payload);
    },
    XP_EARNED: (payload) => {
      console.log('XP earned:', payload);
    },
    ERROR: (payload) => {
      console.error('AI LMS Error:', payload);
    }
  };

  // ==== Data APIs ====

  async getStudentStats(studentId, dateFrom = null, dateTo = null) {
    const response = await fetch(
      `${this.baseUrl}/wizdiApi/student/${studentId}/stats`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          dateFrom,
          dateTo
        })
      }
    );
    return response.json();
  }

  async getClassStats(classId, teacherId) {
    const response = await fetch(
      `${this.baseUrl}/wizdiApi/class/${classId}/stats`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret,
          teacherId
        })
      }
    );
    return response.json();
  }

  async getTeacherDashboard(teacherId) {
    const response = await fetch(
      `${this.baseUrl}/wizdiApi/teacher/${teacherId}/dashboard`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret
        })
      }
    );
    return response.json();
  }

  async getTaskResults(taskId) {
    const response = await fetch(
      `${this.baseUrl}/wizdiApi/task/${taskId}/results`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret
        })
      }
    );
    return response.json();
  }
}
```

### 9.2 דוגמת שימוש

```javascript
// יצירת instance
const aiLms = new AILMSIntegration({
  apiKey: 'wizdi_pk_live_xxxxx',
  apiSecret: 'wizdi_sk_live_xxxxx'
});

// הגדרת event handlers
aiLms.eventHandlers.TASK_COMPLETED = (payload) => {
  // עדכון הדשבורד של Wizdi
  wizdiDashboard.updateStudentScore(payload.studentId, payload.score);

  // הצגת הודעה
  wizdiNotifications.show(`${payload.studentName} סיים משימה עם ציון ${payload.score}`);
};

aiLms.eventHandlers.GRADE_UPDATED = (payload) => {
  // עדכון ציון בדשבורד
  wizdiDashboard.updateGrade(payload.studentId, payload.taskId, payload.grade);
};

aiLms.eventHandlers.XP_EARNED = (payload) => {
  // עדכון XP
  wizdiDashboard.updateXP(payload.studentId, payload.totalXp, payload.level);
};

// פתיחת המערכת למשתמש
async function openForUser(wizdiUser, containerId) {
  try {
    // Login
    await aiLms.login(wizdiUser);

    // פתיחת iframe
    const view = wizdiUser.isTeacher ? 'teacher' : 'student';
    aiLms.openInContainer(containerId, view, { locale: 'he' });

  } catch (error) {
    console.error('Failed to open AI LMS:', error);
    wizdiNotifications.showError('שגיאה בפתיחת מערכת הלמידה');
  }
}

// דוגמת קריאה
openForUser({
  id: 'wizdi_user_12345',
  isTeacher: false,
  locale: 'he',
  classes: [{ id: 'class_001', name: 'כיתה ו-1' }],
  groups: [],
  schoolName: 'בית ספר הדגל',
  schoolId: 'school_456'
}, 'ai-lms-container');
```

---

## סיכום

### מה אנחנו נותנים:
- ✅ מערכת למידה מלאה עם AI
- ✅ ממשק משתמש מוכן (iframe)
- ✅ APIs לשליפת נתונים
- ✅ עדכונים בזמן אמת

### מה אתם צריכים לעשות:
- 📋 לספק credentials
- 📋 להוסיף domains ל-whitelist
- 📋 לממש Login + iframe embedding
- 📋 להאזין ל-PostMessages

### התוצאה:
המשתמשים שלכם יוכלו ללמוד וללמד עם AI, ואתם תקבלו את כל הנתונים בזמן אמת!

---

**שאלות? צרו קשר עם הצוות הטכני שלנו.**
