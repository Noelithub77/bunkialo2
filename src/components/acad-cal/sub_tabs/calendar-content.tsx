import { CalendarTheme, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CalendarEvent } from "@/stores/acad-cal-ui-store";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import type { MarkedDates } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { buildEventDates, CATEGORY_META, formatLongDate } from "../constants";

interface CalendarContentProps {
  termEvents: CalendarEvent[];
  termStartDate: string;
  termEndDate: string;
}

export const CalendarContent = ({
  termEvents,
  termStartDate,
  termEndDate,
}: CalendarContentProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;

  const { selectedDate, setSelectedDate, isEditMode, openModal } =
    useAcadCalUIStore();

  const { markedDates, eventsByDate } = useMemo(() => {
    const marked: MarkedDates = {};
    const map = new Map<string, CalendarEvent[]>();

    termEvents.forEach((event) => {
      buildEventDates(event).forEach((date) => {
        const list = map.get(date) ?? [];
        list.push(event);
        map.set(date, list);
      });
    });

    map.forEach((events, date) => {
      const categories = Array.from(
        new Set(events.map((event) => event.category)),
      );
      marked[date] = {
        dots: categories.map((category) => ({
          key: category,
          color: CATEGORY_META[category].color,
        })),
      };
    });

    if (selectedDate) {
      const existing = marked[selectedDate] ?? { dots: [] };
      marked[selectedDate] = { ...existing, selected: true };
    }

    return { markedDates: marked, eventsByDate: map };
  }, [termEvents, selectedDate]);

  const selectedDayEvents = useMemo(
    () => eventsByDate.get(selectedDate) ?? [],
    [eventsByDate, selectedDate],
  );

  const handleDayPress = (date: DateData) => {
    setSelectedDate(date.dateString);
  };

  const openEditEditor = (event: CalendarEvent) => {
    openModal({
      type: "event-editor",
      event,
      mode: event.source === "custom" ? "edit-custom" : "edit-base",
    });
  };

  return (
    <View className="mt-2">
      <View
        className="rounded-2xl border p-2"
        style={{ borderColor: theme.border, backgroundColor: theme.background }}
      >
        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={handleDayPress}
          current={selectedDate}
          minDate={termStartDate}
          maxDate={termEndDate}
          enableSwipeMonths
          hideExtraDays
          theme={{
            calendarBackground: calTheme.calendarBackground,
            dayTextColor: calTheme.dayTextColor,
            textDisabledColor: calTheme.textDisabledColor,
            monthTextColor: calTheme.monthTextColor,
            arrowColor: calTheme.arrowColor,
            todayTextColor: calTheme.todayTextColor,
            textDayFontSize: 14,
            textMonthFontSize: 14,
            textMonthFontWeight: "600",
          }}
        />
      </View>

      <View className="mt-6 flex-row items-end justify-between">
        <Text className="text-lg font-semibold" style={{ color: theme.text }}>
          {selectedDate ? formatLongDate(selectedDate) : "Selected Day"}
        </Text>
        <Text className="text-xs" style={{ color: theme.textSecondary }}>
          {selectedDayEvents.length} events
        </Text>
      </View>

      {selectedDayEvents.length === 0 ? (
        <View
          className="mt-4 flex-row items-center gap-2 rounded-2xl border p-4"
          style={{ borderColor: theme.border, backgroundColor: theme.background }}
        >
          <Ionicons
            name="calendar-clear-outline"
            size={20}
            color={theme.textSecondary}
          />
          <Text className="text-[13px]" style={{ color: theme.textSecondary }}>
            No events on this day
          </Text>
        </View>
      ) : (
        <View className="mt-4 gap-2">
          {selectedDayEvents.map((event) => {
            const meta = CATEGORY_META[event.category];
            return (
              <View
                key={`${event.id}-${selectedDate}`}
                className="flex-row items-center gap-2 rounded-2xl p-2"
                style={{ backgroundColor: theme.backgroundSecondary }}
              >
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.background }}
                >
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: theme.text }}>
                    {event.title}
                  </Text>
                  <Text
                    className="mt-1 text-xs"
                    style={{ color: theme.textSecondary }}
                  >
                    {meta.label}
                    {event.isTentative ? " • Tentative" : ""}
                  </Text>
                </View>
                {isEditMode && (
                  <Pressable
                    onPress={() => openEditEditor(event)}
                    className="p-1.5"
                    hitSlop={6}
                  >
                    <Ionicons
                      name="pencil"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View className="mt-6 flex-row flex-wrap gap-2">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <View key={key} className="flex-row items-center gap-1.5">
            <View
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            <Text className="text-[11px]" style={{ color: theme.textSecondary }}>
              {meta.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};
