export const DASHBOARD_TASK_NAME = "dashboard-background-sync";
export const DASHBOARD_BACKGROUND_INTERVAL_MINUTES = 15;

export const DASHBOARD_NOTIFICATION_CHANNELS = {
  default: "default",
  reminders: "dashboard-reminders",
  updates: "dashboard-updates",
} as const;

export const LEGACY_DASHBOARD_NOTIFICATION_STORAGE_KEY =
  "dashboard-notification-state-v1";

export const DASHBOARD_NOTIFICATION_STORAGE_KEY =
  "dashboard-notification-state-v2";
