import { Colors } from "@/constants/theme";
import { Text, View } from "react-native";
import { SettingRow } from "./setting-row";

type PortalSettingsSectionProps = {
  isConnected: boolean;
  isBusy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  theme: typeof Colors.light;
};

export const PortalSettingsSection = ({
  isConnected,
  isBusy,
  onConnect,
  onDisconnect,
  theme,
}: PortalSettingsSectionProps) => (
  <>
    <Text
      className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase"
      style={{ color: theme.textSecondary }}
    >
      Attendance Portal
    </Text>
    <View
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: theme.border }}
    >
      {isConnected ? (
        <SettingRow
          icon="link-outline"
          label="Disconnect Portal"
          onPress={onDisconnect}
          loading={isBusy}
          danger
          theme={theme}
        />
      ) : (
        <SettingRow
          icon="link-outline"
          label="Connect Attendance Portal"
          onPress={onConnect}
          loading={isBusy}
          theme={theme}
        />
      )}
    </View>
    <Text
      className="mt-2 ml-1 text-[11px] leading-4"
      style={{ color: theme.textSecondary }}
    >
      {isConnected
        ? "Attendance and timetable come from attendance.iiitkottayam.ac.in."
        : "Moodle no longer tracks attendance. Connect the portal to restore attendance and timetable."}
    </Text>
  </>
);
