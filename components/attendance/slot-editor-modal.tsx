import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type {
  DayOfWeek,
  ManualSlot,
  ManualSlotInput,
  SessionType,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// simplified auto slot for display
interface AutoSlotDisplay {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  isHidden?: boolean;
}

interface SlotEditorModalProps {
  visible: boolean;
  courseName: string;
  courseColor: string;
  existingSlots: ManualSlot[];
  autoSlots?: AutoSlotDisplay[];
  onClose: () => void;
  onAddSlot: (slot: ManualSlotInput) => void;
  onUpdateSlot: (slotId: string, slot: ManualSlotInput) => void;
  onRemoveSlot: (slotId: string) => void;
  onToggleAutoSlot?: (slotId: string, hide: boolean) => void;
}

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const TIME_OPTIONS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const SESSION_TYPES: { label: string; value: SessionType }[] = [
  { label: "Regular", value: "regular" },
  { label: "Lab", value: "lab" },
  { label: "Tutorial", value: "tutorial" },
];

const formatTime = (time: string): string => {
  const [hours] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}${period}`;
};

const formatSlotDisplay = (slot: ManualSlot | ManualSlotInput): string => {
  const dayLabel = DAYS.find((d) => d.value === slot.dayOfWeek)?.label || "";
  return `${dayLabel} ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
};

