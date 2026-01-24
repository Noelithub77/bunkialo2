import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { findCreditsByCode } from "@/data/credits";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAttendanceStore } from "@/stores/attendance-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useGpaStore } from "@/stores/gpa-store";
import type {
  CourseAttendance,
  CourseBunkData,
  GpaCourseItem,
  GradeLetter,
  SemesterGpaEntry,
} from "@/types";
import { extractCourseCode, extractCourseName } from "@/utils/course-name";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button } from "react-native-paper";

const GRADE_OPTIONS: GradeLetter[] = [
  "A",
  "A-",
  "B",
  "B-",
  "C",
  "C-",
  "D",
  "F",
];

const GRADE_POINTS: Record<GradeLetter, number> = {
  A: 10,
  "A-": 9,
  B: 8,
  "B-": 7,
  C: 6,
  "C-": 5,
  D: 4,
  F: 0,
};

const DEFAULT_GRADE: GradeLetter = "A";

const getGradeColor = (grade: GradeLetter): string => {
  if (grade === "A" || grade === "A-") return Colors.status.success;
  if (grade === "B" || grade === "B-") return Colors.status.info;
  if (grade === "C" || grade === "C-") return Colors.status.warning;
  if (grade === "D") return Colors.courseColors[1];
  return Colors.status.danger;
};

const formatGpa = (value: number): string => {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
};

const formatDelta = (value: number): string => {
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const sign = normalized > 0 ? "+" : "";
  return `${sign}${normalized.toFixed(2)}`;
};

const parseNumberInput = (value: string, max?: number): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("-")) return 0;
  const normalized = trimmed.replace(",", ".");
  const cleaned = normalized.replace(/[^0-9.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");
  const sanitized =
    firstDotIndex === -1
      ? cleaned
      : `${cleaned.slice(0, firstDotIndex + 1)}${cleaned
          .slice(firstDotIndex + 1)
          .replace(/\./g, "")}`;
  if (!sanitized) return null;
  const numeric = Number(sanitized);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0) return 0;
  if (max !== undefined) return Math.min(max, numeric);
  return numeric;
};

const buildCourseItems = (
  attendanceCourses: CourseAttendance[],
  bunkCourses: CourseBunkData[],
  courseGrades: Record<string, GradeLetter>,
): GpaCourseItem[] => {
  const bunkById = new Map(
    bunkCourses.map((course) => [course.courseId, course]),
  );

  const attendanceItems = attendanceCourses.map((course) => {
    const bunkCourse = bunkById.get(course.courseId);
    const extractedCode =
      bunkCourse?.config?.courseCode ?? extractCourseCode(course.courseName);
    const extractedName = bunkCourse?.config?.alias
      ? bunkCourse.config.alias
      : extractCourseName(course.courseName);
    const creditsFromStore = bunkCourse?.config?.credits;
    const creditsFromData = findCreditsByCode(extractedCode);
    const credits = creditsFromStore ?? creditsFromData ?? 3;

    return {
      courseId: course.courseId,
      courseName: extractedName || course.courseName,
      courseCode: extractedCode,
      credits,
      grade: courseGrades[course.courseId] ?? DEFAULT_GRADE,
    };
  });

  const attendanceIds = new Set(
    attendanceCourses.map((course) => course.courseId),
  );

  const customItems = bunkCourses
    .filter(
      (course) => course.isCustomCourse && !attendanceIds.has(course.courseId),
    )
    .map((course) => ({
      courseId: course.courseId,
      courseName: course.config?.alias || course.courseName,
      courseCode: course.config?.courseCode || "",
      credits: course.config?.credits ?? 3,
      grade: courseGrades[course.courseId] ?? DEFAULT_GRADE,
    }));

  return [...attendanceItems, ...customItems];
};

const summarizeSemester = (
  courses: GpaCourseItem[],
): { totalCredits: number; totalPoints: number; sgpa: number } => {
  const totalCredits = courses.reduce(
    (sum, course) => sum + (course.credits > 0 ? course.credits : 0),
    0,
  );
  const totalPoints = courses.reduce((sum, course) => {
    if (course.credits <= 0) return sum;
    return sum + course.credits * GRADE_POINTS[course.grade];
  }, 0);
  const sgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

  return { totalCredits, totalPoints, sgpa };
};

