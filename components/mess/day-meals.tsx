import { Colors } from "@/constants/theme";
import { MEAL_COLORS, getMenuForDay, type MealType } from "@/data/mess";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Text, View } from "react-native";

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
        className="items-center justify-center rounded-2xl px-8 py-8 gap-2"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        <Ionicons
          name="restaurant-outline"
          size={32}
          color={theme.textSecondary}
        />
        <Text className="text-sm" style={{ color: theme.textSecondary }}>
          No menu available
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2 pt-1">
      {dayMenu.meals.map((meal, index) => {
        const mealColor = MEAL_COLORS[meal.type];
        const isNow =
          isToday &&
          currentTime >= meal.startTime &&
          currentTime < meal.endTime;
        const isPast = isToday && currentTime >= meal.endTime;

        return (
          <View
            key={meal.type}
            className="flex-row items-start min-h-[100px]"
            style={index === 0 ? { marginTop: 4 } : undefined}
          >
            {/* time column */}
            <View className="w-14 items-end pr-2 pt-0.5">
              <Text
                className="text-[10px] font-medium"
                style={{ color: isPast ? theme.textSecondary : theme.text }}
              >
                {formatTime(meal.startTime)}
              </Text>
              <Text className="text-[10px]" style={{ color: theme.textSecondary }}>
                -
              </Text>
              <Text className="text-[10px] font-medium" style={{ color: theme.textSecondary }}>
                {formatTime(meal.endTime)}
              </Text>
            </View>

            {/* timeline indicator */}
            <View className="w-6 items-center">
              <View
                className="mt-1 h-2.5 w-2.5 rounded-full"
                style={[
                  {
                    backgroundColor: isNow ? Colors.status.success : mealColor,
                  },
                  isPast && { opacity: 0.4 },
                ]}
              />
              {index < dayMenu.meals.length - 1 && (
                <View
                  className="mt-1 w-0.5 flex-1"
                  style={{ backgroundColor: theme.border }}
                />
              )}
            </View>

            {/* meal card */}
            <View
              className="ml-1.5 flex-1 rounded-xl p-4"
              style={[
                { backgroundColor: mealColor + (isPast ? "30" : "20") },
                { borderLeftColor: mealColor, borderLeftWidth: 3 },
                isNow && { borderWidth: 1, borderColor: Colors.status.success },
                !isNow && { borderWidth: 1, borderColor: theme.border },
              ]}
            >
              <View className="mb-2 flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={MEAL_ICONS[meal.type]}
                    size={18}
                    color={isPast ? theme.textSecondary : theme.text}
                  />
                  <Text
                    className="text-[15px] font-semibold"
                    style={{ color: isPast ? theme.textSecondary : theme.text }}
                  >
                    {meal.name}
                  </Text>
                </View>
                {isNow && (
                  <View
                    className="rounded-lg px-1 py-0.5"
                    style={{ backgroundColor: Colors.status.success }}
                  >
                    <Text className="text-[9px] font-bold text-white">NOW</Text>
                  </View>
                )}
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {meal.items.map((item, i) => (
                  <View
                    key={i}
                    className="rounded-lg px-2 py-1"
                    style={{ backgroundColor: theme.backgroundSecondary }}
                  >
                    <Text
                      className="text-[11px]"
                      style={{ color: isPast ? theme.textSecondary : theme.text }}
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
