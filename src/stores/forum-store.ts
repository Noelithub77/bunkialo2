import { fetchAllForumDiscussions } from "@/services/forum";
import type { ForumDiscussionWithCourse, ForumState } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface ForumStoreState extends ForumState {
  hasHydrated: boolean;
}

interface ForumActions {
  fetchForumDiscussions: (options?: {
    silent?: boolean;
  }) => Promise<void>;
  clearForum: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const FORUM_STALE_MS = 15 * 60 * 1000; // 15 minutes

export const useForumStore = create<ForumStoreState & ForumActions>()(
  persist(
    (set, get) => ({
      discussions: [],
      isLoading: false,
      lastSyncTime: null,
      error: null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      fetchForumDiscussions: async (options) => {
        const silent = options?.silent ?? false;

        // Skip if recently synced
        const { lastSyncTime } = get();
        if (lastSyncTime && Date.now() - lastSyncTime < FORUM_STALE_MS && !silent) {
          return;
        }

        if (!silent) {
          set({ isLoading: true, error: null });
        }

        try {
          const discussions = await fetchAllForumDiscussions();

          set({
            discussions,
            lastSyncTime: Date.now(),
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to fetch forum discussions";

          if (!silent) {
            set({ error: message, isLoading: false });
          }
        }
      },

      clearForum: () => {
        set({
          discussions: [],
          lastSyncTime: null,
          error: null,
          isLoading: false,
        });
      },
    }),
    {
      name: "forum-storage",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        discussions: state.discussions,
        lastSyncTime: state.lastSyncTime,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

/** Select discussions from the last N days. */
export const selectRecentDiscussions = (
  discussions: ForumDiscussionWithCourse[],
  days = 7,
): ForumDiscussionWithCourse[] => {
  const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  return discussions.filter((d) => d.timemodified >= cutoff);
};
