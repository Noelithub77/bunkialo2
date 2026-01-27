import { create } from "zustand";
import {
  cancelAllScheduledNotifications,
  stopBackgroundRefresh,
} from "@/background/dashboard-background";
import {
  syncWifixBackgroundTask,
  unregisterWifixBackgroundTask,
} from "@/background/wifix-background";
import * as authService from "@/services/auth";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAttendanceUIStore } from "@/stores/attendance-ui-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useFacultyStore } from "@/stores/faculty-store";
import { useTimetableStore } from "@/stores/timetable-store";
import type { AuthState } from "@/types";

interface AuthActions {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  isLoggedIn: false,
  isLoading: true,
  username: null,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const success = await authService.login(username, password);
      if (success) {
        set({ isLoggedIn: true, username, isLoading: false });
        try {
          await syncWifixBackgroundTask();
        } catch (error) {
          console.error("Failed to start WiFix background task", error);
        }
        return true;
      }
      set({ error: "Invalid credentials", isLoading: false });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      stopBackgroundRefresh();
      try {
        await cancelAllScheduledNotifications();
      } catch (error) {
        console.error("Failed to cancel notifications during logout", error);
      }
      try {
        await unregisterWifixBackgroundTask();
      } catch (error) {
        console.error("Failed to stop WiFix background task", error);
      }

      useAttendanceStore.getState().clearAttendance();
      useBunkStore.getState().clearBunks();
      const dashboardState = useDashboardStore.getState();
      dashboardState.clearDashboard();
      dashboardState.clearLogs();
      useTimetableStore.getState().clearTimetable();
      useFacultyStore.getState().clearRecentSearches();
      useAttendanceUIStore.getState().resetUI();

      await authService.logout();
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      set({ isLoggedIn: false, username: null, isLoading: false, error: null });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const success = await authService.tryAutoLogin();
      if (success) {
        const credentials = await authService.getCredentials();
        set({
          isLoggedIn: true,
          username: credentials?.username ?? null,
          isLoading: false,
        });
        try {
          await syncWifixBackgroundTask();
        } catch (error) {
          console.error("Failed to start WiFix background task", error);
        }
      } else {
        set({ isLoggedIn: false, isLoading: false });
      }
    } catch {
      set({ isLoggedIn: false, isLoading: false });
    }
  },

  setError: (error) => set({ error }),
}));
