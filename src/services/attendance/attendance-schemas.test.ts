import { describe, expect, test } from "bun:test";
import {
  portalAttendanceSchema,
  portalCourseSessionsSchema,
  portalNotificationsSchema,
  portalTermsSchema,
  portalUserSchema,
} from "./attendance-schemas";

describe("attendance portal schemas", () => {
  test("accepts a profile without a display name", () => {
    const user = portalUserSchema.parse({
      id: "student-1",
      email: "student@example.edu",
      name: null,
    });
    expect(user.name).toBe("Student");
  });

  test("accepts the observed term response", () => {
    const terms = portalTermsSchema.parse({
      terms: [
        {
          id: "term-1",
          name: "Odd 2026",
          academicYear: "2026-27",
          type: "ODD",
          status: "ACTIVE",
        },
      ],
    });
    expect(terms[0].isCurrent).toBe(true);
  });

  test("normalizes observed course field names", () => {
    const result = portalAttendanceSchema.parse({
      byCourse: [
        {
          courseId: "course-1",
          courseCode: "CSE311",
          courseName: "Operating Systems",
          total: 10,
          present: 8,
          dlCredited: 1,
          dlOverflow: 0,
          percentage: 90,
        },
      ],
    });
    expect(result.courses[0].code).toBe("CSE311");
    expect(result.courses[0].termId).toBe("current");
  });

  test("rejects malformed sessions", () => {
    expect(() =>
      portalCourseSessionsSchema.parse({
        courseId: "course-1",
        sessions: [{ sessionId: "1", status: "UNKNOWN" }],
      }),
    ).toThrow();
  });

  test("accepts notifications", () => {
    const result = portalNotificationsSchema.parse({
      unreadCount: 1,
      items: [
        {
          id: "notice-1",
          kind: "attendance",
          title: "Updated",
          body: "Attendance changed",
          link: null,
          createdAt: "2026-07-24T10:00:00Z",
          readAt: null,
        },
      ],
    });
    expect(result.items).toHaveLength(1);
  });
});
