import { describe, expect, test } from "bun:test";
import { matchCourses } from "./course-matcher";
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
    const [result] = matchCourses([portalCourse], lmsCourses, []);
    expect(result.lmsCourseId).toBe("160");
    expect(result.mappingSource).toBe("code");
  });

  test("manual links take priority", () => {
    const [result] = matchCourses([portalCourse], lmsCourses, [
      {
        termId: "term-1",
        attendanceCourseId: "attendance-1",
        lmsCourseId: "161",
      },
    ]);
    expect(result.lmsCourseId).toBe("161");
    expect(result.mappingSource).toBe("manual");
  });

  test("leaves an ambiguous course unresolved", () => {
    const [result] = matchCourses(
      [{ ...portalCourse, code: "UNKNOWN", name: "Systems" }],
      [
        { id: "1", name: "System Design", url: "" },
        { id: "2", name: "Systems Engineering", url: "" },
      ],
      [],
    );
    expect(result.mappingSource).toBe("unresolved");
  });
});
