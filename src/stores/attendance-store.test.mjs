// Run: npm run test
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// An empty scrape must not be mistaken for "this student has no courses".
// With Moodle's mod/attendance removed, fetchAllAttendance() returns [] forever,
// which previously wiped the persisted cache and, via bunk-store/timetable-store
// rehydration, the user's whole timetable.
let scraped = [];
mock.module("@/services/scraper", {
  namedExports: { fetchAllAttendance: async () => scraped },
});

let portalConnected = false;
let portalCourses = [];
mock.module("@/services/attendance-portal", {
  namedExports: {
    hasPortalCredentials: async () => portalConnected,
    fetchPortalAttendance: async () => portalCourses,
  },
});

const { useAttendanceStore } = await import("./attendance-store.ts");

const course = (courseId) => ({
  courseId,
  courseName: `CS10${courseId} Example Course`,
  attendanceModuleId: "42",
  totalSessions: 10,
  attended: 9,
  percentage: 90,
  records: [],
  lastUpdated: 0,
});

const ids = () => useAttendanceStore.getState().courses.map((c) => c.courseId);

beforeEach(() => {
  portalConnected = false;
  portalCourses = [];
  scraped = [];
  useAttendanceStore.setState({
    courses: [],
    isLoading: false,
    lastSyncTime: null,
    error: null,
  });
});

test("reads from the portal when portal credentials exist", async () => {
  portalConnected = true;
  portalCourses = [course("p")];
  scraped = [course("moodle")];

  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(ids(), ["p"]);
});

test("falls back to Moodle when the portal is not connected", async () => {
  portalConnected = false;
  scraped = [course("moodle")];

  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(ids(), ["moodle"]);
});

test("keeps cached courses when a foreground scrape returns nothing", async () => {
  useAttendanceStore.setState({ courses: [course("7")] });
  scraped = [];

  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(ids(), ["7"]);
  assert.equal(useAttendanceStore.getState().isLoading, false);
});

test("keeps cached courses when a background scrape returns nothing", async () => {
  useAttendanceStore.setState({ courses: [course("7")] });
  scraped = [];

  await useAttendanceStore.getState().fetchAttendance({ background: true });

  assert.deepEqual(ids(), ["7"]);
});

test("a genuinely empty first sync is still allowed", async () => {
  scraped = [];

  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(ids(), []);
  assert.equal(useAttendanceStore.getState().isLoading, false);
});

test("a non-empty scrape still replaces the cache", async () => {
  useAttendanceStore.setState({ courses: [course("7")] });
  scraped = [course("9")];

  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(ids(), ["9"]);
});

test("silent refresh preserves isLoading when the scrape is empty", async () => {
  useAttendanceStore.setState({ courses: [course("7")], isLoading: true });
  scraped = [];

  await useAttendanceStore.getState().fetchAttendance({ silent: true });

  assert.deepEqual(ids(), ["7"]);
  assert.equal(useAttendanceStore.getState().isLoading, true);
});
