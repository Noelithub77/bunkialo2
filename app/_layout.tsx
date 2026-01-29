import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/auth-store";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider, Portal } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import "react-native-reanimated";

// Custom dark theme with black background
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.black,
    card: Colors.gray[900],
    border: Colors.gray[800],
  },
};

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.white,
    card: Colors.white,
    border: Colors.gray[200],
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isLoggedIn, isCheckingAuth, isOffline, checkAuth } = useAuthStore();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isCheckingAuth) {
      if (isLoggedIn) {
        router.replace("/(tabs)");
      } else {
        router.replace("/login");
      }
    }
  }, [isCheckingAuth, isLoggedIn]);

  if (isCheckingAuth) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: isDark ? Colors.black : Colors.white },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={isDark ? Colors.white : Colors.black}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider
        settings={{
          icon: (props) => <MaterialCommunityIcons {...props} />,
        }}
      >
        <ThemeProvider value={isDark ? CustomDarkTheme : CustomLightTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="faculty/[id]" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="(fab-group)/gpa"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="(fab-group)/acad-cal"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="(fab-group)/wifix"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
                gestureEnabled: true,
                fullScreenGestureEnabled: true,
              }}
            />
          </Stack>
          <StatusBar style={isDark ? "light" : "dark"} />
        </ThemeProvider>
        <Portal>
          {isOffline && isLoggedIn && (
            <View
              style={[
                styles.offlineBanner,
                {
                  top: insets.top + 10,
                  backgroundColor: isDark ? Colors.gray[900] : Colors.gray[100],
                  borderColor: Colors.status.warning,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="cloud-off-outline"
                size={14}
                color={Colors.status.warning}
              />
              <Text
                style={[
                  styles.offlineText,
                  { color: isDark ? Colors.gray[100] : Colors.gray[800] },
                ]}
              >
                Offline - showing cached data
              </Text>
            </View>
          )}
        </Portal>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  offlineBanner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
