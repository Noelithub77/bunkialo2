import type { ReactNode } from "react";
import { Platform, View } from "react-native";

export function NotificationReadContent({
  children,
  softened,
}: {
  children: ReactNode;
  softened: boolean;
}) {
  return (
    <View
      style={{
        opacity: softened ? 0.6 : 1,
        // Blur this card's pixels, never the screen behind the modal.
        filter:
          softened &&
          Platform.OS === "android" &&
          Number(Platform.Version) >= 31
            ? [{ blur: 0.6 }]
            : undefined,
      }}
    >
      {children}
    </View>
  );
}
