import { z } from "zod";

const nullableText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const numericValue = z.coerce.number().finite();

export const portalUserSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    email: z.email(),
    name: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? "Student"),
  })
  .passthrough();

export const portalLoginSchema = z
  .object({
    access: z.string().optional(),
    refresh: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    needs2fa: z.boolean().optional(),
    needsEmailOtp: z.boolean().optional(),
    intermediate: z.string().optional(),
    user: portalUserSchema.optional(),
  })
  .passthrough();

export const portalRefreshSchema = z
  .object({
    access: z.string().optional(),
    refresh: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
  })
  .passthrough();

export const portalTermSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    name: z.string(),
    isCurrent: z.boolean().optional(),
    status: z.string().optional(),
    startDate: nullableText,
    endDate: nullableText,
  })
  .passthrough()
  .transform((value) => ({
    id: value.id,
    name: value.name,
    isCurrent: value.isCurrent ?? value.status === "ACTIVE",
    startDate: value.startDate,
    endDate: value.endDate,
  }));

export const portalTermsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "object" || value === null) return value;
  if ("items" in value) return value.items;
  if ("terms" in value) return value.terms;
  return value;
}, z.array(portalTermSchema));

export const portalCourseSummarySchema = z
  .object({
    courseId: z.string(),
    code: z.string().optional(),
    name: z.string().optional(),
    courseCode: z.string().optional(),
    courseName: z.string().optional(),
    total: numericValue,
    present: numericValue,
    dlCredited: numericValue.optional().default(0),
    dlOverflow: numericValue.optional().default(0),
    percentage: numericValue,
    termId: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional()
      .default("current"),
  })
  .passthrough()
  .transform((value, context) => {
    const code = value.code ?? value.courseCode;
    const name = value.name ?? value.courseName;
    if (!code || !name) {
      context.addIssue({
        code: "custom",
        message: "Attendance course code and name are required.",
      });
      return z.NEVER;
    }
    return {
      courseId: value.courseId,
      code,
      name,
      total: value.total,
      present: value.present,
      dlCredited: value.dlCredited,
      dlOverflow: value.dlOverflow,
      percentage: value.percentage,
      termId: value.termId,
    };
  });

export const portalAttendanceSchema = z
  .object({
    byCourse: z.array(portalCourseSummarySchema).optional(),
    courses: z.array(portalCourseSummarySchema).optional(),
  })
  .passthrough()
  .transform((value) => ({ courses: value.byCourse ?? value.courses ?? [] }));

export const portalStatusSchema = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "DUTY_LEAVE",
]);

export const portalSessionSchema = z
  .object({
    sessionId: z.union([z.string(), z.number()]).transform(String),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    topic: nullableText,
    section: nullableText,
    status: portalStatusSchema,
  })
  .passthrough();

export const portalCourseSessionsSchema = z
  .object({
    course: z.object({ id: z.string() }).passthrough().optional(),
    courseId: z.string().optional(),
    sessions: z.array(portalSessionSchema),
  })
  .passthrough()
  .transform((value) => ({
    courseId: value.courseId ?? value.course?.id ?? "",
    sessions: value.sessions,
  }));

export const portalNotificationSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    title: z.string(),
    body: z.string(),
    kind: z.string().default("attendance"),
    link: nullableText,
    createdAt: z.string(),
    readAt: nullableText,
  })
  .passthrough();

export const portalNotificationsSchema = z
  .object({
    unreadCount: numericValue.default(0),
    items: z.array(portalNotificationSchema),
  })
  .passthrough();
