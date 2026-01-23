import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
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
  StyleSheet,
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

type UnknownResolution = "pending" | "present" | "absent" | "dutyLeave";

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
          let resolution: UnknownResolution = "pending";
          let note = "";
          if (matchingBunk) {
            if (matchingBunk.isMarkedPresent) {
              resolution = "present";
              note = matchingBunk.presenceNote;
            } else if (matchingBunk.isDutyLeave) {
              resolution = "dutyLeave";
              note = matchingBunk.dutyLeaveNote;
            } else {
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
    // sort by date descending
    return entries.sort((a, b) => {
      if (a.resolution === "pending" && b.resolution !== "pending") return -1;
      if (a.resolution !== "pending" && b.resolution === "pending") return 1;
      const dateA = a.record.date;
      const dateB = b.record.date;
      return dateB.localeCompare(dateA);
    });
  }, [courses, courseNameById, bunkLookup]);

  const pendingCount = useMemo(
    () =>
      unknownEntries.filter((entry) => entry.resolution === "pending").length,
    [unknownEntries],
  );

  const getResolutionMeta = (
    resolution: UnknownResolution,
  ): { label: string; color: string; icon: string } => {
    switch (resolution) {
      case "present":
        return {
          label: "Marked Present",
          color: Colors.status.success,
          icon: "checkmark-circle",
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
      case "pending":
      default:
        return {
          label: "Pending confirmation",
          color: Colors.status.unknown,
          icon: "help-circle",
        };
    }
  };

  const renderItem = ({ item }: { item: UnknownEntry }) => {
    const time = parseTime(item.record.date);
    const resolutionMeta = getResolutionMeta(item.resolution);
    return (
      <View style={[styles.item, { borderBottomColor: theme.border }]}>
        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemCourse, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.courseName}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemDate, { color: theme.textSecondary }]}>
              {formatDate(item.record.date)}
            </Text>
            {time && (
              <Text style={[styles.itemTime, { color: theme.textSecondary }]}>
                {time}
              </Text>
            )}
          </View>
          <View style={styles.statusRow}>
            <Ionicons
              name={resolutionMeta.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={resolutionMeta.color}
            />
            <Text
              style={[styles.statusText, { color: resolutionMeta.color }]}
            >
              {resolutionMeta.label}
            </Text>
          </View>
          {item.note ? (
            <Text
              style={[styles.noteText, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {item.note}
            </Text>
          ) : null}
        </View>
        <View style={styles.itemActions}>
          {item.resolution === "pending" ? (
            <>
              <Pressable
                onPress={() => onConfirmPresent(item.courseId, item.record)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: Colors.status.success },
                ]}
              >
                <Ionicons name="checkmark" size={16} color={Colors.white} />
              </Pressable>
              <Pressable
                onPress={() => onConfirmAbsent(item.courseId, item.record)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: Colors.status.danger },
                ]}
              >
                <Ionicons name="close" size={16} color={Colors.white} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => onRevert(item.courseId, item.record)}
              style={[
                styles.actionBtn,
                { backgroundColor: Colors.gray[600] },
              ]}
            >
              <Ionicons name="arrow-undo" size={16} color={Colors.white} />
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
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: Colors.status.unknown },
                ]}
              >
                <Ionicons name="help" size={16} color={Colors.white} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>
                Unknown Sessions
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {unknownEntries.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="checkmark-circle"
                size={48}
                color={Colors.status.success}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No unknown sessions found
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {unknownEntries.length} total · {pendingCount} pending ·{" "}
                {unknownEntries.length - pendingCount} resolved
              </Text>
              <FlatList
                data={unknownEntries}
                keyExtractor={(item, idx) =>
                  `${item.courseId}-${item.record.date}-${item.resolution}-${idx}`
                }
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}

          <Button title="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    maxHeight: "70%",
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  list: {
    paddingBottom: Spacing.md,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  itemCourse: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 12,
  },
  itemTime: {
    fontSize: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  noteText: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
  itemActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
  },
});
