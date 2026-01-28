import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { TimelineEvent } from "@/types";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

const DASHBOARD_TASK_NAME = "dashboard-background-sync";
const scheduledNotifications = new Map<string, string[]>();

const ensureNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
};

export const scheduleEventNotification = async (
  event: TimelineEvent,
  minutesBefore: number,
): Promise<string | null> => {
  const notificationTime = event.timesort * 1000 - minutesBefore * 60 * 1000;
  const now = Date.now();

  if (notificationTime <= now) return null;

  await ensureNotificationChannel();

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${event.activityname}`,
      body: `Due in ${minutesBefore} minutes - ${event.course.shortname}`,
      data: { eventId: event.id, url: event.url },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(notificationTime),
    },
  });

  return notificationId;
};

export const scheduleAllEventNotifications = async (
  events: TimelineEvent[],
  reminderMinutes: number[],
): Promise<void> => {
  const settings = useSettingsStore.getState();
  if (!settings.notificationsEnabled) return;

  // Request permissions before scheduling
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log("Notification permissions not granted");
    return;
  }

  await cancelAllScheduledNotifications();

  for (const event of events) {
    const ids: string[] = [];
    for (const mins of reminderMinutes) {
      const id = await scheduleEventNotification(event, mins);
      if (id) ids.push(id);
    }
    if (ids.length > 0) {
      scheduledNotifications.set(String(event.id), ids);
    }
  }
};

export const cancelAllScheduledNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  scheduledNotifications.clear();
};

const notifyDevSyncResult = async (params: {
  success: boolean;
  upcomingCount: number;
  overdueCount: number;
  errorMessage?: string;
}): Promise<void> => {
  if (!__DEV__) return;

  const { devDashboardSyncEnabled } = useSettingsStore.getState();
  if (!devDashboardSyncEnabled) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await ensureNotificationChannel();

  const title = params.success ? "Dashboard Sync" : "Dashboard Sync Failed";
  const body = params.success
    ? `Synced ${params.upcomingCount} upcoming, ${params.overdueCount} overdue`
    : `Sync failed${params.errorMessage ? `: ${params.errorMessage}` : ""}`;

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });
};

const runDashboardSync =
  async (): Promise<BackgroundTask.BackgroundTaskResult> => {
    const dashboardStore = useDashboardStore.getState();

    try {
      await dashboardStore.fetchDashboard();
      const { upcomingEvents, overdueEvents } = useDashboardStore.getState();
      const { reminders, notificationsEnabled } = useSettingsStore.getState();

      if (notificationsEnabled && upcomingEvents.length > 0) {
        await scheduleAllEventNotifications(upcomingEvents, reminders);
      }

      await notifyDevSyncResult({
        success: true,
        upcomingCount: upcomingEvents.length,
        overdueCount: overdueEvents.length,
      });

      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      dashboardStore.addLog(`Background sync failed: ${message}`, "error");
      await notifyDevSyncResult({
        success: false,
        upcomingCount: 0,
        overdueCount: 0,
        errorMessage: message,
      });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  };

TaskManager.defineTask(DASHBOARD_TASK_NAME, async () => {
  try {
    return await runDashboardSync();
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const registerDashboardBackgroundTask = async (
  intervalMinutes: number,
): Promise<boolean> => {
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    return false;
  }

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(DASHBOARD_TASK_NAME);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(DASHBOARD_TASK_NAME);
  }

  await BackgroundTask.registerTaskAsync(DASHBOARD_TASK_NAME, {
    minimumInterval: Math.max(15, intervalMinutes),
  });

  return true;
};

export const unregisterDashboardBackgroundTask = async (): Promise<void> => {
  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(DASHBOARD_TASK_NAME);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(DASHBOARD_TASK_NAME);
  }
};

export const syncDashboardBackgroundTask = async (): Promise<boolean> => {
  const settings = useSettingsStore.getState();
  return registerDashboardBackgroundTask(settings.refreshIntervalMinutes);
};

export const startBackgroundRefresh = (): void => {
  void syncDashboardBackgroundTask();
};

export const stopBackgroundRefresh = (): void => {
  void unregisterDashboardBackgroundTask();
};

export const restartBackgroundRefresh = (): void => {
  void syncDashboardBackgroundTask();
};
