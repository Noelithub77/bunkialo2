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
let portalFails = false;
let portalSelfDisconnects = false;
let portalCallCount = 0;
let lastCachedArg;
mock.module("@/services/attendance-portal", {
  namedExports: {
    hasPortalCredentials: async () => portalConnected,
    fetchPortalAttendance: async (_codes, cached) => {
      portalCallCount += 1;
      lastCachedArg = cached;
      // Yield so concurrent callers overlap, which is what the guard must cover.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (portalFails) {
        if (portalSelfDisconnects) portalConnected = false;
        throw new Error("Portal session expired");
      }
      return portalCourses;
    },
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
  portalFails = false;
  portalSelfDisconnects = false;
  portalCallCount = 0;
  scraped = [];
  useAttendanceStore.setState({
    courses: [],
    isLoading: false,
    lastSyncTime: null,
    error: null,
    portalDisconnected: false,
  });
});

test("reads from the portal when portal credentials exist", async () => {
  portalConnected = true;
  portalCourses = [course("p")];
  scraped = [course("moodle")];

  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(ids(), ["p"]);
});

test("a portal failure keeps the cached courses and surfaces an error", async () => {
  useAttendanceStore.setState({ courses: [course("cached")] });
  portalConnected = true;
  portalFails = true;

  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(ids(), ["cached"]);
  assert.ok(useAttendanceStore.getState().error);
  assert.equal(useAttendanceStore.getState().isLoading, false);
});

test("a background portal failure stays silent and keeps the cache", async () => {
  useAttendanceStore.setState({ courses: [course("cached")] });
  portalConnected = true;
  portalFails = true;

  await useAttendanceStore.getState().fetchAttendance({ background: true });

  assert.deepEqual(ids(), ["cached"]);
  assert.equal(useAttendanceStore.getState().error, null);
});

// --- self-disconnection must not be silent ---

test("a portal that logs itself out is reported as needing reconnection", async () => {
  // performRefresh clears credentials when both the refresh token and the
  // stored password are rejected. Without a flag the user just sees stale data
  // forever and never learns to reconnect.
  useAttendanceStore.setState({ courses: [course("cached")] });
  portalConnected = true;
  portalFails = true;
  portalSelfDisconnects = true;

  await useAttendanceStore.getState().fetchAttendance();

  assert.equal(useAttendanceStore.getState().portalDisconnected, true);
  assert.match(useAttendanceStore.getState().error, /reconnect/i);
  assert.deepEqual(ids(), ["cached"]);
});

test("a background self-disconnection still raises the flag", async () => {
  portalConnected = true;
  portalFails = true;
  portalSelfDisconnects = true;

  await useAttendanceStore.getState().fetchAttendance({ background: true });

  assert.equal(useAttendanceStore.getState().portalDisconnected, true);
});

test("an ordinary network failure is not reported as a disconnection", async () => {
  useAttendanceStore.setState({ courses: [course("cached")] });
  portalConnected = true;
  portalFails = true;
  portalSelfDisconnects = false;

  await useAttendanceStore.getState().fetchAttendance();

  assert.equal(useAttendanceStore.getState().portalDisconnected, false);
});

test("a successful fetch clears the reconnect flag", async () => {
  useAttendanceStore.setState({ portalDisconnected: true });
  portalConnected = true;
  portalCourses = [course("p")];

  await useAttendanceStore.getState().fetchAttendance();

  assert.equal(useAttendanceStore.getState().portalDisconnected, false);
});

// --- needless churn ---

test("an unchanged result leaves courses and lastSyncTime untouched", async () => {
  // Every write replaces the courses array and bumps lastSyncTime, which
  // attendance.tsx watches to run syncFromLms, which regenerates the timetable.
  // Doing that on every navigation re-renders the whole tree for nothing.
  portalConnected = true;
  portalCourses = [course("p")];

  await useAttendanceStore.getState().fetchAttendance();
  const first = useAttendanceStore.getState();
  const firstCourses = first.courses;
  const firstSync = first.lastSyncTime;

  // A fresh but equivalent payload, as a repeat fetch would produce.
  portalCourses = [course("p")];
  await useAttendanceStore.getState().fetchAttendance({ force: true });

  const second = useAttendanceStore.getState();
  assert.equal(second.courses, firstCourses, "array identity must be kept");
  assert.equal(second.lastSyncTime, firstSync, "no downstream recompute");
});

test("a real change still updates courses and lastSyncTime", async () => {
  portalConnected = true;
  portalCourses = [course("p")];
  await useAttendanceStore.getState().fetchAttendance();
  const firstSync = useAttendanceStore.getState().lastSyncTime;

  portalCourses = [{ ...course("p"), totalSessions: 11, attended: 10 }];
  await useAttendanceStore.getState().fetchAttendance({ force: true });

  const state = useAttendanceStore.getState();
  assert.equal(state.courses[0].totalSessions, 11);
  assert.notEqual(state.lastSyncTime, firstSync);
});

test("a new course appearing counts as a change", async () => {
  portalConnected = true;
  portalCourses = [course("p")];
  await useAttendanceStore.getState().fetchAttendance();

  portalCourses = [course("p"), course("q")];
  await useAttendanceStore.getState().fetchAttendance({ force: true });

  assert.deepEqual(ids(), ["p", "q"]);
});

// --- request load ---

test("concurrent callers share one in-flight fetch", async () => {
  // Dashboard mount, attendance tab mount and its sub-tabs all call this. Each
  // portal fetch is 1 + N requests, so unshared bursts multiply quickly.
  portalConnected = true;
  portalCourses = [course("p")];

  await Promise.all([
    useAttendanceStore.getState().fetchAttendance(),
    useAttendanceStore.getState().fetchAttendance(),
    useAttendanceStore.getState().fetchAttendance(),
  ]);

  assert.equal(portalCallCount, 1);
});

test("a forced refresh bypasses the in-flight guard and the cache", async () => {
  portalConnected = true;
  portalCourses = [course("p")];

  await useAttendanceStore.getState().fetchAttendance();
  assert.equal(portalCallCount, 1);

  await useAttendanceStore.getState().fetchAttendance({ force: true });

  assert.equal(portalCallCount, 2);
  // Empty cache means every course is re-fetched, not just changed ones.
  assert.deepEqual(lastCachedArg, []);
});

test("an ordinary refresh passes the cached courses through", async () => {
  portalConnected = true;
  portalCourses = [course("p")];

  await useAttendanceStore.getState().fetchAttendance();
  await useAttendanceStore.getState().fetchAttendance();

  assert.deepEqual(lastCachedArg.map((c) => c.courseId), ["p"]);
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
