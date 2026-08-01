import { syncDashboardBackgroundTask } from "@/background/dashboard-background";
import { syncWifixBackgroundTask } from "@/background/wifix-background";
import {
  CustomRemindersSection,
  DashboardSettingsSection,
  GeneralSettingsSection,
  SettingsFooter,
  WifixSettingsSection,
  SettingRow,
  BackgroundSyncStatusCard,
  PortalSettingsSection,
} from "@/components/settings";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import {
  PortalConnectModal,
  type PortalChallenge,
} from "@/components/modals/portal-connect-modal";
import { SelectionModal } from "@/components/modals/selection-modal";
import { LogsSection } from "@/components/shared/logs-section";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { Switch } from "react-native";
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
import * as portal from "@/services/attendance-portal";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as Updates from "expo-updates";
import { useState, useRef, useEffect } from "react";
import { Animated, LayoutAnimation, Pressable, ScrollView, Text, View } from "react-native";
import type { ThemePreference } from "@/types";

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { username, logout } = useAuthStore();
  const { clearAttendance, fetchAttendance } = useAttendanceStore();
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
    devModeEnabled,
    setDevModeEnabled,
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

  const [isPortalConnected, setIsPortalConnected] = useState(false);
  const [isPortalBusy, setIsPortalBusy] = useState(false);
  const [showPortalConnect, setShowPortalConnect] = useState(false);
  const [showPortalDisconnectModal, setShowPortalDisconnectModal] =
    useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalChallenge, setPortalChallenge] =
    useState<PortalChallenge>("none");
  const [portalIntermediate, setPortalIntermediate] = useState<string | null>(
    null,
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

  // ponytail: local state, not a store. Connection status changes twice per
  // install, so a subscription would be machinery for a boolean.
  useEffect(() => {
    void portal.hasPortalCredentials().then(setIsPortalConnected);
  }, []);

  const finishPortalConnect = async () => {
    setIsPortalConnected(true);
    setShowPortalConnect(false);
    setPortalChallenge("none");
    setPortalIntermediate(null);
    // syncFromLms and timetable regeneration already run off lastSyncTime
    // when the attendance tab renders, so this is the only trigger needed.
    await fetchAttendance();
  };

  const handlePortalConnect = async (email: string, password: string) => {
    setIsPortalBusy(true);
    setPortalError(null);
    try {
      const result = await portal.login(email, password);
      if (result.kind !== "success") {
        setPortalChallenge(result.kind);
        setPortalIntermediate(result.intermediate);
        return;
      }
      await finishPortalConnect();
    } catch {
      setPortalError("Could not sign in. Check your email and password.");
    } finally {
      setIsPortalBusy(false);
    }
  };

  const handlePortalSubmitCode = async (
    code: string,
    useBackupCode: boolean,
  ) => {
    if (!portalIntermediate) return;
    setIsPortalBusy(true);
    setPortalError(null);
    try {
      if (useBackupCode) {
        await portal.submitBackupCode(portalIntermediate, code);
      } else if (portalChallenge === "needsEmailOtp") {
        await portal.submitEmailOtp(portalIntermediate, code);
      } else {
        await portal.submitTotp(portalIntermediate, code);
      }
      await finishPortalConnect();
    } catch {
      setPortalError("That code was not accepted. Try again.");
    } finally {
      setIsPortalBusy(false);
    }
  };

  const handlePortalDisconnectConfirm = async () => {
    setShowPortalDisconnectModal(false);
    setIsPortalBusy(true);
    try {
      await portal.disconnectPortal();
      setIsPortalConnected(false);
      clearAttendance();
    } finally {
      setIsPortalBusy(false);
    }
  };

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

  const [isDevExpanded, setIsDevExpanded] = useState(false);

  const toggleDevMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsDevExpanded(!isDevExpanded);
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
            onCheckForUpdates={handleCheckForUpdates}
            onClearCache={handleClearCache}
            onLogout={handleLogout}
            onResetBunks={handleResetBunks}
            onSetTheme={handleSetTheme}
            theme={theme}
            themeLabel={themeLabelMap[themePreference]}
          />

          <Pressable
            onPress={toggleDevMode}
            className="mt-6 mb-2 ml-1 flex-row items-center gap-1"
          >
            <Ionicons 
              name={isDevExpanded ? "chevron-down" : "chevron-forward"} 
              size={14} 
              color={theme.textSecondary} 
            />
            <Text
              className="text-xs font-semibold uppercase"
              style={{ color: theme.textSecondary }}
            >
              Developer
            </Text>
          </Pressable>
          
          {isDevExpanded && (
            <>
              <View
                className="overflow-hidden rounded-xl border mb-3"
                style={{ borderColor: theme.border }}
              >
                <SettingRow
                  icon="pulse-outline"
                  label="Sync Activity Alerts"
                  theme={theme}
                  rightElement={
                    <Switch
                      value={backgroundSyncActivityEnabled}
                      onValueChange={toggleBackgroundSyncActivity}
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
                  icon="bug-outline"
                  label="Verbose Dev Alerts"
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
              </View>

              <BackgroundSyncStatusCard activity={backgroundActivity} theme={theme} />

              <WifixSettingsSection
                autoReconnectEnabled={autoReconnectEnabled}
                backgroundIntervalMinutes={backgroundIntervalMinutes}
                onPressBackgroundInterval={handleSetWifixInterval}
                onToggleAutoReconnect={(enabled) => {
                  setAutoReconnectEnabled(enabled);
                  syncWifixBackgroundTask();
                }}
                theme={theme}
              />

              <PortalSettingsSection
                isConnected={isPortalConnected}
                isBusy={isPortalBusy}
                onConnect={() => {
                  setPortalError(null);
                  setPortalChallenge("none");
                  setPortalIntermediate(null);
                  setShowPortalConnect(true);
                }}
                onDisconnect={() => setShowPortalDisconnectModal(true)}
                theme={theme}
              />
              
              <Text
                className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase"
                style={{ color: theme.textSecondary }}
              >
                Logs
              </Text>
              <LogsSection logs={logs} onClear={clearLogs} />
            </>
          )}

          <SettingsFooter
            appVersion={appVersion}
            buildVersion={buildVersion}
            showBuildVersion={showBuildVersion}
            theme={theme}
          />
        </View>
      </ScrollView>

      <PortalConnectModal
        visible={showPortalConnect}
        isConnecting={isPortalBusy}
        error={portalError}
        challenge={portalChallenge}
        onClose={() => setShowPortalConnect(false)}
        onSubmit={handlePortalConnect}
        onSubmitCode={handlePortalSubmitCode}
      />

      <ConfirmModal
        visible={showPortalDisconnectModal}
        title="Disconnect Portal"
        message="Attendance and timetable will stop updating until you reconnect. Your bunk notes are kept."
        confirmText="Disconnect"
        variant="destructive"
        icon="link-outline"
        onCancel={() => setShowPortalDisconnectModal(false)}
        onConfirm={handlePortalDisconnectConfirm}
      />

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
