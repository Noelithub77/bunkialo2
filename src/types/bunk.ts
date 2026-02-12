/**
 * Bunk management types
 */

import type { DayOfWeek, ManualSlot, SessionType } from "./timetable";

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
  overrideLmsSlots: boolean;
}

export type HiddenCourseReason = "manual" | "auto-semester";

export interface HiddenCourseMeta {
  courseId: string;
  courseName: string;
  reason: HiddenCourseReason;
  hiddenAt: number;
  semesterKey: string | null;
}

export interface CourseBunkData {
  courseId: string;
  courseName: string;
  config: CourseConfig | null;
  bunks: BunkRecord[];
  isConfigured: boolean;
  isCustomCourse: boolean;
  manualSlots: ManualSlot[];
}

export interface BunkState {
  courses: CourseBunkData[];
  hiddenCourses: Record<string, HiddenCourseMeta>;
  autoDropOptOutBySemester: Record<string, string>;
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

export interface CustomCourseInput {
  courseName: string;
  alias: string;
  credits: number;
  color: string;
  slots: Omit<ManualSlot, "id">[];
}

export interface ManualSlotInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
}
