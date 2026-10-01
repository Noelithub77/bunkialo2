import { describe, expect, test } from "bun:test";
import type { CourseBunkData, TimetableSlot } from "@/types";
import {
  buildMessWidgetProps,
  buildTimetableWidgetProps,
  getWidgetBoundaries,
  getWidgetTimelineDates,
} from "@/widgets/data";

const slot: TimetableSlot = {
  id: "1",
  courseId: "CS",
  courseName: "Computer Science",
  dayOfWeek: 4,
  startTime: "09:00",
  endTime: "10:30",
  sessionType: "regular",
  isManual: true,
  isCustomCourse: false,
};
const course: CourseBunkData = {
  courseId: "CS",
  courseName: slot.courseName,
  config: {
    alias: "Algorithms",
    color: "#A78BFA",
    courseCode: "CS",
    credits: 3,
    overrideLmsSlots: false,
  },
  bunks: [],
  isConfigured: true,
  isCustomCourse: false,
  manualSlots: [],
};

describe("home widget data", () => {
  test("uses aliases and course colours, hides courses, and preserves custom slots", () => {
    const props = buildTimetableWidgetProps([slot], [course], {});
    expect(props.cards[0].name).toBe("Algorithms");
    expect(props.cards[0].time).toBe("9am–10:30am");
    expect(props.cards[0].color).toBe(course.config!.color);
    expect(props.cards[0].lightBackground).not.toBe(
      props.cards[0].darkBackground,
    );
    expect(
      buildTimetableWidgetProps([slot], [course], { CS: true }).cards,
    ).toHaveLength(0);
    expect(
      buildTimetableWidgetProps([{ ...slot, isCustomCourse: true }], [course], {
        CS: true,
      }).cards,
    ).toHaveLength(1);
    expect(
      buildTimetableWidgetProps([{ ...slot, endTime: "08:00" }], [], {}).cards,
    ).toHaveLength(0);
  });

  test("keeps each day's real menu and schedules every meal boundary", () => {
    const props = buildMessWidgetProps();
    expect(props.cards).toHaveLength(28);
    expect(props.cards.every((card) => card.items.length > 0)).toBe(true);
    expect(getWidgetBoundaries(props.cards)).toHaveLength(56);
  });

  test("schedules India-time boundaries and repeats through a week rollover", () => {
    const cards = buildTimetableWidgetProps([slot], [], {}).cards;
    const dates = getWidgetTimelineDates(
      cards,
      Date.parse("2026-10-01T03:00:00Z"),
    );
    expect(dates.map((date) => date.toISOString())).toEqual([
      "2026-10-01T03:00:00.000Z",
      "2026-10-01T03:30:00.000Z",
      "2026-10-01T05:00:00.000Z",
      "2026-10-08T03:30:00.000Z",
      "2026-10-08T05:00:00.000Z",
    ]);
    expect(
      getWidgetTimelineDates(
        cards,
        Date.parse("2026-10-01T05:00:00Z"),
      )[1].toISOString(),
    ).toBe("2026-10-08T03:30:00.000Z");
  });
});
