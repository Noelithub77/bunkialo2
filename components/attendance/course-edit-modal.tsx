import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import type {
    CourseBunkData,
    CourseConfig,
    DayOfWeek,
    ManualSlotInput,
    SessionType,
} from "@/types";
import { getRandomCourseColor } from "@/utils/course-color";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface CourseEditModalProps {
  visible: boolean;
  course: CourseBunkData | null;
  onClose: () => void;
  onSave: (
    courseId: string,
    config: CourseConfig,
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
  { label: "Sun", value: 0 },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const parseSlotTime = (
  dateStr: string,
): { dayOfWeek: DayOfWeek; startTime: string; endTime: string } | null => {
  const dayMatch = dateStr.match(/^(\w{3})\s/);
  if (!dayMatch) return null;

  const dayIndex = DAY_NAMES.indexOf(dayMatch[1]);
  if (dayIndex === -1) return null;

  const timeMatch = dateStr.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  if (!timeMatch) return null;

  const normalize = (t: string): string => {
    const match = t.match(/(\d{1,2})(?::(\d{2}))?(AM|PM)/i);
    if (!match) return t;
    let hours = parseInt(match[1], 10);
    const minutes = match[2] || "00";
    const period = match[3].toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  };

  return {
    dayOfWeek: dayIndex as DayOfWeek,
    startTime: normalize(timeMatch[1]),
    endTime: normalize(timeMatch[2]),
  };
};

const calculateDuration = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes - startMinutes;
};

const getSessionType = (
  desc: string,
  startTime?: string,
  endTime?: string,
): SessionType => {
  const lower = desc.toLowerCase();
  if (lower.includes("lab")) return "lab";
  if (lower.includes("tutorial")) return "tutorial";

  if (startTime && endTime) {
    const duration = calculateDuration(startTime, endTime);
    if (duration >= 110) return "lab";
  }

  return "regular";
};

export function CourseEditModal({
  visible,
  course,
  onClose,
  onSave,
}: CourseEditModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { courses: attendanceCourses } = useAttendanceStore();

  const [credits, setCredits] = useState(3);
  const [alias, setAlias] = useState("");
  const [selectedColor, setSelectedColor] = useState(getRandomCourseColor());
  const [overrideLmsSlots, setOverrideLmsSlots] = useState(false);
  const [slots, setSlots] = useState<ManualSlotInput[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<"details" | "slots">(
    "details",
  );

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [selectedStartTime, setSelectedStartTime] = useState("09:00");
  const [selectedEndTime, setSelectedEndTime] = useState("10:00");
  const [selectedSessionType, setSelectedSessionType] =
    useState<SessionType>("regular");
  const [error, setError] = useState("");

  const autoSlots = useMemo<ManualSlotInput[]>(() => {
    if (!course || course.isCustomCourse) return [];
    const attendanceCourse = attendanceCourses.find(
      (c) => c.courseId === course.courseId,
    );
    if (!attendanceCourse) return [];

    const slotMap = new Map<string, ManualSlotInput>();
    for (const record of attendanceCourse.records) {
      const parsed = parseSlotTime(record.date);
      if (!parsed) continue;
      const key = `${parsed.dayOfWeek}-${parsed.startTime}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          dayOfWeek: parsed.dayOfWeek,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          sessionType: getSessionType(
            record.description,
            parsed.startTime,
            parsed.endTime,
          ),
        });
      }
    }

    const result = Array.from(slotMap.values());
    result.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startTime.localeCompare(b.startTime);
    });
    return result;
  }, [attendanceCourses, course]);

  const orderedSlots = useMemo(() => {
    return slots
      .map((slot, index) => ({ slot, index }))
      .sort((a, b) => {
        if (a.slot.dayOfWeek !== b.slot.dayOfWeek)
          return a.slot.dayOfWeek - b.slot.dayOfWeek;
        return a.slot.startTime.localeCompare(b.slot.startTime);
      });
  }, [slots]);

  useEffect(() => {
    if (course && visible) {
      setCredits(course.config?.credits ?? 3);
      setAlias(course.config?.alias || "");
      setSelectedColor(course.config?.color || getRandomCourseColor());
      setOverrideLmsSlots(
        course.isCustomCourse
          ? true
          : (course.config?.overrideLmsSlots ?? false),
      );
      setSlots(
        (course.manualSlots || []).map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          sessionType: slot.sessionType,
        })),
      );
      setEditingIndex(null);
      setSelectedDay(1);
      setSelectedStartTime("09:00");
      setSelectedEndTime("10:00");
      setSelectedSessionType("regular");
      setError("");
      setActiveSection("details");
    }
  }, [course, visible]);

  const handleColorSelect = (color: string) => {
    Haptics.selectionAsync();
    setSelectedColor(color);
  };

  const handleCreditSelect = (credit: number) => {
    Haptics.selectionAsync();
    setCredits(credit);
  };

  const handleOverrideToggle = (value: boolean) => {
    Haptics.selectionAsync();
    setOverrideLmsSlots(value);
    if (value && slots.length === 0 && autoSlots.length > 0) {
      setSlots(autoSlots);
    }
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

  const handleEditSlot = (slot: ManualSlotInput, index: number) => {
    Haptics.selectionAsync();
    setEditingIndex(index);
    setSelectedDay(slot.dayOfWeek);
    setSelectedStartTime(slot.startTime);
    setSelectedEndTime(slot.endTime);
    setSelectedSessionType(slot.sessionType);
    setError("");
  };

  const handleCancelEdit = () => {
    Haptics.selectionAsync();
    setEditingIndex(null);
    setSelectedDay(1);
    setSelectedStartTime("09:00");
    setSelectedEndTime("10:00");
    setSelectedSessionType("regular");
    setError("");
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

    const duplicate = slots.find((slot, index) => {
      if (editingIndex !== null && index === editingIndex) return false;
      return (
        slot.dayOfWeek === slotInput.dayOfWeek &&
        slot.startTime === slotInput.startTime &&
        slot.endTime === slotInput.endTime
      );
    });

    if (duplicate) {
      setError("This slot already exists");
      return;
    }

    if (editingIndex !== null) {
      const updated = [...slots];
      updated[editingIndex] = slotInput;
      setSlots(updated);
      setEditingIndex(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setSlots([...slots, slotInput]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setSelectedDay(1);
    setSelectedStartTime("09:00");
    setSelectedEndTime("10:00");
    setSelectedSessionType("regular");
    setError("");
  };

  const handleRemoveSlot = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSlots(slots.filter((_, i) => i !== index));
    if (editingIndex === index) {
      handleCancelEdit();
    }
  };

  const handleUseLmsSlots = () => {
    Haptics.selectionAsync();
    setOverrideLmsSlots(true);
    setSlots(autoSlots);
    setEditingIndex(null);
    setError("");
    setActiveSection("slots");
  };

  const handleSave = () => {
    if (!course) return;

    if (course.isCustomCourse || overrideLmsSlots) {
      if (slots.length === 0) {
        setError("Add at least one time slot");
        setActiveSection("slots");
        return;
      }
    }

    const creditNum = credits;
    if (creditNum < 1 || creditNum > 10) {
      setError("Credits must be between 1-10");
      setActiveSection("details");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const config: CourseConfig = {
      credits: creditNum,
      alias: alias.trim() || course.courseName,
      courseCode: course.config?.courseCode || "",
      color: selectedColor,
      overrideLmsSlots: course.isCustomCourse ? true : overrideLmsSlots,
    };
    onSave(course.courseId, config, slots);
    onClose();
  };

  if (!course) return null;

  const totalBunks = 2 * credits + 1;
  const showOverrideToggle = !course.isCustomCourse;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.screen}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.title, { color: theme.text }]}>
                Edit Course
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {course.courseName}
              </Text>
            </View>
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
                  label="Alias (optional)"
                  placeholder="Short name for course"
                  value={alias}
                  onChangeText={setAlias}
                />

                <View style={styles.section}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    Credits
                  </Text>
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
                    style={[
                      styles.bunksPreview,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {totalBunks} bunks allowed
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={[styles.label, { color: theme.text }]}>
                    Color
                  </Text>
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

                {showOverrideToggle && (
                  <View
                    style={[
                      styles.overrideRow,
                      { backgroundColor: theme.backgroundSecondary },
                    ]}
                  >
                    <View style={styles.overrideText}>
                      <Text style={[styles.label, { color: theme.text }]}>
                        Override LMS Slots
                      </Text>
                      <Text
                        style={[
                          styles.helperText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Use your own weekly schedule instead of LMS data.
                      </Text>
                    </View>
                    <Switch
                      value={overrideLmsSlots}
                      onValueChange={handleOverrideToggle}
                      trackColor={{
                        false: theme.border,
                        true: Colors.status.success,
                      }}
                      thumbColor={Colors.white}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.sectionBlock}>
                {!overrideLmsSlots && autoSlots.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.label, { color: theme.text }]}>
                        LMS Slots
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: selectedColor + "30" },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: selectedColor }]}
                        >
                          AUTO
                        </Text>
                      </View>
                    </View>
                    <View style={styles.slotsList}>
                      {autoSlots.map((slot, index) => (
                        <View
                          key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
                          style={[
                            styles.slotItem,
                            { backgroundColor: theme.backgroundSecondary },
                          ]}
                        >
                          <View style={styles.slotInfo}>
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
                          </View>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={handleUseLmsSlots}
                      style={[
                        styles.overrideAction,
                        { borderColor: selectedColor },
                      ]}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={18}
                        color={selectedColor}
                      />
                      <Text
                        style={[
                          styles.overrideActionText,
                          { color: selectedColor },
                        ]}
                      >
                        Override & Edit These Slots
                      </Text>
                    </Pressable>
                  </View>
                )}

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.label, { color: theme.text }]}>
                      Weekly Slots
                    </Text>
                    {overrideLmsSlots && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: Colors.status.info + "20" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: Colors.status.info },
                          ]}
                        >
                          MANUAL
                        </Text>
                      </View>
                    )}
                  </View>

                  {slots.length === 0 && (
                    <Text
                      style={[
                        styles.helperText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {overrideLmsSlots
                        ? "Add your weekly timetable slots below."
                        : "Add extra slots (LMS slots are used by default)."}
                    </Text>
                  )}

                  {orderedSlots.length > 0 && (
                    <View style={styles.slotsList}>
                      {orderedSlots.map(({ slot, index }) => (
                        <View
                          key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
                          style={[
                            styles.slotItem,
                            { backgroundColor: theme.backgroundSecondary },
                            editingIndex === index && {
                              borderColor: selectedColor,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Pressable
                            style={styles.slotInfo}
                            onPress={() => handleEditSlot(slot, index)}
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
                              onPress={() => handleEditSlot(slot, index)}
                              hitSlop={8}
                              style={styles.slotActionBtn}
                            >
                              <Ionicons
                                name="pencil"
                                size={18}
                                color={selectedColor}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() => handleRemoveSlot(index)}
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
                      ))}
                    </View>
                  )}

                  <View style={styles.editorHeader}>
                    <Text
                      style={[styles.subLabel, { color: theme.textSecondary }]}
                    >
                      {editingIndex !== null ? "Edit Slot" : "Add New Slot"}
                    </Text>
                    {editingIndex !== null && (
                      <Pressable onPress={handleCancelEdit}>
                        <Text style={{ color: selectedColor, fontSize: 13 }}>
                          Cancel Edit
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <Text
                    style={[styles.subLabel, { color: theme.textSecondary }]}
                  >
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
                  </ScrollView>

                  <Text
                    style={[styles.subLabel, { color: theme.textSecondary }]}
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

                  <Text
                    style={[styles.subLabel, { color: theme.textSecondary }]}
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
                          onPress={() =>
                            !isDisabled && handleEndTimeSelect(time)
                          }
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

                  <Text
                    style={[styles.subLabel, { color: theme.textSecondary }]}
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
                    <Text
                      style={[styles.error, { color: Colors.status.danger }]}
                    >
                      {error}
                    </Text>
                  ) : null}

                  <Button
                    title={editingIndex !== null ? "Update Slot" : "Add Slot"}
                    onPress={handleSaveSlot}
                    style={styles.saveSlotBtn}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {error && activeSection === "details" ? (
            <Text style={[styles.error, { color: Colors.status.danger }]}>
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
              title="Save"
              onPress={handleSave}
              style={styles.footerBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerTitleWrap: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  headerSpacer: {
    width: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
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
  overrideRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  overrideText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  helperText: {
    fontSize: 11,
    marginTop: 4,
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
  overrideAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.sm,
    borderStyle: "dashed",
  },
  overrideActionText: {
    fontSize: 13,
    fontWeight: "500",
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
  slotActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  slotActionBtn: {
    padding: Spacing.xs,
  },
  editorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
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
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  saveSlotBtn: {
    marginTop: Spacing.md,
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
