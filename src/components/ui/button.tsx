import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Gradients } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: ViewStyle;
  className?: string;
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  className,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isDisabled = disabled || loading;

  if (variant === "ghost") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        className={`h-11 items-center justify-center ${className ?? ""}`}
        style={({ pressed }) => [
          pressed && { opacity: 0.8 },
          isDisabled && { opacity: 0.5 },
          style,
        ]}
      >
        <Text
          className="text-sm font-medium"
          style={{ color: isDark ? Colors.white : Colors.black }}
        >
          {title}
        </Text>
      </Pressable>
    );
  }

  if (variant === "secondary") {
    const secondaryBg = isDark ? Colors.gray[800] : Colors.gray[100];
    const secondaryBorder = isDark ? Colors.gray[600] : Colors.gray[300];
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        className={`h-[52px] items-center justify-center rounded-xl border ${className ?? ""}`}
        style={({ pressed }) => [
          { borderColor: secondaryBorder, backgroundColor: secondaryBg },
          pressed && { opacity: 0.8 },
          isDisabled && { opacity: 0.5 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isDark ? Colors.white : Colors.black} />
        ) : (
          <Text
            className="text-base font-semibold"
            style={{ color: isDark ? Colors.white : Colors.black }}
          >
            {title}
          </Text>
        )}
      </Pressable>
    );
  }

  if (variant === "danger") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        className={`h-[52px] items-center justify-center rounded-xl border ${className ?? ""}`}
        style={({ pressed }) => [
          {
            backgroundColor: Colors.status.danger,
            borderColor: Colors.status.danger,
          },
          pressed && { opacity: 0.8 },
          isDisabled && { opacity: 0.5 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text className="text-base font-semibold" style={{ color: Colors.white }}>
            {title}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`overflow-hidden rounded-xl border ${className ?? ""}`}
      style={({ pressed }) => [
        { borderColor: Colors.gray[700] },
        pressed && { opacity: 0.8 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      <LinearGradient
        colors={Gradients.dark.button as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="h-[52px] w-full items-center justify-center"
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text className="text-base font-semibold" style={{ color: Colors.white }}>
            {title}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
