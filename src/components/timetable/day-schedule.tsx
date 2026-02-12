import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import { formatTimeDisplay } from "@/stores/timetable-store";
import type { DayOfWeek, TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

interface DayScheduleProps {
  slots: TimetableSlot[];
  selectedDay: DayOfWeek;
  onCoursePress?: (courseId: string) => void;
}

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatBreakDuration = (gapMinutes: number): string => {
  if (gapMinutes < 60) {
    return `${gapMinutes}m`;
  }

  const hours = Math.floor(gapMinutes / 60);
  const minutes = gapMinutes % 60;
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
};

const getGapSpacing = (gapMinutes: number): number => {
  if (gapMinutes <= 5) return 3;
  if (gapMinutes <= 20) return 7;
  if (gapMinutes <= 60) return 11;
  return 16;
};

export function DaySchedule({
  slots,
  selectedDay,
  onCoursePress,
}: DayScheduleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const bunkCourses = useBunkStore((state) => state.courses);

  const getCourseColor = (courseId: string): string => {
    const course = bunkCourses.find((c) => c.courseId === courseId);
    return course?.config?.color || Colors.courseColors[0];
  };

  const getSlotGradient = (
    courseColor: string,
    isPast: boolean,
    isNow: boolean,
  ) => {
    if (isNow) {
      return isDark
        ? ([
            Colors.status.success + "2E",
            Colors.status.success + "14",
            "#05080D",
          ] as const)
        : ([
            Colors.status.success + "22",
            Colors.status.success + "10",
            "#FFFFFF",
          ] as const);
    }

    if (isDark) {
      return isPast
        ? ([courseColor + "1A", theme.backgroundSecondary, "#050505"] as const)
        : ([courseColor + "45", courseColor + "22", "#05080D"] as const);
    }

    return isPast
      ? ([courseColor + "12", "#FAFAFA", "#FFFFFF"] as const)
      : ([courseColor + "28", courseColor + "12", "#FFFFFF"] as const);
  };

  const daySlots = useMemo(() => {
    const sortedSlots = slots
      .filter((s) => s.dayOfWeek === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return sortedSlots.map((slot, index) => {
      const previousSlot = sortedSlots[index - 1];
      const gapMinutes = previousSlot
        ? Math.max(
            0,
            timeToMinutes(slot.startTime) - timeToMinutes(previousSlot.endTime),
          )
        : 0;

      return {
        slot,
        gapMinutes,
      };
    });
  }, [slots, selectedDay]);

  const now = new Date();
  const currentDay = now.getDay() as DayOfWeek;
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const isToday = selectedDay === currentDay;

  if (daySlots.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-2xl px-8 py-8 gap-2"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        <Ionicons name="cafe-outline" size={32} color={theme.textSecondary} />
        <Text className="text-sm" style={{ color: theme.textSecondary }}>
          No classes scheduled
        </Text>
      </View>
    );
  }

  return (
    <View className="pt-1">
      {daySlots.map(({ slot, gapMinutes }, index) => {
        const courseColor = getCourseColor(slot.courseId);
        const isNow =
          isToday &&
          currentTime >= slot.startTime &&
          currentTime < slot.endTime;
        const isPast = isToday && currentTime >= slot.endTime;
        const shouldShowBreak = index > 0 && gapMinutes >= 30;
        const rowTopSpacing =
          index === 0 ? 2 : shouldShowBreak ? 8 : getGapSpacing(gapMinutes);
        const sessionLabel =
          slot.sessionType.charAt(0).toUpperCase() + slot.sessionType.slice(1);

        return (
          <View key={slot.id}>
            {shouldShowBreak && (
              <View className="flex-row items-center" style={{ marginTop: 2 }}>
                <View className="w-[76px] items-end pr-3">
                  <Text
                    className="text-[10px] font-medium"
                    style={{ color: theme.textSecondary }}
                  >
                    Break
                  </Text>
                </View>
                <View className="flex-1 flex-row items-center">
                  <View
                    className="h-px flex-1"
                    style={{ backgroundColor: theme.border }}
                  />
                  <View
                    className="mx-2 rounded-full border px-2 py-0.5"
                    style={{
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                    }}
                  >
                    <Text
                      className="text-[10px] font-medium"
                      style={{ color: theme.textSecondary }}
                    >
                      {formatBreakDuration(gapMinutes)}
                    </Text>
                  </View>
                  <View
                    className="h-px flex-1"
                    style={{ backgroundColor: theme.border }}
                  />
                </View>
              </View>
            )}

            <View className="flex-row items-start" style={{ marginTop: rowTopSpacing }}>
              {/* time column */}
              <View className="w-[76px] items-end pr-3 pt-0.5">
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: isPast ? theme.textSecondary : theme.text }}
                >
                  {formatTimeDisplay(slot.startTime)}
                </Text>
                <Text
                  className="text-[11px]"
                  style={{ color: theme.textSecondary }}
                >
                  {formatTimeDisplay(slot.endTime)}
                </Text>
              </View>

              {/* slot card */}
              <Pressable
                className="ml-0.5 flex-1 overflow-hidden rounded-2xl"
                onPress={() => onCoursePress?.(slot.courseId)}
                disabled={!onCoursePress}
                style={({ pressed }) => [
                  {
                    borderLeftColor: isNow ? Colors.status.success : courseColor,
                    borderLeftWidth: 3,
                  },
                  isNow && {
                    borderWidth: 1,
                    borderColor: isDark
                      ? Colors.status.success + "B8"
                      : Colors.status.success + "85",
                  },
                  !isNow && { borderWidth: 1, borderColor: theme.border },
                  isNow &&
                    isDark && {
                      shadowColor: Colors.status.success,
                      shadowOpacity: 0.2,
                      shadowRadius: 9,
                    },
                  onCoursePress && pressed && { opacity: 0.86 },
                ]}
              >
                <LinearGradient
                  colors={getSlotGradient(courseColor, isPast, isNow)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                  }}
                />
                <View className="px-3.5 py-2.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      className="flex-1 text-[16px] font-semibold"
                      style={{ color: isPast ? theme.textSecondary : theme.text }}
                      numberOfLines={1}
                    >
                      {slot.courseName}
                    </Text>
                    {isNow && (
                      <View
                        className="rounded-lg px-1.5 py-0.5"
                        style={{ backgroundColor: Colors.status.success }}
                      >
                        <Text className="text-[9px] font-bold text-white">NOW</Text>
                      </View>
                    )}
                  </View>
                  <View className="mt-2 flex-row flex-wrap items-center gap-1">
                    <View
                      className="rounded-lg px-2 py-0.5"
                      style={{ backgroundColor: theme.backgroundSecondary + "DD" }}
                    >
                      <Text
                        className="text-[10px]"
                        style={{ color: theme.textSecondary }}
                      >
                        {sessionLabel}
                        {onCoursePress ? " · Tap to edit" : ""}
                      </Text>
                    </View>
                    {slot.isManual && (
                      <View
                        className="rounded px-1 py-0.5"
                        style={{ backgroundColor: Colors.status.info + "20" }}
                      >
                        <Text
                          className="text-[9px] font-medium"
                          style={{ color: Colors.status.info }}
                        >
                          Manual
                        </Text>
                      </View>
                    )}
                    {slot.isCustomCourse && (
                      <View
                        className="rounded px-1 py-0.5"
                        style={{ backgroundColor: Colors.status.success + "20" }}
                      >
                        <Text
                          className="text-[9px] font-medium"
                          style={{ color: Colors.status.success }}
                        >
                          Custom
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}
