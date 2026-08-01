// Run: npm run test
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// In-memory stand-in for the device keychain.
const vault = new Map();
const writeOptions = [];
mock.module("expo-secure-store", {
  namedExports: {
    getItemAsync: async (k) => vault.get(k) ?? null,
    setItemAsync: async (k, v, o) => {
      writeOptions.push(o);
      vault.set(k, v);
    },
    deleteItemAsync: async (k) => void vault.delete(k),
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
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

test("credentials are stored in the same shape as the Moodle ones", async () => {
  queue = [[200, { access: "acc-1", refresh: "ref-1", user: {} }]];

  await portal.login("s@iiitkottayam.ac.in", "pw");

  // types/auth.ts Credentials — { username, password }, same as services/auth.ts
  assert.deepEqual(JSON.parse(vault.get("attendance_portal_credentials")), {
    username: "s@iiitkottayam.ac.in",
    password: "pw",
  });
});

test("secrets are written with the hardened keychain option", async () => {
  queue = [[200, { access: "acc-1", refresh: "ref-1", user: {} }]];

  await portal.login("s@iiitkottayam.ac.in", "pw");

  // WHEN_UNLOCKED_THIS_DEVICE_ONLY keeps secrets off device backups and out of
  // reach while the phone is locked.
  for (const opts of writeOptions) {
    assert.equal(opts?.keychainAccessible, "WHEN_UNLOCKED_THIS_DEVICE_ONLY");
  }
  assert.ok(writeOptions.length >= 2);
});

// --- 2FA ---

test("a TOTP challenge completes the login and stores the tokens", async () => {
  queue = [
    [200, { needs2fa: true, intermediate: "int-1" }],
    [200, { access: "acc-1", refresh: "ref-1", user: {} }],
  ];

  const challenge = await portal.login("s@iiitkottayam.ac.in", "pw");
  assert.equal(challenge.kind, "needs2fa");

  const done = await portal.submitTotp(challenge.intermediate, "123456");

  assert.equal(done.kind, "success");
  assert.equal(calls[1].url, `${portal.PORTAL_API}/auth/login/totp`);
  assert.equal(vault.get("attendance_portal_refresh"), "ref-1");
});

test("an email OTP challenge completes the login", async () => {
  queue = [
    [200, { needsEmailOtp: true, intermediate: "int-2" }],
    [200, { access: "acc-1", refresh: "ref-1", user: {} }],
  ];

  const challenge = await portal.login("s@iiitkottayam.ac.in", "pw");
  await portal.submitEmailOtp(challenge.intermediate, "999111");

  assert.equal(calls[1].url, `${portal.PORTAL_API}/auth/login/email-otp`);
  assert.equal(vault.get("attendance_portal_refresh"), "ref-1");
});

test("a backup code completes the login", async () => {
  queue = [
    [200, { needs2fa: true, intermediate: "int-3" }],
    [200, { access: "acc-1", refresh: "ref-1", user: {} }],
  ];

  const challenge = await portal.login("s@iiitkottayam.ac.in", "pw");
  await portal.submitBackupCode(challenge.intermediate, "aaaa-bbbb");

  assert.equal(calls[1].url, `${portal.PORTAL_API}/auth/login/backup-code`);
});

test("a rejected 2FA code does not store anything", async () => {
  queue = [[401, { error: "invalid_code" }]];

  await assert.rejects(() => portal.submitTotp("int-1", "000000"));
  assert.equal(vault.size, 0);
});

test("2FA credentials are only stored once the challenge is cleared", async () => {
  queue = [[200, { needs2fa: true, intermediate: "int-1" }]];

  await portal.login("s@iiitkottayam.ac.in", "pw");

  // The password must not linger on disk while the login is still incomplete.
  assert.equal(vault.size, 0);
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

test("a dead refresh token silently re-logs in with stored credentials", async () => {
  // Mirrors services/auth.ts tryAutoLogin: the stored password exists so the
  // session can heal itself rather than dead-ending at a prompt.
  vault.set("attendance_portal_refresh", "stale");
  vault.set(
    "attendance_portal_credentials",
    JSON.stringify({ username: "s@iiitkottayam.ac.in", password: "pw" }),
  );
  queue = [
    [401, { error: "missing_token" }],
    [401, { error: "invalid_refresh" }],
    [200, { access: "acc-2", refresh: "ref-2", user: {} }],
    [200, { courses: [], recent: [] }],
  ];

  await portal.fetchPortalAttendance([]);

  assert.equal(calls[2].url, `${portal.PORTAL_API}/auth/login`);
  assert.equal(vault.get("attendance_portal_refresh"), "ref-2");
  assert.equal(await portal.hasPortalCredentials(), true);
});

test("credentials are cleared only when re-login also fails", async () => {
  vault.set("attendance_portal_refresh", "stale");
  vault.set(
    "attendance_portal_credentials",
    JSON.stringify({ username: "s@iiitkottayam.ac.in", password: "wrong" }),
  );
  queue = [
    [401, { error: "missing_token" }],
    [401, { error: "invalid_refresh" }],
    [401, { error: "invalid_credentials" }],
  ];

  await assert.rejects(() => portal.fetchPortalAttendance([]));
  assert.equal(await portal.hasPortalCredentials(), false);
  assert.equal(vault.size, 0);
});

test("a password change on the portal does not strand a stale password", async () => {
  // If re-login fails the vault must be empty, so the next launch prompts
  // rather than retrying a password the portal has already rejected.
  vault.set("attendance_portal_refresh", "stale");
  vault.set(
    "attendance_portal_credentials",
    JSON.stringify({ username: "s@iiitkottayam.ac.in", password: "old" }),
  );
  queue = [
    [401, {}],
    [401, {}],
    [401, {}],
  ];

  await assert.rejects(() => portal.fetchCourseSessions("c1"));
  assert.equal(vault.get("attendance_portal_credentials"), undefined);
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
