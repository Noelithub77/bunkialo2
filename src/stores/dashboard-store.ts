import type { DashboardSyncSource } from "@/services/dashboard-sync";
import { runDashboardSync } from "@/services/dashboard-sync";
import type {
  DashboardBackgroundActivity,
  DashboardLog,
  DashboardState,
  TimelineEvent,
} from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

type DashboardFetchResult =
  | {
      newUpcomingCount: number;
      ok: true;
      overdueCount: number;
      upcomingCount: number;
    }
  | {
      error: string;
      ok: false;
    };

interface DashboardStore extends DashboardState {
  upcomingEvents: TimelineEvent[];
  overdueEvents: TimelineEvent[];
  hasHydrated: boolean;
  fetchDashboard: (options?: {
    silent?: boolean;
    source?: DashboardSyncSource;
  }) => Promise<DashboardFetchResult>;
  addLog: (message: string, type: DashboardLog["type"]) => void;
  clearLogs: () => void;
  clearDashboard: () => void;
  setBackgroundActivity: (
    activity: Partial<DashboardBackgroundActivity>,
  ) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const generateLogId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_BACKGROUND_ACTIVITY: DashboardBackgroundActivity = {
  availability: "unknown",
  isRegistered: false,
  lastAttemptAt: null,
  lastCompletedAt: null,
  lastError: null,
  lastOverdueCount: null,
  lastResult: "idle",
  lastUpcomingCount: null,
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      backgroundActivity: DEFAULT_BACKGROUND_ACTIVITY,
      events: [],
      upcomingEvents: [],
      overdueEvents: [],
      lastSyncTime: null,
      isLoading: false,
      error: null,
      logs: [],
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setBackgroundActivity: (activity) =>
        set((state) => ({
          backgroundActivity: {
            ...state.backgroundActivity,
            ...activity,
          },
        })),

      fetchDashboard: async (options) => {
        const silent = options?.silent ?? false;
        const source = options?.source ?? "foreground";

        if (silent) {
          set((state) => ({ error: null, isLoading: state.isLoading }));
        } else {
          set({ isLoading: true, error: null });
        }

        const addLog = get().addLog;
        const syncLabel =
          source === "background"
            ? "background dashboard sync"
            : "dashboard sync";

        try {
          addLog(`Starting ${syncLabel}...`, "info");

          const { upcoming, overdue, newUpcomingEvents, syncedAt } =
            await runDashboardSync({ source });

          set((state) => ({
            events: [...overdue, ...upcoming],
            upcomingEvents: upcoming,
            overdueEvents: overdue,
            lastSyncTime: syncedAt,
            isLoading: silent ? state.isLoading : false,
          }));

          addLog(
            `Synced ${upcoming.length} upcoming, ${overdue.length} overdue (${source})`,
            "success",
          );

          if (source === "background" && newUpcomingEvents.length > 0) {
            addLog(
              `Found ${newUpcomingEvents.length} new upcoming task${newUpcomingEvents.length === 1 ? "" : "s"}`,
              "info",
            );
          }

          return {
            newUpcomingCount: newUpcomingEvents.length,
            ok: true,
            overdueCount: overdue.length,
            upcomingCount: upcoming.length,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";

          set((state) => ({
            error: message,
            isLoading: silent ? state.isLoading : false,
          }));

          addLog(`Sync failed: ${message}`, "error");
          return { error: message, ok: false };
        } finally {
          if (!silent) {
            set({ isLoading: false });
          }
        }
      },

      addLog: (message, type) =>
        set((state) => {
          const newLog: DashboardLog = {
            id: generateLogId(),
            timestamp: Date.now(),
            message,
            type,
          };
          const logs = [newLog, ...state.logs].slice(0, 50);
          return { logs };
        }),

      clearLogs: () => set({ logs: [] }),

      clearDashboard: () =>
        set({
          events: [],
          upcomingEvents: [],
          overdueEvents: [],
          lastSyncTime: null,
          error: null,
          isLoading: false,
          backgroundActivity: DEFAULT_BACKGROUND_ACTIVITY,
        }),
    }),
    {
      name: "dashboard-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        events: state.events,
        upcomingEvents: state.upcomingEvents,
        overdueEvents: state.overdueEvents,
        lastSyncTime: state.lastSyncTime,
        backgroundActivity: state.backgroundActivity,
        logs: state.logs,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("Dashboard store rehydration failed", error);
        }
        state?.setHasHydrated(true);
        useDashboardStore.setState({ hasHydrated: true });
      },
    },
  ),
);
