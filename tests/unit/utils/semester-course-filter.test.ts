import { describe, expect, test } from "bun:test";
import { evaluateCourseAgainstSemesterWindow, getCurrentSemesterWindow } from "@/utils/semester-course-filter";
import type { CourseAttendance } from "@/types";

const course: CourseAttendance = {
  courseId: "attendance-1",
  courseCode: "CSE311",
  courseName: "Operating Systems",
  termId: "2026-odd",
  attendanceCourseId: "attendance-1",
  lmsCourseId: null,
  mappingSource: "unresolved",
  attendanceModuleId: null,
  totalSessions: 1,
  attended: 1,
  present: 1,
  dlCredited: 0,
  dlOverflow: 0,
  percentage: 100,
  records: [],
  lastUpdated: 0,
};

describe("semester course filtering", () => {
  test("keeps July sessions in the odd semester", () => {
    const window = getCurrentSemesterWindow(new Date("2026-07-31T12:00:00"));
    const result = evaluateCourseAgainstSemesterWindow({
      ...course,
      records: [
        {
          sessionId: "session-1",
          termId: "2026-odd",
          date: "Thu 30 Jul 2026 10:00 AM - 10:55 AM",
          exactDate: "2026-07-30",
          startTime: "10:00",
          endTime: "10:55",
          section: null,
          topic: null,
          description: "Operating Systems",
          status: "Present",
          sourceStatus: "PRESENT",
          points: "1 / 1",
        },
      ],
    }, window);

    expect(window.semesterKey).toBe("2026-jul-jan");
    expect(result.insideCount).toBe(1);
    expect(result.shouldAutoDrop).toBe(false);
  });
});
