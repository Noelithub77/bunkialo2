import { useAttendanceStore } from "@/stores/attendance-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { syncPortalNotifications } from "@/services/attendance/portal-notification-sync";

export interface AppSyncResult {
  lms: PromiseSettledResult<unknown>;
  attendance: PromiseSettledResult<unknown>;
  notifications: PromiseSettledResult<unknown>;
}

export const syncAppData = async (options?: {
  silent?: boolean;
  source?: "foreground" | "background";
}): Promise<AppSyncResult> => {
  const [lms, attendance, notifications] = await Promise.allSettled([
    useDashboardStore.getState().fetchDashboard({
      silent: options?.silent,
      source: options?.source ?? "foreground",
    }),
    useAttendanceStore.getState().fetchAttendance({
      background: options?.source === "background",
      silent: options?.silent,
    }),
    syncPortalNotifications(),
  ]);
  return { lms, attendance, notifications };
};
