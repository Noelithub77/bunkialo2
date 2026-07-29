import type {
  DayOfWeek,
  OutlierSlotConflict,
  SlotConflict,
  SlotOccurrenceStats,
  TimeOverlapSlotConflict,
  TimetableSlot,
} from "@/types";
import { extractCourseName } from "@/utils/course-name";
import { inferRecurringLmsSlotsVerbose } from "@/utils/timetable-inference";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAttendanceStore } from "./attendance-store";
import { useBunkStore } from "./bunk-store";
import { zustandStorage } from "./storage";
import {
  autoSlotStoreKey,
  buildOutlierConflictId,
  buildPairConflictId,
  getGlobalWeekSpanCount,
  isOutlierCandidate,
  makeTimetableId,
  mergeTimetableSlots,
  rankSlotForConflict,
  recomputeWhenBaseStoresHydrated,
  slotResolutionKey,
  timesOverlap,
  timetableTimeToMinutes,
} from "./timetable-store-helpers";
import type { TimetableStoreState } from "./timetable-store-types";

export {
  formatTimeDisplay,
  getCurrentAndNextClass,
  getDayName,
  getNearbySlots,
} from "./timetable-store-helpers";

const AUTO_SLOT_START_CONFLICT_WINDOW_MINUTES = 120;

