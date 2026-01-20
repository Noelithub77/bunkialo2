import { Colors } from "@/constants/theme";
import { findCreditsByCode } from "@/data/credits";
import type {
  BunkRecord,
  BunkState,
  CourseBunkData,
  CourseConfig,
  DutyLeaveInfo,
} from "@/types";
import { extractCourseCode, extractCourseName } from "@/utils/course-name";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAttendanceStore } from "./attendance-store";
import { zustandStorage } from "./storage";

interface BunkStoreState extends BunkState {
  hasHydrated: boolean;
}

interface BunkActions {
  syncFromLms: () => void;
  resetToLms: () => void;
  updateCourseConfig: (courseId: string, config: CourseConfig) => void;
  addBunk: (courseId: string, bunk: Omit<BunkRecord, "id" | "source">) => void;
  updateBunkNote: (courseId: string, bunkId: string, note: string) => void;
  markAsDutyLeave: (courseId: string, bunkId: string, note: string) => void;
  removeDutyLeave: (courseId: string, bunkId: string) => void;
  markAsPresent: (courseId: string, bunkId: string, note: string) => void;
  removePresenceCorrection: (courseId: string, bunkId: string) => void;
  removeBunk: (courseId: string, bunkId: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// parse date string to extract time slot
const parseTimeSlot = (dateStr: string): string | null => {
  const timeMatch = dateStr.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  return timeMatch ? timeMatch[1] : null;
};

// parse "Thu 1 Jan 2026 11AM - 12PM" -> "2026-01-01"
const parseDateString = (dateStr: string): string | null => {
  const dateMatch = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!dateMatch) return null;

  const [, day, monthStr, year] = dateMatch;
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const month = months[monthStr.toLowerCase()];
  if (!month) return null;

  return `${year}-${month}-${day.padStart(2, "0")}`;
};

const buildBunkKey = (date: string, description: string): string =>
  `${date.trim()}-${description.trim()}`;

// check if date is today or past
const isPastOrToday = (dateStr: string): boolean => {
  const parsed = parseDateString(dateStr);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return new Date(parsed) <= today;
};

// filter bunks to past dates only
export const filterPastBunks = (bunks: BunkRecord[]): BunkRecord[] => {
  return bunks.filter((b) => isPastOrToday(b.date));
};

export const useBunkStore = create<BunkState & BunkActions>()(
  persist(
    (set, get) => ({
      courses: [],
      lastSyncTime: null,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      // sync absences from attendance store (LMS data)
      syncFromLms: () => {
        const attendanceCourses = useAttendanceStore.getState().courses;
        const currentBunks = get().courses;

        const updatedCourses: CourseBunkData[] = attendanceCourses.map(
          (course) => {
            const existing = currentBunks.find(
              (c) => c.courseId === course.courseId,
            );

            // get absences from LMS
            const lmsBunks: BunkRecord[] = course.records
              .filter((r) => r.status === "Absent")
              .map((r) => ({
                id: generateId(),
                date: r.date,
                description: r.description,
                timeSlot: parseTimeSlot(r.date),
                note: "",
                source: "lms" as const,
                isDutyLeave: false,
                dutyLeaveNote: "",
                isMarkedPresent: false,
                presenceNote: "",
              }));

            if (existing) {
              // merge: keep user bunks, update LMS bunks, preserve notes/DL status
              const lmsKeys = new Set(
                lmsBunks.map((b) => buildBunkKey(b.date, b.description)),
              );
              const userBunks = existing.bunks.filter(
                (b) =>
                  b.source === "user" &&
                  !lmsKeys.has(buildBunkKey(b.date, b.description)),
              );

              const mergedLmsBunks = lmsBunks.map((newBunk) => {
                const bunkKey = buildBunkKey(newBunk.date, newBunk.description);
                // find matching existing bunk by date+description
                const oldBunk =
                  existing.bunks.find(
                    (b) =>
                      b.source === "lms" &&
                      buildBunkKey(b.date, b.description) === bunkKey,
                  ) ||
                  existing.bunks.find(
                    (b) =>
                      b.source === "user" &&
                      buildBunkKey(b.date, b.description) === bunkKey,
                  );
                if (oldBunk) {
                  return {
                    ...newBunk,
                    id: oldBunk.id,
                    note: oldBunk.note,
                    isDutyLeave: oldBunk.isDutyLeave,
                    dutyLeaveNote: oldBunk.dutyLeaveNote,
                    isMarkedPresent: oldBunk.isMarkedPresent,
                    presenceNote: oldBunk.presenceNote,
                  };
                }
                return newBunk;
              });

              // always update config with extracted name/code
              const extractedName = extractCourseName(course.courseName);
              const extractedCode = extractCourseCode(course.courseName);
              const autoCredits = findCreditsByCode(extractedCode);
              const updatedConfig: CourseConfig = existing.config
                ? {
                    ...existing.config,
                    alias: extractedName,
                    courseCode: extractedCode,
                  }
                : {
                    credits: autoCredits ?? 3,
                    alias: extractedName,
                    courseCode: extractedCode,
                    color: Colors.courseColors[0],
                  };

              return {
                courseId: course.courseId,
                courseName: course.courseName,
                config: updatedConfig,
                bunks: [...mergedLmsBunks, ...userBunks],
                isConfigured: existing.isConfigured || autoCredits !== null,
              };
            }

            // auto-assign color for new courses based on index
            const courseIndex = attendanceCourses.findIndex(
              (c) => c.courseId === course.courseId,
            );
            const autoColor =
              Colors.courseColors[courseIndex % Colors.courseColors.length];
            const extractedName = extractCourseName(course.courseName);
            const extractedCode = extractCourseCode(course.courseName);
            const autoCredits = findCreditsByCode(extractedCode);

            return {
              courseId: course.courseId,
              courseName: course.courseName,
              config: {
                credits: autoCredits ?? 3,
                alias: extractedName,
                courseCode: extractedCode,
                color: autoColor,
              },
              bunks: lmsBunks,
              isConfigured: autoCredits !== null,
            };
          },
        );

        set({ courses: updatedCourses, lastSyncTime: Date.now() });
      },

      // reset all to LMS data, wipe user modifications
      resetToLms: () => {
        const attendanceCourses = useAttendanceStore.getState().courses;

        const freshCourses: CourseBunkData[] = attendanceCourses.map(
          (course) => {
            const lmsBunks: BunkRecord[] = course.records
              .filter((r) => r.status === "Absent")
              .map((r) => ({
                id: generateId(),
                date: r.date,
                description: r.description,
                timeSlot: parseTimeSlot(r.date),
                note: "",
                source: "lms" as const,
                isDutyLeave: false,
                dutyLeaveNote: "",
                isMarkedPresent: false,
                presenceNote: "",
              }));

            // auto-assign color based on index
            const courseIndex = attendanceCourses.findIndex(
              (c) => c.courseId === course.courseId,
            );
            const autoColor =
              Colors.courseColors[courseIndex % Colors.courseColors.length];
            const extractedName = extractCourseName(course.courseName);
            const extractedCode = extractCourseCode(course.courseName);
            const autoCredits = findCreditsByCode(extractedCode);

            return {
              courseId: course.courseId,
              courseName: course.courseName,
              config: {
                credits: autoCredits ?? 3,
                alias: extractedName,
                courseCode: extractedCode,
                color: autoColor,
              },
              bunks: lmsBunks,
              isConfigured: autoCredits !== null,
            };
          },
        );

        set({ courses: freshCourses, lastSyncTime: Date.now() });
      },

      updateCourseConfig: (courseId, config) => {
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId ? { ...c, config, isConfigured: true } : c,
          ),
        }));
      },

