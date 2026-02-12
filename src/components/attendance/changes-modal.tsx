import { Colors } from "@/constants/theme";
import { findCreditsByCode } from "@/data/credits";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { getDisplayName, useBunkStore } from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";
import type {
  BunkRecord,
  CourseAttendance,
  CourseBunkData,
  HiddenCourseMeta,
} from "@/types";
import { getCurrentSemesterWindow } from "@/utils/semester-course-filter";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
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
    <View className="mb-4">
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className="flex-row items-center justify-between"
      >
        <Text className="text-[14px] font-semibold" style={{ color: theme.text }}>
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
      {expanded && <View className="mt-2 gap-2">{children}</View>}
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
  const { courses: bunkCourses, hiddenCourses, restoreCourse } = useBunkStore();
  const { generateTimetable } = useTimetableStore();

  const courseMap = useMemo(() => buildCourseMap(bunkCourses), [bunkCourses]);

  const customCourses = useMemo(
    () => bunkCourses.filter((course) => course.isCustomCourse),
    [bunkCourses],
  );
  const hiddenCourseList = useMemo(
    () =>
      Object.values(hiddenCourses).sort(
        (a, b) => b.hiddenAt - a.hiddenAt,
      ),
    [hiddenCourses],
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
    hiddenCourseList.length > 0 ||
    customCourses.length > 0 ||
    overrideCourses.length > 0 ||
    manualSlotsCount > 0 ||
    manualBunks.length > 0 ||
    dutyLeaves.length > 0 ||
    presentMarks.length > 0 ||
    configChanges.length > 0;

  const totalCourses = attendanceCourses.length + customCourses.length;

  const handleRestoreCourse = (hiddenCourse: HiddenCourseMeta) => {
    const keepVisibleForSemesterKey =
      hiddenCourse.reason === "auto-semester"
        ? hiddenCourse.semesterKey ?? getCurrentSemesterWindow().semesterKey
        : undefined;
    restoreCourse(hiddenCourse.courseId, { keepVisibleForSemesterKey });
    generateTimetable();
  };

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
            <View key={courseId} className="gap-2">
              <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                {course ? getDisplayName(course) : "Unknown course"}
              </Text>
              {items.map((bunk) => (
                <View
                  key={bunk.id}
                  className="flex-row items-center justify-between rounded-[8px] p-2"
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="text-[12px] font-medium" style={{ color: theme.text }}>
                      {bunk.date}
                    </Text>
                    {bunk.timeSlot && (
                      <Text
                        className="text-[10px]"
                        style={{ color: theme.textSecondary }}
                      >
                        {bunk.timeSlot}
                      </Text>
                    )}
                    {bunk.note ? (
                      <Text
                        className="text-[10px]"
                        style={{ color: theme.textSecondary }}
                      >
                        Note: {bunk.note}
                      </Text>
                    ) : null}
                  </View>
                  {bunk.isDutyLeave && (
                    <View
                      className="rounded-[8px] px-2 py-0.5"
                      style={{ backgroundColor: Colors.status.info + "20" }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: Colors.status.info }}
                      >
                        DL
                      </Text>
                    </View>
                  )}
                  {bunk.isMarkedPresent && (
                    <View
                      className="rounded-[8px] px-2 py-0.5"
                      style={{ backgroundColor: Colors.status.success + "20" }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{ color: Colors.status.success }}
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
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background }}>
        <View className="flex-1 px-6">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.textSecondary} />
          </Pressable>
          <Text className="text-[18px] font-semibold" style={{ color: theme.text }}>
            Changes
          </Text>
          <View className="w-6" />
        </View>

        <ScrollView
          contentContainerClassName="pb-8"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="mb-6 rounded-[12px] p-4"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <View className="flex-row justify-between">
              <View className="flex-1 items-center">
                <Text className="text-[18px] font-bold" style={{ color: theme.text }}>
                  {totalCourses}
                </Text>
                <Text
                  className="mt-0.5 text-[11px]"
                  style={{ color: theme.textSecondary }}
                >
                  courses
                </Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[18px] font-bold" style={{ color: theme.text }}>
                  {manualSlotsCount}
                </Text>
                <Text
                  className="mt-0.5 text-[11px]"
                  style={{ color: theme.textSecondary }}
                >
                  slots edited
                </Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[18px] font-bold" style={{ color: theme.text }}>
                  {manualBunks.length}
                </Text>
                <Text
                  className="mt-0.5 text-[11px]"
                  style={{ color: theme.textSecondary }}
                >
                  manual bunks
                </Text>
              </View>
            </View>
          </View>

          {!hasChanges && (
            <View
              className="mb-6 items-center gap-2 rounded-[12px] p-6"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons
                name="sparkles-outline"
                size={32}
                color={theme.textSecondary}
              />
              <Text className="text-center text-[12px]" style={{ color: theme.textSecondary }}>
                No manual changes yet. Your schedule matches LMS data.
              </Text>
            </View>
          )}

          {customCourses.length > 0 && (
            <Section title="Custom Courses" count={customCourses.length}>
              {customCourses.map((course) => (
                <View
                  key={course.courseId}
                  className="flex-row items-center justify-between rounded-[8px] p-2"
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                      {getDisplayName(course)}
                    </Text>
                    <Text
                      className="mt-0.5 text-[11px]"
                      style={{ color: theme.textSecondary }}
                    >
                      {course.manualSlots.length} slot
                      {course.manualSlots.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <View
                    className="rounded-[8px] px-2 py-0.5"
                    style={{ backgroundColor: Colors.status.success + "20" }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: Colors.status.success }}
                    >
                      CUSTOM
                    </Text>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {hiddenCourseList.length > 0 && (
            <Section title="Hidden Courses" count={hiddenCourseList.length}>
              {hiddenCourseList.map((hiddenCourse) => (
                <View
                  key={hiddenCourse.courseId}
                  className="flex-row items-center justify-between rounded-[8px] p-2"
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <View className="mr-2 flex-1">
                    <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                      {hiddenCourse.courseName}
                    </Text>
                    <Text
                      className="mt-0.5 text-[11px]"
                      style={{ color: theme.textSecondary }}
                    >
                      Hidden from app views
                    </Text>
                  </View>
                  <View className="mr-2 rounded-[8px] px-2 py-0.5" style={{
                    backgroundColor:
                      hiddenCourse.reason === "manual"
                        ? Colors.status.warning + "20"
                        : Colors.status.info + "20",
                  }}>
                    <Text
                      className="text-[10px] font-bold"
                      style={{
                        color:
                          hiddenCourse.reason === "manual"
                            ? Colors.status.warning
                            : Colors.status.info,
                      }}
                    >
                      {hiddenCourse.reason === "manual" ? "MANUAL" : "AUTO"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRestoreCourse(hiddenCourse)}
                    className="rounded-[8px] px-2 py-1"
                    style={{ backgroundColor: Colors.status.success + "20" }}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: Colors.status.success }}
                    >
                      Restore
                    </Text>
                  </Pressable>
                </View>
              ))}
            </Section>
          )}

          {overrideCourses.length > 0 && (
            <Section title="LMS Overrides" count={overrideCourses.length}>
              {overrideCourses.map((course) => (
                <View
                  key={course.courseId}
                  className="flex-row items-center justify-between rounded-[8px] p-2"
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                      {getDisplayName(course)}
                    </Text>
                    <Text
                      className="mt-0.5 text-[11px]"
                      style={{ color: theme.textSecondary }}
                    >
                      Manual schedule enabled
                    </Text>
                  </View>
                  <View
                    className="rounded-[8px] px-2 py-0.5"
                    style={{ backgroundColor: Colors.status.info + "20" }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: Colors.status.info }}
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
                  className="flex-row items-center justify-between rounded-[8px] p-2"
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                      {change.name}
                    </Text>
                    {change.aliasChanged && (
                      <Text
                        className="mt-0.5 text-[11px]"
                        style={{ color: theme.textSecondary }}
                      >
                        Alias: {change.defaultAlias} {"->"}{" "}
                        {change.currentAlias}
                      </Text>
                    )}
                    {change.creditsChanged && (
                      <Text
                        className="mt-0.5 text-[11px]"
                        style={{ color: theme.textSecondary }}
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
                <View key={course.courseId} className="gap-2">
                  <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                    {getDisplayName(course)}
                  </Text>
                  <View className="gap-2">
                    {course.manualSlots.map((slot) => (
                      <View
                        key={slot.id}
                        className="rounded-[8px] p-2"
                        style={{ backgroundColor: theme.backgroundSecondary }}
                      >
                        <Text className="text-[12px] font-medium" style={{ color: theme.text }}>
                          {formatSlot(slot)}
                        </Text>
                        <Text
                          className="text-[10px] capitalize"
                          style={{ color: theme.textSecondary }}
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
