import type { DashboardLog } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WifixLogStore {
  logs: DashboardLog[];
  hasHydrated: boolean;
  addLog: (message: string, type: DashboardLog["type"]) => void;
  clearLogs: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const generateLogId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useWifixLogStore = create<WifixLogStore>()(
  persist(
    (set) => ({
      logs: [],
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      addLog: (message, type) =>
        set((state) => {
          const newLog: DashboardLog = {
            id: generateLogId(),
            timestamp: Date.now(),
            message,
            type,
          };
          const logs = [newLog, ...state.logs].slice(0, 100);
          return { logs };
        }),

      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: "wifix-log-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        logs: state.logs,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// Export the store instance for non-React usage
export const wifixLogStore = useWifixLogStore;
