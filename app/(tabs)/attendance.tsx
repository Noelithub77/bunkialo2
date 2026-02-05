import { AllBunksContent } from "@/components/attendance/sub_tabs/all-bunks-content";
import { CoursesContent } from "@/components/attendance/sub_tabs/courses-content";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCourseActions } from "@/hooks/use-course-actions";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAttendanceUIStore } from "@/stores/attendance-ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { selectAllDutyLeaves, useBunkStore } from "@/stores/bunk-store";
import {
  computeUnknownCount,
  formatSyncTime,
} from "@/utils/attendance-helpers";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { InteractionManager, Pressable, Text, View } from "react-native";
import { FAB, Portal } from "react-native-paper";

export default function AttendanceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const isFocused = useIsFocused();

  const {
    courses,
    lastSyncTime,
    fetchAttendance,
    hasHydrated: isAttendanceHydrated,
  } = useAttendanceStore();
  const { isOffline, setOffline } = useAuthStore();
  const {
    courses: bunkCourses,
    syncFromLms,
    hasHydrated: isBunkHydrated,
  } = useBunkStore();

  const {
    activeTab,
    setActiveTab,
    showTooltip,
    setShowTooltip,
    isEditMode,
    showFabMenu,
    setShowFabMenu,
    openModal,
  } = useAttendanceUIStore();
  const hasAutoRefreshed = useRef(false);
  const attendanceStaleMs = 30 * 60 * 1000;

  const { handleOpenCreateCourse, handleToggleEditMode } = useCourseActions();

  const allDutyLeaves = useMemo(
    () => selectAllDutyLeaves(bunkCourses),
    [bunkCourses],
  );

  const unknownCount = useMemo(
    () => computeUnknownCount(courses, bunkCourses),
    [courses, bunkCourses],
  );

  // initial fetch on hydration
  useEffect(() => {
    if (!isAttendanceHydrated || hasAutoRefreshed.current) return;
    if (isOffline && lastSyncTime === null) return;
    hasAutoRefreshed.current = true;
    if (isOffline) return;

    const shouldRefresh =
      lastSyncTime === null || Date.now() - lastSyncTime > attendanceStaleMs;
    if (!shouldRefresh) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (lastSyncTime === null) {
        fetchAttendance();
      } else {
        fetchAttendance({ silent: true });
      }
    });
    return () => task.cancel();
  }, [
    attendanceStaleMs,
    fetchAttendance,
    isAttendanceHydrated,
    isOffline,
    lastSyncTime,
  ]);

  // sync bunk store from LMS data
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

  useEffect(() => {
    if (isOffline && lastSyncTime) {
      setOffline(false);
    }
  }, [isOffline, lastSyncTime, setOffline]);

  // close FAB on blur
  useFocusEffect(
    useCallback(() => {
      return () => setShowFabMenu(false);
    }, [setShowFabMenu]),
  );

  const handleTabChange = (tab: "absences" | "courses") => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  };

  return (
    <Container>
      {/* Header */}
      <View className="mb-4 px-4 pt-4">
        <View className="flex-row flex-wrap items-center justify-between gap-y-2 mb-4">
          <View className="min-w-[40%] flex-shrink gap-0.5">
            <Text className="text-[28px] font-bold" style={{ color: theme.text }}>
              Attendance
            </Text>
            {lastSyncTime && (
              <Pressable
                onPressIn={() => setShowTooltip(true)}
                onPressOut={() => setShowTooltip(false)}
                className="relative self-start flex-row items-center gap-1 rounded-full px-1.5 py-0.5"
                hitSlop={8}
              >
                <Ionicons
                  name="refresh-outline"
                  size={12}
                  color={theme.textSecondary}
                />
                <Text
                  className="text-[10px] font-medium tracking-[0.2px]"
                  style={{ color: theme.textSecondary }}
                >
                  {formatSyncTime(lastSyncTime)}
                </Text>
                {showTooltip && (
                  <View
                    className="absolute right-0 top-6 z-10 rounded px-2 py-1"
                    style={{ backgroundColor: theme.backgroundSecondary }}
                  >
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: theme.text }}
                    >
                      Last refresh
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
          <View className="min-w-[45%] flex-row flex-wrap items-center justify-end gap-1 gap-y-1">
            <Pressable
              onPress={() => openModal({ type: "duty-leave-list" })}
              className="flex-row items-center p-2"
            >
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={Colors.status.info}
              />
              {allDutyLeaves.length > 0 && (
                <View className="ml-1 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-500">
                  <Text className="text-[10px] font-semibold text-white">
                    {allDutyLeaves.length}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => openModal({ type: "unknown-status" })}
              className="flex-row items-center p-2"
            >
              <Ionicons
                name="help-circle-outline"
                size={20}
                color={Colors.status.unknown}
              />
              {unknownCount > 0 && (
                <View
                  className="ml-1 h-[18px] min-w-[18px] items-center justify-center rounded-full"
                  style={{ backgroundColor: Colors.status.unknown }}
                >
                  <Text className="text-[10px] font-semibold text-white">
                    {unknownCount}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push("/settings")}
              className="p-2"
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {/* Tab Switcher */}
        <View
          className="flex-row rounded-[12px] p-1"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <Pressable
            onPress={() => handleTabChange("absences")}
            className="flex-1 flex-row items-center justify-center gap-1 rounded-[8px] py-2"
            style={activeTab === "absences" ? { backgroundColor: theme.background } : undefined}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={
                activeTab === "absences" ? theme.text : theme.textSecondary
              }
            />
            <Text
              className="text-[13px] font-medium"
              style={{
                color: activeTab === "absences" ? theme.text : theme.textSecondary,
              }}
            >
              All Bunks
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleTabChange("courses")}
            className="flex-1 flex-row items-center justify-center gap-1 rounded-[8px] py-2"
            style={activeTab === "courses" ? { backgroundColor: theme.background } : undefined}
          >
            <Ionicons
              name="list"
              size={16}
              color={activeTab === "courses" ? theme.text : theme.textSecondary}
            />
            <Text
              className="text-[13px] font-medium"
              style={{
                color: activeTab === "courses" ? theme.text : theme.textSecondary,
              }}
            >
              Courses
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Tab Content */}
      {activeTab === "absences" ? <AllBunksContent /> : <CoursesContent />}

      {/* FAB - Only on Courses tab */}
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
                icon: "history",
                label: "Changes",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                onPress: () => openModal({ type: "changes" }),
              },
              {
                icon: "pencil",
                label: isEditMode ? "Done Editing" : "Edit Courses",
                color: isEditMode ? Colors.white : theme.text,
                style: {
                  backgroundColor: isEditMode
                    ? Colors.status.info
                    : theme.backgroundSecondary,
                },
                onPress: handleToggleEditMode,
              },
              {
                icon: "plus",
                label: "Add Course",
                color: Colors.white,
                style: { backgroundColor: Colors.status.success },
                onPress: handleOpenCreateCourse,
              },
            ]}
            onStateChange={({ open }) => setShowFabMenu(open)}
            onPress={() => {
              if (showFabMenu)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        </Portal>
      )}
    </Container>
  );
}
