# דרישות מ-Wizdi לאינטגרציה

## מסמך לשליחה לצוות Wizdi

---

## 1. פרטי התקשרות (Credentials)

אנחנו צריכים לקבל מכם:

| פריט | תיאור | דוגמה |
|------|-------|-------|
| **API Key** | מפתח זיהוי לחשבון שלנו | `wizdi_pk_live_xxxxx` |
| **API Secret** | סוד לאימות (לשרת בלבד!) | `wizdi_sk_live_xxxxx` |
| **Sandbox Credentials** | מפתחות לסביבת בדיקות | `wizdi_pk_test_xxxxx` |
| **Webhook Secret** | אם יש webhooks מהצד שלכם | `whsec_xxxxx` |

---

## 2. Domain Whitelist

אנא הוסיפו את ה-domains הבאים לרשימה המותרת שלכם:

### Production:
```
https://ai-lms-system.web.app
https://ai-lms-system.firebaseapp.com
https://us-central1-ai-lms-system.cloudfunctions.net
```

### Development/Staging:
```
http://localhost:3000
http://localhost:5173
https://ai-lms-system-staging.web.app
```

---

## 3. Iframe Configuration

### 3.1 Iframe Attributes נדרשים

כאשר אתם מטמיעים את המערכת שלנו, אנא השתמשו בהגדרות הבאות:

```html
<iframe
  src="https://ai-lms-system.web.app/wizdi/..."
  allow="fullscreen; clipboard-write; microphone"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  style="width: 100%; height: 100%; border: none;"
/>
```

### 3.2 Permissions נדרשים

| Permission | סיבה |
|------------|------|
| `fullscreen` | תצוגת קורסים במסך מלא |
| `clipboard-write` | העתקת תוכן |
| `microphone` | הקלטות קוליות בתרגילים |
| `allow-popups` | פתיחת חלונות עזר |

---

## 4. PostMessage Listener

אתם צריכים להאזין להודעות שלנו בקוד שלכם:

```javascript
window.addEventListener('message', (event) => {
  // Verify origin
  if (!event.origin.includes('ai-lms-system')) return;

  const { source, type, payload } = event.data;

  // Verify it's from our system
  if (source !== 'ai-lms-system') return;

  switch (type) {
    case 'APPLICATION_LOADED':
      // Iframe loaded successfully
      console.log('AI LMS loaded for user:', payload.userId);
      break;

    case 'TASK_COMPLETED':
      // Student completed a task
      updateDashboard({
        studentId: payload.studentId,
        taskId: payload.taskId,
        score: payload.score,
        completedAt: payload.completedAt
      });
      break;

    case 'GRADE_UPDATED':
      // Teacher graded a submission
      updateGrades({
        studentId: payload.studentId,
        grade: payload.grade,
        feedback: payload.feedback
      });
      break;

    case 'XP_EARNED':
      // Student earned XP
      updateStudentXp(payload.studentId, payload.totalXp);
      break;

    case 'CLOSE_EVENT':
      // User wants to close/exit
      handleCloseIframe();
      break;

    case 'ERROR':
      // Something went wrong
      handleError(payload.code, payload.message);
      break;
  }
});
```

### רשימת Events מלאה:

| Event Type | מתי נשלח | Payload עיקרי |
|------------|----------|---------------|
| `APPLICATION_LOADED` | כשה-iframe נטען | userId, isTeacher |
| `TASK_STARTED` | תלמיד התחיל משימה | taskId, studentId |
| `TASK_PROGRESS` | עדכון התקדמות | taskId, progress (0-100) |
| `TASK_COMPLETED` | תלמיד סיים | taskId, score, analytics |
| `TASK_SUBMITTED` | הוגש לבדיקה | taskId, submissionId |
| `GRADE_UPDATED` | מורה נתן ציון | studentId, grade, feedback |
| `XP_EARNED` | נצברו נקודות | studentId, xpAmount, level |
| `ACHIEVEMENT_UNLOCKED` | הישג חדש | achievementId, name |
| `COURSE_CREATED` | מורה יצר קורס | courseId, title |
| `TASK_ASSIGNED` | מורה הקצה משימה | taskId, studentCount |
| `CLOSE_EVENT` | סגירת חלון | lastView |
| `ERROR` | שגיאה | code, message |

---

## 5. API Calls לדשבורד שלכם

אם אתם רוצים לשלוף נתונים ישירות (לא דרך postMessage), השתמשו ב-APIs שלנו:

### Base URL:
```
https://us-central1-ai-lms-system.cloudfunctions.net/wizdiApi
```

### Authentication Header:
```
Authorization: Bearer {token_from_login}
```

