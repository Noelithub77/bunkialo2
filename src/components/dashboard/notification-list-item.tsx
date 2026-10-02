import { NotificationReadContent } from "./notification-read-content";
import { Colors } from "@/constants/theme";
import { notificationAppearance } from "@/utils/portal-notification";
import type { NotificationInboxItem } from "@/types";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface NotificationListItemProps {
  item: NotificationInboxItem;
  expanded: boolean;
  theme: {
    text: string;
    textSecondary: string;
    backgroundSecondary: string;
    border: string;
  };
  onPress: () => void;
  onAction: () => void;
  onMarkRead: () => void;
  onClear: () => void;
}

const compactTime = (timestamp: string): string => {
  if (!Number.isFinite(Date.parse(timestamp))) return "";
  return formatDistanceToNowStrict(new Date(timestamp))
    .replace(/ seconds?/, "s")
    .replace(/ minutes?/, "m")
    .replace(/ hours?/, "h")
    .replace(/ days?/, "d")
    .replace(/ months?/, "mo")
    .replace(/ years?/, "y");
};

export function NotificationListItem({
  item,
  expanded,
  theme,
  onPress,
  onAction,
  onMarkRead,
  onClear,
}: NotificationListItemProps) {
  const appearance = notificationAppearance(item.kind ?? item.source);
  const translateX = useSharedValue(0);
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      translateX.value = Math.max(-72, Math.min(72, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX < -60) runOnJS(onClear)();
      else if (event.translationX > 60 && !item.isRead) runOnJS(onMarkRead)();
      translateX.value = withSpring(0, {
        damping: 22,
        reduceMotion: ReduceMotion.System,
      });
    });
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const readStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 0 ? 1 : 0,
    flex: 1,
  }));
  const clearStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < 0 ? 1 : 0,
    flex: 1,
  }));
  return (
    <Animated.View
      entering={FadeInDown.duration(180).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(180).reduceMotion(ReduceMotion.System)}
      className="relative overflow-hidden rounded-2xl"
    >
      <View className="absolute inset-y-0 left-0 w-[72px]">
        <Animated.View style={readStyle}>
          <View className="flex-1 items-center justify-center rounded-2xl bg-emerald-500">
            <Ionicons name="checkmark-done" size={23} color={Colors.white} />
          </View>
        </Animated.View>
      </View>
      <View className="absolute inset-y-0 right-0 w-[72px]">
        <Animated.View style={clearStyle}>
          <View
            className="flex-1 items-center justify-center rounded-2xl"
            style={{ backgroundColor: Colors.status.danger }}
          >
            <Ionicons name="trash-outline" size={22} color={Colors.white} />
          </View>
        </Animated.View>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <View
            className="rounded-2xl"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={`${item.isRead ? "Read" : "Unread"}: ${item.title}`}
              accessibilityHint="Swipe right to mark read, left to clear"
              accessibilityState={{ expanded }}
              className="rounded-2xl px-3.5 py-3.5 active:opacity-80"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <NotificationReadContent softened={item.isRead && !expanded}>
                <View className="flex-row items-start gap-3">
                  <View
                    className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${appearance.color}1A` }}
                  >
                    <MaterialCommunityIcons
                      name={appearance.icon}
                      size={23}
                      color={appearance.color}
                    />
                  </View>
                  <View className="min-w-0 flex-1 gap-1.5">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text
                        className="text-[10px]"
                        style={{ color: theme.textSecondary }}
                      >
                        {compactTime(item.createdAt)}
                      </Text>
                      {!item.isRead && (
                        <View
                          accessibilityLabel="Unread"
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: appearance.color }}
                        />
                      )}
                    </View>
                    <Text
                      className="text-[14px] font-semibold leading-5"
                      style={{ color: theme.text }}
                      numberOfLines={expanded ? undefined : 2}
                    >
                      {item.title}
                    </Text>
                    {item.body.trim() !== "" && (
                      <Text
                        className="text-[12px] leading-[18px]"
                        style={{ color: theme.textSecondary }}
                        numberOfLines={expanded ? undefined : 1}
                      >
                        {item.body}
                      </Text>
                    )}
                    {expanded && item.imageSource && (
                      <Image
                        source={
                          item.imageSource as React.ComponentProps<
                            typeof Image
                          >["source"]
                        }
                        style={{ width: "100%", height: 92 }}
                        contentFit="contain"
                      />
                    )}
                  </View>
                </View>
              </NotificationReadContent>
            </Pressable>
            {expanded && (
              <Animated.View
                entering={FadeInDown.duration(150).reduceMotion(
                  ReduceMotion.System,
                )}
                className="flex-row justify-end gap-2 px-3.5 pb-3.5"
              >
                {!item.isRead && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mark read"
                    onPress={(event) => {
                      event.stopPropagation();
                      onMarkRead();
                    }}
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${appearance.color}18` }}
                  >
                    <Ionicons
                      name="checkmark-done-outline"
                      size={19}
                      color={appearance.color}
                    />
                  </Pressable>
                )}
                {item.action && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.action.label}
                    onPress={(event) => {
                      event.stopPropagation();
                      onAction();
                    }}
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${appearance.color}18` }}
                  >
                    <Ionicons
                      name="open-outline"
                      size={18}
                      color={appearance.color}
                    />
                  </Pressable>
                )}
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
