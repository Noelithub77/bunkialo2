import { Colors, Radius, Spacing } from "@/constants/theme";
import { findCreditsByCode } from "@/data/credits";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { getDisplayName, useBunkStore } from "@/stores/bunk-store";
import type { BunkRecord, CourseAttendance, CourseBunkData } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ChangesModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SectionProps {
  title: string;
  count?: number;
  children: ReactNode;
  defaultExpanded?: boolean;
}

const Section = ({
  title,
  count,
  children,
  defaultExpanded = true,
}: SectionProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.sectionHeader}
      >
        <Text style={[styles.sectionTitle, { color: theme.text }]}
        >
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
};

const formatTime = (time: string): string => {
  const [hours] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}${period}`;
};

const formatSlot = (slot: { dayOfWeek: number; startTime: string; endTime: string }) => {
  const dayLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    slot.dayOfWeek
  ];
  return `${dayLabel} ${formatTime(slot.startTime)} - ${formatTime(
    slot.endTime,
  )}`;
};

type CourseBunkEntry = { courseId: string; bunk: BunkRecord };

const flattenBunks = (courses: CourseBunkData[]): CourseBunkEntry[] => {
  const result: CourseBunkEntry[] = [];
  for (const course of courses) {
    for (const bunk of course.bunks) {
      result.push({ courseId: course.courseId, bunk });
    }
  }
  return result;
};

const extractCourseName = (courseName: string): string => {
  const trimmed = courseName.trim();
  const patterns = [
    /^[\w\d]+\s*[-:]\s*/,
    /^[\w\d]+\s{2,}/,
    /^[\w\d]+\s+/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(trimmed)) {
      return trimmed.replace(pattern, "").trim();
    }
  }
  return trimmed;
};

const extractCourseCode = (courseName: string): string => {
  const trimmed = courseName.trim();
  const patterns = [
    /^([\w\d]+)\s*[-:]\s*/,
    /^([\w\d]+)\s{2,}/,
    /^([\w\d]+)\s+/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  return trimmed;
};

const getDefaultCredits = (course: CourseAttendance): number => {
  const code = extractCourseCode(course.courseName);
  return findCreditsByCode(code) ?? 3;
};

const buildCourseMap = (courses: CourseBunkData[]) => {
  const map = new Map<string, CourseBunkData>();
  courses.forEach((course) => map.set(course.courseId, course));
  return map;
};

export function ChangesModal({ visible, onClose }: ChangesModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { courses: attendanceCourses } = useAttendanceStore();
  const { courses: bunkCourses } = useBunkStore();

  const courseMap = useMemo(() => buildCourseMap(bunkCourses), [bunkCourses]);

  const customCourses = useMemo(
    () => bunkCourses.filter((course) => course.isCustomCourse),
    [bunkCourses],
  );

  const overrideCourses = useMemo(
    () =>
      bunkCourses.filter(
        (course) =>
          !course.isCustomCourse && course.config?.overrideLmsSlots,
      ),
    [bunkCourses],
  );

  const manualSlotCourses = useMemo(
    () =>
      bunkCourses.filter((course) => (course.manualSlots?.length ?? 0) > 0),
    [bunkCourses],
  );

  const manualSlotsCount = useMemo(() => {
    return manualSlotCourses.reduce(
      (sum, course) => sum + course.manualSlots.length,
      0,
    );
  }, [manualSlotCourses]);

  const manualBunks = useMemo(() => {
    return flattenBunks(bunkCourses).filter(
      (entry) => entry.bunk.source === "user",
    );
  }, [bunkCourses]);

  const dutyLeaves = useMemo(() => {
    return flattenBunks(bunkCourses).filter(
      (entry) => entry.bunk.isDutyLeave,
    );
  }, [bunkCourses]);

  const presentMarks = useMemo(() => {
    return flattenBunks(bunkCourses).filter(
      (entry) => entry.bunk.isMarkedPresent,
    );
  }, [bunkCourses]);

  const configChanges = useMemo(() => {
    return attendanceCourses
      .map((course) => {
        const bunkCourse = courseMap.get(course.courseId);
        if (!bunkCourse?.config) return null;
        const defaultAlias = extractCourseName(course.courseName);
        const defaultCredits = getDefaultCredits(course);
        const aliasChanged = bunkCourse.config.alias !== defaultAlias;
        const creditsChanged = bunkCourse.config.credits !== defaultCredits;
        if (!aliasChanged && !creditsChanged) return null;
        return {
          courseId: course.courseId,
          name: getDisplayName(bunkCourse),
          aliasChanged,
          creditsChanged,
          defaultAlias,
          currentAlias: bunkCourse.config.alias,
          defaultCredits,
          currentCredits: bunkCourse.config.credits,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [attendanceCourses, courseMap]);

  const hasChanges =
    customCourses.length > 0 ||
    overrideCourses.length > 0 ||
    manualSlotsCount > 0 ||
    manualBunks.length > 0 ||
    dutyLeaves.length > 0 ||
    presentMarks.length > 0 ||
    configChanges.length > 0;

  const totalCourses = attendanceCourses.length + customCourses.length;

  const renderBunkGroup = (title: string, entries: CourseBunkEntry[]) => {
    if (entries.length === 0) return null;
    const grouped = new Map<string, BunkRecord[]>();
    entries.forEach((entry) => {
      const existing = grouped.get(entry.courseId) ?? [];
      existing.push(entry.bunk);
      grouped.set(entry.courseId, existing);
    });

    return (
      <Section title={title} count={entries.length} defaultExpanded={false}>
        {Array.from(grouped.entries()).map(([courseId, items]) => {
          const course = courseMap.get(courseId);
          return (
            <View key={courseId} style={styles.groupBlock}>
              <Text style={[styles.courseName, { color: theme.text }]}
              >
                {course ? getDisplayName(course) : "Unknown course"}
              </Text>
              {items.map((bunk) => (
                <View
                  key={bunk.id}
                  style={[
                    styles.bunkRow,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <View style={styles.bunkInfo}>
                    <Text style={[styles.bunkDate, { color: theme.text }]}
                    >
                      {bunk.date}
                    </Text>
                    {bunk.timeSlot && (
                      <Text
                        style={[styles.bunkMeta, { color: theme.textSecondary }]}
                      >
                        {bunk.timeSlot}
                      </Text>
                    )}
                    {bunk.note ? (
                      <Text
                        style={[styles.bunkMeta, { color: theme.textSecondary }]}
                      >
                        Note: {bunk.note}
                      </Text>
                    ) : null}
                  </View>
                  {bunk.isDutyLeave && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: Colors.status.info + "20" },
                      ]}
                    >
                      <Text
                        style={[styles.badgeText, { color: Colors.status.info }]}
                      >
                        DL
                      </Text>
                    </View>
                  )}
                  {bunk.isMarkedPresent && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: Colors.status.success + "20" },
                      ]}
                    >
                      <Text
                        style={[styles.badgeText, { color: Colors.status.success }]}
                      >
                        PRESENT
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </Section>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.title, { color: theme.text }]}>Changes</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.text }]}
                >
                  {totalCourses}
                </Text>
                <Text
                  style={[styles.summaryLabel, { color: theme.textSecondary }]}
                >
                  courses
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.text }]}
                >
                  {manualSlotsCount}
                </Text>
                <Text
                  style={[styles.summaryLabel, { color: theme.textSecondary }]}
                >
                  slots edited
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: theme.text }]}
                >
                  {manualBunks.length}
                </Text>
                <Text
                  style={[styles.summaryLabel, { color: theme.textSecondary }]}
                >
                  manual bunks
                </Text>
              </View>
            </View>
          </View>

          {!hasChanges && (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={32}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                No manual changes yet. Your schedule matches LMS data.
              </Text>
            </View>
          )}

          {customCourses.length > 0 && (
            <Section title="Custom Courses" count={customCourses.length}>
              {customCourses.map((course) => (
                <View
                  key={course.courseId}
                  style={[
                    styles.courseRow,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <View style={styles.courseInfo}>
                    <Text style={[styles.courseName, { color: theme.text }]}
                    >
                      {getDisplayName(course)}
                    </Text>
                    <Text
                      style={[styles.courseMeta, { color: theme.textSecondary }]}
                    >
                      {course.manualSlots.length} slot
                      {course.manualSlots.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: Colors.status.success + "20" },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: Colors.status.success }]}
                    >
                      CUSTOM
                    </Text>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {overrideCourses.length > 0 && (
            <Section title="LMS Overrides" count={overrideCourses.length}>
              {overrideCourses.map((course) => (
                <View
                  key={course.courseId}
                  style={[
                    styles.courseRow,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <View style={styles.courseInfo}>
                    <Text style={[styles.courseName, { color: theme.text }]}
                    >
                      {getDisplayName(course)}
                    </Text>
                    <Text
                      style={[styles.courseMeta, { color: theme.textSecondary }]}
                    >
                      Manual schedule enabled
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: Colors.status.info + "20" },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: Colors.status.info }]}
                    >
                      OVERRIDE
                    </Text>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {configChanges.length > 0 && (
            <Section title="Course Settings" count={configChanges.length}>
              {configChanges.map((change) => (
                <View
                  key={change.courseId}
                  style={[
                    styles.courseRow,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <View style={styles.courseInfo}>
                    <Text style={[styles.courseName, { color: theme.text }]}
                    >
                      {change.name}
                    </Text>
                    {change.aliasChanged && (
                      <Text
                        style={[styles.courseMeta, { color: theme.textSecondary }]}
                      >
                        Alias: {change.defaultAlias} {"->"}{" "}
                        {change.currentAlias}
                      </Text>
                    )}
                    {change.creditsChanged && (
                      <Text
                        style={[styles.courseMeta, { color: theme.textSecondary }]}
                      >
                        Credits: {change.defaultCredits} {"->"}{" "}
                        {change.currentCredits}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </Section>
          )}

          {manualSlotCourses.length > 0 && (
            <Section title="Manual Slots" count={manualSlotsCount}>
              {manualSlotCourses.map((course) => (
                <View key={course.courseId} style={styles.groupBlock}>
                  <Text style={[styles.courseName, { color: theme.text }]}
                  >
                    {getDisplayName(course)}
                  </Text>
                  <View style={styles.slotsList}>
                    {course.manualSlots.map((slot) => (
                      <View
                        key={slot.id}
                        style={[
                          styles.slotItem,
                          { backgroundColor: theme.backgroundSecondary },
                        ]}
                      >
                        <Text style={[styles.slotText, { color: theme.text }]}
                        >
                          {formatSlot(slot)}
                        </Text>
                        <Text
                          style={[styles.slotMeta, { color: theme.textSecondary }]}
                        >
                          {slot.sessionType}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </Section>
          )}

          {renderBunkGroup("Manual Bunks", manualBunks)}
          {renderBunkGroup("Duty Leaves", dutyLeaves)}
          {renderBunkGroup("Present Marks", presentMarks)}
        </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerSpacer: {
    width: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  container: {
    paddingBottom: Spacing.xl,
  },
  summaryCard: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: Radius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionBody: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 13,
    fontWeight: "600",
  },
  courseMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  groupBlock: {
    gap: Spacing.sm,
  },
  slotsList: {
    gap: Spacing.sm,
  },
  slotItem: {
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  slotText: {
    fontSize: 12,
    fontWeight: "500",
  },
  slotMeta: {
    fontSize: 10,
    textTransform: "capitalize",
  },
  bunkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  bunkInfo: {
    flex: 1,
    gap: 2,
  },
  bunkDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  bunkMeta: {
    fontSize: 10,
  },
});
