import { SwipeableBunkItem } from "@/components/attendance/swipeable-bunk-item";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { GradientCard } from "@/components/ui/gradient-card";
import { CalendarTheme, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { filterPastBunks, selectCourseStats } from "@/stores/bunk-store";
import type {
  AttendanceRecord,
  AttendanceStatus,
  BunkRecord,
  CourseAttendance,
  CourseBunkData,
  MarkedDates,
} from "@/types";
import {
  filterCompletedAttendanceRecords,
  getRecordKeyVariants,
} from "@/utils/attendance-helpers";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
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

const getCurrentBufferColor = (buffer: number): string => {
  if (buffer > 0) return Colors.status.success;
  if (buffer < 0) return Colors.status.danger;
  return Colors.status.warning;
};

const formatMetric = (value: number): string => value.toString();

const MONTH_TO_NUMBER: Record<string, string> = {
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

type DayKey = string;

const toDayKey = (
  raw: string,
  fallbackYear: number = new Date().getFullYear(),
): DayKey | null => {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const isoMatch = cleaned.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const dayMonthYearMatch = cleaned.match(
    /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/,
  );
  if (dayMonthYearMatch) {
    const [, day, monthRaw, year] = dayMonthYearMatch;
    const month = MONTH_TO_NUMBER[monthRaw.toLowerCase()];
    if (!month) return null;
    return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  const dayMonthMatch = cleaned.match(/(\d{1,2})\s+([A-Za-z]{3})\b/);
  if (dayMonthMatch) {
    const [, day, monthRaw] = dayMonthMatch;
    const month = MONTH_TO_NUMBER[monthRaw.toLowerCase()];
    if (!month) return null;
    return `${fallbackYear}-${month}-${day.padStart(2, "0")}`;
  }

  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseBunkDateKey = (dateStr: string): string | null => {
  return toDayKey(dateStr);
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
    case "Duty Leave":
      return Colors.status.info;
    case "Unknown":
      return Colors.status.unknown;
  }
};

// calendar marks absence + unresolved unknown dates, list filtering remains DL-only
const buildMarkedDates = (
  records: AttendanceRecord[],
  bunks: BunkRecord[],
  selectedDate: string | null,
): MarkedDates => {
  const marked: MarkedDates = {};
  const dutyLeaveDays = new Set<string>();

  for (const bunk of bunks) {
    if (!bunk.isDutyLeave) continue;
    const date = parseBunkDateKey(bunk.date);
    if (!date) continue;
    dutyLeaveDays.add(date);
  }

  const pushDot = (date: string, color: string) => {
    const existing = marked[date] ?? { dots: [] };
    marked[date] = {
      ...existing,
      dots: [{ key: `${date}-${color}`, color }],
    };
  };

  for (const record of records) {
    if (
      record.status === "Present" ||
      record.status === "Late" ||
      record.status === "Excused"
    ) {
      continue;
    }

    const date = toDayKey(record.date);
    if (!date) continue;
    if (dutyLeaveDays.has(date)) continue;

    pushDot(date, getStatusColor(record.status));
  }

  for (const date of dutyLeaveDays) {
    // If a day has DL, show blue only for that day.
    pushDot(date, Colors.status.info);
  }

  // mark selected date
  if (selectedDate) {
    const existing = marked[selectedDate] ?? { dots: [] };
    marked[selectedDate] = {
      ...existing,
      selected: true,
    };
  }

  return marked;
};

const getMostRecentDate = (records: AttendanceRecord[]): string | null => {
  const filtered = records.filter(
    (record) => record.status === "Absent" || record.status === "Unknown",
  );
  let mostRecent: string | null = null;
  let mostRecentTime = 0;
  for (const record of filtered) {
    const date = toDayKey(record.date);
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
  const [showFullSemMetric, setShowFullSemMetric] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const calTheme = isDark ? CalendarTheme.dark : CalendarTheme.light;

  const isCustomCourse = bunkData?.isCustomCourse ?? false;
  const courseAlias =
    bunkData?.config?.alias || course?.courseName || "Custom Course";
  const courseColor = bunkData?.config?.color;
  const isConfigured = bunkData?.isConfigured && bunkData?.config;
  const manualSlotsCount = bunkData?.manualSlots?.length ?? 0;

  // attendance stats (past only) - only for LMS courses
  const pastRecords = useMemo(
    () => (course ? filterCompletedAttendanceRecords(course.records) : []),
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
      for (const key of getRecordKeyVariants(bunk)) {
        keys.add(key);
      }
    }
    return keys;
  }, [bunkData]);

  const displayRecords = useMemo(
    () =>
      pastRecords.filter(
        (record) =>
          record.status !== "Unknown" ||
          !getRecordKeyVariants(record).some((key) => bunkKeys.has(key)),
      ),
    [pastRecords, bunkKeys],
  );

  const unresolvedUnknown = useMemo(
    () => displayRecords.filter((record) => record.status === "Unknown"),
    [displayRecords],
  );

  const unknownCount = unresolvedUnknown.length;
  const correctedPresentCount = useMemo(
    () =>
      bunkData
        ? filterPastBunks(bunkData.bunks).filter((bunk) => bunk.isMarkedPresent)
            .length
        : 0,
    [bunkData],
  );
  const dutyLeaveCount = useMemo(
    () =>
      bunkData
        ? filterPastBunks(bunkData.bunks).filter((bunk) => bunk.isDutyLeave)
            .length
        : 0,
    [bunkData],
  );
  // Unknown ("?") defaults to present; DL and present corrections are treated as attended.
  const attended =
    confirmedPresentCount +
    unknownCount +
    correctedPresentCount +
    dutyLeaveCount;
  const percentage =
    totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0;
  const percentageColor = getPercentageColor(percentage);

  // bunk stats
  const stats = bunkData
    ? selectCourseStats(
        bunkData,
        course
          ? {
              totalSessions,
              attendedSessions: attended,
            }
          : undefined,
      )
    : null;
  const pastBunks = useMemo(
    () => (bunkData ? filterPastBunks(bunkData.bunks) : []),
    [bunkData],
  );
  const bunksByDay = useMemo(() => {
    const byDay = new Map<DayKey, BunkRecord[]>();
    for (const bunk of pastBunks) {
      const dayKey = parseBunkDateKey(bunk.date);
      if (!dayKey) continue;
      const existing = byDay.get(dayKey) ?? [];
      existing.push(bunk);
      byDay.set(dayKey, existing);
    }
    return byDay;
  }, [pastBunks]);
  const displayedBunks = useMemo(() => {
    if (!selectedDate) return pastBunks;
    return bunksByDay.get(selectedDate) ?? [];
  }, [bunksByDay, pastBunks, selectedDate]);

  // bunks display
  const heuristicBunksLeft = stats?.heuristicBunksLeft ?? 0;
  const currentBuffer = stats?.bufferTo80Now ?? null;
  const hasCurrentBuffer = currentBuffer !== null;
  const showingFullSemMetric = !hasCurrentBuffer || showFullSemMetric;
  const currentMetricDisplay =
    hasCurrentBuffer && currentBuffer !== null
      ? formatMetric(currentBuffer)
      : heuristicBunksLeft.toString();
  const heuristicMetricDisplay = heuristicBunksLeft.toString();
  const metricDisplay = showingFullSemMetric
    ? heuristicMetricDisplay
    : currentMetricDisplay;
  const heuristicUncertainty = stats?.heuristicUncertainty ?? 1;
  const heuristicExpandedLabel = hasCurrentBuffer
    ? `Full sem estimate: ${heuristicBunksLeft}`
    : null;
  const heuristicExpandedUncertainty = hasCurrentBuffer
    ? `±${heuristicUncertainty}`
    : null;
  const currentMetricColor = !isConfigured
    ? theme.textSecondary
    : hasCurrentBuffer && currentBuffer !== null
      ? getCurrentBufferColor(currentBuffer)
      : heuristicBunksLeft < 0
        ? Colors.status.danger
        : heuristicBunksLeft <= 3
          ? Colors.status.warning
          : Colors.status.success;
  const heuristicMetricColor = !isConfigured
    ? theme.textSecondary
    : heuristicBunksLeft < 0
      ? Colors.status.danger
      : heuristicBunksLeft <= 3
        ? Colors.status.warning
        : Colors.status.success;
  const metricColor = showingFullSemMetric
    ? heuristicMetricColor
    : currentMetricColor;
  const metricCaption = showingFullSemMetric ? "full sem" : "from 80%";
  const metricMinWidth = 92;

  // calendar data - duty leave dates only
  const markedDates = useMemo(
    () => buildMarkedDates(displayRecords, pastBunks, selectedDate),
    [displayRecords, pastBunks, selectedDate],
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

  const handleMetricPress = () => {
    if (!hasCurrentBuffer) return;
    setShowFullSemMetric((prev) => !prev);
  };

  const handleOpenAttendancePortal = () => {
    void Linking.openURL("https://attendance.iiitkottayam.ac.in/student");
  };

  const handleOpenResources = () => {
    if (!course?.lmsCourseId) {
      Toast.show("No LMS course id found for resources", { type: "error" });
      return;
    }

    router.push({
      pathname: "/course/[courseid]",
      params: { courseid: course.lmsCourseId },
    });
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
          <View className="flex-row items-start justify-between gap-4">
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

            <View className="flex-row items-start gap-2">
              {!isCustomCourse && course?.lmsCourseId && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenResources();
                  }}
                  className="p-2"
                >
                  <Ionicons
                    name="git-network-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}

              {!isCustomCourse && course?.attendanceCourseId && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenAttendancePortal();
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
                    handleMetricPress();
                  }}
                  className="items-center justify-center rounded-2xl px-3 py-2"
                  style={{
                    minWidth: metricMinWidth,
                    backgroundColor: `${metricColor}12`,
                  }}
                >
                  <View className="items-center">
                    <Text
                      className="text-[28px] font-bold leading-7"
                      style={{ color: metricColor }}
                    >
                      {metricDisplay}
                    </Text>
                    <Text
                      className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.8px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {metricCaption}
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
                  className="mt-1 h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `${theme.textSecondary}10`,
                    borderWidth: 1,
                    borderColor: `${theme.textSecondary}10`,
                  }}
                >
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
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

          {heuristicExpandedLabel && heuristicExpandedUncertainty && (
            <View className="mb-4 items-center">
              <View
                className="flex-row items-center gap-2.5 rounded-2xl px-4 py-2"
                style={{
                  backgroundColor: `${Colors.status.warning}14`,
                  borderWidth: 1,
                  borderColor: `${Colors.status.warning}28`,
                }}
              >
                <Ionicons
                  name="warning-outline"
                  size={14}
                  color={Colors.status.warning}
                />
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: theme.text }}
                >
                  {heuristicExpandedLabel}
                </Text>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${Colors.status.warning}20` }}
                >
                  <Text
                    className="text-[11px] font-bold"
                    style={{ color: Colors.status.warning }}
                  >
                    {heuristicExpandedUncertainty}
                  </Text>
                </View>
              </View>
            </View>
          )}

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

          {displayedBunks.length > 0 && (
            <View className="mt-2 gap-0">
              {displayedBunks.map((bunk) => (
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

          {selectedDate && displayedBunks.length === 0 && (
            <Text
              className="mt-2 text-[12px] text-center"
              style={{ color: theme.textSecondary }}
            >
              No bunks on selected date
            </Text>
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

          {displayedBunks.length > 0 && (
            <Text
              className="mt-2 text-[10px] text-center opacity-60"
              style={{ color: theme.textSecondary }}
            >
              {selectedDate
                ? "Showing bunks for selected date"
                : "Swipe left = Present · Swipe right = DL"}
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
            <View className="flex-row items-center gap-1">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: Colors.status.info }}
              />
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                DL
              </Text>
            </View>
          </View>
        </View>
      )}
    </GradientCard>
  );
}
