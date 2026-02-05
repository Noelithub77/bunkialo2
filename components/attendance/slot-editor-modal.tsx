import { Button } from "@/components/ui/button";
import { Colors } from "@/constants/theme";
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
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

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
      <View className="flex-1 items-center justify-center">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="w-[92%] max-w-[420px] max-h-[90%] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          {/* header */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1 flex-row items-center gap-2">
              <View
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: courseColor }}
              />
              <View>
                <Text className="text-[18px] font-semibold" style={{ color: theme.text }}>
                  Edit Slots
                </Text>
                <Text
                  className="mt-0.5 text-[12px]"
                  style={{ color: theme.textSecondary }}
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
            className="flex-grow-0"
          >
            {/* existing slots */}
            {existingSlots.length > 0 && (
              <View className="mb-6">
                <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                  Current Slots
                </Text>
                <View className="mt-2 gap-2">
                  {existingSlots.map((slot) => {
                    const isEditing = editingSlot?.id === slot.id;
                    return (
                      <View
                        key={slot.id}
                        className="flex-row items-center justify-between rounded-[8px] p-2"
                        style={[
                          { backgroundColor: theme.backgroundSecondary },
                          isEditing && {
                            borderColor: courseColor,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Pressable
                          className="flex-1"
                          onPress={() => handleEditSlot(slot)}
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
                            onPress={() => handleEditSlot(slot)}
                            hitSlop={8}
                            className="p-1"
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
                    );
                  })}
                </View>
              </View>
            )}

            {/* auto slots from LMS */}
            {autoSlots.length > 0 && (
              <View className="mb-6">
                <View className="mb-2 flex-row items-center gap-2">
                  <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                    From Timetable
                  </Text>
                  <View
                    className="rounded-[8px] px-2 py-0.5"
                    style={{ backgroundColor: courseColor + "30" }}
                  >
                    <Text className="text-[10px] font-semibold" style={{ color: courseColor }}>
                      LMS
                    </Text>
                  </View>
                </View>
                <View className="gap-2">
                  {autoSlots.map((slot) => (
                    <View
                      key={slot.id}
                      className="flex-row items-center justify-between rounded-[8px] p-2"
                      style={[
                        { backgroundColor: theme.backgroundSecondary },
                        slot.isHidden && { opacity: 0.6 },
                      ]}
                    >
                      <View className="flex-1">
                        <Text
                          className="text-[13px] font-medium"
                          style={[
                            { color: theme.text },
                            slot.isHidden && { opacity: 0.5 },
                          ]}
                        >
                          {formatSlotDisplay(slot)}
                        </Text>
                        <Text
                          className="text-[11px] capitalize"
                          style={[
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
                          className="p-1"
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
                <Text className="mt-2 text-[11px] italic" style={{ color: theme.textSecondary }}>
                  These slots are detected from your LMS schedule. Tap the eye
                  to hide.
                </Text>
              </View>
            )}

            {/* slot editor */}
            <View className="mb-6">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-[14px] font-medium" style={{ color: theme.text }}>
                  {editingSlot ? "Edit Slot" : "Add New Slot"}
                </Text>
                {editingSlot && (
                  <Pressable onPress={handleCancelEdit}>
                    <Text className="text-[13px]" style={{ color: courseColor }}>
                      Cancel Edit
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* day selector */}
              <Text className="mb-1 text-[12px]" style={{ color: theme.textSecondary }}>
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
                          backgroundColor: courseColor,
                          borderColor: courseColor,
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

              {/* start time */}
              <Text className="mb-1 text-[12px]" style={{ color: theme.textSecondary }}>
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
                          backgroundColor: courseColor,
                          borderColor: courseColor,
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

              {/* end time */}
              <Text className="mb-1 text-[12px]" style={{ color: theme.textSecondary }}>
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
                      onPress={() => !isDisabled && handleEndTimeSelect(time)}
                      className="rounded-[8px] border px-2 py-1"
                      style={[
                        { borderColor: theme.border },
                        isSelected && {
                          backgroundColor: courseColor,
                          borderColor: courseColor,
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

              {/* session type */}
              <Text className="mb-1 text-[12px]" style={{ color: theme.textSecondary }}>
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
                          backgroundColor: courseColor,
                          borderColor: courseColor,
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

              {/* error */}
              {error ? (
                <Text className="mt-2 text-center text-[12px]" style={{ color: Colors.status.danger }}>
                  {error}
                </Text>
              ) : null}

              {/* save slot button */}
              <Button
                title={editingSlot ? "Update Slot" : "Add Slot"}
                onPress={handleSaveSlot}
                className="mt-4"
              />
            </View>
          </ScrollView>

          {/* close button */}
          <View className="mt-4">
            <Button
              title="Done"
              variant="secondary"
              onPress={onClose}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
