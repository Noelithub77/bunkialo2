import {
  CalendarContent,
  ChangesModal,
  EventEditorModal,
  getCurrentTerm,
  getInitialSelectedDate,
  toISODate,
} from "@/components/acad-cal";
import { UpNextContent } from "@/components/acad-cal/sub_tabs/upnext-content";
import { Container } from "@/components/ui/container";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { ACADEMIC_EVENTS } from "@/data/acad-cal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CalendarEvent, ViewMode } from "@/stores/acad-cal-ui-store";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FAB, Portal } from "react-native-paper";

const VIEW_MODES: ViewMode[] = ["calendar", "upnext"];

export default function AcademicCalendarScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const isFocused = useIsFocused();
  const today = toISODate(new Date());

  const { overrides, customEvents } = useAcademicCalendarStore();

  const {
    viewMode,
    setViewMode,
    selectedDate,
    setSelectedDate,
    showFabMenu,
    setShowFabMenu,
    isEditMode,
    toggleEditMode,
    setEditMode,
    openModal,
  } = useAcadCalUIStore();

  const currentTerm = useMemo(() => getCurrentTerm(today), [today]);
  const termInfo = currentTerm;

  // set initial selected date on mount
  useEffect(() => {
    const initialDate = getInitialSelectedDate(today, currentTerm);
    if (!selectedDate) {
      setSelectedDate(initialDate);
    }
  }, [currentTerm, today, selectedDate, setSelectedDate]);

  // reset FAB and edit mode when leaving screen
  useEffect(() => {
    if (!isFocused) {
      setShowFabMenu(false);
      setEditMode(false);
    }
  }, [isFocused, setShowFabMenu, setEditMode]);

  // base events for current term
  const baseEvents = useMemo(
    () => ACADEMIC_EVENTS.filter((event) => event.termId === currentTerm.id),
    [currentTerm.id],
  );

  // merged term events (base + overrides + custom)
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

  const handleToggleEditMode = () => {
    toggleEditMode();
    if (showFabMenu) setShowFabMenu(false);
  };

  return (
    <Container>
      <ScrollView contentContainerStyle={styles.content}>
        {/* header */}
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

        {/* view mode chips */}
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

        {/* content based on view mode */}
        {viewMode === "calendar" ? (
          <CalendarContent
            termEvents={termEvents}
            termStartDate={termInfo.startDate}
            termEndDate={termInfo.endDate}
          />
        ) : (
          <UpNextContent termEvents={termEvents} />
        )}
      </ScrollView>

      {/* FAB menu */}
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
                  openModal({ type: "changes" });
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
                  handleToggleEditMode();
                },
              },
              {
                icon: "plus",
                label: "Add Event",
                color: Colors.white,
                style: { backgroundColor: Colors.status.success },
                onPress: () => {
                  setShowFabMenu(false);
                  openModal({
                    type: "event-editor",
                    event: null,
                    mode: "create",
                  });
                },
              },
            ]}
            onStateChange={({ open }) => setShowFabMenu(open)}
          />
        </Portal>
      )}

      {/* modals */}
      <EventEditorModal termId={currentTerm.id} />
      <ChangesModal termId={currentTerm.id} />
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
});
