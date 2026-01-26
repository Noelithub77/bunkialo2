import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CalendarEvent } from "@/stores/acad-cal-ui-store";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import type { AcademicEvent } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Up Next
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
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
                  <Text style={[styles.timelineDate, { color: theme.text }]}>
                    {formatShortDate(date)}
                  </Text>
                  <Text
                    style={[styles.timelineDay, { color: theme.textSecondary }]}
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
                                  backgroundColor: Colors.status.success + "20",
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
                              onPress={() =>
                                openEditEditor(event as CalendarEvent)
                              }
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
                          style={[styles.timelineTitle, { color: theme.text }]}
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
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  sectionHeader: {
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
});
