import { DaySchedule } from "@/components/timetable/day-schedule";
import { DaySelector } from "@/components/timetable/day-selector";
import { TimetableExportModal } from "@/components/timetable/timetable-export-modal";
import { UpNextCarousel } from "@/components/timetable/upnext-carousel";
import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { Colors } from "@/constants/theme";
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
  Text,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
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
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-shrink gap-0.5">
            <Text className="text-[28px] font-bold" style={{ color: theme.text }}>
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
          <Pressable onPress={handleRegenerate} className="p-1">
            <Ionicons name="refresh" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>

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
        {!isLoading && slots.length === 0 && (
          <GradientCard>
            <View className="items-center py-6 gap-2">
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.textSecondary}
              />
              <Text className="text-lg font-semibold" style={{ color: theme.text }}>
                No timetable yet
              </Text>
              <Text className="text-sm text-center" style={{ color: theme.textSecondary }}>
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
            <View className="mt-6">
              <Text className="text-base font-semibold mb-2" style={{ color: theme.text }}>
                Up Next
              </Text>
              <UpNextCarousel slots={slots} />
            </View>

            {/* day schedule */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-base font-semibold"
                  style={{ color: theme.text }}
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