      addBunk: (courseId, bunk) => {
        const newBunk: BunkRecord = {
          ...bunk,
          id: generateId(),
          source: "user",
        };
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId
              ? { ...c, bunks: [...c.bunks, newBunk] }
              : c,
          ),
        }));
      },

      updateBunkNote: (courseId, bunkId, note) => {
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId
              ? {
                  ...c,
                  bunks: c.bunks.map((b) =>
                    b.id === bunkId ? { ...b, note } : b,
                  ),
                }
              : c,
          ),
        }));
      },

      markAsDutyLeave: (courseId, bunkId, note) => {
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId
              ? {
                  ...c,
                  bunks: c.bunks.map((b) =>
                    b.id === bunkId
                      ? { ...b, isDutyLeave: true, dutyLeaveNote: note }
                      : b,
                  ),
                }
              : c,
          ),
        }));
      },

      removeDutyLeave: (courseId, bunkId) => {
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId
              ? {
                  ...c,
                  bunks: c.bunks.map((b) =>
                    b.id === bunkId
                      ? { ...b, isDutyLeave: false, dutyLeaveNote: "" }
                      : b,
                  ),
                }
              : c,
          ),
        }));
      },

      markAsPresent: (courseId, bunkId, note) => {
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId
              ? {
                  ...c,
                  bunks: c.bunks.map((b) =>
                    b.id === bunkId
                      ? { ...b, isMarkedPresent: true, presenceNote: note }
                      : b,
                  ),
                }
              : c,
          ),
        }));
      },

      removePresenceCorrection: (courseId, bunkId) => {
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId
              ? {
                  ...c,
                  bunks: c.bunks.map((b) =>
                    b.id === bunkId
                      ? { ...b, isMarkedPresent: false, presenceNote: "" }
                      : b,
                  ),
                }
              : c,
          ),
        }));
      },

      removeBunk: (courseId, bunkId) => {
        set((state) => ({
          courses: state.courses.map((c) =>
            c.courseId === courseId
              ? { ...c, bunks: c.bunks.filter((b) => b.id !== bunkId) }
              : c,
          ),
        }));
      },
    }),
    {
      name: "bunk-storage",
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

// selector: get all duty leaves across courses (past only)
export const selectAllDutyLeaves = (
  courses: CourseBunkData[],
): DutyLeaveInfo[] => {
  const dutyLeaves: DutyLeaveInfo[] = [];
  for (const course of courses) {
    const pastBunks = filterPastBunks(course.bunks);
    for (const bunk of pastBunks) {
      if (bunk.isDutyLeave) {
        dutyLeaves.push({
          courseId: course.courseId,
          courseName: course.config?.alias || course.courseName,
          bunkId: bunk.id,
          date: bunk.date,
          timeSlot: bunk.timeSlot,
          note: bunk.dutyLeaveNote,
        });
      }
    }
  }
  return dutyLeaves;
};

// selector: calculate bunks stats for a course (past bunks only)
export const selectCourseStats = (course: CourseBunkData) => {
  const pastBunks = filterPastBunks(course.bunks);
  const totalBunks = course.config ? 2 * course.config.credits + 1 : 0;
  const dutyLeaveCount = pastBunks.filter((b) => b.isDutyLeave).length;
  const markedPresentCount = pastBunks.filter((b) => b.isMarkedPresent).length;
  // exclude duty leaves AND marked-present from used count
  const usedBunks = pastBunks.filter(
    (b) => !b.isDutyLeave && !b.isMarkedPresent,
  ).length;
  const bunksLeft = totalBunks - usedBunks;

  return {
    totalBunks,
    dutyLeaveCount,
    markedPresentCount,
    usedBunks,
    bunksLeft,
    pastBunksCount: pastBunks.length,
  };
};

// selector: get display name (alias or original)
export const getDisplayName = (course: CourseBunkData): string => {
  return course.config?.alias || course.courseName;
};
