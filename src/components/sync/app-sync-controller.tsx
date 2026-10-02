import { setPortalBackgroundSync } from "@/background/portal-notification-background";
import { PORTAL_NOTIFICATION_POLL_MINUTES } from "@/constants/portal-notifications";
import { checkAttendanceSession } from "@/services/auth/attendance-auth";
import { syncPortalNotifications } from "@/services/attendance/portal-notification-sync";
import { usePortalNotificationStore } from "@/stores/portal-notification-store";
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
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
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

  useEffect(() => {
    void setPortalBackgroundSync(isLoggedIn, notificationsEnabled).catch((error: unknown) => console.warn("Background notification registration failed", error instanceof Error ? error.message : "Unknown error"));
    if (!isLoggedIn) return;
    const poll = () => {
      if (AppState.currentState !== "active") return;
      const lastSync = usePortalNotificationStore.getState().lastSyncAt ?? 0;
      if (Date.now() - lastSync < PORTAL_NOTIFICATION_POLL_MINUTES * 60000)
        return;
      void checkAttendanceSession().then((ready) => ready ? syncPortalNotifications() : undefined).catch((error: unknown) => console.warn("Notification refresh failed", error instanceof Error ? error.message : "Unknown error"));
    };
    poll();
    const timer = setInterval(poll, PORTAL_NOTIFICATION_POLL_MINUTES * 60000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") poll();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [isLoggedIn, notificationsEnabled]);

  return null;
}
