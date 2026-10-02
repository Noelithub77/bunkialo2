import type { ViewProps } from "react-native";

type GrainyGradientColors = [string, string?, string?, string?];

interface IGrainyGradient {
  width?: number;
  height?: number;
  colors?: GrainyGradientColors;
  speed?: number;
  animated?: boolean;
  intensity?: number;
  size?: number;
  enabled?: boolean;
  amplitude?: number;
  brightness?: number;
  style?: ViewProps["style"];
  /** Render at reduced resolution (0-1), stretched to full size. Default 0.5 */
  resolutionScale?: number;
  /** Stop animating after this many ms. 0 = never stop. Default 3000 */
  settleMs?: number;
}

export type { IGrainyGradient, GrainyGradientColors };
