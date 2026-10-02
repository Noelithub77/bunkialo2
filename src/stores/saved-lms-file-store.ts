import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";
import type { SavedLmsFile } from "@/types";
interface State {
  records: Record<string, SavedLmsFile>;
  save: (key: string, record: SavedLmsFile) => void;
  remove: (key: string) => void;
}
export const useSavedLmsFileStore = create<State>()(
  persist(
    (set) => ({
      records: {},
      save: (key, record) =>
        set((state) => ({ records: { ...state.records, [key]: record } })),
      remove: (key) =>
        set((state) => {
          const records = { ...state.records };
          delete records[key];
          return { records };
        }),
    }),
    {
      name: "lms-saved-files-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ records: state.records }),
    },
  ),
);
export const savedFilesReady = async (): Promise<void> => {
  if (useSavedLmsFileStore.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const remove = useSavedLmsFileStore.persist.onFinishHydration(() => {
      remove();
      resolve();
    });
    if (useSavedLmsFileStore.persist.hasHydrated()) {
      remove();
      resolve();
    }
  });
};
