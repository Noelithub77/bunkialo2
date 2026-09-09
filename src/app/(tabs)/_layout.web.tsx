import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useGestureUiStore } from "@/stores/gesture-ui-store";
import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Link, usePathname, withLayoutContext } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

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

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

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
        accessibilityState={{ selected }}
        className={
          compact
            ? "min-w-[64px] flex-1 items-center gap-1 rounded-xl px-2 py-2"
            : "w-full flex-row items-center gap-3 rounded-xl px-3 py-3"
        }
        style={{
          backgroundColor: selected
            ? theme.backgroundSecondary
            : "transparent",
        }}
      >
        <Ionicons
          name={item.icon}
          size={compact ? 21 : 22}
          color={selected ? theme.text : theme.textSecondary}
        />
        <Text
          className={
            compact ? "text-[11px] font-medium" : "text-sm font-semibold"
          }
          style={{ color: selected ? theme.text : theme.textSecondary }}
        >
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
};

const WebTabNavigator = ({
  backgroundColor,
  isHorizontalContentGestureActive,
}: {
  backgroundColor: string;
  isHorizontalContentGestureActive: boolean;
}) => (
  <View className="min-w-0 flex-1">
    <MaterialTopTabs
      initialRouteName="index"
      backBehavior="initialRoute"
      tabBar={() => null}
      screenOptions={{
        sceneStyle: { backgroundColor },
        swipeEnabled: !isHorizontalContentGestureActive,
        lazy: true,
        lazyPreloadDistance: 1,
      }}
    >
      <MaterialTopTabs.Screen
        name="faculty"
        options={{ title: "Faculty" }}
      />
      <MaterialTopTabs.Screen
        name="timetable"
        options={{ title: "Timetable" }}
      />
      <MaterialTopTabs.Screen
        name="index"
        options={{ title: "Dashboard" }}
      />
      <MaterialTopTabs.Screen name="mess" options={{ title: "Mess" }} />
      <MaterialTopTabs.Screen
        name="attendance"
        options={{ title: "Bunks" }}
      />
    </MaterialTopTabs>
  </View>
);

export default function WebTabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const isHorizontalContentGestureActive = useGestureUiStore(
    (state) => state.isHorizontalContentGestureActive,
  );

  const content = (
    <WebTabNavigator
      backgroundColor={theme.background}
      isHorizontalContentGestureActive={isHorizontalContentGestureActive}
    />
  );

  if (!isDesktop) {
    return (
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        {content}
        <View
          className="flex-row gap-1 border-t px-2 pb-2 pt-1"
          style={{ backgroundColor: theme.background, borderColor: theme.border }}
        >
          {TABS.map((item) => (
            <NavigationItem compact item={item} key={item.path} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 flex-row"
      style={{ backgroundColor: theme.background }}
    >
      <View
        className="w-[240px] border-r px-4 py-6"
        style={{ backgroundColor: theme.background, borderColor: theme.border }}
      >
        <View className="mb-8 gap-1 px-2">
          <Text
            className="text-2xl font-black tracking-[-1px]"
            style={{ color: theme.text }}
          >
            Bunkialo
          </Text>
          <Text className="text-xs" style={{ color: theme.textSecondary }}>
            Student dashboard
          </Text>
        </View>
        <View className="gap-1">
          {TABS.map((item) => (
            <NavigationItem compact={false} item={item} key={item.path} />
          ))}
        </View>
      </View>
      {content}
    </View>
  );
}
