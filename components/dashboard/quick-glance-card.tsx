import { Colors } from "@/constants/theme";
import { MEAL_COLORS, type Meal } from "@/data/mess";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatTimeDisplay } from "@/stores/timetable-store";
import type { TimetableSlot } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

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
        className="mx-1 flex-1 rounded-xl border p-3"
        style={{
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        }}
        onPress={onPress}
      >
        <View className="flex-1 items-center justify-center py-6">
          <Ionicons
            name={type === "class" ? "calendar-outline" : "restaurant-outline"}
            size={24}
            color={theme.textSecondary}
          />
          <Text className="mt-2 text-sm" style={{ color: theme.textSecondary }}>
            {type === "class" ? "No classes today" : "No meals scheduled"}
          </Text>
        </View>
      </Pressable>
    );
  }

  const isClass = type === "class";
  const classData = isClass ? (data as TimetableSlot) : null;
  const mealData = !isClass ? (data as Meal) : null;
  const mealAccentColor = mealData ? MEAL_COLORS[mealData.type] : Colors.status.success;
  const accentColor = isClass ? Colors.status.info : mealAccentColor;

  return (
    <Pressable
      className="mx-1 flex-1 rounded-xl border p-3"
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: theme.border,
        borderLeftWidth: 2,
        borderLeftColor: accentColor,
      }}
      onPress={onPress}
    >
      <View className="mb-1 flex-row items-center">
        <View
          className="mr-2 h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: accentColor + "20",
          }}
        >
          <Ionicons
            name={isClass ? "time" : "restaurant-outline"}
            size={20}
            color={accentColor}
          />
        </View>
        <Text className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>
          {isActive ? "Now" : isClass ? "Up Next" : "Next Meal"}
        </Text>
      </View>

      <Text className="mb-1 text-[15px] font-semibold" style={{ color: theme.text }} numberOfLines={1}>
        {isClass ? classData?.courseName : mealData?.name}
      </Text>

      {isClass ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="time" size={14} color={theme.textSecondary} />
          <View className="gap-0.5">
            <Text className="text-xs" style={{ color: theme.textSecondary }}>
              {formatTimeDisplay(classData!.startTime)}
            </Text>
            <Text className="text-xs" style={{ color: theme.textSecondary }}>
              {formatTimeDisplay(classData!.endTime)}
            </Text>
          </View>
        </View>
      ) : (
        <Text
          className="text-xs leading-4"
          style={{ color: theme.textSecondary }}
          numberOfLines={2}
        >
          {mealData?.items.slice(0, 4).join(" • ") || "Menu not available"}
        </Text>
      )}
    </Pressable>
  );
}
