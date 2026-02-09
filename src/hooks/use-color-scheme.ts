import type { ColorSchemeName } from "react-native";
import { useColorScheme as useNativeColorScheme } from "react-native";

import { useSettingsStore } from "@/stores/settings-store";

export function useColorScheme(): NonNullable<ColorSchemeName> {
  const systemColorScheme = useNativeColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);

  if (themePreference === "light" || themePreference === "dark") {
    return themePreference;
  }

  return systemColorScheme ?? "light";
}
