import { SwipeableBunkItem } from "@/components/attendance/swipeable-bunk-item";
import { GradientCard } from "@/components/ui/gradient-card";
import { CalendarTheme, Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getBaseUrl } from "@/services/baseurl";
import { useAuthStore } from "@/stores/auth-store";
import { filterPastBunks, selectCourseStats } from "@/stores/bunk-store";
import type {
  AttendanceRecord,
  AttendanceStatus,
  BunkRecord,
  CourseAttendance,
  CourseBunkData,
  MarkedDates,
  SessionType,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  onConfirmUnknownPresent: (courseId: string, record: AttendanceRecord) => void;
  onConfirmUnknownAbsent: (courseId: string, record: AttendanceRecord) => void;
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

// only show Absent and Unknown on calendar (not Present)
const buildMarkedDates = (
  records: AttendanceRecord[],
  selectedDate: string | null,
): MarkedDates => {
  const marked: MarkedDates = {};

  for (const record of records) {
    // skip Present status - only show Absent and Unknown
    if (
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
  // get most recent Absent or Unknown date
  const filtered = records.filter(
    (r) => r.status === "Absent" || r.status === "Unknown",
  );
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
  onConfirmUnknownPresent,
  onConfirmUnknownAbsent,
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
  const attended = pastRecords.filter((r) => r.status === "Present").length;

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

  // Unknown records for selected date
  const selectedUnknown = useMemo((): AttendanceRecord[] => {
    if (!selectedDate) return [];
    return unresolvedUnknown.filter((record) => {
      const { date } = parseDateString(record.date);
      return date === selectedDate;
    });
  }, [selectedDate, unresolvedUnknown]);

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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerInfo}>
              <Text
                style={[styles.courseName, { color: theme.text }]}
                numberOfLines={2}
              >
                {courseAlias}
              </Text>
            </View>
          </View>
          <Text style={[styles.noData, { color: theme.textSecondary }]}>
            No data
          </Text>
        </View>
      </GradientCard>
    );
  }

  return (
    <GradientCard>
      <View style={styles.cardContainer}>
        {courseColor && (
          <View
            style={[styles.colorLineFull, { backgroundColor: courseColor }]}
          />
        )}
        <Pressable
          onPress={handleCardPress}
          style={[isEditMode && styles.editModeCard, styles.cardContent]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerInfo}>
                <Text
                  style={[styles.courseName, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {courseAlias}
                </Text>
                <View style={styles.sessionMeta}>
                  {isCustomCourse ? (
                    <View style={styles.customBadgeRow}>
                      <View
                        style={[
                          styles.customBadge,
                          { backgroundColor: Colors.status.success + "20" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.customBadgeText,
                            { color: Colors.status.success },
                          ]}
                        >
                          Custom
                        </Text>
                      </View>
                      {manualSlotsCount > 0 && (
                        <Text
                          style={[
                            styles.slotsCount,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {manualSlotsCount} slot
                          {manualSlotsCount > 1 ? "s" : ""}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.sessionCount,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {attended} / {totalSessions} sessions
                        <Text
                          style={[
                            styles.percentageSmall,
                            { color: percentageColor },
                          ]}
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
                          style={styles.unknownBadge}
                        >
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
                        </Pressable>
                      )}
                      {manualSlotsCount > 0 && (
                        <View
                          style={[
                            styles.manualSlotsBadge,
                            { backgroundColor: Colors.status.info + "20" },
                          ]}
                        >
                          <Ionicons
                            name="time-outline"
                            size={10}
                            color={Colors.status.info}
                          />
                          <Text
                            style={[
                              styles.manualSlotsText,
                              { color: Colors.status.info },
                            ]}
                          >
                            {manualSlotsCount}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.headerRight}>
              {/* LMS link - only for non-custom courses */}
              {!isCustomCourse && course?.attendanceModuleId && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleOpenLms();
                  }}
                  hitSlop={8}
                >
                  <Ionicons
                    name="open-outline"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              )}

              {/* delete button for custom courses in edit mode */}
              {isCustomCourse && isEditMode && onDeleteCustomCourse && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onDeleteCustomCourse();
                  }}
                  hitSlop={8}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={Colors.status.danger}
                  />
                </Pressable>
              )}

              {/* bunks left - prominent */}
              {isConfigured ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowTotal(!showTotal);
                  }}
                >
                  <View style={styles.bunksDisplayProminent}>
                    <Text
                      style={[styles.bunksValueLarge, { color: bunksColor }]}
                    >
                      {bunksDisplay}
                    </Text>
                    <Text
                      style={[
                        styles.bunksLabelLarge,
                        { color: theme.textSecondary },
                      ]}
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
                  style={[
                    styles.configBtn,
                    { borderColor: Colors.status.warning },
                  ]}
                >
                  <Ionicons
                    name="settings-outline"
                    size={14}
                    color={Colors.status.warning}
                  />
                  <Text
                    style={[
                      styles.configText,
                      { color: Colors.status.warning },
                    ]}
                  >
                    Setup
                  </Text>
                </Pressable>
              )}

              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={theme.textSecondary}
              />
            </View>
          </View>
        </Pressable>
      </View>
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* calendar - only shows Absent and Unknown */}
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

          {/* selected date - Unknown entries (swipe to confirm) - only for LMS courses */}
          {course && selectedDate && selectedUnknown.length > 0 && (
            <View
              style={[styles.sessionDetails, { borderTopColor: theme.border }]}
            >
              <Text
                style={[styles.sectionTitle, { color: Colors.status.unknown }]}
              >
                Unconfirmed ({selectedUnknown.length})
              </Text>
              {selectedUnknown.map((record, idx) => {
                const { time } = parseDateString(record.date);
                const recordKey = buildRecordKey(record);
                const fakeBunk: BunkRecord = {
                  id: recordKey || `unknown-${idx}`,
                  date: record.date,
                  description: record.description,
                  timeSlot: time,
                  note: "",
                  source: "lms",
                  isDutyLeave: false,
                  dutyLeaveNote: "",
                  isMarkedPresent: false,
                  presenceNote: "",
                };
                return (
                  <SwipeableBunkItem
                    key={fakeBunk.id}
                    bunk={fakeBunk}
                    isUnknown
                    attendanceModuleId={course.attendanceModuleId}
                    onMarkDL={() =>
                      onConfirmUnknownAbsent(course.courseId, record)
                    }
                    onRemoveDL={() => {}}
                    onMarkPresent={() =>
                      onConfirmUnknownPresent(course.courseId, record)
                    }
                    onRemovePresent={() => {}}
                    onUpdateNote={() => {}}
                  />
                );
              })}
              <Text style={[styles.swipeHint, { color: theme.textSecondary }]}>
                Swipe left = Present · Swipe right = Absent
              </Text>
            </View>
          )}

          {/* bunks list */}
          {pastBunks.length > 0 && (
            <View style={styles.bunksList}>
              {pastBunks.map((bunk) => (
                <SwipeableBunkItem
                  key={bunk.id}
                  bunk={bunk}
                  attendanceModuleId={course?.attendanceModuleId}
                  onMarkDL={() => onMarkDL(bunk.id)}
                  onRemoveDL={() => onRemoveDL(bunk.id)}
                  onMarkPresent={() => onMarkPresent(bunk.id)}
                  onRemovePresent={() => onRemovePresent(bunk.id)}
                  onUpdateNote={(note) => onUpdateNote(bunk.id, note)}
                />
              ))}
            </View>
          )}

          {/* action buttons */}
          <View style={styles.actionButtons}>
            {/* add bunk button */}
            <Pressable
              onPress={onAddBunk}
              style={[styles.addBunkBtn, { borderColor: theme.border }]}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text
                style={[styles.addBunkText, { color: theme.textSecondary }]}
              >
                Add Bunk
              </Text>
            </Pressable>
          </View>

          {/* swipe hint */}
          {pastBunks.length > 0 && (
            <Text style={[styles.swipeHint, { color: theme.textSecondary }]}>
              Swipe left = Present · Swipe right = DL
            </Text>
          )}

          {/* legend */}
          <View style={styles.legend}>
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
    marginRight: Spacing.md,
  },
  headerInfoWithColor: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardContainer: {
    position: "relative",
  },
  colorLineFull: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
  cardContent: {
    paddingLeft: Spacing.md,
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
  percentageSmall: {
    fontSize: 12,
    fontWeight: "500",
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
  customBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  customBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  slotsCount: {
    fontSize: 12,
  },
  manualSlotsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  manualSlotsText: {
    fontSize: 10,
    fontWeight: "500",
  },
  bunksDisplayProminent: {
    alignItems: "center",
  },
  bunksValueLarge: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 24,
  },
  bunksLabelLarge: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bunksValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  bunksLabel: {
    fontSize: 9,
    lineHeight: 9,
  },
  configBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  configText: {
    fontSize: 12,
    fontWeight: "500",
  },
  editModeCard: {
    opacity: 0.8,
  },
  noData: {
    fontSize: 13,
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingLeft: Spacing.md,
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
  bunkSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  bunksList: {
    gap: 0,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  addBunkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.sm,
    borderStyle: "dashed",
  },
  addBunkText: {
    fontSize: 13,
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
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
  },
});
