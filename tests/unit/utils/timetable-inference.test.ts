import { describe, expect, test } from "bun:test";
import {
  calculateDurationMinutes,
  getSessionType,
  inferRecurringLmsSlots,
  inferRecurringLmsSlotsVerbose,
} from "@/utils/timetable-inference";
import type { AttendanceRecord } from "@/types";

const makeRecord = (date: string, description: string): AttendanceRecord => ({
  sessionId: `${date}-${description}`,
  termId: "2026-odd",
  date,
  exactDate: date,
  startTime: "10:00",
  endTime: "10:55",
  section: null,
  topic: null,
  description,
  status: "Present",
  sourceStatus: "PRESENT",
  points: "1 / 1",
});

describe("timetable inference", () => {
  test("uses the real duration and description rules", () => {
    expect(calculateDurationMinutes(10 * 60, 10 * 60 + 55)).toBe(55);
    expect(getSessionType("Data Structures", 600, 655)).toBe("regular");
    expect(getSessionType("Programming", 840, 960)).toBe("lab");
    expect(getSessionType("Math Tutorial", 900, 955)).toBe("tutorial");
    expect(getSessionType("Long Class", 480, 585)).toBe("regular");
    expect(getSessionType("Long Class", 480, 590)).toBe("lab");
  });

  test("infers a recurring slot from real attendance records", () => {
    const slots = inferRecurringLmsSlots(
      [
        makeRecord("Mon 20 Jul 2026 10:00 AM - 10:55 AM", "Data Structures"),
        makeRecord("Mon 27 Jul 2026 10:00 AM - 10:55 AM", "Data Structures"),
      ],
      { now: new Date("2026-08-01T12:00:00Z") },
    );

    expect(slots).toHaveLength(1);
    expect(slots[0]?.startTime).toBe("10:00");
    expect(slots[0]?.endTime).toBe("11:00");
  });
});

describe("faculty time cleanup", () => {
  test("snaps shifted start and end times before clustering and combines their evidence", () => {
    const records = [
      makeRecord("Thu 23 Jul 2026 4:32 PM - 5:37 PM", "Optimisation"),
      makeRecord("Thu 30 Jul 2026 4:33 PM - 5:37 PM", "Optimisation"),
    ];
    const result = inferRecurringLmsSlotsVerbose(records, {
      now: new Date("2026-08-01T12:00:00Z"),
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      startTime: "16:30",
      endTime: "17:30",
      occurrenceCount: 2,
      weekCount: 2,
    });
    expect(records[0].date).toContain("4:32 PM");
  });
  test("uses the nearest boundary rather than flooring and retains raw-duration lab classification", () => {
    const result = inferRecurringLmsSlots(
      [makeRecord("Mon 20 Jul 2026 10:18 AM - 11:48 AM", "Class")],
      { now: new Date("2026-08-01T12:00:00Z") },
    );
    expect(result[0]).toMatchObject({
      startTime: "10:30",
      endTime: "12:00",
      sessionType: "regular",
    });
    const longer = inferRecurringLmsSlots(
      [makeRecord("Mon 20 Jul 2026 10:07 AM - 11:58 AM", "Class")],
      { now: new Date("2026-08-01T12:00:00Z") },
    );
    expect(longer[0]).toMatchObject({
      startTime: "10:00",
      endTime: "12:00",
      sessionType: "lab",
    });
  });
});

test("merges early AM typos only when the same course and day have stronger matching PM evidence", () => {
  const result = inferRecurringLmsSlotsVerbose(
    [
      makeRecord("Thu 2 Jul 2026 4:32 PM - 5:37 PM", "Optimisation"),
      makeRecord("Thu 9 Jul 2026 4:33 PM - 5:37 PM", "Optimisation"),
      makeRecord("Thu 16 Jul 2026 4:32 PM - 5:37 PM", "Optimisation"),
      makeRecord("Thu 23 Jul 2026 4:33 PM - 5:37 PM", "Optimisation"),
      makeRecord("Thu 30 Jul 2026 4:33 AM - 5:37 AM", "Optimisation"),
      makeRecord("Thu 6 Aug 2026 4:32 AM - 5:37 AM", "Optimisation"),
    ],
    { now: new Date("2026-08-15T12:00:00Z") },
  );
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({
    startTime: "16:30",
    endTime: "17:30",
    occurrenceCount: 6,
    weekCount: 6,
  });
  const early = inferRecurringLmsSlots(
    [makeRecord("Thu 2 Jul 2026 4:32 AM - 5:37 AM", "Early class")],
    { now: new Date("2026-08-15T12:00:00Z") },
  );
  expect(early[0]).toMatchObject({ startTime: "04:30", endTime: "05:30" });
  const valid = inferRecurringLmsSlotsVerbose(
    [
      makeRecord("Thu 2 Jul 2026 8:02 AM - 9:02 AM", "Class"),
      makeRecord("Thu 9 Jul 2026 8:02 PM - 9:02 PM", "Class"),
      makeRecord("Thu 16 Jul 2026 8:02 PM - 9:02 PM", "Class"),
    ],
    { now: new Date("2026-08-15T12:00:00Z") },
  );
  expect(valid.candidates).toHaveLength(2);
});
