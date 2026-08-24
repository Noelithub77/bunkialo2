import "react-native-reanimated";
import "../global.css";
import "@/background";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { ToastProviderWithViewport } from "@/components/shared/ui/molecules/toast";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  Stack,
  router,
  useGlobalSearchParams,
  usePathname,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider, Portal } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AttendanceSetupSheet } from "@/components/auth/attendance-setup-sheet";
import { AppSyncController } from "@/components/sync/app-sync-controller";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { DESKTOP_PAIRING_ROUTE } from "@/services/desktop-pairing";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
  const { hasHydrated: dashboardHydrated } = useDashboardStore();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ returnTo?: string }>();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });
  const splashHiddenRef = useRef(false);
  const fontsReady = fontsLoaded || Boolean(fontError);
  const appHydrated = dashboardHydrated;
  const isLeavingLogin = !isCheckingAuth && isLoggedIn && pathname === "/login";

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (
      process.env.EXPO_OS !== "web" ||
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    void navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // The app remains usable if the PWA worker is unavailable.
    });
  }, []);

  useEffect(() => {
    if (!isCheckingAuth) {
      const returnTo = params.returnTo === DESKTOP_PAIRING_ROUTE
        ? DESKTOP_PAIRING_ROUTE
        : "/(tabs)";
      const publicPath = pathname === "/login" || pathname === DESKTOP_PAIRING_ROUTE;
      if (isLoggedIn && pathname === "/login") {
        router.replace(returnTo as never);
      } else if (!isLoggedIn && !publicPath) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      } else if (!isLoggedIn && pathname === DESKTOP_PAIRING_ROUTE) {
        router.replace(`/login?returnTo=${encodeURIComponent(DESKTOP_PAIRING_ROUTE)}`);
      }
    }
  }, [isCheckingAuth, isLoggedIn, params.returnTo, pathname]);

  useEffect(() => {
    if (!fontsReady || isCheckingAuth || !appHydrated) return;
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => undefined);
  }, [appHydrated, fontsReady, isCheckingAuth]);

  useEffect(() => {
    if (!fontsReady || isCheckingAuth) return;
    const timeoutId = setTimeout(() => {
      if (splashHiddenRef.current) return;
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => undefined);
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [fontsReady, isCheckingAuth]);

  if (isCheckingAuth || isLeavingLogin) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: isDark ? Colors.black : Colors.white }}
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
      <KeyboardProvider>
        <ToastProviderWithViewport>
          <PaperProvider
            settings={{
              icon: (props) => <MaterialCommunityIcons {...props} />,
            }}
          >
            <ThemeProvider value={isDark ? CustomDarkTheme : CustomLightTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="course/[courseid]" />
                <Stack.Screen name="course/[courseid]/assignment/[assignmentid]" />
                <Stack.Screen name="faculty/[id]" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="pair/desktop" />
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
                  className="absolute self-center flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 shadow-sm"
                  style={{
                    top: insets.top + 10,
                    backgroundColor: isDark
                      ? Colors.gray[900]
                      : Colors.gray[100],
                    borderColor: Colors.status.warning,
                  }}
                >
                  <MaterialCommunityIcons
                    name="cloud-off-outline"
                    size={14}
                    color={Colors.status.warning}
                  />
                  <Text
                    className="text-[12px] font-semibold tracking-[0.2px]"
                    style={{
                      color: isDark ? Colors.gray[100] : Colors.gray[800],
                    }}
                  >
                    Offline - showing cached data
                  </Text>
                </View>
              )}
            </Portal>
            <AttendanceSetupSheet
              enabled={
                isLoggedIn &&
                pathname !== "/login" &&
                pathname !== DESKTOP_PAIRING_ROUTE
              }
            />
            <AppSyncController />
            {process.env.EXPO_OS === "web" ? (
              <PwaInstallPrompt isLoggedIn={isLoggedIn} />
            ) : null}
          </PaperProvider>
        </ToastProviderWithViewport>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
