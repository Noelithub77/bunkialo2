import { describe, expect, test } from "bun:test";
import { extractCourseCode, extractCourseName } from "./course-name";

describe("course name helpers", () => {
  test("keeps names that do not start with a course code", () => {
    expect(extractCourseName("Operations and Supply Chain Management")).toBe(
      "Operations and Supply Chain Management",
    );
    expect(extractCourseName("Human Resource Management")).toBe(
      "Human Resource Management",
    );
  });

  test("removes a real code prefix", () => {
    expect(extractCourseName("CSE311 Artificial Intelligence")).toBe(
      "Artificial Intelligence",
    );
    expect(extractCourseCode("CSE311 Artificial Intelligence")).toBe("CSE311");
  });
});