export const useTimetableStore = create<TimetableStoreState>()(
  persist(
    (set, get) => ({
      slots: [],
      conflicts: [],
      timeOverlapResolutions: {},
      outlierResolutions: {},
      lastGeneratedAt: null,
      isLoading: false,

      generateTimetable: () => {
        set({ isLoading: true });

        const attendanceCourses = useAttendanceStore.getState().courses;
        const { courses: bunkCourses, hiddenCourses } = useBunkStore.getState();
        const { timeOverlapResolutions, outlierResolutions } = get();
        const globalWeekSpanCount = getGlobalWeekSpanCount(attendanceCourses);

        const autoSlotMap = new Map<string, TimetableSlot>();
        const autoSlotStatsMap = new Map<string, SlotOccurrenceStats>();
        const outlierConflicts: OutlierSlotConflict[] = [];

        for (const course of attendanceCourses) {
          if (hiddenCourses[course.courseId]) continue;

          const bunkCourse = bunkCourses.find(
            (c) => c.courseId === course.courseId,
          );
          const overrideLmsSlots =
            bunkCourse?.config?.overrideLmsSlots ?? false;
          if (overrideLmsSlots) continue;
          const displayName =
            bunkCourse?.config?.alias || extractCourseName(course.courseName);

          const inferred = inferRecurringLmsSlotsVerbose(course.records, {
            startToleranceMinutes: 20,
            totalWeekSpanOverride: globalWeekSpanCount ?? undefined,
          });
          const candidatesByDay = new Map<
            DayOfWeek,
            typeof inferred.candidates
          >();
          const candidateBySlotKey = new Map<
            string,
            (typeof inferred.candidates)[number]
          >();
          const selectedByRuleKeys = new Set<string>();

          for (const candidate of inferred.candidates) {
            const dayCandidates =
              candidatesByDay.get(candidate.dayOfWeek) ?? [];
            dayCandidates.push(candidate);
            candidatesByDay.set(candidate.dayOfWeek, dayCandidates);
            candidateBySlotKey.set(candidate.slotKey, candidate);
            if (candidate.selectedByRule) {
              selectedByRuleKeys.add(candidate.slotKey);
            }
          }

          const chosenSlotKeys = new Set<string>();
          const addOutlierConflict = (
            alternative: (typeof inferred.candidates)[number],
          ) => {
            const outlierConflictId = buildOutlierConflictId(
              course.courseId,
              alternative.slotKey,
            );
            const resolvedOutlier = outlierResolutions[outlierConflictId];
            const outlierStats: SlotOccurrenceStats = {
              occurrenceCount: alternative.occurrenceCount,
              dayActiveWeekCount: alternative.dayActiveWeekCount,
              totalWeekSpanCount: alternative.totalWeekSpanCount,
              dayObservationCount: alternative.dayObservationCount,
              score: alternative.score,
            };

            outlierConflicts.push({
              type: "outlier-review",
              conflictId: outlierConflictId,
              slot: {
                id: makeTimetableId(),
                courseId: course.courseId,
                courseName: displayName,
                dayOfWeek: alternative.dayOfWeek,
                startTime: alternative.startTime,
                endTime: alternative.endTime,
                sessionType: alternative.sessionType,
                isManual: false,
                isCustomCourse: false,
              },
              stats: outlierStats,
              resolvedChoice: resolvedOutlier ?? "ignore",
            });

            if (resolvedOutlier === "keep") {
              chosenSlotKeys.add(alternative.slotKey);
            }
          };

          for (const slotKey of selectedByRuleKeys) {
            const candidate = candidateBySlotKey.get(slotKey);
            if (!candidate) continue;

            if (
              isOutlierCandidate(
                candidate.occurrenceCount,
                candidate.totalWeekSpanCount,
              )
            ) {
              addOutlierConflict(candidate);
              continue;
            }

            chosenSlotKeys.add(slotKey);
          }

          for (const [, dayCandidates] of candidatesByDay.entries()) {
            const selectedCandidates = dayCandidates.filter(
              (c) =>
                selectedByRuleKeys.has(c.slotKey) &&
                chosenSlotKeys.has(c.slotKey),
            );
            const alternativeCandidates = dayCandidates.filter(
              (c) => !selectedByRuleKeys.has(c.slotKey),
            );

            for (const alternative of alternativeCandidates) {
              if (
                isOutlierCandidate(
                  alternative.occurrenceCount,
                  alternative.totalWeekSpanCount,
                )
              ) {
                addOutlierConflict(alternative);
                continue;
              }

              let nearest = selectedCandidates[0];
              let minDiff = Number.POSITIVE_INFINITY;

              for (const selected of selectedCandidates) {
                const diff = Math.abs(
                  timetableTimeToMinutes(selected.startTime) -
                    timetableTimeToMinutes(alternative.startTime),
                );
                if (diff < minDiff) {
                  minDiff = diff;
                  nearest = selected;
                }
              }

              if (
                !nearest ||
                minDiff > AUTO_SLOT_START_CONFLICT_WINDOW_MINUTES
              ) {
                chosenSlotKeys.add(alternative.slotKey);
                continue;
              }

              if (
                !timesOverlap(
                  nearest.startTime,
                  nearest.endTime,
                  alternative.startTime,
                  alternative.endTime,
                )
              ) {
                chosenSlotKeys.add(alternative.slotKey);
                continue;
              }

              if (alternative.occurrenceCount > nearest.occurrenceCount) {
                chosenSlotKeys.delete(nearest.slotKey);
                chosenSlotKeys.add(alternative.slotKey);
              }
            }
          }

          for (const slotKey of chosenSlotKeys) {
            const candidate = candidateBySlotKey.get(slotKey);
            if (!candidate) continue;
            const key = autoSlotStoreKey(
              course.courseId,
              candidate.dayOfWeek,
              candidate.startTime,
            );
            autoSlotMap.set(key, {
              id: makeTimetableId(),
              courseId: course.courseId,
              courseName: displayName,
              dayOfWeek: candidate.dayOfWeek,
              startTime: candidate.startTime,
              endTime: candidate.endTime,
              sessionType: candidate.sessionType,
              isManual: false,
              isCustomCourse: false,
            });
            autoSlotStatsMap.set(key, {
              occurrenceCount: candidate.occurrenceCount,
              dayActiveWeekCount: candidate.dayActiveWeekCount,
              totalWeekSpanCount: candidate.totalWeekSpanCount,
              dayObservationCount: candidate.dayObservationCount,
              score: candidate.score,
            });
          }
        }

        const manualSlots: TimetableSlot[] = [];

        for (const course of bunkCourses) {
          if (!course.isCustomCourse && hiddenCourses[course.courseId])
            continue;
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

        const mergedSlots = mergeTimetableSlots(
          [...autoSlotMap.values()],
          manualSlots,
        );

        const getSlotStats = (
          slot: TimetableSlot,
        ): SlotOccurrenceStats | undefined => {
          if (slot.isManual) return undefined;
          return autoSlotStatsMap.get(
            autoSlotStoreKey(slot.courseId, slot.dayOfWeek, slot.startTime),
          );
        };

        const timeOverlapConflicts: TimeOverlapSlotConflict[] = [];
        const removedSlotKeys = new Set<string>();

        for (let i = 0; i < mergedSlots.length; i += 1) {
          for (let j = i + 1; j < mergedSlots.length; j += 1) {
            const slotA = mergedSlots[i];
            const slotB = mergedSlots[j];

            if (slotA.dayOfWeek !== slotB.dayOfWeek) continue;
            if (slotA.courseId === slotB.courseId) continue;
            if (
              !timesOverlap(
                slotA.startTime,
                slotA.endTime,
                slotB.startTime,
                slotB.endTime,
              )
            ) {
              continue;
            }

            const statsA = getSlotStats(slotA);
            const statsB = getSlotStats(slotB);
            const rankA = rankSlotForConflict(statsA);
            const rankB = rankSlotForConflict(statsB);

            let preferredSlot = slotA;
            let alternativeSlot = slotB;
            let preferredStats = statsA;
            let alternativeStats = statsB;

            if (rankB > rankA) {
              preferredSlot = slotB;
              alternativeSlot = slotA;
              preferredStats = statsB;
              alternativeStats = statsA;
            }

            const conflictId = buildPairConflictId(slotA, slotB);
            const preferredKey = slotResolutionKey(preferredSlot);
            const alternativeKey = slotResolutionKey(alternativeSlot);
            const resolvedSlotKey =
              timeOverlapResolutions[conflictId] ?? preferredKey;
            const resolvedChoice =
              resolvedSlotKey === alternativeKey ? "alternative" : "preferred";

            if (resolvedChoice === "preferred") {
              removedSlotKeys.add(alternativeKey);
            } else if (resolvedChoice === "alternative") {
              removedSlotKeys.add(preferredKey);
            }

            timeOverlapConflicts.push({
              type: "time-overlap",
              conflictId,
              preferredSlot,
              alternativeSlot,
              preferredStats,
              alternativeStats,
              resolvedChoice,
            });
          }
        }

        const slots = mergedSlots.filter(
          (slot) => !removedSlotKeys.has(slotResolutionKey(slot)),
        );
        const conflicts: SlotConflict[] = [
          ...timeOverlapConflicts,
          ...outlierConflicts,
        ];

        set({
          slots,
          conflicts,
          lastGeneratedAt: Date.now(),
          isLoading: false,
        });
      },

      resolveConflict: (conflictIndex, keep) => {
        const { conflicts, timeOverlapResolutions, outlierResolutions } = get();
        if (conflictIndex < 0 || conflictIndex >= conflicts.length) return;

        const conflict = conflicts[conflictIndex];

        if (conflict.type === "time-overlap") {
          const chosenSlotKey =
            keep === "alternative"
              ? slotResolutionKey(conflict.alternativeSlot)
              : slotResolutionKey(conflict.preferredSlot);
          set({
            timeOverlapResolutions: {
              ...timeOverlapResolutions,
              [conflict.conflictId]: chosenSlotKey,
            },
          });
          get().generateTimetable();
          return;
        }

        if (conflict.type === "outlier-review") {
          set({
            outlierResolutions: {
              ...outlierResolutions,
              [conflict.conflictId]:
                keep === "keep-outlier" ? "keep" : "ignore",
            },
          });
        }
        get().generateTimetable();
      },

      resolveAllPreferred: () => {
        const { conflicts, timeOverlapResolutions, outlierResolutions } = get();
        const timeConflicts = conflicts.filter(
          (c): c is TimeOverlapSlotConflict => c.type === "time-overlap",
        );
        const outlierConflicts = conflicts.filter(
          (c): c is OutlierSlotConflict => c.type === "outlier-review",
        );
        if (timeConflicts.length === 0 && outlierConflicts.length === 0) return;

        const updatedTimeResolutions = { ...timeOverlapResolutions };
        for (const conflict of timeConflicts) {
          updatedTimeResolutions[conflict.conflictId] = slotResolutionKey(
            conflict.preferredSlot,
          );
        }

        const updatedOutlierResolutions = { ...outlierResolutions };
        for (const conflict of outlierConflicts) {
          updatedOutlierResolutions[conflict.conflictId] = "ignore";
        }

        set({
          timeOverlapResolutions: updatedTimeResolutions,
          outlierResolutions: updatedOutlierResolutions,
        });
        get().generateTimetable();
      },

      revertConflictResolution: (conflictId) => {
        const { timeOverlapResolutions, outlierResolutions } = get();
        const updatedTimeResolutions = { ...timeOverlapResolutions };
        const updatedOutlierResolutions = { ...outlierResolutions };
        let hasChange = false;

        if (conflictId in updatedTimeResolutions) {
          delete updatedTimeResolutions[conflictId];
          hasChange = true;
        }
        if (conflictId in updatedOutlierResolutions) {
          delete updatedOutlierResolutions[conflictId];
          hasChange = true;
        }
        if (!hasChange) return;

        set({
          timeOverlapResolutions: updatedTimeResolutions,
          outlierResolutions: updatedOutlierResolutions,
        });
        get().generateTimetable();
      },

      clearConflicts: () => {
        set({ conflicts: [] });
      },

      clearTimetable: () => {
        set({
          slots: [],
          conflicts: [],
          timeOverlapResolutions: {},
          outlierResolutions: {},
          lastGeneratedAt: null,
          isLoading: false,
        });
      },
    }),
    {
      name: "timetable-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        slots: state.slots,
        conflicts: state.conflicts,
        timeOverlapResolutions: state.timeOverlapResolutions,
        outlierResolutions: state.outlierResolutions,
        lastGeneratedAt: state.lastGeneratedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const hadPersistedTimetable =
          state.slots.length > 0 ||
          state.conflicts.length > 0 ||
          Object.keys(state.timeOverlapResolutions ?? {}).length > 0 ||
          Object.keys(state.outlierResolutions ?? {}).length > 0 ||
          state.lastGeneratedAt !== null;

        if (!hadPersistedTimetable) return;

        recomputeWhenBaseStoresHydrated(state.generateTimetable);
      },
    },
  ),
);
