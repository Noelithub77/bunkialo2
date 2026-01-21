import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Meal } from "@/data/mess";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatTimeDisplay } from "@/stores/timetable-store";
import type { TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface QuickGlanceCardProps {
  type: "class" | "meal";
  data: TimetableSlot | Meal | null;
  isActive: boolean;
  onPress: () => void;
}

export function QuickGlanceCard({
  type,
  data,
  isActive,
  onPress,
}: QuickGlanceCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  if (!data) {
    return (
      <Pressable
        style={[
          styles.card,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
          },
        ]}
        onPress={onPress}
      >
        <View style={styles.emptyContent}>
          <Ionicons
            name={type === "class" ? "calendar-outline" : "restaurant-outline"}
            size={24}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {type === "class" ? "No classes today" : "No meals scheduled"}
          </Text>
        </View>
      </Pressable>
    );
  }

  const isClass = type === "class";
  const classData = isClass ? (data as TimetableSlot) : null;
  const mealData = !isClass ? (data as Meal) : null;

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isClass
                ? Colors.status.info + "20"
                : Colors.status.success + "20",
            },
          ]}
        >
          <Ionicons
            name={isClass ? "time" : "restaurant-outline"}
            size={20}
            color={isClass ? Colors.status.info : Colors.status.success}
          />
        </View>
        <Text style={[styles.type, { color: theme.textSecondary }]}>
          {isActive ? "Now" : isClass ? "Up Next" : "Next Meal"}
        </Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {isClass ? classData?.courseName : mealData?.name}
      </Text>

      <View style={styles.timeRow}>
        <Ionicons name="time" size={14} color={theme.textSecondary} />
        <Text style={[styles.timeText, { color: theme.textSecondary }]}>
          {isClass
            ? `${formatTimeDisplay(classData!.startTime)} - ${formatTimeDisplay(classData!.endTime)}`
            : `${formatTimeDisplay(mealData!.startTime)} - ${formatTimeDisplay(mealData!.endTime)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginHorizontal: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  type: {
    fontSize: 12,
    fontWeight: "500",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    fontSize: 13,
  },
  emptyContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
});
