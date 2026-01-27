import type {
  DayOfWeek,
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarListResponse,
  GoogleEventsListResponse,
  TimetableSlot,
} from "@/types";
import { debug } from "@/utils/debug";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import axios from "axios";

// config
const CALENDAR_NAME = "bunkialo-timetable";
const TIMEZONE = "Asia/Kolkata";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

// env
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

// ─── Auth Configuration ──────────────────────────────────────────────────────

let isConfigured = false;

export const configureGoogleSignIn = () => {
  if (isConfigured) return;

  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    scopes: [CALENDAR_SCOPE],
    offlineAccess: false,
  });
  isConfigured = true;
  debug.scraper("Google Sign-In configured");
};

// ─── Auth Methods ────────────────────────────────────────────────────────────

export const signIn = async (): Promise<string> => {
  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices();

  // try silent sign-in first
  const silentResponse = await GoogleSignin.signInSilently();
  if (silentResponse.type === "success") {
    const tokens = await GoogleSignin.getTokens();
    debug.scraper("Silent sign-in successful");
    return tokens.accessToken;
  }

  // need interactive sign-in
  const response = await GoogleSignin.signIn();
  if (response.type !== "success") {
    throw new Error("Sign-in cancelled");
  }

  const tokens = await GoogleSignin.getTokens();
  debug.scraper("Interactive sign-in successful");
  return tokens.accessToken;
};

export const getAccessToken = async (): Promise<string | null> => {
  configureGoogleSignIn();

  if (!GoogleSignin.hasPreviousSignIn()) {
    return null;
  }

  try {
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch {
    return null;
  }
};

export const signOut = async () => {
  try {
    await GoogleSignin.signOut();
    debug.scraper("Signed out from Google");
  } catch {
    // ignore errors
  }
};

export const isSignedIn = (): boolean => {
  configureGoogleSignIn();
  return GoogleSignin.hasPreviousSignIn();
};

// ─── Error Handling ──────────────────────────────────────────────────────────

export const getSignInErrorMessage = (error: unknown): string => {
  if (typeof error !== "object" || error === null) {
    return "Unknown error occurred";
  }

  const errorWithCode = error as { code?: string; message?: string };

  switch (errorWithCode.code) {
    case statusCodes.IN_PROGRESS:
      return "Sign-in already in progress";
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return "Google Play Services not available";
    default:
      return errorWithCode.message ?? "Sign-in failed";
  }
};

// ─── Calendar API Helpers ────────────────────────────────────────────────────

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const listCalendars = async (token: string): Promise<GoogleCalendar[]> => {
  const res = await axios.get<GoogleCalendarListResponse>(
    `${CALENDAR_API}/users/me/calendarList`,
    { headers: authHeader(token) },
  );
  return res.data.items ?? [];
};

const findBunkialoCalendar = async (
  token: string,
): Promise<GoogleCalendar | null> => {
  const calendars = await listCalendars(token);
  return calendars.find((c) => c.summary === CALENDAR_NAME) ?? null;
};

const createCalendar = async (token: string): Promise<GoogleCalendar> => {
  const res = await axios.post<GoogleCalendar>(
    `${CALENDAR_API}/calendars`,
    { summary: CALENDAR_NAME, timeZone: TIMEZONE },
    { headers: authHeader(token) },
  );
  debug.scraper(`Created calendar: ${res.data.id}`);
  return res.data;
};

const findOrCreateCalendar = async (token: string): Promise<GoogleCalendar> => {
  const existing = await findBunkialoCalendar(token);
  if (existing) {
    debug.scraper(`Found existing calendar: ${existing.id}`);
    return existing;
  }
  return createCalendar(token);
};

// ─── Events API ──────────────────────────────────────────────────────────────

const listAllEvents = async (
  calendarId: string,
  token: string,
): Promise<Array<{ id: string }>> => {
  const events: Array<{ id: string }> = [];
  let pageToken: string | undefined;

  do {
    const res = await axios.get<GoogleEventsListResponse>(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        headers: authHeader(token),
        params: { pageToken, maxResults: 250 },
      },
    );
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return events;
};

const deleteEvent = async (
  calendarId: string,
  eventId: string,
  token: string,
): Promise<void> => {
  await axios.delete(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    { headers: authHeader(token) },
  );
};

const clearCalendarEvents = async (
  calendarId: string,
  token: string,
): Promise<number> => {
  const events = await listAllEvents(calendarId, token);
  for (const event of events) {
    await deleteEvent(calendarId, event.id, token);
  }
  debug.scraper(`Cleared ${events.length} events`);
  return events.length;
};

const createEvent = async (
  calendarId: string,
  event: GoogleCalendarEvent,
  token: string,
): Promise<GoogleCalendarEvent> => {
  const res = await axios.post<GoogleCalendarEvent>(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    event,
    { headers: authHeader(token) },
  );
  return res.data;
};

// ─── Semester Date Helpers ───────────────────────────────────────────────────

const getSemesterEndDate = (): Date => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  if (month <= 3) return new Date(year, 3, 30);
  if (month >= 7 && month <= 10) return new Date(year, 10, 30);
  if (month <= 6) return new Date(year, 10, 30);
  return new Date(year + 1, 3, 30);
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

const getNextOccurrence = (dayOfWeek: DayOfWeek, time: string): Date => {
  const now = new Date();
  let daysUntil = dayOfWeek - now.getDay();
  if (daysUntil <= 0) daysUntil += 7;

  const date = new Date(now);
  date.setDate(date.getDate() + daysUntil);

  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);

  return date;
};

const formatDateTime = (date: Date): string =>
  date.toISOString().replace("Z", "");

// ─── Slot to Event Conversion ────────────────────────────────────────────────

const slotToEvent = (slot: TimetableSlot): GoogleCalendarEvent => {
  const startDate = getNextOccurrence(slot.dayOfWeek, slot.startTime);
  const endDate = getNextOccurrence(slot.dayOfWeek, slot.endTime);
  const semesterEnd = getSemesterEndDate();

  return {
    summary: slot.courseName,
    description: slot.sessionType,
    start: { dateTime: formatDateTime(startDate), timeZone: TIMEZONE },
    end: { dateTime: formatDateTime(endDate), timeZone: TIMEZONE },
    recurrence: [
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_RRULE[slot.dayOfWeek]};UNTIL=${formatRRuleDate(semesterEnd)}`,
    ],
  };
};

// ─── Main Export Function ────────────────────────────────────────────────────

type ProgressCallback = (
  status: string,
  current?: number,
  total?: number,
) => void;

interface ExportResult {
  success: boolean;
  eventsCreated: number;
  error?: string;
}

export const exportToGoogleCalendar = async (
  slots: TimetableSlot[],
  accessToken: string,
  onProgress?: ProgressCallback,
): Promise<ExportResult> => {
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
