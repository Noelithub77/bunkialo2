import type {
  DayOfWeek,
  SlotOccurrenceStats,
  TimetableSlot,
} from "@/types";
import { useAttendanceStore } from "./attendance-store";
import { useBunkStore } from "./bunk-store";

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
