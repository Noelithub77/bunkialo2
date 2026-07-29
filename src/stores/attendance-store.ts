import { syncAttendance } from "@/services/attendance/attendance-sync";
import type { AttendanceState, CourseAttendance, CourseStats } from "@/types";
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

      fetchAttendance: async (options) => {
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
          const result = await syncAttendance(
            useAttendanceStore.getState().courses,
            (courses) => set({ courses, lastSyncTime: Date.now() }),
          );
          const courses = result.complete;
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
          if (background) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : "Failed to fetch attendance";
          set((state) => ({
            error: message,
            isLoading: silent ? state.isLoading : false,
          }));
        }
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
