import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type {
  AttendanceRecord,
  BunkRecord,
  CourseAttendance,
  CourseBunkData,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";

interface UnknownStatusModalProps {
  visible: boolean;
  courses: CourseAttendance[];
  bunkCourses?: CourseBunkData[];
  onClose: () => void;
  onConfirmPresent: (courseId: string, record: AttendanceRecord) => void;
  onConfirmAbsent: (courseId: string, record: AttendanceRecord) => void;
  onRevert: (courseId: string, record: AttendanceRecord) => void;
}

type UnknownResolution = "assumedPresent" | "present" | "absent" | "dutyLeave";

interface UnknownEntry {
  courseId: string;
  courseName: string;
  record: AttendanceRecord;
  resolution: UnknownResolution;
  bunkId: string | null;
  note: string;
}

// parse date for display
const formatDate = (dateStr: string): string => {
  const match = dateStr.match(/(\w{3})\s+(\d{1,2})\s+(\w{3})/);
  if (match) return `${match[2]} ${match[3]}`;
  return dateStr.slice(0, 15);
};

// parse time
const parseTime = (dateStr: string): string | null => {
  const timeMatch = dateStr.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  return timeMatch ? timeMatch[1] : null;
};

const buildRecordKey = (date: string, description: string): string =>
  `${date.trim()}-${description.trim()}`;

// filter past records
const filterPast = (records: AttendanceRecord[]): AttendanceRecord[] => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return records.filter((r) => {
    const dateMatch = r.date.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    if (!dateMatch) return false;
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
    const [, day, monthStr, year] = dateMatch;
    const month = months[monthStr.toLowerCase()];
    if (!month) return false;
    const date = new Date(`${year}-${month}-${day.padStart(2, "0")}`);
    return date <= today;
  });
};

