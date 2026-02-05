import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TimelineEvent } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, Text, View } from "react-native";

type EventCardProps = {
  event: TimelineEvent;
  isOverdue?: boolean;
};

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = timestamp * 1000 - now;
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    if (days > 0) return `${days}d overdue`;
    if (hours > 0) return `${hours}h overdue`;
    return `${minutes}m overdue`;
  }

  if (days > 0) return `in ${days}d`;
  if (hours > 0) return `in ${hours}h`;
  return `in ${minutes}m`;
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

export const EventCard = ({ event, isOverdue }: EventCardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const openOnLms = () => {
    Linking.openURL(event.url);
  };

  return (
    <View
      className="gap-3 rounded-xl border p-4"
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: isOverdue ? Colors.status.danger : theme.border,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-7 w-7 items-center justify-center rounded-lg"
          style={{
            backgroundColor: isOverdue
              ? Colors.status.danger
              : Colors.status.info,
          }}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={Colors.white}
          />
        </View>
        <View className="flex-1 flex-row items-center justify-between">
          <Text
            className="text-xs font-medium"
            style={{ color: theme.textSecondary }}
            numberOfLines={1}
          >
            {event.course.shortname}
          </Text>
          <Text
            className="text-xs font-semibold"
            style={{
              color: isOverdue ? Colors.status.danger : theme.textSecondary,
            }}
          >
            {formatRelativeTime(event.timesort)}
          </Text>
        </View>
      </View>

      <Text
        className="text-[15px] font-semibold leading-5"
        style={{ color: theme.text }}
        numberOfLines={2}
      >
        {event.activityname}
      </Text>

      <Text className="text-[13px]" style={{ color: theme.textSecondary }}>
        {formatDate(event.timesort)} at {formatTime(event.timesort)}
      </Text>

      <Pressable
        className="mt-2 items-center justify-center rounded-lg border py-2"
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.border : "transparent",
          borderColor: theme.border,
        })}
        onPress={openOnLms}
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-[13px] font-medium" style={{ color: theme.text }}>
            View on LMS
          </Text>
          <Ionicons name="open-outline" size={14} color={theme.textSecondary} />
        </View>
      </Pressable>
    </View>
  );
};
