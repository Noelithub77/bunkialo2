import { DayMeals } from "@/components/day-meals";
import { MealCarousel } from "@/components/meal-carousel";
import { MealDaySelector } from "@/components/meal-day-selector";
import { Container } from "@/components/ui/container";
import { Colors, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
        style={styles.scrollView}
        contentContainerStyle={styles.content}
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
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>
            Mess Menu
          </Text>
        </View>

        {/* up next carousel */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Up Next
        </Text>
        <MealCarousel />

        {/* day schedule */}
        <View style={styles.scheduleSection}>
          <Text
            style={[styles.sectionTitle, { color: theme.text, marginTop: 0 }]}
          >
            Today's Menu
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

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  scheduleSection: {
    marginTop: Spacing.lg,
  },
});
