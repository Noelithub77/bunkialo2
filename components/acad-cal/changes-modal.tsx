import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
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
  StyleSheet,
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
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeModal} />
        <View
          style={[styles.modalSheet, { backgroundColor: theme.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Changes
            </Text>
            <Pressable onPress={closeModal} hitSlop={8}>
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
                      <Text style={[styles.changeTitle, { color: theme.text }]}>
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
                onPress={closeModal}
                style={styles.modalButton}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  emptyState: {
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
