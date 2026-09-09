import type {
  DesktopNotification,
  DesktopTimetableSlot,
} from "../../shared/desktop";
import type { FullSyncPayload } from "../session-object";
import {
  resolveDesktopTimetable,
  type DesktopSessionObservation,
} from "./timetable-resolution";

type RecordValue = Record<string, unknown>;

interface TermRange {
  endMs: number | null;
  startMs: number | null;
}

const asRecord = (value: unknown): RecordValue | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : null;

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const dateMs = (value: string): number | null => {
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const parsed = new Date(dateOnly ? `${dateOnly}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const currentTermRange = (value: unknown): TermRange | null => {
  const record = asRecord(value);
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.terms)
        ? record.terms
        : [];
  const active = rows.find((rawRow) => {
    const row = asRecord(rawRow);
    const status = asText(row?.status)?.toLowerCase();
    return row?.isCurrent === true
      || row?.current === true
      || row?.is_current === true
      || status === "active"
      || status === "current";
  });
  const term = asRecord(active);
  if (!term) return null;
  const startMs = asText(term.startDate);
  const endMs = asText(term.endDate);
  return {
    startMs: startMs ? dateMs(startMs) : null,
    endMs: endMs ? dateMs(endMs) : null,
  };
};

const normalizeTime = (value: unknown): string | null => {
  const text = asText(value);
  if (!text) return null;
  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);
    if (hours <= 23 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  const twelveHour = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!twelveHour) return null;
  const rawHours = Number(twelveHour[1]);
  const minutes = Number(twelveHour[2] ?? "0");
  if (rawHours < 1 || rawHours > 12 || minutes > 59) return null;
  let hours = rawHours % 12;
  if (twelveHour[3].toUpperCase() === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const timeMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const fallbackDayOfWeek = (value: string): number | null => {
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const date = new Date(dateOnly ? `${dateOnly}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date.getUTCDay();
};

const fallbackSessionType = (
  topic: string,
  startTime: string,
  endTime: string,
): "regular" | "lab" | "tutorial" => {
  const lowerTopic = topic.toLowerCase();
  if (lowerTopic.includes("lab")) return "lab";
  if (lowerTopic.includes("tutorial")) return "tutorial";
  return timeMinutes(endTime) - timeMinutes(startTime) >= 110 ? "lab" : "regular";
};

const courseRows = (value: unknown): Map<string, string> => {
  const record = asRecord(value);
  const rows = record?.courses ?? record?.byCourse;
  if (!Array.isArray(rows)) return new Map();
  const result = new Map<string, string>();
  for (const row of rows) {
    const item = asRecord(row);
    const id = item ? asText(item.courseId) : null;
    const name = item ? asText(item.name ?? item.courseName) : null;
    if (id && name) result.set(id, name);
  }
  return result;
};

const buildTimetable = (
  attendance: NonNullable<FullSyncPayload["attendance"]>,
): DesktopTimetableSlot[] => {
  const names = courseRows(attendance.summary);
  const allObservations: DesktopSessionObservation[] = [];
  for (const [courseId, rawValue] of Object.entries(attendance.sessions)) {
    const container = asRecord(rawValue);
    const sessions = container?.sessions;
    if (!Array.isArray(sessions)) continue;
    for (const rawSession of sessions) {
      const session = asRecord(rawSession);
      const date = session ? asText(session.date) : null;
      const startTime = session ? normalizeTime(session.startTime) : null;
      const endTime = session ? normalizeTime(session.endTime) : null;
      if (!date || !startTime || !endTime || timeMinutes(endTime) <= timeMinutes(startTime)) continue;
      allObservations.push({
        courseId,
        courseName: names.get(courseId) ?? courseId,
        date,
        endTime,
        startTime,
        topic: session ? asText(session.topic) ?? "Class" : "Class",
      });
    }
  }
  const range = currentTermRange(attendance.terms);
  const observations = !range || (range.startMs === null && range.endMs === null)
    ? allObservations
    : allObservations.filter((observation) => {
        const timestamp = dateMs(observation.date);
        return timestamp !== null
          && (range.startMs === null || timestamp >= range.startMs)
          && (range.endMs === null || timestamp <= range.endMs);
      });
  const resolved = resolveDesktopTimetable(observations.length > 0 ? observations : allObservations);
  if (resolved.length > 0 || allObservations.length === 0) return resolved;

  const fallback = new Map<string, DesktopTimetableSlot>();
  for (const observation of allObservations) {
    const dayOfWeek = fallbackDayOfWeek(observation.date);
    if (dayOfWeek === null) continue;
    const key = `${observation.courseId}-${dayOfWeek}-${observation.startTime}-${observation.endTime}`;
    if (fallback.has(key)) continue;
    fallback.set(key, {
      id: `desktop-${key}`,
      courseId: observation.courseId,
      courseName: observation.courseName,
      dayOfWeek: dayOfWeek as DesktopTimetableSlot["dayOfWeek"],
      startTime: observation.startTime,
      endTime: observation.endTime,
      sessionType: fallbackSessionType(observation.topic, observation.startTime, observation.endTime),
    });
  }
  return [...fallback.values()].sort((first, second) =>
    first.dayOfWeek - second.dayOfWeek
    || first.startTime.localeCompare(second.startTime)
    || first.courseName.localeCompare(second.courseName),
  );
};

const buildNotifications = (value: unknown): DesktopNotification[] => {
  const record = asRecord(value);
  const rows = record?.items;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((rawRow): DesktopNotification[] => {
    const row = asRecord(rawRow);
    if (!row) return [];
    const id = asText(row.id);
    const title = asText(row.title);
    const body = asText(row.body) ?? "";
    const createdAt = asText(row.createdAt);
    if (!id || !title || !createdAt) return [];
    return [{
      id,
      title,
      body,
      createdAt,
      unread: row.readAt === null || row.readAt === undefined,
      url: asText(row.link),
    }];
  });
};

export const buildDesktopSnapshot = (
  payload: FullSyncPayload,
): { timetable: DesktopTimetableSlot[]; notifications: DesktopNotification[] } => ({
  timetable: payload.attendance ? buildTimetable(payload.attendance) : [],
  notifications: payload.attendance ? buildNotifications(payload.attendance.notifications) : [],
});
