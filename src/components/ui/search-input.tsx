import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { forwardRef, type ComponentRef } from "react";
import {
  Pressable,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
} from "react-native";

interface SearchInputProps extends TextInputProps {
  onClear?: () => void;
  focused?: boolean;
}

export const SearchInput = forwardRef<ComponentRef<typeof TextInput>, SearchInputProps>(
  function SearchInput({ onClear, focused = false, style, value, ...props }, ref) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";
    const theme = isDark ? Colors.dark : Colors.light;
    const { width, fontScale } = useWindowDimensions();
    const compactLayout = width < 380;
    const largeText = fontScale > 1.1;
    const minHeight = largeText ? 64 : compactLayout ? 60 : 62;
    const horizontalPadding = compactLayout ? 14 : 16;
    const iconSize = largeText ? 20 : compactLayout ? 18 : 19;
    const inputFontSize = largeText ? 16 : compactLayout ? 14 : 15;
    const inputLineHeight = largeText ? 22 : compactLayout ? 18 : 20;

    return (
      <View
        className="flex-row items-center gap-3 rounded-[30px] border"
        style={{
          minHeight,
          paddingHorizontal: horizontalPadding,
          paddingVertical: 10,
          backgroundColor: isDark ? Colors.gray[900] : Colors.gray[100],
          borderColor: focused ? theme.text : "transparent",
        }}
      >
        <Ionicons
          name="search"
          size={iconSize}
          color={theme.textSecondary}
        />
        <TextInput
          ref={ref}
          className="flex-1 py-0"
          style={[
            {
              color: theme.text,
              fontSize: inputFontSize,
              lineHeight: inputLineHeight,
              textAlignVertical: "center",
              includeFontPadding: false,
            },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          value={value}
          multiline={false}
          numberOfLines={1}
          {...props}
        />
        {typeof value === "string" && value.length > 0 && onClear && (
          <Pressable onPress={onClear} hitSlop={8}>
            <Ionicons
              name="close-circle"
              size={iconSize}
              color={theme.textSecondary}
            />
          </Pressable>
        )}
      </View>
    );
  },
);
