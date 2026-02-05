import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CalendarEvent } from "@/stores/acad-cal-ui-store";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import type { AcademicEvent } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import {
  CATEGORY_META,
  formatLongDate,
  formatRange,
  formatShortDate,
  toISODate,
} from "../constants";

interface UpNextContentProps {
  termEvents: CalendarEvent[];
}

export const UpNextContent = ({ termEvents }: UpNextContentProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const today = toISODate(new Date());

  const { isEditMode, openModal } = useAcadCalUIStore();

  const upcomingGroups = useMemo(() => {
    const upcoming = termEvents.filter((event) => {
      const endDate = event.endDate ?? event.date;
      return endDate >= today;
    });

    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    const grouped = new Map<string, AcademicEvent[]>();
    upcoming.forEach((event) => {
      const list = grouped.get(event.date) ?? [];
      list.push(event);
      grouped.set(event.date, list);
    });

    return Array.from(grouped.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [termEvents, today]);

  const openEditEditor = (event: CalendarEvent) => {
    openModal({
      type: "event-editor",
      event,
      mode: event.source === "custom" ? "edit-custom" : "edit-base",
    });
  };

  return (
    <View className="mt-2">
      <View className="flex-row items-end justify-between">
        <Text className="text-lg font-semibold" style={{ color: theme.text }}>
          Up Next
        </Text>
        <Text className="text-xs" style={{ color: theme.textSecondary }}>
          {upcomingGroups.length} upcoming dates
        </Text>
      </View>

      {upcomingGroups.length === 0 ? (
        <View
          className="mt-4 flex-row items-center gap-2 rounded-2xl border p-4"
          style={{ borderColor: theme.border, backgroundColor: theme.background }}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={theme.textSecondary}
          />
          <Text className="text-[13px]" style={{ color: theme.textSecondary }}>
            You are all caught up for this term
          </Text>
        </View>
      ) : (
        <View className="mt-4 gap-6">
          {upcomingGroups.map(([date, events], index) => {
            const isLast = index === upcomingGroups.length - 1;
            return (
              <View key={date} className="flex-row gap-4">
                <View className="w-[72px] items-center">
                  <Text className="text-sm font-semibold" style={{ color: theme.text }}>
                    {formatShortDate(date)}
                  </Text>
                  <Text
                    className="mt-0.5 text-xs"
                    style={{ color: theme.textSecondary }}
                  >
                    {formatLongDate(date).split(",")[0]}
                  </Text>
                  <View
                    className="mt-2 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: theme.text }}
                  />
                  {!isLast && (
                    <View
                      className="mt-1 w-0.5 flex-1 rounded-full"
                      style={{ backgroundColor: theme.border }}
                    />
                  )}
                </View>
                <View className="flex-1 gap-2">
                  {events.map((event) => {
                    const meta = CATEGORY_META[event.category];
                    const isOngoing =
                      event.endDate &&
                      event.date < today &&
                      event.endDate >= today;
                    return (
                      <View
                        key={event.id}
                        className="rounded-2xl border p-4"
                        style={{
                          backgroundColor: theme.backgroundSecondary,
                          borderColor: theme.border,
                        }}
                      >
                        <View className="mb-2 flex-row flex-wrap items-center gap-2">
                          <View
                            className="flex-row items-center gap-1.5 rounded-full px-2 py-1"
                            style={{ backgroundColor: `${meta.color}20` }}
                          >
                            <Ionicons
                              name={meta.icon}
                              size={14}
                              color={meta.color}
                            />
                            <Text
                              className="text-[11px] font-semibold"
                              style={{ color: meta.color }}
                            >
                              {meta.label}
                            </Text>
                          </View>
                          {event.isTentative && (
                            <View
                              className="rounded-full border px-2 py-0.5"
                              style={{ borderColor: theme.border }}
                            >
                              <Text
                                className="text-[10px] font-semibold"
                                style={{ color: theme.textSecondary }}
                              >
                                Tentative
                              </Text>
                            </View>
                          )}
                          {isOngoing && (
                            <View
                              className="rounded-full border px-2 py-0.5"
                              style={{
                                borderColor: Colors.status.success,
                                backgroundColor: Colors.status.success + "20",
                              }}
                            >
                              <Text
                                className="text-[10px] font-semibold"
                                style={{ color: Colors.status.success }}
                              >
                                Ongoing
                              </Text>
                            </View>
                          )}
                          {isEditMode && (
                            <Pressable
                              onPress={() =>
                                openEditEditor(event as CalendarEvent)
                              }
                              className="ml-auto p-1"
                              hitSlop={6}
                            >
                              <Ionicons
                                name="pencil"
                                size={14}
                                color={theme.textSecondary}
                              />
                            </Pressable>
                          )}
                        </View>
                        <Text
                          className="text-[15px] font-semibold"
                          style={{ color: theme.text }}
                        >
                          {event.title}
                        </Text>
                        <Text
                          className="mt-1 text-xs"
                          style={{ color: theme.textSecondary }}
                        >
                          {formatRange(event)}
                        </Text>
                        {event.note ? (
                          <Text
                            className="mt-1.5 text-xs"
                            style={{ color: theme.textSecondary }}
                          >
                            {event.note}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};
