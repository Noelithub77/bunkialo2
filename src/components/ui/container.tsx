import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ContainerProps extends ViewProps {
  safeArea?: boolean;
  className?: string;
}

export function Container({
  children,
  style,
  className,
  safeArea = true,
  ...props
}: ContainerProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";

  return (
    <View
      className={`flex-1 ${className ?? ""}`}
      style={[
        { backgroundColor: isDark ? Colors.black : Colors.white },
        safeArea && {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
