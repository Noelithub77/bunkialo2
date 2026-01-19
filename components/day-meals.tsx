import { Colors, Radius, Spacing } from "@/constants/theme";
import { MEAL_COLORS, getMenuForDay, type MealType } from "@/data/mess";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface DayMealsProps {
  selectedDay: number;
}

const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: "sunny-outline",
  lunch: "restaurant-outline",
  snacks: "cafe-outline",
  dinner: "moon-outline",
};

export function DayMeals({ selectedDay }: DayMealsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const dayMenu = useMemo(() => getMenuForDay(selectedDay), [selectedDay]);

  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const isToday = selectedDay === currentDay;

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  if (!dayMenu) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Ionicons
          name="restaurant-outline"
          size={32}
          color={theme.textSecondary}
        />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No menu available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {dayMenu.meals.map((meal, index) => {
        const mealColor = MEAL_COLORS[meal.type];
        const isNow =
          isToday &&
          currentTime >= meal.startTime &&
          currentTime < meal.endTime;
        const isPast = isToday && currentTime >= meal.endTime;

        return (
          <View key={meal.type} style={styles.mealRow}>
            {/* time column */}
            <View style={styles.timeColumn}>
              <Text
                style={[
                  styles.timeText,
                  { color: isPast ? theme.textSecondary : theme.text },
                ]}
              >
                {formatTime(meal.startTime)}
              </Text>
              <Text style={[styles.timeDash, { color: theme.textSecondary }]}>
                -
              </Text>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                {formatTime(meal.endTime)}
              </Text>
            </View>

            {/* timeline indicator */}
            <View style={styles.timeline}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor: isNow ? Colors.status.success : mealColor,
                  },
                  isPast && { opacity: 0.4 },
                ]}
              />
              {index < dayMenu.meals.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    { backgroundColor: theme.border },
                  ]}
                />
              )}
            </View>

            {/* meal card */}
            <View
              style={[
                styles.mealCard,
                { backgroundColor: mealColor + (isPast ? "30" : "20") },
                { borderLeftColor: mealColor, borderLeftWidth: 3 },
                isNow && styles.nowCard,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.titleRow}>
                  <Ionicons
                    name={MEAL_ICONS[meal.type]}
                    size={18}
                    color={isPast ? theme.textSecondary : theme.text}
                  />
                  <Text
                    style={[
                      styles.mealName,
                      { color: isPast ? theme.textSecondary : theme.text },
                    ]}
                  >
                    {meal.name}
                  </Text>
                </View>
                {isNow && (
                  <View
                    style={[
                      styles.nowBadge,
                      { backgroundColor: Colors.status.success },
                    ]}
                  >
                    <Text style={styles.nowText}>NOW</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemsContainer}>
                {meal.items.map((item, i) => (
                  <View
                    key={i}
                    style={[
                      styles.itemChip,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        { color: isPast ? theme.textSecondary : theme.text },
                      ]}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  emptyContainer: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 100,
  },
  timeColumn: {
    width: 56,
    alignItems: "flex-end",
    paddingRight: Spacing.sm,
    paddingTop: 2,
  },
  timeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  timeDash: {
    fontSize: 10,
  },
  timeline: {
    width: 20,
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  mealCard: {
    flex: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginLeft: Spacing.sm,
  },
  nowCard: {
    borderWidth: 1,
    borderColor: Colors.status.success,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  mealName: {
    fontSize: 15,
    fontWeight: "600",
  },
  nowBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  nowText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.white,
  },
  itemsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  itemChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  itemText: {
    fontSize: 11,
  },
});
