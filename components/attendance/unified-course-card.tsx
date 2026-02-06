import { SwipeableBunkItem } from "@/components/attendance/swipeable-bunk-item";
import { GradientCard } from "@/components/ui/gradient-card";
import { CalendarTheme, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getBaseUrl } from "@/services/baseurl";
import { useAuthStore } from "@/stores/auth-store";
import { filterPastBunks, selectCourseStats } from "@/stores/bunk-store";
import type {
    AttendanceRecord,
    AttendanceStatus,
    CourseAttendance,
    CourseBunkData,
    MarkedDates,
    SessionType,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Calendar, DateData } from "react-native-calendars";

interface UnifiedCourseCardProps {
  course: CourseAttendance | null;
  bunkData: CourseBunkData | undefined;
  isEditMode: boolean;
  onEdit: () => void;
  onAddBunk: () => void;
  onMarkDL: (bunkId: string) => void;
  onRemoveDL: (bunkId: string) => void;
  onMarkPresent: (bunkId: string) => void;
  onRemovePresent: (bunkId: string) => void;
  onUpdateNote: (bunkId: string, note: string) => void;
  onShowUnknown: (courseId: string) => void;
  onDeleteCustomCourse?: () => void;
}

// 80% threshold
const getPercentageColor = (percentage: number) =>
  percentage >= 80 ? Colors.status.success : Colors.status.danger;

// parse time slot and return duration in hours
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
  return (endMinutes - startMinutes) / 60;
};

const getSessionType = (desc: string, dateStr: string): SessionType => {
  const lower = desc.toLowerCase();
  if (lower.includes("tutorial")) return "tutorial";

  const { time } = parseDateString(dateStr);
  if (parseDurationInHours(time) >= 2) return "lab";
  if (lower.includes("lab")) return "lab";

  return "regular";
};

// parse "Thu 1 Jan 2026 11AM - 12PM" -> { date: "2026-01-01", time: "11AM - 12PM" }
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

const buildRecordKey = (record: AttendanceRecord): string =>
  `${record.date.trim()}-${record.description.trim()}`;

