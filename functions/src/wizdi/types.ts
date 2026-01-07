/**
 * Wizdi Integration Types
 */

// Login Request from Wizdi
export interface WizdiLoginRequest {
  apiKey: string;
  apiSecret: string;
  uid: string; // Wizdi user ID
  locale: 'he' | 'ar';
  isTeacher: boolean;
  displayName?: string;
  email?: string;
  classes: Array<{ id: string; name: string }>;
  groups?: Array<{ id: string; name: string }>;
  schoolName: string;
  schoolId: string;
}

// Login Response
export interface WizdiLoginResponse {
  status: 'success' | 'error';
  token?: string;
  uid?: string; // Our internal user ID
  expiresIn?: number;
  code?: string;
  message?: string;
}

// Token Refresh Request
export interface WizdiRefreshRequest {
  apiKey: string;
  apiSecret: string;
  token: string;
}

// Wizdi User stored in Firestore
export interface WizdiUser {
  id: string; // Our internal ID
  wizdiUid: string; // Wizdi's user ID
  isTeacher: boolean;
  locale: 'he' | 'ar';
  displayName?: string;
  email?: string;
  classes: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  schoolName: string;
  schoolId: string;
  createdAt: FirebaseFirestore.Timestamp;
  lastLoginAt: FirebaseFirestore.Timestamp;
}

// Wizdi Session
export interface WizdiSession {
  id: string;
  wizdiUserId: string;
  ourUserId: string;
  token: string;
  expiresAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  isActive: boolean;
}

// Student Stats Response
export interface StudentStatsResponse {
  studentId: string;
  displayName: string;
  stats: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    averageScore: number;
    totalXp: number;
    currentLevel: number;
    currentStreak: number;
    longestStreak: number;
    totalTimeMinutes: number;
    lastActiveAt: string | null;
  };
  progressBySubject: Array<{
    subject: string;
    completedTasks: number;
    averageScore: number;
  }>;
  recentActivity: Array<{
    type: string;
    taskTitle: string;
    score?: number;
    timestamp: string;
  }>;
}

// Class Stats Response
export interface ClassStatsResponse {
  classId: string;
  className: string;
  studentCount: number;
  stats: {
    averageScore: number;
    averageCompletion: number;
    totalTasksAssigned: number;
    totalSubmissions: number;
  };
  students: Array<{
    studentId: string;
    displayName: string;
    completedTasks: number;
    averageScore: number;
    status: 'excellent' | 'good' | 'needs_attention';
  }>;
  taskStats: Array<{
    taskId: string;
    title: string;
    submissions: number;
    averageScore: number;
    completionRate: number;
  }>;
}

// Teacher Dashboard Response
export interface TeacherDashboardResponse {
  teacherId: string;
  displayName: string;
  summary: {
    totalCourses: number;
    totalStudents: number;
    totalClasses: number;
    pendingSubmissions: number;
    tasksThisWeek: number;
  };
  classes: Array<{
    classId: string;
    name: string;
    studentCount: number;
    averageScore: number;
    pendingTasks: number;
  }>;
  recentSubmissions: Array<{
    submissionId: string;
    studentName: string;
    taskTitle: string;
    submittedAt: string;
    status: string;
  }>;
  alerts: Array<{
    type: string;
    studentId: string;
    studentName: string;
    message: string;
  }>;
}

// Task Results Response
export interface TaskResultsResponse {
  taskId: string;
  title: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  maxScore: number;
  dueDate: string | null;
  stats: {
    totalAssigned: number;
    submitted: number;
    graded: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
  };
  submissions: Array<{
    submissionId: string;
    studentId: string;
    studentName: string;
    status: string;
    score: number | null;
    submittedAt: string | null;
    gradedAt: string | null;
    timeSpentMinutes: number | null;
  }>;
}

// PostMessage Event Types
export type WizdiEventType =
  | 'APPLICATION_LOADED'
  | 'TASK_STARTED'
  | 'TASK_PROGRESS'
  | 'TASK_COMPLETED'
  | 'TASK_SUBMITTED'
  | 'GRADE_UPDATED'
  | 'XP_EARNED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'COURSE_CREATED'
  | 'TASK_ASSIGNED'
  | 'CLOSE_EVENT'
  | 'ERROR';

export interface WizdiPostMessageEvent<T = any> {
  source: 'ai-lms-system';
  type: WizdiEventType;
  payload: T;
}

// Error Codes
export type WizdiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'MISSING_PARAMS'
  | 'INVALID_USER'
  | 'INVALID_TASK'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';
