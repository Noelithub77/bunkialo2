import { SwipeableBunkItem } from "@/components/attendance/swipeable-bunk-item";
import { GradientCard } from "@/components/ui/gradient-card";
import { CalendarTheme, Colors, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useBunkStore } from "@/stores/bunk-store";
import type {
    AttendanceRecord,
    AttendanceStatus,
    BunkRecord,
    CourseAttendance,
    MarkedDates,
    SessionType,
} from "@/types";
import { extractCourseName } from "@/utils/course-name";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";

interface AttendanceCardProps {
  course: CourseAttendance;
  onMarkPresent?: (record: AttendanceRecord) => void;
  onMarkDL?: (record: AttendanceRecord) => void;
}

// 80% threshold
const getPercentageColor = (percentage: number) => {
  return percentage >= 80 ? Colors.status.success : Colors.status.danger;
};

// parse time slot like "11AM - 12PM" or "10:00AM - 12:00PM" and return duration in hours
const parseDurationInHours = (timeSlot: string | null): number => {
  if (!timeSlot) return 0;

  const timeMatch = timeSlot.match(
    /(\d{1,2})(?::(\d{2}))?(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?(AM|PM)/i,
  );
  if (!timeMatch) return 0;

  const [, startHour, startMin, startMeridiem, endHour, endMin, endMeridiem] =
    timeMatch;

  const startHours24 =
    (parseInt(startHour) % 12) +
    (startMeridiem.toUpperCase() === "PM" ? 12 : 0);
  const endHours24 =
    (parseInt(endHour) % 12) + (endMeridiem.toUpperCase() === "PM" ? 12 : 0);

  const startMinutes = startHours24 * 60 + (startMin ? parseInt(startMin) : 0);
  const endMinutes = endHours24 * 60 + (endMin ? parseInt(endMin) : 0);

  const durationMinutes = endMinutes - startMinutes;

  return durationMinutes / 60;
};

const getSessionType = (desc: string, dateStr: string): SessionType => {
  const lower = desc.toLowerCase();

  if (lower.includes("tutorial")) return "tutorial";

  const { time } = parseDateString(dateStr);
  const durationHours = parseDurationInHours(time);

  if (durationHours >= 2) return "lab";

  if (lower.includes("lab")) return "lab";

  return "regular";
};

// parse "Thu 1 Jan 2026 11AM - 12PM" -> { date: "2026-01-01", time: "11AM - 12PM" }
const parseDateString = (
  dateStr: string,
): { date: string | null; time: string | null } => {
  const cleaned = dateStr.trim();

  // extract time slot
  const timeMatch = cleaned.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  const time = timeMatch ? timeMatch[1] : null;

  // extract date part
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

  return {
    date: `${year}-${month}-${day.padStart(2, "0")}`,
    time,
  };
};

// filter records up to today only
const filterPastRecords = (records: AttendanceRecord[]): AttendanceRecord[] => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return records.filter((record) => {
    const { date } = parseDateString(record.date);
    if (!date) return false;
    return new Date(date) <= today;
  });
};

// status to color
const getStatusColor = (status: AttendanceStatus): string => {
  switch (status) {
    case "Present":
      return Colors.status.success;
    case "Absent":
      return Colors.status.danger;
    case "Late":
      return Colors.status.warning;
    case "Excused":
      return Colors.status.info;
    case "Unknown":
      return Colors.status.unknown;
  }
};

const buildMarkedDates = (records: AttendanceRecord[]): MarkedDates => {
  const marked: MarkedDates = {};

  for (const record of records) {
    const { date } = parseDateString(record.date);
    if (!date) continue;

    const color = getStatusColor(record.status);
    const sessionType = getSessionType(record.description, record.date);

    if (!marked[date]) {
      marked[date] = { dots: [] };
    }

    marked[date].dots.push({
      key: `${sessionType}-${record.status}-${marked[date].dots.length}`,
      color,
    });
  }

  return marked;
};

const getMostRecentDate = (records: AttendanceRecord[]): string | null => {
  let mostRecent: string | null = null;
  let mostRecentTime = 0;

  for (const record of records) {
    const { date } = parseDateString(record.date);
    if (!date) continue;
    const time = new Date(date).getTime();
    if (time > mostRecentTime) {
      mostRecentTime = time;
      mostRecent = date;
    }
  }

  return mostRecent;
};

