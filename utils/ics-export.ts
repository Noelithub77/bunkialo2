import type { AcademicEvent } from "@/types";

// format date to ICS format (YYYYMMDD for all-day events)
const toICSDate = (dateStr: string): string => dateStr.replace(/-/g, "");

// escape special characters for ICS
const escapeICS = (text: string): string =>
    text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

// generate unique ID for event
const generateUID = (event: AcademicEvent): string =>
    `${event.id}@bunkialo.app`;

// build single event block
const buildEventBlock = (event: AcademicEvent): string => {
    const startDate = toICSDate(event.date);
    // for all-day events, end date should be day after (exclusive)
    const endDateStr = event.endDate ?? event.date;
    const endParts = endDateStr.split("-").map(Number);
    const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
    endDate.setDate(endDate.getDate() + 1);
    const endICS = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, "0")}${String(endDate.getDate()).padStart(2, "0")}`;

    const lines = [
        "BEGIN:VEVENT",
        `UID:${generateUID(event)}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART;VALUE=DATE:${startDate}`,
        `DTEND;VALUE=DATE:${endICS}`,
        `SUMMARY:${escapeICS(event.title)}`,
    ];

    if (event.note) {
        lines.push(`DESCRIPTION:${escapeICS(event.note)}`);
    }

    if (event.isTentative) {
        lines.push("STATUS:TENTATIVE");
    }

    lines.push(`CATEGORIES:${event.category.toUpperCase()}`);
    lines.push("END:VEVENT");

    return lines.join("\r\n");
};

// generate full ICS file content
export const generateICSContent = (
    events: AcademicEvent[],
    calendarName: string,
): string => {
    const header = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Bunkialo//Academic Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${escapeICS(calendarName)}`,
    ].join("\r\n");

    const footer = "END:VCALENDAR";

    const eventBlocks = events.map(buildEventBlock).join("\r\n");

    return `${header}\r\n${eventBlocks}\r\n${footer}`;
};
