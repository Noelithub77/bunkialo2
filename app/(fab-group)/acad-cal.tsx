import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { CalendarTheme, Colors, Radius, Spacing } from "@/constants/theme";
import { ACADEMIC_EVENTS, ACADEMIC_TERMS } from "@/data/acad-cal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type {
  AcademicEvent,
  AcademicEventCategory,
  AcademicTermInfo,
  MarkedDates,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";

const VIEW_MODES = ["calendar", "upnext"] as const;

type ViewMode = (typeof VIEW_MODES)[number];

type CategoryMeta = {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CATEGORY_META: Record<AcademicEventCategory, CategoryMeta> = {
  academic: {
    label: "Academics",
    color: Colors.status.info,
    icon: "school-outline",
  },
  exam: {
    label: "Exams",
    color: Colors.status.danger,
    icon: "document-text-outline",
  },
  holiday: {
    label: "Holidays",
    color: Colors.status.warning,
    icon: "sunny-outline",
  },
  committee: {
    label: "Committee",
    color: Colors.courseColors[5],
    icon: "people-outline",
  },
  project: {
    label: "Projects",
    color: Colors.courseColors[6],
    icon: "rocket-outline",
  },
  sports: {
    label: "Sports",
    color: Colors.courseColors[3],
    icon: "football-outline",
  },
  festival: {
    label: "Fest",
    color: Colors.courseColors[7],
    icon: "sparkles-outline",
  },
  admin: {
    label: "Admin",
    color: Colors.gray[500],
    icon: "briefcase-outline",
  },
  result: {
    label: "Results",
    color: Colors.status.success,
    icon: "ribbon-outline",
  },
};

const pad = (value: number): string => `${value}`.padStart(2, "0");

const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseISODate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isWithin = (target: string, start: string, end: string): boolean =>
  target >= start && target <= end;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const formatShortDate = (value: string): string => {
  const date = parseISODate(value);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
};

const formatLongDate = (value: string): string => {
  const date = parseISODate(value);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
};

const formatRange = (event: AcademicEvent): string => {
  if (!event.endDate || event.endDate === event.date) {
    return formatLongDate(event.date);
  }
  return `${formatShortDate(event.date)} - ${formatShortDate(event.endDate)}`;
};

const buildEventDates = (event: AcademicEvent): string[] => {
  const start = parseISODate(event.date);
  const end = event.endDate ? parseISODate(event.endDate) : start;
  const dates: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor = addDays(cursor, 1);
  }

  return dates;
};

const getCurrentTerm = (today: string): AcademicTermInfo => {
  const active = ACADEMIC_TERMS.find((term) =>
    isWithin(today, term.startDate, term.endDate),
  );
  if (active) return active;

  const upcoming = ACADEMIC_TERMS.filter((term) => term.startDate > today).sort(
    (a, b) => a.startDate.localeCompare(b.startDate),
  );
  if (upcoming.length > 0) return upcoming[0];

  const sorted = [...ACADEMIC_TERMS].sort((a, b) =>
    a.endDate.localeCompare(b.endDate),
  );
  return sorted[sorted.length - 1];
};

const getInitialSelectedDate = (today: string, term: AcademicTermInfo): string =>
  isWithin(today, term.startDate, term.endDate) ? today : term.startDate;

