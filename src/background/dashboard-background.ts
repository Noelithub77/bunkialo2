import {
  DASHBOARD_BACKGROUND_INTERVAL_MINUTES,
  DASHBOARD_TASK_NAME,
} from "@/constants/dashboard";
import { clearDashboardNotificationState } from "@/services/dashboard-notifications";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { DashboardBackgroundTaskAvailability } from "@/types";
import {
  cancelAllNotifications,
  hasNotificationPermissions,
  sendImmediateNotification,
} from "@/utils/notifications";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { useAttendanceStore } from "@/stores/attendance-store";
import { syncPortalNotifications } from "@/services/attendance/portal-notification-sync";

const notifyDevSyncResult = async (params: {
  success: boolean;
  upcomingCount: number;
  overdueCount: number;
  errorMessage?: string;
}): Promise<void> => {
  const { backgroundSyncActivityEnabled, devDashboardSyncEnabled } =
    useSettingsStore.getState();
  const shouldSendActivityAlert =
    backgroundSyncActivityEnabled || (__DEV__ && devDashboardSyncEnabled);

  if (!shouldSendActivityAlert) {
    return;
  }

  const hasPermission = await hasNotificationPermissions();
  if (!hasPermission) {
    return;
  }

  const title = params.success
    ? "Dashboard Background Sync"
    : "Dashboard Sync Failed";
  const body = params.success
    ? __DEV__ && devDashboardSyncEnabled
      ? `Task ran in background: ${params.upcomingCount} upcoming, ${params.overdueCount} overdue`
      : `Synced ${params.upcomingCount} upcoming, ${params.overdueCount} overdue`
    : `Sync failed${params.errorMessage ? `: ${params.errorMessage}` : ""}`;

  await sendImmediateNotification({ title, body });
};

const getBackgroundTaskAvailability = (
  status: BackgroundTask.BackgroundTaskStatus,
): DashboardBackgroundTaskAvailability => {
  if (status === BackgroundTask.BackgroundTaskStatus.Available) {
    return "available";
  }

  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    return "restricted";
  }

  return "unknown";
};

const updateBackgroundActivity = (
  activity: Partial<
    ReturnType<typeof useDashboardStore.getState>["backgroundActivity"]
  >,
): void => {
  useDashboardStore.getState().setBackgroundActivity(activity);
};

const recordBackgroundFailure = async (errorMessage?: string): Promise<void> => {
  const message = errorMessage ?? "Unknown background task error";
  const dashboardStore = useDashboardStore.getState();

  dashboardStore.addLog(`Background sync failed: ${message}`, "error");
  updateBackgroundActivity({
    lastAttemptAt: Date.now(),
    lastCompletedAt: Date.now(),
    lastError: message,
    lastResult: "failed",
    lastUpcomingCount: 0,
    lastOverdueCount: 0,
  });

  await notifyDevSyncResult({
    success: false,
    upcomingCount: 0,
    overdueCount: 0,
    errorMessage: message,
  });
};

const runDashboardBackgroundSync =
  async (): Promise<BackgroundTask.BackgroundTaskResult> => {
    const dashboardStore = useDashboardStore.getState();
    updateBackgroundActivity({
      lastAttemptAt: Date.now(),
      lastError: null,
    });

    const result = await dashboardStore.fetchDashboard({
      silent: true,
      source: "background",
    });

    if (result.ok) {
      await Promise.allSettled([
        useAttendanceStore
          .getState()
          .fetchAttendance({ background: true, silent: true }),
        syncPortalNotifications(),
      ]);
      updateBackgroundActivity({
        isRegistered: true,
        lastCompletedAt: Date.now(),
        lastError: null,
        lastOverdueCount: result.overdueCount,
        lastResult: "success",
        lastUpcomingCount: result.upcomingCount,
      });

      await notifyDevSyncResult({
        success: true,
        upcomingCount: result.upcomingCount,
        overdueCount: result.overdueCount,
      });

      return BackgroundTask.BackgroundTaskResult.Success;
    }

    await recordBackgroundFailure(result.error);

    return BackgroundTask.BackgroundTaskResult.Failed;
  };

TaskManager.defineTask(DASHBOARD_TASK_NAME, async () => {
  try {
    return await runDashboardBackgroundSync();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown background task error";
    await recordBackgroundFailure(message);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const cancelAllScheduledNotifications = async (): Promise<void> => {
  await cancelAllNotifications();
  await clearDashboardNotificationState();
};

export const registerDashboardBackgroundTask = async (): Promise<boolean> => {
  const isTaskManagerAvailable = await TaskManager.isAvailableAsync();
  if (!isTaskManagerAvailable) {
    updateBackgroundActivity({
      availability: "restricted",
      isRegistered: false,
    });
    return false;
  }

  const status = await BackgroundTask.getStatusAsync();
  const availability = getBackgroundTaskAvailability(status);

  updateBackgroundActivity({ availability });

  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    updateBackgroundActivity({ isRegistered: false });
    return false;
  }

  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(DASHBOARD_TASK_NAME);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(DASHBOARD_TASK_NAME);
  }

  await BackgroundTask.registerTaskAsync(DASHBOARD_TASK_NAME, {
    minimumInterval: DASHBOARD_BACKGROUND_INTERVAL_MINUTES,
  });

  updateBackgroundActivity({
    availability,
    isRegistered: true,
  });

  return true;
};

export const unregisterDashboardBackgroundTask = async (): Promise<void> => {
  const status = await BackgroundTask.getStatusAsync();
  const isRegistered =
    await TaskManager.isTaskRegisteredAsync(DASHBOARD_TASK_NAME);
  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(DASHBOARD_TASK_NAME);
  }

  updateBackgroundActivity({
    availability: getBackgroundTaskAvailability(status),
    isRegistered: false,
  });
};

export const syncDashboardBackgroundTask = async (): Promise<boolean> => {
  return registerDashboardBackgroundTask();
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
