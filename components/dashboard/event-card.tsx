import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import type { TimelineEvent } from "@/types";
import { extractCourseName } from "@/utils/course-name";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

type EventCardProps = {
  event: TimelineEvent;
  isOverdue?: boolean;
};

const formatRelativeTime = (timestamp: number, nowMs: number): string => {
  const diff = timestamp * 1000 - nowMs;
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

const formatRelativeTimeWithSeconds = (timestamp: number, nowMs: number): string => {
  const diff = timestamp * 1000 - nowMs;
  const absDiffSeconds = Math.floor(Math.abs(diff) / 1000);
  const minutes = Math.floor(absDiffSeconds / 60);
  const seconds = absDiffSeconds % 60;
  const secondsText = seconds.toString().padStart(2, "0");

  if (diff < 0) {
    return `${minutes}:${secondsText} overdue`;
  }
  return `in ${minutes}:${secondsText}`;
};

const formatDetailedRelativeTime = (timestamp: number, nowMs: number): string => {
  const diff = timestamp * 1000 - nowMs;
  const absDiffSeconds = Math.floor(Math.abs(diff) / 1000);
  const days = Math.floor(absDiffSeconds / 86400);
  const hours = Math.floor((absDiffSeconds % 86400) / 3600);
  const minutes = Math.floor((absDiffSeconds % 3600) / 60);
  const seconds = absDiffSeconds % 60;
  const secondsText = seconds.toString().padStart(2, "0");

  if (days > 0) {
    return diff < 0
      ? `${days}d ${hours}h ${minutes}m ${secondsText}s overdue`
      : `in ${days}d ${hours}h ${minutes}m ${secondsText}s`;
  }
  if (hours > 0) {
    return diff < 0
      ? `${hours}h ${minutes}m ${secondsText}s overdue`
      : `in ${hours}h ${minutes}m ${secondsText}s`;
  }
  return formatRelativeTimeWithSeconds(timestamp, nowMs);
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
  const [nowMs, setNowMs] = useState(Date.now());
  const [showPreciseCountdown, setShowPreciseCountdown] = useState(false);
  const bunkCourses = useBunkStore((state) => state.courses);
  const isPastDue = isOverdue || event.overdue;
  const msToDue = event.timesort * 1000 - nowMs;
  const isWithinNextHour = msToDue > 0 && msToDue <= 60 * 60 * 1000;
  const dueText =
    isWithinNextHour
      ? formatRelativeTimeWithSeconds(event.timesort, nowMs)
      : showPreciseCountdown
        ? formatDetailedRelativeTime(event.timesort, nowMs)
        : formatRelativeTime(event.timesort, nowMs);
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

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
          <Pressable
            className="self-start rounded-full px-2.5 py-1"
            style={{
              backgroundColor: isPastDue
                ? Colors.status.danger + "22"
                : courseColor + "22",
            }}
            onPress={() => {
              if (!isWithinNextHour) {
                setShowPreciseCountdown((prev) => !prev);
              }
            }}
          >
            <Text
              className="text-[11px] font-bold"
              style={{
                color: isPastDue ? Colors.status.danger : courseColor,
                letterSpacing: 0.25,
              }}
            >
              {dueText}
            </Text>
          </Pressable>
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
            {formatTime(event.timesort)}
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
