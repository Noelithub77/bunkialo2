import { ConfirmModal } from "@/components/modals/confirm-modal";
import { SelectionModal } from "@/components/modals/selection-modal";
import { LogsSection } from "@/components/shared/logs-section";
import { Container } from "@/components/ui/container";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import { requestNotificationPermissionsWithExplanation } from "@/utils/notifications";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  loading?: boolean;
  danger?: boolean;
  theme: typeof Colors.light;
  rightElement?: React.ReactNode;
};

const SettingRow = ({
  icon,
  label,
  onPress,
  loading,
  danger,
  theme,
  rightElement,
}: SettingRowProps) => (
  <Pressable
    style={({ pressed }) => [
      styles.row,
      {
        backgroundColor:
          pressed && onPress ? theme.backgroundSecondary : "transparent",
      },
    ]}
    onPress={onPress}
    disabled={loading || !onPress}
  >
    <View style={styles.rowLeft}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? Colors.status.danger : theme.textSecondary}
      />
      <Text
        style={[
          styles.rowLabel,
          { color: danger ? Colors.status.danger : theme.text },
        ]}
      >
        {label}
      </Text>
    </View>
    {loading ? (
      <ActivityIndicator size="small" color={theme.textSecondary} />
    ) : rightElement ? (
      rightElement
    ) : onPress ? (
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    ) : null}
  </Pressable>
);

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { username, logout } = useAuthStore();
  const { fetchAttendance, clearAttendance, isLoading } = useAttendanceStore();
  const { resetToLms } = useBunkStore();
  const { logs, clearLogs } = useDashboardStore();
  const {
    refreshIntervalMinutes,
    reminders,
    notificationsEnabled,
    setRefreshInterval,
    addReminder,
    removeReminder,
    toggleNotifications,
  } = useSettingsStore();

  const [newReminder, setNewReminder] = useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showResetBunksModal, setShowResetBunksModal] = useState(false);
  const [showRefreshIntervalModal, setShowRefreshIntervalModal] =
    useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({
    title: "",
    message: "",
  });

  const appVersion = Constants.expoConfig?.version ?? "0.0.0";

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    await logout();
    router.replace("/login");
  };

  const handleClearCache = () => {
    setShowClearCacheModal(true);
  };

  const handleResetBunks = () => {
    setShowResetBunksModal(true);
  };

  const handleSetRefreshInterval = () => {
    setShowRefreshIntervalModal(true);
  };

  const handleAddReminder = () => {
    const mins = parseInt(newReminder, 10);
    if (!isNaN(mins) && mins > 0) {
      addReminder(mins);
      setNewReminder("");
    }
  };

  const handleCheckForUpdates = async () => {
    if (__DEV__) {
      setInfoModalContent({
        title: "Dev Mode",
        message: "Updates are not available in development mode.",
      });
      setShowInfoModal(true);
      return;
    }
    setIsCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setShowUpdateModal(true);
      } else {
        setInfoModalContent({
          title: "Up to Date",
          message: "You are on the latest version.",
        });
        setShowInfoModal(true);
      }
    } catch {
      setInfoModalContent({
        title: "Error",
        message: "Could not check for updates.",
      });
      setShowInfoModal(true);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleUpdateConfirm = async () => {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  };

  const handleTestNotification = async () => {
    setIsTestingNotification(true);
    try {
      // Request permissions with explanation
      const hasPermission =
        await requestNotificationPermissionsWithExplanation();
      if (!hasPermission) {
        setInfoModalContent({
          title: "Permission Required",
          message:
            "Notifications are needed to remind you about upcoming assignments and deadlines. Please enable them in your device settings.",
        });
        setShowInfoModal(true);
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Test Notification",
          body: "Notifications are working correctly!",
          data: { test: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
        },
      });

      setInfoModalContent({
        title: "Test Scheduled",
        message: "A test notification will appear in 2 seconds.",
      });
      setShowInfoModal(true);
    } catch (error) {
      console.error("Test notification failed:", error);
      setInfoModalContent({
        title: "Error",
        message: "Failed to send test notification.",
      });
      setShowInfoModal(true);
    } finally {
      setIsTestingNotification(false);
    }
  };

  return (
    <Container>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Profile */}
          <View style={styles.profile}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Ionicons name="person" size={28} color={theme.textSecondary} />
            </View>
            <Text style={[styles.username, { color: theme.text }]}>
              {username}
            </Text>
          </View>

          {/* Dashboard Settings */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Dashboard
          </Text>
          <View style={[styles.list, { borderColor: theme.border }]}>
            <SettingRow
              icon="time-outline"
              label={`Refresh: ${refreshIntervalMinutes} min`}
              onPress={handleSetRefreshInterval}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingRow
              icon="notifications-outline"
              label="Notifications"
              theme={theme}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{
                    false: theme.border,
                    true: Colors.status.success,
                  }}
                  thumbColor={Colors.white}
                />
              }
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingRow
              icon="checkmark-circle-outline"
              label="Test Notification"
              onPress={handleTestNotification}
              loading={isTestingNotification}
              theme={theme}
            />
          </View>

          {/* Custom Reminders */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Custom Reminders
          </Text>
          <View style={[styles.list, { borderColor: theme.border }]}>
            {reminders.map((mins) => (
              <View key={mins} style={styles.reminderRow}>
                <Text style={[styles.reminderText, { color: theme.text }]}>
                  {mins} min before
                </Text>
                <Pressable onPress={() => removeReminder(mins)}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={Colors.status.danger}
                  />
                </Pressable>
              </View>
            ))}
            <View style={styles.addReminderRow}>
              <TextInput
                style={[
                  styles.reminderInput,
                  { color: theme.text, borderColor: theme.border },
                ]}
                placeholder="mins"
                placeholderTextColor={theme.textSecondary}
                value={newReminder}
                onChangeText={setNewReminder}
                keyboardType="numeric"
              />
              <Pressable
                style={[
                  styles.addButton,
                  { backgroundColor: Colors.status.info },
                ]}
                onPress={handleAddReminder}
              >
                <Ionicons name="add" size={20} color={Colors.white} />
              </Pressable>
            </View>
          </View>

          {/* General Settings */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            General
          </Text>
          <View style={[styles.list, { borderColor: theme.border }]}>
            <SettingRow
              icon="refresh"
              label="Refresh Attendance"
              onPress={fetchAttendance}
              loading={isLoading}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingRow
              icon="cloud-download-outline"
              label="Check for Updates"
              onPress={handleCheckForUpdates}
              loading={isCheckingUpdate}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingRow
              icon="trash-outline"
              label="Clear Cache"
              onPress={handleClearCache}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingRow
              icon="refresh-circle-outline"
              label="Reset Bunks to LMS"
              onPress={handleResetBunks}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <SettingRow
              icon="log-out-outline"
              label="Logout"
              onPress={handleLogout}
              danger
              theme={theme}
            />
          </View>

          {/* Logs Section */}
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Logs
          </Text>
          <LogsSection logs={logs} onClear={clearLogs} />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Bunkialo v{appVersion}
            </Text>
            <View style={styles.devInfo}>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                Made by{" "}
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL("https://www.linkedin.com/in/noel-georgi/")
                }
              >
                <Text style={[styles.devLink, { color: theme.textSecondary }]}>
                  Noel Georgi
                </Text>
              </Pressable>
            </View>
            <View style={styles.ideaInfo}>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                Ideas by{" "}
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    "https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/",
                  )
                }
              >
                <Text style={[styles.devLink, { color: theme.textSecondary }]}>
                  Srimoney
                </Text>
              </Pressable>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                {" "}
                &{" "}
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    "https://www.linkedin.com/in/niranjan-vasudevan/",
                  )
                }
              >
                <Text style={[styles.devLink, { color: theme.textSecondary }]}>
                  Niranjan V
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showLogoutModal}
        title="Logout"
        message="Are you sure?"
        confirmText="Logout"
        variant="destructive"
        icon="log-out-outline"
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutConfirm}
      />

      <ConfirmModal
        visible={showClearCacheModal}
        title="Clear Cache"
        message="Remove all cached data?"
        confirmText="Clear"
        variant="destructive"
        icon="trash-outline"
        onCancel={() => setShowClearCacheModal(false)}
        onConfirm={clearAttendance}
      />

      <ConfirmModal
        visible={showResetBunksModal}
        title="Reset Bunks to LMS"
        message="This will remove all your notes, duty leaves, and course configs."
        confirmText="Reset"
        variant="destructive"
        icon="refresh-circle-outline"
        onCancel={() => setShowResetBunksModal(false)}
        onConfirm={resetToLms}
      />

      <SelectionModal
        visible={showRefreshIntervalModal}
        title="Refresh Interval"
        message="Choose refresh interval in minutes"
        icon="time-outline"
        options={[
          { label: "5 min", value: 5 },
          { label: "15 min", value: 15 },
          { label: "30 min", value: 30 },
          { label: "60 min", value: 60 },
        ]}
        onClose={() => setShowRefreshIntervalModal(false)}
        onSelect={(value) => {
          if (typeof value === "number") setRefreshInterval(value);
        }}
      />

      <ConfirmModal
        visible={showUpdateModal}
        title="Update Available"
        message="A new version is available. Download now?"
        confirmText="Update"
        icon="cloud-download-outline"
        onCancel={() => setShowUpdateModal(false)}
        onConfirm={handleUpdateConfirm}
      />

      <ConfirmModal
        visible={showInfoModal}
        title={infoModalContent.title}
        message={infoModalContent.message}
        confirmText="OK"
        icon="information-circle-outline"
        onCancel={() => setShowInfoModal(false)}
        onConfirm={() => setShowInfoModal(false)}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  profile: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  username: {
    fontSize: 20,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  list: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rowLabel: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.md + 20 + Spacing.sm,
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  reminderText: {
    fontSize: 14,
  },
  addReminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  reminderInput: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: "center",
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: 12,
  },
  devInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  ideaInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  devLink: {
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
