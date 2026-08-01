/**
 * Converts attendance-portal payloads into the CourseAttendance shape the rest
 * of the app already speaks.
 *
 * Why it emits Moodle-style date strings instead of structured fields:
 * `AttendanceRecord.date` is regex-parsed in 16 places (utils/attendance-helpers,
 * utils/semester-course-filter, utils/timetable-inference, utils/bunk-transfer,
 * stores/bunk-store, stores/timetable-store, four components, use-bunk-actions).
 * Most fail silently on a format change; isPastOrCompleted returning false
 * universally makes filterPastBunks discard every bunk with no error. Emitting
 * the format they already parse keeps that entire pipeline untouched.
 *
 * ponytail: pure module, type-only imports. Keeps it loadable under `node --test`
 * without an Expo mock harness, which is why it is separate from the HTTP client.
 */
import type {
  AttendanceRecord,
  AttendanceStatus,
  CourseAttendance,
  PortalCourse,
  PortalSession,
  PortalSessionStatus,
} from "@/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const STATUS_MAP: Record<PortalSessionStatus, AttendanceStatus> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
  // The portal counts duty leave as credited-not-present. "Excused" is the
  // closest existing status and keeps it out of the absence maths.
  DUTY_LEAVE: "Excused",
};

export const mapPortalStatus = (status: string): AttendanceStatus =>
  STATUS_MAP[status as PortalSessionStatus] ?? "Unknown";

/**
 * Minutes since midnight. The portal sends 24-hour "HH:MM" (observed: "11:30").
 * ponytail: seconds tolerated because ISO time serialisation varies; 12-hour
 * parsing removed since the portal does not send it. Add it back if a payload
 * ever arrives with a meridiem — the symptom would be dropped sessions.
 */
const parseTimeToMinutes = (value: string): number | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/**
 * "9:00AM" — no space before the meridiem. utils/attendance-helpers.ts:40 and :55
 * both use (?:AM|PM) with no preceding \s*, so they reject "9:00 AM" even though
 * timetable-inference.ts:192 accepts it. Satisfy the stricter reader.
 */
const formatClockTime = (minutes: number): string => {
  const hours24 = Math.floor(minutes / 60);
  const hours12 = hours24 % 12 || 12;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  return `${hours12}:${(minutes % 60).toString().padStart(2, "0")}${meridiem}`;
};

/**
 * The portal sends a calendar date pinned to UTC midnight
 * ("2026-07-31T00:00:00.000Z"). Passing that to `new Date()` and reading local
 * getters rolls the date back a day for anyone west of UTC, which yields the
 * wrong weekday and files the class under the wrong day of the timetable.
 *
 * So take the calendar part verbatim and build a local date from it. Works
 * identically for a bare "2026-07-31", and is timezone-proof by construction.
 */
const parseSessionDate = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * "Thu 1 Jan 2026 9:00AM - 9:55AM"
 *
 * The weekday is derived from the date, never taken from the payload:
 * timetable-inference.ts:177 reads dayOfWeek off this leading name rather than
 * off the date, so a wrong name silently misplaces the slot.
 *
 * Returns null when the payload cannot be parsed, so the caller can drop the row
 * rather than emit a string the pipeline will misread.
 */
export const formatMoodleDate = (
  date: string,
  startTime: string,
  endTime: string,
): string | null => {
  const parsed = parseSessionDate(date);
  if (!parsed) return null;

  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) return null;

  const head = `${DAY_NAMES[parsed.getDay()]} ${parsed.getDate()} ${
    MONTH_NAMES[parsed.getMonth()]
  } ${parsed.getFullYear()}`;

  return `${head} ${formatClockTime(start)} - ${formatClockTime(end)}`;
};

const toRecord = (session: PortalSession): AttendanceRecord | null => {
  const date = formatMoodleDate(session.date, session.startTime, session.endTime);
  if (!date) return null;

  return {
    date,
    // Deliberately empty. getCanonicalRecordDescription (attendance-helpers.ts:124)
    // falls back to the date, which is stable. Using session.topic would let a
    // faculty edit change buildRecordKey and orphan the user's bunk notes.
    description: "",
    status: mapPortalStatus(session.status),
    points: "",
  };
};

export const toCourseAttendance = (
  course: PortalCourse,
  sessions: PortalSession[],
  moodleCourses: { courseId: string; courseCode: string }[],
): CourseAttendance => {
  const records = sessions
    .map(toRecord)
    .filter((record): record is AttendanceRecord => record !== null);

  return {
    courseId: resolveCourseId(course, moodleCourses),
    courseName: `${course.courseCode} ${course.courseName}`,
    attendanceModuleId: null,
    // Copied, not recomputed: the portal counts EXCUSED as absent and the app
    // does not, so recomputing would make Bunkialo disagree with the official
    // figure the student sees on the portal.
    totalSessions: course.total,
    attended: course.present,
    percentage: course.percentage,
    records,
    lastUpdated: Date.now(),
  };
};

const normaliseCode = (code: string): string =>
  code.trim().toUpperCase().replace(/[\s_-]/g, "");

/**
 * Portal course IDs are unrelated to Moodle's, and bunk-store keys every user
 * customisation (colours, aliases, credits, manual slots, bunk notes) by
 * courseId. Resolving to the Moodle ID here means a portal ID never reaches
 * persisted state, so no migration is needed.
 *
 * ponytail: falls back to a code-derived key, stable across runs. Ceiling: two
 * courses sharing a code collapse into one. Add section-awareness if that shows up.
 */
export const resolveCourseId = (
  course: PortalCourse,
  moodleCourses: { courseId: string; courseCode: string }[],
): string => {
  const target = normaliseCode(course.courseCode);
  if (!target) return `portal:${course.courseId}`;

  const match = moodleCourses.find(
    (candidate) =>
      candidate.courseCode && normaliseCode(candidate.courseCode) === target,
  );

  return match ? match.courseId : `portal:${target}`;
};
