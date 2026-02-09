import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const themePreference = useSettingsStore((state) => state.themePreference);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (themePreference === "light" || themePreference === "dark") {
    return themePreference;
  }

  if (hasHydrated) {
    return colorScheme ?? "light";
  }

  return "light";
}