export function UnknownStatusModal({
  visible,
  courses,
  bunkCourses,
  onClose,
  onConfirmPresent,
  onConfirmAbsent,
  onRevert,
}: UnknownStatusModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const bunkLookup = useMemo(() => {
    const map = new Map<string, Map<string, BunkRecord>>();
    if (!bunkCourses) return map;
    for (const course of bunkCourses) {
      const courseMap = new Map<string, BunkRecord>();
      for (const bunk of course.bunks) {
        courseMap.set(buildRecordKey(bunk.date, bunk.description), bunk);
      }
      map.set(course.courseId, courseMap);
    }
    return map;
  }, [bunkCourses]);

  const courseNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!bunkCourses) return map;
    for (const course of bunkCourses) {
      map.set(course.courseId, course.config?.alias || course.courseName);
    }
    return map;
  }, [bunkCourses]);

  const unknownEntries = useMemo((): UnknownEntry[] => {
    const entries: UnknownEntry[] = [];
    for (const course of courses) {
      const pastRecords = filterPast(course.records);
      for (const record of pastRecords) {
        if (record.status === "Unknown") {
          const recordKey = buildRecordKey(record.date, record.description);
          const matchingBunk = bunkLookup.get(course.courseId)?.get(recordKey);
          let resolution: UnknownResolution = "assumedPresent";
          let note = "";
          if (matchingBunk) {
            if (matchingBunk.isDutyLeave) {
              resolution = "dutyLeave";
              note = matchingBunk.dutyLeaveNote;
            } else if (matchingBunk.isMarkedPresent) {
              resolution = "present";
              note = matchingBunk.presenceNote;
            } else if (!matchingBunk.isMarkedPresent) {
              resolution = "absent";
              note = matchingBunk.note;
            }
          }
          entries.push({
            courseId: course.courseId,
            courseName:
              courseNameById.get(course.courseId) || course.courseName,
            record,
            resolution,
            bunkId: matchingBunk?.id ?? null,
            note,
          });
        }
      }
    }
    // Keep unresolved unknowns at the top; confirmed resolutions go last.
    // Within each group, keep the existing date-descending ordering.
    return entries.sort((a, b) => {
      const aResolved = a.resolution !== "assumedPresent";
      const bResolved = b.resolution !== "assumedPresent";
      if (aResolved !== bResolved) return aResolved ? 1 : -1;
      return b.record.date.localeCompare(a.record.date);
    });
  }, [courses, courseNameById, bunkLookup]);

  const assumedPresentCount = useMemo(
    () =>
      unknownEntries.filter((entry) => entry.resolution === "assumedPresent")
        .length,
    [unknownEntries],
  );
  const confirmedPresentCount = useMemo(
    () => unknownEntries.filter((entry) => entry.resolution === "present").length,
    [unknownEntries],
  );
  const absentCount = useMemo(
    () => unknownEntries.filter((entry) => entry.resolution === "absent").length,
    [unknownEntries],
  );
  const resolvedCount = useMemo(
    () => unknownEntries.length - assumedPresentCount,
    [assumedPresentCount, unknownEntries.length],
  );

  const getResolutionMeta = (
    resolution: UnknownResolution,
  ): { label: string; color: string; icon: string } => {
    switch (resolution) {
      case "assumedPresent":
        return {
          label: "Assumed Present",
          color: Colors.status.success,
          icon: "checkmark-circle",
        };
      case "present":
        return {
          label: "Confirmed Present",
          color: Colors.status.success,
          icon: "checkmark-done-circle",
        };
      case "absent":
        return {
          label: "Marked Absent",
          color: Colors.status.danger,
          icon: "close-circle",
        };
      case "dutyLeave":
        return {
          label: "Marked DL",
          color: Colors.status.info,
          icon: "briefcase",
        };
      default:
        return {
          label: "Assumed Present",
          color: Colors.status.success,
          icon: "checkmark-circle",
        };
    }
  };

  const renderItem = ({ item }: { item: UnknownEntry }) => {
    const time = parseTime(item.record.date);
    const resolutionMeta = getResolutionMeta(item.resolution);
    return (
      <View
        className="mb-3 flex-row items-center justify-between rounded-2xl border px-3 py-3"
        style={{
          borderColor: theme.border,
          backgroundColor: theme.surface,
          shadowColor: "#000",
          shadowOpacity: isDark ? 0.2 : 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <View
          className="mr-3 h-full w-1.5 rounded-full"
          style={{ backgroundColor: resolutionMeta.color }}
        />
        <View className="mr-2 flex-1">
          <Text
            className="text-sm font-medium"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {item.courseName}
          </Text>
          <View className="mt-0.5 flex-row gap-2">
            <Text className="text-xs" style={{ color: theme.textSecondary }}>
              {formatDate(item.record.date)}
            </Text>
            {time && (
              <Text className="text-xs" style={{ color: theme.textSecondary }}>
                {time}
              </Text>
            )}
          </View>
          <View className="mt-1 flex-row items-center gap-1.5">
            <Ionicons
              name={resolutionMeta.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={resolutionMeta.color}
            />
            <Text
              className="text-xs font-medium"
              style={{ color: resolutionMeta.color }}
            >
              {resolutionMeta.label}
            </Text>
            {item.resolution === "assumedPresent" ? (
              <View
                className="rounded-full px-2 py-0.5"
                style={{ backgroundColor: `${Colors.status.unknown}22` }}
              >
                <Text
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: Colors.status.unknown }}
                >
                  pending
                </Text>
              </View>
            ) : null}
          </View>
          {item.note ? (
            <Text
              className="mt-0.5 text-[11px] italic"
              style={{ color: theme.textSecondary }}
              numberOfLines={2}
            >
              {item.note}
            </Text>
          ) : null}
        </View>
        <View className="flex-row gap-2">
          {item.resolution === "assumedPresent" ? (
            <>
              <Pressable
                onPress={() => onConfirmPresent(item.courseId, item.record)}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${Colors.status.success}18`,
                  borderWidth: 1,
                  borderColor: `${Colors.status.success}55`,
                }}
              >
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={Colors.status.success}
                />
              </Pressable>
              <Pressable
                onPress={() => onConfirmAbsent(item.courseId, item.record)}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${Colors.status.danger}18`,
                  borderWidth: 1,
                  borderColor: `${Colors.status.danger}55`,
                }}
              >
                <Ionicons name="close" size={18} color={Colors.status.danger} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => onRevert(item.courseId, item.record)}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${theme.textSecondary}1f`,
                borderWidth: 1,
                borderColor: `${theme.textSecondary}55`,
              }}
            >
              <Ionicons name="arrow-undo" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/50" onPress={onClose} />
        <View
          className="max-h-[72%] rounded-t-3xl px-5 pb-5 pt-4"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-3 items-center">
            <View
              className="h-1.5 w-12 rounded-full"
              style={{ backgroundColor: theme.border }}
            />
          </View>
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: Colors.status.unknown }}
              >
                <Ionicons name="help" size={16} color={Colors.white} />
              </View>
              <Text className="text-lg font-semibold" style={{ color: theme.text }}>
                Unknown Sessions
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.surface }}
            >
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>
          <Text className="mb-3 text-xs" style={{ color: theme.textSecondary }}>
            Review pending sessions quickly. Confirmed ones are grouped at the end.
          </Text>

          {unknownEntries.length === 0 ? (
            <View className="items-center gap-4 py-12">
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={Colors.status.success}
              />
              <Text className="text-sm" style={{ color: theme.textSecondary }}>
                No unknown sessions found
              </Text>
            </View>
          ) : (
            <>
              <View className="mb-3 flex-row flex-wrap gap-2">
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: theme.surface }}
                >
                  <Text className="text-xs" style={{ color: theme.textSecondary }}>
                    {unknownEntries.length} total
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${Colors.status.success}20` }}
                >
                  <Text className="text-xs" style={{ color: Colors.status.success }}>
                    {assumedPresentCount} pending
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${Colors.status.info}20` }}
                >
                  <Text className="text-xs" style={{ color: Colors.status.info }}>
                    {resolvedCount} resolved
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${Colors.status.success}20` }}
                >
                  <Text className="text-xs" style={{ color: Colors.status.success }}>
                    {confirmedPresentCount} present
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: `${Colors.status.danger}20` }}
                >
                  <Text className="text-xs" style={{ color: Colors.status.danger }}>
                    {absentCount} absent
                  </Text>
                </View>
              </View>
              <FlatList
                data={unknownEntries}
                keyExtractor={(item, idx) =>
                  `${item.courseId}-${item.record.date}-${item.resolution}-${idx}`
                }
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 4 }}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
