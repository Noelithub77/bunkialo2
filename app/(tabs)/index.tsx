import { startBackgroundRefresh } from "@/background/dashboard-background";
import { EventCard } from "@/components/dashboard/event-card";
import { TimelineSection } from "@/components/dashboard/timeline-section";
import { UpNextSection } from "@/components/dashboard/up-next-section";
import { DevInfoModal } from "@/components/modals/dev-info-modal";
import { Container } from "@/components/ui/container";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
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
  StyleSheet,
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
  const [showOverdue, setShowOverdue] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showDevInfo, setShowDevInfo] = useState(false);
  const isFocused = useIsFocused();
  const hasAutoRefreshed = useRef(false);

  useEffect(() => {
    if (!hasHydrated || hasAutoRefreshed.current) return;
    hasAutoRefreshed.current = true;

    const task = InteractionManager.runAfterInteractions(() => {
      if (lastSyncTime === null) {
        fetchDashboard();
      } else {
        fetchDashboard({ silent: true });
      }
    });

    return () => task.cancel();
  }, [hasHydrated, lastSyncTime, fetchDashboard]);

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

  return (
    <Container>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.text}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
            {lastSyncTime && (
              <View style={styles.syncPill}>
                <Ionicons
                  name="refresh-outline"
                  size={12}
                  color={theme.textSecondary}
                />
                <Text style={[styles.syncText, { color: theme.textSecondary }]}>
                  {formatSyncTime(lastSyncTime)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => setShowDevInfo(true)}
              style={styles.settingsBtn}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings")}
              style={styles.settingsBtn}
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
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.text} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              {isHydratingFromCache
                ? "Loading cached events..."
                : "Loading events..."}
            </Text>
          </View>
        )}

        {/* Overdue Section */}
        {hasOverdue && (
          <View style={styles.section}>
            <Pressable
              style={[
                styles.overdueHeader,
                {
                  backgroundColor: Colors.status.danger + "15",
                  borderColor: Colors.status.danger,
                },
              ]}
              onPress={() => setShowOverdue(!showOverdue)}
            >
              <View style={styles.overdueLeft}>
                <Ionicons
                  name="warning-outline"
                  size={18}
                  color={Colors.status.danger}
                />
                <Text
                  style={[styles.overdueText, { color: Colors.status.danger }]}
                >
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
              <View style={styles.overdueList}>
                {overdueEvents.map((event) => (
                  <EventCard key={event.id} event={event} isOverdue />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Upcoming Timeline */}
        {!isHydratingFromCache && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
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
            backdropColor="rgba(0,0,0,0.45)"
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

const styles = StyleSheet.create({
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexShrink: 1,
    rowGap: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  syncText: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  settingsBtn: {
    padding: Spacing.sm,
  },
  loading: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  overdueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  overdueLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  overdueText: {
    fontSize: 14,
    fontWeight: "600",
  },
  overdueList: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
});
