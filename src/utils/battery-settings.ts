import { Linking, Platform } from "react-native";

export const openBatterySettings = async (): Promise<void> => {
  if (Platform.OS !== "android") return;
  try {
    const { startActivityAsync } = await import("expo-intent-launcher");
    await startActivityAsync("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
  } catch {
    await Linking.openSettings();
  }
};
