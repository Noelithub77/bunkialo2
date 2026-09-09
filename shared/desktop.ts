export type DesktopDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DesktopSessionType = "regular" | "lab" | "tutorial";

// The first object entry is LMS; the second is attendance.
export type DesktopCredentials = Record<string, string>;

// Kept for the browser pairing UI compatibility while the desktop request path
// now authenticates directly with DesktopCredentials.
export type DesktopPairingCode = DesktopCredentials;

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

export type DesktopSyncResult =
  | { status: "success"; snapshot: DesktopSnapshot }
  | { status: "failure"; code: "credentials" | "upstream"; message: string };
