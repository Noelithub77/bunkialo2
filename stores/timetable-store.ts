import { Colors } from "@/constants/theme";
import type {
    DayOfWeek,
    SessionType,
    TimetableSlot,
    TimetableState,
} from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAttendanceStore } from "./attendance-store";
import { useBunkStore } from "./bunk-store";
import { zustandStorage } from "./storage";

interface TimetableActions {
  generateTimetable: () => void;
  clearTimetable: () => void;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// parse "Thu 16 Jan 2026 10AM - 10:55AM" -> { dayOfWeek, startTime, endTime }
const parseSlotTime = (
  dateStr: string,
): { dayOfWeek: DayOfWeek; startTime: string; endTime: string } | null => {
  const dayMatch = dateStr.match(/^(\w{3})\s/);
  if (!dayMatch) return null;

  const dayIndex = DAY_NAMES.indexOf(dayMatch[1]);
  if (dayIndex === -1) return null;

  const timeMatch = dateStr.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  if (!timeMatch) return null;

  // normalize time to 24h format for sorting
  const normalize = (t: string): string => {
    const match = t.match(/(\d{1,2})(?::(\d{2}))?(AM|PM)/i);
    if (!match) return t;
    let hours = parseInt(match[1], 10);
    const minutes = match[2] || "00";
    const period = match[3].toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  };

  return {
    dayOfWeek: dayIndex as DayOfWeek,
    startTime: normalize(timeMatch[1]),
    endTime: normalize(timeMatch[2]),
  };
};

const getSessionType = (desc: string): SessionType => {
  const lower = desc.toLowerCase();
  if (lower.includes("lab")) return "lab";
  if (lower.includes("tutorial")) return "tutorial";
  return "regular";
};

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// get random course color
export const getRandomCourseColor = (): string => {
  return Colors.courseColors[
    Math.floor(Math.random() * Colors.courseColors.length)
  ];
};

export const useTimetableStore = create<TimetableState & TimetableActions>()(
  persist(
    (set, get) => ({
      slots: [],
      lastGeneratedAt: null,
      isLoading: false,

      generateTimetable: () => {
        set({ isLoading: true });

        const attendanceCourses = useAttendanceStore.getState().courses;
        const bunkCourses = useBunkStore.getState().courses;
        const slotMap = new Map<string, TimetableSlot>();

        for (const course of attendanceCourses) {
          // get alias from bunk store
          const bunkCourse = bunkCourses.find(
            (c) => c.courseId === course.courseId,
          );
          const displayName = bunkCourse?.config?.alias || course.courseName;

          for (const record of course.records) {
            const parsed = parseSlotTime(record.date);
            if (!parsed) continue;

            // unique key: courseId + day + start time
            const key = `${course.courseId}-${parsed.dayOfWeek}-${parsed.startTime}`;

            if (!slotMap.has(key)) {
              slotMap.set(key, {
                id: generateId(),
                courseId: course.courseId,
                courseName: displayName,
                dayOfWeek: parsed.dayOfWeek,
                startTime: parsed.startTime,
                endTime: parsed.endTime,
                sessionType: getSessionType(record.description),
              });
            }
          }
        }

        const slots = Array.from(slotMap.values());
        // sort by day then time
        slots.sort((a, b) => {
          if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
          return a.startTime.localeCompare(b.startTime);
        });

        set({ slots, lastGeneratedAt: Date.now(), isLoading: false });
      },

      clearTimetable: () => {
        set({ slots: [], lastGeneratedAt: null });
      },
    }),
    {
      name: "timetable-storage",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        slots: state.slots,
        lastGeneratedAt: state.lastGeneratedAt,
      }),
    },
  ),
);

// get current and next class based on current time
export const getCurrentAndNextClass = (
  slots: TimetableSlot[],
  now: Date = new Date(),
) => {
  const currentDay = now.getDay() as DayOfWeek;
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // today's slots
  const todaySlots = slots.filter((s) => s.dayOfWeek === currentDay);
  todaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  let currentClass: TimetableSlot | null = null;
  let nextClass: TimetableSlot | null = null;

  for (const slot of todaySlots) {
    if (currentTime >= slot.startTime && currentTime < slot.endTime) {
      currentClass = slot;
    } else if (currentTime < slot.startTime && !nextClass) {
      nextClass = slot;
    }
  }

  // if no next class today, find first class of next days
  if (!nextClass) {
    for (let i = 1; i <= 7; i++) {
      const checkDay = ((currentDay + i) % 7) as DayOfWeek;
      const daySlots = slots.filter((s) => s.dayOfWeek === checkDay);
      if (daySlots.length > 0) {
        daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
        nextClass = daySlots[0];
        break;
      }
    }
  }

  return { currentClass, nextClass };
};

// format time for display (24h to 12h)
export const formatTimeDisplay = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// day name helper
export const getDayName = (day: DayOfWeek, short = true): string => {
  const names = short
    ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    : [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
  return names[day];
};

// get nearby slots for carousel (all current day's classes + next day's classes if needed)
export const getNearbySlots = (
  slots: TimetableSlot[],
  now: Date = new Date(),
): TimetableSlot[] => {
  if (slots.length === 0) return [];

  const currentDay = now.getDay() as DayOfWeek;
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // get today's slots sorted by time
  const todaySlots = slots.filter((s) => s.dayOfWeek === currentDay);
  todaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // check if there are any classes today that haven't ended yet
  const hasRemainingToday = todaySlots.some(
    (slot) => slot.endTime > currentTime,
  );

  let result: TimetableSlot[] = [];

  if (hasRemainingToday) {
    // show all today's classes
    result = todaySlots;
  } else {
    // no more classes today, show next day's classes
    for (let i = 1; i <= 7; i++) {
      const nextDay = ((currentDay + i) % 7) as DayOfWeek;
      const nextDaySlots = slots.filter((s) => s.dayOfWeek === nextDay);
      if (nextDaySlots.length > 0) {
        nextDaySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
        result = nextDaySlots;
        break;
      }
    }
  }

  return result;
};
