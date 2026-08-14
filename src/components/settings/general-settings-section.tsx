import { Colors } from "@/constants/theme";
import { SettingRow } from "./setting-row";
import { Text, View } from "react-native";

type GeneralSettingsSectionProps = {
  isCheckingUpdate: boolean;
  onInstallPwa: () => void;
  onCheckForUpdates: () => void;
  onClearCache: () => void;
  onLogout: () => void;
  onResetBunks: () => void;
  onSetTheme: () => void;
  theme: typeof Colors.light;
  themeLabel: string;
  showPwaInstall: boolean;
};

export const GeneralSettingsSection = ({
  isCheckingUpdate,
  onInstallPwa,
  onCheckForUpdates,
  onClearCache,
  onLogout,
  onResetBunks,
  onSetTheme,
  theme,
  themeLabel,
  showPwaInstall,
}: GeneralSettingsSectionProps) => (
  <>
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
        label={`Theme: ${themeLabel}`}
        onPress={onSetTheme}
        theme={theme}
      />
      <View
        className="h-px"
        style={{ marginLeft: 48, backgroundColor: theme.border }}
      />
      <SettingRow
        icon="cloud-download-outline"
        label="Check for Updates"
        onPress={onCheckForUpdates}
        loading={isCheckingUpdate}
        theme={theme}
      />
      {showPwaInstall ? (
        <>
          <View
            className="h-px"
            style={{ marginLeft: 48, backgroundColor: theme.border }}
          />
          <SettingRow
            icon="download-outline"
            label="Install Bunkialo"
            onPress={onInstallPwa}
            theme={theme}
          />
        </>
      ) : null}
      <View
        className="h-px"
        style={{ marginLeft: 48, backgroundColor: theme.border }}
      />
      <SettingRow
        icon="trash-outline"
        label="Clear Cache"
        onPress={onClearCache}
        theme={theme}
      />
      <View
        className="h-px"
        style={{ marginLeft: 48, backgroundColor: theme.border }}
      />
      <SettingRow
        icon="refresh-circle-outline"
        label="Reset Bunks to LMS"
        onPress={onResetBunks}
        theme={theme}
      />
      <View
        className="h-px"
        style={{ marginLeft: 48, backgroundColor: theme.border }}
      />
      <SettingRow
        icon="log-out-outline"
        label="Logout"
        onPress={onLogout}
        danger
        theme={theme}
      />
    </View>
  </>
);
