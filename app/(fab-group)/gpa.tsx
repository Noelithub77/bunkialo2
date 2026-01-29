import { Container } from "@/components/ui/container";
import { Colors, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { lazy, Suspense } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const GpaCalculatorScreen = lazy(() => import("@/screens/gpa-screen"));

const GpaFallback = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  return (
    <Container>
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
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

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
