import type {
  CourseAttendance,
  PortalNotification,
  PortalNotificationPresentation,
} from "../types";
import { extractCourseName } from "./course-name";

const dateLabel = (date: string): string => {
  const parsed = new Date(`${date}T12:00:00+05:30`);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(parsed)
    : "";
};

export const presentPortalNotification = (
  item: PortalNotification,
  courses: Pick<CourseAttendance, "courseCode" | "courseName">[] = [],
): PortalNotificationPresentation => {
  const attendance =
    /ATTENDANCE_(ABSENT|PRESENT|LATE|EXCUSED|CORRECTED|SHORTAGE)/i.exec(
      item.kind,
    );
  if (!attendance)
    return {
      title: item.title.trim(),
      body: /STUDENT_LEAVE_/i.test(item.kind) || item.body.trim() === item.title.trim() ? "" : item.body.trim(),
    };
  const subjectInBody = /attendance in (.+?) is \d/i.exec(item.body)?.[1] ??
    /(?:marked (?:absent|present|late|excused) in|attendance (?:in|for))\s+(.+?)(?:\s+on\s+\d{4}-\d{2}-\d{2}|[.!]?$)/i.exec(
      item.body,
    )?.[1];
  const code = /\b([A-Z]{2,}\s*\d{2,})\b/i
    .exec(item.title)?.[1]
    ?.replace(/\s/g, "")
    .toUpperCase();
  const matched = courses.find(
    (course) => course.courseCode.replace(/\s/g, "").toUpperCase() === code,
  );
  const subject = extractCourseName(subjectInBody ?? matched?.courseName ?? "");
  const labels: Record<string, string> = {
    ABSENT: "Marked absent",
    PRESENT: "Marked present",
    LATE: "Marked late",
    EXCUSED: "Marked excused",
    CORRECTED: "Attendance corrected",
    SHORTAGE: "Low attendance",
  };
  const label = labels[attendance[1].toUpperCase()];
  const date = /\b\d{4}-\d{2}-\d{2}\b/.exec(item.body)?.[0];
  const percentage = /\b\d+(?:\.\d+)?\s*%/.exec(item.body)?.[0];
  return {
    title: subject ? `${label}: ${subject}` : label,
    body: date ? dateLabel(date) : (percentage ?? ""),
  };
};

export const notificationAppearance = (kind: string) => {
  if (/ABSENT|REJECT|CANCEL|CRITICAL/i.test(kind))
    return { icon: "account-remove-outline", color: "#E58E97" } as const;
  if (/SHORTAGE|LOW/i.test(kind))
    return { icon: "chart-line-variant", color: "#D7AB67" } as const;
  if (/LEAVE.*ADVISOR|PENDING|FORWARD/i.test(kind))
    return { icon: "file-clock-outline", color: "#9DAFE2" } as const;
  if (/LEAVE.*APPROVED/i.test(kind))
    return { icon: "file-check-outline", color: "#8CC9AC" } as const;
  if (/PRESENT|EXCUSED|CORRECT/i.test(kind))
    return { icon: "account-check-outline", color: "#8CC9AC" } as const;
  if (/CALENDAR|REMINDER|DEADLINE/i.test(kind))
    return { icon: "calendar-clock", color: "#B5A1DB" } as const;
  if (/APP/i.test(kind)) return { icon: "creation", color: "#DCA4C3" } as const;
  return { icon: "bell-outline", color: "#9DAFE2" } as const;
};

export const notificationIdentifier = (value: string): string => {
  let hash = 2166136261;
  for (const character of value)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `bunkialo-${(hash >>> 0).toString(16)}`;
};

// UUID-shaped stable IDs also work with older deployed web reminder APIs.
export const webNotificationIdentifier = (value: string): string => {
  const hex = [0, 1, 2, 3].map((seed) => notificationIdentifier(`${seed}:${value}`).slice(9).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
};
