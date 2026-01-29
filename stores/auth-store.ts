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
import axios from "axios";
import { InteractionManager } from "react-native";

const isNetworkError = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    if (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") {
      return true;
    }
    return !error.response;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("failed to fetch")
    );
  }
  return false;
};

interface AuthActions {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setError: (error: string | null) => void;
  setOffline: (isOffline: boolean) => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  isLoggedIn: false,
  isLoading: false,
  isCheckingAuth: true,
  isOffline: false,
  username: null,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null, isOffline: false });
    try {
      const success = await authService.login(username, password);
      if (success) {
        set({
          isLoggedIn: true,
          username,
          isLoading: false,
          isOffline: false,
        });
        try {
          await syncWifixBackgroundTask();
        } catch (error) {
          console.error("Failed to start WiFix background task", error);
        }
        return true;
      }
      set({
        error: "Invalid credentials",
        isLoading: false,
        isOffline: false,
      });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      set({ error: message, isLoading: false, isOffline: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null, isOffline: false });
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
      set({
        isLoggedIn: false,
        username: null,
        isLoading: false,
        isCheckingAuth: false,
        error: null,
        isOffline: false,
      });
    }
  },

  checkAuth: async () => {
    set({ isCheckingAuth: true, error: null, isOffline: false });
    let credentials: Awaited<ReturnType<typeof authService.getCredentials>>;

    try {
      credentials = await authService.getCredentials();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to read credentials";
      set({
        isLoggedIn: false,
        username: null,
        isCheckingAuth: false,
        error: message,
        isOffline: false,
      });
      return;
    }

    if (!credentials?.username) {
      set({
        isLoggedIn: false,
        username: null,
        isCheckingAuth: false,
        isOffline: false,
      });
      return;
    }

    // Optimistic UI: show cached data while auth refreshes in background.
    set({
      isLoggedIn: true,
      username: credentials.username,
      isCheckingAuth: false,
      isOffline: false,
    });

    // Background session validation / re-auth.
    InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const success = await authService.tryAutoLogin();
          if (!success) {
            set({
              isLoggedIn: false,
              username: null,
              isOffline: false,
            });
            return;
          }

          set({ isOffline: false });
          try {
            await syncWifixBackgroundTask();
          } catch (error) {
            console.error("Failed to start WiFix background task", error);
          }
        } catch (error) {
          if (isNetworkError(error)) {
            set({ isOffline: true });
            return;
          }

          const message =
            error instanceof Error ? error.message : "Auto-login failed";
          set({
            isLoggedIn: false,
            username: null,
            error: message,
            isOffline: false,
          });
        }
      })();
    });
  },

  setError: (error) => set({ error }),
  setOffline: (isOffline) => set({ isOffline }),
}));
