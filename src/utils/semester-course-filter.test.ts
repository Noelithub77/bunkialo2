import { describe, expect, test } from "bun:test";
import type { CourseAttendance } from "@/types";
import {
  evaluateCourseAgainstSemesterWindow,
  getCurrentSemesterWindow,
} from "./semester-course-filter";

const makeCourse = (date: string): CourseAttendance => ({
  courseId: "term:CSS311",
  courseCode: "CSS311",
  courseName: "Parallel and Distributed Computing",
  termId: "term",
  attendanceCourseId: "attendance-1",
  lmsCourseId: null,
  mappingSource: "unresolved",
  attendanceModuleId: null,
  totalSessions: 1,
  attended: 0,
  present: 0,
  dlCredited: 0,
  dlOverflow: 0,
  percentage: 0,
  records: [
    {
      sessionId: "session-1",
      termId: "term",
      date: `${date} 9AM - 10AM`,
      exactDate: date,
      startTime: "09:00",
      endTime: "10:00",
      section: null,
      topic: null,
      description: "Class",
      status: "Absent",
      sourceStatus: "ABSENT",
      points: "0 / 1",
    },
  ],
  lastUpdated: 0,
});

describe("semester course filtering", () => {
  test("uses the July semester window for July attendance", () => {
    const window = getCurrentSemesterWindow(new Date(2026, 6, 31));
    const result = evaluateCourseAgainstSemesterWindow(
      makeCourse("30 Jul 2026"),
      window,
    );

    expect(window.semesterKey).toBe("2026-jul-jan");
    expect(result.insideCount).toBe(1);
    expect(result.outsideCount).toBe(0);
  });
});
