import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import { formatTimeDisplay, getDayName } from "@/stores/timetable-store";
import type { TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

interface CurrentClassCardProps {
  currentClass: TimetableSlot | null;
  nextClass: TimetableSlot | null;
}

export function CurrentClassCard({
  currentClass,
  nextClass,
}: CurrentClassCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const bunkCourses = useBunkStore((state) => state.courses);
  const [timeRemaining, setTimeRemaining] = useState("");

  // get course color
  const getCourseColor = (courseId: string): string => {
    const course = bunkCourses.find((c) => c.courseId === courseId);
    return course?.config?.color || Colors.courseColors[0];
  };

  const displayClass = currentClass || nextClass;
  const isCurrentlyActive = !!currentClass;

  // calculate time remaining
  useEffect(() => {
    if (!displayClass) return;

    const updateTimer = () => {
      const now = new Date();
      const [hours, minutes] = (
        isCurrentlyActive ? displayClass.endTime : displayClass.startTime
      )
        .split(":")
        .map(Number);

      let targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);

      // if next class is on a different day
      if (!isCurrentlyActive && displayClass.dayOfWeek !== now.getDay()) {
        const daysAhead = (displayClass.dayOfWeek - now.getDay() + 7) % 7 || 7;
        targetDate.setDate(targetDate.getDate() + daysAhead);
      }

      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeRemaining(isCurrentlyActive ? "Ending soon" : "Starting soon");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (h > 0) {
        setTimeRemaining(`${h}h ${m}m`);
      } else {
        setTimeRemaining(`${m}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [displayClass, isCurrentlyActive]);

  if (!displayClass) {
    return (
      <View
        className="items-center justify-center gap-2 rounded-2xl px-6 py-8"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        <Ionicons name="moon-outline" size={32} color={theme.textSecondary} />
        <Text className="text-sm" style={{ color: theme.textSecondary }}>
          No classes scheduled
        </Text>
      </View>
    );
  }

  const courseColor = getCourseColor(displayClass.courseId);
  const gradientColors = isDark
    ? ([courseColor + "40", courseColor + "20"] as const)
    : ([courseColor + "30", courseColor + "10"] as const);

  return (
    <LinearGradient
      colors={gradientColors}
      className="gap-2 rounded-2xl p-4"
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* status indicator */}
      <View className="flex-row items-center gap-1">
        <View
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: isCurrentlyActive
              ? Colors.status.success
              : Colors.status.warning,
          }}
        />
        <Text
          className="text-xs font-semibold uppercase"
          style={{
            color: isCurrentlyActive
              ? Colors.status.success
              : Colors.status.warning,
          }}
        >
          {isCurrentlyActive ? "Now" : "Next"}
        </Text>
        {!isCurrentlyActive &&
          displayClass.dayOfWeek !== new Date().getDay() && (
            <Text className="ml-1 text-xs" style={{ color: theme.textSecondary }}>
              {getDayName(displayClass.dayOfWeek)}
            </Text>
          )}
      </View>

      {/* course name */}
      <Text
        className="text-xl font-bold"
        style={{ color: theme.text }}
        numberOfLines={2}
      >
        {displayClass.courseName}
      </Text>

      {/* time info */}
      <View className="mt-2 flex-row items-center gap-4">
        <View className="items-center">
          <Text className="text-base font-semibold" style={{ color: theme.text }}>
            {formatTimeDisplay(displayClass.startTime)}
          </Text>
          <Text className="text-[10px]" style={{ color: theme.textSecondary }}>
            Start
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={theme.textSecondary} />
        <View className="items-center">
          <Text className="text-base font-semibold" style={{ color: theme.text }}>
            {formatTimeDisplay(displayClass.endTime)}
          </Text>
          <Text className="text-[10px]" style={{ color: theme.textSecondary }}>
            End
          </Text>
        </View>
        <View
          className="ml-auto rounded-full px-4 py-1"
          style={{ backgroundColor: courseColor }}
        >
          <Text className="text-sm font-semibold text-white">{timeRemaining}</Text>
        </View>
      </View>

      {/* session type */}
      <View className="mt-1">
        <View
          className="self-start rounded px-2 py-0.5"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <Text className="text-[11px]" style={{ color: theme.textSecondary }}>
            {displayClass.sessionType.charAt(0).toUpperCase() +
              displayClass.sessionType.slice(1)}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}
