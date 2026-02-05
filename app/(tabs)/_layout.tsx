import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { withLayoutContext } from "expo-router";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { Navigator } = createMaterialTopTabNavigator();
const MaterialBottomTabs = withLayoutContext(Navigator);

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const tabLabelStyle = { fontSize: 12, lineHeight: 16 };
  const iconSize = 22;
  const tabBarContentHeight = iconSize + tabLabelStyle.lineHeight + 8;
  const tabBarHeight = tabBarContentHeight + insets.bottom;

  return (
    <MaterialBottomTabs
      initialRouteName="index"
      backBehavior="initialRoute"
      tabBarPosition="bottom"
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarAllowFontScaling: false,
        tabBarLabel: ({ color, children }) => (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[tabLabelStyle, { color }]}
          >
            {children}
          </Text>
        ),
        tabBarItemStyle: { paddingVertical: 0, height: tabBarContentHeight },
        tabBarShowIcon: true,
        tabBarIndicatorStyle: { height: 0 },
        tabBarStyle: {
          backgroundColor: isDark ? Colors.black : Colors.white,
          borderTopColor: theme.border,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: 2,
        },
        swipeEnabled: true,
      }}
    >
      {/* left side: faculty, timetable */}
      <MaterialBottomTabs.Screen
        name="faculty"
        options={{
          title: "Faculty",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="people-outline" size={iconSize} color={color} />
          ),
        }}
      />
      <MaterialBottomTabs.Screen
        name="timetable"
        options={{
          title: "Timetable",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="time-outline" size={iconSize} color={color} />
          ),
        }}
      />

      {/* center: dashboard */}
      <MaterialBottomTabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="grid-outline" size={iconSize} color={color} />
          ),
        }}
      />

      {/* right side: mess, attendance */}
      <MaterialBottomTabs.Screen
        name="mess"
        options={{
          title: "Mess",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="restaurant-outline" size={iconSize} color={color} />
          ),
        }}
      />
      <MaterialBottomTabs.Screen
        name="attendance"
        options={{
          title: "Bunks",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="calendar-outline" size={iconSize} color={color} />
          ),
        }}
      />
    </MaterialBottomTabs>
  );
}
