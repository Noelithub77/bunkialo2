import type { DashboardBackgroundTaskAvailability } from "@/types";
import { cancelAllNotifications } from "@/utils/notifications";

export const cancelAllScheduledNotifications = cancelAllNotifications;
export const registerDashboardBackgroundTask = async (): Promise<boolean> => false;
export const unregisterDashboardBackgroundTask = async (): Promise<void> => undefined;
export const syncDashboardBackgroundTask = async (): Promise<boolean> => false;
export const startBackgroundRefresh = (): void => undefined;
export const stopBackgroundRefresh = (): void => undefined;
export const restartBackgroundRefresh = (): void => undefined;

export const getWebBackgroundTaskAvailability = (): DashboardBackgroundTaskAvailability =>
  "restricted";
