import type { TimelineEvent } from "@/types";
import { debug } from "@/utils/debug";
import { api } from "./api";

interface MoodleTimelineResponse {
  error: boolean;
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

export const fetchTimelineEvents = async (
  limit = 20,
): Promise<TimelineEvent[]> => {
  debug.scraper("=== FETCHING TIMELINE EVENTS ===");

  const sesskey = await getSesskey();
  if (!sesskey) {
    throw new Error("Session key not found");
  }

  const nowTimestamp = Math.floor(Date.now() / 1000);

  const payload = [
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

  const response = await api.post<MoodleTimelineResponse[]>(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`,
    JSON.stringify(payload),
    { headers: { "Content-Type": "application/json" } },
  );

  const data = response.data;
  if (!Array.isArray(data) || data[0]?.error) {
    throw new Error("Failed to fetch timeline events");
  }

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

  const payload = [
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

  const response = await api.post<MoodleTimelineResponse[]>(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=core_calendar_get_action_events_by_timesort`,
    JSON.stringify(payload),
    { headers: { "Content-Type": "application/json" } },
  );

  const data = response.data;
  if (!Array.isArray(data) || data[0]?.error) {
    throw new Error("Failed to fetch overdue events");
  }

  const events = (data[0]?.data?.events || []).map((e) => ({
    ...e,
    overdue: true,
  }));
  debug.scraper(`Found ${events.length} overdue events`);

  return events;
};
