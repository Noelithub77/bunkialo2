import { AllBunksContent } from "@/components/attendance/sub_tabs/all-bunks-content";
import { CoursesContent } from "@/components/attendance/sub_tabs/courses-content";
import { Container } from "@/components/ui/container";
import { Colors, Radius, Spacing } from "@/constants/theme";
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
import {
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={[styles.screenTitle, { color: theme.text }]}>
              Attendance
            </Text>
            {lastSyncTime && (
              <Pressable
                onPressIn={() => setShowTooltip(true)}
                onPressOut={() => setShowTooltip(false)}
                style={styles.headerRight}
                hitSlop={8}
              >
                <Ionicons
                  name="refresh-outline"
                  size={12}
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
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => openModal({ type: "duty-leave-list" })}
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
              onPress={() => openModal({ type: "unknown-status" })}
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

        {/* Tab Switcher */}
        <View
          style={[
            styles.tabBar,
            { backgroundColor: theme.backgroundSecondary },
          ]}
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
              color={
                activeTab === "absences" ? theme.text : theme.textSecondary
              }
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

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerTitle: {
    flexShrink: 1,
    minWidth: "40%",
    rowGap: 2,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: Spacing.xs,
    rowGap: Spacing.xs,
    minWidth: "45%",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    position: "relative",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  syncTime: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.2,
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
});
