import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
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
import { inferRecurringLmsSlots } from "@/utils/timetable-inference";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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

    return inferRecurringLmsSlots(attendanceCourse.records, {
      startToleranceMinutes: 20,
    }).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionType: slot.sessionType,
    }));
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
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 px-6"
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
            <View className="flex-1 items-center px-4">
              <Text className="text-[18px] font-semibold" style={{ color: theme.text }}>
                Edit Course
              </Text>
              <Text className="mt-0.5 text-center text-[12px]" style={{ color: theme.textSecondary }}>
                {course.courseName}
              </Text>
            </View>
            <View className="w-6" />
          </View>

          <View
            className="mb-4 flex-row rounded-[12px] p-1"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <Pressable
              onPress={() => setActiveSection("details")}
              className="flex-1 items-center rounded-[8px] py-2"
              style={activeSection === "details" ? { backgroundColor: theme.background } : undefined}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{
                  color:
                    activeSection === "details"
                      ? theme.text
                      : theme.textSecondary,
                }}
              >
                Details
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveSection("slots")}
              className="flex-1 items-center rounded-[8px] py-2"
              style={activeSection === "slots" ? { backgroundColor: theme.background } : undefined}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{
                  color:
                    activeSection === "slots"
                      ? theme.text
                      : theme.textSecondary,
                }}
              >
                Slots
              </Text>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-6"
            showsVerticalScrollIndicator={false}
          >
            {activeSection === "details" ? (
              <View className="gap-6">
                <Input
                  label="Alias (optional)"
                  placeholder="Short name for course"
                  value={alias}
                  onChangeText={setAlias}
                />

                <View className="gap-2">
                  <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                    Credits
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2 py-1"
                  >
                    {CREDIT_OPTIONS.map((credit) => {
                      const isSelected = credits === credit;
                      return (
                        <Pressable
                          key={credit}
                          onPress={() => handleCreditSelect(credit)}
                          className="rounded-[8px] border px-4 py-1"
                          style={[
                            { borderColor: theme.border },
                            isSelected && {
                              backgroundColor: selectedColor,
                              borderColor: selectedColor,
                            },
                          ]}
                        >
                          <Text
                            className="text-[14px] font-medium"
                            style={[
                              { color: theme.textSecondary },
                              isSelected && { color: Colors.white },
                            ]}
                          >
                            {credit}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Text
                    className="text-[11px]"
                    style={{ color: theme.textSecondary }}
                  >
                    {totalBunks} bunks allowed
                  </Text>
                </View>

                <View className="gap-2">
                  <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                    Color
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {Colors.courseColors.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() => handleColorSelect(color)}
                        className="h-9 w-9 items-center justify-center rounded-full"
                        style={[
                          { backgroundColor: color },
                          selectedColor === color && {
                            borderWidth: 3,
                            borderColor: Colors.white,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 4,
                            elevation: 4,
                          },
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
                    className="flex-row items-center justify-between rounded-[12px] p-4"
                    style={{ backgroundColor: theme.backgroundSecondary }}
                  >
                    <View className="flex-1 mr-4">
                      <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                        Override LMS Slots
                      </Text>
                      <Text
                        className="mt-1 text-[11px]"
                        style={{ color: theme.textSecondary }}
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
              <View className="gap-6">
                {!overrideLmsSlots && autoSlots.length > 0 && (
                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                        LMS Slots
                      </Text>
                      <View
                        className="rounded-[8px] px-2 py-0.5"
                        style={{ backgroundColor: selectedColor + "30" }}
                      >
                        <Text
                          className="text-[10px] font-bold"
                          style={{ color: selectedColor }}
                        >
                          AUTO
                        </Text>
                      </View>
                    </View>
                    <View className="gap-2">
                      {autoSlots.map((slot, index) => (
                        <View
                          key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
                          className="flex-row items-center justify-between rounded-[8px] p-2"
                          style={{ backgroundColor: theme.backgroundSecondary }}
                        >
                          <View className="flex-1">
                            <Text className="text-[13px] font-medium" style={{ color: theme.text }}>
                              {formatSlotDisplay(slot)}
                            </Text>
                            <Text
                              className="text-[11px] capitalize"
                              style={{ color: theme.textSecondary }}
                            >
                              {slot.sessionType}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      onPress={handleUseLmsSlots}
                      className="mt-4 flex-row items-center justify-center gap-1 rounded-[8px] border border-dashed py-2"
                      style={{ borderColor: selectedColor }}
                    >
                      <Ionicons
                        name="swap-horizontal"
                        size={18}
                        color={selectedColor}
                      />
                      <Text
                        className="text-[13px] font-medium"
                        style={{ color: selectedColor }}
                      >
                        Override & Edit These Slots
                      </Text>
                    </Pressable>
                  </View>
                )}

                <View className="gap-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                      Weekly Slots
                    </Text>
                    {overrideLmsSlots && (
                      <View
                        className="rounded-[8px] px-2 py-0.5"
                        style={{ backgroundColor: Colors.status.info + "20" }}
                      >
                        <Text
                          className="text-[10px] font-bold"
                          style={{ color: Colors.status.info }}
                        >
                          MANUAL
                        </Text>
                      </View>
                    )}
                  </View>

                  {slots.length === 0 && (
                    <Text
                      className="text-[11px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {overrideLmsSlots
                        ? "Add your weekly timetable slots below."
                        : "Add extra slots (LMS slots are used by default)."}
                    </Text>
                  )}

                  {orderedSlots.length > 0 && (
                    <View className="gap-2">
                      {orderedSlots.map(({ slot, index }) => (
                        <View
                          key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
                          className="flex-row items-center justify-between rounded-[8px] p-2"
                          style={[
                            { backgroundColor: theme.backgroundSecondary },
                            editingIndex === index && {
                              borderColor: selectedColor,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Pressable
                            className="flex-1"
                            onPress={() => handleEditSlot(slot, index)}
                          >
                            <Text
                              className="text-[13px] font-medium"
                              style={{ color: theme.text }}
                            >
                              {formatSlotDisplay(slot)}
                            </Text>
                            <Text
                              className="text-[11px] capitalize"
                              style={{ color: theme.textSecondary }}
                            >
                              {slot.sessionType}
                            </Text>
                          </Pressable>
                          <View className="flex-row gap-2">
                            <Pressable
                              onPress={() => handleEditSlot(slot, index)}
                              hitSlop={8}
                              className="p-1"
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
                              className="p-1"
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

                  <View className="mt-4 flex-row items-center justify-between">
                    <Text
                      className="text-[12px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {editingIndex !== null ? "Edit Slot" : "Add New Slot"}
                    </Text>
                    {editingIndex !== null && (
                      <Pressable onPress={handleCancelEdit}>
                        <Text className="text-[13px]" style={{ color: selectedColor }}>
                          Cancel Edit
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <Text
                    className="mt-2 text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Day
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2 py-1"
                  >
                    {DAYS.map((day) => {
                      const isSelected = selectedDay === day.value;
                      return (
                        <Pressable
                          key={day.value}
                          onPress={() => handleDaySelect(day.value)}
                          className="rounded-[8px] border px-4 py-2"
                          style={[
                            { borderColor: theme.border },
                            isSelected && {
                              backgroundColor: selectedColor,
                              borderColor: selectedColor,
                            },
                          ]}
                        >
                          <Text
                            className="text-[12px] font-medium"
                            style={[
                              { color: theme.textSecondary },
                              isSelected && { color: Colors.white },
                            ]}
                          >
                            {day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text
                    className="mt-2 text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Start Time
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2 py-1"
                  >
                    {TIME_OPTIONS.slice(0, -1).map((time) => {
                      const isSelected = selectedStartTime === time;
                      return (
                        <Pressable
                          key={time}
                          onPress={() => handleStartTimeSelect(time)}
                          className="rounded-[8px] border px-2 py-1"
                          style={[
                            { borderColor: theme.border },
                            isSelected && {
                              backgroundColor: selectedColor,
                              borderColor: selectedColor,
                            },
                          ]}
                        >
                          <Text
                            className="text-[12px]"
                            style={[
                              { color: theme.textSecondary },
                              isSelected && { color: Colors.white, fontWeight: "500" },
                            ]}
                          >
                            {formatTime(time)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text
                    className="mt-2 text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    End Time
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-2 py-1"
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
                          className="rounded-[8px] border px-2 py-1"
                          style={[
                            { borderColor: theme.border },
                            isSelected && {
                              backgroundColor: selectedColor,
                              borderColor: selectedColor,
                            },
                            isDisabled && { opacity: 0.4 },
                          ]}
                        >
                          <Text
                            className="text-[12px]"
                            style={[
                              { color: theme.textSecondary },
                              isSelected && { color: Colors.white, fontWeight: "500" },
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
                    className="mt-2 text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Session Type
                  </Text>
                  <View className="flex-row gap-2">
                    {SESSION_TYPES.map((type) => {
                      const isSelected = selectedSessionType === type.value;
                      return (
                        <Pressable
                          key={type.value}
                          onPress={() => handleSessionTypeSelect(type.value)}
                          className="flex-1 items-center rounded-[8px] border py-2"
                          style={[
                            { borderColor: theme.border },
                            isSelected && {
                              backgroundColor: selectedColor,
                              borderColor: selectedColor,
                            },
                          ]}
                        >
                          <Text
                            className="text-[12px] font-medium"
                            style={[
                              { color: theme.textSecondary },
                              isSelected && { color: Colors.white },
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
                      className="mb-2 text-center text-[12px]"
                      style={{ color: Colors.status.danger }}
                    >
                      {error}
                    </Text>
                  ) : null}

                  <Button
                    title={editingIndex !== null ? "Update Slot" : "Add Slot"}
                    onPress={handleSaveSlot}
                    className="mt-4"
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {error && activeSection === "details" ? (
            <Text className="mb-2 text-center text-[12px]" style={{ color: Colors.status.danger }}>
              {error}
            </Text>
          ) : null}

          <View className="flex-row gap-2 py-2">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              className="flex-1"
            />
            <Button
              title="Save"
              onPress={handleSave}
              className="flex-1"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
