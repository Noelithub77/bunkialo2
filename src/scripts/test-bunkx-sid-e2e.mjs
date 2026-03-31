/**
 * End-to-end Bunkx sid handoff test.
 *
 * Flow:
 * 1) Login to LMS
 * 2) Fetch in-progress courses
 * 3) Scrape attendance records
 * 4) Build Bunkx payload
 * 5) POST /api/bunkx/session
 * 6) Open /bunkialo?sid=...
 * 7) Check consume endpoint behavior
 *
 * Run:
 * LMS_TEST_USERNAME=... LMS_TEST_PASSWORD=... node src/scripts/test-bunkx-sid-e2e.mjs
 */

import { createLmsSession, loadEnvFromRoot } from "./utils/lms-session.mjs";

const cheerio = await import("cheerio");

loadEnvFromRoot();

const BUNKX_BASE_URL =
  process.env.BUNKX_BASE_URL || "https://bunkx-iiitk.vercel.app";

const username = process.env.LMS_TEST_USERNAME;
const password = process.env.LMS_TEST_PASSWORD;

if (!username || !password) {
  console.error("Missing LMS_TEST_USERNAME/LMS_TEST_PASSWORD");
  process.exit(1);
}

const session = createLmsSession({ username, password });
const BASE_URL = session.baseUrl;

const safeJsonParse = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const normalizeCourseCode = (courseName) => {
  const match = String(courseName).match(/\b([A-Z]{2,}\d{2,}[A-Z0-9]*)\b/);
  return match ? match[1] : "UNKNOWN";
};

const normalizeSubjectName = (courseName, courseCode) => {
  const name = String(courseName).replace(courseCode, "").trim();
  return name || String(courseName).trim() || "Unknown Subject";
};

const parsePeriodDate = (rawDate) => {
  const months = {
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

  const match = String(rawDate).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }

  const day = String(Number(match[1])).padStart(2, "0");
  const month = months[match[2].toLowerCase()] || "01";
  const year = match[3];
  return `${year}-${month}-${day}`;
};

const parseSessionTime = (rawDate) => {
  const match = String(rawDate).match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i,
  );
  if (!match) return "";
  return `${match[1].replace(/\s+/g, " ").toUpperCase()} - ${match[2]
    .replace(/\s+/g, " ")
    .toUpperCase()}`;
};

const fetchInProgressCourses = async () => {
  const sesskey = await session.getSesskey();
  if (!sesskey) {
    throw new Error("No sesskey found");
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

  const data = await safeJsonParse(res);
  if (!data || data[0]?.error) {
    throw new Error("Failed to fetch in-progress courses");
  }

  const courses = data[0]?.data?.courses || [];
  return courses.map((course) => ({
    id: String(course.id),
    name: course.fullname || course.shortname || `Course ${course.id}`,
  }));
};

const scrapeAttendanceRowsForCourse = async (courseId, courseName) => {
  const courseRes = await session.fetchWithSession(
    `${BASE_URL}/course/view.php?id=${courseId}`,
  );
  const courseHtml = await courseRes.text();
  const $ = cheerio.load(courseHtml);

  let attendanceModuleId = null;
  $('a[href*="/mod/attendance/view.php"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/id=(\d+)/);
    if (match && !attendanceModuleId) {
      attendanceModuleId = match[1];
    }
  });

  if (!attendanceModuleId) {
    return [];
  }

  const attendanceRes = await session.fetchWithSession(
    `${BASE_URL}/mod/attendance/view.php?id=${attendanceModuleId}&view=5`,
  );
  const attendanceHtml = await attendanceRes.text();
  const $att = cheerio.load(attendanceHtml);

  const courseCode = normalizeCourseCode(courseName);
  const subjectName = normalizeSubjectName(courseName, courseCode);

  const rows = [];

  $att("table").each((_, table) => {
    const text = $att(table).text().toLowerCase();
    const isAttendanceTable =
      text.includes("date") &&
      (text.includes("status") ||
        text.includes("points") ||
        text.includes("present"));

    if (!isAttendanceTable) return;

    $att(table)
      .find("tr")
      .each((rowIndex, row) => {
        if (rowIndex === 0) return;

        const cells = $att(row).find("td");
        if (cells.length < 3) return;

        const date = $att(cells[0]).text().trim();
        const description = $att(cells[1]).text().trim();
        const status = $att(cells[2]).text().trim();
        const points = cells.length > 3 ? $att(cells[3]).text().trim() : "";

        if (!/\d/.test(date)) return;

        rows.push({
          period_date: parsePeriodDate(date),
          session_time: parseSessionTime(date),
          course_code: courseCode,
          subject_name: subjectName,
          faculty: "Unknown",
          faculty_email: "",
          course: `${courseCode} ${subjectName}`.trim(),
          score:
            points.replace(/\s+/g, "") ||
            (status.toLowerCase().includes("present") ? "1/1" : "0/1"),
          record_id: `${courseId}-${rowIndex}`,
          description,
        });
      });
  });

  return rows;
};

