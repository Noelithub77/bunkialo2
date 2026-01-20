import { EventCard } from "@/components/event-card";
import { TimelineSection } from "@/components/timeline-section";
import { Container } from "@/components/ui/container";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  const [showOverdue, setShowOverdue] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (lastSyncTime !== null) return; // cache exists; refresh only on manual

    InteractionManager.runAfterInteractions(() => {
      fetchDashboard();
    });
  }, [hasHydrated, lastSyncTime, fetchDashboard]);

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
          <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
          <View style={styles.headerRight}>
            {lastSyncTime && (
              <View style={styles.syncRow}>
                <Ionicons
                  name="refresh-outline"
                  size={14}
                  color={theme.textSecondary}
                />
                <Text style={[styles.syncText, { color: theme.textSecondary }]}>
                  {formatSyncTime(lastSyncTime)}
                </Text>
              </View>
            )}
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

        {/* Loading */}
        {(isHydratingFromCache || (isLoading && isEmpty)) && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.text} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              {isHydratingFromCache ? "Loading cached events..." : "Loading events..."}
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
    alignItems: "center",
    marginBottom: Spacing.lg,
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
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  syncText: {
    fontSize: 12,
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
