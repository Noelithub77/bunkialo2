import {
  CATEGORY_META,
  formatRange,
  parseISODate,
  toISODate,
} from "@/components/acad-cal/constants";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { AcademicEvent } from "@/types";
import { isVisibleAcademicEvent } from "@/utils/academic-event-visibility";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { Linking } from "react-native";

type AcademicEventCardProps = {
  event: AcademicEvent;
  onPress: () => void;
};

const formatRelativeDate = (date: string): string => {
  const today = parseISODate(toISODate(new Date()));
  const eventDate = parseISODate(date);
  const days = Math.round(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (days === 0) return "today";
  if (days > 0) return `in ${days}d`;
  return `${Math.abs(days)}d ago`;
};

const formatClock = (value: string): string =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));

const formatTimedEvent = (event: AcademicEvent): string | null => {
  if (!event.startAt || event.allDay) return null;
  const end = event.endAt ? new Date(event.endAt) : null;
  const time = end
    ? `${formatClock(event.startAt)} - ${formatClock(event.endAt ?? event.startAt)}`
    : formatClock(event.startAt);

  if (!event.endDate) return time;
  return `${formatRange(event)} • ${time}`;
};

export const AcademicEventCard = ({
  event,
  onPress,
}: AcademicEventCardProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  if (!isVisibleAcademicEvent(event)) return null;
  const cardBorder = isDark ? Colors.gray[600] : theme.border;
  const meta = CATEGORY_META[event.category];
  const hasDateRange = event.endDate !== undefined && event.endDate !== event.date;
  const timeText = event.origin === "google-calendar"
    ? formatTimedEvent(event)
    : hasDateRange
      ? formatRange(event)
      : null;
  const openCalendar = async (): Promise<void> => {
    if (!event.calendarUrl) {
      onPress();
      return;
    }
    if (await Linking.canOpenURL(event.calendarUrl)) {
      await Linking.openURL(event.calendarUrl);
    }
  };

  return (
    <Pressable
      onPress={() => void openCalendar()}
      className="gap-3 rounded-2xl border p-4"
      style={({ pressed }) => ({
        backgroundColor: pressed
          ? isDark
            ? Colors.gray[800]
            : Colors.gray[100]
          : theme.backgroundSecondary,
        borderColor: cardBorder,
        borderLeftWidth: 2,
        borderLeftColor: meta.color,
      })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View
          className="h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: meta.color }}
        >
          <Ionicons name={meta.icon} size={14} color={Colors.white} />
        </View>
        <View className="flex-1 flex-row items-center justify-between gap-2">
          <Text
            className="flex-1 pr-2 text-[15px] font-semibold"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {meta.label}
          </Text>
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: meta.color + "22" }}>
            <Text
              className="text-[11px] font-bold"
              style={{ color: meta.color, letterSpacing: 0.25 }}
            >
              {formatRelativeDate(event.date)}
            </Text>
          </View>
        </View>
      </View>

      <Text
        className="text-base font-semibold leading-6"
        style={{ color: theme.text }}
        numberOfLines={2}
      >
        {event.title}
      </Text>

      <View
        className="mt-1 flex-row items-end justify-between gap-3"
      >
        {(timeText || event.location) && (
          <View className="flex-1 gap-1.5">
            {timeText && (
              <View className="flex-row items-center gap-1.5">
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={theme.textSecondary}
                />
                <Text
                  className="text-[13px] font-medium"
                  style={{ color: theme.textSecondary }}
                  numberOfLines={1}
                >
                  {timeText}
                  {event.isTentative ? " • Tentative" : ""}
                </Text>
              </View>
            )}
            {event.location && (
              <View className="flex-row items-center gap-1.5">
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.textSecondary}
                />
                <Text
                  className="text-[13px] font-medium"
                  style={{ color: theme.textSecondary }}
                  numberOfLines={1}
                >
                  {event.location}
                </Text>
              </View>
            )}
          </View>
        )}

        <Pressable
          className="ml-auto rounded-full border px-3 py-1.5"
          style={({ pressed }) => ({
            backgroundColor: pressed
              ? isDark
                ? Colors.gray[800]
                : Colors.gray[100]
              : isDark
                ? Colors.gray[900]
                : Colors.gray[50],
            borderColor: cardBorder,
          })}
          onPress={(pressedEvent) => {
            pressedEvent.stopPropagation();
            void openCalendar();
          }}
        >
          <View className="flex-row items-center gap-1.5">
            <Text className="text-xs font-semibold" style={{ color: theme.text }}>
              Calendar
            </Text>
            <Ionicons name="open-outline" size={12} color={theme.textSecondary} />
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
};
