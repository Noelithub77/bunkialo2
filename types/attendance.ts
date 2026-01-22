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
  status: AttendanceStatus;
  points: string;
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