// filter records up to current time only
const filterPastRecords = (records: AttendanceRecord[]): AttendanceRecord[] => {
  const now = new Date();
  return records.filter((record) => {
    const { date, time } = parseDateString(record.date);
    if (!date) return false;
    if (!time) return new Date(date) <= now;
    const [, end] = time.split("-").map((part) => part.trim());
    const dateTime = new Date(`${date} ${end}`);
    if (Number.isNaN(dateTime.getTime())) return new Date(date) <= now;
    return dateTime <= now;
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

// only show confirmed absences on calendar
const buildMarkedDates = (
  records: AttendanceRecord[],
  selectedDate: string | null,
): MarkedDates => {
  const marked: MarkedDates = {};

  for (const record of records) {
    // skip non-absence statuses
    if (
      record.status === "Unknown" ||
      record.status === "Present" ||
      record.status === "Late" ||
      record.status === "Excused"
    )
      continue;

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

  // mark selected date
  if (selectedDate && marked[selectedDate]) {
    marked[selectedDate] = { ...marked[selectedDate], selected: true };
  }

  return marked;
};

const getMostRecentDate = (records: AttendanceRecord[]): string | null => {
  // get most recent confirmed Absent date
  const filtered = records.filter((r) => r.status === "Absent");
  let mostRecent: string | null = null;
  let mostRecentTime = 0;
  for (const record of filtered) {
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

export function UnifiedCourseCard({
  course,
  bunkData,
  isEditMode,
  onEdit,
  onAddBunk,
  onMarkDL,
  onRemoveDL,
  onMarkPresent,
  onRemovePresent,
  onUpdateNote,
  onShowUnknown,
  onDeleteCustomCourse,
}: UnifiedCourseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showTotal, setShowTotal] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;
  const { username } = useAuthStore();

  const isCustomCourse = bunkData?.isCustomCourse ?? false;
  const courseAlias =
    bunkData?.config?.alias || course?.courseName || "Custom Course";
  const courseColor = bunkData?.config?.color;
  const isConfigured = bunkData?.isConfigured && bunkData?.config;
  const manualSlotsCount = bunkData?.manualSlots?.length ?? 0;

  // attendance stats (past only) - only for LMS courses
  const pastRecords = useMemo(
    () => (course ? filterPastRecords(course.records) : []),
    [course],
  );
  const totalSessions = pastRecords.length;
  const confirmedPresentCount = pastRecords.filter(
    (r) => r.status === "Present",
  ).length;

  const bunkKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!bunkData) return keys;
    for (const bunk of bunkData.bunks) {
      keys.add(`${bunk.date.trim()}-${bunk.description.trim()}`);
    }
    return keys;
  }, [bunkData]);

  const displayRecords = useMemo(
    () =>
      pastRecords.filter(
        (record) =>
          record.status !== "Unknown" || !bunkKeys.has(buildRecordKey(record)),
      ),
    [pastRecords, bunkKeys],
  );

  const unresolvedUnknown = useMemo(
    () => displayRecords.filter((record) => record.status === "Unknown"),
    [displayRecords],
  );

  const unknownCount = unresolvedUnknown.length;
  // unknown ("?") defaults to present unless user explicitly confirms absent
  const attended = confirmedPresentCount + unknownCount;
  const percentage =
    totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
  const percentageColor = getPercentageColor(percentage);

  // bunk stats
  const stats = bunkData ? selectCourseStats(bunkData) : null;
  const pastBunks = bunkData ? filterPastBunks(bunkData.bunks) : [];

  // bunks display
  const bunksDisplay = showTotal
    ? `${stats?.usedBunks ?? 0}/${stats?.totalBunks ?? 0}`
    : (stats?.bunksLeft ?? 0).toString();
  const bunksLabel = showTotal ? "used" : "left";
  const bunksColor = !isConfigured
    ? theme.textSecondary
    : (stats?.bunksLeft ?? 0) <= 0
      ? Colors.status.danger
      : (stats?.bunksLeft ?? 0) <= 3
        ? Colors.status.warning
        : Colors.status.success;

  // calendar data - only Absent and Unknown
  const markedDates = useMemo(
    () => buildMarkedDates(displayRecords, selectedDate),
    [displayRecords, selectedDate],
  );
  const initialDate = useMemo(
    () => getMostRecentDate(displayRecords),
    [displayRecords],
  );

  const handleCardPress = () => {
    if (isEditMode) {
      onEdit();
    } else {
      setExpanded(!expanded);
    }
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDate((prev) =>
      prev === day.dateString ? null : day.dateString,
    );
  };

  const handleOpenLms = () => {
    if (course?.attendanceModuleId) {
      const url = `${getBaseUrl(username)}/mod/attendance/view.php?id=${course.attendanceModuleId}`;
      Linking.openURL(url);
    }
  };

  // for custom courses with no bunks yet, still show the card
  if (!isCustomCourse && totalSessions === 0 && pastBunks.length === 0) {
    return (
      <GradientCard>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text
              className="text-base font-semibold"
              style={{ color: theme.text }}
              numberOfLines={2}
            >
              {courseAlias}
            </Text>
          </View>
          <Text className="text-sm" style={{ color: theme.textSecondary }}>
            No data
          </Text>
        </View>
      </GradientCard>
    );
  }

  return (
    <GradientCard>
      <View className="relative">
        {courseColor && (
          <View
            className="absolute bottom-0 left-0 top-0 w-[6px] rounded-l-md"
            style={{ backgroundColor: courseColor }}
          />
        )}
        <Pressable
          onPress={handleCardPress}
          className="pl-4"
          style={isEditMode ? { opacity: 0.85 } : undefined}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: theme.text }}
                numberOfLines={2}
              >
                {courseAlias}
              </Text>
              <View className="mt-1 flex-row items-center gap-2">
                {isCustomCourse ? (
                  <View className="flex-row items-center gap-2">
                    <View
                      className="rounded px-1.5 py-[2px]"
                      style={{ backgroundColor: `${Colors.status.success}20` }}
                    >
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: Colors.status.success }}
                      >
                        Custom
                      </Text>
                    </View>
                    {manualSlotsCount > 0 && (
                      <Text
                        className="text-xs"
                        style={{ color: theme.textSecondary }}
                      >
                        {manualSlotsCount} slot{manualSlotsCount > 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                ) : (
                  <>
                    <Text
                      className="text-sm"
                      style={{ color: theme.textSecondary }}
                    >
                      {attended} / {totalSessions} sessions
                      <Text
                        className="text-xs font-medium"
                        style={{ color: percentageColor }}
                      >
                        {" "}
                        ({percentage}%)
                      </Text>
                    </Text>
                    {unknownCount > 0 && course && (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          onShowUnknown(course.courseId);
                        }}
                        className="flex-row items-center gap-1"
                      >
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
                      </Pressable>
                    )}
                    {manualSlotsCount > 0 && (
                      <View
                        className="flex-row items-center gap-1 rounded px-1 py-[2px]"
                        style={{ backgroundColor: `${Colors.status.info}20` }}
                      >
                        <Ionicons
                          name="time-outline"
                          size={10}
                          color={Colors.status.info}
                        />
                        <Text
                          className="text-[10px] font-semibold"
                          style={{ color: Colors.status.info }}
                        >
                          {manualSlotsCount}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              {!isCustomCourse && course?.attendanceModuleId && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenLms();
                  }}
                  className="p-2"
                >
                  <Ionicons
                    name="open-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}

              {isCustomCourse && isEditMode && onDeleteCustomCourse && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onDeleteCustomCourse();
                  }}
                  className="p-2"
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={Colors.status.danger}
                  />
                </Pressable>
              )}

              {isConfigured ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowTotal(!showTotal);
                  }}
                >
                  <View className="items-center min-w-[56px]">
                    <Text
                      className="text-2xl font-bold leading-6"
                      style={{ color: bunksColor }}
                    >
                      {bunksDisplay}
                    </Text>
                    <Text
                      className="text-[11px] font-medium uppercase tracking-[0.5px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {bunksLabel}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="flex-row items-center gap-1 rounded-sm border px-2 py-1"
                  style={{ borderColor: Colors.status.warning }}
                >
                  <Ionicons
                    name="settings-outline"
                    size={14}
                    color={Colors.status.warning}
                  />
                  <Text
                    className="text-xs font-medium"
                    style={{ color: Colors.status.warning }}
                  >
                    Setup
                  </Text>
                </Pressable>
              )}

              {!isEditMode && (
                <View
                  className="items-center justify-center rounded-full h-8 w-8"
                  style={{ backgroundColor: `${theme.textSecondary}12` }}
                >
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.textSecondary}
                  />
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </View>
      {expanded && (
        <View className="mt-4 pl-4">
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

          {pastBunks.length > 0 && (
            <View className="mt-2 gap-0">
              {pastBunks.map((bunk) => (
                <SwipeableBunkItem
                  key={bunk.id}
                  bunk={bunk}
                  attendanceModuleId={course?.attendanceModuleId ?? null}
                  onMarkDL={() => onMarkDL(bunk.id)}
                  onRemoveDL={() => onRemoveDL(bunk.id)}
                  onMarkPresent={() => onMarkPresent(bunk.id)}
                  onRemovePresent={() => onRemovePresent(bunk.id)}
                  onUpdateNote={(note) => onUpdateNote(bunk.id, note)}
                />
              ))}
            </View>
          )}

          <View className="mt-4 flex-row gap-2">
            <Pressable
              onPress={onAddBunk}
              className="flex-1 flex-row items-center justify-center gap-1.5 border border-dashed rounded-sm py-2"
              style={{ borderColor: theme.border }}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text className="text-sm" style={{ color: theme.textSecondary }}>
                Add Bunk
              </Text>
            </Pressable>
          </View>

          {pastBunks.length > 0 && (
            <Text
              className="mt-2 text-[10px] text-center opacity-60"
              style={{ color: theme.textSecondary }}
            >
              Swipe left = Present · Swipe right = DL
            </Text>
          )}

          <View className="mt-4 flex-row items-center justify-center gap-4 pt-2">
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
          </View>
        </View>
      )}
    </GradientCard>
  );
}
