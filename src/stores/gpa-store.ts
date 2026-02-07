import type { GradeLetter, SemesterGpaEntry } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface GpaStoreState {
  courseGrades: Record<string, GradeLetter>;
  previousSemesters: SemesterGpaEntry[];
  hasHydrated: boolean;
}

interface GpaActions {
  setCourseGrade: (courseId: string, grade: GradeLetter) => void;
  ensureCourseGrades: (courseIds: string[], defaultGrade?: GradeLetter) => void;
  resetCourseGrades: (courseIds: string[], defaultGrade?: GradeLetter) => void;
  addSemester: (defaults?: { credits?: number | null }) => void;
  updateSemester: (id: string, updates: Partial<SemesterGpaEntry>) => void;
  removeSemester: (id: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const DEFAULT_GRADE: GradeLetter = "A";

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const DEFAULT_SEM_CREDITS = 23;

const createSemesterEntry = (
  index: number,
  credits: number | null,
): SemesterGpaEntry => ({
  id: generateId(),
  label: `Sem ${index}`,
  sgpa: null,
  credits: credits ?? DEFAULT_SEM_CREDITS,
});

export const useGpaStore = create<GpaStoreState & GpaActions>()(
  persist(
    (set) => ({
      courseGrades: {},
      previousSemesters: [createSemesterEntry(1, null)],
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setCourseGrade: (courseId, grade) =>
        set((state) => ({
          courseGrades: { ...state.courseGrades, [courseId]: grade },
        })),

      ensureCourseGrades: (courseIds, defaultGrade = DEFAULT_GRADE) =>
        set((state) => {
          const next = { ...state.courseGrades };
          let didChange = false;
          courseIds.forEach((courseId) => {
            if (!next[courseId]) {
              next[courseId] = defaultGrade;
              didChange = true;
            }
          });
          return didChange ? { courseGrades: next } : state;
        }),

      resetCourseGrades: (courseIds, defaultGrade = DEFAULT_GRADE) =>
        set((state) => {
          const next = { ...state.courseGrades };
          courseIds.forEach((courseId) => {
            next[courseId] = defaultGrade;
          });
          return { courseGrades: next };
        }),

      addSemester: (defaults) =>
        set((state) => {
          const nextIndex = state.previousSemesters.length + 1;
          const credits =
            defaults?.credits ?? DEFAULT_SEM_CREDITS;
          return {
            previousSemesters: [
              ...state.previousSemesters,
              createSemesterEntry(nextIndex, credits),
            ],
          };
        }),

      updateSemester: (id, updates) =>
        set((state) => ({
          previousSemesters: state.previousSemesters.map((semester) =>
            semester.id === id ? { ...semester, ...updates } : semester,
          ),
        })),

      removeSemester: (id) =>
        set((state) => {
          if (state.previousSemesters.length <= 1) return state;
          const lastSemester =
            state.previousSemesters[state.previousSemesters.length - 1];
          if (lastSemester.id !== id) return state;
          const trimmed = state.previousSemesters.slice(0, -1);
          const relabeled = trimmed.map((semester, index) => ({
            ...semester,
            label: `Sem ${index + 1}`,
          }));
          return { previousSemesters: relabeled };
        }),
    }),
    {
      name: "gpa-storage",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        courseGrades: state.courseGrades,
        previousSemesters: state.previousSemesters,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
