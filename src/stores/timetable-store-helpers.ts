import type {
  CourseAttendance,
  DayOfWeek,
  SlotOccurrenceStats,
  TimetableSlot,
} from "@/types";
import { useAttendanceStore } from "./attendance-store";
import { useBunkStore } from "./bunk-store";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export const makeTimetableId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const timesOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean => start1 < end2 && start2 < end1;

export const timetableTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const startOfIsoWeek = (timestamp: number): number => {
  const date = new Date(timestamp);
  const day = date.getUTCDay() || 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.getTime();
};

const parseAttendanceDate = (value: string): number | null => {
  const match = value.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!match) return null;
  const month = MONTH_MAP[match[2].toLowerCase()];
  if (month === undefined) return null;
  const date = new Date(Number(match[3]), month, Number(match[1]));
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const getTermWeekSpanCount = (
  courses: CourseAttendance[],
  termId: string,
): number | null => {
  const dates = courses
    .filter((course) => course.termId === termId)
    .flatMap((course) =>
    course.records
      .map((record) => parseAttendanceDate(record.date))
      .filter((value): value is number => value !== null),
    );
  if (dates.length === 0) return null;
  const start = startOfIsoWeek(Math.min(...dates));
  const end = startOfIsoWeek(Date.now());
  return Math.max(1, Math.floor((end - start) / MS_PER_WEEK) + 1);
};

export const autoSlotStoreKey = (
  courseId: string,
  dayOfWeek: DayOfWeek,
  startTime: string,
): string => `${courseId}-${dayOfWeek}-${startTime}`;

export const slotResolutionKey = (slot: TimetableSlot): string =>
  `${slot.courseId}-${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${slot.sessionType}-${slot.isManual ? "manual" : "auto"}`;

export const buildPairConflictId = (
  first: TimetableSlot,
  second: TimetableSlot,
): string => {
  const ordered = [slotResolutionKey(first), slotResolutionKey(second)].sort();
  return `pair-${ordered[0]}__${ordered[1]}`;
};

export const buildOutlierConflictId = (
  courseId: string,
  slotKey: string,
): string => `outlier-${courseId}-${slotKey}`;

export const rankSlotForConflict = (stats?: SlotOccurrenceStats): number => {
  if (!stats) return 0;
  const weeks = Math.max(
    stats.totalWeekSpanCount ?? stats.dayActiveWeekCount,
    1,
  );
  return stats.occurrenceCount / weeks;
};

export const isOutlierCandidate = (
  occurrenceCount: number,
  totalWeekSpanCount: number,
): boolean => occurrenceCount / Math.max(totalWeekSpanCount, 1) <= 0.34;

export const mergeTimetableSlots = (
  automatic: TimetableSlot[],
  manual: TimetableSlot[],
): TimetableSlot[] => {
  const byKey = new Map<string, TimetableSlot>();
  for (const slot of [...automatic, ...manual]) {
    byKey.set(`${slot.dayOfWeek}-${slot.startTime}-${slot.courseId}`, slot);
  }
  return [...byKey.values()].sort((first, second) =>
    first.dayOfWeek === second.dayOfWeek
      ? first.startTime.localeCompare(second.startTime)
      : first.dayOfWeek - second.dayOfWeek,
  );
};

export const recomputeWhenBaseStoresHydrated = (
  generateTimetable: () => void,
): void => {
  let attempts = 0;
  const run = (): void => {
    const ready =
      useAttendanceStore.getState().hasHydrated &&
      useBunkStore.getState().hasHydrated;
    if (ready || attempts >= 20) {
      generateTimetable();
      return;
    }
    attempts += 1;
    setTimeout(run, 200);
  };
  setTimeout(run, 0);
};

export const getCurrentAndNextClass = (
  slots: TimetableSlot[],
  now: Date = new Date(),
): { currentClass: TimetableSlot | null; nextClass: TimetableSlot | null } => {
  const day = now.getDay() as DayOfWeek;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = slots
    .filter((slot) => slot.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const currentClass =
    today.find((slot) => time >= slot.startTime && time < slot.endTime) ?? null;
  let nextClass = today.find((slot) => time < slot.startTime) ?? null;
  for (let offset = 1; !nextClass && offset <= 7; offset += 1) {
    nextClass =
      slots
        .filter((slot) => slot.dayOfWeek === (day + offset) % 7)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null;
  }
  return { currentClass, nextClass };
};

export const formatTimeDisplay = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};

export const getDayName = (day: DayOfWeek, short = true): string => {
  const names = short
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
  return names[day];
};

export const getNearbySlots = (
  slots: TimetableSlot[],
  now: Date = new Date(),
): TimetableSlot[] => {
  const day = now.getDay() as DayOfWeek;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  for (let offset = 0; offset <= 7; offset += 1) {
    const targetDay = ((day + offset) % 7) as DayOfWeek;
    const matches = slots
      .filter(
        (slot) =>
          slot.dayOfWeek === targetDay && (offset > 0 || slot.endTime > time),
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (matches.length > 0) return matches;
  }
  return [];
};
