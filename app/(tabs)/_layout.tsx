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
  const tabLabelStyle = { fontSize: 12, lineHeight: 14 };
  const iconSize = 22;
  const tabBarBaseHeight = 56;

  return (
    <MaterialBottomTabs
      initialRouteName="index"
      backBehavior="initialRoute"
      lazy
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
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarShowIcon: true,
        tabBarIndicatorStyle: { height: 0 },
        tabBarStyle: {
          backgroundColor: isDark ? Colors.black : Colors.white,
          borderTopColor: theme.border,
          height: tabBarBaseHeight + insets.bottom,
          paddingBottom: Math.max(6, insets.bottom),
          paddingTop: 6,
        },
        swipeEnabled: true,
      }}
    >
      {/* left side: faculty, timetable */}
      <MaterialBottomTabs.Screen
        name="faculty"
        options={{
          title: "Faculty",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={iconSize} color={color} />
          ),
        }}
      />
      <MaterialBottomTabs.Screen
        name="timetable"
        options={{
          title: "Timetable",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={iconSize} color={color} />
          ),
        }}
      />

      {/* center: dashboard */}
      <MaterialBottomTabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={iconSize} color={color} />
          ),
        }}
      />

      {/* right side: mess, attendance */}
      <MaterialBottomTabs.Screen
        name="mess"
        options={{
          title: "Mess",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={iconSize} color={color} />
          ),
        }}
      />
      <MaterialBottomTabs.Screen
        name="attendance"
        options={{
          title: "Bunks",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={iconSize} color={color} />
          ),
        }}
      />
    </MaterialBottomTabs>
  );
}
