import { Container } from "@/components/ui/container";
import { GradientCard } from "@/components/ui/gradient-card";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

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

  const { totalCredits, totalPoints, sgpa } = useMemo(
    () => summarizeSemester(courses),
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

  const { totalCredits: prevCredits, totalPoints: prevPoints } = useMemo(
    () => summarizePreviousSemesters(previousSemesters),
    [previousSemesters],
  );
  const prevCgpa = prevCredits > 0 ? prevPoints / prevCredits : 0;
  const prevSgpa = useMemo(() => {
    for (let index = previousSemesters.length - 1; index >= 0; index -= 1) {
      const value = previousSemesters[index]?.sgpa;
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }, [previousSemesters]);

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
  const deltaCgpaPrev = cgpa - prevCgpa;
  const deltaSgpaPrev = prevSgpa !== null ? sgpa - prevSgpa : 0;
  const { height: screenHeight } = useWindowDimensions();
  const modalMaxHeight = Math.round(screenHeight * 0.82);
  const cgpaAnim = useRef(new Animated.Value(1)).current;

  const missingCreditsCount = courses.filter(
    (course) => course.credits <= 0,
  ).length;
  const showPrevData = prevSgpa !== null;
  const showPrevSgpaComparison = prevSgpa !== null;
  const showPrevCgpaComparison = prevCredits > 0;
  const prevSgpaDisplay = prevSgpa !== null ? formatGpa(prevSgpa) : "--";
  const prevCgpaDisplay = prevCredits > 0 ? formatGpa(prevCgpa) : "--";

  useEffect(() => {
    cgpaAnim.setValue(0.96);
    Animated.spring(cgpaAnim, {
      toValue: 1,
      tension: 120,
      friction: 16,
      useNativeDriver: true,
    }).start();
  }, [cgpa, prevCgpa, cgpaAnim]);

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

  const handleResetAllGrades = () => {
    courses.forEach((course) => {
      setCourseGrade(course.courseId, DEFAULT_GRADE);
    });
  };

  return (
    <Container>
      <View className="flex-1 gap-4 p-4">
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.backgroundSecondary }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View className="flex-1 gap-[2px]">
            <Text
              className="text-[28px] font-bold"
              style={{ color: theme.text }}
            >
              GPA
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Pressable
              onPress={() => setShowPrevSemModal(true)}
              className="h-8 flex-row items-center justify-center gap-1.5 rounded-full border px-2.5"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
              }}
            >
              <Ionicons
                name="albums-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text
                className="text-[11px] font-semibold tracking-[0.2px]"
                style={{ color: theme.textSecondary }}
              >
                Prev
              </Text>
            </Pressable>
            <Pressable
              onPress={handleResetAllGrades}
              className="h-8 w-8 items-center justify-center rounded-full border"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
              }}
              hitSlop={6}
            >
              <Ionicons
                name="refresh-outline"
                size={14}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <GradientCard style={{ minHeight: 160 }}>
          <View className="mb-4 flex-row items-center justify-between">
            <Text
              className="text-[16px] font-semibold"
              style={{ color: theme.text }}
            >
              This Semester
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Ionicons
                name="grid-outline"
                size={14}
                color={theme.textSecondary}
              />
              <Text
                className="text-[12px] font-medium"
                style={{ color: theme.textSecondary }}
              >
                Credits {totalCredits}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-6">
            <View className="flex-1 gap-1">
              <Text
                className="text-[12px] uppercase tracking-[0.4px]"
                style={{ color: theme.textSecondary }}
              >
                SGPA
              </Text>
              <Text
                className="text-[28px] font-bold"
                style={{ color: theme.text }}
              >
                {formatGpa(sgpa)}
              </Text>
              {showPrevData && (
                <Animated.Text
                  style={[
                    { color: theme.textSecondary },
                    { opacity: cgpaAnim, transform: [{ scale: cgpaAnim }] },
                    { fontSize: 11, fontWeight: "600" },
                  ]}
                >
                  Prev SGPA {prevSgpaDisplay}
                </Animated.Text>
              )}
              <Text
                className="text-[12px] font-semibold"
                style={{
                  color:
                    deltaSgpa < 0
                      ? Colors.status.danger
                      : Colors.status.success,
                }}
              >
                {deltaSgpa === 0 ? "Perfect" : `${formatDelta(deltaSgpa)} vs A`}
              </Text>
              {showPrevSgpaComparison && (
                <View
                  className="self-start rounded-full px-2 py-0.5"
                  style={{ backgroundColor: `${Colors.status.unknown}20` }}
                >
                  <Text
                    className="text-[11px] font-semibold"
                    style={{ color: Colors.status.unknown }}
                  >
                    {`${formatDelta(deltaSgpaPrev)} vs Prev`}
                  </Text>
                </View>
              )}
            </View>

            <View
              className="h-14 w-px opacity-30"
              style={{ backgroundColor: theme.border }}
            />

            <View className="flex-1 gap-1">
              <Text
                className="text-[12px] uppercase tracking-[0.4px]"
                style={{ color: theme.textSecondary }}
              >
                CGPA
              </Text>
              <Animated.Text
                style={[
                  { color: theme.text },
                  { opacity: cgpaAnim, transform: [{ scale: cgpaAnim }] },
                  { fontSize: 28, fontWeight: "700" },
                ]}
              >
                {formatGpa(cgpa)}
              </Animated.Text>
              {showPrevData && (
                <Animated.Text
                  style={[
                    { color: theme.textSecondary },
                    { opacity: cgpaAnim, transform: [{ scale: cgpaAnim }] },
                    { fontSize: 11, fontWeight: "600" },
                  ]}
                >
                  Prev CGPA {prevCgpaDisplay}
                </Animated.Text>
              )}
              <Text
                className="text-[12px] font-semibold"
                style={{
                  color:
                    deltaCgpa < 0
                      ? Colors.status.danger
                      : Colors.status.success,
                }}
              >
                {deltaCgpa === 0
                  ? "Best case"
                  : `${formatDelta(deltaCgpa)} vs A`}
              </Text>
              {showPrevCgpaComparison && (
                <View
                  className="self-start rounded-full px-2 py-0.5"
                  style={{ backgroundColor: `${Colors.status.unknown}20` }}
                >
                  <Text
                    className="text-[11px] font-semibold"
                    style={{ color: Colors.status.unknown }}
                  >
                    {`${formatDelta(deltaCgpaPrev)} vs Prev`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {missingCreditsCount > 0 && (
            <View className="mt-2 flex-row items-center gap-1.5">
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color={Colors.status.warning}
              />
              <Text
                className="text-[12px]"
                style={{ color: theme.textSecondary }}
              >
                Some courses have missing credits.
              </Text>
            </View>
          )}

          <View className="mt-2" />
        </GradientCard>

        <View className="flex-row items-center justify-between gap-2">
          <Text
            className="text-[18px] font-semibold"
            style={{ color: theme.text }}
          >
            Courses
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-2 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {courses.length === 0 && (
            <View
              className="items-center gap-2 rounded-xl p-6"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons
                name="school-outline"
                size={28}
                color={theme.textSecondary}
              />
              <Text
                className="text-center text-[13px]"
                style={{ color: theme.textSecondary }}
              >
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
                className="gap-1.5 rounded-2xl p-2"
                style={{ backgroundColor: theme.backgroundSecondary }}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 gap-1">
                    <Text
                      className="text-[16px] font-semibold"
                      style={{ color: theme.text }}
                    >
                      {course.courseName}
                      <Text
                        className="text-[13px] font-semibold tracking-[0.2px]"
                        style={{ color: Colors.status.info }}
                      >
                        {" "}({course.credits})
                      </Text>
                    </Text>
                  </View>
                  <View
                    className="rounded-full border px-2.5 py-1.5"
                    style={{
                      backgroundColor: `${gradeColor}20`,
                      borderColor: gradeColor,
                    }}
                  >
                    <Text
                      className="text-[12px] font-bold"
                      style={{ color: gradeColor }}
                    >
                      {course.grade}
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between gap-1">
                  {GRADE_OPTIONS.map((grade) => {
                    const isSelected = grade === course.grade;
                    const chipColor = getGradeColor(grade);
                    return (
                      <Pressable
                        key={grade}
                        onPress={() => setCourseGrade(course.courseId, grade)}
                        className="flex-1 items-center rounded-xl border py-1.5"
                        style={({ pressed }) => [
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
                          className="text-[12px] font-semibold"
                          style={{ color: isSelected ? chipColor : theme.text }}
                        >
                          {grade}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {showImpact && (
                  <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons
                        name="pulse-outline"
                        size={14}
                        color={theme.textSecondary}
                      />
                      <Text
                        className="text-[12px]"
                        style={{ color: theme.textSecondary }}
                      >
                        Impact
                      </Text>
                    </View>
                    <Text
                      className="text-[12px] font-semibold"
                      style={{
                        color:
                          impactSgpa < 0
                            ? Colors.status.danger
                            : theme.textSecondary,
                      }}
                    >
                      {formatDelta(impactSgpa)} SGPA | {formatDelta(impactCgpa)} CGPA
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "position"}
          className="flex-1 justify-end bg-black/50"
        >
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowPrevSemModal(false)}
          />
          <View
            className="rounded-t-2xl p-4 pb-8"
            style={{ backgroundColor: theme.background, maxHeight: modalMaxHeight }}
          >
            <View className="mb-1 flex-row items-center justify-between">
              <Text
                className="text-[18px] font-bold"
                style={{ color: theme.text }}
              >
                Previous Semesters
              </Text>
              <Pressable onPress={() => setShowPrevSemModal(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View className="mb-2 flex-row items-center justify-between">
              <Text
                className="text-[12px] font-semibold uppercase tracking-[0.3px]"
                style={{ color: theme.textSecondary }}
              >
                Prev CGPA
              </Text>
              <Animated.Text
                style={[
                  { color: theme.text },
                  { opacity: cgpaAnim, transform: [{ scale: cgpaAnim }] },
                  { fontSize: 18, fontWeight: "700" },
                ]}
              >
                {formatGpa(prevCgpa)}
              </Animated.Text>
            </View>
            <ScrollView
              contentContainerClassName="gap-2 pb-4 px-2"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {previousSemesters.map((semester, index) => (
                <View
                  key={semester.id}
                  className="gap-2 rounded-2xl p-2"
                  style={{ backgroundColor: theme.backgroundSecondary }}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text
                      className="text-[15px] font-semibold"
                      style={{ color: theme.text }}
                    >
                      {semester.label || `Sem ${index + 1}`}
                    </Text>
                    <View className="flex-1 flex-row justify-end gap-2">
                      <Input
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        value={
                          semesterDrafts[semester.id]?.sgpa ??
                          (semester.sgpa !== null ? `${semester.sgpa}` : "")
                        }
                        placeholder="SGPA"
                        onChangeText={(value) =>
                          handleSemesterChange(semester.id, "sgpa", value)
                        }
                        style={{ flex: 1, height: 44 }}
                      />
                      <Input
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        value={
                          semesterDrafts[semester.id]?.credits ??
                          (semester.credits !== null
                            ? `${semester.credits}`
                            : "")
                        }
                        placeholder="Total credits"
                        onChangeText={(value) =>
                          handleSemesterChange(semester.id, "credits", value)
                        }
                        style={{ flex: 1, height: 44 }}
                      />
                    </View>
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
                </View>
              ))}
            </ScrollView>
            <Text
              className="text-center text-[10px] font-medium opacity-55"
              style={{ color: theme.textSecondary }}
            >
              Tip: If you&apos;re unsure, set total credits as 23{"\n"}(roughly
              the average across semesters).
            </Text>

            <View className="flex-row gap-2 pt-2">
              <Pressable
                onPress={handleAddSemester}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border"
                style={({ pressed }) => [
                  { borderColor: theme.border },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Ionicons name="add-circle-outline" size={18} color={theme.text} />
                <Text
                  className="text-[15px] font-bold tracking-[0.3px]"
                  style={{ color: theme.text }}
                >
                  Add semester
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowPrevSemModal(false)}
                className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl"
                style={({ pressed }) => [
                  { backgroundColor: Colors.gray[800] },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text className="text-[15px] font-bold tracking-[0.3px]" style={{ color: Colors.white }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
}
