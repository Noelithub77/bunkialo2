import { loadEnvFromRoot } from "../../helpers/lms-session";

loadEnvFromRoot();

const username = process.env.LMS_TEST_USERNAME;
const password = process.env.LMS_TEST_PASSWORD;
const origin = process.env.WEB_RELAY_TEST_URL ?? "http://127.0.0.1:8787";

if (!username || !password) {
  throw new Error("Missing LMS_TEST_USERNAME or LMS_TEST_PASSWORD.");
}

const sameOriginHeaders = {
  Origin: origin,
  "Sec-Fetch-Site": "same-origin",
};

const login = await fetch(`${origin}/api/auth/lms/login`, {
  body: JSON.stringify({ password, username }),
  headers: {
    ...sameOriginHeaders,
    "Content-Type": "application/json",
  },
  method: "POST",
});

const sessionCookie = login.headers
  .getSetCookie()
  .map((value) => value.split(";", 1)[0])
  .join("; ");

if (!login.ok || !sessionCookie) {
  throw new Error(`Web relay login failed with status ${login.status}.`);
}

try {
  const session = await fetch(`${origin}/api/auth/lms/session`, {
    headers: { Cookie: sessionCookie },
  });
  const sessionData: unknown = await session.json();
  const sessionValid =
    typeof sessionData === "object" &&
    sessionData !== null &&
    "valid" in sessionData &&
    sessionData.valid === true;
  if (!session.ok || !sessionValid) {
    throw new Error(`Web relay session check failed with status ${session.status}.`);
  }

  const dashboard = await fetch(`${origin}/api/lms/my/`, {
    headers: { Cookie: sessionCookie },
  });
  const dashboardHtml = await dashboard.text();
  const sessionKey = dashboardHtml.match(/"sesskey":"([^"]+)"/i)?.[1];
  const hasLoginForm = /name=["']logintoken/i.test(dashboardHtml);
  if (!dashboard.ok || !sessionKey || hasLoginForm) {
    throw new Error(`Authenticated dashboard check failed with status ${dashboard.status}.`);
  }

  const timeline = await fetch(
    `${origin}/api/lms/lib/ajax/service.php?sesskey=${encodeURIComponent(sessionKey)}&info=core_calendar_get_action_events_by_timesort`,
    {
      body: JSON.stringify([
        {
          args: {
            limitnum: 1,
            limittononsuspendedevents: true,
            timesortfrom: Math.floor(Date.now() / 1000),
          },
          index: 0,
          methodname: "core_calendar_get_action_events_by_timesort",
        },
      ]),
      headers: {
        ...sameOriginHeaders,
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      method: "POST",
    },
  );
  const timelineData: unknown = await timeline.json();
  const timelineItem = Array.isArray(timelineData) ? timelineData[0] : null;
  const timelineValid =
    typeof timelineItem === "object" &&
    timelineItem !== null &&
    "error" in timelineItem &&
    timelineItem.error === false &&
    "data" in timelineItem &&
    typeof timelineItem.data === "object" &&
    timelineItem.data !== null &&
    "events" in timelineItem.data &&
    Array.isArray(timelineItem.data.events);
  if (!timeline.ok || !timelineValid) {
    throw new Error(`Timeline relay check failed with status ${timeline.status}.`);
  }

  const fullSync = await fetch(`${origin}/api/sync`, {
    headers: { ...sameOriginHeaders, Cookie: sessionCookie },
    method: "POST",
  });
  const fullSyncData: unknown = await fullSync.json();
  const fullSyncValid =
    typeof fullSyncData === "object" &&
    fullSyncData !== null &&
    "lms" in fullSyncData &&
    typeof fullSyncData.lms === "object" &&
    fullSyncData.lms !== null &&
    "timeline" in fullSyncData.lms &&
    Array.isArray(fullSyncData.lms.timeline) &&
    "courses" in fullSyncData.lms;
  if (!fullSync.ok || !fullSyncValid) {
    throw new Error(`Full sync check failed with status ${fullSync.status}.`);
  }

  console.log(JSON.stringify({
    dashboardStatus: dashboard.status,
    fullSyncStatus: fullSync.status,
    loginStatus: login.status,
    sessionStatus: session.status,
    target: new URL(origin).host,
    timelineStatus: timeline.status,
  }));
} finally {
  await fetch(`${origin}/api/auth/logout`, {
    headers: { ...sameOriginHeaders, Cookie: sessionCookie },
    method: "POST",
  });
}
