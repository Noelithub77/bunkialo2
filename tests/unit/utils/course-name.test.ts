import { describe, expect, test } from "bun:test";
import { extractCourseCode, extractCourseName } from "@/utils/course-name";

describe("course name parsing", () => {
  test("keeps names that do not start with a course code", () => {
    expect(extractCourseName("Resource Management")).toBe("Resource Management");
    expect(extractCourseCode("Resource Management")).toBe("Resource Management");
  });

  test("removes a real code prefix only", () => {
    expect(extractCourseName("CSE311 - Operating Systems")).toBe("Operating Systems");
    expect(extractCourseCode("CSE311 - Operating Systems")).toBe("CSE311");
  });
});
