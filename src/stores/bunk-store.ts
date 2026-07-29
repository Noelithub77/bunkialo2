import type {
  BunkRecord,
  BunkState,
  CourseBunkData,
  CourseConfig,
  CustomCourseInput,
  HiddenCourseReason,
  ManualSlot,
  ManualSlotInput,
} from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAttendanceStore } from "./attendance-store";
import {
  buildResetBunkCourses,
  buildSyncedBunkState,
  generateBunkId,
} from "./bunk-store-helpers";
import { zustandStorage } from "./storage";

export {
  filterPastBunks,
  getDisplayName,
  selectAllDutyLeaves,
  selectCourseStats,
} from "./bunk-store-helpers";

interface BunkStoreState extends BunkState {
  hasHydrated: boolean;
}

interface BunkActions {
  syncFromLms: () => void;
  resetToLms: () => void;
  clearBunks: () => void;
  updateCourseConfig: (courseId: string, config: CourseConfig) => void;
  addBunk: (courseId: string, bunk: Omit<BunkRecord, "id" | "source">) => void;
  updateBunkNote: (courseId: string, bunkId: string, note: string) => void;
  markAsDutyLeave: (courseId: string, bunkId: string, note: string) => void;
  removeDutyLeave: (courseId: string, bunkId: string) => void;
  markAsPresent: (courseId: string, bunkId: string, note: string) => void;
  removePresenceCorrection: (courseId: string, bunkId: string) => void;
  removeBunk: (courseId: string, bunkId: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  addCustomCourse: (input: CustomCourseInput) => string;
  hideCourse: (
    courseId: string,
    courseName: string,
    reason: HiddenCourseReason,
    semesterKey?: string,
  ) => void;
  restoreCourse: (
    courseId: string,
    options?: { keepVisibleForSemesterKey?: string },
  ) => void;
  deleteCourse: (courseId: string) => void;
  deleteCustomCourse: (courseId: string) => void;
  addManualSlot: (courseId: string, slot: ManualSlotInput) => string | null;
  setManualSlots: (courseId: string, slots: ManualSlotInput[]) => void;
  updateManualSlot: (
    courseId: string,
    slotId: string,
    slot: ManualSlotInput,
  ) => void;
  removeManualSlot: (courseId: string, slotId: string) => void;
}

type CourseUpdate = (course: CourseBunkData) => CourseBunkData;

const updateCourse = (
  courses: CourseBunkData[],
  courseId: string,
  update: CourseUpdate,
): CourseBunkData[] =>
  courses.map((course) =>
    course.courseId === courseId ? update(course) : course,
  );

const updateBunk = (
  courses: CourseBunkData[],
  courseId: string,
  bunkId: string,
  update: (bunk: BunkRecord) => BunkRecord,
): CourseBunkData[] =>
  updateCourse(courses, courseId, (course) => ({
    ...course,
    bunks: course.bunks.map((bunk) =>
      bunk.id === bunkId ? update(bunk) : bunk,
    ),
  }));

export const useBunkStore = create<BunkStoreState & BunkActions>()(
  persist(
    (set, get) => ({
      courses: [],
      hiddenCourses: {},
      autoDropOptOutBySemester: {},
      lastSyncTime: null,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      syncFromLms: () => {
        const state = get();
        set(
          buildSyncedBunkState(useAttendanceStore.getState().courses, {
            courses: state.courses,
            hiddenCourses: state.hiddenCourses,
            autoDropOptOutBySemester: state.autoDropOptOutBySemester,
          }),
        );
      },
      resetToLms: () =>
        set((state) => ({
          courses: buildResetBunkCourses(
            useAttendanceStore.getState().courses,
            state.courses,
          ),
          hiddenCourses: {},
          autoDropOptOutBySemester: {},
          lastSyncTime: Date.now(),
        })),
      clearBunks: () =>
        set({
          courses: [],
          hiddenCourses: {},
          autoDropOptOutBySemester: {},
          lastSyncTime: null,
          isLoading: false,
          error: null,
        }),
      updateCourseConfig: (courseId, config) =>
        set((state) => ({
          courses: updateCourse(state.courses, courseId, (course) => ({
            ...course,
            config,
            isConfigured: true,
          })),
        })),
      addBunk: (courseId, bunk) =>
        set((state) => ({
          courses: updateCourse(state.courses, courseId, (course) => ({
            ...course,
            bunks: [
              ...course.bunks,
              { ...bunk, id: generateBunkId(), source: "user" },
            ],
          })),
        })),
      updateBunkNote: (courseId, bunkId, note) =>
        set((state) => ({
          courses: updateBunk(state.courses, courseId, bunkId, (bunk) => ({
            ...bunk,
            note,
          })),
        })),
      markAsDutyLeave: (courseId, bunkId, note) =>
        set((state) => ({
          courses: updateBunk(state.courses, courseId, bunkId, (bunk) => ({
            ...bunk,
            isDutyLeave: true,
            dutyLeaveNote: note,
          })),
        })),
      removeDutyLeave: (courseId, bunkId) =>
        set((state) => ({
          courses: updateBunk(state.courses, courseId, bunkId, (bunk) => ({
            ...bunk,
            isDutyLeave: false,
            dutyLeaveNote: "",
          })),
        })),
      markAsPresent: (courseId, bunkId, note) =>
        set((state) => ({
          courses: updateBunk(state.courses, courseId, bunkId, (bunk) => ({
            ...bunk,
            isMarkedPresent: true,
            presenceNote: note,
          })),
        })),
      removePresenceCorrection: (courseId, bunkId) =>
        set((state) => ({
          courses: updateBunk(state.courses, courseId, bunkId, (bunk) => ({
            ...bunk,
            isMarkedPresent: false,
            presenceNote: "",
          })),
        })),
      removeBunk: (courseId, bunkId) =>
        set((state) => ({
          courses: updateCourse(state.courses, courseId, (course) => ({
            ...course,
            bunks: course.bunks.filter((bunk) => bunk.id !== bunkId),
          })),
        })),
      addCustomCourse: (input) => {
        const courseId = `custom-${generateBunkId()}`;
        const manualSlots: ManualSlot[] = input.slots.map((slot) => ({
          ...slot,
          id: generateBunkId(),
        }));
        set((state) => ({
          courses: [
            ...state.courses,
            {
              courseId,
              courseName: input.courseName,
              config: {
                credits: input.credits,
                alias: input.alias || input.courseName,
                courseCode: "",
                color: input.color,
                overrideLmsSlots: true,
              },
              bunks: [],
              isConfigured: true,
              isCustomCourse: true,
              manualSlots,
            },
          ],
        }));
        return courseId;
      },
      hideCourse: (courseId, courseName, reason, semesterKey) =>
        set((state) => ({
          hiddenCourses: {
            ...state.hiddenCourses,
            [courseId]: {
              courseId,
              courseName,
              reason,
              hiddenAt: Date.now(),
              semesterKey: semesterKey ?? null,
            },
          },
        })),
      restoreCourse: (courseId, options) =>
        set((state) => {
          const hiddenCourses = { ...state.hiddenCourses };
          const autoDropOptOutBySemester = {
            ...state.autoDropOptOutBySemester,
          };
          delete hiddenCourses[courseId];
          if (options?.keepVisibleForSemesterKey) {
            autoDropOptOutBySemester[courseId] =
              options.keepVisibleForSemesterKey;
          } else {
            delete autoDropOptOutBySemester[courseId];
          }
          return { hiddenCourses, autoDropOptOutBySemester };
        }),
      deleteCourse: (courseId) =>
        set((state) => {
          const course = state.courses.find(
            (item) => item.courseId === courseId,
          );
          if (!course) return state;
          const hiddenCourses = { ...state.hiddenCourses };
          const autoDropOptOutBySemester = {
            ...state.autoDropOptOutBySemester,
          };
          delete autoDropOptOutBySemester[courseId];
          if (course.isCustomCourse) {
            delete hiddenCourses[courseId];
            return {
              courses: state.courses.filter(
                (item) => item.courseId !== courseId,
              ),
              hiddenCourses,
              autoDropOptOutBySemester,
            };
          }
          hiddenCourses[courseId] = {
            courseId,
            courseName: course.courseName,
            reason: "manual",
            hiddenAt: Date.now(),
            semesterKey: null,
          };
          return { hiddenCourses, autoDropOptOutBySemester };
        }),
      deleteCustomCourse: (courseId) => get().deleteCourse(courseId),
      addManualSlot: (courseId, slot) => {
        if (!get().courses.some((course) => course.courseId === courseId)) {
          return null;
        }
        const id = generateBunkId();
        set((state) => ({
          courses: updateCourse(state.courses, courseId, (course) => ({
            ...course,
            manualSlots: [...course.manualSlots, { ...slot, id }],
          })),
        }));
        return id;
      },
      setManualSlots: (courseId, slots) =>
        set((state) => ({
          courses: updateCourse(state.courses, courseId, (course) => ({
            ...course,
            manualSlots: slots.map((slot) => ({
              ...slot,
              id: generateBunkId(),
            })),
          })),
        })),
      updateManualSlot: (courseId, slotId, slot) =>
        set((state) => ({
          courses: updateCourse(state.courses, courseId, (course) => ({
            ...course,
            manualSlots: course.manualSlots.map((saved) =>
              saved.id === slotId ? { ...saved, ...slot } : saved,
            ),
          })),
        })),
      removeManualSlot: (courseId, slotId) =>
        set((state) => ({
          courses: updateCourse(state.courses, courseId, (course) => ({
            ...course,
            manualSlots: course.manualSlots.filter(
              (slot) => slot.id !== slotId,
            ),
          })),
        })),
    }),
    {
      name: "bunk-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        courses: state.courses,
        hiddenCourses: state.hiddenCourses,
        autoDropOptOutBySemester: state.autoDropOptOutBySemester,
        lastSyncTime: state.lastSyncTime,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
