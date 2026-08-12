/**
 * Attendance-related types
 */

export type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Late"
  | "Excused"
  | "Duty Leave"
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
  sessionId: string;
  termId: string;
  date: string;
  exactDate: string;
  startTime: string;
  endTime: string;
  section: string | null;
  topic: string | null;
  description: string;
  status: AttendanceStatus;
  sourceStatus: import("./attendance-portal").PortalAttendanceStatus;
  points: string;
  remarks?: string;
}

export interface CourseAttendance {
  courseId: string;
  courseCode: string;
  courseName: string;
  termId: string;
  attendanceCourseId: string;
  lmsCourseId: string | null;
  mappingSource: import("./course-link").CourseMappingSource;
  attendanceModuleId: string | null;
  totalSessions: number;
  attended: number;
  present: number;
  dlCredited: number;
  dlOverflow: number;
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
