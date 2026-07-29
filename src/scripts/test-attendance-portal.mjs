import { loadEnvFromRoot } from "./utils/lms-session.mjs";
import { createAttendanceSession } from "./utils/attendance-session.mjs";

loadEnvFromRoot();

const session = createAttendanceSession();

const readJson = async (path) => {
  const response = await session.request(path);
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} failed (${response.status}).`);
  return body;
};

const countItems = (value, keys) => {
  if (Array.isArray(value)) return value.length;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key].length;
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

  const [profile, terms, attendance, notifications] = await Promise.all([
    readJson("/api/auth/me"),
    readJson("/api/terms"),
    readJson("/api/students/me/attendance"),
    readJson("/api/notifications"),
  ]);
  const courses = attendance.byCourse ?? attendance.courses ?? [];
  console.log(`profile: ${profile.email ? "ok" : "missing email"}`);
  console.log(`terms: ${countItems(terms, ["items", "terms"])}`);
  console.log(`attendance courses: ${courses.length}`);
  console.log(`notifications: ${countItems(notifications, ["items"])}`);

  const sessionCounts = await Promise.all(
    courses.map(async (course) => {
      const detail = await readJson(
        `/api/students/me/courses/${encodeURIComponent(course.courseId)}/sessions`,
      );
      return countItems(detail, ["sessions"]);
    }),
  );
  console.log(`course session responses: ${sessionCounts.length}`);
} finally {
  await session.logout();
  console.log("logout: complete");
}
