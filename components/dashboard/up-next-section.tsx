import { Spacing } from "@/constants/theme";
import { getCurrentMeal } from "@/data/mess";
import {
    getCurrentAndNextClass,
    useTimetableStore,
} from "@/stores/timetable-store";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { QuickGlanceCard } from "./quick-glance-card";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
});

export function UpNextSection() {
  const { slots } = useTimetableStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  const updateTime = useCallback(() => {
    setCurrentTime(new Date());
  }, []);

  // Auto-refresh every minute
  useEffect(() => {
    const interval = setInterval(updateTime, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [updateTime]);

  // Calculate next class and meal
  const { currentClass, nextClass } = useMemo(
    () => getCurrentAndNextClass(slots, currentTime),
    [slots, currentTime],
  );
  const { current: currentMeal, next: nextMeal } = useMemo(
    () => getCurrentMeal(currentTime),
    [currentTime],
  );

  const classToShow = currentClass ?? nextClass;
  const mealToShow = currentMeal ?? nextMeal;

  const handleClassPress = () => {
    router.push("/(tabs)/timetable");
  };

  const handleMealPress = () => {
    router.push("/(tabs)/mess");
  };

  return (
    <View style={styles.container}>
      <QuickGlanceCard
        type="class"
        data={classToShow}
        isActive={Boolean(currentClass)}
        onPress={handleClassPress}
      />
      <QuickGlanceCard
        type="meal"
        data={mealToShow}
        isActive={Boolean(currentMeal)}
        onPress={handleMealPress}
      />
    </View>
  );
}
