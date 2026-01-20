import { fetchDashboardEvents } from "@/services/dashboard";
import type { DashboardLog, DashboardState, TimelineEvent } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DashboardStore extends DashboardState {
  upcomingEvents: TimelineEvent[];
  overdueEvents: TimelineEvent[];
  hasHydrated: boolean;
  fetchDashboard: () => Promise<void>;
  addLog: (message: string, type: DashboardLog["type"]) => void;
  clearLogs: () => void;
  clearDashboard: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const generateLogId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      events: [],
      upcomingEvents: [],
      overdueEvents: [],
      lastSyncTime: null,
      isLoading: false,
      error: null,
      logs: [],
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      fetchDashboard: async () => {
        set({ isLoading: true, error: null });
        const addLog = get().addLog;

        try {
          addLog("Starting dashboard sync...", "info");

          const { upcoming, overdue } = await fetchDashboardEvents();

          const allEvents = [...overdue, ...upcoming];

          set({
            events: allEvents,
            upcomingEvents: upcoming,
            overdueEvents: overdue,
            lastSyncTime: Date.now(),
            isLoading: false,
          });

          addLog(
            `Synced ${upcoming.length} upcoming, ${overdue.length} overdue`,
            "success",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          set({ error: message, isLoading: false });
          addLog(`Sync failed: ${message}`, "error");
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
        }),
    }),
    {
      name: "dashboard-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        events: state.events,
        upcomingEvents: state.upcomingEvents,
        overdueEvents: state.overdueEvents,
        lastSyncTime: state.lastSyncTime,
        logs: state.logs,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
