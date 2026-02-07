/**
 * Timetable types
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SessionType = "regular" | "lab" | "tutorial";

export interface TimetableSlot {
  id: string;
  courseId: string;
  courseName: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  isManual: boolean;
  isCustomCourse: boolean;
}

export interface ManualSlot {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
}

export interface SlotConflict {
  manualSlot: TimetableSlot;
  autoSlot: TimetableSlot;
}

export interface TimetableState {
  slots: TimetableSlot[];
  conflicts: SlotConflict[];
  lastGeneratedAt: number | null;
  isLoading: boolean;
}
