import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { DayOfWeek } from "@/types";
import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";

interface DaySelectorProps {
  selectedDay: DayOfWeek;
  onSelect: (day: DayOfWeek) => void;
}

const DAYS: { day: DayOfWeek; label: string }[] = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
];

export function DaySelector({ selectedDay, onSelect }: DaySelectorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const handleSelect = (day: DayOfWeek) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(day);
  };

  return (
    <View className="flex-row gap-2 py-2">
      {DAYS.map(({ day, label }) => {
        const isSelected = day === selectedDay;
        const isToday = day === new Date().getDay();

        return (
          <Pressable
            key={day}
            onPress={() => handleSelect(day)}
            className="flex-1 items-center rounded-xl py-2"
            style={[
              {
                backgroundColor: isSelected
                  ? theme.text
                  : theme.backgroundSecondary,
              },
              isToday &&
                !isSelected && { borderColor: theme.text, borderWidth: 1 },
            ]}
          >
            <Text
              className="text-[13px] font-semibold"
              style={[
                { color: isSelected ? theme.background : theme.text },
                !isSelected && !isToday && { color: theme.textSecondary },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
