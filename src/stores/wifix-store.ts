import { DEFAULT_MANUAL_PORTAL_URL } from "@/constants/wifix";
import type { WifixPortalSource, WifixSettings } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WifixStore extends WifixSettings {
  setAutoReconnectEnabled: (enabled: boolean) => void;
  setBackgroundIntervalMinutes: (minutes: number) => void;
  setPortalBaseUrl: (url: string | null) => void;
  setManualPortalUrl: (url: string | null) => void;
  setPortalSource: (source: WifixPortalSource) => void;
}

const DEFAULT_SETTINGS: WifixSettings = {
  autoReconnectEnabled: true,
  backgroundIntervalMinutes: 60,
  portalBaseUrl: null,
  manualPortalUrl: DEFAULT_MANUAL_PORTAL_URL,
  portalSource: "auto",
};

export const useWifixStore = create<WifixStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setAutoReconnectEnabled: (enabled) =>
        set({ autoReconnectEnabled: enabled }),
      setBackgroundIntervalMinutes: (minutes) =>
        set({ backgroundIntervalMinutes: minutes }),
      setPortalBaseUrl: (url) => set({ portalBaseUrl: url }),
      setManualPortalUrl: (url) => set({ manualPortalUrl: url }),
      setPortalSource: (source) => set({ portalSource: source }),
    }),
    {
      name: "wifix-settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
