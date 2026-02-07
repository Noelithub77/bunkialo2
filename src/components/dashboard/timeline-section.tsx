import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { TimelineEvent } from "@/types";
import { Text, View } from "react-native";
import { EventCard } from "./event-card";

type TimelineSectionProps = {
  events: TimelineEvent[];
};

const groupByDate = (events: TimelineEvent[]): Map<string, TimelineEvent[]> => {
  const groups = new Map<string, TimelineEvent[]>();

  events.forEach((event) => {
    const date = new Date(event.timesort * 1000);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const key = `${year}-${month}-${day}`;

    const existing = groups.get(key) || [];
    groups.set(key, [...existing, event]);
  });

  return groups;
};

const formatCompactDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${date.getDate()} ${months[date.getMonth()]} (${weekdays[date.getDay()]})`;
};

export const TimelineSection = ({ events }: TimelineSectionProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const grouped = groupByDate(events);

  if (events.length === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-sm" style={{ color: theme.textSecondary }}>
          No upcoming events
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-6">
      {Array.from(grouped.entries()).map(([date, dateEvents]) => (
        <View key={date} className="gap-3">
          <View className="flex-row items-center gap-3">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: Colors.status.info }}
            />
            <Text className="text-sm font-semibold" style={{ color: theme.text }}>
              {formatCompactDate(date)}
            </Text>
          </View>
          <View className="flex-row pl-1">
            <View
              className="mr-4 w-0.5"
              style={{ backgroundColor: theme.border }}
            />
            <View className="flex-1 gap-3">
              {dateEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};
