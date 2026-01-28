import type { AcademicEvent, DayOfWeek, TimetableSlot } from "@/types";
import { extractCourseName } from "@/utils/course-name";

const TIMEZONE = "Asia/Kolkata";

// format date to ICS format (YYYYMMDD for all-day events)
const toICSDate = (dateStr: string): string => dateStr.replace(/-/g, "");

// escape special characters for ICS
const escapeICS = (text: string): string =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");

const formatLocalDateTime = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}`;
};

const formatUtcDateTime = (date: Date): string =>
  `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

// ─── Academic Calendar ICS ───────────────────────────────────────────────────

const generateAcademicUID = (event: AcademicEvent): string =>
  `${event.id}@bunkialo.app`;

const buildAcademicEventBlock = (event: AcademicEvent): string => {
  const startDate = toICSDate(event.date);
  // for all-day events, end date should be day after (exclusive)
  const endDateStr = event.endDate ?? event.date;
  const endParts = endDateStr.split("-").map(Number);
  const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
  endDate.setDate(endDate.getDate() + 1);
  const endICS = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}`;

  const lines = [
    "BEGIN:VEVENT",
    `UID:${generateAcademicUID(event)}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endICS}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];

  if (event.note) {
    lines.push(`DESCRIPTION:${escapeICS(event.note)}`);
  }

  if (event.isTentative) {
    lines.push("STATUS:TENTATIVE");
  }

  lines.push(`CATEGORIES:${event.category.toUpperCase()}`);
  lines.push("END:VEVENT");

  return lines.join("\r\n");
};

export const generateICSContent = (
  events: AcademicEvent[],
  calendarName: string,
): string => {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bunkialo//Academic Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
  ].join("\r\n");

  const footer = "END:VCALENDAR";
  const eventBlocks = events.map(buildAcademicEventBlock).join("\r\n");

  return `${header}\r\n${eventBlocks}\r\n${footer}`;
};

// ─── Timetable ICS ───────────────────────────────────────────────────────────

const generateTimetableUID = (slot: TimetableSlot): string =>
  `${slot.id}@bunkialo.app`;

const DAY_TO_RRULE: Record<DayOfWeek, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

const getSemesterEndDate = (): Date => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  if (month <= 3) return new Date(year, 3, 30);
  if (month >= 7 && month <= 10) return new Date(year, 10, 30);
  if (month <= 6) return new Date(year, 10, 30);
  return new Date(year + 1, 3, 30);
};

const getNextOccurrence = (dayOfWeek: DayOfWeek, time: string): Date => {
  const now = new Date();
  let daysUntil = dayOfWeek - now.getDay();
  if (daysUntil <= 0) daysUntil += 7;

  const date = new Date(now);
  date.setDate(date.getDate() + daysUntil);

  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);

  return date;
};

const buildTimetableEventBlock = (slot: TimetableSlot): string => {
  const startDate = getNextOccurrence(slot.dayOfWeek, slot.startTime);
  const endDate = getNextOccurrence(slot.dayOfWeek, slot.endTime);
  const semesterEnd = getSemesterEndDate();
  const until = new Date(semesterEnd);
  until.setHours(23, 59, 59, 0);

  const lines = [
    "BEGIN:VEVENT",
    `UID:${generateTimetableUID(slot)}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART;TZID=${TIMEZONE}:${formatLocalDateTime(startDate)}`,
    `DTEND;TZID=${TIMEZONE}:${formatLocalDateTime(endDate)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_RRULE[slot.dayOfWeek]};UNTIL=${formatUtcDateTime(until)}`,
    `SUMMARY:${escapeICS(extractCourseName(slot.courseName))}`,
    `DESCRIPTION:${escapeICS(`${slot.sessionType} session`)}`,
  ];

  lines.push("END:VEVENT");

  return lines.join("\r\n");
};

export const generateTimetableICSContent = (
  slots: TimetableSlot[],
  calendarName: string,
): string => {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bunkialo//Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
  ].join("\r\n");

  const footer = "END:VCALENDAR";
  const eventBlocks = slots.map(buildTimetableEventBlock).join("\r\n");

  return `${header}\r\n${eventBlocks}\r\n${footer}`;
};
