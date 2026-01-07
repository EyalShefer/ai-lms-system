/**
 * Wizdi API Controller
 * Provides data endpoints for Wizdi dashboard integration
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import {
  StudentStatsResponse,
  ClassStatsResponse,
  TeacherDashboardResponse,
  TaskResultsResponse,
  WizdiErrorCode
} from "./types";
import { validateWizdiApiCredentials, validateWizdiToken } from "./wizdiAuthController";

const db = getFirestore();

/**
 * Create error response
 */
function errorResponse(code: WizdiErrorCode, message: string, httpStatus: number = 400) {
  return { status: "error", code, message, httpStatus };
}

/**
 * Common request validation
 */
async function validateRequest(req: any): Promise<{ valid: boolean; userId?: string; error?: any }> {
  const { apiKey, apiSecret } = req.body || {};
  const authHeader = req.headers.authorization;

  // Check API credentials
  if (apiKey && apiSecret) {
    if (!validateWizdiApiCredentials(apiKey, apiSecret)) {
      return { valid: false, error: errorResponse("INVALID_CREDENTIALS", "Invalid API credentials", 401) };
    }
  }

  // Check token from header or body
  const token = authHeader?.replace("Bearer ", "") || req.body?.ctoken;
  if (token) {
    const validation = await validateWizdiToken(token);
    if (!validation.valid) {
      return { valid: false, error: errorResponse(validation.error || "TOKEN_EXPIRED", "Invalid or expired token", 401) };
    }
    return { valid: true, userId: validation.userId };
  }

  // If neither credentials nor token provided
  if (!apiKey && !authHeader) {
    return { valid: false, error: errorResponse("MISSING_PARAMS", "Missing authentication", 401) };
  }

  return { valid: true };
}

/**
 * Get student statistics
 * POST /wizdiApi/student/:studentId/stats
 */
