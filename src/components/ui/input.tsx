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
  webId?: string;
  webName?: string;
  webRequired?: boolean;
}

export function Input({
  label,
  error,
  style,
  webId,
  webName,
  webRequired,
  ...props
}: InputProps) {
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
        className="min-h-[52px] rounded-xl border px-4 py-3 text-base leading-5"
        style={[
          {
            backgroundColor: isDark ? Colors.gray[900] : Colors.gray[100],
            color: theme.text,
            borderColor: error ? Colors.status.danger : theme.border,
            textAlignVertical: "center",
            includeFontPadding: false,
          },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        multiline={false}
        {...props}
      />
      {error && <Text className="ml-1 text-xs text-red-500">{error}</Text>}
    </View>
  );
}
