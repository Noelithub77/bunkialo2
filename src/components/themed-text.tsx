import { Text, type TextProps } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

const TEXT_VARIANTS = {
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold" as const,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold" as const,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: "#0a7ea4",
  },
} as const;

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return (
    <Text
      style={[
        { color },
        type === "default" ? TEXT_VARIANTS.default : undefined,
        type === "title" ? TEXT_VARIANTS.title : undefined,
        type === "defaultSemiBold" ? TEXT_VARIANTS.defaultSemiBold : undefined,
        type === "subtitle" ? TEXT_VARIANTS.subtitle : undefined,
        type === "link" ? TEXT_VARIANTS.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}
