/**
 * Test script - Dashboard Timeline API exploration
 * Run with: node src/scripts/test-dashboard.mjs
 * Required env: LMS_TEST_USERNAME, LMS_TEST_PASSWORD
 */

import { writeFileSync } from "fs";

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

async function testTimelineApi(sesskey) {
  console.log("\n[2] TESTING core_calendar_get_action_events_by_timesort");

  const payload = [
    {
      index: 0,
      methodname: "core_calendar_get_action_events_by_timesort",
      args: {
        limitnum: 10,
        timesortfrom: Math.floor(Date.now() / 1000),
        limittononsuspendedevents: true,
      },
    },
  ];

  const res = await fetchWithCookies(
    `${BASE_URL}/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`,
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
  writeFileSync("src/scripts/timeline-response.json", JSON.stringify(data, null, 2));
  console.log("  Saved response to src/scripts/timeline-response.json");

  if (data[0]?.error) {
    console.log("  Error:", data[0].exception?.message);
    return null;
  }

  const events = data[0]?.data?.events || [];
  console.log(`  Found ${events.length} upcoming events`);

  events.forEach((e, i) => {
    const dueDate = new Date(e.timesort * 1000);
    console.log(`  ${i + 1}. ${e.name}`);
    console.log(`     Course: ${e.course?.fullname || "N/A"}`);
    console.log(`     Due: ${dueDate.toLocaleString()}`);
    console.log(`     URL: ${e.url}`);
  });

  return data;
}

async function main() {
  console.log("======================================");
  console.log("  LMS DASHBOARD TIMELINE API TEST");
  console.log("======================================");

  try {
    if (!(await login())) {
      process.exit(1);
    }

    const sesskey = await getSesskey();
    if (!sesskey) {
      console.log("ERROR: No sesskey");
      process.exit(1);
    }

    console.log(`  Sesskey: ${sesskey}`);
    await testTimelineApi(sesskey);

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
