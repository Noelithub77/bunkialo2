import { useAttendanceUIStore } from "@/stores/attendance-ui-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";
import type { CourseBunkData, CourseConfig, ManualSlotInput } from "@/types";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";

export const useCourseActions = () => {
  const {
    updateCourseConfig,
    addBunk,
    addCustomCourse,
    deleteCustomCourse,
    setManualSlots,
  } = useBunkStore();

  const {
    generateTimetable,
    resolveConflict,
    resolveAllAutoConflicts,
    revertAutoConflictResolution,
    conflicts,
  } = useTimetableStore();
  const { openModal, closeModal, toggleEditMode } = useAttendanceUIStore();

  // config handlers
  const handleSaveCourse = useCallback(
    (courseId: string, config: CourseConfig, slots: ManualSlotInput[]) => {
      updateCourseConfig(courseId, config);
      setManualSlots(courseId, slots);
      generateTimetable();
      setTimeout(() => {
        const currentConflicts = useTimetableStore.getState().conflicts;
        if (currentConflicts.length > 0) {
          openModal({ type: "slot-conflict" });
        }
      }, 100);
    },
    [generateTimetable, openModal, setManualSlots, updateCourseConfig],
  );

  // add bunk handler
  const handleAddBunk = useCallback(
    (course: CourseBunkData, date: string, timeSlot: string, note: string) => {
      addBunk(course.courseId, {
        date,
        description: "Manual entry",
        timeSlot,
        note,
        isDutyLeave: false,
        dutyLeaveNote: "",
        isMarkedPresent: false,
        presenceNote: "",
      });
      closeModal();
    },
    [addBunk, closeModal],
  );

  // create course handler
  const handleCreateCourse = useCallback(
    (
      courseName: string,
      alias: string,
      credits: number,
      color: string,
      slots: ManualSlotInput[],
    ) => {
      addCustomCourse({ courseName, alias, credits, color, slots });
      generateTimetable();
      closeModal();
      // check for conflicts after generating
      setTimeout(() => {
        const currentConflicts = useTimetableStore.getState().conflicts;
        if (currentConflicts.length > 0) {
          openModal({ type: "slot-conflict" });
        }
      }, 100);
    },
    [addCustomCourse, closeModal, generateTimetable, openModal],
  );

  // delete custom course
  const handleDeleteCustomCourse = useCallback(
    (courseId: string) => {
      deleteCustomCourse(courseId);
      generateTimetable();
    },
    [deleteCustomCourse, generateTimetable],
  );

  const handleResolveConflict = useCallback(
    (
      conflictIndex: number,
      keep:
        | "manual"
        | "auto"
        | "preferred"
        | "alternative"
        | "keep-outlier"
        | "ignore-outlier",
    ) => {
      resolveConflict(conflictIndex, keep);
    },
    [resolveConflict],
  );

  const handleResolveAllPreferred = useCallback(() => {
    resolveAllAutoConflicts("preferred");
  }, [resolveAllAutoConflicts]);

  const handleRevertAutoConflict = useCallback(
    (conflictId: string) => {
      revertAutoConflictResolution(conflictId);
    },
    [revertAutoConflictResolution],
  );

  const handleOpenCreateCourse = useCallback(() => {
    openModal({ type: "create-course" });
    Haptics.selectionAsync();
  }, [openModal]);

  const handleToggleEditMode = useCallback(() => {
    toggleEditMode();
    Haptics.selectionAsync();
  }, [toggleEditMode]);

  return {
    handleSaveCourse,
    handleAddBunk,
    handleCreateCourse,
    handleDeleteCustomCourse,
    handleResolveConflict,
    handleResolveAllPreferred,
    handleRevertAutoConflict,
    handleOpenCreateCourse,
    handleToggleEditMode,
    conflicts,
  };
};
