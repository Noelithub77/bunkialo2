import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { lazy, Suspense } from "react";
import { ActivityIndicator, Text, View } from "react-native";

const WifixScreen = lazy(() => import("@/screens/wifix-screen"));

const WifixFallback = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  return (
    <Container>
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator size="large" color={theme.text} />
        <Text className="text-sm font-medium" style={{ color: theme.textSecondary }}>
          Loading WiFi tools...
        </Text>
      </View>
    </Container>
  );
};

export default function WifixRoute() {
  return (
    <Suspense fallback={<WifixFallback />}>
      <WifixScreen />
    </Suspense>
  );
}
