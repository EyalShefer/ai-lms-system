# Comprehensive Technical Document for Wizdi Team
# AI LMS System Integration - Technical Overview

---

## Table of Contents
1. [What is AI LMS System?](#1-what-is-ai-lms-system)
2. [What We Provide](#2-what-we-provide)
3. [Data We Generate](#3-data-we-generate)
4. [Integration Architecture](#4-integration-architecture)
5. [Authentication Flow](#5-authentication-flow)
6. [API Endpoints](#6-api-endpoints)
7. [What You Need to Implement](#7-what-you-need-to-implement)
8. [Expected Outcome](#8-expected-outcome)
9. [Practical Code Examples](#9-practical-code-examples)

---

## 1. What is AI LMS System?

### In Brief
An AI-powered learning management system that enables teachers to create content and assignments, and students to learn and complete tasks - all with artificial intelligence support.

### Core Capabilities

| For Teachers | For Students |
|--------------|--------------|
| Create courses and learning units | Complete interactive assignments |
| Assign tasks to classes | Track personal progress |
| Monitor grades and progress | Earn XP points and achievements |
| Receive alerts for at-risk students | Get immediate AI feedback |
| Generate content with AI | Maintain learning streaks |

### Supported Task Types

- **Practice** - Q&A with immediate feedback
- **Free Text** - Essay writing with AI grading
- **Presentations** - View content and answer questions
- **Projects** - Long-term assignments
- **Quizzes** - Tests with automatic grading

---

## 2. What We Provide

### 2.1 Complete User Interface (iframe)

You embed our system as an iframe within Wizdi:

```
┌─────────────────────────────────────────┐
│           WIZDI Dashboard               │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │     AI LMS System (iframe)        │  │
│  │                                   │  │
│  │   - Complete UI ready             │  │
│  │   - Hebrew/Arabic support         │  │
│  │   - Responsive design             │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Students/Teachers work within our system** - you don't need to build any UI!

### 2.2 APIs for Data Retrieval

If you want to display data in your own dashboard (outside the iframe):

| API | Returns |
|-----|---------|
| Student Stats | Grades, XP, streak, student progress |
| Class Stats | Class-wide statistics for teachers |
| Teacher Dashboard | Complete teacher summary |
| Task Results | Specific task results |

### 2.3 Real-time Events (PostMessage)

Every action in our system triggers an update to you:

```javascript
// Example - Student completed a task
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

## 3. Data We Generate

### 3.1 Student Data

| Field | Description | Example |
|-------|-------------|---------|
| `completedTasks` | Tasks completed | 15 |
| `pendingTasks` | Tasks pending | 3 |
| `averageScore` | Average score | 82.5 |
| `totalXp` | Total experience points | 1,250 |
| `currentLevel` | Current level | 5 |
| `currentStreak` | Consecutive learning days | 7 |
| `longestStreak` | Record streak days | 14 |
| `totalTimeMinutes` | Total learning time (minutes) | 480 |
| `lastActiveAt` | Last activity timestamp | 2024-01-07 |
| `progressBySubject` | Progress per subject | [{math: 88%}, {hebrew: 75%}] |

### 3.2 Class Data (For Teachers)

| Field | Description | Example |
|-------|-------------|---------|
| `studentCount` | Number of students | 25 |
| `averageScore` | Class average score | 78.3 |
| `averageCompletion` | Average completion rate | 85% |
| `totalTasksAssigned` | Tasks assigned | 20 |
| `students[]` | Student list with grades | [...] |
| `alerts[]` | At-risk student alerts | [...] |

### 3.3 Task Data

| Field | Description | Example |
|-------|-------------|---------|
| `totalAssigned` | Students assigned | 25 |
| `submitted` | Submissions received | 20 |
| `graded` | Submissions graded | 18 |
| `averageScore` | Average score | 76.5 |
| `questionAnalysis` | Per-question analysis | [{q1: 88% correct}] |

---

## 4. Integration Architecture

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

### Three Communication Channels:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| **Login API** | Wizdi → Us | Authentication and login |
| **PostMessage** | Us → Wizdi | Real-time updates |
| **REST APIs** | Wizdi → Us | Dashboard data retrieval |

---

## 5. Authentication Flow

### Complete Flow - From User Click to System Display

```
User in Wizdi clicks "Open AI LMS"
              │
              ▼
┌─────────────────────────────────────┐
│  1. Wizdi Backend sends Login       │
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
│  2. We return Token                 │
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
│  3. Wizdi opens iframe              │
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
│  4. Our system loads                │
│     and sends APPLICATION_LOADED    │
│                                     │
│  postMessage({                      │
│    source: "ai-lms-system",         │
│    type: "APPLICATION_LOADED",      │
│    payload: { userId, isTeacher }   │
│  })                                 │
└─────────────────┬───────────────────┘
                  │
                  ▼
        User sees the system
         and can start working!
```

---

## 6. API Endpoints

### 6.1 Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wizdiAuth/login` | POST | Login and receive token |
| `/wizdiAuth/refresh` | POST | Refresh token |

#### Login Request:
```json
{
  "apiKey": "wizdi_pk_live_xxxxx",
  "apiSecret": "wizdi_sk_live_xxxxx",
  "uid": "wizdi_user_123",
  "locale": "he",
  "isTeacher": false,
  "classes": [{ "id": "class_001", "name": "Class 6-1" }],
  "groups": [],
  "schoolName": "Demo School",
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

| Type | URL |
|------|-----|
| **Teacher Dashboard** | `/wizdi/teacher?userId={uid}&ctoken={token}&locale={locale}` |
| **Student Dashboard** | `/wizdi/student?userId={uid}&ctoken={token}&locale={locale}` |
| **Specific Task** | `/wizdi/task/{taskId}?userId={uid}&ctoken={token}` |
| **Specific Course** | `/wizdi/course/{courseId}?userId={uid}&ctoken={token}` |

**Base URL:** `https://ai-lms-system.web.app`

### 6.3 Data APIs

**Base URL:** `https://us-central1-ai-lms-system.cloudfunctions.net/wizdiApi`

| Endpoint | Description |
|----------|-------------|
| `POST /student/{studentId}/stats` | Student statistics |
| `POST /class/{classId}/stats` | Class statistics |
| `POST /teacher/{teacherId}/dashboard` | Full teacher dashboard |
| `POST /task/{taskId}/results` | Task results |
| `POST /activity` | Activity log |

All requests require:
```json
{
  "apiKey": "wizdi_pk_...",
  "apiSecret": "wizdi_sk_..."
}
```

### 6.4 PostMessage Events (From Us to You)

| Event | When Sent | Payload Contents |
|-------|-----------|------------------|
| `APPLICATION_LOADED` | iframe loaded | userId, isTeacher |
| `TASK_STARTED` | Student started task | taskId, studentId, courseName |
| `TASK_PROGRESS` | Progress update | taskId, progress (0-100) |
| `TASK_COMPLETED` | Student finished | taskId, score, analytics |
| `TASK_SUBMITTED` | Submitted for review | taskId, submissionId |
| `GRADE_UPDATED` | Teacher graded | studentId, grade, feedback |
| `XP_EARNED` | Points earned | studentId, xpAmount, level |
| `ACHIEVEMENT_UNLOCKED` | New achievement | achievementId, name |
| `COURSE_CREATED` | Teacher created course | courseId, title |
| `TASK_ASSIGNED` | Teacher assigned task | taskId, studentCount |
| `CLOSE_EVENT` | User exited | lastView |
| `ERROR` | Error occurred | code, message |

### 6.5 PostMessage Commands (From You to Us)

| Command | Action |
|---------|--------|
| `NAVIGATE_TO_TASK` | Opens specific task |
| `NAVIGATE_TO_COURSE` | Opens specific course |
| `REFRESH_DATA` | Refreshes data |

---

## 7. What You Need to Implement

### 7.1 Before Starting

- [ ] **Provide us credentials** - API Key + Secret for production and sandbox environments
- [ ] **Add domains to your whitelist:**
  ```
  https://ai-lms-system.web.app
  https://ai-lms-system.firebaseapp.com
  https://us-central1-ai-lms-system.cloudfunctions.net
  ```

### 7.2 Implementation on Your Side

#### A. Add iframe to your dashboard:

```html
<iframe
  id="ai-lms-iframe"
  src="[URL from login response]"
  allow="fullscreen; clipboard-write; microphone"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  style="width: 100%; height: 100%; border: none;"
/>
```

#### B. Listen to PostMessages:

```javascript
window.addEventListener('message', (event) => {
  // Verify origin
  if (!event.origin.includes('ai-lms-system')) return;

  const { source, type, payload } = event.data;
  if (source !== 'ai-lms-system') return;

  // Handle events
  switch (type) {
    case 'TASK_COMPLETED':
      // Update your dashboard
      updateStudentProgress(payload);
      break;
    case 'GRADE_UPDATED':
      // Notify user
      showNotification(`New grade: ${payload.grade}`);
      break;
    // ... etc
  }
});
```

#### C. Call Login API before opening iframe:

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

## 8. Expected Outcome

### What Users Will See

#### Student View:
```
┌─────────────────────────────────────────────────────────────┐
│  Wizdi Dashboard                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ╔═══════════════════════════════════════════════════╗│  │
│  │  ║  Hello Danny!                                     ║│  │
│  │  ║                                                   ║│  │
│  │  ║  XP: 1,250    Streak: 7 days    Level 5          ║│  │
│  │  ║                                                   ║│  │
│  │  ║  My Tasks:                                        ║│  │
│  │  ║  ┌────────────────────────────────────────────┐  ║│  │
│  │  ║  │ Adding Fractions    [85/100]    Completed  │  ║│  │
│  │  ║  │ Geometry            [In Progress] Open     │  ║│  │
│  │  ║  │ Final Exam          [Not Started] New      │  ║│  │
│  │  ║  └────────────────────────────────────────────┘  ║│  │
│  │  ╚═══════════════════════════════════════════════════╝│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Teacher View:
```
┌─────────────────────────────────────────────────────────────┐
│  Wizdi Dashboard                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ╔═══════════════════════════════════════════════════╗│  │
│  │  ║  Teacher Dashboard - Sarah Cohen                  ║│  │
│  │  ║                                                   ║│  │
│  │  ║  120 Students   5 Courses   15 New Submissions    ║│  │
│  │  ║                                                   ║│  │
│  │  ║  Class 6-1:                    Average: 78.3      ║│  │
│  │  ║  ┌────────────────────────────────────────────┐  ║│  │
│  │  ║  │ Danny Cohen     92    Excellent            │  ║│  │
│  │  ║  │ Michelle Levi   75    Good                 │  ║│  │
│  │  ║  │ Joseph A.       60    Needs Attention      │  ║│  │
│  │  ║  └────────────────────────────────────────────┘  ║│  │
│  │  ╚═══════════════════════════════════════════════════╝│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### What Wizdi Receives

1. **Real-time (PostMessage):**
   - Every time a student completes a task
   - Every time a teacher grades a submission
   - Every time someone earns XP
   - Error notifications

2. **On-demand (API):**
   - Complete statistics for any student
   - Class-wide summaries
   - Performance analytics
   - Activity logs

---

## 9. Practical Code Examples

### 9.1 Complete Integration Class (JavaScript)

```javascript
class AILMSIntegration {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = 'https://us-central1-ai-lms-system.cloudfunctions.net';
    this.iframeBaseUrl = 'https://ai-lms-system.web.app';
    this.currentToken = null;
    this.currentUserId = null;

    // Setup event listener
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

### 9.2 Usage Example

```javascript
// Create instance
const aiLms = new AILMSIntegration({
  apiKey: 'wizdi_pk_live_xxxxx',
  apiSecret: 'wizdi_sk_live_xxxxx'
});

// Configure event handlers
aiLms.eventHandlers.TASK_COMPLETED = (payload) => {
  // Update Wizdi dashboard
  wizdiDashboard.updateStudentScore(payload.studentId, payload.score);

  // Show notification
  wizdiNotifications.show(`${payload.studentName} completed task with score ${payload.score}`);
};

aiLms.eventHandlers.GRADE_UPDATED = (payload) => {
  // Update grade in dashboard
  wizdiDashboard.updateGrade(payload.studentId, payload.taskId, payload.grade);
};

aiLms.eventHandlers.XP_EARNED = (payload) => {
  // Update XP
  wizdiDashboard.updateXP(payload.studentId, payload.totalXp, payload.level);
};

// Open system for user
async function openForUser(wizdiUser, containerId) {
  try {
    // Login
    await aiLms.login(wizdiUser);

    // Open iframe
    const view = wizdiUser.isTeacher ? 'teacher' : 'student';
    aiLms.openInContainer(containerId, view, { locale: 'he' });

  } catch (error) {
    console.error('Failed to open AI LMS:', error);
    wizdiNotifications.showError('Error opening learning system');
  }
}

// Example call
openForUser({
  id: 'wizdi_user_12345',
  isTeacher: false,
  locale: 'he',
  classes: [{ id: 'class_001', name: 'Class 6-1' }],
  groups: [],
  schoolName: 'Demo School',
  schoolId: 'school_456'
}, 'ai-lms-container');
```

---

## Summary

### What We Provide:
- Complete AI-powered learning system
- Ready-to-use user interface (iframe)
- APIs for data retrieval
- Real-time updates

### What You Need to Do:
- Provide credentials
- Add domains to whitelist
- Implement Login + iframe embedding
- Listen to PostMessages

### The Result:
Your users will be able to learn and teach with AI, and you'll receive all data in real-time!

---

**Questions? Contact our technical team.**
