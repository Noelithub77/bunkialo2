import { CalendarTheme, Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CalendarEvent } from "@/stores/acad-cal-ui-store";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import type { MarkedDates } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
    <View style={styles.container}>
      <View
        style={[
          styles.calendarCard,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}
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

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {selectedDate ? formatLongDate(selectedDate) : "Selected Day"}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          {selectedDayEvents.length} events
        </Text>
      </View>

      {selectedDayEvents.length === 0 ? (
        <View
          style={[
            styles.emptyState,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <Ionicons
            name="calendar-clear-outline"
            size={20}
            color={theme.textSecondary}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No events on this day
          </Text>
        </View>
      ) : (
        <View style={styles.eventList}>
          {selectedDayEvents.map((event) => {
            const meta = CATEGORY_META[event.category];
            return (
              <View
                key={`${event.id}-${selectedDate}`}
                style={[
                  styles.eventCard,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <View
                  style={[
                    styles.eventIcon,
                    { backgroundColor: theme.background },
                  ]}
                >
                  <Ionicons name={meta.icon} size={16} color={meta.color} />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, { color: theme.text }]}>
                    {event.title}
                  </Text>
                  <Text
                    style={[styles.eventMeta, { color: theme.textSecondary }]}
                  >
                    {meta.label}
                    {event.isTentative ? " • Tentative" : ""}
                  </Text>
                </View>
                {isEditMode && (
                  <Pressable
                    onPress={() => openEditEditor(event)}
                    style={styles.eventEditButton}
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

      <View style={styles.legendRow}>
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              {meta.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  calendarCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  sectionHeader: {
    marginTop: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 12,
  },
  emptyState: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 13,
  },
  eventList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  eventCard: {
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  eventMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  eventEditButton: {
    padding: 6,
  },
  legendRow: {
    marginTop: Spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  legendText: {
    fontSize: 11,
  },
});
