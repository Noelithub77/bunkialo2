import type {
  DayOfWeek,
  SlotConflict,
  TimetableSlot,
  TimetableState,
} from "@/types";
import { extractCourseName } from "@/utils/course-name";
import { inferRecurringLmsSlots } from "@/utils/timetable-inference";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAttendanceStore } from "./attendance-store";
import { useBunkStore } from "./bunk-store";
import { zustandStorage } from "./storage";

interface TimetableActions {
  generateTimetable: () => void;
  clearTimetable: () => void;
  resolveConflict: (conflictIndex: number, keep: "manual" | "auto") => void;
  clearConflicts: () => void;
}

const TIMETABLE_PERSIST_VERSION = 2;
const RECOMPUTE_MAX_RETRIES = 20;
const RECOMPUTE_RETRY_DELAY_MS = 200;

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// check if two time ranges overlap
const timesOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean => {
  return start1 < end2 && start2 < end1;
};

const recomputeWhenBaseStoresHydrated = (generateTimetable: () => void) => {
  let attempts = 0;

  const run = () => {
    const attendanceHydrated = useAttendanceStore.getState().hasHydrated;
    const bunkHydrated = useBunkStore.getState().hasHydrated;

    if ((attendanceHydrated && bunkHydrated) || attempts >= RECOMPUTE_MAX_RETRIES) {
      generateTimetable();
      return;
    }

    attempts += 1;
    setTimeout(run, RECOMPUTE_RETRY_DELAY_MS);
  };

  setTimeout(run, 0);
};

export const useTimetableStore = create<TimetableState & TimetableActions>()(
  persist(
    (set, get) => ({
      slots: [],
      conflicts: [],
      lastGeneratedAt: null,
      isLoading: false,

      generateTimetable: () => {
        set({ isLoading: true });

        const attendanceCourses = useAttendanceStore.getState().courses;
        const bunkCourses = useBunkStore.getState().courses;

        // step 1: generate auto slots from LMS attendance data
        const autoSlotMap = new Map<string, TimetableSlot>();

        for (const course of attendanceCourses) {
          const bunkCourse = bunkCourses.find(
            (c) => c.courseId === course.courseId,
          );
          const overrideLmsSlots =
            bunkCourse?.config?.overrideLmsSlots ?? false;
          if (overrideLmsSlots) continue;
          const displayName =
            bunkCourse?.config?.alias || extractCourseName(course.courseName);

          const inferredSlots = inferRecurringLmsSlots(course.records, {
            startToleranceMinutes: 20,
          });

          for (const inferred of inferredSlots) {
            const key = `${course.courseId}-${inferred.dayOfWeek}-${inferred.startTime}`;
            autoSlotMap.set(key, {
              id: generateId(),
              courseId: course.courseId,
              courseName: displayName,
              dayOfWeek: inferred.dayOfWeek,
              startTime: inferred.startTime,
              endTime: inferred.endTime,
              sessionType: inferred.sessionType,
              isManual: false,
              isCustomCourse: false,
            });
          }
        }

        // step 2: collect all manual slots from bunk store
        const manualSlots: TimetableSlot[] = [];

        for (const course of bunkCourses) {
          if (!course.manualSlots || course.manualSlots.length === 0) continue;

          const displayName =
            course.config?.alias || extractCourseName(course.courseName);

          for (const slot of course.manualSlots) {
            manualSlots.push({
              id: slot.id,
              courseId: course.courseId,
              courseName: displayName,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              sessionType: slot.sessionType,
              isManual: true,
              isCustomCourse: course.isCustomCourse,
            });
          }
        }

        // step 3: detect conflicts between manual and auto slots
        const conflicts: SlotConflict[] = [];
        const autoSlots = Array.from(autoSlotMap.values());

        for (const manualSlot of manualSlots) {
          for (const autoSlot of autoSlots) {
            // conflict: same day and overlapping time
            if (
              manualSlot.dayOfWeek === autoSlot.dayOfWeek &&
              timesOverlap(
                manualSlot.startTime,
                manualSlot.endTime,
                autoSlot.startTime,
                autoSlot.endTime,
              )
            ) {
              conflicts.push({ manualSlot, autoSlot });
            }
          }
        }

        // step 4: merge slots (manual slots take precedence for same course+day+time)
        const finalSlotMap = new Map<string, TimetableSlot>();

        // add auto slots first
        for (const slot of autoSlots) {
          const key = `${slot.dayOfWeek}-${slot.startTime}-${slot.courseId}`;
          finalSlotMap.set(key, slot);
        }

        // add manual slots (override if same key)
        for (const slot of manualSlots) {
          const key = `${slot.dayOfWeek}-${slot.startTime}-${slot.courseId}`;
          finalSlotMap.set(key, slot);
        }

        const slots = Array.from(finalSlotMap.values());
        slots.sort((a, b) => {
          if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
          return a.startTime.localeCompare(b.startTime);
        });

        set({
          slots,
          conflicts,
          lastGeneratedAt: Date.now(),
          isLoading: false,
        });
      },

      resolveConflict: (conflictIndex, keep) => {
        const { conflicts, slots } = get();
        if (conflictIndex < 0 || conflictIndex >= conflicts.length) return;

        const conflict = conflicts[conflictIndex];
        const slotToRemove =
          keep === "manual" ? conflict.autoSlot : conflict.manualSlot;

        // remove the unwanted slot
        const updatedSlots = slots.filter((s) => s.id !== slotToRemove.id);

        // remove this conflict from the list
        const updatedConflicts = conflicts.filter(
          (_, idx) => idx !== conflictIndex,
        );

        set({ slots: updatedSlots, conflicts: updatedConflicts });
      },

      clearConflicts: () => {
        set({ conflicts: [] });
      },

      clearTimetable: () => {
        set({
          slots: [],
          conflicts: [],
          lastGeneratedAt: null,
          isLoading: false,
        });
      },
    }),
    {
      name: "timetable-storage",
      version: TIMETABLE_PERSIST_VERSION,
      storage: createJSONStorage(() => zustandStorage),
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<TimetableState>;

        // reset old persisted timetable slots so they get regenerated by current inference logic
        if (version < TIMETABLE_PERSIST_VERSION) {
          return {
            ...state,
            slots: [],
            conflicts: [],
          };
        }

        return state;
      },
      partialize: (state) => ({
        slots: state.slots,
        conflicts: state.conflicts,
        lastGeneratedAt: state.lastGeneratedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const hadPersistedTimetable =
          state.slots.length > 0 ||
          state.conflicts.length > 0 ||
          state.lastGeneratedAt !== null;

        if (!hadPersistedTimetable) return;

        recomputeWhenBaseStoresHydrated(state.generateTimetable);
      },
    },
  ),
);