export function AttendanceCard({
  course,
  onMarkPresent,
  onMarkDL,
}: AttendanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;

  // get alias and color from bunk store
  const bunkCourses = useBunkStore((state) => state.courses);
  const bunkCourse = useMemo(
    () => bunkCourses.find((c) => c.courseId === course.courseId),
    [bunkCourses, course.courseId],
  );
  const bunkByRecordKey = useMemo(() => {
    const map = new Map<string, BunkRecord>();
    if (!bunkCourse) return map;
    for (const bunk of bunkCourse.bunks) {
      map.set(`${bunk.date}-${bunk.description}`, bunk);
    }
    return map;
  }, [bunkCourse]);
  const courseAlias =
    bunkCourse?.config?.alias || extractCourseName(course.courseName);
  const courseColor = bunkCourse?.config?.color;

  // filter to past sessions only
  const pastRecords = useMemo(
    () => filterPastRecords(course.records),
    [course.records],
  );
  const totalSessions = pastRecords.length;
  const attended = pastRecords.filter((r) => r.status === "Present").length;
  const unknownCount = pastRecords.filter((r) => r.status === "Unknown").length;
  const percentage =
    totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;

  const percentageColor = getPercentageColor(percentage);
  const markedDates = useMemo(
    () => buildMarkedDates(pastRecords),
    [pastRecords],
  );
  const initialDate = useMemo(
    () => getMostRecentDate(pastRecords),
    [pastRecords],
  );

  // convert attendance sessions to bunk format for SwipeableBunkItem
  const selectedBunks = useMemo((): BunkRecord[] => {
    if (!selectedDate) return [];
    return pastRecords
      .filter((record) => parseDateString(record.date).date === selectedDate)
      .map((record) => {
        const recordKey = `${record.date}-${record.description}`;
        const bunkMatch = bunkByRecordKey.get(recordKey);
        if (bunkMatch) return bunkMatch;
        const { time } = parseDateString(record.date);
        return {
          id: recordKey,
          date: record.date,
          description: record.description,
          timeSlot: time,
          note: record.remarks || "",
          source: "lms" as const,
          isDutyLeave: false,
          dutyLeaveNote: "",
          isMarkedPresent: record.status === "Present",
          presenceNote: "",
        };
      });
  }, [selectedDate, pastRecords, bunkByRecordKey]);

  if (totalSessions === 0) {
    return (
      <GradientCard>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {courseColor && (
              <View
                style={[styles.colorDot, { backgroundColor: courseColor }]}
              />
            )}
            <Text
              style={[styles.courseName, { color: theme.text }]}
              numberOfLines={2}
            >
              {courseAlias}
            </Text>
          </View>
          <Text style={[styles.noData, { color: theme.textSecondary }]}>
            No attendance data
          </Text>
        </View>
      </GradientCard>
    );
  }

  const handleDayPress = (day: DateData) => {
    setSelectedDate((prev) =>
      prev === day.dateString ? null : day.dateString,
    );
  };

  return (
    <GradientCard>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {courseColor && (
              <View
                style={[styles.colorDot, { backgroundColor: courseColor }]}
              />
            )}
            <View style={styles.headerInfo}>
              <Text
                style={[styles.courseName, { color: theme.text }]}
                numberOfLines={2}
              >
                {courseAlias}
              </Text>
              <View style={styles.sessionMeta}>
                <Text
                  style={[styles.sessionCount, { color: theme.textSecondary }]}
                >
                  {attended} / {totalSessions} sessions
                </Text>
                {unknownCount > 0 && (
                  <View style={styles.unknownBadge}>
                    <Ionicons
                      name="help"
                      size={10}
                      color={Colors.status.unknown}
                    />
                    <Text
                      style={[
                        styles.unknownText,
                        { color: Colors.status.unknown },
                      ]}
                    >
                      {unknownCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.percentage, { color: percentageColor }]}>
              {percentage}%
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.textSecondary}
            />
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.calendarContainer}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Calendar
            markingType="multi-dot"
            markedDates={markedDates}
            initialDate={initialDate || undefined}
            onDayPress={handleDayPress}
            enableSwipeMonths
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

          {/* selected date sessions - swipeable */}
          {selectedDate && selectedBunks.length > 0 && (
            <View
              style={[styles.sessionDetails, { borderTopColor: theme.border }]}
            >
              {selectedBunks.map((bunk) => (
                <SwipeableBunkItem
                  key={bunk.id}
                  bunk={bunk}
                  attendanceModuleId={course.attendanceModuleId}
                  onMarkDL={() => {
                    const record = pastRecords.find(
                      (r) =>
                        r.date === bunk.date &&
                        r.description === bunk.description,
                    );
                    if (record) onMarkDL?.(record);
                  }}
                  onRemoveDL={() => {}}
                  onMarkPresent={() => {
                    const record = pastRecords.find(
                      (r) =>
                        r.date === bunk.date &&
                        r.description === bunk.description,
                    );
                    if (record) onMarkPresent?.(record);
                  }}
                  onRemovePresent={() => {}}
                  onUpdateNote={() => {}}
                />
              ))}
              <Text style={[styles.swipeHint, { color: theme.textSecondary }]}>
                Swipe left = Present · Swipe right = DL
              </Text>
            </View>
          )}

          {/* legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: Colors.status.success },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                P
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: Colors.status.danger },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                A
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: Colors.status.unknown },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                ?
              </Text>
            </View>
            <View style={styles.legendSpacer} />
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendBar,
                  { backgroundColor: Colors.sessionType.lab },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                Lab
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendBar,
                  { backgroundColor: Colors.sessionType.tutorial },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                Tut
              </Text>
            </View>
          </View>
        </View>
      )}
    </GradientCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginRight: Spacing.md,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  courseName: {
    fontSize: 16,
    fontWeight: "600",
  },
  sessionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
  },
  sessionCount: {
    fontSize: 13,
  },
  unknownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  unknownText: {
    fontSize: 11,
    fontWeight: "500",
  },
  percentage: {
    fontSize: 24,
    fontWeight: "700",
  },
  noData: {
    fontSize: 13,
    marginTop: 4,
  },
  calendarContainer: {
    marginTop: Spacing.md,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  sessionDetails: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  swipeHint: {
    fontSize: 10,
    textAlign: "center",
    marginTop: Spacing.sm,
    opacity: 0.6,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendSpacer: {
    width: Spacing.sm,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendBar: {
    width: 3,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
  },
});
