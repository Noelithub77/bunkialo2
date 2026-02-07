import { SwipeableAttendanceSlot } from "@/components/attendance/swipeable-attendance-slot";
import { CalendarTheme, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useBunkStore } from "@/stores/bunk-store";
import type { AttendanceRecord, MarkedDates } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { ScrollView } from "react-native-gesture-handler";

interface AbsenceInfo {
  courseId: string;
  courseName: string;
  courseColor: string;
  attendanceModuleId: string | null;
  record: AttendanceRecord;
  timeSlot: string | null;
  isDutyLeave: boolean;
  isMarkedPresent: boolean;
  bunkId: string | null;
}

// parse date string
const parseDateString = (
  dateStr: string,
): { date: string | null; time: string | null } => {
  const cleaned = dateStr.trim();
  const timeMatch = cleaned.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  const time = timeMatch ? timeMatch[1] : null;

  const dateMatch = cleaned.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!dateMatch) return { date: null, time };

  const [, day, monthStr, year] = dateMatch;
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const month = months[monthStr.toLowerCase()];
  if (!month) return { date: null, time };

  return { date: `${year}-${month}-${day.padStart(2, "0")}`, time };
};

const buildRecordKey = (date: string, description: string): string =>
  `${date.trim()}-${description.trim()}`;

interface TotalAbsenceCalendarProps {
  onMarkPresent?: (courseId: string, record: AttendanceRecord) => void;
  onMarkDL?: (courseId: string, record: AttendanceRecord) => void;
  onRemoveDL?: (courseId: string, bunkId: string) => void;
  onRemovePresent?: (courseId: string, bunkId: string) => void;
}

export function TotalAbsenceCalendar({
  onMarkPresent,
  onMarkDL,
  onRemoveDL,
  onRemovePresent,
}: TotalAbsenceCalendarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;

  const attendanceCourses = useAttendanceStore((state) => state.courses);
  const bunkCourses = useBunkStore((state) => state.courses);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // build absence map: date -> array of absence info
  const { markedDates, absenceMap } = useMemo(() => {
    const marked: MarkedDates = {};
    const absMap = new Map<string, AbsenceInfo[]>();

    for (const course of attendanceCourses) {
      const bunkCourse = bunkCourses.find(
        (c) => c.courseId === course.courseId,
      );
      const courseName = bunkCourse?.config?.alias || course.courseName;
      const courseColor = bunkCourse?.config?.color || Colors.courseColors[0];

      for (const record of course.records) {
        // confirmed absences only
        if (record.status !== "Absent" && record.status !== "Unknown") continue;
        const recordKey = buildRecordKey(record.date, record.description);
        const matchingBunk = bunkCourse?.bunks.find(
          (b) => buildRecordKey(b.date, b.description) === recordKey,
        );
        // Unknown is assumed present unless user explicitly marked it
        if (record.status === "Unknown" && (!matchingBunk || matchingBunk.isMarkedPresent)) {
          continue;
        }

        const { date, time } = parseDateString(record.date);
        if (!date) continue;

        // today filter
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (new Date(date) > today) continue;

        if (!marked[date]) {
          marked[date] = { dots: [] };
        }
        marked[date].dots.push({
          key: `${course.courseId}-${marked[date].dots.length}`,
          color: courseColor,
        });

        if (!absMap.has(date)) {
          absMap.set(date, []);
        }
        absMap.get(date)!.push({
          courseId: course.courseId,
          courseName,
          courseColor,
          attendanceModuleId: course.attendanceModuleId,
          record,
          timeSlot: time,
          isDutyLeave: matchingBunk?.isDutyLeave ?? false,
          isMarkedPresent: matchingBunk?.isMarkedPresent ?? false,
          bunkId: matchingBunk?.id ?? null,
        });
      }
    }

    return { markedDates: marked, absenceMap: absMap };
  }, [attendanceCourses, bunkCourses]);

  const selectedAbsences = selectedDate
    ? absenceMap.get(selectedDate) || []
    : [];

  // total absences count - exclude items marked as DL or Present
  const totalAbsences = useMemo(() => {
    let count = 0;
    absenceMap.forEach((arr) => {
      count += arr.filter((a) => !a.isDutyLeave && !a.isMarkedPresent).length;
    });
    return count;
  }, [absenceMap]);

  const handleDayPress = (day: DateData) => {
    setSelectedDate((prev) =>
      prev === day.dateString ? null : day.dateString,
    );
  };

  return (
    <View className="flex-1">
      {/* summary */}
      <View
        className="mb-4 items-center rounded-[12px] p-4"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        <Text className="text-[12px]" style={{ color: theme.textSecondary }}>
          Total Bunks
        </Text>
        <Text className="text-[32px] font-bold" style={{ color: Colors.status.danger }}>
          {totalAbsences}
        </Text>
      </View>

      {/* calendar */}
      <Calendar
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        enableSwipeMonths={false}
        hideExtraDays
        theme={{
          calendarBackground: calTheme.calendarBackground,
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

      {/* selected date absences - swipeable */}
      {selectedDate && selectedAbsences.length > 0 && (
        <View className="mt-4 border-t pt-4" style={{ borderTopColor: theme.border }}>
          <Text className="mb-1 text-[14px] font-semibold" style={{ color: theme.text }}>
            {new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Text>
          <Text className="mb-2 text-[10px] opacity-60" style={{ color: theme.textSecondary }}>
            Swipe left = Present · Swipe right = DL/Absent
          </Text>
          <ScrollView
            className="max-h-[250px]"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {selectedAbsences.map((absence, idx) => (
              <View key={idx} className="mb-2">
                <Text
                  className="mb-0.5 text-[11px] font-semibold"
                  style={{ color: absence.courseColor }}
                >
                  {absence.courseName}
                </Text>
                <SwipeableAttendanceSlot
                  record={absence.record}
                  timeSlot={absence.timeSlot}
                  courseColor={absence.courseColor}
                  isDutyLeave={absence.isDutyLeave}
                  isMarkedPresent={absence.isMarkedPresent}
                  attendanceModuleId={absence.attendanceModuleId}
                  onMarkPresent={() => {
                    if (absence.isMarkedPresent && absence.bunkId) {
                      onRemovePresent?.(absence.courseId, absence.bunkId);
                    } else {
                      onMarkPresent?.(absence.courseId, absence.record);
                    }
                  }}
                  onMarkDL={() => {
                    if (absence.isDutyLeave && absence.bunkId) {
                      onRemoveDL?.(absence.courseId, absence.bunkId);
                    } else {
                      onMarkDL?.(absence.courseId, absence.record);
                    }
                  }}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {selectedDate && selectedAbsences.length === 0 && (
        <View className="items-center gap-2 py-6">
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={Colors.status.success}
          />
          <Text className="text-[14px]" style={{ color: theme.textSecondary }}>
            No absences on this day
          </Text>
        </View>
      )}
    </View>
  );
}
