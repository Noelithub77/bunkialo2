import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import type { TimelineEvent } from "@/types";
import { extractCourseName } from "@/utils/course-name";
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
  const bunkCourses = useBunkStore((state) => state.courses);
  const isPastDue = isOverdue || event.overdue;
  const dueText = formatRelativeTime(event.timesort);
  const rawCourseName = event.course.fullname || event.course.shortname || "";
  const courseName = extractCourseName(rawCourseName) || "Course";
  const fallbackColor =
    Colors.courseColors[event.course.id % Colors.courseColors.length];
  const courseColor =
    bunkCourses.find((course) => course.courseId === String(event.course.id))
      ?.config?.color || fallbackColor;

  const openOnLms = () => {
    Linking.openURL(event.url);
  };

  return (
    <View
      className="gap-3 rounded-2xl border p-4"
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: isPastDue ? Colors.status.danger : theme.border,
        borderLeftWidth: 2,
        borderLeftColor: isPastDue ? Colors.status.danger : courseColor,
      }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View
          className="h-7 w-7 items-center justify-center rounded-lg"
          style={{
            backgroundColor: isPastDue
              ? Colors.status.danger
              : courseColor,
          }}
        >
          <Ionicons
            name="document-text-outline"
            size={14}
            color={Colors.white}
          />
        </View>
        <View className="flex-1 flex-row items-center justify-between gap-2">
          <Text
            className="flex-1 pr-2 text-[15px] font-semibold"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {courseName}
          </Text>
          <View
            className="self-start rounded-full px-2.5 py-1"
            style={{
              backgroundColor: isPastDue
                ? Colors.status.danger + "22"
                : Colors.status.info + "22",
            }}
          >
            <Text
              className="text-[11px] font-bold"
              style={{
                color: isPastDue ? Colors.status.danger : Colors.status.info,
                letterSpacing: 0.25,
              }}
            >
              {dueText}
            </Text>
          </View>
        </View>
      </View>

      <Text
        className="text-base font-semibold leading-6"
        style={{ color: theme.text }}
        numberOfLines={2}
      >
        {event.activityname}
      </Text>

      <View className="mt-1 flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-1.5">
          <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
          <Text
            className="text-[13px] font-medium"
            style={{ color: theme.textSecondary }}
            numberOfLines={1}
          >
            {formatDate(event.timesort)} at {formatTime(event.timesort)}
          </Text>
        </View>

        <Pressable
          className="rounded-full border px-3 py-1.5"
          style={({ pressed }) => ({
            backgroundColor: pressed
              ? isDark
                ? Colors.gray[800]
                : Colors.gray[100]
              : isDark
                ? Colors.gray[900]
                : Colors.gray[50],
            borderColor: isPastDue ? Colors.status.danger + "66" : theme.border,
          })}
          onPress={openOnLms}
        >
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs font-semibold" style={{ color: theme.text }}>
              Open LMS
            </Text>
            <Ionicons name="open-outline" size={12} color={theme.textSecondary} />
          </View>
        </Pressable>
      </View>
    </View>
  );
};
