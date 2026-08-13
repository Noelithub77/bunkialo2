import { memo } from "react";
import { View } from "react-native";
import type { IGrainyGradient } from "./types";

const WebGrainyGradient = ({
  colors = ["#5b0bb5", "#7c3aed", "#fb923c", "#db2777"],
  height,
  style,
  width,
}: IGrainyGradient) => {
  const activeColors = colors.filter((color): color is string => Boolean(color));
  const stops = activeColors.length > 1 ? activeColors : [activeColors[0] ?? "#111113", "#26262C"];

  return (
    <View
      style={[
        {
          width: width ?? "100%",
          height: height ?? "100%",
          backgroundImage: `linear-gradient(135deg, ${stops.join(", ")})`,
        },
        style,
      ]}
    />
  );
};

export default memo(WebGrainyGradient);
