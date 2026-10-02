import { describe, expect, test } from "bun:test";
import { isVisibleAcademicEvent } from "@/utils/academic-event-visibility";
import type { AcademicEvent } from "@/types";
const club: AcademicEvent = {
  id: "club",
  title: "Orientation",
  origin: "google-calendar",
  category: "club",
  termId: "odd-2026-27",
  date: "2026-10-05",
};

describe("cached club event visibility", () => {
  test("hides legacy and private cached entries immediately, before another fetch", () => {
    expect(isVisibleAcademicEvent(club)).toBe(false);
    expect(isVisibleAcademicEvent({ ...club, visibility: "private" })).toBe(
      false,
    );
    expect(
      isVisibleAcademicEvent({ ...club, visibility: "confidential" }),
    ).toBe(false);
    expect(
      isVisibleAcademicEvent({
        ...club,
        title: " busy ",
        visibility: "public",
      }),
    ).toBe(false);
    expect(isVisibleAcademicEvent({ ...club, visibility: "public" })).toBe(
      true,
    );
  });
  test("keeps institutional events that do not have Google visibility metadata", () => {
    expect(
      isVisibleAcademicEvent({
        ...club,
        category: "holiday",
        origin: "institutional",
      }),
    ).toBe(true);
  });
});
