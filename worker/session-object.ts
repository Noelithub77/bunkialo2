import { DurableObject } from "cloudflare:workers";
import type { PushSubscription } from "@pushforge/builder";
import type { StoredCookie } from "./lms/cookie-jar";
import { fetchLmsWithCookies } from "./lms/fetch-with-cookies";
import {
  extractLoginToken,
  getLmsOrigin,
  isAllowedLmsPath,
  isLmsLoginPage,
  isLmsLoginSuccessful,
} from "./lms/login-check";
import { sendReminderPush } from "./push/send-push";

type LmsSession = {
  cookies: StoredCookie[];
  origin: string;
  username: string;
};

type AttendanceTokens = {
  accessToken: string;
  refreshToken: string;
};

type ReminderRow = {
  body: string;
  due_at: number;
  id: string;
  sent_at: number | null;
  title: string;
  url: string;
};

export interface FullSyncPayload {
  attendance: {
    notifications: unknown;
    sessions: Record<string, unknown>;
    summary: unknown;
    terms: unknown;
  } | null;
  lms: {
    courses: unknown;
    timeline: unknown;
  } | null;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const ATTENDANCE_PATHS = [
  /^\/api\/auth\/(login(?:\/(?:email-otp|backup-code|totp))?|logout|me|refresh)$/,
  /^\/api\/notifications(?:\/read-all|\/[^/]+\/read)?$/,
  /^\/api\/students\/me\/attendance$/,
  /^\/api\/students\/me\/courses\/[^/]+\/sessions$/,
  /^\/api\/terms$/,
];

const responseHeaders = (upstream: Response): Headers => {
  const headers = new Headers();
  for (const name of [
    "content-disposition",
    "content-length",
    "content-type",
    "last-modified",
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("Cache-Control", "no-store");
  return headers;
};

const limitedResponse = (upstream: Response): Response => {
  const size = Number(upstream.headers.get("content-length") ?? "0");
  if (size > MAX_RESPONSE_BYTES) {
    return Response.json({ error: "Upstream response is too large." }, { status: 413 });
  }
  return new Response(upstream.body, {
    headers: responseHeaders(upstream),
    status: upstream.status,
    statusText: upstream.statusText,
  });
};

const tokenValues = (value: unknown): AttendanceTokens | null => {
  if (typeof value !== "object" || value === null) return null;
  const data = value as Record<string, unknown>;
  const accessToken = data.access ?? data.accessToken;
  const refreshToken = data.refresh ?? data.refreshToken;
  return typeof accessToken === "string" && typeof refreshToken === "string"
    ? { accessToken, refreshToken }
    : null;
};

const readJsonIfPossible = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.clone().json() : null;
};

export class UserSession extends DurableObject<CloudflareBindings> {
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS session_values (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          due_at INTEGER NOT NULL,
          url TEXT NOT NULL,
          sent_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS reminders_due_at
          ON reminders(due_at, sent_at);
      `);
    });
  }

  private setValue(key: string, value: unknown): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO session_values (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      JSON.stringify(value),
      Date.now(),
    );
  }

  private getValue<T>(key: string): T | null {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>("SELECT value FROM session_values WHERE key = ?", key)
      .toArray()[0];
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      this.ctx.storage.sql.exec("DELETE FROM session_values WHERE key = ?", key);
      return null;
    }
  }

  private deleteValues(...keys: string[]): void {
    for (const key of keys) {
      this.ctx.storage.sql.exec("DELETE FROM session_values WHERE key = ?", key);
    }
  }

  private async keepAlive(): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    if (current === null) await this.ctx.storage.setAlarm(Date.now() + SESSION_TTL_MS);
  }

  async loginLms(username: string, password: string): Promise<boolean> {
    const origin = getLmsOrigin(username);
    const loginPageResult = await fetchLmsWithCookies({
      headers: { Accept: "text/html,application/xhtml+xml" },
      isAllowedPath: isAllowedLmsPath,
      origin,
      path: "/login/index.php",
    });
    const loginHtml = await loginPageResult.response.text();
    const token = extractLoginToken(loginHtml);

    const body = new URLSearchParams({ anchor: "", password, username });
    if (token) body.set("logintoken", token);
    const loginResult = await fetchLmsWithCookies({
      body: body.toString(),
      cookies: loginPageResult.cookies,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      isAllowedPath: isAllowedLmsPath,
      method: "POST",
      origin,
      path: "/login/index.php",
    });
    const html = await loginResult.response.text();
    const success = isLmsLoginSuccessful(html);
    if (success) {
      this.setValue("lms", {
        cookies: loginResult.cookies,
        origin,
        username,
      } satisfies LmsSession);
      await this.keepAlive();
    } else {
      this.deleteValues("lms");
      console.warn(JSON.stringify({
        finalPath: loginResult.url.pathname,
        message: "LMS login validation failed",
        redirectCount: loginResult.redirectCount,
        status: loginResult.response.status,
      }));
    }
    return success;
  }

  async checkLms(): Promise<boolean> {
    const session = this.getValue<LmsSession>("lms");
    if (!session) return false;
    const result = await fetchLmsWithCookies({
      cookies: session.cookies,
      isAllowedPath: isAllowedLmsPath,
      origin: session.origin,
      path: "/my/",
    });
    session.cookies = result.cookies;
    this.setValue("lms", session);
    return result.response.ok && !isLmsLoginPage(await result.response.text());
  }

  async relayLms(input: {
    body: ArrayBuffer | null;
    contentType: string | null;
    method: string;
    path: string;
  }): Promise<Response> {
    const session = this.getValue<LmsSession>("lms");
    if (!session) return Response.json({ error: "LMS session is missing." }, { status: 401 });
    const target = new URL(input.path, session.origin);
    if (target.origin !== session.origin || !isAllowedLmsPath(target.pathname)) {
      return Response.json({ error: "LMS path is not allowed." }, { status: 400 });
    }

    const headers = new Headers({ Accept: "*/*" });
    if (input.contentType) headers.set("Content-Type", input.contentType);
    const result = await fetchLmsWithCookies({
      body: input.body,
      cookies: session.cookies,
      headers,
      isAllowedPath: isAllowedLmsPath,
      method: input.method,
      origin: session.origin,
      path: target.toString(),
    });
    session.cookies = result.cookies;
    this.setValue("lms", session);
    await this.keepAlive();
    return limitedResponse(result.response);
  }

  async syncAll(): Promise<FullSyncPayload> {
    const lms = this.getValue<LmsSession>("lms");
    if (!lms) return { attendance: null, lms: null };

    const page = await fetchLmsWithCookies({
      cookies: lms.cookies,
      isAllowedPath: isAllowedLmsPath,
      origin: lms.origin,
      path: "/my/",
    });
    lms.cookies = page.cookies;
    const pageHtml = await page.response.text();
    if (!page.response.ok || isLmsLoginPage(pageHtml)) {
      this.deleteValues("lms");
      return { attendance: null, lms: null };
    }

    const sesskey = pageHtml.match(/"sesskey":"([^"]+)"/i)?.[1];
    if (!sesskey) {
      this.setValue("lms", lms);
      return { attendance: null, lms: null };
    }

    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const lmsBody = JSON.stringify([
      {
        index: 0,
        methodname: "core_calendar_get_action_events_by_timesort",
        args: {
          limitnum: 20,
          timesortfrom: now,
          limittononsuspendedevents: true,
        },
      },
      {
        index: 1,
        methodname: "core_calendar_get_action_events_by_timesort",
        args: {
          limitnum: 20,
          timesortfrom: thirtyDaysAgo,
          timesortto: now,
          limittononsuspendedevents: true,
        },
      },
      {
        index: 2,
        methodname: "core_course_get_enrolled_courses_by_timeline_classification",
        args: { offset: 0, limit: 0, classification: "inprogress", sort: "fullname" },
      },
    ]);
    const lmsBatch = await fetchLmsWithCookies({
      body: lmsBody,
      cookies: lms.cookies,
      headers: { "Content-Type": "application/json" },
      isAllowedPath: isAllowedLmsPath,
      method: "POST",
      origin: lms.origin,
      path: `/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}`,
    });
    lms.cookies = lmsBatch.cookies;
    this.setValue("lms", lms);
    await this.keepAlive();

    const batchData = await readJsonIfPossible(lmsBatch.response);
    const lmsPayload = lmsBatch.response.ok
      ? { courses: Array.isArray(batchData) ? batchData[2] ?? null : null, timeline: Array.isArray(batchData) ? batchData.slice(0, 2) : null }
      : null;

    const attendance = await this.syncAttendance();
    return { attendance, lms: lmsPayload };
  }

  private async syncAttendance(): Promise<FullSyncPayload["attendance"]> {
    let tokens = this.getValue<AttendanceTokens>("attendance");
    if (!tokens) return null;

    const fetchJson = async (path: string): Promise<unknown> => {
      const request = (): Promise<Response> => fetch(
        new URL(path, this.env.ATTENDANCE_PORTAL_URL),
        { headers: { Accept: "application/json", Authorization: `Bearer ${tokens?.accessToken ?? ""}` } },
      );
      let response = await request();
      if (response.status === 401 && tokens) {
        tokens = await this.refreshAttendanceTokens(tokens);
        if (!tokens) return null;
        response = await request();
      }
      if (!response.ok) return null;
      const data = await readJsonIfPossible(response);
      const newTokens = tokenValues(data);
      if (newTokens) {
        tokens = newTokens;
        this.setValue("attendance", newTokens);
      }
      return data;
    };

    const [summary, terms, notifications] = await Promise.all([
      fetchJson("/api/students/me/attendance"),
      fetchJson("/api/terms"),
      fetchJson("/api/notifications"),
    ]);
    if (!summary) return null;

    const sessions: Record<string, unknown> = {};
    const courseIds = this.extractAttendanceCourseIds(summary);
    await Promise.all(courseIds.map(async (courseId) => {
      const value = await fetchJson(`/api/students/me/courses/${encodeURIComponent(courseId)}/sessions`);
      if (value) sessions[courseId] = value;
    }));
    if (tokens) this.setValue("attendance", tokens);
    await this.keepAlive();
    return { notifications, sessions, summary, terms };
  }

  private extractAttendanceCourseIds(value: unknown): string[] {
    if (typeof value !== "object" || value === null) return [];
    const record = value as Record<string, unknown>;
    const courses = record.courses ?? record.byCourse;
    if (!Array.isArray(courses)) return [];
    return courses.flatMap((course) => {
      if (typeof course !== "object" || course === null) return [];
      const id = (course as Record<string, unknown>).courseId;
      return typeof id === "string" ? [id] : typeof id === "number" ? [String(id)] : [];
    });
  }

  private async refreshAttendanceTokens(tokens: AttendanceTokens): Promise<AttendanceTokens | null> {
    const response = await fetch(new URL("/api/auth/refresh", this.env.ATTENDANCE_PORTAL_URL), {
      body: JSON.stringify({ refresh: tokens.refreshToken }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const refreshed = tokenValues(await readJsonIfPossible(response));
    if (!response.ok || !refreshed) {
      this.deleteValues("attendance");
      return null;
    }
    this.setValue("attendance", refreshed);
    return refreshed;
  }

  async relayAttendance(input: {
    body: ArrayBuffer | null;
    contentType: string | null;
    method: string;
    path: string;
  }): Promise<Response> {
    const target = new URL(input.path, this.env.ATTENDANCE_PORTAL_URL);
    if (
      target.origin !== this.env.ATTENDANCE_PORTAL_URL ||
      !ATTENDANCE_PATHS.some((pattern) => pattern.test(target.pathname))
    ) {
      return Response.json({ error: "Attendance path is not allowed." }, { status: 400 });
    }

    const headers = new Headers({ Accept: "application/json" });
    if (input.contentType) headers.set("Content-Type", input.contentType);
    let tokens = this.getValue<AttendanceTokens>("attendance");
    const isLogin = target.pathname.startsWith("/api/auth/login");
    const isRefresh = target.pathname === "/api/auth/refresh";
    if (tokens && !isLogin && !isRefresh) {
      headers.set("Authorization", `Bearer ${tokens.accessToken}`);
    }

    let response = await fetch(target, {
      body: input.body,
      headers,
      method: input.method,
    });
    if (response.status === 401 && tokens && !isLogin && !isRefresh) {
      tokens = await this.refreshAttendanceTokens(tokens);
      if (tokens) {
        headers.set("Authorization", `Bearer ${tokens.accessToken}`);
        response = await fetch(target, {
          body: input.body,
          headers,
          method: input.method,
        });
      }
    }
    const responseData = await readJsonIfPossible(response);
    const newTokens = tokenValues(responseData);
    if (newTokens) this.setValue("attendance", newTokens);
    if (target.pathname === "/api/auth/logout" && response.ok) {
      this.deleteValues("attendance");
    }
    await this.keepAlive();
    return limitedResponse(response);
  }

  async logout(): Promise<void> {
    this.deleteValues("attendance", "lms");
    this.ctx.storage.sql.exec("DELETE FROM reminders");
    await this.ctx.storage.deleteAlarm();
  }

  async savePushSubscription(subscription: PushSubscription): Promise<void> {
    this.setValue("push", subscription);
    await this.scheduleNextAlarm();
  }

  async removePushSubscription(): Promise<void> {
    this.deleteValues("push");
    this.ctx.storage.sql.exec("DELETE FROM reminders");
    await this.ctx.storage.deleteAlarm();
  }

  async scheduleReminder(reminder: {
    body: string;
    date: number;
    id: string;
    title: string;
    url?: string;
  }): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT INTO reminders (id, title, body, due_at, url, sent_at)
       VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         body = excluded.body,
         due_at = excluded.due_at,
         url = excluded.url,
         sent_at = NULL`,
      reminder.id,
      reminder.title,
      reminder.body,
      reminder.date,
      reminder.url ?? "/",
    );
    await this.scheduleNextAlarm();
  }

