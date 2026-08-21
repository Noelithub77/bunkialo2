import type { CSSProperties, ChangeEvent } from "react";
import { StyleSheet, Text, View, type TextInputProps, type TextStyle } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  webId?: string;
  webName?: string;
  webRequired?: boolean;
}

const getWebStyle = (style: InputProps["style"]): CSSProperties => {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  const paddingRight = flattened?.paddingRight;
  return typeof paddingRight === "number" || typeof paddingRight === "string"
    ? { paddingRight }
    : {};
};

export function Input({
  label,
  error,
  style,
  webId,
  webName,
  webRequired,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  inputMode,
  placeholder,
}: InputProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const inputStyle = getWebStyle(style);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChangeText?.(event.currentTarget.value);
  };

  return (
    <View className="gap-1">
      {label ? (
        <Text className="ml-1 text-sm font-medium" style={{ color: theme.textSecondary }}>
          {label}
        </Text>
      ) : null}
      <input
        aria-label={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect ? "on" : "off"}
        className="min-h-[52px] rounded-xl border px-4 py-3 text-base leading-5"
        id={webId}
        inputMode={inputMode}
        name={webName}
        onChange={handleChange}
        placeholder={placeholder}
      required={webRequired}
      style={{
          ...inputStyle,
          backgroundColor: isDark ? Colors.gray[900] : Colors.gray[100],
          borderColor: error ? Colors.status.danger : theme.border,
          color: theme.text,
          outline: "none",
        }}
        type={
          secureTextEntry ? "password" : inputMode === "email" ? "email" : "text"
        }
        value={value ?? ""}
      />
      {error ? <Text className="ml-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
