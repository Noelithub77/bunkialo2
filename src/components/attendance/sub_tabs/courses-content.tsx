import { ConfirmModal } from "@/components/modals/confirm-modal";
import { SlotConflictModal } from "@/components/modals/slot-conflict-modal";
import { Colors } from "@/constants/theme";
import { useBunkActions } from "@/hooks/use-bunk-actions";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCourseActions } from "@/hooks/use-course-actions";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAttendanceUIStore } from "@/stores/attendance-ui-store";
import {
  filterPastBunks,
  getDisplayName,
  selectAllDutyLeaves,
  useBunkStore,
} from "@/stores/bunk-store";
import type { AttendanceRecord, CourseAttendance, CourseBunkData } from "@/types";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from "react-native";
import { AddBunkModal } from "../add-bunk-modal";
import { CourseEditModal } from "../course-edit-modal";
import { CreateCourseModal } from "../create-course-modal";
import { DLInputModal } from "../dl-input-modal";
import { DutyLeaveModal } from "../duty-leave-modal";
import { PresenceInputModal } from "../presence-input-modal";
import { UnifiedCourseCard } from "../unified-course-card";
import { UnknownStatusModal } from "../unknown-status-modal";
import { ChangesModal } from "../changes-modal";

const parseDateString = (
  dateStr: string,
): { date: string | null; time: string | null } => {
  const cleaned = dateStr.trim();
  const timeMatch = cleaned.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  const time = timeMatch ? timeMatch[1] : null;

  const dateMatch = cleaned.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!dateMatch) return { date: null, time };

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
  if (!month) return { date: null, time };

  return { date: `${year}-${month}-${day.padStart(2, "0")}`, time };
};

const buildRecordKey = (record: AttendanceRecord): string =>
  `${record.date.trim()}-${record.description.trim()}`;

const filterPastRecords = (records: AttendanceRecord[]): AttendanceRecord[] => {
  const now = new Date();
  return records.filter((record) => {
    const { date, time } = parseDateString(record.date);
    if (!date) return false;
    if (!time) return new Date(date) <= now;

    const [, end] = time.split("-").map((part) => part.trim());
    const dateTime = new Date(`${date} ${end}`);
    if (Number.isNaN(dateTime.getTime())) return new Date(date) <= now;
    return dateTime <= now;
  });
};

const getEffectiveCoursePercentage = (
  course: CourseAttendance | null,
  bunkData: CourseBunkData | undefined,
): number => {
  if (!course) return Number.POSITIVE_INFINITY;

  const pastRecords = filterPastRecords(course.records);
  const totalSessions = pastRecords.length;
  if (totalSessions === 0) return 0;

  const bunkKeys = new Set<string>();
  if (bunkData) {
    for (const bunk of bunkData.bunks) {
      bunkKeys.add(`${bunk.date.trim()}-${bunk.description.trim()}`);
    }
  }

  const displayRecords = pastRecords.filter(
    (record) => record.status !== "Unknown" || !bunkKeys.has(buildRecordKey(record)),
  );
  const confirmedPresentCount = pastRecords.filter(
    (record) => record.status === "Present",
  ).length;
  const unknownCount = displayRecords.filter(
    (record) => record.status === "Unknown",
  ).length;
  const correctedPresentCount = bunkData
    ? filterPastBunks(bunkData.bunks).filter((bunk) => bunk.isMarkedPresent)
        .length
    : 0;
  const attended = confirmedPresentCount + unknownCount + correctedPresentCount;

  return Math.round((attended / totalSessions) * 100);
};

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
    applyUnknownAbsent,
    updateBunkNote,
  } = useBunkActions();

  const {
    handleSaveCourse,
    handleAddBunk,
    handleCreateCourse,
    handleDeleteCustomCourse,
    handleResolveConflict,
    handleResolveAllPreferred,
    conflicts,
    handleRevertAutoConflict,
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

    return [...lmsCourseData, ...customCourseData].sort((a, b) => {
      const aPercentage = getEffectiveCoursePercentage(a.course, a.bunkData);
      const bPercentage = getEffectiveCoursePercentage(b.course, b.bunkData);

      if (aPercentage !== bPercentage) {
        return aPercentage - bPercentage;
      }

      const aName =
        a.bunkData?.config?.alias ?? a.course?.courseName ?? a.bunkData?.courseId ?? "";
      const bName =
        b.bunkData?.config?.alias ?? b.course?.courseName ?? b.bunkData?.courseId ?? "";

      return aName.localeCompare(bName);
    });
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
        <View className="items-center gap-4 py-12">
          <ActivityIndicator size="large" color={theme.text} />
          <Text className="text-[14px]" style={{ color: theme.textSecondary }}>
            Fetching attendance data...
          </Text>
        </View>
      );
    }
    return (
      <View className="items-center gap-4 py-12">
        <Text className="text-[14px]" style={{ color: theme.textSecondary }}>
          No courses found. Pull to refresh.
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!lastSyncTime || courses.length === 0) return null;
    return <View className="h-6" />;
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
        contentContainerClassName="p-4 pb-[100px]"
        ItemSeparatorComponent={() => <View className="h-4" />}
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
        visible={isPresenceInputBunkVisible}
        onClose={closeModal}
        onConfirm={(note) => {
          if (activeModal?.type === "presence-input-bunk") {
            handleConfirmPresenceCourses(note, {
              courseId: activeModal.courseId,
              bunkId: activeModal.bunkId,
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

      <SlotConflictModal
        visible={isSlotConflictVisible && conflicts.length > 0}
        conflicts={conflicts}
        onResolve={handleResolveConflict}
        onResolveAllPreferred={handleResolveAllPreferred}
        onRevertAutoConflict={handleRevertAutoConflict}
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
