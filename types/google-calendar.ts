/**
 * Google Calendar API types
 */

export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: string[];
}

export interface GoogleCalendarListResponse {
  items: GoogleCalendar[];
}

export interface GoogleEventsListResponse {
  items: Array<{ id: string }>;
  nextPageToken?: string;
}

export type GoogleExportStatus =
  | "idle"
  | "authenticating"
  | "creating_calendar"
  | "clearing_events"
  | "adding_events"
  | "success"
  | "error";
