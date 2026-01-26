import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarTheme, Colors, Radius, Spacing } from "@/constants/theme";
import { ACADEMIC_EVENTS, ACADEMIC_TERMS } from "@/data/acad-cal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import type {
  AcademicEvent,
  AcademicEventCategory,
  AcademicEventOverride,
  AcademicTermInfo,
  MarkedDates,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { FAB, Portal } from "react-native-paper";

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

const CATEGORY_ORDER: AcademicEventCategory[] = [
  "academic",
  "exam",
  "holiday",
  "committee",
  "project",
  "sports",
  "festival",
  "admin",
  "result",
];

type CalendarEvent = AcademicEvent & { source: "base" | "custom" };

type EditorMode = "create" | "edit-base" | "edit-custom";

interface EventDraft {
  title: string;
  date: string;
  endDate: string;
  category: AcademicEventCategory;
  note: string;
  isTentative: boolean;
}

interface DraftErrors {
  title?: string;
  date?: string;
  endDate?: string;
}

const pad = (value: number): string => `${value}`.padStart(2, "0");

const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseISODate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const isValidDateString = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISODate(value);
  return toISODate(parsed) === value;
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

const buildOverride = (
  base: AcademicEvent,
  draft: Omit<AcademicEvent, "id">,
  hidden: boolean,
): AcademicEventOverride | null => {
  const next: AcademicEventOverride = hidden ? { hidden: true } : {};

  if (draft.title !== base.title) next.title = draft.title;
  if (draft.date !== base.date) next.date = draft.date;
  if ((draft.endDate ?? undefined) !== (base.endDate ?? undefined)) {
    next.endDate = draft.endDate;
  }
  if (draft.category !== base.category) next.category = draft.category;
  if ((draft.note ?? undefined) !== (base.note ?? undefined)) {
    next.note = draft.note;
  }
  if ((draft.isTentative ?? false) !== (base.isTentative ?? false)) {
    next.isTentative = draft.isTentative;
  }
  if (draft.termId !== base.termId) next.termId = draft.termId;

  if (Object.keys(next).length === 0) return null;
  return next;
};