const createBunkxSession = async (payload) => {
  const response = await fetch(`${BUNKX_BASE_URL}/api/bunkx/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  let bodyJson = null;
  try {
    bodyJson = JSON.parse(bodyText);
  } catch {
    bodyJson = null;
  }

  return {
    status: response.status,
    bodyText,
    bodyJson,
  };
};

const checkLaunchPage = async (sid) => {
  const url = `${BUNKX_BASE_URL}/bunkialo?sid=${encodeURIComponent(sid)}`;
  const response = await fetch(url);
  const html = await response.text();
  return {
    status: response.status,
    hasReceivedText: /Received\s+\d+\s+records/i.test(html),
    hasSessionUnavailableText: /Session unavailable/i.test(html),
    htmlHead: html.slice(0, 240),
  };
};

const checkConsumeApi = async (sid) => {
  const url = `${BUNKX_BASE_URL}/api/bunkx/session/${encodeURIComponent(sid)}`;

  const first = await fetch(url);
  const firstText = await first.text();

  const second = await fetch(url);
  const secondText = await second.text();

  return {
    firstStatus: first.status,
    secondStatus: second.status,
    firstBodyHead: firstText.slice(0, 200),
    secondBodyHead: secondText.slice(0, 200),
  };
};

async function main() {
  console.log("=== BUNKX SID E2E TEST ===");
  console.log(`LMS Base: ${BASE_URL}`);
  console.log(`Bunkx Base: ${BUNKX_BASE_URL}`);

  const loginOk = await session.login();
  const cookieCount = await session.getCookieCount();
  console.log(
    `Login: ${loginOk ? "SUCCESS" : "FAILED"} (cookies=${cookieCount})`,
  );

  if (!loginOk) {
    process.exit(1);
  }

  const courses = await fetchInProgressCourses();
  console.log(`In-progress courses: ${courses.length}`);

  const allRows = [];
  for (const course of courses) {
    const rows = await scrapeAttendanceRowsForCourse(course.id, course.name);
    allRows.push(...rows);
    console.log(`- ${course.name}: ${rows.length} rows`);
  }

  const payload = {
    attendance_rows: allRows.map(({ description, ...row }) => row),
    dataset_id: `bunkialo-e2e-${Date.now()}`,
    dataset_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };

  console.log(`Total attendance rows: ${payload.attendance_rows.length}`);

  const create = await createBunkxSession(payload);
  console.log(`Create session status: ${create.status}`);
  console.log(`Create session body head: ${create.bodyText.slice(0, 220)}`);

  const sid = create.bodyJson?.sid;
  if (!sid) {
    console.error("No sid returned from session create endpoint");
    process.exit(1);
  }

  console.log(`SID: ${sid}`);

  const page = await checkLaunchPage(sid);
  console.log(`Page status: ${page.status}`);
  console.log(`Page has 'Received X records': ${page.hasReceivedText}`);
  console.log(
    `Page has 'Session unavailable': ${page.hasSessionUnavailableText}`,
  );

  const consume = await checkConsumeApi(sid);
  console.log(`Consume first status: ${consume.firstStatus}`);
  console.log(`Consume second status: ${consume.secondStatus}`);
  console.log(`Consume first body head: ${consume.firstBodyHead}`);
  console.log(`Consume second body head: ${consume.secondBodyHead}`);

  console.log("=== E2E TEST COMPLETE ===");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`E2E test failed: ${message}`);
  process.exit(1);
});
