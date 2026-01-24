import { ConfirmModal } from "@/components/modals/confirm-modal";
import { SlotConflictModal } from "@/components/modals/slot-conflict-modal";
import { Colors, Spacing } from "@/constants/theme";
import { useBunkActions } from "@/hooks/use-bunk-actions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCourseActions } from "@/hooks/use-course-actions";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAttendanceUIStore } from "@/stores/attendance-ui-store";
import {
  getDisplayName,
  selectAllDutyLeaves,
  useBunkStore,
} from "@/stores/bunk-store";
import type { AttendanceRecord } from "@/types";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AddBunkModal } from "../add-bunk-modal";
import { CourseEditModal } from "../course-edit-modal";
import { CreateCourseModal } from "../create-course-modal";
import { DLInputModal } from "../dl-input-modal";
import { DutyLeaveModal } from "../duty-leave-modal";
import { PresenceInputModal } from "../presence-input-modal";
import { UnifiedCourseCard } from "../unified-course-card";
import { UnknownStatusModal } from "../unknown-status-modal";
import { ChangesModal } from "../changes-modal";

export const CoursesContent = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { courses, isLoading, lastSyncTime, fetchAttendance } =
    useAttendanceStore();
  const { courses: bunkCourses } = useBunkStore();
  const { activeModal, isEditMode, openModal, closeModal } =
    useAttendanceUIStore();

  const {
    handleMarkDLCourses,
    handleConfirmDLCourses,
    handleMarkPresentCourses,
    handleConfirmPresenceCourses,
    handleConfirmRemoveDL,
    handleConfirmRemovePresent,
    handleConfirmUnknownAbsent,
    handleRevertUnknown,
    applyUnknownPresent,
    updateBunkNote,
  } = useBunkActions();

  const {
    handleSaveCourse,
    handleAddBunk,
    handleCreateCourse,
    handleDeleteCustomCourse,
    handleResolveConflict,
    conflicts,
  } = useCourseActions();

  const allDutyLeaves = useMemo(
    () => selectAllDutyLeaves(bunkCourses),
    [bunkCourses],
  );

  // combine LMS courses with custom courses
  const allCourses = useMemo(() => {
    const lmsCourseData = courses.map((course) => ({
      type: "lms" as const,
      course,
      bunkData: bunkCourses.find((c) => c.courseId === course.courseId),
    }));
    const customCourseData = bunkCourses
      .filter((c) => c.isCustomCourse)
      .map((bunkData) => ({
        type: "custom" as const,
        course: null,
        bunkData,
      }));
    return [...lmsCourseData, ...customCourseData];
  }, [courses, bunkCourses]);

  const handleRefresh = useCallback(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // modal visibility checks
  const isCourseEditVisible = activeModal?.type === "course-edit";
  const isAddBunkVisible = activeModal?.type === "add-bunk";
  const isCreateCourseVisible = activeModal?.type === "create-course";
  const isChangesVisible = activeModal?.type === "changes";
  const isDLInputBunkVisible = activeModal?.type === "dl-input-bunk";
  const isPresenceInputBunkVisible =
    activeModal?.type === "presence-input-bunk";
  const isPresenceInputUnknownVisible =
    activeModal?.type === "presence-input-unknown";
  const isDutyLeaveListVisible = activeModal?.type === "duty-leave-list";
  const isUnknownStatusVisible = activeModal?.type === "unknown-status";
  const isSlotConflictVisible = activeModal?.type === "slot-conflict";
  const isConfirmVisible =
    activeModal?.type === "confirm-remove-dl" ||
    activeModal?.type === "confirm-remove-present" ||
    activeModal?.type === "confirm-unknown-absent";

  const getConfirmContent = () => {
    if (!activeModal) return { title: "", message: "", confirmText: "" };
    switch (activeModal.type) {
      case "confirm-remove-dl":
        return {
          title: "Remove Duty Leave",
          message: "This will count as a regular bunk again.",
          confirmText: "Remove",
        };
      case "confirm-remove-present":
        return {
          title: "Remove Presence Mark",
          message: "This will count as an absence again.",
          confirmText: "Remove",
        };
      case "confirm-unknown-absent":
        return {
          title: "Confirm Absent",
          message: "This will add a bunk for this session.",
          confirmText: "Confirm",
        };
      default:
        return { title: "", message: "", confirmText: "" };
    }
  };

  const confirmContent = getConfirmContent();

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Fetching attendance data...
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No courses found. Pull to refresh.
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!lastSyncTime || courses.length === 0) return null;
    return <View style={styles.footer} />;
  };

  return (
    <>
      <FlatList
        data={allCourses}
        keyExtractor={(item) =>
          item.bunkData?.courseId || item.course?.courseId || ""
        }
        renderItem={({ item }) => {
          const { course, bunkData } = item;
          const courseId = bunkData?.courseId || course?.courseId || "";
          return (
            <UnifiedCourseCard
              course={course}
              bunkData={bunkData}
              isEditMode={isEditMode}
              onEdit={() => {
                if (bunkData)
                  openModal({ type: "course-edit", course: bunkData });
              }}
              onAddBunk={() => {
                if (bunkData) openModal({ type: "add-bunk", course: bunkData });
              }}
              onMarkDL={(bunkId) => handleMarkDLCourses(courseId, bunkId)}
              onRemoveDL={(bunkId) =>
                openModal({ type: "confirm-remove-dl", courseId, bunkId })
              }
              onMarkPresent={(bunkId) =>
                handleMarkPresentCourses(courseId, bunkId)
              }
              onRemovePresent={(bunkId) =>
                openModal({ type: "confirm-remove-present", courseId, bunkId })
              }
              onUpdateNote={(bunkId, note) =>
                updateBunkNote(courseId, bunkId, note)
              }
              onShowUnknown={() => openModal({ type: "unknown-status" })}
              onConfirmUnknownPresent={(
                cId: string,
                record: AttendanceRecord,
              ) => {
                openModal({
                  type: "presence-input-unknown",
                  courseId: cId,
                  record,
                });
              }}
              onConfirmUnknownAbsent={(
                cId: string,
                record: AttendanceRecord,
              ) => {
                openModal({
                  type: "confirm-unknown-absent",
                  courseId: cId,
                  record,
                });
              }}
              onDeleteCustomCourse={() => {
                if (bunkData?.isCustomCourse) {
                  handleDeleteCustomCourse(courseId);
                }
              }}
            />
          );
        }}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.text}
          />
        }
      />

      <CourseEditModal
        visible={isCourseEditVisible}
        course={activeModal?.type === "course-edit" ? activeModal.course : null}
        onClose={closeModal}
        onSave={handleSaveCourse}
      />

      <AddBunkModal
        visible={isAddBunkVisible}
        courseName={
          activeModal?.type === "add-bunk"
            ? getDisplayName(activeModal.course)
            : ""
        }
        onClose={closeModal}
        onAdd={(date, timeSlot, note) => {
          if (activeModal?.type === "add-bunk") {
            handleAddBunk(activeModal.course, date, timeSlot, note);
          }
        }}
      />

      <CreateCourseModal
        visible={isCreateCourseVisible}
        onClose={closeModal}
        onSave={handleCreateCourse}
      />

      <ChangesModal visible={isChangesVisible} onClose={closeModal} />

      <DLInputModal
        visible={isDLInputBunkVisible}
        onClose={closeModal}
        onConfirm={(note) => {
          if (activeModal?.type === "dl-input-bunk") {
            handleConfirmDLCourses(note, {
              courseId: activeModal.courseId,
              bunkId: activeModal.bunkId,
            });
          }
        }}
      />

      <PresenceInputModal
        visible={isPresenceInputBunkVisible || isPresenceInputUnknownVisible}
        onClose={closeModal}
        onConfirm={(note) => {
          if (activeModal?.type === "presence-input-bunk") {
            handleConfirmPresenceCourses(note, {
              courseId: activeModal.courseId,
              bunkId: activeModal.bunkId,
            });
          } else if (activeModal?.type === "presence-input-unknown") {
            applyUnknownPresent(activeModal.courseId, activeModal.record, note);
            closeModal();
          }
        }}
      />

      <DutyLeaveModal
        visible={isDutyLeaveListVisible}
        dutyLeaves={allDutyLeaves}
        onClose={closeModal}
        onRemove={(courseId, bunkId) =>
          openModal({ type: "confirm-remove-dl", courseId, bunkId })
        }
      />

      <UnknownStatusModal
        visible={isUnknownStatusVisible}
        courses={courses}
        bunkCourses={bunkCourses}
        onClose={closeModal}
        onRevert={handleRevertUnknown}
        onConfirmPresent={(courseId, record) => {
          openModal({ type: "presence-input-unknown", courseId, record });
        }}
        onConfirmAbsent={(courseId, record) => {
          openModal({ type: "confirm-unknown-absent", courseId, record });
        }}
      />

      <SlotConflictModal
        visible={isSlotConflictVisible && conflicts.length > 0}
        conflicts={conflicts}
        onResolve={handleResolveConflict}
        onClose={closeModal}
      />

      <ConfirmModal
        visible={isConfirmVisible}
        title={confirmContent.title}
        message={confirmContent.message}
        confirmText={confirmContent.confirmText}
        variant="destructive"
        icon="warning"
        onCancel={closeModal}
        onConfirm={() => {
          if (!activeModal) return;
          if (activeModal.type === "confirm-remove-dl") {
            handleConfirmRemoveDL(activeModal.courseId, activeModal.bunkId);
          } else if (activeModal.type === "confirm-remove-present") {
            handleConfirmRemovePresent(
              activeModal.courseId,
              activeModal.bunkId,
            );
          } else if (activeModal.type === "confirm-unknown-absent") {
            handleConfirmUnknownAbsent(
              activeModal.courseId,
              activeModal.record,
            );
          }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  list: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  separator: {
    height: Spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    height: Spacing.lg,
  },
});
