/**
 * Test script - fetches only IN PROGRESS courses
 * Run with: bun tests/integration/lms/test-scraper.ts
 * Required env: LMS_TEST_USERNAME, LMS_TEST_PASSWORD
 */

import * as cheerio from "cheerio";
import { createLmsSession, loadEnvFromRoot } from "../../helpers/lms-session";

loadEnvFromRoot();
const session = createLmsSession();
const BASE_URL = session.baseUrl;

interface MoodleCourse {
  id: string;
  name: string;
}

interface AttendanceRecord {
  date: string;
  status: string;
  points: string;
}

interface AttendanceResult {
  records: AttendanceRecord[];
  present: number;
  total: number;
}

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  typeof value === "object" && value !== null ? (value as JsonRecord) : {};

async function getInProgressCourses(): Promise<MoodleCourse[]> {
  console.log("\n[2] GET IN-PROGRESS COURSES (via API)");

  const sessionReady = await session.ensureSession();
  if (!sessionReady) {
    console.log("  ERROR: Could not establish LMS session");
    return [];
  }

  const sesskey = await session.getSesskey();
  if (!sesskey) {
    console.log("  ERROR: No sesskey found");
    return [];
  }

  const payload = [
    {
      index: 0,
      methodname: "core_course_get_enrolled_courses_by_timeline_classification",
      args: {
        offset: 0,
        limit: 0,
        classification: "inprogress",
        sort: "fullname",
      },
    },
  ];

  const res = await session.fetchWithSession(
    `${BASE_URL}/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_enrolled_courses_by_timeline_classification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const rawData: unknown = await res.json();
  const data = Array.isArray(rawData) ? rawData.map(asRecord) : [];

  if (data[0]?.error) {
    const exception = asRecord(data[0].exception);
    console.log(`  API Error: ${String(exception.message || "Unknown")}`);
    return [];
  }

  const firstData = asRecord(data[0]?.data);
  const courses = Array.isArray(firstData.courses)
    ? firstData.courses.map(asRecord)
    : [];
  console.log(`\n  IN-PROGRESS COURSES: ${courses.length}`);

  return courses.map((c) => ({
    id: String(c.id),
    name: String(c.fullname || c.shortname || "Unnamed course"),
  }));
}

async function getAttendance(courseId: string, courseName: string): Promise<AttendanceResult | null> {
  console.log(`\n[3] ATTENDANCE: ${courseName.substring(0, 35)}`);

  const courseRes = await session.fetchWithSession(
    `${BASE_URL}/course/view.php?id=${courseId}`,
  );
  const courseHtml = await courseRes.text();
  const $ = cheerio.load(courseHtml);

  let attId: string | null = null;
  $('a[href*="/mod/attendance/view.php"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/id=(\d+)/);
    if (match) attId = match[1];
  });

  if (!attId) {
    console.log("  No attendance module");
    return null;
  }

  const attRes = await session.fetchWithSession(
    `${BASE_URL}/mod/attendance/view.php?id=${attId}&view=5`,
  );
  const attHtml = await attRes.text();
  const $att = cheerio.load(attHtml);

  const records: AttendanceRecord[] = [];

  $att("table").each((_, table) => {
    const text = $att(table).text().toLowerCase();
    if (!text.includes("date") || (!text.includes("present") && !text.includes("points"))) {
      return;
    }

    $att(table)
      .find("tr")
      .each((_, row) => {
        const cells = $att(row).find("td");
        if (cells.length < 3) return;

        const date = $att(cells[0]).text().trim();
        const status = $att(cells[2]).text().trim();
        const points = cells.length > 3 ? $att(cells[3]).text().trim() : "";

        if (date.match(/\d/)) {
          records.push({ date, status, points });
        }
      });
  });

  const present = records.filter(
    (r) => r.status.toLowerCase().includes("present") || r.points.includes("1 /"),
  ).length;

  console.log(`  Records: ${records.length}`);
  console.log(
    `  Present: ${present}/${records.length} = ${records.length > 0 ? Math.round((present / records.length) * 100) : 0}%`,
  );

  return { records, present, total: records.length };
}

async function main() {
  console.log("======================================");
  console.log("  LMS SCRAPER - IN PROGRESS ONLY");
  console.log("======================================");

  try {
    console.log("\n[1] LOGIN");
    const loginOk = await session.login();
    const cookieCount = await session.getCookieCount();
    console.log(`  Result: ${loginOk ? "SUCCESS" : "FAILED"} (cookies=${cookieCount})`);
    if (!loginOk) {
      process.exit(1);
    }

    const courses = await getInProgressCourses();

    if (courses.length === 0) {
      console.log("\n  No in-progress courses found");
      process.exit(0);
    }

    for (const course of courses.slice(0, 3)) {
      await getAttendance(course.id, course.name);
    }

    console.log("\n======================================");
    console.log("  DONE");
    console.log("======================================");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n[ERROR]", message);
    process.exit(1);
  }
}

main();
