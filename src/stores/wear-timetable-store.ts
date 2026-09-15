import type { WearTimetableSource } from "../../shared/wear-timetable";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface WearTimetableState {
  source: WearTimetableSource;
  lastSyncedAt: number | null;
  hasHydrated: boolean;
  setSource: (source: WearTimetableSource) => void;
  setLastSyncedAt: (timestamp: number) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useWearTimetableStore = create<WearTimetableState>()(
  persist(
    (set) => ({
      source: "template",
      lastSyncedAt: null,
      hasHydrated: false,
      setSource: (source) => set({ source }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "wear-timetable-storage-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        source: state.source,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
