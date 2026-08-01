import * as portal from "@/services/attendance-portal";
import * as scraper from "@/services/scraper";
import { debug } from "@/utils/debug";
import type { AttendanceState, CourseAttendance, CourseStats } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface AttendanceStoreState extends AttendanceState {
  hasHydrated: boolean;
  /**
   * The portal cleared its own credentials because both the refresh token and
   * the stored password were rejected. Persisted: it must survive a restart,
   * or the user only ever sees silently stale attendance.
   */
  portalDisconnected: boolean;
}

interface AttendanceActions {
  fetchAttendance: (options?: {
    background?: boolean;
    silent?: boolean;
    force?: boolean;
  }) => Promise<void>;
  clearAttendance: () => void;
  setPortalDisconnected: (portalDisconnected: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

/**
 * Shared so the dashboard, the attendance tab and its sub-tabs collapse into a
 * single fetch when they mount together. Each portal fetch is 1 + N requests,
 * so an unshared burst multiplies straight onto the portal.
 */
let inFlightFetch: Promise<void> | null = null;

const PORTAL_DISCONNECTED_MESSAGE =
  "Attendance portal signed out. Reconnect it in Settings.";

/**
 * Cheap identity for a fetch result. Writing `courses` replaces the array and
 * bumps `lastSyncTime`, which app/(tabs)/attendance.tsx watches to run
 * syncFromLms, which rewrites bunk-store, which regenerates the timetable. Doing
 * that on every navigation re-renders the whole tree for no new data.
 *
 * ponytail: totals and record counts, not a deep compare. Ceiling: a correction
 * that swaps one session's status without moving any count is treated as
 * unchanged until the next real change. Pull to refresh forces a full reload.
 */
const courseSignature = (courses: CourseAttendance[]): string =>
  courses
    .map(
      (course) =>
        `${course.courseId}:${course.totalSessions}:${course.attended}:${course.records.length}`,
    )
    .join("|");

/**
 * Course codes the portal adapter joins against, so a portal course resolves to
 * the Moodle courseId every user customisation is already keyed by.
 *
 * Dynamic import: bunk-store imports this module, so a static import would be a
 * cycle. Same pattern as services/api.ts.
 */
const getMoodleCourseCodes = async (): Promise<
  { courseId: string; courseCode: string }[]
> => {
  try {
    const { useBunkStore } = await import("./bunk-store");
    return useBunkStore
      .getState()
      .courses.filter((course) => !course.isCustomCourse)
      .map((course) => ({
        courseId: course.courseId,
        courseCode: course.config?.courseCode ?? "",
      }))
      .filter((course) => course.courseCode.length > 0);
  } catch {
    // ponytail: no mapping just means portal courses keep their portal: ids.
    return [];
  }
};

export const useAttendanceStore = create<
  AttendanceStoreState & AttendanceActions
>()(
  persist(
    (set, get) => ({
      courses: [],
      isLoading: false,
      lastSyncTime: null,
      error: null,
      hasHydrated: false,
      portalDisconnected: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setPortalDisconnected: (portalDisconnected) =>
        set({ portalDisconnected }),

      fetchAttendance: async (options) => {
        if (inFlightFetch && !options?.force) return inFlightFetch;

        const run = async () => {
        const background = options?.background ?? false;
        const silent = options?.silent ?? false;
        if (background) {
          // Background refreshes should stay invisible to the UI.
        } else if (silent) {
          set((state) => ({ error: null, isLoading: state.isLoading }));
        } else {
          set({ isLoading: true, error: null });
        }
        const usingPortal = await portal.hasPortalCredentials();

        try {
          const courses = usingPortal
            ? await portal.fetchPortalAttendance(
                await getMoodleCourseCodes(),
                // A forced refresh is an explicit ask, so drop the
                // unchanged-course cache and reload every course.
                options?.force ? [] : get().courses,
              )
            : await scraper.fetchAllAttendance();

          if (usingPortal && get().portalDisconnected) {
            set({ portalDisconnected: false });
          }

          // ponytail: an empty scrape means the attendance module is gone or the
          // session died, not that the student dropped every course. Overwriting
          // here wipes the cache and cascades into bunk-store and timetable-store.
          // Ceiling: a student who genuinely unenrols from everything keeps stale
          // data until logout, which clears it anyway.
          if (courses.length === 0 && get().courses.length > 0) {
            set((state) => ({
              isLoading: background || silent ? state.isLoading : false,
            }));
            return;
          }

          // Nothing new: leave courses and lastSyncTime alone so the bunk sync
          // and timetable regeneration downstream stay put.
          if (courseSignature(courses) === courseSignature(get().courses)) {
            set((state) => ({
              isLoading: background || silent ? state.isLoading : false,
            }));
            return;
          }

          if (background) {
            set({
              courses,
              lastSyncTime: Date.now(),
            });
            return;
          }

          set((state) => ({
            courses,
            lastSyncTime: Date.now(),
            isLoading: silent ? state.isLoading : false,
          }));
        } catch (error) {
          // Without this a portal failure is indistinguishable from "no data".
          debug.portal("Attendance fetch failed", {
            message: error instanceof Error ? error.message : String(error),
          });

          // The portal clears its own credentials when the refresh token and
          // the stored password are both rejected. Distinguish that from an
          // ordinary network error: one needs the user, the other resolves
          // itself. Raise the flag even in the background, where errors are
          // otherwise swallowed, or the sign-out stays invisible forever.
          const selfDisconnected =
            usingPortal && !(await portal.hasPortalCredentials());
          if (selfDisconnected) {
            set({ portalDisconnected: true });
          }

          if (background) {
            return;
          }

          const message = selfDisconnected
            ? PORTAL_DISCONNECTED_MESSAGE
            : error instanceof Error
              ? error.message
              : "Failed to fetch attendance";
          set((state) => ({
            error: message,
            isLoading: silent ? state.isLoading : false,
          }));
        }
        };

        inFlightFetch = run().finally(() => {
          inFlightFetch = null;
        });
        return inFlightFetch;
      },

      clearAttendance: () => {
        set({
          courses: [],
          lastSyncTime: null,
          error: null,
          isLoading: false,
          portalDisconnected: false,
        });
      },
    }),
    {
      name: "attendance-storage",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        courses: state.courses,
        lastSyncTime: state.lastSyncTime,
        portalDisconnected: state.portalDisconnected,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// Selector for overall attendance stats
export const selectOverallStats = (
  courses: CourseAttendance[],
): CourseStats => {
  const coursesWithAttendance = courses.filter((c) => c.totalSessions > 0);
  const totalSessions = coursesWithAttendance.reduce(
    (sum, c) => sum + c.totalSessions,
    0,
  );
  const totalAttended = coursesWithAttendance.reduce(
    (sum, c) => sum + c.attended,
    0,
  );
  const overallPercentage =
    totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

  return {
    totalCourses: coursesWithAttendance.length,
    totalSessions,
    totalAttended,
    overallPercentage,
  };
};
