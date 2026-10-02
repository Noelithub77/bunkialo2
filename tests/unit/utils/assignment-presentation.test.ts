import { describe, expect, test } from "bun:test";
import {
  assignmentCourseName,
  assignmentDescription,
  assignmentRelativeDate,
  assignmentSubmissionLabel,
} from "@/utils/assignment-presentation";

describe("assignment presentation", () => {
  test("removes repeated Moodle course codes without losing the subject", () => {
    expect(
      assignmentCourseName("CSS311 CSS311 Parallel and Distributed Computing"),
    ).toBe("Parallel and Distributed Computing");
    expect(assignmentCourseName("CSS311")).toBe("Course");
    expect(assignmentCourseName("Artificial Intelligence")).toBe(
      "Artificial Intelligence",
    );
  });
  test("keeps instructions but removes attachment trees and their timestamps", () => {
    expect(
      assignmentDescription(
        '<div id="intro"><p>Upload your code and output.</p><div id="assign_files_tree123"><a>MPI Part 4.pdf</a><div class="fileuploadsubmissiontime">30 September 2026, 10:26 AM</div></div></div>',
        null,
      ),
    ).toBe("Upload your code and output.");
    expect(
      assignmentDescription(
        '<div id="intro"><div id="assign_files_tree123">MPI Part 4.pdf 30 September 2026</div></div>',
        null,
      ),
    ).toBe("");
    expect(assignmentDescription(null, "Solve question 4.")).toBe(
      "Solve question 4.",
    );
  });
  test("relative dates handle future, past and the deadline boundary", () => {
    const now = Date.parse("2026-10-02T10:00:00Z");
    expect(assignmentRelativeDate(now + 4 * 86400000 + 2 * 3600000, now)).toBe(
      "in 4d",
    );
    expect(assignmentRelativeDate(now - 2 * 86400000, now)).toBe("2d ago");
    expect(assignmentRelativeDate(now + 45 * 60000, now)).toBe("in 45m");
    expect(assignmentRelativeDate(now, now)).toBe("now");
  });
  test("submission status stays accurate and compact", () => {
    expect(assignmentSubmissionLabel("No submissions have been made yet")).toBe(
      "Not submitted",
    );
    expect(assignmentSubmissionLabel("Draft (not submitted)")).toBe("Draft");
    expect(assignmentSubmissionLabel("Submitted for grading")).toBe(
      "Submitted",
    );
  });
});
