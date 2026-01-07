# Wizdi Integration API - מסמך טכני

## סקירה כללית

מסמך זה מגדיר את ה-API שהמערכת שלנו חושפת לשילוב עם פלטפורמת Wizdi.
המערכת שלנו תוטמע כ-iframe בתוך Wizdi, ותתקשר דרך Login API, PostMessage, ו-REST APIs.

---

## 1. ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────────┐
│                         WIZDI PLATFORM                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Wizdi Dashboard                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Our System (iframe)                     │  │  │
│  │  │                                                      │  │  │
│  │  │   Teacher View    │    Student View                  │  │  │
│  │  │   - Create course │    - Do assignments              │  │  │
│  │  │   - Assign tasks  │    - Submit answers              │  │  │
│  │  │   - View stats    │    - Track progress              │  │  │
│  │  │                                                      │  │  │
│  │  └──────────────────────┬──────────────────────────────┘  │  │
│  │                         │ postMessage                      │  │
│  │                         ▼                                  │  │
│  │              Wizdi Event Handler                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ REST API                          │
│                              ▼                                   │
│                    Wizdi Dashboard Display                       │
│                    (grades, progress, stats)                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ API Calls
                               ▼
              ┌────────────────────────────────┐
              │     Our Cloud Functions        │
              │  - /auth/wizdi-login           │
              │  - /api/stats/*                │
              │  - /api/tasks/*                │
              └────────────────────────────────┘
```

---

## 2. Authentication API

### 2.1 Login Endpoint

כאשר משתמש Wizdi רוצה להיכנס למערכת שלנו, Wizdi קורא ל-endpoint הזה.

**Endpoint:**
```
POST https://us-central1-[PROJECT_ID].cloudfunctions.net/wizdiAuth/login
```

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "apiKey": "wizdi_api_key_xxxxx",
  "apiSecret": "wizdi_secret_xxxxx",
  "uid": "wizdi_user_12345",
  "locale": "he",
  "isTeacher": true,
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

**Response - Success (200):**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "uid": "our_internal_user_id_abc123",
  "expiresIn": 3600
}
```

**Response - Error (401):**
```json
{
  "status": "error",
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid API key or secret"
}
```

**Response - Error (400):**
```json
{
  "status": "error",
  "code": "MISSING_PARAMS",
  "message": "Missing required parameter: uid"
}
```

### 2.2 Token Refresh

**Endpoint:**
```
POST https://us-central1-[PROJECT_ID].cloudfunctions.net/wizdiAuth/refresh
```

**Request Body:**
```json
{
  "apiKey": "wizdi_api_key_xxxxx",
  "apiSecret": "wizdi_secret_xxxxx",
  "token": "current_token_xxxxx"
}
```

**Response:**
```json
{
  "status": "success",
  "token": "new_token_xxxxx",
  "expiresIn": 3600
}
```

---

## 3. Iframe Embed URLs

### 3.1 Teacher Dashboard (מורה)

```
https://[OUR_DOMAIN]/wizdi/teacher?userId={userId}&ctoken={token}&locale={locale}
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | Yes | Our internal user ID (from login response) |
| ctoken | string | Yes | Authentication token (from login response) |
| locale | string | No | 'he' or 'ar' (default: 'he') |
| schoolId | string | No | Filter by school |

### 3.2 Student Dashboard (תלמיד)

```
https://[OUR_DOMAIN]/wizdi/student?userId={userId}&ctoken={token}&locale={locale}
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | Yes | Our internal user ID |
| ctoken | string | Yes | Authentication token |
| locale | string | No | 'he' or 'ar' |
| taskId | string | No | Open specific task directly |

### 3.3 Specific Task View

```
https://[OUR_DOMAIN]/wizdi/task/{taskId}?userId={userId}&ctoken={token}
```

### 3.4 Course Viewer

```
https://[OUR_DOMAIN]/wizdi/course/{courseId}?userId={userId}&ctoken={token}&unitId={unitId}
```

---

## 4. PostMessage API

המערכת שלנו שולחת הודעות לחלון האב (Wizdi) דרך postMessage.

### 4.1 Event Format

כל ההודעות נשלחות בפורמט הבא:
```javascript
window.parent.postMessage({
  source: "ai-lms-system",
  type: "EVENT_TYPE",
  payload: { ... }
}, "*");
```

### 4.2 Events - From Our System to Wizdi

#### 4.2.1 Application Loaded
```javascript
{
  source: "ai-lms-system",
  type: "APPLICATION_LOADED",
  payload: {
    userId: "user_123",
    isTeacher: true,
    timestamp: "2024-01-07T10:30:00Z"
  }
}
```

#### 4.2.2 Task Started (תלמיד התחיל משימה)
```javascript
{
  source: "ai-lms-system",
  type: "TASK_STARTED",
  payload: {
    taskId: "task_456",
    studentId: "student_789",
    courseId: "course_abc",
    courseName: "מתמטיקה כיתה ו",
    taskTitle: "חיבור וחיסור שברים",
    startedAt: "2024-01-07T10:30:00Z"
  }
}
```

#### 4.2.3 Task Progress Update (עדכון התקדמות)
```javascript
{
  source: "ai-lms-system",
  type: "TASK_PROGRESS",
  payload: {
    taskId: "task_456",
    studentId: "student_789",
    progress: 65,
    currentStep: 7,
    totalSteps: 10,
    timeSpentSeconds: 420
  }
}
```

#### 4.2.4 Task Completed (תלמיד סיים משימה)
```javascript
{
  source: "ai-lms-system",
  type: "TASK_COMPLETED",
  payload: {
    taskId: "task_456",
    studentId: "student_789",
    submissionId: "sub_xyz",
    score: 85,
    maxScore: 100,
    timeSpentSeconds: 900,
    completedAt: "2024-01-07T10:45:00Z",
    analytics: {
      correctAnswers: 8,
      totalQuestions: 10,
      hintsUsed: 2,
      averageTimePerQuestion: 90
    }
  }
}
```

#### 4.2.5 Task Submitted (הוגש לבדיקה)
```javascript
{
  source: "ai-lms-system",
  type: "TASK_SUBMITTED",
  payload: {
    taskId: "task_456",
    studentId: "student_789",
    submissionId: "sub_xyz",
    submittedAt: "2024-01-07T10:45:00Z"
  }
}
```

#### 4.2.6 Grade Updated (מורה נתן ציון)
```javascript
{
  source: "ai-lms-system",
  type: "GRADE_UPDATED",
  payload: {
    taskId: "task_456",
    studentId: "student_789",
    teacherId: "teacher_123",
    grade: 90,
    maxGrade: 100,
    feedback: "עבודה מצוינת!",
    gradedAt: "2024-01-07T11:00:00Z"
  }
}
```

#### 4.2.7 XP Earned (נצברו נקודות)
```javascript
{
  source: "ai-lms-system",
  type: "XP_EARNED",
  payload: {
    studentId: "student_789",
    xpAmount: 50,
    totalXp: 1250,
    reason: "task_completion",
    level: 5
  }
}
```

#### 4.2.8 Achievement Unlocked (הישג חדש)
```javascript
{
  source: "ai-lms-system",
  type: "ACHIEVEMENT_UNLOCKED",
  payload: {
    studentId: "student_789",
    achievementId: "streak_7_days",
    achievementName: "שבוע של למידה",
    description: "למדת 7 ימים ברציפות!"
  }
}
```

#### 4.2.9 Course Created (מורה יצר קורס)
```javascript
{
  source: "ai-lms-system",
  type: "COURSE_CREATED",
  payload: {
    courseId: "course_new",
    teacherId: "teacher_123",
    title: "היסטוריה כיתה ח",
    subject: "היסטוריה",
    gradeLevel: "ח",
    createdAt: "2024-01-07T09:00:00Z"
  }
}
```

#### 4.2.10 Task Assigned (מורה הקצה משימה)
```javascript
{
  source: "ai-lms-system",
  type: "TASK_ASSIGNED",
  payload: {
    taskId: "task_new",
    teacherId: "teacher_123",
    courseId: "course_abc",
    title: "מבחן סיכום",
    assignedTo: "class",
    classId: "class_001",
    studentCount: 25,
    dueDate: "2024-01-14T23:59:00Z"
  }
}
```

#### 4.2.11 Close Event (משתמש סגר/יצא)
```javascript
{
  source: "ai-lms-system",
  type: "CLOSE_EVENT",
  payload: {
    userId: "user_123",
    lastView: "task",
    taskId: "task_456"
  }
}
```

#### 4.2.12 Error Event
```javascript
{
  source: "ai-lms-system",
  type: "ERROR",
  payload: {
    code: "LOAD_FAILED",
    message: "Failed to load task data",
    context: { taskId: "task_456" }
  }
}
```

### 4.3 Events - From Wizdi to Our System

אנחנו מאזינים להודעות מ-Wizdi:

#### 4.3.1 Navigate to Task
```javascript
// Wizdi sends:
{
  type: "NAVIGATE_TO_TASK",
  taskId: "task_456"
}

// Our system opens the specific task
```

#### 4.3.2 Navigate to Course
```javascript
{
  type: "NAVIGATE_TO_COURSE",
  courseId: "course_abc",
  unitId: "unit_01" // optional
}
```

#### 4.3.3 Refresh Data
```javascript
{
  type: "REFRESH_DATA"
}
// Our system reloads current view data
```

---

## 5. REST APIs for Dashboard Data

Wizdi יכול לקרוא ל-APIs אלה כדי לשלוף נתונים לדשבורד שלהם.

### 5.1 Student Stats

**Endpoint:**
```
POST https://us-central1-[PROJECT_ID].cloudfunctions.net/wizdiApi/student/{studentId}/stats
```

**Request Body:**
```json
{
  "apiKey": "wizdi_api_key",
  "apiSecret": "wizdi_secret",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31"
}
```

**Response:**
```json
{
  "studentId": "student_789",
  "displayName": "ישראל ישראלי",
  "stats": {
    "totalTasks": 15,
    "completedTasks": 12,
    "pendingTasks": 3,
    "averageScore": 82.5,
    "totalXp": 1250,
    "currentLevel": 5,
    "currentStreak": 7,
    "longestStreak": 14,
    "totalTimeMinutes": 480,
    "lastActiveAt": "2024-01-07T10:30:00Z"
  },
  "progressBySubject": [
    {
      "subject": "מתמטיקה",
      "completedTasks": 5,
      "averageScore": 88
    },
    {
      "subject": "עברית",
      "completedTasks": 4,
      "averageScore": 79
    }
  ],
  "recentActivity": [
    {
      "type": "task_completed",
      "taskTitle": "חיבור שברים",
      "score": 90,
      "timestamp": "2024-01-07T10:45:00Z"
    }
  ]
}
```

### 5.2 Class Stats (for Teacher)

**Endpoint:**
```
POST https://us-central1-[PROJECT_ID].cloudfunctions.net/wizdiApi/class/{classId}/stats
```

**Request Body:**
```json
{
  "apiKey": "wizdi_api_key",
  "apiSecret": "wizdi_secret",
  "teacherId": "teacher_123"
}
```

**Response:**
```json
{
  "classId": "class_001",
  "className": "כיתה ו-1",
  "studentCount": 25,
  "stats": {
    "averageScore": 78.3,
    "averageCompletion": 85,
    "totalTasksAssigned": 20,
    "totalSubmissions": 340
  },
  "students": [
    {
      "studentId": "student_001",
      "displayName": "דני כהן",
      "completedTasks": 18,
      "averageScore": 92,
      "status": "excellent"
    },
    {
      "studentId": "student_002",
      "displayName": "מיכל לוי",
      "completedTasks": 15,
      "averageScore": 75,
      "status": "good"
    },
    {
      "studentId": "student_003",
      "displayName": "יוסי אברהם",
      "completedTasks": 8,
      "averageScore": 60,
      "status": "needs_attention"
    }
  ],
  "taskStats": [
    {
      "taskId": "task_001",
      "title": "מבחן חיבור",
      "submissions": 23,
      "averageScore": 81,
      "completionRate": 92
    }
  ]
}
```

### 5.3 Teacher Dashboard Summary

**Endpoint:**
```
POST https://us-central1-[PROJECT_ID].cloudfunctions.net/wizdiApi/teacher/{teacherId}/dashboard
```

**Response:**
```json
{
  "teacherId": "teacher_123",
  "displayName": "שרה המורה",
  "summary": {
    "totalCourses": 5,
    "totalStudents": 120,
    "totalClasses": 4,
    "pendingSubmissions": 15,
    "tasksThisWeek": 8
  },
  "classes": [
    {
      "classId": "class_001",
      "name": "כיתה ו-1",
      "studentCount": 25,
      "averageScore": 78,
      "pendingTasks": 3
    }
  ],
  "recentSubmissions": [
    {
      "submissionId": "sub_001",
      "studentName": "דני כהן",
      "taskTitle": "מבחן חיבור",
      "submittedAt": "2024-01-07T10:30:00Z",
      "status": "pending_review"
    }
  ],
  "alerts": [
    {
      "type": "low_performance",
      "studentId": "student_003",
      "studentName": "יוסי אברהם",
      "message": "ירידה בביצועים בשבועיים האחרונים"
    }
  ]
}
```

### 5.4 Task Results

**Endpoint:**
```
POST https://us-central1-[PROJECT_ID].cloudfunctions.net/wizdiApi/task/{taskId}/results
```

**Response:**
```json
{
  "taskId": "task_456",
  "title": "מבחן סיכום - שברים",
  "courseId": "course_abc",
  "courseName": "מתמטיקה כיתה ו",
  "teacherId": "teacher_123",
  "maxScore": 100,
  "dueDate": "2024-01-14T23:59:00Z",
  "stats": {
    "totalAssigned": 25,
    "submitted": 20,
    "graded": 18,
    "averageScore": 76.5,
    "highestScore": 100,
    "lowestScore": 45
  },
  "submissions": [
    {
      "submissionId": "sub_001",
      "studentId": "student_001",
      "studentName": "דני כהן",
      "status": "graded",
      "score": 92,
      "submittedAt": "2024-01-07T10:30:00Z",
      "gradedAt": "2024-01-07T11:00:00Z",
      "timeSpentMinutes": 35
    }
  ],
  "questionAnalysis": [
    {
      "questionId": "q1",
      "questionText": "חבר את השברים 1/2 + 1/4",
      "correctRate": 88,
      "averageTimeSeconds": 45
    }
  ]
}
```

### 5.5 Activity Log

**Endpoint:**
```
POST https://us-central1-[PROJECT_ID].cloudfunctions.net/wizdiApi/activity
```

**Request Body:**
```json
{
  "apiKey": "wizdi_api_key",
  "apiSecret": "wizdi_secret",
  "userId": "user_123",
  "userType": "teacher",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-07",
  "limit": 50
}
```

**Response:**
```json
{
  "activities": [
    {
      "id": "act_001",
      "type": "task_assigned",
      "userId": "teacher_123",
      "details": {
        "taskId": "task_456",
        "taskTitle": "מבחן סיכום",
        "studentCount": 25
      },
      "timestamp": "2024-01-07T09:00:00Z"
    },
    {
      "id": "act_002",
      "type": "submission_graded",
      "userId": "teacher_123",
      "details": {
        "submissionId": "sub_001",
        "studentName": "דני כהן",
        "grade": 92
      },
      "timestamp": "2024-01-07T11:00:00Z"
    }
  ]
}
```

---

## 6. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_CREDENTIALS | 401 | API key or secret is invalid |
| TOKEN_EXPIRED | 401 | Authentication token has expired |
| MISSING_PARAMS | 400 | Required parameter is missing |
| INVALID_USER | 404 | User not found |
| INVALID_TASK | 404 | Task not found |
| PERMISSION_DENIED | 403 | User doesn't have access |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## 7. Rate Limits

| Endpoint | Limit |
|----------|-------|
| /auth/login | 10 requests/minute per IP |
| /auth/refresh | 30 requests/minute per user |
| /api/* (data endpoints) | 100 requests/minute per API key |
| postMessage events | No limit |

---

## 8. Security Considerations

1. **API Keys**: חובה לשמור את ה-apiSecret בצד שרת בלבד
2. **Tokens**: תוקף של שעה, צריך לחדש
3. **HTTPS**: כל התקשורת חייבת להיות מאובטחת
4. **CORS**: רק domains מורשים
5. **Input Validation**: כל הקלטים עוברים סניטציה

---

## 9. Implementation Checklist

### Backend (Cloud Functions)
- [ ] `wizdiAuth/login` - Login endpoint
- [ ] `wizdiAuth/refresh` - Token refresh
- [ ] `wizdiApi/student/:id/stats` - Student statistics
- [ ] `wizdiApi/class/:id/stats` - Class statistics
- [ ] `wizdiApi/teacher/:id/dashboard` - Teacher dashboard
- [ ] `wizdiApi/task/:id/results` - Task results
- [ ] `wizdiApi/activity` - Activity log

### Frontend
- [ ] `/wizdi/teacher` - Teacher embed page
- [ ] `/wizdi/student` - Student embed page
- [ ] `/wizdi/task/:id` - Task view embed
- [ ] PostMessage sender utility
- [ ] PostMessage listener for Wizdi commands

### Database
- [ ] `wizdi_users` collection - mapping Wizdi users to our users
- [ ] `wizdi_sessions` collection - active sessions tracking
- [ ] `wizdi_events` collection - event log for debugging

---

## 10. Testing

### Test Login
```bash
curl -X POST https://us-central1-[PROJECT].cloudfunctions.net/wizdiAuth/login \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "test_key",
    "apiSecret": "test_secret",
    "uid": "wizdi_user_123",
    "locale": "he",
    "isTeacher": true,
    "classes": [{"id": "c1", "name": "Test Class"}],
    "groups": [],
    "schoolName": "Test School",
    "schoolId": "school_1"
  }'
```

### Test PostMessage (Browser Console)
```javascript
// Simulate event from our iframe
window.postMessage({
  source: "ai-lms-system",
  type: "TASK_COMPLETED",
  payload: {
    taskId: "test_task",
    studentId: "test_student",
    score: 85
  }
}, "*");
```
