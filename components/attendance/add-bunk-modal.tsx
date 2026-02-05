import { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors, CalendarTheme } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface AddBunkModalProps {
  visible: boolean;
  courseName: string;
  onClose: () => void;
  onAdd: (date: string, timeSlot: string, note: string) => void;
}

const TIME_SLOTS = [
  "8AM - 9AM",
  "9AM - 10AM",
  "10AM - 11AM",
  "11AM - 12PM",
  "12PM - 1PM",
  "1PM - 2PM",
  "2PM - 3PM",
  "3PM - 4PM",
  "4PM - 5PM",
];

// format date for display: "2026-01-15" -> "Wed 15 Jan 2026"
const formatDateForRecord = (dateString: string, timeSlot: string): string => {
  const date = new Date(dateString);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = days[date.getDay()];
  const dateNum = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${dateNum} ${month} ${year} ${timeSlot}`;
};

export function AddBunkModal({
  visible,
  courseName,
  onClose,
  onAdd,
}: AddBunkModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) {
      setSelectedDate(null);
      setSelectedSlot(null);
      setNote("");
    }
  }, [visible]);

  const handleAdd = () => {
    if (selectedDate && selectedSlot) {
      const formattedDate = formatDateForRecord(selectedDate, selectedSlot);
      onAdd(formattedDate, selectedSlot, note);
      onClose();
    }
  };

  const canAdd = selectedDate && selectedSlot;

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
          className="w-[92%] max-w-[400px] max-h-[85%] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          {/* header */}
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold" style={{ color: theme.text }}>
              Add Bunk
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <Text
            className="mt-1 mb-4 text-[13px]"
            style={{ color: theme.textSecondary }}
            numberOfLines={1}
          >
            {courseName}
          </Text>

          <ScrollView
            className="flex-grow-0"
            showsVerticalScrollIndicator={false}
          >
            {/* calendar */}
            <Text
              className="mb-2 text-[13px] font-medium"
              style={{ color: theme.text }}
            >
              Select Date
            </Text>
            <View
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: theme.border }}
            >
              <Calendar
                onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
                markedDates={
                  selectedDate
                    ? {
                        [selectedDate]: {
                          selected: true,
                          selectedColor: Colors.status.info,
                        },
                      }
                    : {}
                }
                maxDate={new Date().toISOString().split("T")[0]}
                theme={{
                  calendarBackground: "transparent",
                  dayTextColor: calTheme.dayTextColor,
                  textDisabledColor: calTheme.textDisabledColor,
                  monthTextColor: calTheme.monthTextColor,
                  arrowColor: calTheme.arrowColor,
                  todayTextColor: calTheme.todayTextColor,
                  textDayFontSize: 14,
                  textMonthFontSize: 14,
                  textMonthFontWeight: "600",
                }}
              />
            </View>

            {/* time slots */}
            <Text
              className="mb-2 mt-4 text-[13px] font-medium"
              style={{ color: theme.text }}
            >
              Select Time Slot
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => setSelectedSlot(slot)}
                    className="rounded-lg border px-2 py-1"
                    style={[
                      { borderColor: theme.border },
                      isSelected && {
                        backgroundColor: Colors.status.info,
                        borderColor: Colors.status.info,
                      },
                    ]}
                  >
                    <Text
                      className="text-[12px]"
                      style={[
                        { color: theme.textSecondary },
                        isSelected && {
                          color: Colors.white,
                          fontWeight: "500",
                        },
                      ]}
                    >
                      {slot}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* note */}
            <View className="mt-4">
              <Input
                label="Note (optional)"
                placeholder="e.g. Sick leave"
                value={note}
                onChangeText={setNote}
              />
            </View>
          </ScrollView>

          {/* actions */}
          <View className="mt-6 w-full flex-row gap-2">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              className="flex-1"
            />
            <Button
              title="Add Bunk"
              onPress={handleAdd}
              disabled={!canAdd}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
