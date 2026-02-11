import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { lazy, Suspense } from "react";
import { ActivityIndicator, Text, View } from "react-native";

const AcademicCalendarScreen = lazy(() => import("@/screens/acad-cal-screen"));

const CalendarFallback = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  return (
    <Container>
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator size="large" color={theme.text} />
        <Text className="text-sm font-medium" style={{ color: theme.textSecondary }}>
          Loading calendar...
        </Text>
      </View>
    </Container>
  );
};

export default function AcademicCalendarRoute() {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <AcademicCalendarScreen />
    </Suspense>
  );
}
