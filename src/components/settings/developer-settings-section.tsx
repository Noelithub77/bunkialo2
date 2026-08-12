import { LogsSection } from "@/components/shared/logs-section";
import { CourseLinkSettingsSection } from "@/components/settings/course-link-settings-section";
import { Colors } from "@/constants/theme";
import type { DashboardBackgroundActivity, DashboardLog } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { LayoutAnimation, Pressable, Switch, Text, View } from "react-native";
import { BackgroundSyncStatusCard } from "./background-sync-status-card";
import { SettingRow } from "./setting-row";
import { WifixSettingsSection } from "./wifix-settings-section";

interface DeveloperSettingsSectionProps {
  activity: DashboardBackgroundActivity;
  autoReconnectEnabled: boolean;
  backgroundIntervalMinutes: number;
  backgroundSyncActivityEnabled: boolean;
  devDashboardSyncEnabled: boolean;
  logs: DashboardLog[];
  theme: typeof Colors.light;
  onClearLogs: () => void;
  onPressWifixInterval: () => void;
  onToggleAutoReconnect: (enabled: boolean) => void;
  onToggleBackgroundActivity: (enabled: boolean) => void;
  onToggleVerboseAlerts: (enabled: boolean) => void;
}

export function DeveloperSettingsSection({
  activity,
  autoReconnectEnabled,
  backgroundIntervalMinutes,
  backgroundSyncActivityEnabled,
  devDashboardSyncEnabled,
  logs,
  theme,
  onClearLogs,
  onPressWifixInterval,
  onToggleAutoReconnect,
  onToggleBackgroundActivity,
  onToggleVerboseAlerts,
}: DeveloperSettingsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpanded((value) => !value);
        }}
        className="mb-2 ml-1 mt-6 flex-row items-center gap-1"
      >
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
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

      {expanded ? (
        <>
          <View
            className="mb-3 overflow-hidden rounded-xl border"
            style={{ borderColor: theme.border }}
          >
            <SettingRow
              icon="pulse-outline"
              label="Sync Activity Alerts"
              theme={theme}
              rightElement={
                <Switch
                  value={backgroundSyncActivityEnabled}
                  onValueChange={onToggleBackgroundActivity}
                  trackColor={{ false: theme.border, true: Colors.status.info }}
                  thumbColor={Colors.white}
                />
              }
            />
            <View
              className="h-px ml-12"
              style={{ backgroundColor: theme.border }}
            />
            <SettingRow
              icon="bug-outline"
              label="Verbose Dev Alerts"
              theme={theme}
              rightElement={
                <Switch
                  value={devDashboardSyncEnabled}
                  onValueChange={onToggleVerboseAlerts}
                  trackColor={{ false: theme.border, true: Colors.status.info }}
                  thumbColor={Colors.white}
                />
              }
            />
          </View>
          <BackgroundSyncStatusCard activity={activity} theme={theme} />
          <WifixSettingsSection
            autoReconnectEnabled={autoReconnectEnabled}
            backgroundIntervalMinutes={backgroundIntervalMinutes}
            onPressBackgroundInterval={onPressWifixInterval}
            onToggleAutoReconnect={onToggleAutoReconnect}
            theme={theme}
          />
          <CourseLinkSettingsSection theme={theme} />
          <Text
            className="mb-2 ml-1 mt-6 text-xs font-semibold uppercase"
            style={{ color: theme.textSecondary }}
          >
            Logs
          </Text>
          <LogsSection logs={logs} onClear={onClearLogs} />
        </>
      ) : null}
    </>
  );
}