const summarizePreviousSemesters = (
  semesters: SemesterGpaEntry[],
): { totalCredits: number; totalPoints: number } => {
  return semesters.reduce(
    (acc, semester) => {
      if (semester.sgpa === null || semester.credits === null) return acc;
      if (semester.credits <= 0) return acc;
      return {
        totalCredits: acc.totalCredits + semester.credits,
        totalPoints: acc.totalPoints + semester.sgpa * semester.credits,
      };
    },
    { totalCredits: 0, totalPoints: 0 },
  );
};

export default function GpaCalculatorScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;

  const attendanceCourses = useAttendanceStore((state) => state.courses);
  const bunkCourses = useBunkStore((state) => state.courses);

  const {
    courseGrades,
    previousSemesters,
    setCourseGrade,
    ensureCourseGrades,
    addSemester,
    updateSemester,
    removeSemester,
  } = useGpaStore();
  const [showPrevSemModal, setShowPrevSemModal] = useState(false);
  const [semesterDrafts, setSemesterDrafts] = useState<
    Record<string, { sgpa: string; credits: string }>
  >({});

  const courses = useMemo(
    () => buildCourseItems(attendanceCourses, bunkCourses, courseGrades),
    [attendanceCourses, bunkCourses, courseGrades],
  );

  const courseIds = useMemo(
    () => courses.map((course) => course.courseId),
    [courses],
  );

  useEffect(() => {
    if (courseIds.length === 0) return;
    ensureCourseGrades(courseIds, DEFAULT_GRADE);
  }, [courseIds, ensureCourseGrades]);

  useEffect(() => {
    if (previousSemesters.length === 0) {
      addSemester({ credits: totalCredits > 0 ? totalCredits : 23 });
    }
  }, [addSemester, previousSemesters.length, totalCredits]);

  useEffect(() => {
    setSemesterDrafts((prev) => {
      const next: Record<string, { sgpa: string; credits: string }> = {
        ...prev,
      };
      const ids = new Set(previousSemesters.map((semester) => semester.id));

      Object.keys(next).forEach((id) => {
        if (!ids.has(id)) {
          delete next[id];
        }
      });

      previousSemesters.forEach((semester) => {
        const existing = next[semester.id];
        const sgpaValue = semester.sgpa !== null ? `${semester.sgpa}` : "";
        const creditsValue =
          semester.credits !== null ? `${semester.credits}` : "";

        if (!existing) {
          next[semester.id] = {
            sgpa: sgpaValue,
            credits: creditsValue,
          };
          return;
        }

        const nextDraft = { ...existing };
        let didChange = false;
        if (!existing.sgpa && sgpaValue) {
          nextDraft.sgpa = sgpaValue;
          didChange = true;
        }
        if (!existing.credits && creditsValue) {
          nextDraft.credits = creditsValue;
          didChange = true;
        }

        if (didChange) {
          next[semester.id] = nextDraft;
        }
      });

      return next;
    });
  }, [previousSemesters]);

  useEffect(() => {
    previousSemesters.forEach((semester) => {
      if (semester.credits === null) {
        updateSemester(semester.id, { credits: 23 });
      }
    });
  }, [previousSemesters, updateSemester]);

  const { totalCredits, totalPoints, sgpa } = useMemo(
    () => summarizeSemester(courses),
    [courses],
  );

  const { totalCredits: prevCredits, totalPoints: prevPoints } = useMemo(
    () => summarizePreviousSemesters(previousSemesters),
    [previousSemesters],
  );

  const totalCreditsAll = totalCredits + prevCredits;
  const cgpa =
    totalCreditsAll > 0 ? (totalPoints + prevPoints) / totalCreditsAll : 0;

  const sgpaAllA = totalCredits > 0 ? GRADE_POINTS.A : 0;
  const cgpaAllA =
    totalCreditsAll > 0
      ? (prevPoints + totalCredits * GRADE_POINTS.A) / totalCreditsAll
      : 0;

  const deltaSgpa = sgpa - sgpaAllA;
  const deltaCgpa = cgpa - cgpaAllA;

  const missingCreditsCount = courses.filter(
    (course) => course.credits <= 0,
  ).length;

  const handleSemesterChange = (
    id: string,
    field: "sgpa" | "credits",
    value: string,
  ) => {
    setSemesterDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { sgpa: "", credits: "" }),
        [field]: value,
      },
    }));

    const parsed =
      field === "sgpa" ? parseNumberInput(value, 10) : parseNumberInput(value);

    if (field === "sgpa") {
      updateSemester(id, { sgpa: parsed });
      return;
    }
    updateSemester(id, { credits: parsed });
  };

  const handleAddSemester = () => {
    addSemester({ credits: totalCredits > 0 ? totalCredits : 23 });
  };

  return (
    <Container>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backIcon,
              { backgroundColor: theme.backgroundSecondary },
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>GPA</Text>
          </View>
          <Pressable
            onPress={() => setShowPrevSemModal(true)}
            style={[
              styles.prevSemIconButton,
              { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Ionicons
              name="albums-outline"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.prevSemIconText, { color: theme.textSecondary }]}>
              Prev
            </Text>
          </Pressable>
        </View>

        <GradientCard style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>
              This Semester
            </Text>
            <View style={styles.summaryMeta}>
              <Ionicons
                name="grid-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text
                style={[styles.summaryMetaText, { color: theme.textSecondary }]}
              >
                Credits {totalCredits}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text
                style={[styles.summaryLabel, { color: theme.textSecondary }]}
              >
                SGPA
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {formatGpa(sgpa)}
              </Text>
              <Text
                style={[
                  styles.summaryDelta,
                  {
                    color:
                      deltaSgpa < 0
                        ? Colors.status.danger
                        : Colors.status.success,
                  },
                ]}
              >
                {deltaSgpa === 0 ? "Perfect" : `${formatDelta(deltaSgpa)} vs A`}
              </Text>
            </View>

            <View
              style={[styles.summaryDivider, { backgroundColor: theme.border }]}
            />

            <View style={styles.summaryItem}>
              <Text
                style={[styles.summaryLabel, { color: theme.textSecondary }]}
              >
                CGPA
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {formatGpa(cgpa)}
              </Text>
              <Text
                style={[
                  styles.summaryDelta,
                  {
                    color:
                      deltaCgpa < 0
                        ? Colors.status.danger
                        : Colors.status.success,
                  },
                ]}
              >
                {deltaCgpa === 0
                  ? "Best case"
                  : `${formatDelta(deltaCgpa)} vs A`}
              </Text>
            </View>
          </View>

          {missingCreditsCount > 0 && (
            <View style={styles.missingCredits}>
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color={Colors.status.warning}
              />
              <Text
                style={[
                  styles.missingCreditsText,
                  { color: theme.textSecondary },
                ]}
              >
                Some courses have missing credits.
              </Text>
            </View>
          )}

          <View style={styles.summaryActions} />
        </GradientCard>

        {/* Courses */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Courses
          </Text>
        </View>

        <ScrollView
          style={styles.courseScroll}
          contentContainerStyle={styles.courseList}
          showsVerticalScrollIndicator={false}
        >
          {courses.length === 0 && (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Ionicons
                name="school-outline"
                size={28}
                color={theme.textSecondary}
              />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No courses yet. Sync attendance to get started.
              </Text>
            </View>
          )}

          {courses.map((course) => {
            const gradeColor = getGradeColor(course.grade);
            const impactPoints =
              (GRADE_POINTS[course.grade] - GRADE_POINTS.A) * course.credits;
            const impactSgpa =
              totalCredits > 0 ? impactPoints / totalCredits : 0;
            const impactCgpa =
              totalCreditsAll > 0 ? impactPoints / totalCreditsAll : 0;
            const showImpact = course.grade !== DEFAULT_GRADE;

            return (
              <View
                key={course.courseId}
                style={[
                  styles.courseCard,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <View style={styles.courseHeader}>
                <View style={styles.courseInfo}>
                  <Text style={[styles.courseName, { color: theme.text }]}>
                    {course.courseName}
                    <Text style={[styles.creditInline, { color: Colors.status.info }]}>
                      {" "}
                      ({course.credits})
                    </Text>
                  </Text>
                </View>
                  <View
                    style={[
                      styles.gradeBadge,
                      {
                        backgroundColor: `${gradeColor}20`,
                        borderColor: gradeColor,
                      },
                    ]}
                  >
                    <Text style={[styles.gradeBadgeText, { color: gradeColor }]}>
                      {course.grade}
                    </Text>
                  </View>
                </View>

                <View style={styles.gradeRow}>
                  {GRADE_OPTIONS.map((grade) => {
                    const isSelected = grade === course.grade;
                    const chipColor = getGradeColor(grade);
                    return (
                    <Pressable
                      key={grade}
                      onPress={() => setCourseGrade(course.courseId, grade)}
                      style={({ pressed }) => [
                        styles.gradeChip,
                          {
                            borderColor: isSelected ? chipColor : theme.border,
                            backgroundColor: isSelected
                              ? `${chipColor}20`
                              : theme.background,
                          },
                          pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.gradeChipText,
                          { color: isSelected ? chipColor : theme.text },
                        ]}
                      >
                        {grade}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

                {showImpact && (
                  <View style={styles.impactRow}>
                    <View style={styles.impactLabel}>
                      <Ionicons
                        name="pulse-outline"
                        size={14}
                        color={theme.textSecondary}
                      />
                      <Text
                        style={[styles.impactText, { color: theme.textSecondary }]}
                      >
                        Impact
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.impactValue,
                        {
                          color:
                            impactSgpa < 0
                              ? Colors.status.danger
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      {formatDelta(impactSgpa)} SGPA • {formatDelta(impactCgpa)}{" "}
                      CGPA
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      <Modal
        visible={showPrevSemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrevSemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowPrevSemModal(false)}
          />
          <View
            style={[styles.modalSheet, { backgroundColor: theme.background }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Previous Semesters
              </Text>
              <Pressable onPress={() => setShowPrevSemModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Text
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Add past SGPA and credits to refine CGPA.
            </Text>

            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {previousSemesters.map((semester, index) => (
                <View
                  key={semester.id}
                  style={[
                    styles.semesterCard,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <View style={styles.semesterHeader}>
                    <Text style={[styles.semesterTitle, { color: theme.text }]}>
                      {semester.label || `Sem ${index + 1}`}
                    </Text>
                    {previousSemesters.length > 1 &&
                      index === previousSemesters.length - 1 && (
                        <Pressable
                          onPress={() => removeSemester(semester.id)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={Colors.status.danger}
                          />
                        </Pressable>
                      )}
                  </View>

                  <View style={styles.semesterFields}>
                    <Input
                      label="SGPA"
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      value={
                        semesterDrafts[semester.id]?.sgpa ??
                        (semester.sgpa !== null ? `${semester.sgpa}` : "")
                      }
                      placeholder="0 - 10"
                      onChangeText={(value) =>
                        handleSemesterChange(semester.id, "sgpa", value)
                      }
                      style={styles.semesterInput}
                    />
                    <Input
                      label="Credits"
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      value={
                        semesterDrafts[semester.id]?.credits ??
                        (semester.credits !== null ? `${semester.credits}` : "")
                      }
                      placeholder="Total credits"
                      onChangeText={(value) =>
                        handleSemesterChange(semester.id, "credits", value)
                      }
                      style={styles.semesterInput}
                    />
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                onPress={handleAddSemester}
                style={({ pressed }) => [
                  styles.modalPrimaryButton,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color={Colors.white}
                />
                <Text style={styles.modalPrimaryText}>Add semester</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  backIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryCard: {
    minHeight: 160,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  summaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  summaryItem: {
    flex: 1,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  summaryDelta: {
    fontSize: 12,
    fontWeight: "600",
  },
  summaryDivider: {
    width: 1,
    height: 56,
    backgroundColor: Colors.gray[700],
    opacity: 0.3,
  },
  summaryActions: {
    marginTop: Spacing.sm,
  },
  missingCredits: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  missingCreditsText: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyState: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  courseCard: {
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    gap: Spacing.xs,
  },
  courseList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  courseScroll: {
    flex: 1,
  },
  courseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  courseInfo: {
    flex: 1,
    gap: 4,
  },
  courseName: {
    fontSize: 16,
    fontWeight: "600",
  },
  creditInline: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  gradeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  gradeChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  gradeChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  impactLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  impactText: {
    fontSize: 12,
  },
  impactValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  prevSemIconButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    justifyContent: "center",
  },
  prevSemIconText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: Spacing.md,
  },
  modalContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  modalActions: {
    paddingTop: Spacing.sm,
  },
  modalPrimaryButton: {
    width: "100%",
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.gray[800],
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  modalPrimaryText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  semesterCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.md,
  },
  semesterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  semesterTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  semesterFields: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  semesterInput: {
    flex: 1,
  },
});
