import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { getDisplayName, useBunkStore } from "@/stores/bunk-store";
import type { BunkRecord, CourseBunkData, ManualSlotInput } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface ChangesModalProps {
  visible: boolean;
  onClose: () => void;
}

const DAYS: { label: string; value: number }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const formatTime = (time: string): string => {
  const [hours] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}${period}`;
};

const formatSlotDisplay = (slot: ManualSlotInput): string => {
  const dayLabel = DAYS.find((d) => d.value === slot.dayOfWeek)?.label || "";
  return `${dayLabel} ${formatTime(slot.startTime)} - ${formatTime(
    slot.endTime,
  )}`;
};

const flattenBunks = (courses: CourseBunkData[]): BunkRecord[] => {
  const result: BunkRecord[] = [];
  for (const course of courses) {
    result.push(...course.bunks);
  }
  return result;
};

export function ChangesModal({ visible, onClose }: ChangesModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { courses: attendanceCourses } = useAttendanceStore();
  const { courses: bunkCourses } = useBunkStore();

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
      bunkCourses.filter(
        (course) => (course.manualSlots?.length ?? 0) > 0,
      ),
    [bunkCourses],
  );

  const manualSlotsCount = useMemo(() => {
    return manualSlotCourses.reduce(
      (sum, course) => sum + course.manualSlots.length,
      0,
    );
  }, [manualSlotCourses]);

  const manualBunks = useMemo(() => {
    return flattenBunks(bunkCourses).filter((bunk) => bunk.source === "user");
  }, [bunkCourses]);

  const dutyLeaveBunks = useMemo(() => {
    return flattenBunks(bunkCourses).filter((bunk) => bunk.isDutyLeave);
  }, [bunkCourses]);

  const presentCorrections = useMemo(() => {
    return flattenBunks(bunkCourses).filter((bunk) => bunk.isMarkedPresent);
  }, [bunkCourses]);

  const hasChanges =
    customCourses.length > 0 ||
    overrideCourses.length > 0 ||
    manualSlotCourses.length > 0 ||
    manualBunks.length > 0 ||
    dutyLeaveBunks.length > 0 ||
    presentCorrections.length > 0;

  const totalCourses = attendanceCourses.length + customCourses.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons
                name="list-outline"
                size={20}
                color={theme.textSecondary}
              />
              <Text style={[styles.title, { color: theme.text }]}>Changes</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
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
                  slot edits
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

            {!hasChanges && (
              <View style={styles.emptyState}>
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
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}
                >
                  Custom Courses
                </Text>
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
              </View>
            )}

            {overrideCourses.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}
                >
                  LMS Overrides
                </Text>
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
              </View>
            )}

            {manualSlotCourses.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}
                >
                  Manual Slots
                </Text>
                {manualSlotCourses.map((course) => (
                  <View key={course.courseId} style={styles.slotGroup}>
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
                          <Text
                            style={[styles.slotText, { color: theme.text }]}
                          >
                            {formatSlotDisplay(slot)}
                          </Text>
                          <Text
                            style={[
                              styles.slotType,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {slot.sessionType}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {(manualBunks.length > 0 ||
              dutyLeaveBunks.length > 0 ||
              presentCorrections.length > 0) && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}
                >
                  Attendance Adjustments
                </Text>
                <View style={styles.adjustmentRow}>
                  <View style={styles.adjustmentItem}>
                    <Text style={[styles.adjustmentValue, { color: theme.text }]}
                    >
                      {manualBunks.length}
                    </Text>
                    <Text
                      style={[
                        styles.adjustmentLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      manual bunks
                    </Text>
                  </View>
                  <View style={styles.adjustmentItem}>
                    <Text style={[styles.adjustmentValue, { color: theme.text }]}
                    >
                      {dutyLeaveBunks.length}
                    </Text>
                    <Text
                      style={[
                        styles.adjustmentLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      duty leaves
                    </Text>
                  </View>
                  <View style={styles.adjustmentItem}>
                    <Text style={[styles.adjustmentValue, { color: theme.text }]}
                    >
                      {presentCorrections.length}
                    </Text>
                    <Text
                      style={[
                        styles.adjustmentLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      present marks
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              title="Close"
              variant="secondary"
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modal: {
    width: "92%",
    maxWidth: 440,
    maxHeight: "90%",
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
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
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 13,
    fontWeight: "500",
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
  slotGroup: {
    marginBottom: Spacing.md,
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
  slotType: {
    fontSize: 10,
    textTransform: "capitalize",
  },
  adjustmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  adjustmentItem: {
    flex: 1,
    alignItems: "center",
  },
  adjustmentValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  adjustmentLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    marginTop: Spacing.md,
  },
});
