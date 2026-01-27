import type {
  DayOfWeek,
  GoogleAuthTokens,
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarListResponse,
  GoogleEventsListResponse,
  TimetableSlot,
} from "@/types";
import { debug } from "@/utils/debug";
import axios from "axios";
import * as SecureStore from "expo-secure-store";

// config
const GOOGLE_TOKENS_KEY = "google_calendar_tokens";
const CALENDAR_NAME = "bunkialo-timetable";
const TIMEZONE = "Asia/Kolkata";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// env config
export const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// token storage
export const saveGoogleTokens = async (tokens: GoogleAuthTokens) => {
  await SecureStore.setItemAsync(GOOGLE_TOKENS_KEY, JSON.stringify(tokens));
  debug.scraper("Google tokens saved");
};

export const getGoogleTokens = async (): Promise<GoogleAuthTokens | null> => {
  const stored = await SecureStore.getItemAsync(GOOGLE_TOKENS_KEY);
  if (!stored) return null;
  return JSON.parse(stored) as GoogleAuthTokens;
};

export const clearGoogleTokens = async () => {
  await SecureStore.deleteItemAsync(GOOGLE_TOKENS_KEY);
  debug.scraper("Google tokens cleared");
};

export const isTokenExpired = (tokens: GoogleAuthTokens): boolean => {
  return Date.now() >= tokens.expiresAt - 60000; // 1 min buffer
};

export const getValidAccessToken = async (): Promise<string | null> => {
  const tokens = await getGoogleTokens();
  if (!tokens) return null;

  if (!isTokenExpired(tokens)) {
    return tokens.accessToken;
  }

  // token expired, clear it (Google provider handles refresh)
  await clearGoogleTokens();
  return null;
};

// calendar api helpers
const authHeader = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

export const listCalendars = async (
  accessToken: string,
): Promise<GoogleCalendar[]> => {
  const res = await axios.get<GoogleCalendarListResponse>(
    `${CALENDAR_API}/users/me/calendarList`,
    { headers: authHeader(accessToken) },
  );
  return res.data.items ?? [];
};

export const findBunkialoCalendar = async (
  accessToken: string,
): Promise<GoogleCalendar | null> => {
  const calendars = await listCalendars(accessToken);
  return calendars.find((c) => c.summary === CALENDAR_NAME) ?? null;
};

export const createCalendar = async (
  accessToken: string,
): Promise<GoogleCalendar> => {
  const res = await axios.post<GoogleCalendar>(
    `${CALENDAR_API}/calendars`,
    { summary: CALENDAR_NAME, timeZone: TIMEZONE },
    { headers: authHeader(accessToken) },
  );
  debug.scraper(`Created calendar: ${res.data.id}`);
  return res.data;
};

export const findOrCreateCalendar = async (
  accessToken: string,
): Promise<GoogleCalendar> => {
  const existing = await findBunkialoCalendar(accessToken);
  if (existing) {
    debug.scraper(`Found existing calendar: ${existing.id}`);
    return existing;
  }
  return createCalendar(accessToken);
};

export const listAllEvents = async (
  calendarId: string,
  accessToken: string,
): Promise<Array<{ id: string }>> => {
  const events: Array<{ id: string }> = [];
  let pageToken: string | undefined;

  do {
    const res = await axios.get<GoogleEventsListResponse>(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        headers: authHeader(accessToken),
        params: { pageToken, maxResults: 250 },
      },
    );
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return events;
};

export const deleteEvent = async (
  calendarId: string,
  eventId: string,
  accessToken: string,
): Promise<void> => {
  await axios.delete(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { headers: authHeader(accessToken) },
  );
};

export const clearCalendarEvents = async (
  calendarId: string,
  accessToken: string,
): Promise<number> => {
  const events = await listAllEvents(calendarId, accessToken);
  for (const event of events) {
    await deleteEvent(calendarId, event.id, accessToken);
  }
  debug.scraper(`Cleared ${events.length} events`);
  return events.length;
};

export const createEvent = async (
  calendarId: string,
  event: GoogleCalendarEvent,
  accessToken: string,
): Promise<GoogleCalendarEvent> => {
  const res = await axios.post<GoogleCalendarEvent>(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    event,
    { headers: authHeader(accessToken) },
  );
  return res.data;
};

// semester date helpers
export const getSemesterEndDate = (): Date => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  // Jan-Apr (0-3) -> April 30
  // Aug-Nov (7-10) -> November 30
  // May-Jul, Dec -> use next semester boundary
  if (month >= 0 && month <= 3) {
    return new Date(year, 3, 30); // April 30
  } else if (month >= 7 && month <= 10) {
    return new Date(year, 10, 30); // November 30
  } else if (month >= 4 && month <= 6) {
    return new Date(year, 10, 30); // November 30 (next sem)
  } else {
    return new Date(year + 1, 3, 30); // April 30 next year
  }
};

const formatRRuleDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

const DAY_TO_RRULE: Record<DayOfWeek, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

// find next occurrence of a day of week from today
const getNextOccurrence = (dayOfWeek: DayOfWeek, time: string): Date => {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  const date = new Date(now);
  date.setDate(date.getDate() + daysUntil);

  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);

  return date;
};

const formatDateTime = (date: Date): string => {
  return date.toISOString().replace("Z", "");
};

// convert slot to google calendar event
export const slotToEvent = (slot: TimetableSlot): GoogleCalendarEvent => {
  const startDate = getNextOccurrence(slot.dayOfWeek, slot.startTime);
  const endDate = getNextOccurrence(slot.dayOfWeek, slot.endTime);
  const semesterEnd = getSemesterEndDate();

  return {
    summary: slot.courseName,
    description: slot.sessionType,
    start: {
      dateTime: formatDateTime(startDate),
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: formatDateTime(endDate),
      timeZone: TIMEZONE,
    },
    recurrence: [
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_RRULE[slot.dayOfWeek]};UNTIL=${formatRRuleDate(semesterEnd)}`,
    ],
  };
};

// main export function
export const exportToGoogleCalendar = async (
  slots: TimetableSlot[],
  accessToken: string,
  onProgress?: (status: string, current?: number, total?: number) => void,
): Promise<{ success: boolean; eventsCreated: number; error?: string }> => {
  try {
    onProgress?.("creating_calendar");
    const calendar = await findOrCreateCalendar(accessToken);

    onProgress?.("clearing_events");
    await clearCalendarEvents(calendar.id, accessToken);

    onProgress?.("adding_events", 0, slots.length);
    let created = 0;
    for (const slot of slots) {
      const event = slotToEvent(slot);
      await createEvent(calendar.id, event, accessToken);
      created++;
      onProgress?.("adding_events", created, slots.length);
    }

    return { success: true, eventsCreated: created };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    debug.scraper(`Google Calendar export error: ${message}`);
    return { success: false, eventsCreated: 0, error: message };
  }
};
