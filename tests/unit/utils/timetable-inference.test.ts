import { describe, expect, test } from "bun:test";
import {
  calculateDurationMinutes,
  getSessionType,
  inferRecurringLmsSlots,
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
    const slots = inferRecurringLmsSlots([
      makeRecord("Mon 20 Jul 2026 10:00 AM - 10:55 AM", "Data Structures"),
      makeRecord("Mon 27 Jul 2026 10:00 AM - 10:55 AM", "Data Structures"),
    ], { now: new Date("2026-08-01T12:00:00Z") });

    expect(slots).toHaveLength(1);
    expect(slots[0]?.startTime).toBe("10:00");
    expect(slots[0]?.endTime).toBe("10:55");
  });
});