export const getStudentStats = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ status: "error", message: "Method not allowed" });
      return;
    }

    try {
      const validation = await validateRequest(req);
      if (!validation.valid) {
        res.status(validation.error.httpStatus).json(validation.error);
        return;
      }

      // Extract studentId from URL path
      const pathParts = req.path.split("/");
      const studentIndex = pathParts.indexOf("student");
      const studentId = studentIndex >= 0 ? pathParts[studentIndex + 1] : null;

      if (!studentId) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing studentId"));
        return;
      }

      const { dateFrom, dateTo } = req.body;

      // Get user profile
      const userDoc = await db.collection("users").doc(studentId).get();
      const wizdiUserDoc = await db.collection("wizdi_users").doc(studentId).get();

      const userData = userDoc.exists ? userDoc.data() : wizdiUserDoc.exists ? wizdiUserDoc.data() : null;

      if (!userData) {
        res.status(404).json(errorResponse("INVALID_USER", "Student not found"));
        return;
      }

      // Build date filter
      const dateFilter: any = {};
      if (dateFrom) dateFilter.start = new Date(dateFrom);
      if (dateTo) dateFilter.end = new Date(dateTo);

      // Get submissions for stats
      let submissionsQuery = db.collection("task_submissions")
        .where("studentId", "==", studentId);

      const submissions = await submissionsQuery.get();

      // Calculate stats
      let totalTasks = 0;
      let completedTasks = 0;
      let pendingTasks = 0;
      let totalScore = 0;
      let scoredTasks = 0;
      let totalTimeSeconds = 0;
      let lastActiveAt: Date | null = null;

      const subjectStats: Record<string, { completed: number; totalScore: number; count: number }> = {};
      const recentActivity: Array<{ type: string; taskTitle: string; score?: number; timestamp: string }> = [];

      submissions.forEach((doc) => {
        const data = doc.data();
        totalTasks++;

        // Check date range
        if (dateFilter.start && data.startedAt?.toDate() < dateFilter.start) return;
        if (dateFilter.end && data.startedAt?.toDate() > dateFilter.end) return;

        if (data.status === "submitted" || data.status === "graded") {
          completedTasks++;
          if (data.score !== undefined && data.score !== null) {
            totalScore += data.score;
            scoredTasks++;
          }
        } else if (data.status === "in_progress" || data.status === "new") {
          pendingTasks++;
        }

        if (data.telemetry?.timeSpent) {
          totalTimeSeconds += data.telemetry.timeSpent;
        }

        // Track last activity
        const submittedAt = data.submittedAt?.toDate() || data.startedAt?.toDate();
        if (submittedAt && (!lastActiveAt || submittedAt > lastActiveAt)) {
          lastActiveAt = submittedAt;
        }

        // Subject tracking (would need course data)
        // recentActivity tracking
        if (recentActivity.length < 10) {
          recentActivity.push({
            type: data.status === "graded" ? "task_graded" : "task_completed",
            taskTitle: data.taskTitle || "משימה",
            score: data.score,
            timestamp: submittedAt?.toISOString() || new Date().toISOString()
          });
        }
      });

      // Get XP and streak from user profile
      const xp = userData.xp || 0;
      const streak = userData.streak || 0;
      const level = Math.floor(xp / 100) + 1; // Simple level calculation

      const response: StudentStatsResponse = {
        studentId,
        displayName: userData.displayName || "תלמיד",
        stats: {
          totalTasks,
          completedTasks,
          pendingTasks,
          averageScore: scoredTasks > 0 ? Math.round(totalScore / scoredTasks) : 0,
          totalXp: xp,
          currentLevel: level,
          currentStreak: streak,
          longestStreak: userData.longestStreak || streak,
          totalTimeMinutes: Math.round(totalTimeSeconds / 60),
          lastActiveAt: lastActiveAt?.toISOString() || null
        },
        progressBySubject: Object.entries(subjectStats).map(([subject, stats]) => ({
          subject,
          completedTasks: stats.completed,
          averageScore: stats.count > 0 ? Math.round(stats.totalScore / stats.count) : 0
        })),
        recentActivity: recentActivity.slice(0, 5)
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error("getStudentStats error", error);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Internal server error", 500));
    }
  }
);

/**
 * Get class statistics (for teachers)
 * POST /wizdiApi/class/:classId/stats
 */
