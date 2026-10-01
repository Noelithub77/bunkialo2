import { MESS_MENU, MEAL_COLORS } from "../data/mess";
import type {
  CourseBunkData,
  ScheduleWidgetProps,
  TimetableSlot,
  WidgetCard,
} from "@/types";

export const CAMPUS_UTC_OFFSET_MINUTES = 330;
const toMinute = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

const shortTime = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour >= 12 ? "pm" : "am"}`;
};

export const blendWidgetColor = (hex: string, dark: boolean): string => {
  const normalized = /^#[\da-f]{6}$/i.test(hex) ? hex : "#A78BFA";
  const base = dark ? 20 : 255;
  const strength = dark ? 0.22 : 0.17;
  return `#${[1, 3, 5]
    .map((index) =>
      Math.round(
        base * (1 - strength) +
          Number.parseInt(normalized.slice(index, index + 2), 16) * strength,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

const withPalette = (color: string) => ({
  color,
  lightBackground: blendWidgetColor(color, false),
  darkBackground: blendWidgetColor(color, true),
});
const props = (cards: WidgetCard[]): ScheduleWidgetProps => ({
  cards,
  page: 0,
  anchor: 0,
  utcOffsetMinutes: CAMPUS_UTC_OFFSET_MINUTES,
});

export const buildTimetableWidgetProps = (
  slots: TimetableSlot[],
  courses: CourseBunkData[],
  hiddenCourses: Record<string, unknown>,
): ScheduleWidgetProps =>
  props(
    slots
      .filter(
        (slot) =>
          (slot.isCustomCourse || !hiddenCourses[slot.courseId]) &&
          Number.isFinite(toMinute(slot.startTime)) &&
          toMinute(slot.endTime) > toMinute(slot.startTime),
      )
      .map((slot) => {
        const course = courses.find((item) => item.courseId === slot.courseId);
        return {
          id: slot.id,
          day: slot.dayOfWeek,
          startMinute: toMinute(slot.startTime),
          endMinute: toMinute(slot.endTime),
          name: course?.config?.alias || slot.courseName,
          time: `${shortTime(slot.startTime)}–${shortTime(slot.endTime)}`,
          ...withPalette(course?.config?.color ?? "#F87171"),
          items: [],
        };
      }),
  );

export const buildMessWidgetProps = (): ScheduleWidgetProps =>
  props(
    MESS_MENU.flatMap((day) =>
      day.meals.map((meal) => ({
        id: `${day.day}-${meal.type}`,
        day: day.day,
        startMinute: toMinute(meal.startTime),
        endMinute: toMinute(meal.endTime),
        name: meal.name,
        time: `${shortTime(meal.startTime)}–${shortTime(meal.endTime)}`,
        ...withPalette(MEAL_COLORS[meal.type]),
        items: meal.items,
      })),
    ),
  );

export const getWidgetBoundaries = (cards: WidgetCard[]): number[] =>
  [
    ...new Set(
      cards.flatMap((card) => [
        card.day * 1440 + card.startMinute,
        card.day * 1440 + card.endMinute,
      ]),
    ),
  ].sort((a, b) => a - b);

/** iOS timelines refresh at class/meal boundaries while the app is suspended. */
export const getWidgetTimelineDates = (
  cards: WidgetCard[],
  now = Date.now(),
): Date[] => {
  const shifted = new Date(now + CAMPUS_UTC_OFFSET_MINUTES * 60_000);
  const today =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) -
    CAMPUS_UTC_OFFSET_MINUTES * 60_000;
  const dates = new Set<number>([now]);
  for (let day = 0; day < 14; day += 1) {
    const dayNumber = (shifted.getUTCDay() + day) % 7;
    for (const card of cards.filter((item) => item.day === dayNumber)) {
      for (const minute of [card.startMinute, card.endMinute]) {
        const timestamp = today + day * 86_400_000 + minute * 60_000;
        if (timestamp > now) dates.add(timestamp);
      }
    }
  }
  return [...dates]
    .sort((a, b) => a - b)
    .map((timestamp) => new Date(timestamp));
};
