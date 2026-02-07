import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
import { ACADEMIC_EVENTS } from "@/data/acad-cal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import type { AcademicTermId } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { formatLongDate, formatShortDate } from "./constants";

interface ChangesModalProps {
  termId: AcademicTermId;
}

export const ChangesModal = ({ termId }: ChangesModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { activeModal, closeModal, openModal } = useAcadCalUIStore();
  const {
    overrides,
    customEvents,
    clearBaseOverride,
    removeCustomEvent,
    resetCalendar,
  } = useAcademicCalendarStore();

  const isVisible = activeModal?.type === "changes";

  const baseEventsById = useMemo(
    () => new Map(ACADEMIC_EVENTS.map((event) => [event.id, event])),
    [],
  );

  const changes = useMemo(() => {
    const baseChanges = Object.entries(overrides)
      .map(([id, override]) => {
        const base = baseEventsById.get(id);
        if (!base) return null;
        const merged = { ...base, ...override };
        if (merged.termId !== termId) return null;
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
      .filter((event) => event.termId === termId)
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
  }, [baseEventsById, termId, customEvents, overrides]);

  const openChangeEditor = (id: string, source: "base" | "custom") => {
    if (source === "custom") {
      const event = customEvents.find((item) => item.id === id);
      if (!event) return;
      openModal({
        type: "event-editor",
        event: { ...event, source: "custom" },
        mode: "edit-custom",
      });
      return;
    }
    const base = baseEventsById.get(id);
    if (!base) return;
    const override = overrides[id];
    const merged = { ...base, ...override };
    openModal({
      type: "event-editor",
      event: { ...merged, source: "base" },
      mode: "edit-base",
    });
  };

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "position"}
        className="flex-1 justify-end"
      >
        <Pressable className="absolute inset-0 bg-black/45" onPress={closeModal} />
        <View
          className="max-h-[90%] rounded-t-3xl px-4 pt-4 pb-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold" style={{ color: theme.text }}>
              Changes
            </Text>
            <Pressable onPress={closeModal} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerClassName="gap-4 pb-4"
            showsVerticalScrollIndicator={false}
          >
            {changes.length === 0 ? (
              <View
                className="flex-row items-center gap-2 rounded-2xl border p-4"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                }}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={theme.textSecondary}
                />
                <Text
                  className="text-[13px]"
                  style={{ color: theme.textSecondary }}
                >
                  No overrides or custom events yet
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                {changes.map((change) => (
                  <View
                    key={`${change.source}-${change.id}`}
                    className="gap-1 rounded-2xl p-4"
                    style={{ backgroundColor: theme.backgroundSecondary }}
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="flex-1 text-sm font-semibold" style={{ color: theme.text }}>
                        {change.title}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: theme.textSecondary }}
                      >
                        {change.type}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: theme.textSecondary }}
                    >
                      {change.endDate
                        ? `${formatShortDate(change.date)} - ${formatShortDate(
                            change.endDate,
                          )}`
                        : formatLongDate(change.date)}
                    </Text>
                    <View className="mt-2 flex-row gap-2">
                      <Pressable
                        onPress={() =>
                          openChangeEditor(change.id, change.source)
                        }
                        className="rounded-full border px-3 py-1.5"
                        style={{ borderColor: theme.border }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: theme.text }}
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
                        className="rounded-full border px-3 py-1.5"
                        style={{
                          borderColor: Colors.status.danger,
                          backgroundColor: Colors.status.danger + "10",
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: Colors.status.danger }}
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
            <View className="mt-4 w-full flex-row gap-2">
              <Button
                title="Reset All"
                variant="secondary"
                onPress={resetCalendar}
                className="flex-1"
              />
              <Button
                title="Done"
                onPress={closeModal}
                className="flex-1"
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