export const getClassStats = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ status: "error", message: "Method not allowed" });
      return;
    }

    try {
      const validation = await validateRequest(req);
      if (!validation.valid) {
        res.status(validation.error.httpStatus).json(validation.error);
        return;
      }

      // Extract classId from URL path
      const pathParts = req.path.split("/");
      const classIndex = pathParts.indexOf("class");
      const classId = classIndex >= 0 ? pathParts[classIndex + 1] : null;

      if (!classId) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing classId"));
        return;
      }

      const { teacherId } = req.body;

      // Get students in this class (from wizdi_users)
      const classStudents = await db.collection("wizdi_users")
        .where("classes", "array-contains", { id: classId })
        .where("isTeacher", "==", false)
        .get();

      // Alternative: check by class ID string
      let studentIds: string[] = [];
      let className = classId;

      if (classStudents.empty) {
        // Try to find by class ID in the array
        const allWizdiUsers = await db.collection("wizdi_users")
          .where("isTeacher", "==", false)
          .get();

        allWizdiUsers.forEach(doc => {
          const data = doc.data();
          const userClasses = data.classes || [];
          const matchingClass = userClasses.find((c: any) => c.id === classId);
          if (matchingClass) {
            studentIds.push(doc.id);
            className = matchingClass.name || classId;
          }
        });
      } else {
        classStudents.forEach(doc => {
          studentIds.push(doc.id);
          const data = doc.data();
          const matchingClass = data.classes?.find((c: any) => c.id === classId);
          if (matchingClass) className = matchingClass.name;
        });
      }

      // Get all submissions for these students
      const studentStats: Array<{
        studentId: string;
        displayName: string;
        completedTasks: number;
        averageScore: number;
        status: 'excellent' | 'good' | 'needs_attention';
      }> = [];

      let totalClassScore = 0;
      let totalClassSubmissions = 0;
      let totalTasksAssigned = 0;

      for (const studentId of studentIds) {
        const submissions = await db.collection("task_submissions")
          .where("studentId", "==", studentId)
          .get();

        let completed = 0;
        let totalScore = 0;
        let scored = 0;

        submissions.forEach(doc => {
          const data = doc.data();
          totalTasksAssigned++;
          if (data.status === "submitted" || data.status === "graded") {
            completed++;
            totalClassSubmissions++;
            if (data.score !== undefined) {
              totalScore += data.score;
              totalClassScore += data.score;
              scored++;
            }
          }
        });

        const avgScore = scored > 0 ? Math.round(totalScore / scored) : 0;
        let status: 'excellent' | 'good' | 'needs_attention' = 'good';
        if (avgScore >= 85) status = 'excellent';
        else if (avgScore < 60 || completed < submissions.size * 0.5) status = 'needs_attention';

        // Get student name
        const studentDoc = await db.collection("wizdi_users").doc(studentId).get();
        const studentData = studentDoc.data();

        studentStats.push({
          studentId,
          displayName: studentData?.displayName || "תלמיד",
          completedTasks: completed,
          averageScore: avgScore,
          status
        });
      }

      // Get task stats
      const tasks = teacherId
        ? await db.collection("student_tasks").where("teacherId", "==", teacherId).limit(20).get()
        : await db.collection("student_tasks").limit(20).get();

      const taskStats: Array<{
        taskId: string;
        title: string;
        submissions: number;
        averageScore: number;
        completionRate: number;
      }> = [];

      for (const taskDoc of tasks.docs) {
        const taskData = taskDoc.data();
        const taskSubmissions = await db.collection("task_submissions")
          .where("taskId", "==", taskDoc.id)
          .get();

        let submitted = 0;
        let totalScore = 0;
        let scored = 0;

        taskSubmissions.forEach(doc => {
          const data = doc.data();
          if (data.status === "submitted" || data.status === "graded") {
            submitted++;
            if (data.score !== undefined) {
              totalScore += data.score;
              scored++;
            }
          }
        });

        taskStats.push({
          taskId: taskDoc.id,
          title: taskData.title || "משימה",
          submissions: submitted,
          averageScore: scored > 0 ? Math.round(totalScore / scored) : 0,
          completionRate: taskSubmissions.size > 0 ? Math.round((submitted / taskSubmissions.size) * 100) : 0
        });
      }

      const response: ClassStatsResponse = {
        classId,
        className,
        studentCount: studentIds.length,
        stats: {
          averageScore: totalClassSubmissions > 0 ? Math.round(totalClassScore / totalClassSubmissions) : 0,
          averageCompletion: totalTasksAssigned > 0 ? Math.round((totalClassSubmissions / totalTasksAssigned) * 100) : 0,
          totalTasksAssigned,
          totalSubmissions: totalClassSubmissions
        },
        students: studentStats,
        taskStats: taskStats.slice(0, 10)
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error("getClassStats error", error);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Internal server error", 500));
    }
  }
);

/**
 * Get teacher dashboard summary
 * POST /wizdiApi/teacher/:teacherId/dashboard
 */