// get current and next class based on current time
export const getCurrentAndNextClass = (
  slots: TimetableSlot[],
  now: Date = new Date(),
) => {
  const currentDay = now.getDay() as DayOfWeek;
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // today's slots
  const todaySlots = slots.filter((s) => s.dayOfWeek === currentDay);
  todaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  let currentClass: TimetableSlot | null = null;
  let nextClass: TimetableSlot | null = null;

  for (const slot of todaySlots) {
    if (currentTime >= slot.startTime && currentTime < slot.endTime) {
      currentClass = slot;
    } else if (currentTime < slot.startTime && !nextClass) {
      nextClass = slot;
    }
  }

  // if no next class today, find first class of next days
  if (!nextClass) {
    for (let i = 1; i <= 7; i++) {
      const checkDay = ((currentDay + i) % 7) as DayOfWeek;
      const daySlots = slots.filter((s) => s.dayOfWeek === checkDay);
      if (daySlots.length > 0) {
        daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
        nextClass = daySlots[0];
        break;
      }
    }
  }

  return { currentClass, nextClass };
};

// format time for display (24h to 12h)
export const formatTimeDisplay = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// day name helper
export const getDayName = (day: DayOfWeek, short = true): string => {
  const names = short
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
  return names[day];
};

// get nearby slots for carousel (all current day's classes + next day's classes if needed)
export const getNearbySlots = (
  slots: TimetableSlot[],
  now: Date = new Date(),
): TimetableSlot[] => {
  if (slots.length === 0) return [];

  const currentDay = now.getDay() as DayOfWeek;
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // get today's slots sorted by time
  const todaySlots = slots.filter((s) => s.dayOfWeek === currentDay);
  todaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // check if there are any classes today that haven't ended yet
  const hasRemainingToday = todaySlots.some(
    (slot) => slot.endTime > currentTime,
  );

  let result: TimetableSlot[] = [];

  if (hasRemainingToday) {
    // show all today's classes
    result = todaySlots;
  } else {
    // no more classes today, show next day's classes
    for (let i = 1; i <= 7; i++) {
      const nextDay = ((currentDay + i) % 7) as DayOfWeek;
      const nextDaySlots = slots.filter((s) => s.dayOfWeek === nextDay);
      if (nextDaySlots.length > 0) {
        nextDaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
        result = nextDaySlots;
        break;
      }
    }
  }

  return result;
};
