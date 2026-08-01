import { createAttendanceSession } from "../../helpers/attendance-session";
import { loadEnvFromRoot } from "../../helpers/lms-session";

loadEnvFromRoot();

const session = createAttendanceSession();

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const readJson = async (path: string): Promise<unknown> => {
  const response = await session.request(path);
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(`${path} failed (${response.status}).`);
  return body;
};

const countItems = (value: unknown, keys: readonly string[]): number => {
  if (Array.isArray(value)) return value.length;
  const record = asRecord(value);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key].length;
  }
  return 0;
};

try {
  const login = await session.login();
  console.log(`login: ${login.status}, cookies: ${login.setCookie ? "unexpected" : "none"}`);

  const oldRefresh = session.getRefreshToken();
  const rotated = await session.refresh();
  console.log(`refresh rotation: ${rotated.status}`);
  const stale = await session.refresh(oldRefresh);
  console.log(`stale refresh: ${stale.status}`);

  const [profileValue, terms, attendanceValue, notifications] = await Promise.all([
    readJson("/api/auth/me"),
    readJson("/api/terms"),
    readJson("/api/students/me/attendance"),
    readJson("/api/notifications"),
  ]);
  const profile = asRecord(profileValue);
  const attendance = asRecord(attendanceValue);
  const courses = Array.isArray(attendance.byCourse)
    ? attendance.byCourse
    : Array.isArray(attendance.courses)
      ? attendance.courses
      : [];
  console.log(`profile: ${typeof profile.email === "string" ? "ok" : "missing email"}`);
  console.log(`terms: ${countItems(terms, ["items", "terms"])}`);
  console.log(`attendance courses: ${courses.length}`);
  console.log(`notifications: ${countItems(notifications, ["items"])}`);

  const sessionCounts = await Promise.all(
    courses.map(async (course) => {
      const courseRecord = asRecord(course);
      const courseId = courseRecord.courseId;
      if (typeof courseId !== "string") return 0;
      const detail = await readJson(
        `/api/students/me/courses/${encodeURIComponent(courseId)}/sessions`,
      );
      return countItems(detail, ["sessions"]);
    }),
  );
  console.log(`course session responses: ${sessionCounts.length}`);
} finally {
  await session.logout();
  console.log("logout: complete");
}
