import { AddBunkModal } from "@/components/attendance/add-bunk-modal";
import { CourseEditModal } from "@/components/attendance/course-edit-modal";
import { CreateCourseModal } from "@/components/attendance/create-course-modal";
import { DLInputModal } from "@/components/attendance/dl-input-modal";
import { DutyLeaveModal } from "@/components/attendance/duty-leave-modal";
import { PresenceInputModal } from "@/components/attendance/presence-input-modal";
import { SlotEditorModal } from "@/components/attendance/slot-editor-modal";
import { TotalAbsenceCalendar } from "@/components/attendance/total-absence-calendar";
import { UnifiedCourseCard } from "@/components/attendance/unified-course-card";
import { UnknownStatusModal } from "@/components/attendance/unknown-status-modal";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { SlotConflictModal } from "@/components/modals/slot-conflict-modal";
import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import {
  getDisplayName,
  selectAllDutyLeaves,
  useBunkStore,
} from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";
import type {
  AttendanceRecord,
  CourseBunkData,
  CourseConfig,
  ManualSlotInput,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FAB, Portal } from "react-native-paper";

type TabType = "courses" | "absences";
type ConfirmDialogState =
  | { type: "removeDL"; courseId: string; bunkId: string }
  | { type: "removePresent"; courseId: string; bunkId: string }
  | { type: "confirmUnknownAbsent"; courseId: string; record: AttendanceRecord }
  | null;

const formatSyncTime = (timestamp: number | null): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
};

const parseTimeSlot = (dateStr: string): string | null => {
  const timeMatch = dateStr.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  return timeMatch ? timeMatch[1] : null;
};

const parseRecordDate = (dateStr: string): Date | null => {
  const dateMatch = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!dateMatch) return null;
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
  const [, day, monthStr, year] = dateMatch;
  const month = months[monthStr.toLowerCase()];
  if (!month) return null;
  return new Date(`${year}-${month}-${day.padStart(2, "0")}`);
};

const buildRecordKey = (date: string, description: string): string =>
  `${date.trim()}-${description.trim()}`;

