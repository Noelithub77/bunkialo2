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
    addManualSlot,
    updateManualSlot,
    removeManualSlot,
  } = useBunkStore();

  const { generateTimetable, resolveConflict, conflicts } = useTimetableStore();
  const { openModal, closeModal, toggleEditMode } = useAttendanceUIStore();

  // config handlers
  const handleSaveConfig = useCallback(
    (courseId: string, config: CourseConfig) => {
      updateCourseConfig(courseId, config);
    },
    [updateCourseConfig],
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

  // slot editor handlers
  const handleAddSlot = useCallback(
    (courseId: string, slot: ManualSlotInput) => {
      addManualSlot(courseId, slot);
      generateTimetable();
      setTimeout(() => {
        const currentConflicts = useTimetableStore.getState().conflicts;
        if (currentConflicts.length > 0) {
          openModal({ type: "slot-conflict" });
        }
      }, 100);
    },
    [addManualSlot, generateTimetable, openModal],
  );

  const handleUpdateSlot = useCallback(
    (courseId: string, slotId: string, slot: ManualSlotInput) => {
      updateManualSlot(courseId, slotId, slot);
      generateTimetable();
    },
    [generateTimetable, updateManualSlot],
  );

  const handleRemoveSlot = useCallback(
    (courseId: string, slotId: string) => {
      removeManualSlot(courseId, slotId);
      generateTimetable();
    },
    [generateTimetable, removeManualSlot],
  );

  const handleResolveConflict = useCallback(
    (conflictIndex: number, keep: "manual" | "auto") => {
      resolveConflict(conflictIndex, keep);
    },
    [resolveConflict],
  );

  // modal openers
  const handleEditCourse = useCallback(
    (course: CourseBunkData) => {
      openModal({ type: "course-edit", course });
    },
    [openModal],
  );

  const handleOpenAddBunk = useCallback(
    (course: CourseBunkData) => {
      openModal({ type: "add-bunk", course });
    },
    [openModal],
  );

  const handleOpenSlotEditor = useCallback(
    (course: CourseBunkData) => {
      openModal({ type: "slot-editor", course });
    },
    [openModal],
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
    handleSaveConfig,
    handleAddBunk,
    handleCreateCourse,
    handleDeleteCustomCourse,
    handleAddSlot,
    handleUpdateSlot,
    handleRemoveSlot,
    handleResolveConflict,
    handleEditCourse,
    handleOpenAddBunk,
    handleOpenSlotEditor,
    handleOpenCreateCourse,
    handleToggleEditMode,
    conflicts,
  };
};
