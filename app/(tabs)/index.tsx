import { startBackgroundRefresh } from "@/background/dashboard-background";
import { EventCard } from "@/components/dashboard/event-card";
import { TimelineSection } from "@/components/dashboard/timeline-section";
import { UpNextSection } from "@/components/dashboard/up-next-section";
import { DevInfoModal } from "@/components/modals/dev-info-modal";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import { initializeNotifications } from "@/utils/notifications";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { FAB, Portal } from "react-native-paper";

const formatSyncTime = (timestamp: number | null): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    const hours = date.getHours().toString().padStart(2, "0");
    const mins = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${mins}`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const {
    upcomingEvents,
    overdueEvents,
    isLoading,
    lastSyncTime,
    fetchDashboard,
    hasHydrated,
  } = useDashboardStore();
  const { isOffline, setOffline } = useAuthStore();
  const refreshIntervalMinutes = useSettingsStore(
    (state) => state.refreshIntervalMinutes,
  );
  const [showOverdue, setShowOverdue] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showDevInfo, setShowDevInfo] = useState(false);
  const isFocused = useIsFocused();
  const hasAutoRefreshed = useRef(false);

  useEffect(() => {
    if (!hasHydrated || hasAutoRefreshed.current) return;
    if (isOffline && lastSyncTime === null) return;
    hasAutoRefreshed.current = true;
    if (isOffline) return;

    const staleAfterMs = Math.max(5, refreshIntervalMinutes) * 60 * 1000;
    const shouldRefresh =
      lastSyncTime === null || Date.now() - lastSyncTime > staleAfterMs;
    if (!shouldRefresh) return;

    const task = InteractionManager.runAfterInteractions(() => {
      if (lastSyncTime === null) {
        fetchDashboard();
      } else {
        fetchDashboard({ silent: true });
      }
    });

    return () => task.cancel();
  }, [
    fetchDashboard,
    hasHydrated,
    isOffline,
    lastSyncTime,
    refreshIntervalMinutes,
  ]);

  // Start background refresh for notifications
  useEffect(() => {
    if (hasHydrated) {
      const task = InteractionManager.runAfterInteractions(() => {
        // Initialize notifications on first load
        initializeNotifications();
        startBackgroundRefresh();
      });
      return () => task.cancel();
    }
  }, [hasHydrated]);

  useEffect(() => {
    if (isOffline && lastSyncTime) {
      setOffline(false);
    }
  }, [isOffline, lastSyncTime, setOffline]);

  useFocusEffect(
    useCallback(() => {
      return () => setShowFabMenu(false);
    }, [setShowFabMenu]),
  );

  const handleRefresh = useCallback(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const hasOverdue = overdueEvents.length > 0;
  const isEmpty = upcomingEvents.length === 0 && overdueEvents.length === 0;
  const isHydratingFromCache = !hasHydrated && isEmpty;

  const actionLabelStyle = {
    color: theme.text,
    fontSize: 13,
    fontWeight: "600" as const,
  };

  const actionContainerStyle = {
    backgroundColor: isDark ? "rgba(24,24,24,0.92)" : "rgba(255,255,255,0.95)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  };

  return (
    <Container>
      <ScrollView
        contentContainerClassName="p-4 pb-12"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.text}
          />
        }
      >
        {/* Header */}
        <View className="mb-6 flex-row items-start justify-between">
          <View className="shrink gap-0.5">
            <Text className="text-[28px] font-bold" style={{ color: theme.text }}>
              Dashboard
            </Text>
            {lastSyncTime && (
              <View className="flex-row items-center gap-1 self-start rounded-full px-1.5 py-0.5">
                <Ionicons
                  name="refresh-outline"
                  size={12}
                  color={theme.textSecondary}
                />
                <Text
                  className="text-[10px] font-medium"
                  style={{ color: theme.textSecondary, letterSpacing: 0.2 }}
                >
                  {formatSyncTime(lastSyncTime)}
                </Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setShowDevInfo(true)}
              className="p-2"
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings")}
              className="p-2"
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {/* Up Next Section */}
        <UpNextSection />

        {/* Loading */}
        {(isHydratingFromCache || (isLoading && isEmpty)) && (
          <View className="items-center gap-4 py-12">
            <ActivityIndicator size="large" color={theme.text} />
            <Text className="text-sm" style={{ color: theme.textSecondary }}>
              {isHydratingFromCache
                ? "Loading cached events..."
                : "Loading events..."}
            </Text>
          </View>
        )}

        {/* Overdue Section */}
        {hasOverdue && (
          <View className="mb-6">
            <Pressable
              className="flex-row items-center justify-between rounded-xl border p-4"
              style={{
                backgroundColor: Colors.status.danger + "15",
                borderColor: Colors.status.danger,
              }}
              onPress={() => setShowOverdue(!showOverdue)}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name="warning-outline"
                  size={18}
                  color={Colors.status.danger}
                />
                <Text className="text-sm font-semibold" style={{ color: Colors.status.danger }}>
                  {overdueEvents.length} Overdue
                </Text>
              </View>
              <Ionicons
                name={showOverdue ? "chevron-up" : "chevron-down"}
                size={18}
                color={Colors.status.danger}
              />
            </Pressable>

            {showOverdue && (
              <View className="mt-2 gap-2">
                {overdueEvents.map((event) => (
                  <EventCard key={event.id} event={event} isOverdue />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Upcoming Timeline */}
        {!isHydratingFromCache && (
          <View className="mb-6">
            <Text className="mb-4 text-base font-semibold" style={{ color: theme.text }}>
              Upcoming
            </Text>
            <TimelineSection events={upcomingEvents} />
          </View>
        )}
      </ScrollView>

      {isFocused && (
        <Portal>
          <FAB.Group
            open={showFabMenu}
            visible={true}
            icon={showFabMenu ? "close" : "menu"}
            color={isDark ? Colors.gray[200] : Colors.gray[700]}
            style={{ position: "absolute", right: 0, bottom: 80 }}
            backdropColor={isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)"}
            fabStyle={{
              backgroundColor: showFabMenu
                ? Colors.gray[800]
                : theme.backgroundSecondary,
            }}
            actions={[
              {
                icon: "wifi",
                label: "WiFix",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                labelStyle: actionLabelStyle,
                containerStyle: actionContainerStyle,
                onPress: () => {
                  setShowFabMenu(false);
                  router.push("/wifix");
                },
              },
              {
                icon: "calculator-variant",
                label: "GPA Calculator",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                labelStyle: actionLabelStyle,
                containerStyle: actionContainerStyle,
                onPress: () => {
                  setShowFabMenu(false);
                  router.push("/gpa");
                },
              },
              {
                icon: "open-in-new",
                label: "Outpass",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                labelStyle: actionLabelStyle,
                containerStyle: actionContainerStyle,
                onPress: () => {
                  setShowFabMenu(false);
                  Linking.openURL("https://outpass.iiitkottayam.ac.in/app");
                },
              },
              {
                icon: "calendar-month",
                label: "Academic Calendar",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                labelStyle: actionLabelStyle,
                containerStyle: actionContainerStyle,
                onPress: () => {
                  setShowFabMenu(false);
                  router.push("/acad-cal");
                },
              },
            ]}
            onStateChange={({ open }) => setShowFabMenu(open)}
          />
        </Portal>
      )}

      <DevInfoModal
        visible={showDevInfo}
        onClose={() => setShowDevInfo(false)}
      />
    </Container>
  );
}
