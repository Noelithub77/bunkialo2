// Run: npm run test
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// In-memory stand-in for the device keychain.
const vault = new Map();
mock.module("expo-secure-store", {
  namedExports: {
    getItemAsync: async (k) => vault.get(k) ?? null,
    setItemAsync: async (k, v) => void vault.set(k, v),
    deleteItemAsync: async (k) => void vault.delete(k),
  },
});

const portal = await import("./attendance-portal.ts");

/** Queue of [status, body] pairs, consumed in order. Records every call. */
let queue = [];
const calls = [];

globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method ?? "GET", init });
  const next = queue.shift();
  if (!next) throw new Error(`unexpected request: ${url}`);
  const [status, body] = next;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
};

const authHeader = (call) =>
  new Headers(call.init.headers ?? {}).get("authorization");

beforeEach(async () => {
  queue = [];
  calls.length = 0;
  vault.clear();
  await portal.__resetForTests();
});

test("login stores the refresh token and keeps the access token in memory", async () => {
  queue = [[200, { access: "acc-1", refresh: "ref-1", user: { id: "u1" } }]];

  const result = await portal.login("s@iiitkottayam.ac.in", "pw");

  assert.equal(result.kind, "success");
  assert.equal(calls[0].url, `${portal.PORTAL_API}/auth/login`);
  assert.equal(calls[0].method, "POST");
  // Refresh token persists; the access token must not.
  assert.equal(vault.get("attendance_portal_refresh"), "ref-1");
  assert.equal([...vault.values()].includes("acc-1"), false);
});

test("login surfaces a 2FA challenge instead of pretending to succeed", async () => {
  queue = [[200, { needs2fa: true, intermediate: "int-1" }]];

  const result = await portal.login("s@iiitkottayam.ac.in", "pw");

  assert.equal(result.kind, "needs2fa");
  assert.equal(result.intermediate, "int-1");
});

test("login rejects bad credentials without storing anything", async () => {
  queue = [[401, { error: "invalid_credentials" }]];

  await assert.rejects(() => portal.login("s@iiitkottayam.ac.in", "nope"));
  assert.equal(vault.size, 0);
});

test("an authenticated request carries the bearer token", async () => {
  queue = [
    [200, { access: "acc-1", refresh: "ref-1", user: {} }],
    [200, { courses: [], recent: [] }],
  ];

  await portal.login("s@iiitkottayam.ac.in", "pw");
  await portal.fetchPortalAttendance([]);

  assert.equal(authHeader(calls[1]), "Bearer acc-1");
});

test("a 401 refreshes once and retries the original request", async () => {
  vault.set("attendance_portal_refresh", "ref-1");
  queue = [
    [401, { error: "missing_token" }],
    [200, { access: "acc-2", refresh: "ref-2" }],
    [200, { courses: [], recent: [] }],
  ];

  await portal.fetchPortalAttendance([]);

  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, `${portal.PORTAL_API}/auth/refresh`);
  assert.equal(authHeader(calls[2]), "Bearer acc-2");
  // Rotated refresh token must be persisted, or the next session is locked out.
  assert.equal(vault.get("attendance_portal_refresh"), "ref-2");
});

test("concurrent 401s trigger exactly one refresh", async () => {
  // The N+1 fan-out means parallel requests hit 401 together. If each refreshed
  // independently and the server rotates refresh tokens, all but one would be
  // invalidated and the user would be locked out.
  vault.set("attendance_portal_refresh", "ref-1");
  queue = [
    [401, { error: "missing_token" }],
    [401, { error: "missing_token" }],
    [401, { error: "missing_token" }],
    [200, { access: "acc-2", refresh: "ref-2" }],
    [200, { sessions: [] }],
    [200, { sessions: [] }],
    [200, { sessions: [] }],
  ];

  await Promise.all([
    portal.fetchCourseSessions("c1"),
    portal.fetchCourseSessions("c2"),
    portal.fetchCourseSessions("c3"),
  ]);

  const refreshes = calls.filter((c) => c.url.endsWith("/auth/refresh"));
  assert.equal(refreshes.length, 1);
});

test("a failed refresh clears stored credentials so the app can re-prompt", async () => {
  vault.set("attendance_portal_refresh", "stale");
  vault.set("attendance_portal_credentials", "{}");
  queue = [
    [401, { error: "missing_token" }],
    [401, { error: "invalid_refresh" }],
  ];

  await assert.rejects(() => portal.fetchPortalAttendance([]));
  assert.equal(await portal.hasPortalCredentials(), false);
});

test("fetchPortalAttendance adapts the payload into CourseAttendance", async () => {
  vault.set("attendance_portal_refresh", "ref-1");
  queue = [
    [
      200,
      {
        courses: [
          {
            courseId: "p-1",
            courseCode: "CS101",
            courseName: "Data Structures",
            present: 3,
            total: 4,
            percentage: 75,
          },
        ],
        recent: [],
      },
    ],
    [
      200,
      {
        sessions: [
          {
            sessionId: "s1",
            date: "2026-01-01",
            startTime: "09:00",
            endTime: "09:55",
            section: "A",
            topic: null,
            status: "PRESENT",
          },
        ],
      },
    ],
  ];

  const courses = await portal.fetchPortalAttendance([
    { courseId: "4977", courseCode: "CS101" },
  ]);

  assert.equal(courses.length, 1);
  assert.equal(courses[0].courseId, "4977");
  assert.equal(courses[0].percentage, 75);
  assert.equal(courses[0].records.length, 1);
  assert.match(courses[0].records[0].date, /^Thu 1 Jan 2026 9:00AM - 9:55AM$/);
});

test("disconnect clears everything", async () => {
  vault.set("attendance_portal_refresh", "ref-1");
  vault.set("attendance_portal_credentials", "{}");

  await portal.disconnectPortal();

  assert.equal(await portal.hasPortalCredentials(), false);
  assert.equal(vault.size, 0);
});
