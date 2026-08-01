/**
 * Test script - Dashboard Timeline API exploration
 * Run with: bun tests/integration/lms/test-dashboard.ts
 * Required env: LMS_TEST_USERNAME, LMS_TEST_PASSWORD
 */

import { writeFileSync } from "node:fs";
import type { LmsSession } from "../../helpers/lms-session";
import { createLmsSession, loadEnvFromRoot } from "../../helpers/lms-session";

loadEnvFromRoot();
let session: LmsSession;
let BASE_URL: string;

interface TimelineEvent {
  name?: string;
  timesort?: number;
  course?: { fullname?: string };
  url?: string;
}

interface TimelineResponse {
  error?: boolean;
  exception?: { message?: string };
  data?: { events?: TimelineEvent[] };
}

const asTimelineResponse = (value: unknown): TimelineResponse[] =>
  Array.isArray(value) ? (value as TimelineResponse[]) : [];

async function testTimelineApi(sesskey: string, lmsSession: LmsSession): Promise<unknown> {
  console.log("\n[2] TESTING core_calendar_get_action_events_by_timesort");
  const sessionReady = await lmsSession.ensureSession();
  if (!sessionReady) {
    console.log("  ERROR: Could not establish LMS session");
    return null;
  }

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

  const res = await lmsSession.fetchWithSession(
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

  const data: unknown = await res.json();
  const parsed = asTimelineResponse(data);
  writeFileSync("tests/integration/lms/timeline-response.json", JSON.stringify(data, null, 2));
  console.log("  Saved response to tests/integration/lms/timeline-response.json");

  if (parsed[0]?.error) {
    console.log("  Error:", parsed[0].exception?.message);
    return null;
  }

  const events = parsed[0]?.data?.events || [];
  console.log(`  Found ${events.length} upcoming events`);

  events.forEach((e, i) => {
    const dueDate = new Date((e.timesort ?? 0) * 1000);
    console.log(`  ${i + 1}. ${e.name || "(unnamed)"}`);
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
    session = createLmsSession();
    BASE_URL = session.baseUrl;

    console.log("\n[1] LOGIN");
    const loginOk = await session.login();
    const cookieCount = await session.getCookieCount();
    console.log(`  Result: ${loginOk ? "SUCCESS" : "FAILED"} (cookies=${cookieCount})`);
    if (!loginOk) {
      process.exit(1);
    }

    const sesskey = await session.getSesskey();
    if (!sesskey) {
      console.log("ERROR: No sesskey");
      process.exit(1);
    }

    console.log(`  Sesskey: ${sesskey}`);
    await testTimelineApi(sesskey, session);

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
