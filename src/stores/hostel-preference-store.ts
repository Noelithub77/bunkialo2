import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface HostelPreferenceState {
  selectedHostelId: string;
  hasHydrated: boolean;
  selectHostel: (id: string) => void;
  setHydrated: () => void;
}

// A separate, stable preference key survives data refreshes, logout, and updates.
export const useHostelPreferenceStore = create<HostelPreferenceState>()(
  persist(
    (set) => ({
      selectedHostelId: "manimala",
      hasHydrated: false,
      selectHostel: (id) => set({ selectedHostelId: id }),
      setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "hostel-preference-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ selectedHostelId }) => ({ selectedHostelId }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
