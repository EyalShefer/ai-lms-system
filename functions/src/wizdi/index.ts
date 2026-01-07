/**
 * Wizdi Integration - Export all functions
 */

// Auth endpoints
export { wizdiLogin, wizdiRefresh } from "./wizdiAuthController";

// Data API endpoints
export {
  getStudentStats,
  getClassStats,
  getTeacherDashboard,
  getTaskResults
} from "./wizdiApiController";

// Types (for use in frontend)
export type {
  WizdiLoginRequest,
  WizdiLoginResponse,
  WizdiUser,
  StudentStatsResponse,
  ClassStatsResponse,
  TeacherDashboardResponse,
  TaskResultsResponse,
  WizdiEventType,
  WizdiPostMessageEvent
} from "./types";
