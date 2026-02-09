import {
  CalendarContent,
  ChangesModal,
  EventEditorModal,
  getCurrentTerm,
  getInitialSelectedDate,
  toISODate,
} from "@/components/acad-cal";
import { ExportCalendarModal } from "@/components/acad-cal/export-calendar-modal";
import { UpNextContent } from "@/components/acad-cal/sub_tabs/upnext-content";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { ACADEMIC_EVENTS } from "@/data/acad-cal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { CalendarEvent, ViewMode } from "@/stores/acad-cal-ui-store";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { FAB, Portal } from "react-native-paper";

const VIEW_MODES: ViewMode[] = ["upnext", "calendar"];

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
    activeModal,
    closeModal,
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
      <ScrollView contentContainerClassName="p-4 pb-12">
        {/* header */}
        <View className="mb-6 flex-row items-center gap-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.backgroundSecondary }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-2xl font-bold" style={{ color: theme.text }}>
              Calendar
            </Text>
            <Text className="mt-1 text-[13px]" style={{ color: theme.textSecondary }}>
              Academic schedule & key dates
            </Text>
          </View>
        </View>

        {/* view mode chips */}
        <View
          className="mb-4 flex-row rounded-full border p-1"
          style={{
            borderColor: theme.border,
            backgroundColor: theme.background,
          }}
        >
          {VIEW_MODES.map((mode) => {
            const isSelected = viewMode === mode;
            const selectedBg = Colors.status.info;
            const selectedText = Colors.white;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                className="flex-1 items-center justify-center rounded-full py-2"
                style={({ pressed }) => [
                  {
                    backgroundColor: isSelected ? selectedBg : "transparent",
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? Colors.status.info : "transparent",
                    zIndex: isSelected ? 1 : 0,
                  },
                  isSelected && {
                    shadowColor: Colors.black,
                    shadowOpacity: 0.2,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 3,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{
                    color: isSelected ? selectedText : theme.textSecondary,
                  }}
                >
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
                icon: "export",
                label: "Export to Calendar",
                color: theme.text,
                style: { backgroundColor: theme.backgroundSecondary },
                onPress: () => {
                  setShowFabMenu(false);
                  openModal({ type: "export" });
                },
              },
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
      <ExportCalendarModal
        visible={activeModal?.type === "export"}
        onClose={closeModal}
        events={termEvents}
        termName={termInfo.shortTitle}
      />
    </Container>
  );
}
