import { SwipeableAttendanceSlot } from "@/components/attendance/swipeable-attendance-slot";
import { CalendarTheme, Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useBunkStore } from "@/stores/bunk-store";
import type { AttendanceRecord, MarkedDates } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
    const resolvedKeysByCourse = new Map<string, Set<string>>();

    for (const course of bunkCourses) {
      const keys = new Set<string>();
      for (const bunk of course.bunks) {
        keys.add(buildRecordKey(bunk.date, bunk.description));
      }
      resolvedKeysByCourse.set(course.courseId, keys);
    }

    for (const course of attendanceCourses) {
      const bunkCourse = bunkCourses.find(
        (c) => c.courseId === course.courseId,
      );
      const courseName = bunkCourse?.config?.alias || course.courseName;
      const courseColor = bunkCourse?.config?.color || Colors.courseColors[0];
      const resolvedKeys = resolvedKeysByCourse.get(course.courseId);

      for (const record of course.records) {
        // only absences
        if (record.status !== "Absent" && record.status !== "Unknown") continue;
        if (
          record.status === "Unknown" &&
          resolvedKeys?.has(buildRecordKey(record.date, record.description))
        ) {
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
        const recordKey = buildRecordKey(record.date, record.description);
        const matchingBunk = bunkCourse?.bunks.find(
          (b) => buildRecordKey(b.date, b.description) === recordKey,
        );
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
    <View style={styles.container}>
      {/* summary */}
      <View
        style={[styles.summary, { backgroundColor: theme.backgroundSecondary }]}
      >
        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
          Total Bunks
        </Text>
        <Text style={[styles.summaryValue, { color: Colors.status.danger }]}>
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
        <GestureHandlerRootView style={styles.gestureContainer}>
          <View style={[styles.absenceList, { borderTopColor: theme.border }]}>
            <Text style={[styles.dateHeader, { color: theme.text }]}>
              {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
            <Text style={[styles.swipeHint, { color: theme.textSecondary }]}>
              Swipe left = Present · Swipe right = DL/Absent
            </Text>
            <ScrollView
              style={styles.scrollList}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {selectedAbsences.map((absence, idx) => (
                <View key={idx} style={styles.slotWrapper}>
                  <Text
                    style={[styles.courseLabel, { color: absence.courseColor }]}
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
        </GestureHandlerRootView>
      )}

      {selectedDate && selectedAbsences.length === 0 && (
        <View style={styles.noAbsences}>
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={Colors.status.success}
          />
          <Text style={[styles.noAbsencesText, { color: theme.textSecondary }]}>
            No absences on this day
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summary: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "700",
  },
  gestureContainer: {
    flex: 1,
  },
  absenceList: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  swipeHint: {
    fontSize: 10,
    marginBottom: Spacing.sm,
    opacity: 0.6,
  },
  scrollList: {
    maxHeight: 250,
  },
  slotWrapper: {
    marginBottom: Spacing.sm,
  },
  courseLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  noAbsences: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  noAbsencesText: {
    fontSize: 14,
  },
});
