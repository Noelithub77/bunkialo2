import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { UserSession } from "./session-object";
import { publicVapidKeyFromPrivateJwk } from "./push/send-push";
import {
  applyApiHeaders,
  applyWebHeaders,
  isTrustedBrowserRequest,
} from "./security/request-policy";
import {
  attendanceLoginSchema,
  lmsLoginSchema,
  pushReminderSchema,
  pushSubscriptionSchema,
  readJson,
  reminderIdSchema,
} from "./security/validation";

type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: { session: DurableObjectStub<UserSession> };
};

const SESSION_COOKIE = "__Host-bunkialo-session";

const app = new Hono<AppEnv>();

app.use("/api/*", async (context, next) => {
  if (!isTrustedBrowserRequest(context.req.raw)) {
    return context.json({ error: "Cross-site request rejected." }, 403);
  }

  let sessionId = getCookie(context, SESSION_COOKIE);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    setCookie(context, SESSION_COOKIE, sessionId, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
      sameSite: "Strict",
      secure: true,
    });
  }
  context.set("session", context.env.USER_SESSION.getByName(sessionId));
  await next();
});

app.get("/api/health", (context) =>
  context.json({ ok: true, service: "bunkialo" }),
);

app.post("/api/auth/lms/login", async (context) => {
  const request = lmsLoginSchema.safeParse(await readJson(context.req.raw));
  if (!request.success) return context.json({ error: "Invalid login request." }, 400);
  const success = await context.var.session.loginLms(
    request.data.username,
    request.data.password,
  );
  return context.json({ success }, success ? 200 : 401);
});

app.get("/api/auth/lms/session", async (context) =>
  context.json({ valid: await context.var.session.checkLms() }),
);

app.post("/api/sync", async (context) => {
  const payload = await context.var.session.syncAll();
  return context.json(payload);
});

app.post("/api/auth/logout", async (context) => {
  await context.var.session.logout();
  setCookie(context, SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Strict",
    secure: true,
  });
  return context.body(null, 204);
});

app.all("/api/lms/*", async (context) => {
  const url = new URL(context.req.url);
  const upstreamPath = `${url.pathname.slice("/api/lms".length)}${url.search}`;
  const method = context.req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD"
    ? null
    : await context.req.arrayBuffer();
  return context.var.session.relayLms({
    body,
    contentType: context.req.header("content-type") ?? null,
    method,
    path: upstreamPath,
  });
});

app.post("/api/attendance/auth", async (context) => {
  const value = attendanceLoginSchema.safeParse(await readJson(context.req.raw));
  if (!value.success) return context.json({ error: "Invalid attendance login request." }, 400);
  const endpoint = value.data.mode === "password"
    ? "/api/auth/login"
    : value.data.mode === "emailOtp"
      ? "/api/auth/login/email-otp"
      : value.data.mode === "backupCode"
        ? "/api/auth/login/backup-code"
        : "/api/auth/login/totp";
  const payload = value.data.mode === "password"
    ? { email: value.data.email.toLowerCase(), password: value.data.password }
    : {
        intermediate: value.data.intermediate,
        ...(value.data.mode === "backupCode"
          ? { backupCode: value.data.code }
          : { code: value.data.code }),
      };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const requestBody = new ArrayBuffer(encoded.byteLength);
  new Uint8Array(requestBody).set(encoded);
  const response = await context.var.session.relayAttendance({
    body: requestBody,
    contentType: "application/json",
    method: "POST",
    path: endpoint,
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null) {
    return Response.json(data, { status: response.status });
  }
  const record = data as Record<string, unknown>;
  const safeData = { ...record };
  delete safeData.access;
  delete safeData.refresh;
  delete safeData.accessToken;
  delete safeData.refreshToken;
  const authenticated =
    typeof record.access === "string" ||
    typeof record.accessToken === "string";
  return Response.json({ ...safeData, authenticated }, { status: response.status });
});

app.all("/api/attendance/*", async (context) => {
  const url = new URL(context.req.url);
  const upstreamPath = `${url.pathname.slice("/api/attendance".length)}${url.search}`;
  const method = context.req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD"
    ? null
    : await context.req.arrayBuffer();
  return context.var.session.relayAttendance({
    body,
    contentType: context.req.header("content-type") ?? null,
    method,
    path: upstreamPath,
  });
});

app.get("/api/push/key", (context) => {
  if (!context.env.VAPID_PRIVATE_KEY) {
    return context.json({ error: "Web Push is not configured." }, 503);
  }
  return context.json({
    publicKey: publicVapidKeyFromPrivateJwk(context.env.VAPID_PRIVATE_KEY),
  });
});

app.get("/api/push/status", async (context) =>
  context.json({ subscribed: await context.var.session.hasPushSubscription() }),
);

app.post("/api/push/subscription", async (context) => {
  const value = pushSubscriptionSchema.safeParse(await readJson(context.req.raw));
  if (!value.success) return context.json({ error: "Invalid push subscription." }, 400);
  await context.var.session.savePushSubscription(value.data);
  return context.body(null, 204);
});

app.delete("/api/push/subscription", async (context) => {
  await context.var.session.removePushSubscription();
  return context.body(null, 204);
});

app.post("/api/push/reminders", async (context) => {
  const value = pushReminderSchema.safeParse(await readJson(context.req.raw));
  if (!value.success) return context.json({ error: "Invalid reminder." }, 400);
  await context.var.session.scheduleReminder(value.data);
  return context.body(null, 204);
});

app.delete("/api/push/reminders/:id", async (context) => {
  const id = reminderIdSchema.safeParse(context.req.param("id"));
  if (!id.success) return context.json({ error: "Invalid reminder ID." }, 400);
  await context.var.session.cancelReminder(id.data);
  return context.body(null, 204);
});

app.delete("/api/push/reminders", async (context) => {
  await context.var.session.clearReminders();
  return context.body(null, 204);
});

app.notFound((context) => context.json({ error: "Not found." }, 404));

app.onError((error, context) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : "Unknown error",
    message: "Worker request failed",
    path: context.req.path,
  }));
  return context.json({ error: "The request could not be completed." }, 500);
});

export const handleRequest = async (
  request: Request,
  env: CloudflareBindings,
  executionContext: ExecutionContext,
): Promise<Response> => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    const response = await app.fetch(request, env, executionContext);
    return applyApiHeaders(response);
  }
  return applyWebHeaders(await env.ASSETS.fetch(request));
};
