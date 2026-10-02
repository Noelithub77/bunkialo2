import ICAL from "ical.js";
import {
  GOOGLE_CALENDAR_EMBED_URL,
  GOOGLE_CALENDAR_ICS_URL,
  GOOGLE_CALENDAR_ID,
  GOOGLE_CALENDAR_TIME_ZONE,
} from "@/constants/google-calendar";
import type { AcademicEvent } from "@/types";
import { isRedactedCalendarTitle } from "@/utils/academic-event-visibility";

const LOOKAHEAD_DAYS = 90;

const isPublicComponent = (component: ICAL.Component): boolean => {
  const classification = String(
    component.getFirstPropertyValue("class") ?? "PUBLIC",
  ).toUpperCase();
  const status = String(
    component.getFirstPropertyValue("status") ?? "",
  ).toUpperCase();
  const title = String(component.getFirstPropertyValue("summary") ?? "");
  // RFC 5545 defaults an omitted CLASS to PUBLIC.
  return (
    classification === "PUBLIC" &&
    status !== "CANCELLED" &&
    !isRedactedCalendarTitle(title)
  );
};

const pad = (value: number): string => `${value}`.padStart(2, "0");

const toISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseISODate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

type CalendarFetchResponse = {
  text: string;
};

type EventOccurrence = {
  event: ICAL.Event;
  startDate: ICAL.Time;
  endDate: ICAL.Time;
};

const fetchCalendarResponse = async (): Promise<CalendarFetchResponse> => {
  const url =
    process.env.EXPO_OS === "web"
      ? "/api/academic-calendar/club-events"
      : GOOGLE_CALENDAR_ICS_URL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "text/calendar" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Google Calendar feed failed (${response.status}).`);
    }
    return { text: await response.text() };
  } finally {
    clearTimeout(timeoutId);
  }
};

const formatDateFields = (time: ICAL.Time): string =>
  `${time.year}-${pad(time.month)}-${pad(time.day)}`;

const formatDateInCalendarZone = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: GOOGLE_CALENDAR_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
};

const getEventDate = (time: ICAL.Time): string =>
  time.isDate
    ? formatDateFields(time)
    : formatDateInCalendarZone(time.toJSDate());

const getExclusiveEndDate = (time: ICAL.Time): string => {
  if (!time.isDate) return getEventDate(time);
  return toISODate(addDays(parseISODate(formatDateFields(time)), -1));
};

const base64UrlEncodeAscii = (value: string): string => {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";

  for (let index = 0; index < value.length; index += 3) {
    const first = value.charCodeAt(index);
    const hasSecond = index + 1 < value.length;
    const hasThird = index + 2 < value.length;
    const second = hasSecond ? value.charCodeAt(index + 1) : 0;
    const third = hasThird ? value.charCodeAt(index + 2) : 0;

    encoded += alphabet[first >> 2];
    encoded += alphabet[((first & 3) << 4) | (second >> 4)];
    encoded += hasSecond ? alphabet[((second & 15) << 2) | (third >> 6)] : "=";
    encoded += hasThird ? alphabet[third & 63] : "=";
  }

  return encoded.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const createGoogleEventUrl = (uid: string): string => {
  const eventId = uid.split("@", 1)[0];
  const calendarId = GOOGLE_CALENDAR_ID.replace(
    "@group.calendar.google.com",
    "@g",
  );
  const eid = base64UrlEncodeAscii(`${eventId} ${calendarId}`);
  return `https://calendar.google.com/calendar/event?eid=${eid}&ctz=${encodeURIComponent(GOOGLE_CALENDAR_TIME_ZONE)}`;
};

