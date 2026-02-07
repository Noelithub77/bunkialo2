import type { DashboardSettings } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState extends DashboardSettings {
  setRefreshInterval: (minutes: number) => void;
  addReminder: (minutes: number) => void;
  removeReminder: (minutes: number) => void;
  toggleNotifications: (enabled: boolean) => void;
  setDevDashboardSyncEnabled: (enabled: boolean) => void;
}

const DEFAULT_SETTINGS: DashboardSettings = {
  refreshIntervalMinutes: 30,
  reminders: [30, 10],
  notificationsEnabled: true,
  devDashboardSyncEnabled: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setRefreshInterval: (minutes) => set({ refreshIntervalMinutes: minutes }),

      addReminder: (minutes) =>
        set((state) => {
          if (state.reminders.includes(minutes)) return state;
          const updated = [...state.reminders, minutes].sort((a, b) => b - a);
          return { reminders: updated };
        }),

      removeReminder: (minutes) =>
        set((state) => ({
          reminders: state.reminders.filter((r) => r !== minutes),
        })),

      toggleNotifications: (enabled) => set({ notificationsEnabled: enabled }),

      setDevDashboardSyncEnabled: (enabled) =>
        set({ devDashboardSyncEnabled: enabled }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
