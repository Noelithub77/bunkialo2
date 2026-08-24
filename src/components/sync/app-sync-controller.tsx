import { syncAppData } from "@/services/sync/app-sync";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

export function AppSyncController() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const attendanceHydrated = useAttendanceStore((state) => state.hasHydrated);
  const attendanceSyncTime = useAttendanceStore((state) => state.lastSyncTime);
  const dashboardHydrated = useDashboardStore((state) => state.hasHydrated);
  const dashboardSyncTime = useDashboardStore((state) => state.lastSyncTime);
  const intervalMinutes = useSettingsStore(
    (state) => state.refreshIntervalMinutes,
  );
  const running = useRef(false);

  const syncIfStale = useCallback(async (): Promise<void> => {
    if (
      !isLoggedIn ||
      !attendanceHydrated ||
      !dashboardHydrated ||
      running.current
    ) {
      return;
    }
    const staleAfter = Math.max(5, intervalMinutes) * 60 * 1000;
    const oldestSync = Math.min(
      attendanceSyncTime ?? 0,
      dashboardSyncTime ?? 0,
    );
    if (oldestSync > 0 && Date.now() - oldestSync < staleAfter) return;

    running.current = true;
    try {
      await syncAppData({ silent: true, source: "foreground" });
    } finally {
      running.current = false;
    }
  }, [
    attendanceHydrated,
    attendanceSyncTime,
    dashboardHydrated,
    dashboardSyncTime,
    intervalMinutes,
    isLoggedIn,
  ]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void syncIfStale();
    const interval = setInterval(
      () => void syncIfStale(),
      Math.max(5, intervalMinutes) * 60 * 1000,
    );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncIfStale();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMinutes, isLoggedIn, syncIfStale]);

  return null;
}
