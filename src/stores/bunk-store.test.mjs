// Run: npm run test
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// The semester auto-drop is a Moodle-era heuristic: Moodle's "in progress"
// course list keeps stale courses, so bunk-store hides any whose records fall
// mostly outside the current semester window. The portal only ever returns the
// active term, so applying the heuristic there hides real, current courses.
//
// Concretely: the hardcoded window in utils/semester-course-filter.ts opens on
// 1 August. On 1 Aug 2026 a course whose sessions are all dated late July looks
// entirely "outside" the semester and gets dropped.
let attendanceCourses = [];
mock.module("@/stores/attendance-store", {
  namedExports: {
    useAttendanceStore: { getState: () => ({ courses: attendanceCourses }) },
  },
});

const { useBunkStore } = await import("./bunk-store.ts");

const julySession = (i) => ({
  date: `Fri ${24 + i} Jul 2026 11:30AM - 1:30PM`,
  description: "",
  status: "Present",
  points: "",
});

const course = (over = {}) => ({
  courseId: "portal:CSS311",
  courseName: "CSS311 Example Course",
  attendanceModuleId: null,
  totalSessions: 8,
  attended: 8,
  percentage: 100,
  records: [0, 1, 2, 3, 4].map(julySession),
  lastUpdated: 0,
  ...over,
});

beforeEach(() => {
  useBunkStore.setState({
    courses: [],
    hiddenCourses: {},
    autoDropOptOutBySemester: {},
  });
});

test("a portal course is not auto-dropped for falling outside the window", () => {
  attendanceCourses = [course({ source: "portal" })];

  useBunkStore.getState().syncFromLms();

  assert.deepEqual(Object.keys(useBunkStore.getState().hiddenCourses), []);
  assert.equal(useBunkStore.getState().courses.length, 1);
});

test("a Moodle course is still auto-dropped, preserving existing behaviour", () => {
  attendanceCourses = [
    course({ courseId: "4977", attendanceModuleId: "42", source: undefined }),
  ];

  useBunkStore.getState().syncFromLms();

  assert.deepEqual(Object.keys(useBunkStore.getState().hiddenCourses), ["4977"]);
});
