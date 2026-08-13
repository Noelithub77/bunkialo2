import { useAttendanceStore } from "@/stores/attendance-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { syncPortalNotifications } from "@/services/attendance/portal-notification-sync";
import { checkAttendanceSession } from "@/services/auth/attendance-auth";

export interface AppSyncResult {
  lms: PromiseSettledResult<unknown>;
  attendance: PromiseSettledResult<unknown>;
  notifications: PromiseSettledResult<unknown>;
}

export const syncAppData = async (options?: {
  silent?: boolean;
  source?: "foreground" | "background";
}): Promise<AppSyncResult> => {
  // Existing LMS users may not have connected the attendance portal yet.
  const hasAttendanceSession = await checkAttendanceSession();

  const [lms, attendance, notifications] = await Promise.allSettled([
    useDashboardStore.getState().fetchDashboard({
      silent: options?.silent,
      source: options?.source ?? "foreground",
    }),
    hasAttendanceSession
      ? useAttendanceStore.getState().fetchAttendance({
          background: options?.source === "background",
          silent: options?.silent,
        })
      : Promise.resolve(),
    hasAttendanceSession ? syncPortalNotifications() : Promise.resolve(),
  ]);
  return { lms, attendance, notifications };
};
