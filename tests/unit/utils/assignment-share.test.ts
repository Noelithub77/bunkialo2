import { describe, expect, test } from "bun:test";
import type { TimelineEvent } from "@/types";
import {
  getAssignmentViewUrl,
  getSharedAssignmentTargets,
  isSupportedAssignmentShare,
  normalizeSharedFileUri,
} from "@/utils/assignment-share";
import { redirectSystemPath } from "@/app/+native-intent";

const event = (
  id: number,
  dueSeconds: number,
  overrides: Partial<TimelineEvent> = {},
): TimelineEvent => ({
  id,
  name: `Assignment ${id}`,
  activityname: `Assignment ${id}`,
  activitystr: "Assignment",
  modulename: "assign",
  instance: id,
  eventtype: "due",
  timestart: dueSeconds,
  timesort: dueSeconds,
  overdue: false,
  course: {
    id: 162,
    fullname: "Maths",
    shortname: "MA",
    viewurl: "/course/view.php?id=162",
  },
  action: {
    name: "Add submission",
    actionable: true,
    url: `/mod/assign/view.php?id=${id}&action=editsubmission`,
  },
  url: `/mod/assign/view.php?id=${id}`,
  purpose: "assessment",
  ...overrides,
});

describe("native assignment sharing", () => {
  test("orders upcoming deadlines nearest first, then recent overdue, then undated", () => {
    const targets = getSharedAssignmentTargets(
      [
        event(1, 120),
        event(2, 105),
        event(3, 90),
        event(4, 80),
        event(5, 0),
        event(2, 105),
        event(6, 101, { modulename: "quiz" }),
        event(7, 106, { url: "" }),
      ],
      100_000,
    );
    expect(targets.map((target) => target.assignmentId)).toEqual([
      "2",
      "7",
      "1",
      "3",
      "4",
      "5",
    ]);
  });

  test("accepts images and PDFs and rejects other shared payloads", () => {
    expect(
      isSupportedAssignmentShare({
        uri: "file:///one",
        name: "photo.jpg",
        mimeType: "image/jpeg",
      }),
    ).toBe(true);
    expect(
      isSupportedAssignmentShare({
        uri: "file:///two",
        name: "answers.pdf",
        mimeType: "application/pdf",
      }),
    ).toBe(true);
    expect(
      isSupportedAssignmentShare({
        uri: "file:///three",
        name: "answers.PDF",
        mimeType: "application/octet-stream",
      }),
    ).toBe(true);
    expect(
      isSupportedAssignmentShare({
        uri: "file:///four",
        name: "clip.mp4",
        mimeType: "video/mp4",
      }),
    ).toBe(false);
    expect(
      isSupportedAssignmentShare({
        uri: "",
        name: "photo.jpg",
        mimeType: "image/jpeg",
      }),
    ).toBe(false);
  });

  test("LMS links always point at the assignment view and iOS share links open the picker", () => {
    expect(getAssignmentViewUrl("https://lms.example/", "6078")).toBe(
      "https://lms.example/mod/assign/view.php?id=6078",
    );
    expect(
      redirectSystemPath({
        path: "bunkialo://dataUrl=bunkialoShareKey#file",
        initial: true,
      }),
    ).toBe("/share-assignment");
    expect(
      redirectSystemPath({
        path: "bunkialo://timetable?wear=1",
        initial: false,
      }),
    ).toBe("bunkialo://timetable?wear=1");
  });

  test("SDK 58 incoming-share links open the assignment picker", () => {
    expect(
      redirectSystemPath({ path: "bunkialo://expo-sharing", initial: true }),
    ).toBe("/share-assignment");
  });

  test("normalizes iOS photo paths and preserves native content URIs", () => {
    expect(normalizeSharedFileUri("/private/var/mobile/photo.jpg")).toBe(
      "file:///private/var/mobile/photo.jpg",
    );
    expect(normalizeSharedFileUri("content://provider/answers.pdf")).toBe(
      "content://provider/answers.pdf",
    );
    expect(normalizeSharedFileUri("file:///cache/photo.jpg")).toBe(
      "file:///cache/photo.jpg",
    );
  });
});
