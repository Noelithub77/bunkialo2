import { Colors } from "@/constants/theme";
import { ACADEMIC_TERMS } from "@/data/acad-cal";
import type { AcademicEvent, AcademicEventCategory, AcademicTermInfo } from "@/types";
import type { Ionicons } from "@expo/vector-icons";

type CategoryMeta = {
    label: string;
    color: string;
    icon: keyof typeof Ionicons.glyphMap;
};

export const CATEGORY_META: Record<AcademicEventCategory, CategoryMeta> = {
    academic: {
        label: "Academics",
        color: Colors.status.info,
        icon: "school-outline",
    },
    exam: {
        label: "Exams",
        color: Colors.status.danger,
        icon: "document-text-outline",
    },
    holiday: {
        label: "Holidays",
        color: Colors.status.warning,
        icon: "sunny-outline",
    },
    committee: {
        label: "Committee",
        color: Colors.courseColors[5],
        icon: "people-outline",
    },
    project: {
        label: "Projects",
        color: Colors.courseColors[6],
        icon: "rocket-outline",
    },
    sports: {
        label: "Sports",
        color: Colors.courseColors[3],
        icon: "football-outline",
    },
    festival: {
        label: "Fest",
        color: Colors.courseColors[7],
        icon: "sparkles-outline",
    },
    admin: {
        label: "Admin",
        color: Colors.gray[500],
        icon: "briefcase-outline",
    },
    result: {
        label: "Results",
        color: Colors.status.success,
        icon: "ribbon-outline",
    },
};

export const CATEGORY_ORDER: AcademicEventCategory[] = [
    "academic",
    "exam",
    "holiday",
    "committee",
    "project",
    "sports",
    "festival",
    "admin",
    "result",
];

// date utilities
const pad = (value: number): string => `${value}`.padStart(2, "0");

export const toISODate = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseISODate = (value: string): Date => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
};

export const isValidDateString = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = parseISODate(value);
    return toISODate(parsed) === value;
};

export const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

export const isWithin = (target: string, start: string, end: string): boolean =>
    target >= start && target <= end;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const formatShortDate = (value: string): string => {
    const date = parseISODate(value);
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

export const formatLongDate = (value: string): string => {
    const date = parseISODate(value);
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${WEEKDAYS[date.getDay()]}`;
};

export const formatWeekday = (value: string): string => {
    const date = parseISODate(value);
    return WEEKDAYS[date.getDay()];
};

export const formatRange = (event: AcademicEvent): string => {
    if (!event.endDate || event.endDate === event.date) {
        return formatLongDate(event.date);
    }
    return `${formatShortDate(event.date)} - ${formatShortDate(event.endDate)}`;
};

export const buildEventDates = (event: AcademicEvent): string[] => {
    const start = parseISODate(event.date);
    const end = event.endDate ? parseISODate(event.endDate) : start;
    const dates: string[] = [];
    let cursor = start;

    while (cursor <= end) {
        dates.push(toISODate(cursor));
        cursor = addDays(cursor, 1);
    }

    return dates;
};

export const getCurrentTerm = (today: string): AcademicTermInfo => {
    const active = ACADEMIC_TERMS.find((term) =>
        isWithin(today, term.startDate, term.endDate),
    );
    if (active) return active;

    const upcoming = ACADEMIC_TERMS.filter((term) => term.startDate > today).sort(
        (a, b) => a.startDate.localeCompare(b.startDate),
    );
    if (upcoming.length > 0) return upcoming[0];

    const sorted = [...ACADEMIC_TERMS].sort((a, b) =>
        a.endDate.localeCompare(b.endDate),
    );
    return sorted[sorted.length - 1];
};

export const getInitialSelectedDate = (today: string, term: AcademicTermInfo): string =>
    isWithin(today, term.startDate, term.endDate) ? today : term.startDate;
