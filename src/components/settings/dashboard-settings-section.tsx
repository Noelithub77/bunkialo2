import { Colors } from "@/constants/theme";
import type { DashboardBackgroundActivity } from "@/types";
import { Platform, Switch, Text, View } from "react-native";
import { openBatterySettings } from "@/utils/battery-settings";
import { SettingRow } from "./setting-row";

type DashboardSettingsSectionProps = {
  backgroundActivity: DashboardBackgroundActivity;
  backgroundSyncActivityEnabled: boolean;
  devDashboardSyncEnabled: boolean;
  isTestingNotification: boolean;
  notificationsEnabled: boolean;
  onPressRefreshInterval: () => void;
  onTestNotification: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  refreshIntervalMinutes: number;
  theme: typeof Colors.light;
};

const Divider = ({ theme }: { theme: typeof Colors.light }) => (
  <View
    className="h-px"
    style={{ marginLeft: 48, backgroundColor: theme.border }}
  />
);

export const DashboardSettingsSection = ({
  backgroundActivity,
  backgroundSyncActivityEnabled,
  devDashboardSyncEnabled,
  isTestingNotification,
  notificationsEnabled,
  onPressRefreshInterval,
  onTestNotification,
  onToggleNotifications,
  refreshIntervalMinutes,
  theme,
}: DashboardSettingsSectionProps) => (
  <>
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
        onPress={onPressRefreshInterval}
        theme={theme}
      />
      <Divider theme={theme} />
      <SettingRow
        icon="notifications-outline"
        label="Notifications"
        theme={theme}
        rightElement={
          <Switch
            value={notificationsEnabled}
            onValueChange={onToggleNotifications}
            trackColor={{
              false: theme.border,
              true: Colors.status.success,
            }}
            thumbColor={Colors.white}
          />
        }
      />
      <Divider theme={theme} />
      {Platform.OS === "android" && (<>
        <SettingRow icon="battery-half-outline" label="Battery" onPress={() => void openBatterySettings()} theme={theme} />
        <Divider theme={theme} />
      </>)}
      <SettingRow
        icon="checkmark-circle-outline"
        label="Test Notification"
        onPress={onTestNotification}
        loading={isTestingNotification}
        theme={theme}
      />
    </View>
  </>
);
