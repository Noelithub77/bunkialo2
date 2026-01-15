import { Platform } from 'react-native'

// Minimalistic black and premium gray palette
export const Colors = {
  // Primary colors
  black: '#000000',
  white: '#FFFFFF',
  
  // Gray scale - premium tones
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },
  
  // Accent colors for status
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },

  // Session type colors
  sessionType: {
    regular: '#6B7280',
    lab: '#8B5CF6',
    tutorial: '#14B8A6',
  },
  
  // Theme colors
  light: {
    text: '#171717',
    textSecondary: '#525252',
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    border: '#E5E5E5',
    tint: '#171717',
    icon: '#525252',
    tabIconDefault: '#A3A3A3',
    tabIconSelected: '#171717',
  },
  dark: {
    text: '#FAFAFA',
    textSecondary: '#A3A3A3',
    background: '#000000',
    backgroundSecondary: '#0A0A0A',
    border: '#262626',
    tint: '#FFFFFF',
    icon: '#A3A3A3',
    tabIconDefault: '#525252',
    tabIconSelected: '#FFFFFF',
  },
}

// Gradient presets for LinearGradient
export const Gradients = {
  dark: {
    card: ['#171717', '#0A0A0A'],
    header: ['#262626', '#171717'],
    button: ['#262626', '#171717'],
    overlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)'],
  },
  light: {
    card: ['#FFFFFF', '#F5F5F5'],
    header: ['#FAFAFA', '#F5F5F5'],
    button: ['#262626', '#171717'],
    overlay: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)'],
  },
}

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

// Border radius
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
}

// Calendar theme for react-native-calendars
export const CalendarTheme = {
  light: {
    calendarBackground: 'transparent',
    dayTextColor: '#171717',
    textDisabledColor: '#D4D4D4',
    monthTextColor: '#171717',
    arrowColor: '#525252',
    todayTextColor: '#3B82F6',
  },
  dark: {
    calendarBackground: 'transparent',
    dayTextColor: '#FAFAFA',
    textDisabledColor: '#525252',
    monthTextColor: '#FAFAFA',
    arrowColor: '#A3A3A3',
    todayTextColor: '#3B82F6',
  },
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
