import { syncDashboardBackgroundTask } from "@/background/dashboard-background";
import { syncWifixBackgroundTask } from "@/background/wifix-background";
import {
  CustomRemindersSection,
  DashboardSettingsSection,
  DesktopPluginSection,
  GeneralSettingsSection,
  SettingsFooter,
} from "@/components/settings";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { SelectionModal } from "@/components/modals/selection-modal";
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
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import type { ThemePreference } from "@/types";
import { AccountSettingsSection } from "@/components/settings/account-settings-section";
import { DeveloperSettingsSection } from "@/components/settings/developer-settings-section";
import { usePwaInstallStore } from "@/stores/pwa-install-store";

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { username, logout } = useAuthStore();
  const { clearAttendance } = useAttendanceStore();
  const { resetToLms } = useBunkStore();
  const { backgroundActivity, logs, clearLogs } = useDashboardStore();
  const {
    backgroundSyncActivityEnabled,
    refreshIntervalMinutes,
    reminders,
    notificationsEnabled,
    toggleBackgroundSyncActivity,
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
  const pwaCanInstall = usePwaInstallStore((state) => state.canInstall);
  const pwaIsIos = usePwaInstallStore((state) => state.isIos);
  const pwaIsInstalled = usePwaInstallStore((state) => state.isInstalled);
  const requestPwaInstall = usePwaInstallStore(
    (state) => state.requestInstall,
  );

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showResetBunksModal, setShowResetBunksModal] = useState(false);
  const [showRefreshIntervalModal, setShowRefreshIntervalModal] =
    useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showWifixIntervalModal, setShowWifixIntervalModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showNotificationPermissionModal, setShowNotificationPermissionModal] =
    useState(false);
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
        message:
          "Could not download the update. Try again on a stable network.",
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
        setShowNotificationPermissionModal(true);
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

  const handleRetryNotificationPermission = () => {
    setShowNotificationPermissionModal(false);
    void handleTestNotification();
  };

  return (
    <Container>
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
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
          <View className="items-center gap-4 py-6">
            <View
              className="h-[72px] w-[72px] items-center justify-center rounded-full"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons name="person" size={28} color={theme.textSecondary} />
            </View>
            <Text
              className="text-xl font-semibold"
              style={{ color: theme.text }}
            >
              {username}
            </Text>
          </View>

          <AccountSettingsSection lmsUsername={username} theme={theme} />
          <DesktopPluginSection theme={theme} />
          <DashboardSettingsSection
            backgroundActivity={backgroundActivity}
            backgroundSyncActivityEnabled={backgroundSyncActivityEnabled}
            devDashboardSyncEnabled={devDashboardSyncEnabled}
            isTestingNotification={isTestingNotification}
            notificationsEnabled={notificationsEnabled}
            onPressRefreshInterval={handleSetRefreshInterval}
            onTestNotification={handleTestNotification}
            onToggleNotifications={toggleNotifications}
            refreshIntervalMinutes={refreshIntervalMinutes}
            theme={theme}
          />

          <CustomRemindersSection
            newReminder={newReminder}
            onAddReminder={handleAddReminder}
            onChangeNewReminder={setNewReminder}
            onRemoveReminder={removeReminder}
            reminders={reminders}
            theme={theme}
          />

          <GeneralSettingsSection
            isCheckingUpdate={isCheckingUpdate}
            onInstallPwa={requestPwaInstall}
            onCheckForUpdates={handleCheckForUpdates}
            onClearCache={handleClearCache}
            onLogout={handleLogout}
            onResetBunks={handleResetBunks}
            onSetTheme={handleSetTheme}
            theme={theme}
            themeLabel={themeLabelMap[themePreference]}
            showPwaInstall={
              process.env.EXPO_OS === "web" &&
              !pwaIsInstalled &&
              (pwaCanInstall || pwaIsIos)
            }
          />

          <DeveloperSettingsSection
            activity={backgroundActivity}
            autoReconnectEnabled={autoReconnectEnabled}
            backgroundIntervalMinutes={backgroundIntervalMinutes}
            backgroundSyncActivityEnabled={backgroundSyncActivityEnabled}
            devDashboardSyncEnabled={devDashboardSyncEnabled}
            logs={logs}
            theme={theme}
            onClearLogs={clearLogs}
            onPressWifixInterval={handleSetWifixInterval}
            onToggleAutoReconnect={(enabled) => {
              setAutoReconnectEnabled(enabled);
              void syncWifixBackgroundTask();
            }}
            onToggleBackgroundActivity={toggleBackgroundSyncActivity}
            onToggleVerboseAlerts={setDevDashboardSyncEnabled}
          />

          <SettingsFooter
            appVersion={appVersion}
            buildVersion={buildVersion}
            showBuildVersion={showBuildVersion}
            theme={theme}
          />
        </View>
      </KeyboardAwareScrollView>

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
          if (value === "system" || value === "light" || value === "dark") {
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
        visible={showNotificationPermissionModal}
        title="Permission Required"
        message="Notifications are needed to remind you about upcoming assignments and deadlines. Tap 'Ask Again' to retry the permission prompt."
        confirmText="Ask Again"
        icon="notifications-outline"
        onCancel={() => setShowNotificationPermissionModal(false)}
        onConfirm={handleRetryNotificationPermission}
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
