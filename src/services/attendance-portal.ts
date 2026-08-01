/**
 * Client for the IIIT Kottayam attendance portal.
 * See docs/attendance-portal-recon.md for the reverse-engineered API surface.
 *
 * Deliberately does not reuse services/api.ts: that axios instance is bound to
 * the Moodle base URL and carries a cookie interceptor plus HTML session-expiry
 * detection, none of which apply to a JSON API with bearer auth.
 */
import type {
  CourseAttendance,
  Credentials,
  PortalCourse,
  PortalLoginResult,
  PortalSession,
} from "@/types";
import { debug } from "@/utils/debug";
import * as SecureStore from "expo-secure-store";
import { toCourseAttendance } from "./attendance-portal-adapter";

export const PORTAL_API = "https://attendance.iiitkottayam.ac.in/api";

const REFRESH_KEY = "attendance_portal_refresh";
const CREDENTIALS_KEY = "attendance_portal_credentials";

/**
 * Stricter than the Moodle path's default: keeps secrets out of device backups
 * and unreadable while the phone is locked. Applied here because these keys are
 * new; changing the existing lms_credentials entry would invalidate every
 * current user's saved login.
 */
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Access token stays in memory only, mirroring the portal's own web client.
let accessToken: string | null = null;
// Held between the password step and the 2FA step so an incomplete login never
// leaves a password on disk. Cleared by disconnectPortal.
let pendingCredentials: Credentials | null = null;
// Shared so concurrent 401s collapse into a single refresh. Without this, the
// N+1 course fan-out fires N refreshes at once and, because the server rotates
// refresh tokens, all but one are invalidated and the user is locked out.
let refreshInFlight: Promise<boolean> | null = null;

export class PortalError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Matches the 30s on the Moodle axios instance (services/api.ts). Without it a
 * stalled portal leaves isLoading true forever and the attendance tab spins
 * with no way out — fetch has no default timeout.
 */
const REQUEST_TIMEOUT_MS = 30_000;

// AbortSignal.timeout is unavailable on older Hermes; fall back to a manual
// controller rather than dropping the timeout entirely.
const timeoutSignal = (): AbortSignal => {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return controller.signal;
};

const postJson = async (path: string, body: unknown, token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${PORTAL_API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: timeoutSignal(),
  });
  return response;
};

/**
 * Credentials use the shared `Credentials` shape from types/auth.ts, the same
 * one services/auth.ts writes for Moodle. `username` holds the portal email.
 */
export const getPortalCredentials = async (): Promise<Credentials | null> => {
  const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Credentials;
  } catch {
    // Corrupt entry is indistinguishable from no entry, and keeping it would
    // wedge every future login attempt.
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
    return null;
  }
};

export const hasPortalCredentials = async (): Promise<boolean> =>
  (await SecureStore.getItemAsync(CREDENTIALS_KEY)) !== null;

export const disconnectPortal = async (): Promise<void> => {
  accessToken = null;
  refreshInFlight = null;
  // Drops any password held mid-2FA. Abandoning the flow must not leave it in
  // memory for the rest of the process lifetime.
  pendingCredentials = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  debug.portal("Portal disconnected");
};

/** Never logs the token or the password. */
const persistSession = async (
  data: { access: string; refresh?: string },
  credentials?: Credentials,
): Promise<void> => {
  accessToken = data.access;
  // A refresh response need not rotate the token. Writing undefined would throw
  // on device, and clearing it would lock the user out on the next cold start.
  if (data.refresh) {
    await SecureStore.setItemAsync(REFRESH_KEY, data.refresh, KEYCHAIN_OPTIONS);
  }
  if (credentials) {
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify(credentials),
      KEYCHAIN_OPTIONS,
    );
  }
  debug.portal("Portal session established");
};

export const login = async (
  email: string,
  password: string,
): Promise<PortalLoginResult> => {
  const response = await postJson("/auth/login", { email, password });
  if (!response.ok) {
    throw new PortalError(response.status, "Portal login failed");
  }

  const data = await response.json();

  if (data.needs2fa || data.needsEmailOtp) {
    pendingCredentials = { username: email, password };
    return {
      kind: data.needs2fa ? "needs2fa" : "needsEmailOtp",
      intermediate: data.intermediate,
    };
  }

  await persistSession(data, { username: email, password });
  return { kind: "success" };
};

const completeChallenge = async (
  path: string,
  body: Record<string, string>,
): Promise<PortalLoginResult> => {
  const response = await postJson(path, body);
  if (!response.ok) {
    throw new PortalError(response.status, "Portal verification failed");
  }

  const data = await response.json();
  await persistSession(data, pendingCredentials ?? undefined);
  pendingCredentials = null;
  return { kind: "success" };
};

