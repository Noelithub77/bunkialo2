import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { DayOfWeek, ManualSlotInput, SessionType } from "@/types";
import { getRandomCourseColor } from "@/utils/course-color";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { SafeAreaView } from "react-native-safe-area-context";

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
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 px-6"
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
            <Text className="text-[18px] font-semibold" style={{ color: theme.text }}>
              New Course
            </Text>
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
              </View>
            ) : (
              <View className="gap-6">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                    Weekly Slots
                  </Text>
                  <View
                    className="rounded-[8px] px-2 py-0.5"
                    style={{ backgroundColor: Colors.status.info + "20" }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: Colors.status.info }}
                    >
                      CUSTOM
                    </Text>
                  </View>
                </View>

                {slots.length === 0 && (
                  <Text
                    className="text-[11px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Add your weekly timetable slots below.
                  </Text>
                )}

                {slots.length > 0 && (
                  <View className="gap-2">
                    {slots.map((slot, index) => (
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

                <View className="gap-2">
                  <Text
                    className="mt-2 text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Day
                  </Text>
                  <View className="flex-row gap-2">
                    {DAYS.map((day) => {
                      const isSelected = selectedDay === day.value;
                      return (
                        <Pressable
                          key={day.value}
                          onPress={() => handleDaySelect(day.value)}
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
                            {day.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

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

                  <Pressable
                    onPress={handleAddSlot}
                    className="flex-row items-center justify-center gap-1 rounded-[8px] border border-dashed py-2"
                    style={{ borderColor: selectedColor }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={selectedColor}
                    />
                    <Text
                      className="text-[14px] font-medium"
                      style={{ color: selectedColor }}
                    >
                      Add Slot
                    </Text>
                  </Pressable>
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
              title={activeSection === "details" ? "Next" : "Create"}
              onPress={
                activeSection === "details"
                  ? () => setActiveSection("slots")
                  : handleSave
              }
              className="flex-1"
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