const getEventOccurrences = (
  event: ICAL.Event,
  rangeStartMs: number,
  rangeEndMs: number,
): EventOccurrence[] => {
  if (!event.isRecurring()) {
    return [
      {
        endDate: event.endDate,
        event,
        startDate: event.startDate,
      },
    ];
  }

  const occurrences: EventOccurrence[] = [];
  const iterator = event.iterator();
  let occurrence = iterator.next();
  let iterations = 0;

  while (occurrence && iterations < 1000) {
    const occurrenceMs = occurrence.toUnixTime() * 1000;
    if (occurrenceMs > rangeEndMs) break;

    const details = event.getOccurrenceDetails(occurrence);
    const endMs = details.endDate.toUnixTime() * 1000;
    if (endMs >= rangeStartMs) {
      occurrences.push({
        endDate: details.endDate,
        event: details.item,
        startDate: details.startDate,
      });
    }

    occurrence = iterator.next();
    iterations += 1;
  }

  return occurrences;
};

const normalizeOccurrence = ({
  endDate,
  event,
  startDate,
}: EventOccurrence): AcademicEvent => {
  const allDay = startDate.isDate;
  const startAt = allDay ? undefined : startDate.toJSDate().toISOString();
  const endAt = allDay ? undefined : endDate.toJSDate().toISOString();
  const date = getEventDate(startDate);
  const endDateValue = getExclusiveEndDate(endDate);
  const location = event.location?.trim() ?? "";

  const alarmMinutes = event.component.getAllSubcomponents("valarm").flatMap((alarm) => {
    const trigger = alarm.getFirstProperty("trigger");
    const value = trigger?.getFirstValue();
    if (!(value instanceof ICAL.Duration)) return [];
    const offset = value.toSeconds() + (trigger?.getParameter("related") === "END" ? endDate.toUnixTime() - startDate.toUnixTime() : 0);
    return offset < 0 ? [-offset / 60] : [];
  });

  return {
    reminderMinutes: alarmMinutes.length ? [...new Set(alarmMinutes)] : undefined,
    allDay,
    calendarUrl: createGoogleEventUrl(event.uid),
    category: "club",
    date,
    endAt,
    endDate: endDateValue !== date ? endDateValue : undefined,
    id: `google-calendar-${event.uid}-${startDate.toUnixTime()}`,
    location: location || undefined,
    note: event.description?.trim() || undefined,
    origin: "google-calendar",
    startAt,
    termId: "odd-2026-27",
    title: event.summary?.trim() || "Club event",
    visibility: "public",
  };
};

export const parseGoogleCalendarFeed = (
  text: string,
  now: Date = new Date(),
): AcademicEvent[] => {
  const calendar = new ICAL.Component(ICAL.parse(text));
  const nowMs = now.getTime();
  const rangeEndMs = addDays(now, LOOKAHEAD_DAYS).getTime();
  const events: AcademicEvent[] = [];

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of calendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else if (isPublicComponent(exception.component))
      masters.set(`${exception.uid}-${exception.recurrenceId}`, exception);
  }
  for (const event of masters.values()) {
    if (!isPublicComponent(event.component)) continue;
    const occurrences = getEventOccurrences(event, nowMs, rangeEndMs);
    for (const occurrence of occurrences) {
      if (!isPublicComponent(occurrence.event.component)) continue;
      const startMs = occurrence.startDate.toUnixTime() * 1000;
      if (
        startMs > rangeEndMs ||
        occurrence.endDate.toUnixTime() * 1000 < nowMs
      ) {
        continue;
      }
      events.push(normalizeOccurrence(occurrence));
    }
  }

  return events.sort((first, second) => {
    const dateOrder = first.date.localeCompare(second.date);
    if (dateOrder !== 0) return dateOrder;
    return (first.startAt ?? first.date).localeCompare(
      second.startAt ?? second.date,
    );
  });
};

export const fetchGoogleCalendarEvents = async (): Promise<AcademicEvent[]> => {
  const { text } = await fetchCalendarResponse();
  return parseGoogleCalendarFeed(text);
};

export const GOOGLE_CALENDAR_LINK = GOOGLE_CALENDAR_EMBED_URL;
