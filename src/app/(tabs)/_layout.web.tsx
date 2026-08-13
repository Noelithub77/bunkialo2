import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { Link, Slot, router, usePathname } from "expo-router";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import {
  PanResponder,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];
type TabItem = {
  href: "/faculty" | "/timetable" | "/" | "/mess" | "/attendance";
  icon: IconName;
  label: string;
  path: string;
};

const TABS: TabItem[] = [
  {
    href: "/faculty",
    icon: "people-outline",
    label: "Faculty",
    path: "/faculty",
  },
  {
    href: "/timetable",
    icon: "time-outline",
    label: "Timetable",
    path: "/timetable",
  },
  { href: "/", icon: "grid-outline", label: "Dashboard", path: "/" },
  {
    href: "/mess",
    icon: "restaurant-outline",
    label: "Mess",
    path: "/mess",
  },
  {
    href: "/attendance",
    icon: "calendar-outline",
    label: "Bunks",
    path: "/attendance",
  },
];

const SWIPE_DISTANCE = 64;

const getSwipeTarget = (
  currentIndex: number,
  horizontalDistance: number,
): TabItem | null => {
  if (Math.abs(horizontalDistance) < SWIPE_DISTANCE) return null;

  const direction = horizontalDistance > 0 ? 1 : -1;
  const targetIndex = currentIndex + direction;
  return TABS[targetIndex] ?? null;
};

const NavigationItem = ({
  item,
  compact,
}: {
  compact: boolean;
  item: TabItem;
}) => {
  const pathname = usePathname();
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const selected = pathname === item.path;

  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        className={
          compact
            ? "min-w-[64px] flex-1 items-center gap-1 rounded-xl px-2 py-2"
            : "w-full flex-row items-center gap-3 rounded-xl px-3 py-3"
        }
        style={{ backgroundColor: selected ? theme.backgroundSecondary : "transparent" }}
      >
        <Ionicons
          name={item.icon}
          size={compact ? 21 : 22}
          color={selected ? theme.text : theme.textSecondary}
        />
        <Text
          className={compact ? "text-[11px] font-medium" : "text-sm font-semibold"}
          style={{ color: selected ? theme.text : theme.textSecondary }}
        >
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
};

export default function WebTabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const pathname = usePathname();
  const currentIndex = Math.max(
    0,
    TABS.findIndex((item) => item.path === pathname),
  );
  const swipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderRelease: (_, gestureState) => {
          const target = getSwipeTarget(currentIndex, gestureState.dx);
          if (target && target.path !== pathname) {
            router.replace(target.href);
          }
        },
      }),
    [currentIndex, pathname],
  );

  const content = (
    <View className="min-w-0 flex-1" {...swipeResponder.panHandlers}>
      <Slot />
    </View>
  );

  if (!isDesktop) {
    return (
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        {content}
        <View
          className="flex-row gap-1 border-t px-2 pb-2 pt-1"
          style={{ backgroundColor: theme.background, borderColor: theme.border }}
        >
          {TABS.map((item) => <NavigationItem compact item={item} key={item.path} />)}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row" style={{ backgroundColor: theme.background }}>
      <View
        className="w-[240px] border-r px-4 py-6"
        style={{ backgroundColor: theme.background, borderColor: theme.border }}
      >
        <View className="mb-8 gap-1 px-2">
          <Text className="text-2xl font-black tracking-[-1px]" style={{ color: theme.text }}>
            Bunkialo
          </Text>
          <Text className="text-xs" style={{ color: theme.textSecondary }}>
            Student dashboard
          </Text>
        </View>
        <View className="gap-1">
          {TABS.map((item) => <NavigationItem compact={false} item={item} key={item.path} />)}
        </View>
      </View>
      {content}
    </View>
  );
}
