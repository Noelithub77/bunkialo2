import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import { formatTimeDisplay } from "@/stores/timetable-store";
import type { DayOfWeek, TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { Text, View } from "react-native";

interface DayScheduleProps {
  slots: TimetableSlot[];
  selectedDay: DayOfWeek;
}

export function DaySchedule({ slots, selectedDay }: DayScheduleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const bunkCourses = useBunkStore((state) => state.courses);

  const getCourseColor = (courseId: string): string => {
    const course = bunkCourses.find((c) => c.courseId === courseId);
    return course?.config?.color || Colors.courseColors[0];
  };

  const getSlotGradient = (courseColor: string, isPast: boolean) => {
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
    return slots
      .filter((s) => s.dayOfWeek === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
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
    <View className="gap-1 pt-1">
      {daySlots.map((slot, index) => {
        const courseColor = getCourseColor(slot.courseId);
        const isNow =
          isToday &&
          currentTime >= slot.startTime &&
          currentTime < slot.endTime;
        const isPast = isToday && currentTime >= slot.endTime;
        const sessionLabel =
          slot.sessionType.charAt(0).toUpperCase() + slot.sessionType.slice(1);

        return (
          <View
            key={slot.id}
            className="flex-row items-start min-h-[66px]"
            style={index === 0 ? { marginTop: 2 } : undefined}
          >
            {/* time column */}
            <View className="w-14 items-end pr-2 pt-0.5">
              <Text
                className="text-[11px] font-medium"
                style={{ color: isPast ? theme.textSecondary : theme.text }}
              >
                {formatTimeDisplay(slot.startTime)}
              </Text>
              <Text className="text-[10px]" style={{ color: theme.textSecondary }}>
                -
              </Text>
              <Text
                className="text-[11px] font-medium"
                style={{ color: isPast ? theme.textSecondary : theme.textSecondary }}
              >
                {formatTimeDisplay(slot.endTime)}
              </Text>
            </View>

            {/* timeline indicator */}
            <View className="w-5 items-center">
              <View
                className="mt-1 h-2.5 w-2.5 rounded-full"
                style={[
                  {
                    backgroundColor: isNow
                      ? Colors.status.success
                      : courseColor,
                  },
                  isPast && { opacity: 0.4 },
                ]}
              />
              {index < daySlots.length - 1 && (
                <View
                  className="mt-0.5 w-0.5 flex-1"
                  style={{ backgroundColor: theme.border }}
                />
              )}
            </View>

            {/* slot card */}
            <View
              className="ml-1 flex-1 overflow-hidden rounded-xl"
              style={[
                { borderLeftColor: courseColor, borderLeftWidth: 3 },
                isNow && { borderWidth: 1, borderColor: Colors.status.success },
                !isNow && { borderWidth: 1, borderColor: theme.border },
                isNow && isDark && { shadowColor: courseColor, shadowOpacity: 0.35, shadowRadius: 10 },
              ]}
            >
              <LinearGradient
                colors={getSlotGradient(courseColor, isPast)}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="px-3 py-2.5"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    className="flex-1 text-sm font-semibold"
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
                <View className="mt-1">
                  <View className="flex-row flex-wrap items-center gap-1">
                    <View
                      className="rounded-lg px-2 py-0.5"
                      style={{ backgroundColor: theme.backgroundSecondary + "DD" }}
                    >
                      <Text
                        className="text-[10px]"
                        style={{ color: theme.textSecondary }}
                      >
                        {sessionLabel}
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
              </LinearGradient>
            </View>
          </View>
        );
      })}
    </View>
  );
}
