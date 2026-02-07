import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { lazy, Suspense } from "react";
import { ActivityIndicator, Text, View } from "react-native";

const GpaCalculatorScreen = lazy(() => import("@/screens/gpa-screen"));

const GpaFallback = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  return (
    <Container>
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator size="large" color={theme.text} />
        <Text
          className="text-[14px] font-medium"
          style={{ color: theme.textSecondary }}
        >
          Loading GPA calculator...
        </Text>
      </View>
    </Container>
  );
};

export default function GpaCalculatorRoute() {
  return (
    <Suspense fallback={<GpaFallback />}>
      <GpaCalculatorScreen />
    </Suspense>
  );
}
