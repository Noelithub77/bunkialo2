import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import { formatTimeDisplay } from "@/stores/timetable-store";
import type { DayOfWeek, TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
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
    <View className="gap-2 pt-1">
      {daySlots.map((slot, index) => {
        const courseColor = getCourseColor(slot.courseId);
        const isNow =
          isToday &&
          currentTime >= slot.startTime &&
          currentTime < slot.endTime;
        const isPast = isToday && currentTime >= slot.endTime;

        return (
          <View
            key={slot.id}
            className="flex-row items-start min-h-[72px]"
            style={index === 0 ? { marginTop: 4 } : undefined}
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
            <View className="w-6 items-center">
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
                  className="mt-1 w-0.5 flex-1"
                  style={{ backgroundColor: theme.border }}
                />
              )}
            </View>

            {/* slot card */}
            <View
              className="ml-1.5 flex-1 rounded-xl p-4"
              style={[
                { backgroundColor: courseColor + (isPast ? "30" : "20") },
                { borderLeftColor: courseColor, borderLeftWidth: 3 },
                isNow && { borderWidth: 1, borderColor: Colors.status.success },
                !isNow && { borderWidth: 1, borderColor: theme.border },
              ]}
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
                    className="rounded-lg px-1 py-0.5"
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
                    style={{ backgroundColor: theme.backgroundSecondary }}
                  >
                    <Text
                      className="text-[10px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {slot.sessionType.charAt(0).toUpperCase() +
                        slot.sessionType.slice(1)}
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
            </View>
          </View>
        );
      })}
    </View>
  );
}
