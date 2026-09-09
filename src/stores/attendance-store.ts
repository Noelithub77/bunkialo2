import { syncAttendance } from "@/services/attendance/attendance-sync";
import { useDashboardStore } from "@/stores/dashboard-store";
import type { AttendanceState, CourseAttendance, CourseStats } from "@/types";
import { getErrorMessage } from "@/utils/error-details";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface AttendanceStoreState extends AttendanceState {
  hasHydrated: boolean;
}

interface AttendanceActions {
  fetchAttendance: (options?: {
    background?: boolean;
    silent?: boolean;
  }) => Promise<void>;
  clearAttendance: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

let activeAttendanceFetch: Promise<void> | null = null;

export const useAttendanceStore = create<
  AttendanceStoreState & AttendanceActions
>()(
  persist(
    (set) => ({
      courses: [],
      isLoading: false,
      lastSyncTime: null,
      error: null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      fetchAttendance: (options) => {
        if (activeAttendanceFetch) {
          if (!options?.background && !options?.silent) {
            set({ isLoading: true, error: null });
          }
          return activeAttendanceFetch;
        }

        const fetchPromise = (async (): Promise<void> => {
          const background = options?.background ?? false;
          const silent = options?.silent ?? false;
          if (background) {
            // Background refreshes should stay invisible to the UI.
          } else if (silent) {
            set((state) => ({ error: null, isLoading: state.isLoading }));
          } else {
            set({ isLoading: true, error: null });
          }
          try {
            useDashboardStore
              .getState()
              .addLog(
                `Starting attendance sync${background ? " (background)" : ""}...`,
                "info",
              );
            const result = await syncAttendance(
              useAttendanceStore.getState().courses,
              (courses) => set({ courses, lastSyncTime: Date.now() }),
            );
            const courses = result.complete;
            for (const warning of result.warnings) {
              useDashboardStore.getState().addLog(warning, "error");
            }
            if (background) {
              set({
                courses,
                lastSyncTime: Date.now(),
              });
              useDashboardStore
                .getState()
                .addLog(`Attendance sync complete (${courses.length} courses)`, "success");
              return;
            }

            set((state) => ({
              courses,
              lastSyncTime: Date.now(),
              isLoading: silent ? state.isLoading : false,
            }));
            useDashboardStore
              .getState()
              .addLog(`Attendance sync complete (${courses.length} courses)`, "success");
          } catch (error) {
            const message = getErrorMessage(error, "Failed to fetch attendance");
            useDashboardStore
              .getState()
              .addLog(`Attendance sync failed: ${message}`, "error");
            set((state) => ({
              error: message,
              isLoading: silent ? state.isLoading : false,
            }));
          }
        })();

        const trackedFetch = fetchPromise.finally(() => {
          if (activeAttendanceFetch === trackedFetch) {
            activeAttendanceFetch = null;
          }
        });
        activeAttendanceFetch = trackedFetch;
        return trackedFetch;
      },

      clearAttendance: () => {
        set({
          courses: [],
          lastSyncTime: null,
          error: null,
          isLoading: false,
        });
      },
    }),
    {
      name: "attendance-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        courses: state.courses,
        lastSyncTime: state.lastSyncTime,
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
