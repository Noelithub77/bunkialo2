import { type ViewProps, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Gradients } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface GradientCardProps extends ViewProps {
  variant?: "card" | "header" | "button";
  className?: string;
  contentClassName?: string;
}

export function GradientCard({
  children,
  style,
  className,
  contentClassName,
  variant = "card",
  ...props
}: GradientCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const gradients = isDark ? Gradients.dark : Gradients.light;
  const colors = gradients[variant] as [string, string];

  return (
    <View
      className={`overflow-hidden rounded-2xl border ${className ?? ""}`}
      style={[{ borderColor: Colors.gray[800] }, style]}
      {...props}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View className={`p-4 ${contentClassName ?? ""}`}>{children}</View>
    </View>
  );
}