export function SlotEditorModal({
  visible,
  courseName,
  courseColor,
  existingSlots,
  autoSlots = [],
  onClose,
  onAddSlot,
  onUpdateSlot,
  onRemoveSlot,
  onToggleAutoSlot,
}: SlotEditorModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [editingSlot, setEditingSlot] = useState<ManualSlot | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [selectedStartTime, setSelectedStartTime] = useState("09:00");
  const [selectedEndTime, setSelectedEndTime] = useState("10:00");
  const [selectedSessionType, setSelectedSessionType] =
    useState<SessionType>("regular");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setEditingSlot(null);
      setSelectedDay(1);
      setSelectedStartTime("09:00");
      setSelectedEndTime("10:00");
      setSelectedSessionType("regular");
      setError("");
    }
  }, [visible]);

  const handleEditSlot = (slot: ManualSlot) => {
    Haptics.selectionAsync();
    setEditingSlot(slot);
    setSelectedDay(slot.dayOfWeek);
    setSelectedStartTime(slot.startTime);
    setSelectedEndTime(slot.endTime);
    setSelectedSessionType(slot.sessionType);
    setError("");
  };

  const handleCancelEdit = () => {
    Haptics.selectionAsync();
    setEditingSlot(null);
    setSelectedDay(1);
    setSelectedStartTime("09:00");
    setSelectedEndTime("10:00");
    setSelectedSessionType("regular");
    setError("");
  };

  const handleDaySelect = (day: DayOfWeek) => {
    Haptics.selectionAsync();
    setSelectedDay(day);
  };

  const handleStartTimeSelect = (time: string) => {
    Haptics.selectionAsync();
    setSelectedStartTime(time);
    const startIndex = TIME_OPTIONS.indexOf(time);
    const endIndex = TIME_OPTIONS.indexOf(selectedEndTime);
    if (endIndex <= startIndex && startIndex < TIME_OPTIONS.length - 1) {
      setSelectedEndTime(TIME_OPTIONS[startIndex + 1]);
    }
  };

  const handleEndTimeSelect = (time: string) => {
    Haptics.selectionAsync();
    setSelectedEndTime(time);
  };

  const handleSessionTypeSelect = (type: SessionType) => {
    Haptics.selectionAsync();
    setSelectedSessionType(type);
  };

  const handleSaveSlot = () => {
    if (selectedStartTime >= selectedEndTime) {
      setError("End time must be after start time");
      return;
    }

    const slotInput: ManualSlotInput = {
      dayOfWeek: selectedDay,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      sessionType: selectedSessionType,
    };

    if (editingSlot) {
      onUpdateSlot(editingSlot.id, slotInput);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingSlot(null);
    } else {
      // check for duplicate
      const duplicate = existingSlots.find(
        (s) =>
          s.dayOfWeek === selectedDay &&
          s.startTime === selectedStartTime &&
          s.endTime === selectedEndTime,
      );

      if (duplicate) {
        setError("This slot already exists");
        return;
      }

      onAddSlot(slotInput);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setError("");
    setSelectedDay(1);
    setSelectedStartTime("09:00");
    setSelectedEndTime("10:00");
    setSelectedSessionType("regular");
  };

  const handleRemoveSlot = (slotId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemoveSlot(slotId);
    if (editingSlot?.id === slotId) {
      handleCancelEdit();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          {/* header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.colorIndicator,
                  { backgroundColor: courseColor },
                ]}
              />
              <View>
                <Text style={[styles.title, { color: theme.text }]}>
                  Edit Slots
                </Text>
                <Text
                  style={[styles.courseName, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {courseName}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.content}
          >
            {/* existing slots */}
            {existingSlots.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.text }]}>
                  Current Slots
                </Text>
                <View style={styles.slotsList}>
                  {existingSlots.map((slot) => {
                    const isEditing = editingSlot?.id === slot.id;
                    return (
                      <View
                        key={slot.id}
                        style={[
                          styles.slotItem,
                          { backgroundColor: theme.backgroundSecondary },
                          isEditing && {
                            borderColor: courseColor,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Pressable
                          style={styles.slotInfo}
                          onPress={() => handleEditSlot(slot)}
                        >
                          <Text
                            style={[styles.slotText, { color: theme.text }]}
                          >
                            {formatSlotDisplay(slot)}
                          </Text>
                          <Text
                            style={[
                              styles.slotType,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {slot.sessionType}
                          </Text>
                        </Pressable>
                        <View style={styles.slotActions}>
                          <Pressable
                            onPress={() => handleEditSlot(slot)}
                            hitSlop={8}
                            style={styles.slotActionBtn}
                          >
                            <Ionicons
                              name="pencil"
                              size={18}
                              color={courseColor}
                            />
                          </Pressable>
                          <Pressable
                            onPress={() => handleRemoveSlot(slot.id)}
                            hitSlop={8}
                            style={styles.slotActionBtn}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={Colors.status.danger}
                            />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* auto slots from LMS */}
            {autoSlots.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    From Timetable
                  </Text>
                  <View
                    style={[
                      styles.lmsBadge,
                      { backgroundColor: courseColor + "30" },
                    ]}
                  >
                    <Text style={[styles.lmsBadgeText, { color: courseColor }]}>
                      LMS
                    </Text>
                  </View>
                </View>
                <View style={styles.slotsList}>
                  {autoSlots.map((slot) => (
                    <View
                      key={slot.id}
                      style={[
                        styles.slotItem,
                        { backgroundColor: theme.backgroundSecondary },
                        slot.isHidden && styles.slotHidden,
                      ]}
                    >
                      <View style={styles.slotInfo}>
                        <Text
                          style={[
                            styles.slotText,
                            { color: theme.text },
                            slot.isHidden && { opacity: 0.5 },
                          ]}
                        >
                          {formatSlotDisplay(slot)}
                        </Text>
                        <Text
                          style={[
                            styles.slotType,
                            { color: theme.textSecondary },
                            slot.isHidden && { opacity: 0.5 },
                          ]}
                        >
                          {slot.sessionType}
                        </Text>
                      </View>
                      {onToggleAutoSlot && (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            onToggleAutoSlot(slot.id, !slot.isHidden);
                          }}
                          hitSlop={8}
                          style={styles.slotActionBtn}
                        >
                          <Ionicons
                            name={
                              slot.isHidden ? "eye-off-outline" : "eye-outline"
                            }
                            size={18}
                            color={
                              slot.isHidden ? theme.textSecondary : courseColor
                            }
                          />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
                <Text
                  style={[styles.helperText, { color: theme.textSecondary }]}
                >
                  These slots are detected from your LMS schedule. Tap the eye
                  to hide.
                </Text>
              </View>
            )}

            {/* slot editor */}
            <View style={styles.section}>
              <View style={styles.editorHeader}>
                <Text style={[styles.label, { color: theme.text }]}>
                  {editingSlot ? "Edit Slot" : "Add New Slot"}
                </Text>
                {editingSlot && (
                  <Pressable onPress={handleCancelEdit}>
                    <Text style={{ color: courseColor, fontSize: 13 }}>
                      Cancel Edit
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* day selector */}
              <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                Day
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayGrid}
              >
                {DAYS.map((day) => {
                  const isSelected = selectedDay === day.value;
                  return (
                    <Pressable
                      key={day.value}
                      onPress={() => handleDaySelect(day.value)}
                      style={[
                        styles.dayBtn,
                        { borderColor: theme.border },
                        isSelected && {
                          backgroundColor: courseColor,
                          borderColor: courseColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: theme.textSecondary },
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* start time */}
              <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                Start Time
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timeGrid}
              >
                {TIME_OPTIONS.slice(0, -1).map((time) => {
                  const isSelected = selectedStartTime === time;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => handleStartTimeSelect(time)}
                      style={[
                        styles.timeBtn,
                        { borderColor: theme.border },
                        isSelected && {
                          backgroundColor: courseColor,
                          borderColor: courseColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeText,
                          { color: theme.textSecondary },
                          isSelected && styles.timeTextSelected,
                        ]}
                      >
                        {formatTime(time)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* end time */}
              <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                End Time
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timeGrid}
              >
                {TIME_OPTIONS.slice(1).map((time) => {
                  const isSelected = selectedEndTime === time;
                  const isDisabled = time <= selectedStartTime;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => !isDisabled && handleEndTimeSelect(time)}
                      style={[
                        styles.timeBtn,
                        { borderColor: theme.border },
                        isSelected && {
                          backgroundColor: courseColor,
                          borderColor: courseColor,
                        },
                        isDisabled && styles.timeBtnDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeText,
                          { color: theme.textSecondary },
                          isSelected && styles.timeTextSelected,
                          isDisabled && { color: theme.border },
                        ]}
                      >
                        {formatTime(time)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* session type */}
              <Text style={[styles.subLabel, { color: theme.textSecondary }]}>
                Session Type
              </Text>
              <View style={styles.sessionTypeGrid}>
                {SESSION_TYPES.map((type) => {
                  const isSelected = selectedSessionType === type.value;
                  return (
                    <Pressable
                      key={type.value}
                      onPress={() => handleSessionTypeSelect(type.value)}
                      style={[
                        styles.sessionTypeBtn,
                        { borderColor: theme.border },
                        isSelected && {
                          backgroundColor: courseColor,
                          borderColor: courseColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sessionTypeText,
                          { color: theme.textSecondary },
                          isSelected && styles.sessionTypeTextSelected,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* error */}
              {error ? (
                <Text style={[styles.error, { color: Colors.status.danger }]}>
                  {error}
                </Text>
              ) : null}

              {/* save slot button */}
              <Button
                title={editingSlot ? "Update Slot" : "Add Slot"}
                onPress={handleSaveSlot}
                style={styles.saveSlotBtn}
              />
            </View>
          </ScrollView>

          {/* close button */}
          <View style={styles.actions}>
            <Button
              title="Done"
              variant="secondary"
              onPress={onClose}
              style={styles.btn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modal: {
    width: "92%",
    maxWidth: 420,
    maxHeight: "90%",
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  courseName: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flexGrow: 0,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  editorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  subLabel: {
    fontSize: 12,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  slotsList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  slotItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  slotInfo: {
    flex: 1,
  },
  slotText: {
    fontSize: 13,
    fontWeight: "500",
  },
  slotType: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  slotActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  slotActionBtn: {
    padding: Spacing.xs,
  },
  dayGrid: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dayBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  dayText: {
    fontSize: 12,
    fontWeight: "500",
  },
  dayTextSelected: {
    color: Colors.white,
  },
  timeGrid: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timeBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  timeBtnDisabled: {
    opacity: 0.4,
  },
  timeText: {
    fontSize: 12,
  },
  timeTextSelected: {
    color: Colors.white,
    fontWeight: "500",
  },
  sessionTypeGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  sessionTypeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    alignItems: "center",
  },
  sessionTypeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sessionTypeTextSelected: {
    color: Colors.white,
  },
  error: {
    fontSize: 12,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  saveSlotBtn: {
    marginTop: Spacing.md,
  },
  actions: {
    marginTop: Spacing.md,
  },
  btn: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  lmsBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  lmsBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  slotHidden: {
    opacity: 0.6,
  },
  helperText: {
    fontSize: 11,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
});