export const getTeacherDashboard = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ status: "error", message: "Method not allowed" });
      return;
    }

    try {
      const validation = await validateRequest(req);
      if (!validation.valid) {
        res.status(validation.error.httpStatus).json(validation.error);
        return;
      }

      // Extract teacherId from URL path
      const pathParts = req.path.split("/");
      const teacherIndex = pathParts.indexOf("teacher");
      const teacherId = teacherIndex >= 0 ? pathParts[teacherIndex + 1] : null;

      if (!teacherId) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing teacherId"));
        return;
      }

      // Get teacher profile
      const teacherDoc = await db.collection("wizdi_users").doc(teacherId).get();
      const teacherData = teacherDoc.exists ? teacherDoc.data() : null;

      // Get teacher's courses
      const courses = await db.collection("courses")
        .where("teacherId", "==", teacherId)
        .get();

      // Get teacher's tasks
      const tasks = await db.collection("student_tasks")
        .where("teacherId", "==", teacherId)
        .get();

      // Get recent submissions for teacher's tasks
      const taskIds = tasks.docs.map(doc => doc.id);
      let pendingSubmissions = 0;
      const recentSubmissions: Array<{
        submissionId: string;
        studentName: string;
        taskTitle: string;
        submittedAt: string;
        status: string;
      }> = [];

      // Query submissions
      if (taskIds.length > 0) {
        // Firestore doesn't support array contains for large arrays, so we batch
        const batchSize = 10;
        for (let i = 0; i < Math.min(taskIds.length, batchSize); i++) {
          const submissions = await db.collection("task_submissions")
            .where("taskId", "==", taskIds[i])
            .orderBy("submittedAt", "desc")
            .limit(5)
            .get();

          for (const subDoc of submissions.docs) {
            const subData = subDoc.data();
            if (subData.status === "submitted") {
              pendingSubmissions++;
            }

            if (recentSubmissions.length < 10) {
              // Get student name
              const studentDoc = await db.collection("wizdi_users").doc(subData.studentId).get();
              const studentData = studentDoc.data();

              // Get task title
              const taskDoc = tasks.docs.find(t => t.id === subData.taskId);
              const taskTitle = taskDoc?.data()?.title || "משימה";

              recentSubmissions.push({
                submissionId: subDoc.id,
                studentName: studentData?.displayName || "תלמיד",
                taskTitle,
                submittedAt: subData.submittedAt?.toDate()?.toISOString() || new Date().toISOString(),
                status: subData.status
              });
            }
          }
        }
      }

      // Get classes from teacher's profile
      const classes = teacherData?.classes || [];
      const classStats: Array<{
        classId: string;
        name: string;
        studentCount: number;
        averageScore: number;
        pendingTasks: number;
      }> = [];

      for (const cls of classes) {
        // Count students in class
        const classStudents = await db.collection("wizdi_users")
          .where("isTeacher", "==", false)
          .get();

        let studentCount = 0;
        classStudents.forEach(doc => {
          const data = doc.data();
          if (data.classes?.some((c: any) => c.id === cls.id)) {
            studentCount++;
          }
        });

        classStats.push({
          classId: cls.id,
          name: cls.name,
          studentCount,
          averageScore: 0, // Would need to calculate
          pendingTasks: 0
        });
      }

      // Get alerts (students with low performance)
      const alerts: Array<{
        type: string;
        studentId: string;
        studentName: string;
        message: string;
      }> = [];

      // Check safety_alerts collection
      const safetyAlerts = await db.collection("safety_alerts")
        .where("teacherId", "==", teacherId)
        .orderBy("createdAt", "desc")
        .limit(5)
        .get();

      safetyAlerts.forEach(doc => {
        const data = doc.data();
        alerts.push({
          type: "safety_alert",
          studentId: data.studentId,
          studentName: data.studentName || "תלמיד",
          message: data.message || "התראה"
        });
      });

      // Count tasks this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const tasksThisWeek = tasks.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        return createdAt && createdAt >= oneWeekAgo;
      }).length;

      // Count unique students
      const uniqueStudents = new Set<string>();
      for (const taskDoc of tasks.docs) {
        const taskData = taskDoc.data();
        if (taskData.studentIds) {
          taskData.studentIds.forEach((id: string) => uniqueStudents.add(id));
        }
      }

      const response: TeacherDashboardResponse = {
        teacherId,
        displayName: teacherData?.displayName || "מורה",
        summary: {
          totalCourses: courses.size,
          totalStudents: uniqueStudents.size,
          totalClasses: classes.length,
          pendingSubmissions,
          tasksThisWeek
        },
        classes: classStats,
        recentSubmissions: recentSubmissions.slice(0, 5),
        alerts
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error("getTeacherDashboard error", error);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Internal server error", 500));
    }
  }
);