export default function AttendanceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const isFocused = useIsFocused();

  const {
    courses,
    isLoading,
    lastSyncTime,
    fetchAttendance,
    hasHydrated: isAttendanceHydrated,
  } = useAttendanceStore();
  const {
    courses: bunkCourses,
    syncFromLms,
    updateCourseConfig,
    addBunk,
    markAsDutyLeave,
    removeDutyLeave,
    markAsPresent,
    removePresenceCorrection,
    removeBunk,
    updateBunkNote,
    addCustomCourse,
    deleteCustomCourse,
    addManualSlot,
    updateManualSlot,
    removeManualSlot,
    hasHydrated: isBunkHydrated,
  } = useBunkStore();

  const {
    slots: timetableSlots,
    conflicts,
    generateTimetable,
    resolveConflict,
  } = useTimetableStore();

  const [activeTab, setActiveTab] = useState<TabType>("absences");
  const [showTooltip, setShowTooltip] = useState(false);

  // modals for "All Bunks" tab
  const [pendingDL, setPendingDL] = useState<{
    courseId: string;
    record: AttendanceRecord;
  } | null>(null);
  const [pendingPresent, setPendingPresent] = useState<{
    courseId: string;
    record: AttendanceRecord;
  } | null>(null);
  const [pendingUnknownPresent, setPendingUnknownPresent] = useState<{
    courseId: string;
    record: AttendanceRecord;
  } | null>(null);

  // modals for "Courses" tab
  const [editCourse, setEditCourse] = useState<CourseBunkData | null>(null);
  const [addBunkCourse, setAddBunkCourse] = useState<CourseBunkData | null>(
    null,
  );
  const [showDLModal, setShowDLModal] = useState(false);
  const [showUnknownModal, setShowUnknownModal] = useState(false);
  const [dlPromptBunk, setDlPromptBunk] = useState<{
    courseId: string;
    bunkId: string;
  } | null>(null);
  const [presencePromptBunk, setPresencePromptBunk] = useState<{
    courseId: string;
    bunkId: string;
  } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  // create course modal
  const [showCreateCourse, setShowCreateCourse] = useState(false);

  // slot editor modal
  const [slotEditorCourse, setSlotEditorCourse] =
    useState<CourseBunkData | null>(null);

  // conflict modal
  const [showConflictModal, setShowConflictModal] = useState(false);

  // FAB menu
  const [showFabMenu, setShowFabMenu] = useState(false);

  const allDutyLeaves = useMemo(
    () => selectAllDutyLeaves(bunkCourses),
    [bunkCourses],
  );

  const unknownCount = useMemo(() => {
    if (courses.length === 0) return 0;
    const resolvedKeysByCourse = new Map<string, Set<string>>();
    for (const course of bunkCourses) {
      const keys = new Set<string>();
      for (const bunk of course.bunks) {
        keys.add(buildRecordKey(bunk.date, bunk.description));
      }
      resolvedKeysByCourse.set(course.courseId, keys);
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let count = 0;
    for (const course of courses) {
      const resolvedKeys = resolvedKeysByCourse.get(course.courseId);
      for (const record of course.records) {
        if (record.status !== "Unknown") continue;
        const recordDate = parseRecordDate(record.date);
        if (!recordDate || recordDate > today) continue;
        const recordKey = buildRecordKey(record.date, record.description);
        if (resolvedKeys?.has(recordKey)) continue;
        count += 1;
      }
    }
    return count;
  }, [bunkCourses, courses]);

  // auto slots for the course being edited (LMS-generated, non-manual)
  const autoSlotsForEditor = useMemo(() => {
    if (!slotEditorCourse) return [];
    return timetableSlots
      .filter(
        (slot) => slot.courseId === slotEditorCourse.courseId && !slot.isManual,
      )
      .map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sessionType: slot.sessionType,
        isHidden: false, // TODO: track hidden auto slots in store if needed
      }));
  }, [slotEditorCourse, timetableSlots]);

  useEffect(() => {
    if (!isAttendanceHydrated) return;
    if (lastSyncTime !== null) return; // cache exists; refresh only on manual

    InteractionManager.runAfterInteractions(() => {
      fetchAttendance();
    });
  }, [isAttendanceHydrated, lastSyncTime, fetchAttendance]);

  useEffect(() => {
    if (!isAttendanceHydrated || !isBunkHydrated) return;
    if (courses.length === 0) return;

    InteractionManager.runAfterInteractions(() => {
      syncFromLms();
    });
  }, [
    isAttendanceHydrated,
    isBunkHydrated,
    lastSyncTime,
    courses.length,
    syncFromLms,
  ]);

  // close FAB when screen loses focus (navigating to other tabs)
  useFocusEffect(
    useCallback(() => {
      // on focus - do nothing
      return () => {
        // on blur - close FAB menu
        setShowFabMenu(false);
      };
    }, []),
  );

  const handleRefresh = useCallback(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleTabChange = (tab: TabType) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    // close FAB menu when switching tabs to prevent backdrop overlay issue
    setShowFabMenu(false);
  };

  // "All Bunks" tab handlers
  const findMatchingBunk = useCallback(
    (courseId: string, record: AttendanceRecord) => {
      const course = bunkCourses.find((item) => item.courseId === courseId);
      if (!course) return null;
      const recordKey = buildRecordKey(record.date, record.description);
      return (
        course.bunks.find(
          (item) => buildRecordKey(item.date, item.description) === recordKey,
        ) || null
      );
    },
    [bunkCourses],
  );

  const findBunkId = useCallback(
    (courseId: string, record: AttendanceRecord): string | null => {
      const bunk = findMatchingBunk(courseId, record);
      return bunk ? bunk.id : null;
    },
    [findMatchingBunk],
  );

  const applyUnknownPresent = useCallback(
    (courseId: string, record: AttendanceRecord, note: string) => {
      const existingBunk = findMatchingBunk(courseId, record);
      if (existingBunk) {
        if (existingBunk.isDutyLeave) {
          removeDutyLeave(courseId, existingBunk.id);
        }
        markAsPresent(courseId, existingBunk.id, note);
      } else {
        addBunk(courseId, {
          date: record.date,
          description: record.description,
          timeSlot: parseTimeSlot(record.date),
          note: "",
          isDutyLeave: false,
          dutyLeaveNote: "",
          isMarkedPresent: true,
          presenceNote: note,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [addBunk, findMatchingBunk, markAsPresent, removeDutyLeave],
  );

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
    [
      findMatchingBunk,
      removeBunk,
      removeDutyLeave,
      removePresenceCorrection,
    ],
  );

  const handleMarkPresentAbsences = (
    courseId: string,
    record: AttendanceRecord,
  ) => {
    if (record.status === "Unknown") {
      setPendingUnknownPresent({ courseId, record });
      return;
    }
    setPendingPresent({ courseId, record });
  };

  const handleConfirmPresentAbsences = (note: string) => {
    if (pendingUnknownPresent) {
      applyUnknownPresent(
        pendingUnknownPresent.courseId,
        pendingUnknownPresent.record,
        note,
      );
      setPendingUnknownPresent(null);
      return;
    }
    if (!pendingPresent) return;
    const existingBunk = findMatchingBunk(
      pendingPresent.courseId,
      pendingPresent.record,
    );
    if (existingBunk) {
      if (existingBunk.isDutyLeave) {
        removeDutyLeave(pendingPresent.courseId, existingBunk.id);
      }
      markAsPresent(pendingPresent.courseId, existingBunk.id, note);
    } else {
      addBunk(pendingPresent.courseId, {
        date: pendingPresent.record.date,
        description: pendingPresent.record.description,
        timeSlot: parseTimeSlot(pendingPresent.record.date),
        note: "",
        isDutyLeave: false,
        dutyLeaveNote: "",
        isMarkedPresent: true,
        presenceNote: note,
      });
    }
    setPendingPresent(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleMarkDLAbsences = (courseId: string, record: AttendanceRecord) => {
    if (record.status === "Unknown") {
      setConfirmDialog({ type: "confirmUnknownAbsent", courseId, record });
      return;
    }
    setPendingDL({ courseId, record });
  };

  const handleConfirmDLAbsences = (note: string) => {
    if (!pendingDL) return;
    const existingBunk = findMatchingBunk(pendingDL.courseId, pendingDL.record);
    if (existingBunk) {
      if (existingBunk.isMarkedPresent) {
        removePresenceCorrection(pendingDL.courseId, existingBunk.id);
      }
      markAsDutyLeave(pendingDL.courseId, existingBunk.id, note);
    } else {
      addBunk(pendingDL.courseId, {
        date: pendingDL.record.date,
        description: pendingDL.record.description,
        timeSlot: parseTimeSlot(pendingDL.record.date),
        note: "",
        isDutyLeave: true,
        dutyLeaveNote: note,
        isMarkedPresent: false,
        presenceNote: "",
      });
    }
    setPendingDL(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // "Courses" tab handlers
  const handleSaveConfig = (courseId: string, config: CourseConfig) => {
    updateCourseConfig(courseId, config);
  };

  const handleAddBunk = (date: string, timeSlot: string, note: string) => {
    if (addBunkCourse) {
      addBunk(addBunkCourse.courseId, {
        date,
        description: "Manual entry",
        timeSlot,
        note,
        isDutyLeave: false,
        dutyLeaveNote: "",
        isMarkedPresent: false,
        presenceNote: "",
      });
    }
  };

  const handleMarkDLCourses = (courseId: string, bunkId: string) => {
    setDlPromptBunk({ courseId, bunkId });
  };

  const handleConfirmDLCourses = (note: string) => {
    if (dlPromptBunk) {
      markAsDutyLeave(dlPromptBunk.courseId, dlPromptBunk.bunkId, note);
      setDlPromptBunk(null);
    }
  };

  const handleRemoveDL = (courseId: string, bunkId: string) => {
    setConfirmDialog({ type: "removeDL", courseId, bunkId });
  };

  const handleMarkPresentCourses = (courseId: string, bunkId: string) => {
    setPresencePromptBunk({ courseId, bunkId });
  };

  const handleConfirmPresenceCourses = (note: string) => {
    if (presencePromptBunk) {
      markAsPresent(
        presencePromptBunk.courseId,
        presencePromptBunk.bunkId,
        note,
      );
      setPresencePromptBunk(null);
      return;
    }
    if (pendingUnknownPresent) {
      applyUnknownPresent(
        pendingUnknownPresent.courseId,
        pendingUnknownPresent.record,
        note,
      );
      setPendingUnknownPresent(null);
    }
  };

  const handleRemovePresent = (courseId: string, bunkId: string) => {
    setConfirmDialog({ type: "removePresent", courseId, bunkId });
  };

  // Unknown status handlers
  const handleShowUnknown = (_courseId: string) => {
    setShowUnknownModal(true);
  };

  const handleConfirmUnknownPresent = (
    courseId: string,
    record: AttendanceRecord,
  ) => {
    setPendingUnknownPresent({ courseId, record });
  };

  const handleConfirmUnknownAbsent = (
    courseId: string,
    record: AttendanceRecord,
  ) => {
    setConfirmDialog({ type: "confirmUnknownAbsent", courseId, record });
  };

  // create course handlers
  const handleCreateCourse = (
    courseName: string,
    alias: string,
    credits: number,
    color: string,
    slots: ManualSlotInput[],
  ) => {
    addCustomCourse({
      courseName,
      alias,
      credits,
      color,
      slots,
    });
    generateTimetable();
    // check for conflicts after generating
    setTimeout(() => {
      const currentConflicts = useTimetableStore.getState().conflicts;
      if (currentConflicts.length > 0) {
        setShowConflictModal(true);
      }
    }, 100);
  };

  // slot editor handlers
  const handleOpenSlotEditor = (course: CourseBunkData) => {
    setSlotEditorCourse(course);
    setIsEditMode(false);
  };

  const handleAddSlot = (slot: ManualSlotInput) => {
    if (!slotEditorCourse) return;
    addManualSlot(slotEditorCourse.courseId, slot);
    generateTimetable();
    // check for conflicts
    setTimeout(() => {
      const currentConflicts = useTimetableStore.getState().conflicts;
      if (currentConflicts.length > 0) {
        setShowConflictModal(true);
      }
    }, 100);
  };

  const handleUpdateSlot = (slotId: string, slot: ManualSlotInput) => {
    if (!slotEditorCourse) return;
    updateManualSlot(slotEditorCourse.courseId, slotId, slot);
    generateTimetable();
  };

  const handleRemoveSlot = (slotId: string) => {
    if (!slotEditorCourse) return;
    removeManualSlot(slotEditorCourse.courseId, slotId);
    generateTimetable();
  };

  const handleResolveConflict = (
    conflictIndex: number,
    keep: "manual" | "auto",
  ) => {
    resolveConflict(conflictIndex, keep);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <Text style={[styles.screenTitle, { color: theme.text }]}>
          Attendance
        </Text>
        <View style={styles.headerActions}>
          {lastSyncTime && (
            <Pressable
              onPressIn={() => setShowTooltip(true)}
              onPressOut={() => setShowTooltip(false)}
              onLongPress={() => setShowTooltip(false)}
              style={styles.headerRight}
            >
              <Ionicons
                name="refresh-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text style={[styles.syncTime, { color: theme.textSecondary }]}>
                {formatSyncTime(lastSyncTime)}
              </Text>
              {showTooltip && (
                <View
                  style={[
                    styles.tooltip,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Text style={[styles.tooltipText, { color: theme.text }]}>
                    Last refresh
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={() => setShowDLModal(true)}
            style={styles.dlButton}
          >
            <Ionicons
              name="briefcase-outline"
              size={20}
              color={Colors.status.info}
            />
            {allDutyLeaves.length > 0 && (
              <View style={styles.dlBadgeSmall}>
                <Text style={styles.dlBadgeText}>{allDutyLeaves.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => setShowUnknownModal(true)}
            style={styles.dlButton}
          >
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={Colors.status.unknown}
            />
            {unknownCount > 0 && (
              <View
                style={[
                  styles.dlBadgeSmall,
                  { backgroundColor: Colors.status.unknown },
                ]}
              >
                <Text style={styles.dlBadgeText}>{unknownCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push("/settings")}
            style={styles.settingsButton}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* tab switcher */}
      <View
        style={[styles.tabBar, { backgroundColor: theme.backgroundSecondary }]}
      >
        <Pressable
          onPress={() => handleTabChange("absences")}
          style={[
            styles.tab,
            activeTab === "absences" && { backgroundColor: theme.background },
          ]}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={activeTab === "absences" ? theme.text : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "absences" ? theme.text : theme.textSecondary,
              },
            ]}
          >
            All Bunks
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange("courses")}
          style={[
            styles.tab,
            activeTab === "courses" && { backgroundColor: theme.background },
          ]}
        >
          <Ionicons
            name="list"
            size={16}
            color={activeTab === "courses" ? theme.text : theme.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "courses" ? theme.text : theme.textSecondary,
              },
            ]}
          >
            Courses
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!lastSyncTime || courses.length === 0) return null;
    return (
      <View style={styles.footer}>
        <Text style={[styles.syncText, { color: theme.textSecondary }]}>
          Updated {formatSyncTime(lastSyncTime)}
        </Text>
      </View>
    );
  };

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

  // "All Bunks" tab content
  if (activeTab === "absences") {
    return (
      <Container>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.absencesContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={theme.text}
            />
          }
        >
          {renderHeader()}
          <GradientCard>
            <TotalAbsenceCalendar
              onMarkPresent={handleMarkPresentAbsences}
              onMarkDL={handleMarkDLAbsences}
              onRemoveDL={(courseId, bunkId) =>
                setConfirmDialog({ type: "removeDL", courseId, bunkId })
              }
              onRemovePresent={(courseId, bunkId) =>
                setConfirmDialog({ type: "removePresent", courseId, bunkId })
              }
            />
          </GradientCard>
        </ScrollView>

        <PresenceInputModal
          visible={!!pendingPresent || !!pendingUnknownPresent}
          onClose={() => {
            setPendingPresent(null);
            setPendingUnknownPresent(null);
          }}
          onConfirm={handleConfirmPresentAbsences}
        />

        <DLInputModal
          visible={!!pendingDL}
          onClose={() => setPendingDL(null)}
          onConfirm={handleConfirmDLAbsences}
        />

        <DutyLeaveModal
          visible={showDLModal}
          dutyLeaves={allDutyLeaves}
          onClose={() => setShowDLModal(false)}
          onRemove={handleRemoveDL}
        />

        <UnknownStatusModal
          visible={showUnknownModal}
          courses={courses}
          bunkCourses={bunkCourses}
          onClose={() => setShowUnknownModal(false)}
          onRevert={handleRevertUnknown}
          onConfirmPresent={(courseId, record) => {
            handleConfirmUnknownPresent(courseId, record);
            setShowUnknownModal(false);
          }}
          onConfirmAbsent={(courseId, record) => {
            handleConfirmUnknownAbsent(courseId, record);
            setShowUnknownModal(false);
          }}
        />

        <ConfirmModal
          visible={confirmDialog !== null}
          title={
            confirmDialog?.type === "removeDL"
              ? "Remove Duty Leave"
              : confirmDialog?.type === "removePresent"
                ? "Remove Presence Mark"
                : "Confirm Absent"
          }
          message={
            confirmDialog?.type === "removeDL"
              ? "This will count as a regular bunk again."
              : confirmDialog?.type === "removePresent"
                ? "This will count as an absence again."
                : "This will add a bunk for this session."
          }
          confirmText={
            confirmDialog?.type === "confirmUnknownAbsent"
              ? "Confirm"
              : "Remove"
          }
          variant="destructive"
          icon="warning"
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            if (!confirmDialog) return;
            if (confirmDialog.type === "removeDL") {
              removeDutyLeave(confirmDialog.courseId, confirmDialog.bunkId);
            } else if (confirmDialog.type === "removePresent") {
              removePresenceCorrection(
                confirmDialog.courseId,
                confirmDialog.bunkId,
              );
            } else {
              applyUnknownAbsent(confirmDialog.courseId, confirmDialog.record);
            }
            setConfirmDialog(null);
          }}
        />
      </Container>
    );
  }

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

  // "Courses" tab content
  return (
    <Container>
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
                if (bunkData) {
                  setEditCourse(bunkData);
                  setIsEditMode(false);
                }
              }}
              onAddBunk={() => {
                if (bunkData) setAddBunkCourse(bunkData);
              }}
              onEditSlots={() => {
                if (bunkData) handleOpenSlotEditor(bunkData);
              }}
              onMarkDL={(bunkId) => handleMarkDLCourses(courseId, bunkId)}
              onRemoveDL={(bunkId) => handleRemoveDL(courseId, bunkId)}
              onMarkPresent={(bunkId) =>
                handleMarkPresentCourses(courseId, bunkId)
              }
              onRemovePresent={(bunkId) =>
                handleRemovePresent(courseId, bunkId)
              }
              onUpdateNote={(bunkId, note) =>
                updateBunkNote(courseId, bunkId, note)
              }
              onShowUnknown={handleShowUnknown}
              onConfirmUnknownPresent={handleConfirmUnknownPresent}
              onConfirmUnknownAbsent={handleConfirmUnknownAbsent}
              onDeleteCustomCourse={() => {
                if (bunkData?.isCustomCourse) {
                  deleteCustomCourse(courseId);
                  generateTimetable();
                }
              }}
            />
          );
        }}
        ListHeaderComponent={renderHeader}
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
        visible={!!editCourse}
        course={editCourse}
        onClose={() => setEditCourse(null)}
        onSave={handleSaveConfig}
      />

      <DutyLeaveModal
        visible={showDLModal}
        dutyLeaves={allDutyLeaves}
        onClose={() => setShowDLModal(false)}
        onRemove={handleRemoveDL}
      />

      <DLInputModal
        visible={!!dlPromptBunk}
        onClose={() => setDlPromptBunk(null)}
        onConfirm={handleConfirmDLCourses}
      />

      <PresenceInputModal
        visible={!!presencePromptBunk || !!pendingUnknownPresent}
        onClose={() => {
          setPresencePromptBunk(null);
          setPendingUnknownPresent(null);
        }}
        onConfirm={handleConfirmPresenceCourses}
      />

      <AddBunkModal
        visible={!!addBunkCourse}
        courseName={addBunkCourse ? getDisplayName(addBunkCourse) : ""}
        onClose={() => setAddBunkCourse(null)}
        onAdd={handleAddBunk}
      />

      <UnknownStatusModal
        visible={showUnknownModal}
        courses={courses}
        bunkCourses={bunkCourses}
        onClose={() => setShowUnknownModal(false)}
        onRevert={handleRevertUnknown}
        onConfirmPresent={(courseId, record) => {
          handleConfirmUnknownPresent(courseId, record);
          setShowUnknownModal(false);
        }}
        onConfirmAbsent={(courseId, record) => {
          handleConfirmUnknownAbsent(courseId, record);
          setShowUnknownModal(false);
        }}
      />

      <ConfirmModal
        visible={confirmDialog !== null}
        title={
          confirmDialog?.type === "removeDL"
            ? "Remove Duty Leave"
            : confirmDialog?.type === "removePresent"
              ? "Remove Presence Mark"
              : "Confirm Absent"
        }
        message={
          confirmDialog?.type === "removeDL"
            ? "This will count as a regular bunk again."
            : confirmDialog?.type === "removePresent"
              ? "This will count as an absence again."
              : "This will add a bunk for this session."
        }
        confirmText={
          confirmDialog?.type === "confirmUnknownAbsent" ? "Confirm" : "Remove"
        }
        variant="destructive"
        icon="warning"
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => {
          if (!confirmDialog) return;
          if (confirmDialog.type === "removeDL") {
            removeDutyLeave(confirmDialog.courseId, confirmDialog.bunkId);
          } else if (confirmDialog.type === "removePresent") {
            removePresenceCorrection(
              confirmDialog.courseId,
              confirmDialog.bunkId,
            );
          } else {
            applyUnknownAbsent(confirmDialog.courseId, confirmDialog.record);
          }
          setConfirmDialog(null);
        }}
      />

      <CreateCourseModal
        visible={showCreateCourse}
        onClose={() => setShowCreateCourse(false)}
        onSave={handleCreateCourse}
      />

      <SlotEditorModal
        visible={!!slotEditorCourse}
        courseName={slotEditorCourse ? getDisplayName(slotEditorCourse) : ""}
        courseColor={slotEditorCourse?.config?.color || Colors.gray[500]}
        existingSlots={slotEditorCourse?.manualSlots || []}
        autoSlots={autoSlotsForEditor}
        onClose={() => setSlotEditorCourse(null)}
        onAddSlot={handleAddSlot}
        onUpdateSlot={handleUpdateSlot}
        onRemoveSlot={handleRemoveSlot}
      />

      <SlotConflictModal
        visible={showConflictModal && conflicts.length > 0}
        conflicts={conflicts}
        onResolve={handleResolveConflict}
        onClose={() => setShowConflictModal(false)}
      />

      {/* FAB Speed Dial - Only render on Courses tab */}
      {isFocused && activeTab === "courses" && (
        <Portal>
          <FAB.Group
            open={showFabMenu}
            visible={true}
            icon={showFabMenu ? "close" : isEditMode ? "check" : "plus"}
            color={Colors.white}
            style={{ position: "absolute", right: 0, bottom: 80 }}
            backdropColor="rgba(0,0,0,0.5)"
            fabStyle={{
              backgroundColor: showFabMenu
                ? theme.textSecondary
                : isEditMode
                  ? Colors.status.info
                  : Colors.status.success,
            }}
            actions={[
              {
                icon: "pencil",
                label: isEditMode ? "Done Editing" : "Edit Courses",
                color: isEditMode ? Colors.white : theme.text,
                style: {
                  backgroundColor: isEditMode
                    ? Colors.status.info
                    : theme.backgroundSecondary,
                },
                onPress: () => {
                  Haptics.selectionAsync();
                  setIsEditMode(!isEditMode);
                },
              },
              {
                icon: "plus",
                label: "Add Course",
                color: Colors.white,
                style: { backgroundColor: Colors.status.success },
                onPress: () => {
                  Haptics.selectionAsync();
                  setShowCreateCourse(true);
                },
              },
            ]}
            onStateChange={({ open }) => setShowFabMenu(open)}
            onPress={() => {
              if (showFabMenu) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          />
        </Portal>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  headerContainer: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  syncTime: {
    fontSize: 12,
  },
  settingsButton: {
    padding: Spacing.sm,
  },
  dlButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
  },
  dlBadgeSmall: {
    backgroundColor: Colors.status.info,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  dlBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "600",
  },
  tooltip: {
    position: "absolute",
    top: 24,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 10,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: Radius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  syncText: {
    fontSize: 12,
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
  scrollView: {
    flex: 1,
  },
  absencesContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
});
