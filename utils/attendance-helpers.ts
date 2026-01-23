import type { AttendanceRecord } from "@/types";

export const formatSyncTime = (timestamp: number | null): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
};

export const parseTimeSlot = (dateStr: string): string | null => {
  const timeMatch = dateStr.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  return timeMatch ? timeMatch[1] : null;
};

export const parseRecordDate = (dateStr: string): Date | null => {
  const dateMatch = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!dateMatch) return null;
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
  if (!month) return null;
  return new Date(`${year}-${month}-${day.padStart(2, "0")}`);
};

export const buildRecordKey = (date: string, description: string): string =>
  `${date.trim()}-${description.trim()}`;

// compute unknown count from courses and bunk courses
export const computeUnknownCount = (
  courses: { courseId: string; records: AttendanceRecord[] }[],
  bunkCourses: {
    courseId: string;
    bunks: { date: string; description: string }[];
  }[],
): number => {
  if (courses.length === 0) return 0;

  const resolvedKeysByCourse = new Map<string, Set<string>>();
  for (const course of bunkCourses) {
    const keys = new Set<string>();
    for (const bunk of course.bunks) {
      keys.add(buildRecordKey(bunk.date, bunk.description));
    }
    resolvedKeysByCourse.set(course.courseId, keys);
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let count = 0;
  for (const course of courses) {
    const resolvedKeys = resolvedKeysByCourse.get(course.courseId);
    for (const record of course.records) {
      if (record.status !== "Unknown") continue;
      const recordDate = parseRecordDate(record.date);
      if (!recordDate || recordDate > today) continue;
      const recordKey = buildRecordKey(record.date, record.description);
      if (resolvedKeys?.has(recordKey)) continue;
      count += 1;
    }
  }
  return count;
};
