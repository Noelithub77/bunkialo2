export type DesktopDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DesktopSessionType = "regular" | "lab" | "tutorial";

export interface DesktopTimetableSlot {
  id: string;
  courseId: string;
  courseName: string;
  dayOfWeek: DesktopDayOfWeek;
  startTime: string;
  endTime: string;
  sessionType: DesktopSessionType;
}

export interface DesktopNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
  url: string | null;
}

export interface DesktopSnapshot {
  generatedAt: number;
  timetable: DesktopTimetableSlot[];
  notifications: DesktopNotification[];
}
