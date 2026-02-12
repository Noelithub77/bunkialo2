/**
 * Test script - fetches only IN PROGRESS courses
 * Run with: node src/scripts/test-scraper.mjs
 * Required env: LMS_TEST_USERNAME, LMS_TEST_PASSWORD
 */

const BASE_URL = "https://lmsug24.iiitkottayam.ac.in";
const USERNAME = process.env.LMS_TEST_USERNAME;
const PASSWORD = process.env.LMS_TEST_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error(
    "Missing LMS_TEST_USERNAME or LMS_TEST_PASSWORD. Set both env vars before running.",
  );
  process.exit(1);
}

const cheerio = await import("cheerio");
const { CookieJar } = await import("tough-cookie");
const jar = new CookieJar();

async function fetchWithCookies(url, options = {}) {
  const cookieHeader = await jar.getCookieString(url);

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ...options.headers,
  };

  if (cookieHeader) headers["Cookie"] = cookieHeader;

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: "manual",
  });

  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  for (const cookie of setCookieHeaders) {
    await jar.setCookie(cookie, url);
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith("http")
        ? location
        : new URL(location, url).href;
      return fetchWithCookies(redirectUrl, {
        ...options,
        method: "GET",
        body: undefined,
      });
    }
  }

  return response;
}

async function login() {
  console.log("\n[1] LOGIN");

  const loginPageRes = await fetchWithCookies(`${BASE_URL}/login/index.php`);
  const loginPageHtml = await loginPageRes.text();

  const $ = cheerio.load(loginPageHtml);
  const loginToken = $('input[name="logintoken"]').val();

  if (!loginToken) return false;

  const formData = new URLSearchParams({
    anchor: "",
    logintoken: String(loginToken),
    username: USERNAME,
    password: PASSWORD,
  });

  const loginRes = await fetchWithCookies(`${BASE_URL}/login/index.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  const resultHtml = await loginRes.text();
  const $r = cheerio.load(resultHtml);
  const success = $r('a[href*="logout"]').length > 0;

  console.log(`  Result: ${success ? "SUCCESS" : "FAILED"}`);
  return success;
}

async function getSesskey() {
  const res = await fetchWithCookies(`${BASE_URL}/my/`);
  const html = await res.text();
  const match = html.match(/"sesskey":"([^"]+)"/);
  return match ? match[1] : null;
}

async function getInProgressCourses() {
  console.log("\n[2] GET IN-PROGRESS COURSES (via API)");

  const sesskey = await getSesskey();
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

  const res = await fetchWithCookies(
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

  const data = await res.json();

  if (data[0]?.error) {
    console.log(`  API Error: ${data[0].exception?.message || "Unknown"}`);
    return [];
  }

  const courses = data[0]?.data?.courses || [];
  console.log(`\n  IN-PROGRESS COURSES: ${courses.length}`);

  return courses.map((c) => ({
    id: String(c.id),
    name: c.fullname || c.shortname,
  }));
}

async function getAttendance(courseId, courseName) {
  console.log(`\n[3] ATTENDANCE: ${courseName.substring(0, 35)}`);

  const courseRes = await fetchWithCookies(`${BASE_URL}/course/view.php?id=${courseId}`);
  const courseHtml = await courseRes.text();
  const $ = cheerio.load(courseHtml);

  let attId = null;
  $('a[href*="/mod/attendance/view.php"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/id=(\d+)/);
    if (match) attId = match[1];
  });

  if (!attId) {
    console.log("  No attendance module");
    return null;
  }

  const attRes = await fetchWithCookies(`${BASE_URL}/mod/attendance/view.php?id=${attId}&view=5`);
  const attHtml = await attRes.text();
  const $att = cheerio.load(attHtml);

  const records = [];

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
    if (!(await login())) {
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
