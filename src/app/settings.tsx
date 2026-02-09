import { syncDashboardBackgroundTask } from "@/background/dashboard-background";
import { syncWifixBackgroundTask } from "@/background/wifix-background";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { SelectionModal } from "@/components/modals/selection-modal";
import { LogsSection } from "@/components/shared/logs-section";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useWifixStore } from "@/stores/wifix-store";
import { requestNotificationPermissionsWithExplanation } from "@/utils/notifications";
import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ThemePreference } from "@/types";

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
    className="flex-row items-center justify-between px-4 py-3"
    style={({ pressed }) => ({
      backgroundColor:
        pressed && onPress ? theme.backgroundSecondary : "transparent",
    })}
    onPress={onPress}
    disabled={loading || !onPress}
  >
    <View className="flex-row items-center gap-2">
      <Ionicons
        name={icon}
        size={20}
        color={danger ? Colors.status.danger : theme.textSecondary}
      />
      <Text
        className="text-[15px]"
        style={{ color: danger ? Colors.status.danger : theme.text }}
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
  const { clearAttendance } = useAttendanceStore();
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
    devDashboardSyncEnabled,
    setDevDashboardSyncEnabled,
    themePreference,
    setThemePreference,
  } = useSettingsStore();
  const {
    backgroundIntervalMinutes,
    setBackgroundIntervalMinutes,
    autoReconnectEnabled,
    setAutoReconnectEnabled,
  } = useWifixStore();

  const [newReminder, setNewReminder] = useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showResetBunksModal, setShowResetBunksModal] = useState(false);
  const [showRefreshIntervalModal, setShowRefreshIntervalModal] =
    useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showWifixIntervalModal, setShowWifixIntervalModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [availableUpdateInfo, setAvailableUpdateInfo] = useState<{
    message?: string;
    updateId?: string;
  } | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({
    title: "",
    message: "",
  });

  const expoConfig = Constants.expoConfig;
  const configBuildNumber =
    expoConfig?.ios?.buildNumber ??
    (expoConfig?.android?.versionCode
      ? String(expoConfig.android.versionCode)
      : null);
  const appVersion =
    Constants.appOwnership === "expo"
      ? (expoConfig?.version ?? Application.nativeApplicationVersion ?? "0.0.0")
      : (Application.nativeApplicationVersion ??
        expoConfig?.version ??
        "0.0.0");
  const buildVersion =
    Constants.appOwnership === "expo"
      ? (configBuildNumber ?? Application.nativeBuildVersion)
      : (Application.nativeBuildVersion ?? configBuildNumber);
  const showBuildVersion = Constants.appOwnership !== "expo" && !!buildVersion;

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

  const handleSetWifixInterval = () => {
    setShowWifixIntervalModal(true);
  };

  const handleSetTheme = () => {
    setShowThemeModal(true);
  };

  const themeLabelMap: Record<ThemePreference, string> = {
    system: "System",
    light: "Light",
    dark: "Dark",
  };

  const handleAddReminder = () => {
    const mins = parseInt(newReminder, 10);
    if (!isNaN(mins) && mins > 0) {
      addReminder(mins);
      setNewReminder("");
    }
  };

  const handleCheckForUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      setInfoModalContent({
        title: "Dev Mode",
        message:
          "Updates are not available in development mode or when updates are disabled.",
      });
      setShowInfoModal(true);
      return;
    }
    setIsCheckingUpdate(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable && update.manifest) {
        const manifest = update.manifest as Record<string, unknown>;
        const metadata = manifest?.metadata as
          | Record<string, string>
          | undefined;
        setAvailableUpdateInfo({
          message: metadata?.message,
          updateId: manifest?.id as string | undefined,
        });
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
    if (isApplyingUpdate) return;
    setIsApplyingUpdate(true);
    setShowUpdateModal(false);
    try {
      const result = await Updates.fetchUpdateAsync();
      if (!result.isNew) {
        setInfoModalContent({
          title: "No New Update",
          message: "This update is already downloaded.",
        });
        setShowInfoModal(true);
        return;
      }
      await Updates.reloadAsync();
    } catch {
      setInfoModalContent({
        title: "Update Failed",
        message: "Could not download the update. Try again on a stable network.",
      });
      setShowInfoModal(true);
    } finally {
      setIsApplyingUpdate(false);
    }
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
          seconds: 1,
        },
      });

      setInfoModalContent({
        title: "Test Scheduled",
        message: "A test notification will appear in a second.",
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
        <View className="flex-row items-center justify-between px-2 py-4">
          <Pressable onPress={() => router.back()} className="p-2">
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text className="text-xl font-semibold" style={{ color: theme.text }}>
            Settings
          </Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 px-6 pb-12">
          {/* Profile */}
          <View className="items-center gap-4 py-6">
            <View
              className="h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons name="person" size={28} color={theme.textSecondary} />
            </View>
            <Text className="text-xl font-semibold" style={{ color: theme.text }}>
              {username}
            </Text>
          </View>

          {/* Dashboard Settings */}
          <Text
            className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase"
            style={{ color: theme.textSecondary }}
          >
            Dashboard
          </Text>
          <View
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: theme.border }}
          >
            <SettingRow
              icon="time-outline"
              label={`Refresh: ${refreshIntervalMinutes} min`}
              onPress={handleSetRefreshInterval}
              theme={theme}
            />
            <View
              className="h-px"
              style={{ marginLeft: 48, backgroundColor: theme.border }}
            />
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
            <View
              className="h-px"
              style={{ marginLeft: 48, backgroundColor: theme.border }}
            />
            <SettingRow
              icon="checkmark-circle-outline"
              label="Test Notification"
              onPress={handleTestNotification}
              loading={isTestingNotification}
              theme={theme}
            />
            {__DEV__ && (
              <>
                <View
                  className="h-px"
                  style={{ marginLeft: 48, backgroundColor: theme.border }}
                />
                <SettingRow
                  icon="bug-outline"
                  label="Dev Sync Alerts"
                  theme={theme}
                  rightElement={
                    <Switch
                      value={devDashboardSyncEnabled}
                      onValueChange={setDevDashboardSyncEnabled}
                      trackColor={{
                        false: theme.border,
                        true: Colors.status.info,
                      }}
                      thumbColor={Colors.white}
                    />
                  }
                />
              </>
            )}
          </View>

          {/* WiFix Settings */}
          <Text
            className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase"
            style={{ color: theme.textSecondary }}
          >
            WiFix
          </Text>
          <View
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: theme.border }}
          >
            <SettingRow
              icon="wifi"
              label="Auto Reconnect"
              theme={theme}
              rightElement={
                <Switch
                  value={autoReconnectEnabled}
                  onValueChange={(enabled) => {
                    setAutoReconnectEnabled(enabled);
                    syncWifixBackgroundTask();
                  }}
                  trackColor={{
                    false: theme.border,
                    true: Colors.status.info,
                  }}
                  thumbColor={Colors.white}
                />
              }
            />
            <View
              className="h-px"
              style={{ marginLeft: 48, backgroundColor: theme.border }}
            />
            <SettingRow
              icon="time-outline"
              label={`Background login: ${backgroundIntervalMinutes} min`}
              onPress={handleSetWifixInterval}
              theme={theme}
            />
          </View>

          {/* Custom Reminders */}
          <Text
            className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase"
            style={{ color: theme.textSecondary }}
          >
            Custom Reminders
          </Text>
          <View
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: theme.border }}
          >
            {reminders.map((mins) => (
              <View
                key={mins}
                className="flex-row items-center justify-between px-4 py-2"
              >
                <Text className="text-sm" style={{ color: theme.text }}>
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
            <View className="flex-row items-center gap-2 p-4">
              <TextInput
                className="h-10 flex-1 rounded-lg border px-2 text-sm"
                style={{ color: theme.text, borderColor: theme.border }}
                placeholder="mins"
                placeholderTextColor={theme.textSecondary}
                value={newReminder}
                onChangeText={setNewReminder}
                keyboardType="numeric"
              />
              <Pressable
                className="h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: Colors.status.info }}
                onPress={handleAddReminder}
              >
                <Ionicons name="add" size={20} color={Colors.white} />
              </Pressable>
            </View>
          </View>

          {/* General Settings */}
          <Text
            className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase"
            style={{ color: theme.textSecondary }}
          >
            General
          </Text>
          <View
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: theme.border }}
          >
            <SettingRow
              icon="color-palette-outline"
              label={`Theme: ${themeLabelMap[themePreference]}`}
              onPress={handleSetTheme}
              theme={theme}
            />
            <View
              className="h-px"
              style={{ marginLeft: 48, backgroundColor: theme.border }}
            />
            <SettingRow
              icon="cloud-download-outline"
              label="Check for Updates"
              onPress={handleCheckForUpdates}
              loading={isCheckingUpdate}
              theme={theme}
            />
            <View
              className="h-px"
              style={{ marginLeft: 48, backgroundColor: theme.border }}
            />
            <SettingRow
              icon="trash-outline"
              label="Clear Cache"
              onPress={handleClearCache}
              theme={theme}
            />
            <View
              className="h-px"
              style={{ marginLeft: 48, backgroundColor: theme.border }}
            />
            <SettingRow
              icon="refresh-circle-outline"
              label="Reset Bunks to LMS"
              onPress={handleResetBunks}
              theme={theme}
            />
            <View
              className="h-px"
              style={{ marginLeft: 48, backgroundColor: theme.border }}
            />
            <SettingRow
              icon="log-out-outline"
              label="Logout"
              onPress={handleLogout}
              danger
              theme={theme}
            />
          </View>

          {/* Logs Section */}
          <Text
            className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase"
            style={{ color: theme.textSecondary }}
          >
            Logs
          </Text>
          <LogsSection logs={logs} onClear={clearLogs} />

          {/* Footer */}
          <View className="mt-8 items-center gap-1">
            <Text className="text-xs" style={{ color: theme.textSecondary }}>
              {showBuildVersion
                ? `Bunkialo v${appVersion}(${buildVersion})`
                : `Bunkialo v${appVersion}`}
            </Text>
            <View className="flex-row items-center">
              <Text className="text-xs" style={{ color: theme.textSecondary }}>
                Made by{" "}
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL("https://www.linkedin.com/in/noel-georgi/")
                }
              >
                <Text
                  className="text-xs underline"
                  style={{ color: theme.textSecondary }}
                >
                  Noel Georgi
                </Text>
              </Pressable>
            </View>
            <View className="flex-row items-center">
              <Text className="text-xs" style={{ color: theme.textSecondary }}>
                Ideas by{" "}
              </Text>
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    "https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/",
                  )
                }
              >
                <Text
                  className="text-xs underline"
                  style={{ color: theme.textSecondary }}
                >
                  Srimoney
                </Text>
              </Pressable>
              <Text className="text-xs" style={{ color: theme.textSecondary }}>
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
                <Text
                  className="text-xs underline"
                  style={{ color: theme.textSecondary }}
                >
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
          void syncDashboardBackgroundTask();
        }}
      />

      <SelectionModal
        visible={showThemeModal}
        title="App Theme"
        message="Choose how Bunkialo decides light/dark mode"
        icon="color-palette-outline"
        selectedValue={themePreference}
        options={[
          { label: "System", value: "system" },
          { label: "Light", value: "light" },
          { label: "Dark", value: "dark" },
        ]}
        onClose={() => setShowThemeModal(false)}
        onSelect={(value) => {
          if (
            value === "system" ||
            value === "light" ||
            value === "dark"
          ) {
            setThemePreference(value);
          }
        }}
      />

      <SelectionModal
        visible={showWifixIntervalModal}
        title="WiFix Background Interval"
        message="Choose how often WiFix attempts background login"
        icon="wifi"
        options={[
          { label: "30 min", value: 30 },
          { label: "60 min", value: 60 },
          { label: "120 min", value: 120 },
        ]}
        onClose={() => setShowWifixIntervalModal(false)}
        onSelect={(value) => {
          if (typeof value === "number") {
            setBackgroundIntervalMinutes(value);
            syncWifixBackgroundTask();
          }
        }}
      />

      <ConfirmModal
        visible={showUpdateModal}
        title="Update Available"
        message={
          availableUpdateInfo?.message
            ? `${availableUpdateInfo.message}${availableUpdateInfo.updateId ? `\n\n(${availableUpdateInfo.updateId.slice(0, 8)})` : ""}`
            : `A new version is available.${availableUpdateInfo?.updateId ? ` (${availableUpdateInfo.updateId.slice(0, 8)})` : ""}`
        }
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