/**
 * Get task results
 * POST /wizdiApi/task/:taskId/results
 */
export const getTaskResults = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ status: "error", message: "Method not allowed" });
      return;
    }

    try {
      const validation = await validateRequest(req);
      if (!validation.valid) {
        res.status(validation.error.httpStatus).json(validation.error);
        return;
      }

      // Extract taskId from URL path
      const pathParts = req.path.split("/");
      const taskIndex = pathParts.indexOf("task");
      const taskId = taskIndex >= 0 ? pathParts[taskIndex + 1] : null;

      if (!taskId) {
        res.status(400).json(errorResponse("MISSING_PARAMS", "Missing taskId"));
        return;
      }

      // Get task
      const taskDoc = await db.collection("student_tasks").doc(taskId).get();
      if (!taskDoc.exists) {
        res.status(404).json(errorResponse("INVALID_TASK", "Task not found"));
        return;
      }

      const taskData = taskDoc.data()!;

      // Get course name
      let courseName = "קורס";
      if (taskData.courseId) {
        const courseDoc = await db.collection("courses").doc(taskData.courseId).get();
        courseName = courseDoc.data()?.title || courseName;
      }

      // Get all submissions for this task
      const submissions = await db.collection("task_submissions")
        .where("taskId", "==", taskId)
        .get();

      let submitted = 0;
      let graded = 0;
      let totalScore = 0;
      let highestScore = 0;
      let lowestScore = Infinity;
      const submissionsList: Array<{
        submissionId: string;
        studentId: string;
        studentName: string;
        status: string;
        score: number | null;
        submittedAt: string | null;
        gradedAt: string | null;
        timeSpentMinutes: number | null;
      }> = [];

      for (const subDoc of submissions.docs) {
        const subData = subDoc.data();

        if (subData.status === "submitted" || subData.status === "graded") {
          submitted++;
        }
        if (subData.status === "graded") {
          graded++;
          if (subData.score !== undefined) {
            totalScore += subData.score;
            highestScore = Math.max(highestScore, subData.score);
            lowestScore = Math.min(lowestScore, subData.score);
          }
        }

        // Get student name
        const studentDoc = await db.collection("wizdi_users").doc(subData.studentId).get();
        const studentData = studentDoc.exists ? studentDoc.data() : null;

        submissionsList.push({
          submissionId: subDoc.id,
          studentId: subData.studentId,
          studentName: studentData?.displayName || "תלמיד",
          status: subData.status,
          score: subData.score ?? null,
          submittedAt: subData.submittedAt?.toDate()?.toISOString() || null,
          gradedAt: subData.gradedAt?.toDate()?.toISOString() || null,
          timeSpentMinutes: subData.telemetry?.timeSpent ? Math.round(subData.telemetry.timeSpent / 60) : null
        });
      }

      const response: TaskResultsResponse = {
        taskId,
        title: taskData.title || "משימה",
        courseId: taskData.courseId || "",
        courseName,
        teacherId: taskData.teacherId || "",
        maxScore: taskData.maxPoints || 100,
        dueDate: taskData.dueDate?.toDate()?.toISOString() || null,
        stats: {
          totalAssigned: taskData.studentIds?.length || submissions.size,
          submitted,
          graded,
          averageScore: graded > 0 ? Math.round(totalScore / graded) : 0,
          highestScore: highestScore === 0 ? 0 : highestScore,
          lowestScore: lowestScore === Infinity ? 0 : lowestScore
        },
        submissions: submissionsList
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error("getTaskResults error", error);
      res.status(500).json(errorResponse("INTERNAL_ERROR", "Internal server error", 500));
    }
  }
);
