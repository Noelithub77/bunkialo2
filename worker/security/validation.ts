import { z } from "zod";

export const lmsLoginSchema = z.object({
  password: z.string().min(1).max(512),
  username: z.string().trim().min(4).max(64),
});

export const attendanceLoginSchema = z.discriminatedUnion("mode", [
  z.object({
    email: z.email().max(254),
    mode: z.literal("password"),
    password: z.string().min(1).max(512),
  }),
  z.object({
    code: z.string().trim().min(1).max(128),
    intermediate: z.string().min(1).max(4096),
    mode: z.enum(["totp", "emailOtp", "backupCode"]),
  }),
]);

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().refine((value) => value.startsWith("https://")),
  keys: z.object({
    auth: z.string().min(1).max(256),
    p256dh: z.string().min(1).max(512),
  }),
});

export const pushReminderSchema = z.object({
  body: z.string().min(1).max(500),
  date: z.number().int().positive(),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  url: z.string().startsWith("/").max(2048).optional(),
});

export const reminderIdSchema = z.string().uuid();

export const readJson = async (
  request: Request,
  maximumBytes = 32 * 1024,
): Promise<unknown> => {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maximumBytes) {
    throw new Error("Request body is too large.");
  }

  const body = await request.text();
  if (body.length > maximumBytes) {
    throw new Error("Request body is too large.");
  }
  return JSON.parse(body);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