export default function AcademicCalendarScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;
  const isFocused = useIsFocused();
  const today = toISODate(new Date());

  const {
    overrides,
    customEvents,
    setBaseOverride,
    clearBaseOverride,
    addCustomEvent,
    updateCustomEvent,
    removeCustomEvent,
    resetCalendar,
  } = useAcademicCalendarStore();

  const currentTerm = useMemo(() => getCurrentTerm(today), [today]);
  const initialSelectedDate = getInitialSelectedDate(today, currentTerm);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingBaseEvent, setEditingBaseEvent] =
    useState<AcademicEvent | null>(null);
  const [draftHidden, setDraftHidden] = useState(false);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [draft, setDraft] = useState<EventDraft>({
    title: "",
    date: initialSelectedDate,
    endDate: "",
    category: "academic",
    note: "",
    isTentative: false,
  });

  const termInfo = currentTerm;

  const baseEvents = useMemo(
    () => ACADEMIC_EVENTS.filter((event) => event.termId === currentTerm.id),
    [currentTerm.id],
  );

  const baseEventsById = useMemo(
    () => new Map(baseEvents.map((event) => [event.id, event])),
    [baseEvents],
  );

  const termEvents = useMemo(() => {
    const mergedBase: CalendarEvent[] = [];
    baseEvents.forEach((event) => {
      const override = overrides[event.id];
      if (override?.hidden) return;
      const mergedEvent = { ...event, ...override };
      if (mergedEvent.termId !== currentTerm.id) return;
      mergedBase.push({ ...mergedEvent, source: "base" });
    });

    const customForTerm = customEvents
      .filter((event) => event.termId === currentTerm.id)
      .map((event) => ({ ...event, source: "custom" as const }));

    return [...mergedBase, ...customForTerm];
  }, [baseEvents, customEvents, overrides, currentTerm.id]);

  useEffect(() => {
    setSelectedDate(getInitialSelectedDate(today, currentTerm));
  }, [currentTerm, today]);

  useEffect(() => {
    if (!isFocused) {
      setShowFabMenu(false);
      setIsEditMode(false);
    }
  }, [isFocused]);

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

  const changes = useMemo(() => {
    const baseChanges = Object.entries(overrides)
      .map(([id, override]) => {
        const base = baseEventsById.get(id);
        if (!base) return null;
        const merged = { ...base, ...override };
        if (merged.termId !== currentTerm.id) return null;
        return {
          id,
          title: merged.title,
          date: merged.date,
          endDate: merged.endDate,
          type: override.hidden ? "Hidden base event" : "Edited base event",
          source: "base" as const,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const customChanges = customEvents
      .filter((event) => event.termId === currentTerm.id)
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: event.date,
        endDate: event.endDate,
        type: "Custom event",
        source: "custom" as const,
      }));

    return [...baseChanges, ...customChanges].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [baseEventsById, currentTerm.id, customEvents, overrides]);

  const handleDayPress = (date: DateData) => {
    setSelectedDate(date.dateString);
  };

  const resetEditor = () => {
    setDraft({
      title: "",
      date: selectedDate || initialSelectedDate,
      endDate: "",
      category: "academic",
      note: "",
      isTentative: false,
    });
    setDraftHidden(false);
    setDraftErrors({});
    setEditingEvent(null);
    setEditingBaseEvent(null);
  };

  const openCreateEditor = () => {
    resetEditor();
    setEditorMode("create");
    setShowEditor(true);
  };

  const openEditEditor = (event: CalendarEvent) => {
    setEditorMode(event.source === "custom" ? "edit-custom" : "edit-base");
    setEditingEvent(event);
    const baseEvent =
      event.source === "base" ? baseEventsById.get(event.id) ?? null : null;
    setEditingBaseEvent(baseEvent);
    setDraft({
      title: event.title,
      date: event.date,
      endDate: event.endDate ?? "",
      category: event.category,
      note: event.note ?? "",
      isTentative: event.isTentative ?? false,
    });
    setDraftHidden(
      event.source === "base" ? overrides[event.id]?.hidden ?? false : false,
    );
    setDraftErrors({});
    setShowEditor(true);
  };

  const validateDraft = (value: EventDraft): DraftErrors => {
    const errors: DraftErrors = {};
    if (!value.title.trim()) {
      errors.title = "Title is required";
    }
    if (!isValidDateString(value.date)) {
      errors.date = "Use YYYY-MM-DD";
    }
    if (value.endDate && !isValidDateString(value.endDate)) {
      errors.endDate = "Use YYYY-MM-DD";
    }
    if (
      value.endDate &&
      isValidDateString(value.endDate) &&
      isValidDateString(value.date) &&
      value.endDate < value.date
    ) {
      errors.endDate = "End date must be after start";
    }
    return errors;
  };

  const handleSaveEvent = () => {
    const errors = validateDraft(draft);
    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const normalizedNote = draft.note.trim();
    const payload: Omit<AcademicEvent, "id"> = {
      title: draft.title.trim(),
      date: draft.date,
      endDate: draft.endDate ? draft.endDate : undefined,
      category: draft.category,
      termId: currentTerm.id,
      note: normalizedNote ? normalizedNote : undefined,
      isTentative: draft.isTentative,
    };

    if (editorMode === "create") {
      addCustomEvent(payload);
    } else if (editorMode === "edit-custom" && editingEvent) {
      updateCustomEvent(editingEvent.id, payload);
    } else if (editorMode === "edit-base" && editingBaseEvent) {
      const override = buildOverride(editingBaseEvent, payload, draftHidden);
      if (!override) {
        clearBaseOverride(editingBaseEvent.id);
      } else {
        setBaseOverride(editingBaseEvent.id, override);
      }
    }

    setSelectedDate(payload.date);
    setShowEditor(false);
  };

  const handleDeleteEvent = () => {
    if (!editingEvent) return;
    if (editingEvent.source === "custom") {
      removeCustomEvent(editingEvent.id);
      setShowEditor(false);
      return;
    }
    if (editingBaseEvent) {
      setBaseOverride(editingBaseEvent.id, { hidden: true });
      setShowEditor(false);
    }
  };

  const handleRestoreBase = () => {
    if (!editingBaseEvent) return;
    clearBaseOverride(editingBaseEvent.id);
    setShowEditor(false);
  };

  const toggleEditMode = () => {
    setIsEditMode((prev) => !prev);
    if (showFabMenu) {
      setShowFabMenu(false);
    }
  };

  const openChangeEditor = (id: string, source: "base" | "custom") => {
    if (source === "custom") {
      const event = customEvents.find((item) => item.id === id);
      if (!event) return;
      openEditEditor({ ...event, source: "custom" });
      return;
    }
    const base = baseEventsById.get(id);
    if (!base) return;
    const override = overrides[id];
    const merged = { ...base, ...override };
    openEditEditor({ ...merged, source: "base" });
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
                                {isEditMode && (
                                  <Pressable
                                    onPress={() => openEditEditor(event)}
                                    style={styles.timelineEditButton}
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

      {isFocused && (
        <Portal>
          <FAB.Group
            open={showFabMenu}
            visible={true}
            icon={showFabMenu ? "close" : isEditMode ? "check" : "plus"}
            color={Colors.white}
            style={{ position: "absolute", right: 0, bottom: 80 }}
            backdropColor="rgba(0,0,0,0.5)"
            fabStyle={{
              backgroundColor: showFabMenu
                ? theme.textSecondary
                : isEditMode
                  ? Colors.status.info
                  : Colors.status.success,
            }}
            actions={[
              {
                icon: "history",
                label: "Changes",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                onPress: () => {
                  setShowFabMenu(false);
                  setShowChanges(true);
                },
              },
              {
                icon: "pencil",
                label: isEditMode ? "Done Editing" : "Edit Events",
                color: isEditMode ? Colors.white : theme.text,
                style: {
                  backgroundColor: isEditMode
                    ? Colors.status.info
                    : theme.backgroundSecondary,
                },
                onPress: () => {
                  setShowFabMenu(false);
                  toggleEditMode();
                },
              },
              {
                icon: "plus",
                label: "Add Event",
                color: Colors.white,
                style: { backgroundColor: Colors.status.success },
                onPress: () => {
                  setShowFabMenu(false);
                  openCreateEditor();
                },
              },
            ]}
            onStateChange={({ open }) => setShowFabMenu(open)}
          />
        </Portal>
      )}

      <Modal
        visible={showEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditor(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowEditor(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editorMode === "create" ? "Add Event" : "Edit Event"}
              </Text>
              <Pressable onPress={() => setShowEditor(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Input
                label="Title"
                value={draft.title}
                onChangeText={(value) =>
                  setDraft((prev) => ({ ...prev, title: value }))
                }
                error={draftErrors.title}
                placeholder="Event title"
              />
              <Input
                label="Date"
                value={draft.date}
                onChangeText={(value) =>
                  setDraft((prev) => ({ ...prev, date: value }))
                }
                error={draftErrors.date}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />
              <Input
                label="End Date (optional)"
                value={draft.endDate}
                onChangeText={(value) =>
                  setDraft((prev) => ({ ...prev, endDate: value }))
                }
                error={draftErrors.endDate}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
              />

              <View style={styles.modalSection}>
                <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>
                  Category
                </Text>
                <View style={styles.categoryRow}>
                  {CATEGORY_ORDER.map((category) => {
                    const meta = CATEGORY_META[category];
                    const isSelected = draft.category === category;
                    return (
                      <Pressable
                        key={category}
                        onPress={() =>
                          setDraft((prev) => ({ ...prev, category }))
                        }
                        style={({ pressed }) => [
                          styles.categoryChip,
                          {
                            borderColor: isSelected
                              ? meta.color
                              : theme.border,
                            backgroundColor: isSelected
                              ? `${meta.color}20`
                              : theme.background,
                          },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            { color: isSelected ? meta.color : theme.text },
                          ]}
                        >
                          {meta.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Input
                label="Note (optional)"
                value={draft.note}
                onChangeText={(value) =>
                  setDraft((prev) => ({ ...prev, note: value }))
                }
                placeholder="Extra details"
                multiline
                style={styles.noteInput}
              />

              <Pressable
                onPress={() =>
                  setDraft((prev) => ({
                    ...prev,
                    isTentative: !prev.isTentative,
                  }))
                }
                style={[
                  styles.toggleRow,
                  { borderColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.toggleIndicator,
                    {
                      backgroundColor: draft.isTentative
                        ? Colors.status.warning
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Ionicons
                    name={draft.isTentative ? "alert" : "checkmark"}
                    size={14}
                    color={draft.isTentative ? Colors.black : theme.text}
                  />
                </View>
                <Text style={[styles.toggleText, { color: theme.text }]}>
                  Mark as tentative
                </Text>
              </Pressable>

              {editorMode === "edit-base" && (
                <Pressable
                  onPress={() => setDraftHidden((prev) => !prev)}
                  style={[
                    styles.toggleRow,
                    { borderColor: theme.border },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleIndicator,
                      {
                        backgroundColor: draftHidden
                          ? Colors.status.danger
                          : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={draftHidden ? "eye-off" : "eye"}
                      size={14}
                      color={draftHidden ? Colors.white : theme.text}
                    />
                  </View>
                  <Text style={[styles.toggleText, { color: theme.text }]}>
                    Hide this base event
                  </Text>
                </Pressable>
              )}

              {editorMode === "edit-custom" && (
                <Button
                  title="Delete Event"
                  variant="danger"
                  onPress={handleDeleteEvent}
                />
              )}

              {editorMode === "edit-base" && (
                <Button
                  title="Restore Default"
                  variant="secondary"
                  onPress={handleRestoreBase}
                />
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setShowEditor(false)}
                style={styles.modalButton}
              />
              <Button
                title="Save"
                onPress={handleSaveEvent}
                style={styles.modalButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showChanges}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChanges(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          style={styles.modalOverlay}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowChanges(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Changes
              </Text>
              <Pressable onPress={() => setShowChanges(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {changes.length === 0 ? (
                <View
                  style={[
                    styles.emptyState,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <Text
                    style={[styles.emptyText, { color: theme.textSecondary }]}
                  >
                    No overrides or custom events yet
                  </Text>
                </View>
              ) : (
                <View style={styles.changeList}>
                  {changes.map((change) => (
                    <View
                      key={`${change.source}-${change.id}`}
                      style={[
                        styles.changeCard,
                        { backgroundColor: theme.backgroundSecondary },
                      ]}
                    >
                      <View style={styles.changeHeader}>
                        <Text
                          style={[styles.changeTitle, { color: theme.text }]}
                        >
                          {change.title}
                        </Text>
                        <Text
                          style={[
                            styles.changeType,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {change.type}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.changeDate,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {change.endDate
                          ? `${formatShortDate(change.date)} - ${formatShortDate(
                              change.endDate,
                            )}`
                          : formatLongDate(change.date)}
                      </Text>
                      <View style={styles.changeActions}>
                        <Pressable
                          onPress={() =>
                            openChangeEditor(change.id, change.source)
                          }
                          style={[
                            styles.changeActionChip,
                            { borderColor: theme.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.changeActionText,
                              { color: theme.text },
                            ]}
                          >
                            Edit
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            if (change.source === "custom") {
                              removeCustomEvent(change.id);
                              return;
                            }
                            clearBaseOverride(change.id);
                          }}
                          style={[
                            styles.changeActionChip,
                            {
                              borderColor: Colors.status.danger,
                              backgroundColor: Colors.status.danger + "10",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.changeActionText,
                              { color: Colors.status.danger },
                            ]}
                          >
                            {change.source === "custom" ? "Remove" : "Restore"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            {changes.length > 0 && (
              <View style={styles.modalFooter}>
                <Button
                  title="Reset All"
                  variant="secondary"
                  onPress={resetCalendar}
                  style={styles.modalButton}
                />
                <Button
                  title="Done"
                  onPress={() => setShowChanges(false)}
                  style={styles.modalButton}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  timelineEditButton: {
    padding: 4,
    marginLeft: "auto",
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  modalFooter: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  modalSection: {
    gap: Spacing.xs,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: Spacing.xs,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  noteInput: {
    height: 96,
    textAlignVertical: "top",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
  },
  toggleIndicator: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  changeList: {
    gap: Spacing.sm,
  },
  changeCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  changeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  changeTitle: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  changeType: {
    fontSize: 12,
  },
  changeDate: {
    fontSize: 12,
  },
  changeActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  changeActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  changeActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
