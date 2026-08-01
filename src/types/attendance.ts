/**
 * Attendance-related types
 */

export type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Late"
  | "Excused"
  | "Unknown";

/**
 * Attendance record scraped from Moodle LMS
 * @example
 * {
 *   date: "Thu 1 Jan 2026 11AM - 12PM",
 *   status: "Present",
 *   points: "1 / 1"
 * }
 */
export interface AttendanceRecord {
  date: string;
  description: string;
  status: AttendanceStatus;
  points: string;
  remarks?: string;
}

export interface CourseAttendance {
  courseId: string;
  courseName: string;
  attendanceModuleId: string | null;
  totalSessions: number;
  attended: number;
  percentage: number;
  records: AttendanceRecord[];
  lastUpdated: number;
}

/**
 * Attendance portal (attendance.iiitkottayam.ac.in) payloads.
 * See docs/attendance-portal-recon.md. Field names are read off the portal's
 * own render code; the exact date/time serialisation is still unconfirmed, so
 * the adapter parses both plain dates and ISO timestamps.
 */
export type PortalSessionStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "EXCUSED"
  | "DUTY_LEAVE";

export interface PortalSession {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  section: string;
  topic: string | null;
  status: PortalSessionStatus;
}

export type PortalLoginResult =
  | { kind: "success" }
  | { kind: "needs2fa"; intermediate: string }
  | { kind: "needsEmailOtp"; intermediate: string };

export interface PortalCourse {
  courseId: string;
  courseCode: string;
  courseName: string;
  present: number;
  total: number;
  percentage: number;
}

export interface AttendanceState {
  courses: CourseAttendance[];
  isLoading: boolean;
  lastSyncTime: number | null;
  error: string | null;
}

export interface AttendanceSummary {
  courseId: string;
  courseName: string;
  percentage: number;
  attended: number;
  totalSessions: number;
}

export interface CourseStats {
  totalCourses: number;
  totalSessions: number;
  totalAttended: number;
  overallPercentage: number;
}