export const submitTotp = (intermediate: string, code: string) =>
  completeChallenge("/auth/login/totp", { intermediate, code });

export const submitEmailOtp = (intermediate: string, code: string) =>
  completeChallenge("/auth/login/email-otp", { intermediate, code });

export const submitBackupCode = (intermediate: string, backupCode: string) =>
  completeChallenge("/auth/login/backup-code", { intermediate, backupCode });

/**
 * Re-authenticates from the stored password when the refresh token is dead,
 * mirroring services/auth.ts tryAutoLogin. Without this the stored password
 * would serve no purpose and should not be kept at all.
 */
const tryAutoLogin = async (): Promise<boolean> => {
  const credentials = await getPortalCredentials();
  if (!credentials) return false;

  try {
    const result = await login(credentials.username, credentials.password);
    // A 2FA account cannot heal silently; it needs the user present.
    return result.kind === "success";
  } catch {
    return false;
  }
};

const performRefresh = async (): Promise<boolean> => {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);

  if (refresh) {
    const response = await postJson("/auth/refresh", { refresh });
    if (response.ok) {
      const data = await response.json();
      // The server may rotate the refresh token; persisting it is not optional.
      await persistSession(data);
      return true;
    }
    debug.portal("Portal refresh rejected, falling back to stored login");
  }

  if (await tryAutoLogin()) return true;

  // Both paths failed: the password is stale or revoked. Clearing it means the
  // next launch prompts instead of retrying a rejected password forever.
  debug.portal("Portal re-authentication failed, clearing credentials");
  await disconnectPortal();
  return false;
};

const refreshAccess = (): Promise<boolean> => {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

/** GET with a single refresh-and-retry on 401, matching the portal's own client. */
const authedGet = async <T>(path: string): Promise<T> => {
  const send = () =>
    fetch(`${PORTAL_API}${path}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: timeoutSignal(),
    });

  let response = await send();

  if (response.status === 401) {
    const refreshed = await refreshAccess();
    if (!refreshed) {
      throw new PortalError(401, "Portal session expired");
    }
    response = await send();
  }

  if (!response.ok) {
    debug.portal("Request failed", { path, status: response.status });
    throw new PortalError(response.status, `Portal request failed: ${path}`);
  }

  const json = await response.json();
  // Joined, not an array: debug.ts sanitize() truncates arrays at 6 entries,
  // which silently hid the `sessions` key and made this log lie.
  debug.portal("Response", { path, keys: Object.keys(json ?? {}).join(",") });
  return json as T;
};

export const fetchCourseSessions = async (
  courseId: string,
): Promise<PortalSession[]> => {
  const data = await authedGet<{ sessions: PortalSession[] }>(
    `/students/me/courses/${encodeURIComponent(courseId)}/sessions`,
  );
  return data.sessions ?? [];
};

/**
 * One summary request plus one per course.
 *
 * ponytail: unbounded Promise.all, same as services/scraper.ts. Ceiling: a
 * student with many courses fires that many parallel requests and the portal's
 * rate limits are unknown. Add a concurrency cap when a 429 actually appears.
 */
export const fetchPortalAttendance = async (
  moodleCourses: { courseId: string; courseCode: string }[],
): Promise<CourseAttendance[]> => {
  // Confirmed live 2026-08-01: {student, overall, byCourse, recent}. The course
  // list is `byCourse`, not `courses` — `courses` is the faculty dashboard's key.
  const summary = await authedGet<{ byCourse: PortalCourse[] }>(
    "/students/me/attendance",
  );
  const courses = summary.byCourse ?? [];

  debug.portal("Attendance summary", {
    courseCount: courses.length,
    courseKeys: courses[0] ? Object.keys(courses[0]).join(",") : "",
    moodleCodes: moodleCourses.map((c) => c.courseCode).join(","),
  });

  const adapted = await Promise.all(
    courses.map(async (course) => {
      const sessions = await fetchCourseSessions(course.courseId);
      const result = toCourseAttendance(course, sessions, moodleCourses);
      debug.portal("Adapted course", {
        code: course.courseCode,
        resolvedId: result.courseId,
        joinedToMoodle: !result.courseId.startsWith("portal:"),
        sessions: sessions.length,
        records: result.records.length,
      });
      return result;
    }),
  );

  return adapted;
};

/** Test seam: clears module-level auth state between cases. */
export const __resetForTests = async (): Promise<void> => {
  accessToken = null;
  refreshInFlight = null;
  pendingCredentials = null;
};
