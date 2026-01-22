/**
 * Bunk management types
 */

export type BunkSource = "lms" | "user";

export interface BunkRecord {
  id: string;
  date: string;
  description: string;
  timeSlot: string | null;
  note: string;
  source: BunkSource;
  isDutyLeave: boolean;
  dutyLeaveNote: string;
  isMarkedPresent: boolean;
  presenceNote: string;
}

export interface CourseConfig {
  credits: number;
  alias: string;
  courseCode: string;
  color: string;
}

export interface CourseBunkData {
  courseId: string;
  courseName: string;
  config: CourseConfig | null;
  bunks: BunkRecord[];
  isConfigured: boolean;
}

export interface BunkState {
  courses: CourseBunkData[];
  lastSyncTime: number | null;
  isLoading: boolean;
  error: string | null;
}

export interface DutyLeaveInfo {
  courseId: string;
  courseName: string;
  bunkId: string;
  date: string;
  timeSlot: string | null;
  note: string;
}