export default function AcademicCalendarScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;
  const today = toISODate(new Date());

  const currentTerm = useMemo(() => getCurrentTerm(today), [today]);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState(
    getInitialSelectedDate(today, currentTerm),
  );

  const termInfo = currentTerm;

  const termEvents = useMemo(
    () => ACADEMIC_EVENTS.filter((event) => event.termId === currentTerm.id),
    [currentTerm.id],
  );

  useEffect(() => {
    setSelectedDate(getInitialSelectedDate(today, currentTerm));
  }, [currentTerm, today]);

  const { markedDates, eventsByDate } = useMemo(() => {
    const marked: MarkedDates = {};
    const map = new Map<string, AcademicEvent[]>();

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
      marked[selectedDate] = {
        ...existing,
        selected: true,
      };
    }

    return { markedDates: marked, eventsByDate: map };
  }, [termEvents, selectedDate]);

  const selectedDayEvents = useMemo(
    () => eventsByDate.get(selectedDate) ?? [],
    [eventsByDate, selectedDate],
  );

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

  const nextEvent = useMemo(() => {
    const next = termEvents
      .filter((event) => (event.endDate ?? event.date) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    return next ?? null;
  }, [termEvents, today]);

  const handleDayPress = (date: DateData) => {
    setSelectedDate(date.dateString);
  };

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backIcon,
              { backgroundColor: theme.backgroundSecondary },
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>Calendar</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Academic schedule & key dates
            </Text>
          </View>
        </View>

        <GradientCard style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryHeading}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={theme.textSecondary}
              />
              <Text style={[styles.summaryTitle, { color: theme.text }]}>
                {termInfo?.shortTitle ?? "Semester"}
              </Text>
            </View>
            <Text style={[styles.summaryRange, { color: theme.textSecondary }]}>
              {termInfo
                ? `${formatShortDate(termInfo.startDate)} - ${formatShortDate(
                    termInfo.endDate,
                  )}`
                : ""}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Upcoming
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {upcomingGroups.length}
              </Text>
            </View>
            <View
              style={[styles.summaryDivider, { backgroundColor: theme.border }]}
            />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Next
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {nextEvent ? formatShortDate(nextEvent.date) : "-"}
              </Text>
            </View>
            <View
              style={[styles.summaryDivider, { backgroundColor: theme.border }]}
            />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Events
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {termEvents.length}
              </Text>
            </View>
          </View>
        </GradientCard>

        <View style={styles.chipRow}>
          {VIEW_MODES.map((mode) => {
            const isSelected = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                style={({ pressed }) => [
                  styles.modeChip,
                  {
                    borderColor: isSelected ? theme.text : theme.border,
                    backgroundColor: isSelected
                      ? theme.backgroundSecondary
                      : theme.background,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.modeChipText, { color: theme.text }]}>
                  {mode === "calendar" ? "Calendar" : "Up Next"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {viewMode === "calendar" ? (
          <View style={styles.calendarSection}>
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
                minDate={termInfo?.startDate}
                maxDate={termInfo?.endDate}
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
              <Text
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
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
                        <Ionicons
                          name={meta.icon}
                          size={16}
                          color={meta.color}
                        />
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={[styles.eventTitle, { color: theme.text }]}>
                          {event.title}
                        </Text>
                        <Text
                          style={[
                            styles.eventMeta,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {meta.label}
                          {event.isTentative ? " • Tentative" : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.legendRow}>
              {Object.entries(CATEGORY_META).map(([key, meta]) => (
                <View key={key} style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: meta.color },
                    ]}
                  />
                  <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                    {meta.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.timelineSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Up Next
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                {upcomingGroups.length} upcoming dates
              </Text>
            </View>

            {upcomingGroups.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  You are all caught up for this term
                </Text>
              </View>
            ) : (
              <View style={styles.timelineList}>
                {upcomingGroups.map(([date, events], index) => {
                  const isLast = index === upcomingGroups.length - 1;
                  return (
                    <View key={date} style={styles.timelineRow}>
                      <View style={styles.timelineMeta}>
                        <Text
                          style={[
                            styles.timelineDate,
                            { color: theme.text },
                          ]}
                        >
                          {formatShortDate(date)}
                        </Text>
                        <Text
                          style={[
                            styles.timelineDay,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {formatLongDate(date).split(",")[0]}
                        </Text>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: theme.text },
                          ]}
                        />
                        {!isLast && (
                          <View
                            style={[
                              styles.timelineLine,
                              { backgroundColor: theme.border },
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.timelineCards}>
                        {events.map((event) => {
                          const meta = CATEGORY_META[event.category];
                          const isOngoing =
                            event.endDate &&
                            event.date < today &&
                            event.endDate >= today;
                          return (
                            <View
                              key={event.id}
                              style={[
                                styles.timelineCard,
                                {
                                  backgroundColor: theme.backgroundSecondary,
                                  borderColor: theme.border,
                                },
                              ]}
                            >
                              <View style={styles.timelineCardHeader}>
                                <View
                                  style={[
                                    styles.timelineBadge,
                                    { backgroundColor: `${meta.color}20` },
                                  ]}
                                >
                                  <Ionicons
                                    name={meta.icon}
                                    size={14}
                                    color={meta.color}
                                  />
                                  <Text
                                    style={[
                                      styles.timelineBadgeText,
                                      { color: meta.color },
                                    ]}
                                  >
                                    {meta.label}
                                  </Text>
                                </View>
                                {event.isTentative && (
                                  <View
                                    style={[
                                      styles.timelineTag,
                                      { borderColor: theme.border },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.timelineTagText,
                                        { color: theme.textSecondary },
                                      ]}
                                    >
                                      Tentative
                                    </Text>
                                  </View>
                                )}
                                {isOngoing && (
                                  <View
                                    style={[
                                      styles.timelineTag,
                                      {
                                        borderColor: Colors.status.success,
                                        backgroundColor:
                                          Colors.status.success + "20",
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.timelineTagText,
                                        { color: Colors.status.success },
                                      ]}
                                    >
                                      Ongoing
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.timelineTitle,
                                  { color: theme.text },
                                ]}
                              >
                                {event.title}
                              </Text>
                              <Text
                                style={[
                                  styles.timelineRange,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {formatRange(event)}
                              </Text>
                              {event.note ? (
                                <Text
                                  style={[
                                    styles.timelineNote,
                                    { color: theme.textSecondary },
                                  ]}
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
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  summaryRange: {
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.gray[800],
  },
  chipRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  calendarSection: {
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
    backgroundColor: Colors.gray[800],
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
  timelineSection: {
    marginTop: Spacing.sm,
  },
  timelineList: {
    marginTop: Spacing.md,
    gap: Spacing.lg,
  },
  timelineRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  timelineMeta: {
    width: 72,
    alignItems: "center",
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: "600",
  },
  timelineDay: {
    fontSize: 12,
    marginTop: 2,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    marginTop: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 6,
    borderRadius: Radius.full,
  },
  timelineCards: {
    flex: 1,
    gap: Spacing.sm,
  },
  timelineCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  timelineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: 8,
  },
  timelineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  timelineBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timelineTag: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  timelineTagText: {
    fontSize: 10,
    fontWeight: "600",
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  timelineRange: {
    fontSize: 12,
    marginTop: 4,
  },
  timelineNote: {
    fontSize: 12,
    marginTop: 6,
  },
});
