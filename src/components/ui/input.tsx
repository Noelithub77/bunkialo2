import {
  TextInput,
  View,
  Text,
  TextInputProps,
} from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <View className="gap-1">
      {label && (
        <Text className="ml-1 text-sm font-medium" style={{ color: theme.textSecondary }}>
          {label}
        </Text>
      )}
      <TextInput
        className="h-[52px] rounded-xl border px-4 text-base"
        style={[
          {
            backgroundColor: isDark ? Colors.gray[900] : Colors.gray[100],
            color: theme.text,
            borderColor: error ? Colors.status.danger : theme.border,
          },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...props}
      />
      {error && <Text className="ml-1 text-xs text-red-500">{error}</Text>}
    </View>
  );
}
