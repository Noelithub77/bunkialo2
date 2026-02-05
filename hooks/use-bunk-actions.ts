import { useAttendanceUIStore } from "@/stores/attendance-ui-store";
import { useBunkStore } from "@/stores/bunk-store";
import type { AttendanceRecord, BunkRecord } from "@/types";
import { buildRecordKey, parseTimeSlot } from "@/utils/attendance-helpers";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";

export const useBunkActions = () => {
  const {
    courses: bunkCourses,
    addBunk,
    markAsDutyLeave,
    removeDutyLeave,
    markAsPresent,
    removePresenceCorrection,
    removeBunk,
    updateBunkNote,
  } = useBunkStore();

  const { openModal, closeModal } = useAttendanceUIStore();

  // find matching bunk by record
  const findMatchingBunk = useCallback(
    (courseId: string, record: AttendanceRecord): BunkRecord | null => {
      const course = bunkCourses.find((c) => c.courseId === courseId);
      if (!course) return null;
      const recordKey = buildRecordKey(record.date, record.description);
      return (
        course.bunks.find(
          (b) => buildRecordKey(b.date, b.description) === recordKey,
        ) || null
      );
    },
    [bunkCourses],
  );

  // unknown defaults to present; confirming present stores an explicit override
  const applyUnknownPresent = useCallback(
    (courseId: string, record: AttendanceRecord) => {
      const existingBunk = findMatchingBunk(courseId, record);
      if (existingBunk) {
        if (existingBunk.isMarkedPresent) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return;
        }
        if (existingBunk.isDutyLeave) {
          removeDutyLeave(courseId, existingBunk.id);
        }
        markAsPresent(courseId, existingBunk.id, "");
      } else {
        addBunk(courseId, {
          date: record.date,
          description: record.description,
          timeSlot: parseTimeSlot(record.date),
          note: "",
          isDutyLeave: false,
          dutyLeaveNote: "",
          isMarkedPresent: true,
          presenceNote: "",
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [
      addBunk,
      findMatchingBunk,
      markAsPresent,
      removeDutyLeave,
    ],
  );

  // apply unknown as absent
  const applyUnknownAbsent = useCallback(
    (courseId: string, record: AttendanceRecord) => {
      const existingBunk = findMatchingBunk(courseId, record);
      if (existingBunk) {
        if (existingBunk.isMarkedPresent) {
          removePresenceCorrection(courseId, existingBunk.id);
        }
        if (existingBunk.isDutyLeave) {
          removeDutyLeave(courseId, existingBunk.id);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      // Only add a bunk if there wasn't one already
      addBunk(courseId, {
        date: record.date,
        description: record.description,
        timeSlot: parseTimeSlot(record.date),
        note: "",
        isDutyLeave: false,
        dutyLeaveNote: "",
        isMarkedPresent: false,
        presenceNote: "",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [addBunk, findMatchingBunk, removeDutyLeave, removePresenceCorrection],
  );

  // revert unknown status
  const handleRevertUnknown = useCallback(
    (courseId: string, record: AttendanceRecord) => {
      const existingBunk = findMatchingBunk(courseId, record);
      if (!existingBunk) return;
      if (existingBunk.source === "user") {
        removeBunk(courseId, existingBunk.id);
      } else {
        if (existingBunk.isMarkedPresent) {
          removePresenceCorrection(courseId, existingBunk.id);
        }
        if (existingBunk.isDutyLeave) {
          removeDutyLeave(courseId, existingBunk.id);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [findMatchingBunk, removeBunk, removeDutyLeave, removePresenceCorrection],
  );

  // handlers for All Bunks tab
  const handleMarkPresentAbsences = useCallback(
    (courseId: string, record: AttendanceRecord) => {
      if (record.status === "Unknown") {
        applyUnknownPresent(courseId, record);
      } else {
        openModal({ type: "presence-input", courseId, record });
      }
    },
    [applyUnknownPresent, openModal],
  );

  const handleMarkDLAbsences = useCallback(
    (courseId: string, record: AttendanceRecord) => {
      if (record.status === "Unknown") {
        openModal({ type: "confirm-unknown-absent", courseId, record });
      } else {
        openModal({ type: "dl-input", courseId, record });
      }
    },
    [openModal],
  );

  const handleConfirmPresentAbsences = useCallback(
    (
      note: string,
      modal: { courseId: string; record: AttendanceRecord } | null,
    ) => {
      if (!modal) return;
      const existingBunk = findMatchingBunk(modal.courseId, modal.record);
      if (existingBunk) {
        if (existingBunk.isDutyLeave) {
          removeDutyLeave(modal.courseId, existingBunk.id);
        }
        markAsPresent(modal.courseId, existingBunk.id, note);
      } else {
        addBunk(modal.courseId, {
          date: modal.record.date,
          description: modal.record.description,
          timeSlot: parseTimeSlot(modal.record.date),
          note: "",
          isDutyLeave: false,
          dutyLeaveNote: "",
          isMarkedPresent: true,
          presenceNote: note,
        });
      }
      closeModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [addBunk, closeModal, findMatchingBunk, markAsPresent, removeDutyLeave],
  );

  const handleConfirmDLAbsences = useCallback(
    (
      note: string,
      modal: { courseId: string; record: AttendanceRecord } | null,
    ) => {
      if (!modal) return;
      const existingBunk = findMatchingBunk(modal.courseId, modal.record);
      if (existingBunk) {
        if (existingBunk.isMarkedPresent) {
          removePresenceCorrection(modal.courseId, existingBunk.id);
        }
        markAsDutyLeave(modal.courseId, existingBunk.id, note);
      } else {
        addBunk(modal.courseId, {
          date: modal.record.date,
          description: modal.record.description,
          timeSlot: parseTimeSlot(modal.record.date),
          note: "",
          isDutyLeave: true,
          dutyLeaveNote: note,
          isMarkedPresent: false,
          presenceNote: "",
        });
      }
      closeModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [
      addBunk,
      closeModal,
      findMatchingBunk,
      markAsDutyLeave,
      removePresenceCorrection,
    ],
  );

  // handlers for Courses tab
  const handleMarkDLCourses = useCallback(
    (courseId: string, bunkId: string) => {
      openModal({ type: "dl-input-bunk", courseId, bunkId });
    },
    [openModal],
  );

  const handleConfirmDLCourses = useCallback(
    (note: string, modal: { courseId: string; bunkId: string } | null) => {
      if (!modal) return;
      markAsDutyLeave(modal.courseId, modal.bunkId, note);
      closeModal();
    },
    [closeModal, markAsDutyLeave],
  );

  const handleMarkPresentCourses = useCallback(
    (courseId: string, bunkId: string) => {
      openModal({ type: "presence-input-bunk", courseId, bunkId });
    },
    [openModal],
  );

  const handleConfirmPresenceCourses = useCallback(
    (note: string, modal: { courseId: string; bunkId: string } | null) => {
      if (!modal) return;
      markAsPresent(modal.courseId, modal.bunkId, note);
      closeModal();
    },
    [closeModal, markAsPresent],
  );

  // confirm dialog handlers
  const handleConfirmRemoveDL = useCallback(
    (courseId: string, bunkId: string) => {
      removeDutyLeave(courseId, bunkId);
      closeModal();
    },
    [closeModal, removeDutyLeave],
  );

  const handleConfirmRemovePresent = useCallback(
    (courseId: string, bunkId: string) => {
      removePresenceCorrection(courseId, bunkId);
      closeModal();
    },
    [closeModal, removePresenceCorrection],
  );

  const handleConfirmUnknownAbsent = useCallback(
    (courseId: string, record: AttendanceRecord) => {
      applyUnknownAbsent(courseId, record);
      closeModal();
    },
    [applyUnknownAbsent, closeModal],
  );

  return {
    findMatchingBunk,
    applyUnknownPresent,
    applyUnknownAbsent,
    handleRevertUnknown,
    handleMarkPresentAbsences,
    handleMarkDLAbsences,
    handleConfirmPresentAbsences,
    handleConfirmDLAbsences,
    handleMarkDLCourses,
    handleConfirmDLCourses,
    handleMarkPresentCourses,
    handleConfirmPresenceCourses,
    handleConfirmRemoveDL,
    handleConfirmRemovePresent,
    handleConfirmUnknownAbsent,
    updateBunkNote,
  };
};
