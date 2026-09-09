import { describe, expect, test } from "vitest";
import { isDesktopPairingCode } from "../../src/services/desktop-pairing";
import { buildDesktopSnapshot } from "../../worker/desktop/timetable";
import type { FullSyncPayload } from "../../worker/session-object";

const payload = (sessions: Record<string, unknown>): FullSyncPayload => ({
  attendance: {
    notifications: {
      items: [
        {
          id: "notice-1",
          title: "Assignment due",
          body: "Submit the lab report",
          createdAt: "2026-08-19T08:00:00.000Z",
          readAt: null,
          link: "/assignments/1",
        },
      ],
    },
    sessions,
    summary: {
      courses: [{ courseId: "CS101", name: "Programming" }],
    },
    terms: {},
  },
  lms: null,
});

describe("desktop snapshot", () => {
  test("accepts only two-entry desktop pairing JSON", () => {
    expect(
      isDesktopPairingCode('{"lms-user":"lms-password","attendance-user":"attendance-password"}'),
    ).toBe(true);
    expect(isDesktopPairingCode('{"only-one":"password"}')).toBe(false);
    expect(
      isDesktopPairingCode('{"lms-user":"","attendance-user":"attendance-password"}'),
    ).toBe(false);
  });

  test("normalizes recurring LMS sessions and readable notifications", () => {
    const snapshot = buildDesktopSnapshot(payload({
      CS101: {
        sessions: [
          {
            date: "2026-08-17",
            startTime: "09:00",
            endTime: "10:00",
            topic: "Lecture",
          },
          {
            date: "2026-08-24T00:00:00.000Z",
            startTime: "09:00",
            endTime: "10:00",
            topic: "Lecture",
          },
        ],
      },
    }));

    expect(snapshot.timetable).toEqual([{
      id: "desktop-CS101-1-09:00-10:00",
      courseId: "CS101",
      courseName: "Programming",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
      sessionType: "regular",
    }]);
    expect(snapshot.notifications[0]).toMatchObject({
      id: "notice-1",
      title: "Assignment due",
      unread: true,
      url: "/assignments/1",
    });
  });

  test("keeps long sessions as labs and drops malformed rows", () => {
    const snapshot = buildDesktopSnapshot(payload({
      CS101: {
        sessions: [
          { date: "2026-08-18", startTime: "1:00 PM", endTime: "3:00 PM", topic: "Workshop" },
          { date: "not-a-date", startTime: "10:00", endTime: "11:00", topic: "Lecture" },
          { date: "2026-08-18", startTime: "11:00", endTime: "10:00", topic: "Lecture" },
        ],
      },
    }));

    expect(snapshot.timetable).toHaveLength(1);
    expect(snapshot.timetable[0]?.sessionType).toBe("lab");
    expect(snapshot.timetable[0]?.startTime).toBe("13:00");
  });

  test("keeps the higher-frequency slot when courses overlap", () => {
    const snapshot = buildDesktopSnapshot({
      attendance: {
        notifications: { items: [] },
        sessions: {
          COURSE_A: {
            sessions: [
              { date: "2026-08-03", startTime: "09:00", endTime: "10:00", topic: "Lecture" },
              { date: "2026-08-10", startTime: "09:00", endTime: "10:00", topic: "Lecture" },
              { date: "2026-08-17", startTime: "09:00", endTime: "10:00", topic: "Lecture" },
            ],
          },
          COURSE_B: {
            sessions: [
              { date: "2026-08-03", startTime: "09:30", endTime: "10:30", topic: "Lecture" },
              { date: "2026-08-10", startTime: "09:30", endTime: "10:30", topic: "Lecture" },
            ],
          },
        },
        summary: {
          courses: [
            { courseId: "COURSE_A", name: "Higher frequency" },
            { courseId: "COURSE_B", name: "Lower frequency" },
          ],
        },
        terms: {},
      },
      lms: null,
    });

    expect(snapshot.timetable).toHaveLength(1);
    expect(snapshot.timetable[0]).toMatchObject({
      courseId: "COURSE_A",
      courseName: "Higher frequency",
      startTime: "09:00",
    });
  });
});
