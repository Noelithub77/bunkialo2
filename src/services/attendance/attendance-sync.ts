import { fetchCourses } from "@/services/lms-courses";
import { useCourseLinkStore } from "@/stores/course-link-store";
import type {
  AttendanceRecord,
  AttendanceStatus,
  CourseAttendance,
  PortalAttendanceStatus,
  PortalCourseSessions,
} from "@/types";
import { format, parseISO } from "date-fns";
import {
  getPortalAttendance,
  getPortalCourseSessions,
  getPortalTerms,
} from "./attendance-api";
import {
  portalAttendanceSchema,
  portalCourseSessionsSchema,
  portalTermsSchema,
} from "./attendance-schemas";
import { matchCourses } from "./course-matcher";

const statusLabels: Record<PortalAttendanceStatus, AttendanceStatus> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
  DUTY_LEAVE: "Duty Leave",
};

const displayTime = (value: string): string => {
  const [hoursText, minutesText = "0"] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const hour = hours % 12 || 12;
  const minute = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : "";
  return `${hour}${minute}${hours >= 12 ? "PM" : "AM"}`;
};

const toRecord = (
  termId: string,
  session: PortalCourseSessions["sessions"][number],
): AttendanceRecord => {
  const status = statusLabels[session.status];
  const dateLabel = format(parseISO(session.date), "EEE d MMM yyyy");
  return {
    sessionId: session.sessionId,
    termId,
    date: `${dateLabel} ${displayTime(session.startTime)} - ${displayTime(session.endTime)}`,
    exactDate: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    section: session.section,
    topic: session.topic,
    // Keep the portal section for matching, but do not expose room codes such
    // as "DS-B4" as if they were the session name.
    description: session.topic ?? "Class",
    status,
    sourceStatus: session.status,
    points: status === "Absent" ? "0 / 1" : "1 / 1",
  };
};

const mergeRecords = (
  previous: AttendanceRecord[],
  next: AttendanceRecord[],
): AttendanceRecord[] => {
  const byId = new Map(previous.map((record) => [record.sessionId, record]));
  next.forEach((record) => byId.set(record.sessionId, record));
  return [...byId.values()].sort((a, b) =>
    `${b.exactDate}${b.startTime}`.localeCompare(
      `${a.exactDate}${a.startTime}`,
    ),
  );
};

export interface AttendanceSyncResult {
  summaries: CourseAttendance[];
  complete: CourseAttendance[];
}

export interface AttendanceSyncPayload {
  attendance: unknown;
  sessions: Record<string, unknown>;
  terms: unknown;
  lmsCourses: import("@/types").Course[];
}

export const syncAttendanceFromPayload = (
  previousCourses: CourseAttendance[],
  payload: AttendanceSyncPayload,
  onSummaries?: (courses: CourseAttendance[]) => void,
): AttendanceSyncResult => {
  const attendance = portalAttendanceSchema.parse(payload.attendance);
  const terms = payload.terms === null
    ? []
    : portalTermsSchema.parse(payload.terms);
  const currentTerm =
    terms.find((term) => term.isCurrent) ?? terms.at(0) ?? null;
  const portalCourses = attendance.courses.map((course) => ({
    ...course,
    termId:
      course.termId === "current" && currentTerm
        ? currentTerm.id
        : course.termId,
  }));
  const linkState = useCourseLinkStore.getState();
  const identities = matchCourses(portalCourses, payload.lmsCourses);
  linkState.setIdentities(identities);

  const summaries = portalCourses.map((course): CourseAttendance => {
    const identity = identities.find(
      (item) => item.attendanceCourseId === course.courseId,
    );
    const key = identity?.key ?? `${course.termId}:${course.code}`;
    const previous = previousCourses.find((item) => item.courseId === key);
    return {
      courseId: key,
      courseCode: course.code,
      courseName: course.name,
      termId: course.termId,
      attendanceCourseId: course.courseId,
      lmsCourseId: identity?.lmsCourseId ?? null,
      mappingSource: identity?.mappingSource ?? "unresolved",
      attendanceModuleId: null,
      totalSessions: course.total,
      attended: course.present + course.dlCredited,
      present: course.present,
      dlCredited: course.dlCredited,
      dlOverflow: course.dlOverflow,
      percentage: course.percentage,
      records: previous?.records ?? [],
      lastUpdated: Date.now(),
    };
  });

  const currentTermIds = new Set(summaries.map((course) => course.termId));
  const retained = previousCourses.filter(
    (course) => !currentTermIds.has(course.termId),
  );
  onSummaries?.([...retained, ...summaries]);

  const details = summaries.map((summary) => {
    const rawDetail = payload.sessions[summary.attendanceCourseId];
    if (rawDetail === undefined) return summary;
    try {
      const detail = portalCourseSessionsSchema.parse(rawDetail);
      const records = detail.sessions.map((session) =>
        toRecord(summary.termId, session),
      );
      return {
        ...summary,
        records: mergeRecords(summary.records, records),
      };
    } catch {
      return summary;
    }
  });

  return { summaries, complete: [...retained, ...details] };
};

export const syncAttendance = async (
  previousCourses: CourseAttendance[],
  onSummaries?: (courses: CourseAttendance[]) => void,
): Promise<AttendanceSyncResult> => {
  const [attendance, terms, lmsResult] = await Promise.all([
    getPortalAttendance(),
    getPortalTerms().catch(() => []),
    fetchCourses().then(
      (courses) => ({ status: "fulfilled" as const, courses }),
      () => ({ status: "rejected" as const }),
    ),
  ]);
  const sessions: Record<string, unknown> = {};
  await Promise.all(
    attendance.courses.map(async (course) => {
      try {
        sessions[course.courseId] = await getPortalCourseSessions(course.courseId);
      } catch {
        // Keep the summary when an individual course detail is unavailable.
      }
    }),
  );
  return syncAttendanceFromPayload(previousCourses, {
    attendance,
    lmsCourses: lmsResult.status === "fulfilled" ? lmsResult.courses : [],
    sessions,
    terms,
  }, onSummaries);
};
