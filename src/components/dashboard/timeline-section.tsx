import {
  addDays,
  parseISODate,
  toISODate,
} from "@/components/acad-cal/constants";
import { AcademicEventCard } from "@/components/dashboard/academic-event-card";
import { Colors } from "@/constants/theme";
import { ACADEMIC_EVENTS } from "@/data/acad-cal";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import { useAcademicCalendarFeedStore } from "@/stores/academic-calendar-feed-store";
import type {
  AcademicEvent,
  AcademicEventOverride,
  TimelineEvent,
} from "@/types";
import { getAcademicEventsForWindow } from "@/utils/academic-calendar-window";
import { isVisibleAcademicEvent } from "@/utils/academic-event-visibility";
import { router } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Text, View } from "react-native";
import { EventCard } from "./event-card";

type TimelineSectionProps = {
  events: TimelineEvent[];
};

type TimelineItem =
  | { kind: "lms"; event: TimelineEvent }
  | { kind: "academic"; event: AcademicEvent };

const mergeBaseEvent = (
  event: AcademicEvent,
  override: AcademicEventOverride | undefined,
): AcademicEvent | null => {
  if (override?.hidden) return null;

  const { hidden: _hidden, ...eventOverride } = override ?? {};
  return { ...event, ...eventOverride };
};

const getAcademicEventsForDashboard = (
  overrides: Record<string, AcademicEventOverride>,
  customEvents: AcademicEvent[],
  startDate: string,
): AcademicEvent[] => {
  const endDate = toISODate(addDays(parseISODate(startDate), 6));
  const baseEvents = ACADEMIC_EVENTS.flatMap((event) => {
    const merged = mergeBaseEvent(event, overrides[event.id]);
    return merged ? [merged] : [];
  });

  return getAcademicEventsForWindow(
    [...baseEvents, ...customEvents],
    startDate,
    endDate,
  );
};

const groupByDate = (
  events: TimelineEvent[],
  academicEvents: AcademicEvent[],
  windowStart: string,
): Map<string, TimelineItem[]> => {
  const groups = new Map<string, TimelineItem[]>();

  events.forEach((event) => {
    const date = new Date(event.timesort * 1000);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const key = `${year}-${month}-${day}`;

    const existing = groups.get(key) || [];
    groups.set(key, [...existing, { kind: "lms", event }]);
  });

  academicEvents.forEach((event) => {
    const date = event.date < windowStart ? windowStart : event.date;
    const existing = groups.get(date) || [];
    groups.set(date, [...existing, { kind: "academic", event }]);
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
  const { overrides, customEvents } = useAcademicCalendarStore();
  const googleEvents = useAcademicCalendarFeedStore((state) => state.googleEvents);
  const windowStart = toISODate(new Date());
  const academicEvents = getAcademicEventsForDashboard(
    overrides,
    [...customEvents, ...googleEvents].filter(isVisibleAcademicEvent),
    windowStart,
  );

  const grouped = groupByDate(events, academicEvents, windowStart);
  const groupedEntries = Array.from(grouped.entries()).sort(([first], [second]) =>
    first.localeCompare(second),
  );

  if (groupedEntries.length === 0) {
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
      {groupedEntries.map(([date, dateEvents]) => (
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
              {dateEvents.map((item) =>
                item.kind === "lms" ? (
                  <EventCard key={item.event.id} event={item.event} />
                ) : (
                  <AcademicEventCard
                    key={item.event.id}
                    event={item.event}
                    onPress={() => router.push("/acad-cal")}
                  />
                ),
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};
