import type { DashboardSettings, ThemePreference } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState extends DashboardSettings {
  themePreference: ThemePreference;
  setRefreshInterval: (minutes: number) => void;
  addReminder: (minutes: number) => void;
  removeReminder: (minutes: number) => void;
  toggleNotifications: (enabled: boolean) => void;
  setDevDashboardSyncEnabled: (enabled: boolean) => void;
  setThemePreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const DEFAULT_SETTINGS: DashboardSettings & {
  themePreference: ThemePreference;
} = {
  refreshIntervalMinutes: 30,
  reminders: [30, 10],
  notificationsEnabled: true,
  devDashboardSyncEnabled: false,
  themePreference: "system",
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

      setThemePreference: (preference) => set({ themePreference: preference }),

      toggleTheme: () =>
        set((state) => {
          if (state.themePreference === "light") {
            return { themePreference: "dark" };
          }
          if (state.themePreference === "dark") {
            return { themePreference: "light" };
          }
          return { themePreference: "dark" };
        }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
