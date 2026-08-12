import { Colors } from "@/constants/theme";
import { findCreditsByCode } from "@/data/credits";
import type {
  BunkRecord,
  BunkState,
  CourseAttendance,
  CourseAttendanceSnapshot,
  CourseBunkData,
  CourseBunkStats,
  CourseConfig,
  DutyLeaveInfo,
} from "@/types";
import {
  getCanonicalRecordDescription,
  getRecordKeyVariants,
  recordsReferToSameSession,
} from "@/utils/attendance-helpers";
import { extractCourseCode, extractCourseName } from "@/utils/course-name";
import { evaluateCoursesAgainstCurrentSemester } from "@/utils/semester-course-filter";

export const generateBunkId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const parseBunkTimeSlot = (date: string): string | null => {
  const match = date.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  return match ? match[1] : null;
};

const parseBunkDate = (value: string): string | null => {
  const match = value.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!match) return null;
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
  const month = months[match[2].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : null;
};

const timeToMinutes = (value: string): number | null => {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hour < 1 || hour > 12 || minutes < 0 || minutes > 59) return null;
  return (
    ((hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + minutes
  );
};

export const filterPastBunks = (bunks: BunkRecord[]): BunkRecord[] =>
  bunks.filter((bunk) => {
    const date = parseBunkDate(bunk.date);
    if (!date) return false;
    const timeSlot = parseBunkTimeSlot(bunk.date);
    const endText = timeSlot?.split("-")[1]?.trim();
    const endMinutes = endText ? timeToMinutes(endText) : null;
    const end = new Date(`${date}T00:00:00`);
    if (endMinutes !== null) {
      end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
    }
    return end <= new Date();
  });

const makePortalBunks = (course: CourseAttendance): BunkRecord[] =>
  course.records
    .filter((record) => record.status === "Absent")
    .map((record) => ({
      id: generateBunkId(),
      date: record.date,
      description: getCanonicalRecordDescription(record),
      timeSlot: parseBunkTimeSlot(record.date),
      note: "",
      source: "attendancePortal",
      isDutyLeave: false,
      dutyLeaveNote: "",
      isMarkedPresent: false,
      presenceNote: "",
    }));

const makeCourseConfig = (
  course: CourseAttendance,
  index: number,
  existing?: CourseBunkData,
): { config: CourseConfig; isConfigured: boolean } => {
  const alias = extractCourseName(course.courseName);
  const courseCode = course.courseCode || extractCourseCode(course.courseName);
  const credits = findCreditsByCode(courseCode);
  return {
    config: existing?.config
      ? {
          ...existing.config,
          alias,
          courseCode,
          overrideLmsSlots: existing.config.overrideLmsSlots ?? false,
        }
      : {
          credits: credits ?? 3,
          alias,
          courseCode,
          color: Colors.courseColors[index % Colors.courseColors.length],
          overrideLmsSlots: false,
        },
    isConfigured: existing?.isConfigured === true || credits !== null,
  };
};

export const buildSyncedBunkState = (
  attendanceCourses: CourseAttendance[],
  state: Pick<
    BunkState,
    "courses" | "hiddenCourses" | "autoDropOptOutBySemester"
  >,
): Pick<BunkState, "courses" | "hiddenCourses" | "lastSyncTime"> => {
  const { semesterWindow, byCourseId } =
    evaluateCoursesAgainstCurrentSemester(attendanceCourses);
  const autoDroppedIds = new Set<string>();
  for (const course of attendanceCourses) {
    const optedOut =
      state.autoDropOptOutBySemester[course.courseId] ===
      semesterWindow.semesterKey;
    if (byCourseId[course.courseId]?.shouldAutoDrop && !optedOut) {
      autoDroppedIds.add(course.courseId);
    }
  }

  const courses = attendanceCourses.map((course, index): CourseBunkData => {
    const existing = state.courses.find(
      (saved) => saved.courseId === course.courseId,
    );
    const portalBunks = makePortalBunks(course);
    const portalKeys = new Set(
      portalBunks.flatMap((bunk) => getRecordKeyVariants(bunk)),
    );
    const userBunks =
      existing?.bunks.filter(
        (bunk) =>
          bunk.source === "user" &&
          !getRecordKeyVariants(bunk).some((key) => portalKeys.has(key)),
      ) ?? [];
    const merged = portalBunks.map((next) => {
      const saved =
        existing?.bunks.find(
          (bunk) =>
            bunk.source !== "user" && recordsReferToSameSession(bunk, next),
        ) ??
        existing?.bunks.find(
          (bunk) =>
            bunk.source === "user" && recordsReferToSameSession(bunk, next),
        );
      return saved
        ? {
            ...next,
            id: saved.id,
            note: saved.note,
            isDutyLeave: saved.isDutyLeave,
            dutyLeaveNote: saved.dutyLeaveNote,
            isMarkedPresent: saved.isMarkedPresent,
            presenceNote: saved.presenceNote,
          }
        : next;
    });
    const config = makeCourseConfig(course, index, existing);
    return {
      courseId: course.courseId,
      courseName: course.courseName,
      ...config,
      bunks: [...merged, ...userBunks],
      isCustomCourse: false,
      manualSlots: existing?.manualSlots ?? [],
    };
  });

  const hiddenCourses = { ...state.hiddenCourses };
  for (const [courseId, hidden] of Object.entries(hiddenCourses)) {
    if (
      hidden.reason === "auto-semester" &&
      (hidden.semesterKey !== semesterWindow.semesterKey ||
        !autoDroppedIds.has(courseId))
    ) {
      delete hiddenCourses[courseId];
    }
  }
  for (const courseId of autoDroppedIds) {
    if (hiddenCourses[courseId]?.reason === "manual") continue;
    const course = attendanceCourses.find((item) => item.courseId === courseId);
    if (!course) continue;
    hiddenCourses[courseId] = {
      courseId,
      courseName: course.courseName,
      reason: "auto-semester",
      hiddenAt: Date.now(),
      semesterKey: semesterWindow.semesterKey,
    };
  }

  return {
    courses: [
      ...courses,
      ...state.courses.filter((course) => course.isCustomCourse),
    ],
    hiddenCourses,
    lastSyncTime: Date.now(),
  };
};

export const buildResetBunkCourses = (
  attendanceCourses: CourseAttendance[],
  savedCourses: CourseBunkData[],
): CourseBunkData[] => [
  ...attendanceCourses.map((course, index): CourseBunkData => {
    const existing = savedCourses.find(
      (item) => item.courseId === course.courseId,
    );
    return {
      courseId: course.courseId,
      courseName: course.courseName,
      ...makeCourseConfig(course, index, existing),
      bunks: makePortalBunks(course),
      isCustomCourse: false,
      manualSlots: existing?.manualSlots ?? [],
    };
  }),
  ...savedCourses.filter((course) => course.isCustomCourse),
];

export const selectAllDutyLeaves = (
  courses: CourseBunkData[],
): DutyLeaveInfo[] =>
  courses.flatMap((course) =>
    filterPastBunks(course.bunks)
      .filter((bunk) => bunk.isDutyLeave)
      .map((bunk) => ({
        courseId: course.courseId,
        courseName: course.config?.alias || course.courseName,
        bunkId: bunk.id,
        date: bunk.date,
        timeSlot: bunk.timeSlot,
        note: bunk.dutyLeaveNote,
      })),
  );

export const selectCourseStats = (
  course: CourseBunkData,
  attendance?: CourseAttendanceSnapshot,
): CourseBunkStats => {
  const past = filterPastBunks(course.bunks);
  const totalBunks = course.config ? 2 * course.config.credits + 1 : 0;
  const dutyLeaveCount = past.filter((bunk) => bunk.isDutyLeave).length;
  const markedPresentCount = past.filter((bunk) => bunk.isMarkedPresent).length;
  const usedBunks = past.filter(
    (bunk) => !bunk.isDutyLeave && !bunk.isMarkedPresent,
  ).length;
  const requiredFor80Now = attendance
    ? Math.ceil(attendance.totalSessions * 0.8)
    : null;
  return {
    totalBunks,
    dutyLeaveCount,
    markedPresentCount,
    usedBunks,
    bunksLeft: totalBunks - usedBunks,
    pastBunksCount: past.length,
    requiredFor80Now,
    bufferTo80Now:
      attendance && requiredFor80Now !== null
        ? attendance.attendedSessions - requiredFor80Now
        : null,
    heuristicBunksLeft: totalBunks - usedBunks,
    heuristicUncertainty: 1,
  };
};

export const getDisplayName = (course: CourseBunkData): string =>
  course.config?.alias || course.courseName;