  async cancelReminder(id: string): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM reminders WHERE id = ?", id);
    await this.scheduleNextAlarm();
  }

  async clearReminders(): Promise<void> {
    this.ctx.storage.sql.exec("DELETE FROM reminders");
    await this.scheduleNextAlarm();
  }

  async hasPushSubscription(): Promise<boolean> {
    return this.getValue<PushSubscription>("push") !== null;
  }

  private async scheduleNextAlarm(): Promise<void> {
    const next = this.ctx.storage.sql
      .exec<{ due_at: number | null }>(
        "SELECT MIN(due_at) AS due_at FROM reminders WHERE sent_at IS NULL",
      )
      .one().due_at;
    if (next !== null) {
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, next));
    } else if (this.getValue<PushSubscription>("push")) {
      await this.ctx.storage.setAlarm(Date.now() + SESSION_TTL_MS);
    } else {
      await this.ctx.storage.deleteAlarm();
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const due = this.ctx.storage.sql
      .exec<ReminderRow>(
        `SELECT id, title, body, due_at, url, sent_at
         FROM reminders WHERE sent_at IS NULL AND due_at <= ? ORDER BY due_at`,
        now,
      )
      .toArray();
    const subscription = this.getValue<PushSubscription>("push");
    const privateKey = this.env.VAPID_PRIVATE_KEY;

    if (due.length === 0) {
      this.deleteValues("attendance", "lms", "push");
      this.ctx.storage.sql.exec("DELETE FROM reminders");
      await this.ctx.storage.deleteAlarm();
      return;
    }

    if (subscription && privateKey) {
      for (const reminder of due) {
        const response = await sendReminderPush({
          adminContact: this.env.VAPID_ADMIN_CONTACT,
          privateKey,
          reminder: {
            body: reminder.body,
            id: reminder.id,
            title: reminder.title,
            url: reminder.url,
          },
          subscription,
        });
        if (response.ok) {
          this.ctx.storage.sql.exec(
            "UPDATE reminders SET sent_at = ? WHERE id = ?",
            now,
            reminder.id,
          );
        } else if (response.status === 404 || response.status === 410) {
          this.deleteValues("push");
          this.ctx.storage.sql.exec("DELETE FROM reminders");
          break;
        } else {
          throw new Error(`Push service returned ${response.status}.`);
        }
      }
    }

    this.ctx.storage.sql.exec(
      "DELETE FROM reminders WHERE sent_at IS NOT NULL AND sent_at < ?",
      now - 7 * 24 * 60 * 60 * 1000,
    );
    await this.scheduleNextAlarm();
  }
}
