import { fetchCourseResources as fetchCourseResourcesFromLms } from "@/services/resources-scraper";
import { fetchCourses } from "@/services/scraper";
import type { LmsCourseResourcesTree, LmsResourcesState } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

export const LMS_RESOURCES_STALE_MS = 6 * 60 * 60 * 1000;
const PREFETCH_COOLDOWN_MS = 10 * 60 * 1000;
const PREFETCH_CONCURRENCY = 2;

interface LmsResourcesStoreActions {
  fetchCourseResources: (
    courseId: string,
    options?: { force?: boolean; silent?: boolean },
  ) => Promise<void>;
  refreshCourseResources: (courseId: string) => Promise<void>;
  prefetchEnrolledCourseResources: () => Promise<void>;
  setNodeExpanded: (courseId: string, nodeId: string, expanded: boolean) => void;
  toggleNodeExpanded: (courseId: string, nodeId: string) => void;
  clearCourseResources: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

type LmsResourcesStoreState = LmsResourcesState & LmsResourcesStoreActions;

const inFlightByCourseId = new Map<string, Promise<LmsCourseResourcesTree>>();
let prefetchInFlight: Promise<void> | null = null;

const isStale = (lastSyncTime: number | null): boolean => {
  if (!lastSyncTime) return true;
  return Date.now() - lastSyncTime > LMS_RESOURCES_STALE_MS;
};

const runWithConcurrencyLimit = async <T,>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  const queue = [...items];

  const runWorker = async (): Promise<void> => {
    const item = queue.shift();
    if (!item) return;
    await worker(item);
    await runWorker();
  };

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
};

const ensureExpandedDefaults = (
  current: Record<string, boolean> | undefined,
  tree: LmsCourseResourcesTree,
): Record<string, boolean> => {
  const expanded = { ...(current ?? {}) };

  for (const section of tree.sections) {
    const sectionKey = `section:${section.id}`;
    if (expanded[sectionKey] === undefined) {
      expanded[sectionKey] = false;
    }

    for (const item of section.items) {
      if (item.moduleType !== "folder" || item.children.length === 0) continue;
      const itemKey = `item:${item.id}`;
      if (expanded[itemKey] === undefined) {
        expanded[itemKey] = false;
      }
    }
  }

  return expanded;
};

export const useLmsResourcesStore = create<LmsResourcesStoreState>()(
  persist(
    (set, get) => ({
      cacheByCourseId: {},
      expandedByCourseId: {},
      isLoadingByCourseId: {},
      errorByCourseId: {},
      lastPrefetchTime: null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      fetchCourseResources: async (courseId, options) => {
        const force = options?.force ?? false;
        const silent = options?.silent ?? false;

        const entry = get().cacheByCourseId[courseId];
        if (!force && entry && !isStale(entry.lastSyncTime)) {
          set((state) => ({
            errorByCourseId: {
              ...state.errorByCourseId,
              [courseId]: null,
            },
          }));
          return;
        }

        set((state) => ({
          isLoadingByCourseId: {
            ...state.isLoadingByCourseId,
            [courseId]: silent ? (state.isLoadingByCourseId[courseId] ?? false) : true,
          },
          errorByCourseId: {
            ...state.errorByCourseId,
            [courseId]: null,
          },
        }));

        let request = inFlightByCourseId.get(courseId);
        if (!request) {
          request = fetchCourseResourcesFromLms(courseId);
          inFlightByCourseId.set(courseId, request);
        }

        try {
          const tree = await request;

          set((state) => ({
            cacheByCourseId: {
              ...state.cacheByCourseId,
              [courseId]: {
                tree,
                lastSyncTime: Date.now(),
              },
            },
            expandedByCourseId: {
              ...state.expandedByCourseId,
              [courseId]: ensureExpandedDefaults(
                state.expandedByCourseId[courseId],
                tree,
              ),
            },
            isLoadingByCourseId: {
              ...state.isLoadingByCourseId,
              [courseId]: false,
            },
            errorByCourseId: {
              ...state.errorByCourseId,
              [courseId]: null,
            },
          }));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to fetch course resources";

          set((state) => ({
            isLoadingByCourseId: {
              ...state.isLoadingByCourseId,
              [courseId]: false,
            },
            errorByCourseId: {
              ...state.errorByCourseId,
              [courseId]: message,
            },
          }));
        } finally {
          if (inFlightByCourseId.get(courseId) === request) {
            inFlightByCourseId.delete(courseId);
          }
        }
      },

      refreshCourseResources: async (courseId) => {
        await get().fetchCourseResources(courseId, { force: true });
      },

      prefetchEnrolledCourseResources: async () => {
        if (prefetchInFlight) {
          await prefetchInFlight;
          return;
        }

        const now = Date.now();
        const lastPrefetchTime = get().lastPrefetchTime;
        if (lastPrefetchTime && now - lastPrefetchTime < PREFETCH_COOLDOWN_MS) {
          return;
        }

        prefetchInFlight = (async () => {
          try {
            const courses = await fetchCourses();
            const cache = get().cacheByCourseId;

            const staleCourseIds = courses
              .map((course) => course.id)
              .filter((courseId) => {
                const entry = cache[courseId];
                return !entry || isStale(entry.lastSyncTime);
              });

            if (staleCourseIds.length === 0) {
              set({ lastPrefetchTime: Date.now() });
              return;
            }

            await runWithConcurrencyLimit(
              staleCourseIds,
              PREFETCH_CONCURRENCY,
              async (courseId) => {
                await get().fetchCourseResources(courseId, { silent: true });
              },
            );

            set({ lastPrefetchTime: Date.now() });
          } catch {
            set({ lastPrefetchTime: Date.now() });
          } finally {
            prefetchInFlight = null;
          }
        })();

        await prefetchInFlight;
      },

      setNodeExpanded: (courseId, nodeId, expanded) => {
        set((state) => ({
          expandedByCourseId: {
            ...state.expandedByCourseId,
            [courseId]: {
              ...(state.expandedByCourseId[courseId] ?? {}),
              [nodeId]: expanded,
            },
          },
        }));
      },

      toggleNodeExpanded: (courseId, nodeId) => {
        set((state) => {
          const current = state.expandedByCourseId[courseId]?.[nodeId] ?? false;
          return {
            expandedByCourseId: {
              ...state.expandedByCourseId,
              [courseId]: {
                ...(state.expandedByCourseId[courseId] ?? {}),
                [nodeId]: !current,
              },
            },
          };
        });
      },

      clearCourseResources: () => {
        inFlightByCourseId.clear();
        prefetchInFlight = null;
        set({
          cacheByCourseId: {},
          expandedByCourseId: {},
          isLoadingByCourseId: {},
          errorByCourseId: {},
          lastPrefetchTime: null,
        });
      },
    }),
    {
      name: "lms-resources-storage",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        cacheByCourseId: state.cacheByCourseId,
        expandedByCourseId: state.expandedByCourseId,
        lastPrefetchTime: state.lastPrefetchTime,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
