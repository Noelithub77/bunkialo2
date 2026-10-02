import { describe, expect, test } from "bun:test";
import { parseGoogleCalendarFeed } from "@/services/academic-calendar-feed";

const SAMPLE_FEED = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-TIMEZONE:Asia/Kolkata
BEGIN:VEVENT
UID:orientation-123@google.com
DTSTART:20260922T110000Z
DTEND:20260922T130000Z
SUMMARY:Enigma Orientation
LOCATION:BC 302\\,303
DESCRIPTION:Club orientation
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:festival-456@google.com
DTSTART;VALUE=DATE:20261009
DTEND;VALUE=DATE:20261012
SUMMARY:AAROH '26
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

describe("Google Calendar feed", () => {
  test("normalizes timed events with local time, venue, and direct link", () => {
    const [event] = parseGoogleCalendarFeed(
      SAMPLE_FEED,
      new Date("2026-09-20T00:00:00.000Z"),
    );

    expect(event).toMatchObject({
      allDay: false,
      category: "club",
      date: "2026-09-22",
      endAt: "2026-09-22T13:00:00.000Z",
      location: "BC 302,303",
      origin: "google-calendar",
      startAt: "2026-09-22T11:00:00.000Z",
      title: "Enigma Orientation",
    });
    expect(event?.calendarUrl).toContain(
      "calendar.google.com/calendar/event?eid=",
    );
  });

  test("converts exclusive all-day end dates into an inclusive range", () => {
    const events = parseGoogleCalendarFeed(
      SAMPLE_FEED,
      new Date("2026-10-01T00:00:00.000Z"),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      allDay: true,
      date: "2026-10-09",
      endDate: "2026-10-11",
      title: "AAROH '26",
    });
    expect(events[0]?.startAt).toBeUndefined();
  });
});

const feedWith = (events: string): string =>
  `BEGIN:VCALENDAR\nVERSION:2.0\n${events}\nEND:VCALENDAR`;
const calendarEvent = (id: string, extra: string): string =>
  `BEGIN:VEVENT\nUID:${id}@google.com\nDTSTART:20261005T110000Z\nDTEND:20261005T120000Z\nSUMMARY:${id}\n${extra}\nEND:VEVENT`;

describe("public club events only", () => {
  test("drops private and confidential events even when their titles are descriptive", () => {
    const feed = feedWith(
      [
        calendarEvent("Public orientation", "CLASS:PUBLIC"),
        calendarEvent("Default public event", ""),
        calendarEvent("Named private meeting", "CLASS:PRIVATE"),
        calendarEvent("Named confidential meeting", "CLASS:CONFIDENTIAL"),
        calendarEvent("Cancelled event", "CLASS:PUBLIC\nSTATUS:CANCELLED"),
        calendarEvent("Busy", ""),
        calendarEvent("Private", "CLASS:PUBLIC"),
        calendarEvent("Private event", ""),
      ].join("\n"),
    );
    const events = parseGoogleCalendarFeed(
      feed,
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(events.map((event) => event.title).sort()).toEqual([
      "Default public event",
      "Public orientation",
    ]);
    expect(events.every((event) => event.visibility === "public")).toBe(true);
  });

  test("a private recurrence exception never reappears through its public series", () => {
    const feed = feedWith(`BEGIN:VEVENT
UID:weekly@google.com
DTSTART:20261001T110000Z
DTEND:20261001T120000Z
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Public weekly meeting
CLASS:PUBLIC
END:VEVENT
BEGIN:VEVENT
UID:weekly@google.com
RECURRENCE-ID:20261008T110000Z
DTSTART:20261008T110000Z
DTEND:20261008T120000Z
SUMMARY:Private meeting
CLASS:PRIVATE
END:VEVENT`);
    const events = parseGoogleCalendarFeed(
      feed,
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(events.map((event) => event.date)).toEqual([
      "2026-10-01",
      "2026-10-15",
    ]);
  });
});