### Endpoints זמינים:

| Endpoint | Method | תיאור |
|----------|--------|-------|
| `/student/{id}/stats` | POST | סטטיסטיקות תלמיד |
| `/class/{id}/stats` | POST | סטטיסטיקות כיתה |
| `/teacher/{id}/dashboard` | POST | דשבורד מורה |
| `/task/{id}/results` | POST | תוצאות משימה |
| `/activity` | POST | לוג פעילויות |

כל הקריאות דורשות `apiKey` ו-`apiSecret` ב-body.

---

## 6. Login Flow

כאשר משתמש Wizdi רוצה להיכנס למערכת שלנו:

```
1. Wizdi User clicks "Open AI LMS"
           │
           ▼
2. Wizdi Backend calls our Login API
   POST /wizdiAuth/login
   Body: { apiKey, apiSecret, uid, locale, isTeacher, classes, ... }
           │
           ▼
3. We return: { token, uid }
           │
           ▼
4. Wizdi opens iframe with:
   src="...?userId={uid}&ctoken={token}"
           │
           ▼
5. Our system validates token and shows UI
           │
           ▼
6. We send postMessage("APPLICATION_LOADED")
```

---

## 7. User Data Mapping

אנחנו צריכים לקבל את הנתונים הבאים על כל משתמש:

### Teacher (מורה):
```json
{
  "uid": "wizdi_teacher_123",          // Required - Wizdi user ID
  "locale": "he",                       // Required - 'he' or 'ar'
  "isTeacher": true,                    // Required
  "displayName": "שרה כהן",             // Optional - for display
  "email": "sara@school.edu",           // Optional - for notifications
  "classes": [                          // Required - at least one
    { "id": "class_001", "name": "כיתה ו-1" }
  ],
  "groups": [],                         // Optional
  "schoolName": "בית ספר הדגל",         // Required
  "schoolId": "school_456"              // Required
}
```

### Student (תלמיד):
```json
{
  "uid": "wizdi_student_789",
  "locale": "he",
  "isTeacher": false,
  "displayName": "דני לוי",
  "classes": [
    { "id": "class_001", "name": "כיתה ו-1" }
  ],
  "groups": [
    { "id": "group_math", "name": "מתמטיקה מתקדמת" }
  ],
  "schoolName": "בית ספר הדגל",
  "schoolId": "school_456"
}
```

---

## 8. Dashboard Data Fields

הנתונים שאנחנו יכולים לספק לדשבורד שלכם:

### עבור תלמיד:
- ✅ ציון ממוצע (averageScore)
- ✅ משימות שהושלמו (completedTasks)
- ✅ משימות בהמתנה (pendingTasks)
- ✅ זמן למידה כולל (totalTimeMinutes)
- ✅ נקודות XP (totalXp)
- ✅ רמה (level)
- ✅ Streak ימי למידה (currentStreak)
- ✅ התקדמות לפי נושא (progressBySubject)
- ✅ פעילות אחרונה (lastActiveAt)

### עבור מורה:
- ✅ מספר תלמידים (totalStudents)
- ✅ מספר כיתות (totalClasses)
- ✅ מספר קורסים (totalCourses)
- ✅ הגשות ממתינות לבדיקה (pendingSubmissions)
- ✅ ציון ממוצע כיתתי (classAverageScore)
- ✅ רשימת תלמידים עם ביצועים (studentsList)
- ✅ התראות על תלמידים בסיכון (alerts)

---

## 9. שאלות שצריכות תשובה

לפני שנתחיל, נשמח לקבל תשובות על:

1. **איזה נתונים אתם רוצים להציג בדשבורד שלכם?**
   - [ ] כל מה שציינו למעלה
   - [ ] רק ציונים בסיסיים
   - [ ] אחר: ___________

2. **איך אתם רוצים לקבל עדכונים?**
   - [ ] Real-time דרך postMessage (מומלץ)
   - [ ] Polling ל-API כל X דקות
   - [ ] Webhooks (אתם קוראים לנו)
   - [ ] שילוב של הנ"ל

3. **האם יש לכם UI מוכן לדשבורד או שאנחנו בונים?**
   - [ ] יש לנו UI, רק צריכים data
   - [ ] אנחנו נשתמש ב-UI שלכם ב-iframe
   - [ ] שילוב - iframe + data למקומות ספציפיים

4. **מה קורה כשמשתמש מנותק?**
   - [ ] Session timeout אוטומטי
   - [ ] משתמש צריך ללחוץ logout
   - [ ] סנכרון עם Wizdi session

