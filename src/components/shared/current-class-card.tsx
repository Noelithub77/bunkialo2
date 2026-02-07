import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import { formatTimeDisplay, getDayName } from "@/stores/timetable-store";
import type { TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
        style={[
          styles.emptyCard,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Ionicons name="moon-outline" size={32} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
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
      style={styles.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* status indicator */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isCurrentlyActive
                ? Colors.status.success
                : Colors.status.warning,
            },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            {
              color: isCurrentlyActive
                ? Colors.status.success
                : Colors.status.warning,
            },
          ]}
        >
          {isCurrentlyActive ? "Now" : "Next"}
        </Text>
        {!isCurrentlyActive &&
          displayClass.dayOfWeek !== new Date().getDay() && (
            <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>
              {getDayName(displayClass.dayOfWeek)}
            </Text>
          )}
      </View>

      {/* course name */}
      <Text
        style={[styles.courseName, { color: theme.text }]}
        numberOfLines={2}
      >
        {displayClass.courseName}
      </Text>

      {/* time info */}
      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={[styles.timeValue, { color: theme.text }]}>
            {formatTimeDisplay(displayClass.startTime)}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
            Start
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={theme.textSecondary} />
        <View style={styles.timeBlock}>
          <Text style={[styles.timeValue, { color: theme.text }]}>
            {formatTimeDisplay(displayClass.endTime)}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>
            End
          </Text>
        </View>
        <View style={[styles.countdown, { backgroundColor: courseColor }]}>
          <Text style={styles.countdownText}>{timeRemaining}</Text>
        </View>
      </View>

      {/* session type */}
      <View style={styles.sessionTypeRow}>
        <View
          style={[
            styles.sessionTypeBadge,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Text
            style={[styles.sessionTypeText, { color: theme.textSecondary }]}
          >
            {displayClass.sessionType.charAt(0).toUpperCase() +
              displayClass.sessionType.slice(1)}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dayLabel: {
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  courseName: {
    fontSize: 20,
    fontWeight: "700",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  timeBlock: {
    alignItems: "center",
  },
  timeValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  timeLabel: {
    fontSize: 10,
  },
  countdown: {
    marginLeft: "auto",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  countdownText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  sessionTypeRow: {
    marginTop: Spacing.xs,
  },
  sessionTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  sessionTypeText: {
    fontSize: 11,
  },
});
