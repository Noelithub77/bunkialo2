import { DesktopPluginSection } from "@/components/settings/desktop-plugin-section";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DesktopPairingScreen() {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center px-4 py-3">
          <Pressable onPress={() => router.back()} className="p-2">
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-semibold" style={{ color: theme.text }}>
            Bunkialo pairing
          </Text>
          <View className="w-10" />
        </View>
        <ScrollView contentContainerClassName="mx-auto w-full max-w-2xl px-6 pb-12">
          <View className="mb-8 mt-8 flex-row items-center gap-3">
            <Ionicons name="desktop-outline" size={28} color={theme.text} />
            <Text className="text-3xl font-bold" style={{ color: theme.text }}>
              Pair desktop
            </Text>
          </View>
          <DesktopPluginSection theme={theme} autoCreate />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