5. **האם יש לכם סביבת staging לבדיקות?**
   - [ ] כן, URL: ___________
   - [ ] לא, נבדוק ישירות ב-production

6. **מי אנשי הקשר הטכניים מצידכם?**
   - שם: ___________
   - אימייל: ___________
   - טלפון: ___________

---

## 10. Timeline מוצע

| שלב | תיאור | משך |
|-----|-------|-----|
| 1 | קבלת credentials + תשובות לשאלות | - |
| 2 | הקמת סביבת staging | - |
| 3 | אינטגרציית Login | - |
| 4 | בדיקת iframe בסיסי | - |
| 5 | אינטגרציית postMessage | - |
| 6 | אינטגרציית APIs לדשבורד | - |
| 7 | בדיקות End-to-End | - |
| 8 | העלאה ל-Production | - |

---

## 11. אנשי קשר מצידנו

| תפקיד | שם | אימייל |
|-------|-----|--------|
| Technical Lead | [שם] | [אימייל] |
| Backend Developer | [שם] | [אימייל] |
| Project Manager | [שם] | [אימייל] |

---

## 12. נספח - קוד דוגמה מלא

### Wizdi Side - Full Integration Example:

```javascript
// wizdi-ai-lms-integration.js

class AILMSIntegration {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = 'https://us-central1-ai-lms-system.cloudfunctions.net';
    this.iframeBaseUrl = 'https://ai-lms-system.web.app';
    this.currentToken = null;
    this.currentUserId = null;

    this.setupMessageListener();
  }

  // Login and get token
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

  // Get iframe URL
  getIframeUrl(view = 'student', options = {}) {
    const params = new URLSearchParams({
      userId: this.currentUserId,
      ctoken: this.currentToken,
      ...options
    });

    return `${this.iframeBaseUrl}/wizdi/${view}?${params}`;
  }

  // Open iframe in container
  openInContainer(containerId, view, options) {
    const container = document.getElementById(containerId);
    const iframe = document.createElement('iframe');

    iframe.src = this.getIframeUrl(view, options);
    iframe.allow = 'fullscreen; clipboard-write; microphone';
    iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
    iframe.style.cssText = 'width:100%;height:100%;border:none;';

    container.innerHTML = '';
    container.appendChild(iframe);

    this.iframe = iframe;
  }

  // Send command to iframe
  sendCommand(type, data = {}) {
    if (this.iframe) {
      this.iframe.contentWindow.postMessage({ type, ...data }, '*');
    }
  }

  // Setup message listener
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (!event.origin.includes('ai-lms-system')) return;

      const { source, type, payload } = event.data;
      if (source !== 'ai-lms-system') return;

      this.handleEvent(type, payload);
    });
  }

  // Handle events from iframe
  handleEvent(type, payload) {
    console.log(`AI LMS Event: ${type}`, payload);

    // Override these methods in your implementation
    switch (type) {
      case 'APPLICATION_LOADED':
        this.onApplicationLoaded?.(payload);
        break;
      case 'TASK_COMPLETED':
        this.onTaskCompleted?.(payload);
        break;
      case 'GRADE_UPDATED':
        this.onGradeUpdated?.(payload);
        break;
      case 'XP_EARNED':
        this.onXpEarned?.(payload);
        break;
      case 'CLOSE_EVENT':
        this.onCloseEvent?.(payload);
        break;
      case 'ERROR':
        this.onError?.(payload);
        break;
    }
  }

  // Fetch student stats
  async getStudentStats(studentId, dateFrom, dateTo) {
    const response = await fetch(`${this.baseUrl}/wizdiApi/student/${studentId}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        dateFrom,
        dateTo
      })
    });

    return response.json();
  }

  // Fetch class stats
  async getClassStats(classId, teacherId) {
    const response = await fetch(`${this.baseUrl}/wizdiApi/class/${classId}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        teacherId
      })
    });

    return response.json();
  }
}

// Usage Example:
const aiLms = new AILMSIntegration({
  apiKey: 'wizdi_pk_live_xxxxx',
  apiSecret: 'wizdi_sk_live_xxxxx'
});

// Event handlers
aiLms.onTaskCompleted = (payload) => {
  updateWizdiDashboard('task_completed', payload);
};

aiLms.onGradeUpdated = (payload) => {
  updateWizdiDashboard('grade_updated', payload);
};

// Login and open
async function openAILMS(wizdiUser, containerId) {
  await aiLms.login(wizdiUser);

  const view = wizdiUser.isTeacher ? 'teacher' : 'student';
  aiLms.openInContainer(containerId, view);
}
```

---

**מצפים לתשובותיכם ולהתחלת שיתוף הפעולה!**
