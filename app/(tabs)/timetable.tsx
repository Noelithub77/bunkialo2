import { DaySchedule } from "@/components/timetable/day-schedule";
import { DaySelector } from "@/components/timetable/day-selector";
import { TimetableExportModal } from "@/components/timetable/timetable-export-modal";
import { UpNextCarousel } from "@/components/timetable/upnext-carousel";
import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { Colors, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useTimetableStore } from "@/stores/timetable-store";
import type { DayOfWeek } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FAB, Portal } from "react-native-paper";

export default function TimetableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { slots, lastGeneratedAt, isLoading, generateTimetable } =
    useTimetableStore();
  const {
    courses: attendanceCourses,
    fetchAttendance,
    isLoading: isAttendanceLoading,
  } = useAttendanceStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showTimetableExport, setShowTimetableExport] = useState(false);
  const hasGenerated = useRef(false);
  const isFocused = useIsFocused();

  // recompute day on focus
  const getDefaultDay = (): DayOfWeek => {
    const day = new Date().getDay() as DayOfWeek;
    return day >= 1 && day <= 5 ? day : 1;
  };
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getDefaultDay);

  useFocusEffect(
    useCallback(() => {
      setSelectedDay(getDefaultDay());
      return () => setShowFabMenu(false);
    }, []),
  );

  // generate timetable on first load
  useEffect(() => {
    if (
      !hasGenerated.current &&
      attendanceCourses.length > 0 &&
      slots.length === 0
    ) {
      const task = InteractionManager.runAfterInteractions(() => {
        generateTimetable();
        hasGenerated.current = true;
      });
      return () => task.cancel();
    }
    return undefined;
  }, [attendanceCourses.length, generateTimetable, slots.length]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchAttendance();
    generateTimetable();
    setRefreshing(false);
  }, [fetchAttendance, generateTimetable]);

  const handleRegenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    generateTimetable();
  };

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
        style={styles.scrollView}
        contentContainerStyle={styles.content}
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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.screenTitle, { color: theme.text }]}>
              Timetable
            </Text>
            {lastGeneratedAt && (
              <View style={styles.syncPill}>
                <Ionicons
                  name="refresh-outline"
                  size={12}
                  color={theme.textSecondary}
                />
                <Text style={[styles.syncText, { color: theme.textSecondary }]}>
                  {formatLastGenerated(lastGeneratedAt)}
                </Text>
              </View>
            )}
          </View>
          <Pressable onPress={handleRegenerate} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* loading state */}
        {isLoading && slots.length === 0 && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.text} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Generating timetable...
            </Text>
          </View>
        )}

        {/* empty state */}
        {!isLoading && slots.length === 0 && (
          <GradientCard>
            <View style={styles.empty}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                No timetable yet
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Pull to refresh to fetch attendance data and generate your
                timetable.
              </Text>
            </View>
          </GradientCard>
        )}

        {/* main content */}
        {slots.length > 0 && (
          <>
            {/* up next carousel */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Up Next
            </Text>
            <UpNextCarousel slots={slots} />

            {/* day schedule */}
            <View style={styles.scheduleSection}>
              <View style={styles.scheduleHeader}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.text, marginTop: 0, marginBottom: 0 },
                  ]}
                >
                  Schedule
                </Text>
              </View>
              <DaySelector
                selectedDay={selectedDay}
                onSelect={setSelectedDay}
              />
              <DaySchedule slots={slots} selectedDay={selectedDay} />
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
            ]}
            onStateChange={({ open }) => setShowFabMenu(open)}
          />
        </Portal>
      )}

      <TimetableExportModal
        visible={showTimetableExport}
        onClose={() => setShowTimetableExport(false)}
        slots={slots}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexShrink: 1,
    rowGap: 2,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: Spacing.xs,
  },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  syncText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  loading: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  scheduleSection: {
    marginTop: Spacing.lg,
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
