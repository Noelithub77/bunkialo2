import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandStorage } from "./storage";
interface State {
  pages: Record<string, { html: string; fetchedAt: number }>;
  save: (key: string, html: string) => void;
}
export const useLmsForumStore = create<State>()(
  persist(
    (set) => ({
      pages: {},
      save: (key, html) =>
        set((state) => ({
          pages: { ...state.pages, [key]: { html, fetchedAt: Date.now() } },
        })),
    }),
    {
      name: "lms-forum-pages-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ pages: state.pages }),
    },
  ),
);
