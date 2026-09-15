export const WEAR_TIMETABLE_VERSION = 1 as const;

export type WearTimetableSource = "template" | "account" | "manual";

export interface WearTimetableSlot {
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  sessionType: "regular" | "lab" | "tutorial";
}

export interface WearTimetablePayload {
  version: typeof WEAR_TIMETABLE_VERSION;
  source: WearTimetableSource;
  updatedAt: number;
  slots: WearTimetableSlot[];
}
