import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getRandomCourseColor } from "@/stores/timetable-store";
import type { DayOfWeek, ManualSlotInput, SessionType } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
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

interface CreateCourseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (
    courseName: string,
    alias: string,
    credits: number,
    color: string,
    slots: ManualSlotInput[],
  ) => void;
}

const DAYS: { label: string; value: DayOfWeek }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
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

const CREDIT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const formatTime = (time: string): string => {
  const [hours] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}${period}`;
};

const formatSlotDisplay = (slot: ManualSlotInput): string => {
  const dayLabel = DAYS.find((d) => d.value === slot.dayOfWeek)?.label || "";
  return `${dayLabel} ${formatTime(slot.startTime)} - ${formatTime(
    slot.endTime,
  )}`;
};

export function CreateCourseModal({
  visible,
  onClose,
  onSave,
}: CreateCourseModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [courseName, setCourseName] = useState("");
  const [alias, setAlias] = useState("");
  const [credits, setCredits] = useState(3);
  const [selectedColor, setSelectedColor] = useState(getRandomCourseColor());
  const [slots, setSlots] = useState<ManualSlotInput[]>([]);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<"details" | "slots">(
    "details",
  );

  // slot builder state
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [selectedStartTime, setSelectedStartTime] = useState("09:00");
  const [selectedEndTime, setSelectedEndTime] = useState("10:00");
  const [selectedSessionType, setSelectedSessionType] =
    useState<SessionType>("regular");

  useEffect(() => {
    if (visible) {
      setCourseName("");
      setAlias("");
      setCredits(3);
      setSelectedColor(getRandomCourseColor());
      setSlots([]);
      setError("");
      setActiveSection("details");
      setSelectedDay(1);
      setSelectedStartTime("09:00");
      setSelectedEndTime("10:00");
      setSelectedSessionType("regular");
    }
  }, [visible]);

  const handleColorSelect = (color: string) => {
    Haptics.selectionAsync();
    setSelectedColor(color);
  };

  const handleCreditSelect = (credit: number) => {
    Haptics.selectionAsync();
    setCredits(credit);
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

  const handleAddSlot = () => {
    if (selectedStartTime >= selectedEndTime) {
      setError("End time must be after start time");
      return;
    }

    const duplicate = slots.find(
      (s) =>
        s.dayOfWeek === selectedDay &&
        s.startTime === selectedStartTime &&
        s.endTime === selectedEndTime,
    );

    if (duplicate) {
      setError("This slot already exists");
      return;
    }

    const newSlot: ManualSlotInput = {
      dayOfWeek: selectedDay,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      sessionType: selectedSessionType,
    };

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSlots([...slots, newSlot]);
    setError("");
  };

  const handleRemoveSlot = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSlots(slots.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!courseName.trim()) {
      setError("Course name is required");
      setActiveSection("details");
      return;
    }

    if (slots.length === 0) {
      setError("Add at least one time slot");
      setActiveSection("slots");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(courseName.trim(), alias.trim(), credits, selectedColor, slots);
    onClose();
  };

  const totalBunks = 2 * credits + 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.screen, { backgroundColor: theme.background }]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>New Course</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View
          style={[
            styles.segmented,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Pressable
            onPress={() => setActiveSection("details")}
            style={[
              styles.segmentButton,
              activeSection === "details" && {
                backgroundColor: theme.background,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeSection === "details"
                      ? theme.text
                      : theme.textSecondary,
                },
              ]}
            >
              Details
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveSection("slots")}
            style={[
              styles.segmentButton,
              activeSection === "slots" && {
                backgroundColor: theme.background,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeSection === "slots"
                      ? theme.text
                      : theme.textSecondary,
                },
              ]}
            >
              Slots
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {activeSection === "details" ? (
            <View style={styles.sectionBlock}>
              <Input
                label="Course Name"
                placeholder="e.g. Data Structures"
                value={courseName}
                onChangeText={(text) => {
                  setCourseName(text);
                  setError("");
                }}
              />

              <Input
                label="Alias (optional)"
                placeholder="Short name for display"
                value={alias}
                onChangeText={setAlias}
              />

              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.text }]}>Credits</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipContainer}
                >
                  {CREDIT_OPTIONS.map((credit) => {
                    const isSelected = credits === credit;
                    return (
                      <Pressable
                        key={credit}
                        onPress={() => handleCreditSelect(credit)}
                        style={[
                          styles.chip,
                          { borderColor: theme.border },
                          isSelected && {
                            backgroundColor: selectedColor,
                            borderColor: selectedColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: theme.textSecondary },
                            isSelected && styles.chipTextSelected,
                          ]}
                        >
                          {credit}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text
                  style={[styles.bunksPreview, { color: theme.textSecondary }]}
                >
                  {totalBunks} bunks allowed
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.text }]}>Color</Text>
                <View style={styles.colorGrid}>
                  {Colors.courseColors.map((color) => (
                    <Pressable
                      key={color}
                      onPress={() => handleColorSelect(color)}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorSelected,
                      ]}
                    >
                      {selectedColor === color && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={Colors.white}
                        />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.label, { color: theme.text }]}>Weekly Slots</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: Colors.status.info + "20" },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: Colors.status.info }]}
                  >
                    CUSTOM
                  </Text>
                </View>
              </View>

              {slots.length === 0 && (
                <Text style={[styles.helperText, { color: theme.textSecondary }]}
                >
                  Add your weekly timetable slots below.
                </Text>
              )}

              {slots.length > 0 && (
                <View style={styles.slotsList}>
                  {slots.map((slot, index) => (
                    <View
                      key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
                      style={[
                        styles.slotItem,
                        { backgroundColor: theme.backgroundSecondary },
                      ]}
                    >
                      <View style={styles.slotInfo}>
                        <Text style={[styles.slotText, { color: theme.text }]}
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
                      </View>
                      <Pressable
                        onPress={() => handleRemoveSlot(index)}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={Colors.status.danger}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={[styles.subLabel, { color: theme.textSecondary }]}
                >
                  Day
                </Text>
                <View style={styles.dayGrid}>
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
                            backgroundColor: selectedColor,
                            borderColor: selectedColor,
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
                </View>

                <Text style={[styles.subLabel, { color: theme.textSecondary }]}
                >
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
                            backgroundColor: selectedColor,
                            borderColor: selectedColor,
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

                <Text style={[styles.subLabel, { color: theme.textSecondary }]}
                >
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
                            backgroundColor: selectedColor,
                            borderColor: selectedColor,
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

                <Text style={[styles.subLabel, { color: theme.textSecondary }]}
                >
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
                            backgroundColor: selectedColor,
                            borderColor: selectedColor,
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

                {error ? (
                  <Text style={[styles.error, { color: Colors.status.danger }]}
                  >
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleAddSlot}
                  style={[styles.addSlotBtn, { borderColor: selectedColor }]}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color={selectedColor}
                  />
                  <Text style={[styles.addSlotText, { color: selectedColor }]}
                  >
                    Add Slot
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        {error && activeSection === "details" ? (
          <Text style={[styles.error, { color: Colors.status.danger }]}
          >
            {error}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            style={styles.footerBtn}
          />
          <Button
            title={activeSection === "details" ? "Next" : "Create"}
            onPress={
              activeSection === "details" ? () => setActiveSection("slots") : handleSave
            }
            style={styles.footerBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerSpacer: {
    width: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  segmentButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Spacing.lg,
  },
  sectionBlock: {
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  subLabel: {
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  chipContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: Colors.white,
  },
  bunksPreview: {
    fontSize: 11,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  helperText: {
    fontSize: 11,
  },
  slotsList: {
    gap: Spacing.sm,
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
  dayGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    alignItems: "center",
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
  addSlotBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    borderStyle: "dashed",
  },
  addSlotText: {
    fontSize: 14,
    fontWeight: "500",
  },
  error: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  footerBtn: {
    flex: 1,
  },
});
