import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { View, type ViewProps } from "react-native";

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
  const isDark = useColorScheme() === "dark";

  return (
    <View
      className={`mx-auto w-full max-w-[1180px] flex-1 ${className ?? ""}`}
      style={[
        { backgroundColor: isDark ? Colors.black : Colors.white },
        safeArea && { paddingTop: 12, paddingBottom: 12 },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
