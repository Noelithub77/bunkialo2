import { useAttendanceStore } from "@/stores/attendance-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { syncPortalNotifications } from "@/services/attendance/portal-notification-sync";
import { getAttendanceCredentials } from "@/services/auth/secure-auth-storage";

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
  // Keep LMS sync working and let the setup sheet collect those details.
  const attendanceCredentials = await getAttendanceCredentials().catch(
    () => null,
  );
  const hasAttendanceAccount = attendanceCredentials !== null;

  const [lms, attendance, notifications] = await Promise.allSettled([
    useDashboardStore.getState().fetchDashboard({
      silent: options?.silent,
      source: options?.source ?? "foreground",
    }),
    hasAttendanceAccount
      ? useAttendanceStore.getState().fetchAttendance({
          background: options?.source === "background",
          silent: options?.silent,
        })
      : Promise.resolve(),
    hasAttendanceAccount ? syncPortalNotifications() : Promise.resolve(),
  ]);
  return { lms, attendance, notifications };
};
