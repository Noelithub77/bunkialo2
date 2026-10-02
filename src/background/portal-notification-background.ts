import { refreshCalendarNotifications } from "@/services/calendar-notification-sync";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import {
  PORTAL_BACKGROUND_INTERVAL_MINUTES,
  PORTAL_NOTIFICATION_TASK,
} from "@/constants/portal-notifications";
import { syncPortalNotifications } from "@/services/attendance/portal-notification-sync";
import { checkAttendanceSession } from "@/services/auth/attendance-auth";
import { usePortalNotificationStore } from "@/stores/portal-notification-store";
import { useSettingsStore } from "@/stores/settings-store";

TaskManager.defineTask(PORTAL_NOTIFICATION_TASK, async () => {
  try {
    await Promise.all([
      usePortalNotificationStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
    ]);
    const results = await Promise.allSettled([
      checkAttendanceSession().then((ready) => ready ? syncPortalNotifications() : undefined),
      refreshCalendarNotifications(true),
    ]);
    if (results.some((result) => result.status === "rejected")) return BackgroundTask.BackgroundTaskResult.Failed;
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn("Background notification sync failed", error instanceof Error ? error.message : "Unknown error");
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const setPortalBackgroundSync = async (
  enabled: boolean,
  _notificationsEnabled = true,
): Promise<void> => {
  if (!(await TaskManager.isAvailableAsync())) return;
  const registered = await TaskManager.isTaskRegisteredAsync(
    PORTAL_NOTIFICATION_TASK,
  );
  if (!enabled) {
    if (registered)
      await BackgroundTask.unregisterTaskAsync(PORTAL_NOTIFICATION_TASK);
    return;
  }
  if (
    registered ||
    (await BackgroundTask.getStatusAsync()) !==
      BackgroundTask.BackgroundTaskStatus.Available
  )
    return;
  await BackgroundTask.registerTaskAsync(PORTAL_NOTIFICATION_TASK, {
    minimumInterval: PORTAL_BACKGROUND_INTERVAL_MINUTES,
  });
};
