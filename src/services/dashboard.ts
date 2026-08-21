import type { TimelineEvent } from "@/types";
import { debug } from "@/utils/debug";
import { api } from "./api";
import { dedupeTimelineEvents } from "./dashboard-event-utils";
import { getSesskey } from "./sesskey";

interface MoodleTimelineResponse {
  error: boolean;
  exception?: unknown;
  data: {
    events: TimelineEvent[];
    firstid: number;
    lastid: number;
  };
}

const isTimelineEvent = (value: unknown): value is TimelineEvent => {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" &&
    typeof item.name === "string" &&
    typeof item.activityname === "string" &&
    typeof item.activitystr === "string" &&
    typeof item.modulename === "string" &&
    typeof item.instance === "number" &&
    typeof item.eventtype === "string" &&
    typeof item.timestart === "number" &&
    typeof item.timesort === "number" &&
    typeof item.url === "string";
};

export const parseDashboardPayload = (
  value: unknown,
): { overdue: TimelineEvent[]; upcoming: TimelineEvent[] } => {
  if (!Array.isArray(value)) throw new Error("Invalid dashboard response");
  const readEvents = (entry: unknown): TimelineEvent[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const data = (entry as Record<string, unknown>).data;
    if (typeof data !== "object" || data === null) return [];
    const events = (data as Record<string, unknown>).events;
    return Array.isArray(events) ? events.filter(isTimelineEvent) : [];
  };
  const upcoming = dedupeTimelineEvents(readEvents(value[0]));
  const overdue = dedupeTimelineEvents(
    readEvents(value[1]).map((event) => ({ ...event, overdue: true })),
  );
  return { overdue, upcoming };
};

type ActionEventsByTimesortArgs = {
  limitnum: number;
  timesortfrom: number;
  timesortto?: number;
  limittononsuspendedevents: true;
};

type ActionEventsByTimesortRequest = {
  index: number;
  methodname: "core_calendar_get_action_events_by_timesort";
  args: ActionEventsByTimesortArgs;
};

const postActionEventsByTimesort = async (
  sesskey: string,
  payload: ActionEventsByTimesortRequest[],
): Promise<MoodleTimelineResponse[]> => {
  const response = await api.post<MoodleTimelineResponse[]>(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`,
    JSON.stringify(payload),
    { headers: { "Content-Type": "application/json" } },
  );

  const data = response.data;
  if (!Array.isArray(data) || data.some((item) => item?.error)) {
    throw new Error("Failed to fetch timeline events");
  }

  return data;
};

export const fetchDashboardEvents = async (
  limit = 20,
): Promise<{ upcoming: TimelineEvent[]; overdue: TimelineEvent[] }> => {
  debug.scraper("=== FETCHING DASHBOARD EVENTS (BATCHED) ===");

  const sesskey = await getSesskey();
  if (!sesskey) {
    throw new Error("Session key not found");
  }

  const nowTimestamp = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = nowTimestamp - 30 * 24 * 60 * 60;

  const payload: ActionEventsByTimesortRequest[] = [
    {
      index: 0,
      methodname: "core_calendar_get_action_events_by_timesort",
      args: {
        limitnum: limit,
        timesortfrom: nowTimestamp,
        limittononsuspendedevents: true,
      },
    },
    {
      index: 1,
      methodname: "core_calendar_get_action_events_by_timesort",
      args: {
        limitnum: limit,
        timesortfrom: thirtyDaysAgo,
        timesortto: nowTimestamp,
        limittononsuspendedevents: true,
      },
    },
  ];

  const data = await postActionEventsByTimesort(sesskey, payload);

  const { upcoming, overdue } = parseDashboardPayload(data);
  const rawUpcoming = data[0]?.data?.events || [];
  const rawOverdue = (data[1]?.data?.events || []).map((event) => ({
    ...event,
    overdue: true,
  }));

  if (rawUpcoming.length !== upcoming.length) {
    debug.scraper(
      `Dropped ${rawUpcoming.length - upcoming.length} duplicate upcoming event(s)`,
    );
  }

  if (rawOverdue.length !== overdue.length) {
    debug.scraper(
      `Dropped ${rawOverdue.length - overdue.length} duplicate overdue event(s)`,
    );
  }

  debug.scraper(`Found ${upcoming.length} timeline events`);
  debug.scraper(`Found ${overdue.length} overdue events`);

  return { upcoming, overdue };
};

export const fetchTimelineEvents = async (
  limit = 20,
): Promise<TimelineEvent[]> => {
  debug.scraper("=== FETCHING TIMELINE EVENTS ===");

  const sesskey = await getSesskey();
  if (!sesskey) {
    throw new Error("Session key not found");
  }

  const nowTimestamp = Math.floor(Date.now() / 1000);

  const payload: ActionEventsByTimesortRequest[] = [
    {
      index: 0,
      methodname: "core_calendar_get_action_events_by_timesort",
      args: {
        limitnum: limit,
        timesortfrom: nowTimestamp,
        limittononsuspendedevents: true,
      },
    },
  ];

  const data = await postActionEventsByTimesort(sesskey, payload);
  const rawEvents = data[0]?.data?.events || [];
  const events = dedupeTimelineEvents(rawEvents);

  if (rawEvents.length !== events.length) {
    debug.scraper(
      `Dropped ${rawEvents.length - events.length} duplicate timeline event(s)`,
    );
  }
  debug.scraper(`Found ${events.length} timeline events`);

  return events;
};

export const fetchOverdueEvents = async (
  limit = 20,
): Promise<TimelineEvent[]> => {
  debug.scraper("=== FETCHING OVERDUE EVENTS ===");

  const sesskey = await getSesskey();
  if (!sesskey) {
    throw new Error("Session key not found");
  }

  const nowTimestamp = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = nowTimestamp - 30 * 24 * 60 * 60;

  const payload: ActionEventsByTimesortRequest[] = [
    {
      index: 0,
      methodname: "core_calendar_get_action_events_by_timesort",
      args: {
        limitnum: limit,
        timesortfrom: thirtyDaysAgo,
        timesortto: nowTimestamp,
        limittononsuspendedevents: true,
      },
    },
  ];

  const data = await postActionEventsByTimesort(sesskey, payload);
  const rawEvents = (data[0]?.data?.events || []).map((event) => ({
    ...event,
    overdue: true,
  }));
  const events = dedupeTimelineEvents(rawEvents);

  if (rawEvents.length !== events.length) {
    debug.scraper(
      `Dropped ${rawEvents.length - events.length} duplicate overdue event(s)`,
    );
  }
  debug.scraper(`Found ${events.length} overdue events`);

  return events;
};
