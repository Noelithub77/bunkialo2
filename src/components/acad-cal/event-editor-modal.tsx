import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { EditorMode } from "@/stores/acad-cal-ui-store";
import { useAcadCalUIStore } from "@/stores/acad-cal-ui-store";
import { useAcademicCalendarStore } from "@/stores/academic-calendar-store";
import type {
  AcademicEvent,
  AcademicEventCategory,
  AcademicEventOverride,
  AcademicTermId,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { CATEGORY_META, CATEGORY_ORDER, isValidDateString } from "./constants";

interface EventEditorModalProps {
  termId: AcademicTermId;
}

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

export const EventEditorModal = ({ termId }: EventEditorModalProps) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { activeModal, closeModal, selectedDate, setSelectedDate } =
    useAcadCalUIStore();

  const {
    overrides,
    setBaseOverride,
    clearBaseOverride,
    addCustomEvent,
    updateCustomEvent,
    removeCustomEvent,
  } = useAcademicCalendarStore();

  // determine if visible and extract event/mode
  const isVisible = activeModal?.type === "event-editor";
  const event = isVisible ? activeModal.event : null;
  const editorMode: EditorMode = isVisible ? activeModal.mode : "create";

  // find base event for edit-base mode
  const [baseEvent, setBaseEvent] = useState<AcademicEvent | null>(null);

  const [draft, setDraft] = useState<EventDraft>({
    title: "",
    date: selectedDate || "",
    endDate: "",
    category: "academic",
    note: "",
    isTentative: false,
  });
  const [draftHidden, setDraftHidden] = useState(false);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});

  // reset form when modal opens
  useEffect(() => {
    if (!isVisible) return;

    if (event) {
      setDraft({
        title: event.title,
        date: event.date,
        endDate: event.endDate ?? "",
        category: event.category,
        note: event.note ?? "",
        isTentative: event.isTentative ?? false,
      });
      setDraftHidden(
        event.source === "base"
          ? (overrides[event.id]?.hidden ?? false)
          : false,
      );
      // for edit-base, store original base event
      if (editorMode === "edit-base") {
        // event already contains merged data, need original
        setBaseEvent({
          id: event.id,
          title: event.title,
          date: event.date,
          endDate: event.endDate,
          category: event.category,
          termId: event.termId,
          note: event.note,
          isTentative: event.isTentative,
        });
      } else {
        setBaseEvent(null);
      }
    } else {
      // create mode
      setDraft({
        title: "",
        date: selectedDate || "",
        endDate: "",
        category: "academic",
        note: "",
        isTentative: false,
      });
      setDraftHidden(false);
      setBaseEvent(null);
    }
    setDraftErrors({});
  }, [isVisible, event, editorMode, selectedDate, overrides]);

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

  const handleSave = () => {
    const errors = validateDraft(draft);
    setDraftErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const normalizedNote = draft.note.trim();
    const payload: Omit<AcademicEvent, "id"> = {
      title: draft.title.trim(),
      date: draft.date,
      endDate: draft.endDate ? draft.endDate : undefined,
      category: draft.category,
      termId: termId,
      note: normalizedNote ? normalizedNote : undefined,
      isTentative: draft.isTentative,
    };

    if (editorMode === "create") {
      addCustomEvent(payload);
    } else if (editorMode === "edit-custom" && event) {
      updateCustomEvent(event.id, payload);
    } else if (editorMode === "edit-base" && baseEvent) {
      const override = buildOverride(baseEvent, payload, draftHidden);
      if (!override) {
        clearBaseOverride(baseEvent.id);
      } else {
        setBaseOverride(baseEvent.id, override);
      }
    }

    setSelectedDate(payload.date);
    closeModal();
  };

  const handleDelete = () => {
    if (!event) return;
    if (event.source === "custom") {
      removeCustomEvent(event.id);
      closeModal();
      return;
    }
    if (baseEvent) {
      setBaseOverride(baseEvent.id, { hidden: true });
      closeModal();
    }
  };

  const handleRestore = () => {
    if (!baseEvent) return;
    clearBaseOverride(baseEvent.id);
    closeModal();
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
              {editorMode === "create" ? "Add Event" : "Edit Event"}
            </Text>
            <Pressable onPress={closeModal} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerClassName="gap-4 pb-4"
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

            <View className="gap-1">
              <Text className="ml-1 text-[13px] font-medium" style={{ color: theme.textSecondary }}>
                Category
              </Text>
              <View className="flex-row flex-wrap gap-2">
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
                        {
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 9999,
                          borderWidth: 1,
                        },
                        {
                          borderColor: isSelected ? meta.color : theme.border,
                          backgroundColor: isSelected
                            ? `${meta.color}20`
                            : theme.background,
                        },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: isSelected ? meta.color : theme.text }}
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
              style={{ height: 96, textAlignVertical: "top" }}
            />

            <Pressable
              onPress={() =>
                setDraft((prev) => ({
                  ...prev,
                  isTentative: !prev.isTentative,
                }))
              }
              className="flex-row items-center gap-2 rounded-2xl border p-2"
              style={{ borderColor: theme.border }}
            >
              <View
                className="h-7 w-7 items-center justify-center rounded-full"
                style={{
                  backgroundColor: draft.isTentative
                    ? Colors.status.warning
                    : theme.backgroundSecondary,
                }}
              >
                <Ionicons
                  name={draft.isTentative ? "alert" : "checkmark"}
                  size={14}
                  color={draft.isTentative ? Colors.black : theme.text}
                />
              </View>
              <Text className="text-sm font-medium" style={{ color: theme.text }}>
                Mark as tentative
              </Text>
            </Pressable>

            {editorMode === "edit-base" && (
              <Pressable
                onPress={() => setDraftHidden((prev) => !prev)}
                className="flex-row items-center gap-2 rounded-2xl border p-2"
                style={{ borderColor: theme.border }}
              >
                <View
                  className="h-7 w-7 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: draftHidden
                      ? Colors.status.danger
                      : theme.backgroundSecondary,
                  }}
                >
                  <Ionicons
                    name={draftHidden ? "eye-off" : "eye"}
                    size={14}
                    color={draftHidden ? Colors.white : theme.text}
                  />
                </View>
                <Text className="text-sm font-medium" style={{ color: theme.text }}>
                  Hide this base event
                </Text>
              </Pressable>
            )}

            {editorMode === "edit-custom" && (
              <Button
                title="Delete Event"
                variant="danger"
                onPress={handleDelete}
              />
            )}

            {editorMode === "edit-base" && (
              <Button
                title="Restore Default"
                variant="secondary"
                onPress={handleRestore}
              />
            )}
          </ScrollView>
          <View className="mt-4 w-full flex-row gap-2">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={closeModal}
              className="flex-1"
            />
            <Button
              title="Save"
              onPress={handleSave}
              className="flex-1"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
