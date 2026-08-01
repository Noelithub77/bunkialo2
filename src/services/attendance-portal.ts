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

// Access token stays in memory only, mirroring the portal's own web client.
let accessToken: string | null = null;
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

const postJson = async (path: string, body: unknown, token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${PORTAL_API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return response;
};

export const hasPortalCredentials = async (): Promise<boolean> =>
  (await SecureStore.getItemAsync(CREDENTIALS_KEY)) !== null;

export const disconnectPortal = async (): Promise<void> => {
  accessToken = null;
  refreshInFlight = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
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

  if (data.needs2fa) {
    return { kind: "needs2fa", intermediate: data.intermediate };
  }
  if (data.needsEmailOtp) {
    return { kind: "needsEmailOtp", intermediate: data.intermediate };
  }

  accessToken = data.access;
  await SecureStore.setItemAsync(REFRESH_KEY, data.refresh);
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({ email, password }),
  );
  debug.scraper("Portal login succeeded");
  return { kind: "success" };
};

const performRefresh = async (): Promise<boolean> => {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh) return false;

  const response = await postJson("/auth/refresh", { refresh });
  if (!response.ok) {
    debug.scraper("Portal refresh rejected, clearing credentials");
    await disconnectPortal();
    return false;
  }

  const data = await response.json();
  accessToken = data.access;
  // The server may rotate the refresh token; persisting it is not optional.
  if (data.refresh) await SecureStore.setItemAsync(REFRESH_KEY, data.refresh);
  return true;
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
    throw new PortalError(response.status, `Portal request failed: ${path}`);
  }
  return (await response.json()) as T;
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
  const summary = await authedGet<{ courses: PortalCourse[] }>(
    "/students/me/attendance",
  );
  const courses = summary.courses ?? [];

  return Promise.all(
    courses.map(async (course) => {
      const sessions = await fetchCourseSessions(course.courseId);
      return toCourseAttendance(course, sessions, moodleCourses);
    }),
  );
};

/** Test seam: clears module-level auth state between cases. */
export const __resetForTests = async (): Promise<void> => {
  accessToken = null;
  refreshInFlight = null;
};
