import { fetchGoogleCalendarEvents } from "@/services/academic-calendar-feed";
import type { AcademicEvent } from "@/types";
import { isVisibleAcademicEvent } from "@/utils/academic-event-visibility";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

type CalendarFetchResult =
  | { ok: true; count: number }
  | { error: string; ok: false };

interface AcademicCalendarFeedState {
  googleEvents: AcademicEvent[];
  lastFetchedAt: number | null;
  isFetching: boolean;
  error: string | null;
  hasHydrated: boolean;
  fetchGoogleEvents: () => Promise<CalendarFetchResult>;
  setHasHydrated: (hasHydrated: boolean) => void;
}

let fetchedThisLaunch = false;
let inFlightFetch: Promise<CalendarFetchResult> | null = null;

export const useAcademicCalendarFeedStore = create<AcademicCalendarFeedState>()(
  persist(
    (set, get) => ({
      googleEvents: [] as AcademicEvent[],
      lastFetchedAt: null as number | null,
      isFetching: false,
      error: null as string | null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      fetchGoogleEvents: (): Promise<CalendarFetchResult> => {
        if (fetchedThisLaunch) {
          return Promise.resolve({
            count: get().googleEvents.length,
            ok: true,
          });
        }
        if (inFlightFetch) return inFlightFetch;

        fetchedThisLaunch = true;
        const fetchPromise = (async (): Promise<CalendarFetchResult> => {
          set({ error: null, isFetching: true });
          try {
            const googleEvents = await fetchGoogleCalendarEvents();
            set({
              googleEvents,
              lastFetchedAt: Date.now(),
            });
            return { count: googleEvents.length, ok: true };
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Could not refresh Google Calendar events.";
            set({ error: message });
            return { error: message, ok: false };
          } finally {
            set({ isFetching: false });
          }
        })();

        inFlightFetch = fetchPromise.finally(() => {
          inFlightFetch = null;
        });
        return inFlightFetch;
      },
    }),
    {
      name: "academic-calendar-feed-storage-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        googleEvents: state.googleEvents.filter(isVisibleAcademicEvent),
        lastFetchedAt: state.lastFetchedAt,
      }),
      merge: (persisted, current) => {
        const saved = persisted as
          | Partial<
              Pick<AcademicCalendarFeedState, "googleEvents" | "lastFetchedAt">
            >
          | undefined;
        return {
          ...current,
          lastFetchedAt: saved?.lastFetchedAt ?? null,
          googleEvents: Array.isArray(saved?.googleEvents)
            ? saved.googleEvents.filter(isVisibleAcademicEvent)
            : [],
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error)
          console.warn("Google Calendar cache hydration failed", error);
        state?.setHasHydrated(true);
        useAcademicCalendarFeedStore.setState({ hasHydrated: true });
      },
    },
  ),
);
