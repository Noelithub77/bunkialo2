import type { TimelineEvent } from "@/types";
import { debug } from "@/utils/debug";
import { api } from "./api";

interface MoodleTimelineResponse {
  error: boolean;
  exception?: unknown;
  data: {
    events: TimelineEvent[];
    firstid: number;
    lastid: number;
  };
}

const getSesskey = async (): Promise<string | null> => {
  const response = await api.get<string>("/my/");
  const match = response.data.match(/"sesskey":"([^"]+)"/);
  if (match) {
    debug.scraper(`Found sesskey: ${match[1]}`);
    return match[1];
  }
  debug.scraper("Sesskey not found");
  return null;
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

  const upcoming = data[0]?.data?.events || [];
  const overdue = (data[1]?.data?.events || []).map((event) => ({
    ...event,
    overdue: true,
  }));

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
  const events = data[0]?.data?.events || [];
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
  const events = (data[0]?.data?.events || []).map((event) => ({
    ...event,
    overdue: true,
  }));
  debug.scraper(`Found ${events.length} overdue events`);

  return events;
};
