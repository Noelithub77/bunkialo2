import { Colors } from "@/constants/theme";
import type { NotificationInboxItem } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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

const SWIPE_ACTION_WIDTH = 80;
const SWIPE_THRESHOLD = 70;
const SWIPE_ACTIVE_OFFSET_X: [number, number] = [-10, 10];
const SWIPE_FAIL_OFFSET_Y: [number, number] = [-15, 15];
const ACTION_OPACITY_THRESHOLD = 20;

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Recently";
  return formatDistanceToNowStrict(date, { addSuffix: true });
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
  const isAttendance = item.source === "attendance";
  const sourceColor = isAttendance ? Colors.status.info : Colors.accent;
  const important = item.priority === "important";
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX(SWIPE_ACTIVE_OFFSET_X)
    .failOffsetY(SWIPE_FAIL_OFFSET_Y)
    .onUpdate((event) => {
      translateX.value = Math.max(
        -SWIPE_ACTION_WIDTH,
        Math.min(SWIPE_ACTION_WIDTH, event.translationX),
      );
    })
    .onEnd((event) => {
      if (event.translationX <= -SWIPE_THRESHOLD) {
        runOnJS(onClear)();
      } else if (event.translationX >= SWIPE_THRESHOLD && !item.isRead) {
        runOnJS(onMarkRead)();
      }
      translateX.value = withSpring(0, { damping: 20 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const readActionStyle = useAnimatedStyle(() => ({
    opacity: withTiming(translateX.value > ACTION_OPACITY_THRESHOLD ? 1 : 0, {
      duration: 150,
    }),
  }));
  const clearActionStyle = useAnimatedStyle(() => ({
    opacity: withTiming(translateX.value < -ACTION_OPACITY_THRESHOLD ? 1 : 0, {
      duration: 150,
    }),
  }));

  return (
    <View
      className="relative overflow-hidden rounded-2xl"
      accessibilityHint="Swipe right to mark as read or left to clear"
    >
      <Animated.View
        className="absolute inset-y-0 left-0 w-20 items-center justify-center gap-1 bg-emerald-500"
        style={readActionStyle}
      >
        <Ionicons name="checkmark-done" size={18} color={Colors.white} />
        <Text className="text-[11px] font-semibold text-white">
          {item.isRead ? "Read" : "Mark read"}
        </Text>
      </Animated.View>

      <Animated.View
        className="absolute inset-y-0 right-0 w-20 items-center justify-center gap-1"
        style={[{ backgroundColor: Colors.status.danger }, clearActionStyle]}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.white} />
        <Text className="text-[11px] font-semibold text-white">Clear</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardStyle}>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            accessibilityState={{ expanded }}
            className="overflow-hidden rounded-2xl border px-4 py-3.5 active:opacity-70"
            style={{
              backgroundColor: theme.backgroundSecondary,
              borderColor: item.isRead ? theme.border : `${sourceColor}70`,
            }}
          >
            <View className="flex-row gap-3">
              <View
                className="h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${sourceColor}18` }}
              >
                <Ionicons
                  name={isAttendance ? "calendar-outline" : "sparkles-outline"}
                  size={19}
                  color={sourceColor}
                />
              </View>

              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="min-w-0 flex-row items-center gap-2">
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: sourceColor }}
                    >
                      {isAttendance ? "Attendance" : "App"}
                    </Text>
                    <View
                      accessible
                      accessibilityLabel={`${important ? "Important" : "Normal"} priority`}
                      className="h-2 w-5 rounded-full"
                      style={{
                        backgroundColor: important
                          ? Colors.status.danger
                          : Colors.gray[500],
                      }}
                    />
                  </View>
                  <View className="shrink-0 flex-row items-center gap-2">
                    {!item.isRead && (
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: sourceColor }}
                      />
                    )}
                    <Text
                      className="text-[10px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                </View>

                <Text
                  selectable
                  className="text-[15px] font-semibold leading-5"
                  style={{ color: theme.text }}
                  numberOfLines={expanded ? undefined : 1}
                >
                  {item.title}
                </Text>
                <Text
                  selectable
                  className="text-[13px] leading-[19px]"
                  style={{ color: theme.textSecondary }}
                  numberOfLines={expanded ? undefined : 2}
                >
                  {item.body}
                </Text>

                {expanded && item.imageSource && (
                  <Image
                    source={item.imageSource}
                    style={{ width: "100%", height: 92, marginTop: 8 }}
                    contentFit="contain"
                  />
                )}

                {expanded && item.action && (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      onAction();
                    }}
                    className="mt-2 self-start rounded-xl px-3.5 py-2 active:opacity-70"
                    style={{ backgroundColor: sourceColor }}
                  >
                    <Text className="text-[12px] font-bold text-white">
                      {item.action.label}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
