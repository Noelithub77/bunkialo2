import { DayMeals } from "@/components/mess/day-meals";
import { MealCarousel } from "@/components/mess/meal-carousel";
import { MealDaySelector } from "@/components/mess/meal-day-selector";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

export default function MessScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [refreshing, setRefreshing] = useState(false);

  // default to today
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());

  const handleRefresh = () => {
    setRefreshing(true);
    // just a visual refresh, data is static
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <Container>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.text}
          />
        }
      >
        {/* header */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[28px] font-bold" style={{ color: theme.text }}>
            Mess Menu
          </Text>
        </View>

        {/* up next carousel */}
        <Text className="text-base font-semibold mt-6 mb-2" style={{ color: theme.text }}>
          Up Next
        </Text>
        <MealCarousel />

        {/* day schedule */}
        <View className="mt-6">
          <Text
            className="text-base font-semibold"
            style={{ color: theme.text }}
          >
            Today&apos;s Menu
          </Text>
          <MealDaySelector
            selectedDay={selectedDay}
            onSelect={setSelectedDay}
          />
          <DayMeals selectedDay={selectedDay} />
        </View>
      </ScrollView>
    </Container>
  );
}
