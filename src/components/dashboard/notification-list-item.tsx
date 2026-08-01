import { Colors } from "@/constants/theme";
import type { NotificationInboxItem } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

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
}

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
}: NotificationListItemProps) {
  const isAttendance = item.source === "attendance";
  const sourceColor = isAttendance ? Colors.status.info : Colors.accent;
  const important = item.priority === "important";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
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
                className="text-[10px] font-bold uppercase tracking-[0.7px]"
                style={{ color: sourceColor }}
              >
                {isAttendance ? "Attendance" : "App"}
              </Text>
              {important && (
                <View className="rounded-full bg-red-500/10 px-2 py-0.5">
                  <Text className="text-[9px] font-bold uppercase text-red-500">
                    Important
                  </Text>
                </View>
              )}
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
  );
}
