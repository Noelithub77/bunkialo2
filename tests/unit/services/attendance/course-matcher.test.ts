import { describe, expect, test } from "bun:test";
import { matchCourses } from "@/services/attendance/course-matcher";
import type { Course, PortalCourseSummary } from "@/types";

const portalCourse: PortalCourseSummary = {
  courseId: "attendance-1",
  code: "CSE311",
  name: "Operating Systems",
  total: 10,
  present: 8,
  dlCredited: 0,
  dlOverflow: 0,
  percentage: 80,
  termId: "term-1",
};

const lmsCourses: Course[] = [
  { id: "160", name: "Operating Systems", shortName: "CSE311", url: "" },
  { id: "161", name: "Computer Networks", shortName: "CSE312", url: "" },
];

describe("course matching", () => {
  test("matches an exact course code", () => {
    const [result] = matchCourses([portalCourse], lmsCourses);
    expect(result.lmsCourseId).toBe("160");
    expect(result.mappingSource).toBe("code");
  });

  test("matches a close course name when the code is unavailable", () => {
    const [result] = matchCourses(
      [{ ...portalCourse, code: "UNKNOWN", name: "Operating System" }],
      [{ id: "160", name: "Operating Systems", url: "" }],
    );
    expect(result.lmsCourseId).toBe("160");
    expect(result.mappingSource).toBe("name");
  });

  test("leaves an ambiguous course unresolved", () => {
    const [result] = matchCourses(
      [{ ...portalCourse, code: "UNKNOWN", name: "Systems" }],
      [
        { id: "1", name: "System Design", url: "" },
        { id: "2", name: "Systems Engineering", url: "" },
      ],
    );
    expect(result.mappingSource).toBe("unresolved");
  });
});
