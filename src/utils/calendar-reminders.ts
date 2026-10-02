import type { AcademicEvent, AcademicEventOverride } from "@/types";
import { isVisibleAcademicEvent } from "@/utils/academic-event-visibility";

export const mergeCalendarReminders = (
  events: AcademicEvent[],
  overrides: Record<string, AcademicEventOverride>,
): AcademicEvent[] =>
  [
    ...new Map(
      events
        .filter((event) => !overrides[event.id]?.hidden)
        .map((event) => [event.id, { ...event, ...overrides[event.id] }]),
    ).values(),
  ].filter(isVisibleAcademicEvent);

export const getCalendarReminderTime = (
  event: AcademicEvent,
): number | null => {
  // Date-only academic entries begin at 09:00 campus time, independent of the
  // device timezone. Timed events and deadlines retain their explicit times.
  const time =
    event.deadlineAt ?? event.startAt ?? `${event.date}T09:00:00+05:30`;
  const timestamp = Date.parse(time);
  return Number.isFinite(timestamp) && !event.isTentative ? timestamp : null;
};

export const getCalendarReminderMinutes = (event: AcademicEvent): number[] =>
  [
    ...new Set(
      (event.reminderMinutes ?? [30]).filter(
        (minutes) => Number.isFinite(minutes) && minutes > 0,
      ),
    ),
  ].sort((a, b) => b - a);
