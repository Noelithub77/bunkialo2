import * as ExpoBlur from "expo-blur";
import React from "react";
import { View } from "react-native";

interface Props {
  children: React.ReactNode;
  softened: boolean;
}

// SDK 58 needs an explicit target; SDK 54 captures the preceding content.
const Target =
  (
    ExpoBlur as typeof ExpoBlur & {
      BlurTargetView?: React.ComponentType<
        React.ComponentPropsWithRef<typeof View>
      >;
    }
  ).BlurTargetView ?? View;

export function NotificationReadContent({ children, softened }: Props) {
  const target = React.useRef<View>(null);
  return (
    <View
      className="relative overflow-hidden"
      style={{ opacity: softened ? 0.6 : 1 }}
    >
      <Target ref={target}>{children}</Target>
      {softened && (
        <ExpoBlur.BlurView
          {...(Target === View
            ? { experimentalBlurMethod: "dimezisBlurView" as const }
            : { blurTarget: target, blurMethod: "dimezisBlurView" as const })}
          pointerEvents="none"
          intensity={5}
          tint="default"
          style={{ position: "absolute", inset: 0 }}
        />
      )}
    </View>
  );
}
