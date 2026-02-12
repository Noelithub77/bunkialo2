import type { CourseAttendance } from "@/types";

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

const MIN_PARSEABLE_RECORDS = 4;

export interface SemesterWindow {
  semesterKey: string;
  startDate: Date;
  endDate: Date;
}

export interface CourseSemesterDistribution {
  shouldAutoDrop: boolean;
  parseableCount: number;
  insideCount: number;
  outsideCount: number;
}

const parseAttendanceDate = (value: string): Date | null => {
  const dateMatch = value.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!dateMatch) return null;

  const day = Number(dateMatch[1]);
  const month = MONTH_MAP[dateMatch[2].toLowerCase()];
  const year = Number(dateMatch[3]);
  if (month === undefined) return null;

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildWindow = (
  year: number,
  startMonth: number,
  endMonth: number,
  keySuffix: "jan-apr" | "aug-nov",
): SemesterWindow => {
  const startDate = new Date(year, startMonth, 1);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(year, endMonth + 1, 0);
  endDate.setHours(23, 59, 59, 999);

  return {
    semesterKey: `${year}-${keySuffix}`,
    startDate,
    endDate,
  };
};

export const getCurrentSemesterWindow = (now: Date = new Date()): SemesterWindow => {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (month >= 0 && month <= 6) {
    return buildWindow(year, 0, 3, "jan-apr");
  }

  return buildWindow(year, 7, 10, "aug-nov");
};

export const evaluateCourseAgainstSemesterWindow = (
  course: CourseAttendance,
  semesterWindow: SemesterWindow,
): CourseSemesterDistribution => {
  let parseableCount = 0;
  let insideCount = 0;
  let outsideCount = 0;

  const startMs = semesterWindow.startDate.getTime();
  const endMs = semesterWindow.endDate.getTime();

  for (const record of course.records) {
    const date = parseAttendanceDate(record.date);
    if (!date) continue;

    parseableCount += 1;
    const time = date.getTime();
    if (time >= startMs && time <= endMs) {
      insideCount += 1;
    } else {
      outsideCount += 1;
    }
  }

  const shouldAutoDrop =
    parseableCount >= MIN_PARSEABLE_RECORDS && outsideCount > insideCount;

  return {
    shouldAutoDrop,
    parseableCount,
    insideCount,
    outsideCount,
  };
};

export const evaluateCoursesAgainstCurrentSemester = (
  courses: CourseAttendance[],
  now: Date = new Date(),
): {
  semesterWindow: SemesterWindow;
  byCourseId: Record<string, CourseSemesterDistribution>;
} => {
  const semesterWindow = getCurrentSemesterWindow(now);
  const byCourseId: Record<string, CourseSemesterDistribution> = {};

  for (const course of courses) {
    byCourseId[course.courseId] = evaluateCourseAgainstSemesterWindow(
      course,
      semesterWindow,
    );
  }

  return { semesterWindow, byCourseId };
};

