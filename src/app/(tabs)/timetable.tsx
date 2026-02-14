import { CourseEditModal } from "@/components/attendance/course-edit-modal";
import { CreateCourseModal } from "@/components/attendance/create-course-modal";
import { SlotConflictModal } from "@/components/modals/slot-conflict-modal";
import { DaySchedule } from "@/components/timetable/day-schedule";
import { DaySelector } from "@/components/timetable/day-selector";
import { TimetableExportModal } from "@/components/timetable/timetable-export-modal";
import { UpNextCarousel } from "@/components/timetable/upnext-carousel";
import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";
import type {
  CourseBunkData,
  CourseConfig,
  DayOfWeek,
  ManualSlotInput,
  SlotConflict,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { FAB, Portal } from "react-native-paper";

export default function TimetableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const {
    slots,
    conflicts,
    lastGeneratedAt,
    isLoading,
    generateTimetable,
    resolveConflict,
    resolveAllAutoConflicts,
    revertAutoConflictResolution,
  } = useTimetableStore();
  const {
    courses: attendanceCourses,
    fetchAttendance,
    isLoading: isAttendanceLoading,
    hasHydrated: isAttendanceHydrated,
  } = useAttendanceStore();
  const {
    courses: bunkCourses,
    hiddenCourses,
    hasHydrated: isBunkHydrated,
    syncFromLms,
    updateCourseConfig,
    setManualSlots,
    addCustomCourse,
    deleteCourse,
  } = useBunkStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showSlotConflictModal, setShowSlotConflictModal] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showTimetableExport, setShowTimetableExport] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [isCourseEditMode, setIsCourseEditMode] = useState(false);
  const [showCourseEditModal, setShowCourseEditModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const hasGenerated = useRef(false);
  const recomputeTaskRef = useRef<ReturnType<
    typeof InteractionManager.runAfterInteractions
  > | null>(null);
  const isFocused = useIsFocused();
  const unresolvedConflictCount = conflicts.filter((conflict: SlotConflict) => {
    if (conflict.type === "manual-auto") return true;
    return conflict.resolvedChoice === null;
  }).length;

  // recompute day on focus
  const getDefaultDay = (): DayOfWeek => {
    const day = new Date().getDay() as DayOfWeek;
    return day >= 1 && day <= 5 ? day : 1;
  };
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getDefaultDay);

  const scheduleTimetableRecompute = useCallback(() => {
    recomputeTaskRef.current?.cancel();
    recomputeTaskRef.current = InteractionManager.runAfterInteractions(() => {
      syncFromLms();
      generateTimetable();
    });
  }, [generateTimetable, syncFromLms]);

  useFocusEffect(
    useCallback(() => {
      setSelectedDay(getDefaultDay());
      scheduleTimetableRecompute();
      return () => {
        setShowFabMenu(false);
        setIsCourseEditMode(false);
        recomputeTaskRef.current?.cancel();
      };
    }, [scheduleTimetableRecompute]),
  );

  // generate timetable on first load
  useEffect(() => {
    if (
      !hasGenerated.current &&
      attendanceCourses.length > 0 &&
      slots.length === 0
    ) {
      const task = InteractionManager.runAfterInteractions(() => {
        scheduleTimetableRecompute();
        hasGenerated.current = true;
      });
      return () => task.cancel();
    }
    return undefined;
  }, [attendanceCourses.length, scheduleTimetableRecompute, slots.length]);

  useEffect(() => {
    if (!isAttendanceHydrated || !isBunkHydrated) return;
    if (attendanceCourses.length === 0) return;
    scheduleTimetableRecompute();
    return undefined;
  }, [
    attendanceCourses,
    isAttendanceHydrated,
    isBunkHydrated,
    scheduleTimetableRecompute,
  ]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetchAttendance();
      scheduleTimetableRecompute();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAttendance, scheduleTimetableRecompute]);

  const handleOpenConflicts = useCallback(() => {
    if (conflicts.length === 0) {
      Haptics.selectionAsync();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSlotConflictModal(true);
  }, [conflicts.length]);

  const visibleEditableCourses = useMemo(
    () =>
      bunkCourses.filter(
        (course) => course.isCustomCourse || !hiddenCourses[course.courseId],
      ),
    [bunkCourses, hiddenCourses],
  );
  const displaySlots = useMemo(
    () =>
      slots.filter(
        (slot) => slot.isCustomCourse || !hiddenCourses[slot.courseId],
      ),
    [slots, hiddenCourses],
  );

  const selectedCourse = useMemo(
    () =>
      selectedCourseId
        ? (visibleEditableCourses.find(
            (course) => course.courseId === selectedCourseId,
          ) ?? null)
        : null,
    [selectedCourseId, visibleEditableCourses],
  );

  useEffect(() => {
    if (!showCourseEditModal) return;
    if (selectedCourse) return;
    setShowCourseEditModal(false);
  }, [selectedCourse, showCourseEditModal]);

  const openConflictModalIfNeeded = useCallback(() => {
    const currentConflicts = useTimetableStore.getState().conflicts;
    if (currentConflicts.length > 0) {
      setShowSlotConflictModal(true);
    }
  }, []);

  const handleCreateCourse = useCallback(
    (
      courseName: string,
      alias: string,
      credits: number,
      color: string,
      slotsInput: ManualSlotInput[],
    ) => {
      addCustomCourse({ courseName, alias, credits, color, slots: slotsInput });
      scheduleTimetableRecompute();
      setShowCreateCourseModal(false);
      setShowFabMenu(false);
      setTimeout(openConflictModalIfNeeded, 100);
    },
    [addCustomCourse, openConflictModalIfNeeded, scheduleTimetableRecompute],
  );

  const handleSaveCourse = useCallback(
    (courseId: string, config: CourseConfig, slotsInput: ManualSlotInput[]) => {
      updateCourseConfig(courseId, config);
      setManualSlots(courseId, slotsInput);
      scheduleTimetableRecompute();
      setShowCourseEditModal(false);
      setShowFabMenu(false);
      setTimeout(openConflictModalIfNeeded, 100);
    },
    [
      openConflictModalIfNeeded,
      scheduleTimetableRecompute,
      setManualSlots,
      updateCourseConfig,
    ],
  );

  const handleDeleteCourse = useCallback(
    (course: CourseBunkData) => {
      deleteCourse(course.courseId);
      scheduleTimetableRecompute();
      setSelectedCourseId(null);
      setShowCourseEditModal(false);
    },
    [deleteCourse, scheduleTimetableRecompute],
  );

  const handleOpenCourseEditByTap = useCallback(
    (courseId: string) => {
      if (!isCourseEditMode) return;
      const canEdit = visibleEditableCourses.some(
        (course) => course.courseId === courseId,
      );
      if (!canEdit) return;
      Haptics.selectionAsync();
      setSelectedCourseId(courseId);
      setShowCourseEditModal(true);
    },
    [isCourseEditMode, visibleEditableCourses],
  );

  useEffect(() => {
    if (conflicts.length === 0) {
      setShowSlotConflictModal(false);
    }
  }, [conflicts.length]);

  const formatLastGenerated = (timestamp: number | null): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Container>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isAttendanceLoading}
            onRefresh={handleRefresh}
            tintColor={theme.text}
          />
        }
      >
        {/* header */}
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-shrink gap-0.5">
            <Text
              className="text-[28px] font-bold"
              style={{ color: theme.text }}
            >
              Timetable
            </Text>
            {lastGeneratedAt && (
              <View className="flex-row items-center gap-1 self-start rounded-full px-1.5 py-0.5">
                <Ionicons
                  name="refresh-outline"
                  size={12}
                  color={theme.textSecondary}
                />
                <Text
                  className="text-[10px] font-medium tracking-[0.2px]"
                  style={{ color: theme.textSecondary }}
                >
                  {formatLastGenerated(lastGeneratedAt)}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={handleOpenConflicts}
            className="relative p-1"
            hitSlop={8}
            style={conflicts.length === 0 ? { opacity: 0.6 } : undefined}
          >
            <Ionicons
              name={
                unresolvedConflictCount > 0
                  ? "warning-outline"
                  : "checkmark-circle-outline"
              }
              size={18}
              color={
                unresolvedConflictCount > 0
                  ? Colors.status.warning
                  : theme.textSecondary
              }
            />
            {conflicts.length > 0 && (
              <View
                className="absolute -right-1 -top-1 h-[16px] min-w-[16px] flex-row items-center justify-center rounded-full px-1.5"
                style={{
                  backgroundColor:
                    unresolvedConflictCount > 0
                      ? Colors.status.danger
                      : theme.border,
                }}
              >
                <Text
                  className="text-[10px] font-bold leading-[12px]"
                  numberOfLines={1}
                  style={{
                    color:
                      unresolvedConflictCount > 0
                        ? Colors.white
                        : theme.textSecondary,
                  }}
                >
                  {unresolvedConflictCount > 0
                    ? unresolvedConflictCount > 9
                      ? "9+"
                      : unresolvedConflictCount
                    : "0"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {isCourseEditMode && (
          <View
            className="mb-2 rounded-xl px-3 py-2"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <Text
              className="text-[11px]"
              style={{ color: theme.textSecondary }}
            >
              Edit mode: tap a course card or schedule slot.
            </Text>
          </View>
        )}

        {/* loading state */}
        {isLoading && slots.length === 0 && (
          <View className="items-center py-12 gap-4">
            <ActivityIndicator size="large" color={theme.text} />
            <Text className="text-sm" style={{ color: theme.textSecondary }}>
              Generating timetable...
            </Text>
          </View>
        )}

        {/* empty state */}
        {!isLoading && displaySlots.length === 0 && (
          <GradientCard>
            <View className="items-center py-6 gap-2">
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text
                className="text-lg font-semibold"
                style={{ color: theme.text }}
              >
                No timetable yet
              </Text>
              <Text
                className="text-sm text-center"
                style={{ color: theme.textSecondary }}
              >
                Pull to refresh to fetch attendance data and generate your
                timetable.
              </Text>
            </View>
          </GradientCard>
        )}

        {/* main content */}
        {displaySlots.length > 0 && (
          <>
            {/* up next carousel */}
            <View className="mt-3">
              <Text
                className="mb-2 text-base font-semibold tracking-[0.2px]"
                style={{ color: theme.text }}
              >
                Up Next
              </Text>
              <UpNextCarousel
                slots={displaySlots}
                onCoursePress={
                  isCourseEditMode ? handleOpenCourseEditByTap : undefined
                }
              />
            </View>

            {/* day schedule */}
            <View className="mt-4">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-base font-semibold tracking-[0.2px]"
                  style={{ color: theme.text }}
                >
                  Schedule
                </Text>
              </View>
              <DaySelector
                selectedDay={selectedDay}
                onSelect={setSelectedDay}
              />
              <DaySchedule
                slots={displaySlots}
                selectedDay={selectedDay}
                onCoursePress={
                  isCourseEditMode ? handleOpenCourseEditByTap : undefined
                }
              />
            </View>
          </>
        )}
      </ScrollView>

      {isFocused && (
        <Portal>
          <FAB.Group
            open={showFabMenu}
            visible={true}
            icon={showFabMenu ? "close" : "menu"}
            color={isDark ? Colors.gray[200] : Colors.gray[700]}
            style={{ position: "absolute", right: 0, bottom: 80 }}
            backdropColor="rgba(0,0,0,0.45)"
            fabStyle={{
              backgroundColor: showFabMenu
                ? Colors.gray[800]
                : theme.backgroundSecondary,
            }}
            actions={[
              {
                icon: "calendar-export",
                label: "Export Timetable (.ics)",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                onPress: () => {
                  setShowFabMenu(false);
                  setShowTimetableExport(true);
                },
              },
              {
                icon: "plus",
                label: "Add Course",
                color: Colors.white,
                style: { backgroundColor: Colors.status.success },
                onPress: () => {
                  setShowFabMenu(false);
                  setShowCreateCourseModal(true);
                },
              },
              {
                icon: "pencil",
                label: isCourseEditMode ? "Exit Edit Mode" : "Edit Courses",
                color: isCourseEditMode ? Colors.white : theme.text,
                style: {
                  backgroundColor: isCourseEditMode
                    ? Colors.status.info
                    : theme.backgroundSecondary,
                },
                onPress: () => {
                  setShowFabMenu(false);
                  setIsCourseEditMode((prev) => !prev);
                },
              },
            ]}
            onStateChange={({ open }) => setShowFabMenu(open)}
          />
        </Portal>
      )}

      <TimetableExportModal
        visible={showTimetableExport}
        onClose={() => setShowTimetableExport(false)}
        slots={displaySlots}
      />

      <CreateCourseModal
        visible={showCreateCourseModal}
        onClose={() => setShowCreateCourseModal(false)}
        onSave={handleCreateCourse}
      />

      <CourseEditModal
        visible={showCourseEditModal && !!selectedCourse}
        course={selectedCourse}
        onClose={() => setShowCourseEditModal(false)}
        onSave={handleSaveCourse}
        onDelete={handleDeleteCourse}
      />

      <SlotConflictModal
        visible={showSlotConflictModal && conflicts.length > 0}
        conflicts={conflicts}
        onResolve={resolveConflict}
        onResolveAllPreferred={() => resolveAllAutoConflicts("preferred")}
        onRevertAutoConflict={revertAutoConflictResolution}
        onClose={() => setShowSlotConflictModal(false)}
      />
    </Container>
  );
}
