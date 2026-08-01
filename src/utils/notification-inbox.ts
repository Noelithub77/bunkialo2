import type { NotificationPriority } from "@/types";

export const NOTIFICATION_RETENTION_DAYS = 7;
export const NOTIFICATION_RETENTION_MS =
  NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export const isNotificationRecent = (
  timestamp: string,
  now: number = Date.now(),
): boolean => {
  const createdAt = new Date(timestamp).getTime();
  return (
    Number.isFinite(createdAt) && createdAt >= now - NOTIFICATION_RETENTION_MS
  );
};

export const getNotificationPriority = (
  kind: string,
  explicitlyImportant: boolean = false,
): NotificationPriority => {
  if (explicitlyImportant) return "important";
  return /(ABSENT|URGENT|CANCEL|DISPUTE|REJECT)/i.test(kind)
    ? "important"
    : "normal";
};
