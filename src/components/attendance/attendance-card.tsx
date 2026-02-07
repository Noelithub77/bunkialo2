import { SwipeableBunkItem } from "@/components/attendance/swipeable-bunk-item";
import { GradientCard } from "@/components/ui/gradient-card";
import { CalendarTheme, Colors } from "@/constants/theme";
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
import { Pressable, Text, View } from "react-native";
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

const parseTimeToMinutes = (timeStr: string): number | null => {
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
  if (!match) return null;

  const [, hourStr, minuteStr, meridiem] = match;
  const hour12 = parseInt(hourStr, 10);
  const minutes = minuteStr ? parseInt(minuteStr, 10) : 0;
  if (hour12 < 1 || hour12 > 12 || minutes < 0 || minutes > 59) return null;

  let hour24 = hour12 % 12;
  if (meridiem.toUpperCase() === "PM") hour24 += 12;
  return hour24 * 60 + minutes;
};

const getSessionEndDateTime = (
  date: string,
  time: string | null,
): Date | null => {
  const baseDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return null;
  if (!time) return baseDate;

  const [, endPartRaw] = time.split("-").map((part) => part.trim());
  if (!endPartRaw) return baseDate;

  const endMinutes = parseTimeToMinutes(endPartRaw);
  if (endMinutes === null) return baseDate;

  const endDate = new Date(baseDate);
  endDate.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  return endDate;
};

// filter records up to current time only
const filterPastRecords = (records: AttendanceRecord[]): AttendanceRecord[] => {
  const now = new Date();

  return records.filter((record) => {
    const { date, time } = parseDateString(record.date);
    if (!date) return false;
    const sessionEnd = getSessionEndDateTime(date, time);
    if (!sessionEnd) return false;
    return sessionEnd <= now;
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
        <View className="flex-row items-start justify-between">
          <View className="flex-1 flex-row items-start gap-2 mr-4">
            {courseColor && (
              <View
                className="mt-1 h-3 w-3 rounded-full"
                style={{ backgroundColor: courseColor }}
              />
            )}
            <Text
              className="text-base font-semibold"
              style={{ color: theme.text }}
              numberOfLines={2}
            >
              {courseAlias}
            </Text>
          </View>
          <Text className="mt-1 text-sm" style={{ color: theme.textSecondary }}>
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
        <View className="flex-row items-start justify-between">
          <View className="mr-4 flex-1 flex-row items-start gap-2">
            {courseColor && (
              <View
                className="mt-1 h-3 w-3 rounded-full"
                style={{ backgroundColor: courseColor }}
              />
            )}
            <View className="flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: theme.text }}
                numberOfLines={2}
              >
                {courseAlias}
              </Text>
              <View className="mt-1 flex-row items-center gap-2">
                <Text
                  className="text-sm"
                  style={{ color: theme.textSecondary }}
                >
                  {attended} / {totalSessions} sessions
                </Text>
                {unknownCount > 0 && (
                  <View className="flex-row items-center gap-1">
                    <Ionicons
                      name="help"
                      size={10}
                      color={Colors.status.unknown}
                    />
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: Colors.status.unknown }}
                    >
                      {unknownCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <Text
              className="text-2xl font-bold"
              style={{ color: percentageColor }}
            >
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
        <View className="mt-4">
          <View
            className="mb-4 h-px"
            style={{ backgroundColor: theme.border }}
          />

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
              className="mt-2 border-t pt-2"
              style={{ borderTopColor: theme.border }}
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
              <Text
                className="mt-2 text-[10px] text-center opacity-60"
                style={{ color: theme.textSecondary }}
              >
                Swipe left = Present · Swipe right = DL
              </Text>
            </View>
          )}

          {/* legend */}
          <View className="mt-4 flex-row items-center justify-center gap-4 pt-2">
            <View className="flex-row items-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: Colors.status.success }}
              />
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                P
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: Colors.status.danger }}
              />
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                A
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: Colors.status.unknown }}
              />
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                ?
              </Text>
            </View>
            <View className="w-2" />
            <View className="flex-row items-center gap-1">
              <View
                className="h-[10px] w-[3px] rounded"
                style={{ backgroundColor: Colors.sessionType.lab }}
              />
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                Lab
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View
                className="h-[10px] w-[3px] rounded"
                style={{ backgroundColor: Colors.sessionType.tutorial }}
              />
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                Tut
              </Text>
            </View>
          </View>
        </View>
      )}
    </GradientCard>
  );
}
