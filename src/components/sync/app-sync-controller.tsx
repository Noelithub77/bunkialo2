import { syncAppData } from "@/services/sync/app-sync";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

interface AppSyncControllerState {
  attendanceHydrated: boolean;
  attendanceSyncTime: number | null;
  dashboardHydrated: boolean;
  dashboardSyncTime: number | null;
  intervalMinutes: number;
  isLoggedIn: boolean;
}

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
  const latestState = useRef<AppSyncControllerState>({
    attendanceHydrated,
    attendanceSyncTime,
    dashboardHydrated,
    dashboardSyncTime,
    intervalMinutes,
    isLoggedIn,
  });
  latestState.current = {
    attendanceHydrated,
    attendanceSyncTime,
    dashboardHydrated,
    dashboardSyncTime,
    intervalMinutes,
    isLoggedIn,
  };

  const syncIfStale = useCallback(async (): Promise<void> => {
    const state = latestState.current;
    if (
      !state.isLoggedIn ||
      !state.attendanceHydrated ||
      !state.dashboardHydrated ||
      running.current
    ) {
      return;
    }
    const staleAfter = Math.max(5, state.intervalMinutes) * 60 * 1000;
    const oldestSync = Math.min(
      state.attendanceSyncTime ?? 0,
      state.dashboardSyncTime ?? 0,
    );
    if (oldestSync > 0 && Date.now() - oldestSync < staleAfter) return;

    running.current = true;
    try {
      await syncAppData({ silent: true, source: "foreground" });
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
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
