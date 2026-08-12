export type PortalAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "EXCUSED"
  | "DUTY_LEAVE";

export interface AttendancePortalUser {
  id: string;
  email: string;
  name: string;
}

export interface AttendanceTerm {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string | null;
  endDate: string | null;
}

export interface PortalCourseSummary {
  courseId: string;
  code: string;
  name: string;
  total: number;
  present: number;
  dlCredited: number;
  dlOverflow: number;
  percentage: number;
  termId: string;
}

export interface PortalAttendanceSummary {
  courses: PortalCourseSummary[];
}

export interface PortalSession {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  topic: string | null;
  section: string | null;
  status: PortalAttendanceStatus;
}

export interface PortalCourseSessions {
  courseId: string;
  sessions: PortalSession[];
}

export interface AttendancePortalTokens {
  accessToken: string;
  refreshToken: string;
}
