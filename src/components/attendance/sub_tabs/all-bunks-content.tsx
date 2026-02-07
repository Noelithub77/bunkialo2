import { ConfirmModal } from "@/components/modals/confirm-modal";
import { GradientCard } from "@/components/ui/gradient-card";
import { Colors } from "@/constants/theme";
import { useBunkActions } from "@/hooks/use-bunk-actions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAttendanceUIStore } from "@/stores/attendance-ui-store";
import { selectAllDutyLeaves, useBunkStore } from "@/stores/bunk-store";
import { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { DLInputModal } from "./../dl-input-modal";
import { DutyLeaveModal } from "./../duty-leave-modal";
import { PresenceInputModal } from "./../presence-input-modal";
import { TotalAbsenceCalendar } from "./../total-absence-calendar";
import { UnknownStatusModal } from "./../unknown-status-modal";

export const AllBunksContent = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { courses, isLoading, fetchAttendance } = useAttendanceStore();
  const { courses: bunkCourses } = useBunkStore();
  const { activeModal, openModal, closeModal } = useAttendanceUIStore();

  const {
    handleMarkPresentAbsences,
    handleMarkDLAbsences,
    handleConfirmPresentAbsences,
    handleConfirmDLAbsences,
    applyUnknownPresent,
    handleRevertUnknown,
    applyUnknownAbsent,
    handleConfirmUnknownAbsent,
    handleConfirmRemoveDL,
    handleConfirmRemovePresent,
  } = useBunkActions();

  const allDutyLeaves = useMemo(
    () => selectAllDutyLeaves(bunkCourses),
    [bunkCourses],
  );

  const handleRefresh = useCallback(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // modal visibility checks
  const isDLInputVisible = activeModal?.type === "dl-input";
  const isPresenceInputVisible = activeModal?.type === "presence-input";
  const isDutyLeaveListVisible = activeModal?.type === "duty-leave-list";
  const isUnknownStatusVisible = activeModal?.type === "unknown-status";
  const isConfirmVisible =
    activeModal?.type === "confirm-remove-dl" ||
    activeModal?.type === "confirm-remove-present" ||
    activeModal?.type === "confirm-unknown-absent";

  // get confirm dialog content
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

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-12"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.text}
          />
        }
      >
        <GradientCard>
          <TotalAbsenceCalendar
            onMarkPresent={handleMarkPresentAbsences}
            onMarkDL={handleMarkDLAbsences}
            onRemoveDL={(courseId, bunkId) =>
              openModal({ type: "confirm-remove-dl", courseId, bunkId })
            }
            onRemovePresent={(courseId, bunkId) =>
              openModal({ type: "confirm-remove-present", courseId, bunkId })
            }
          />
        </GradientCard>
      </ScrollView>

      <PresenceInputModal
        visible={isPresenceInputVisible}
        onClose={closeModal}
        onConfirm={(note) => {
          if (activeModal?.type === "presence-input") {
            handleConfirmPresentAbsences(note, {
              courseId: activeModal.courseId,
              record: activeModal.record,
            });
          }
        }}
      />

      <DLInputModal
        visible={isDLInputVisible}
        onClose={closeModal}
        onConfirm={(note) => {
          if (activeModal?.type === "dl-input") {
            handleConfirmDLAbsences(note, {
              courseId: activeModal.courseId,
              record: activeModal.record,
            });
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
        onConfirmPresent={applyUnknownPresent}
        onConfirmAbsent={(courseId, record) => {
          applyUnknownAbsent(courseId, record);
        }}
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
