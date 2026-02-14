import { format } from "date-fns";
import type { CourseBunkData } from "@/types";
import { filterPastBunks, getDisplayName } from "@/stores/bunk-store";

export type BunkTransferScope = "duty-leave" | "all-bunks";

export interface BunkTransferRow {
  courseName: string;
  date: string;
  day: string;
  slot: string;
  type: "DL" | "BUNK";
}

const escapeCsvValue = (value: string): string => {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
};

const parseDateOnlyFromBunk = (bunkDate: string): string | null => {
  const dateMatch = bunkDate.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!dateMatch) return null;

  const [, day, monthStr, year] = dateMatch;
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  const month = months[monthStr.toLowerCase()];
  if (!month) return null;

  return `${year}-${month}-${day.padStart(2, "0")}`;
};

const normalizeSlotFromBunk = (bunkDate: string, timeSlot: string | null): string => {
  if (timeSlot) return timeSlot;
  const timeMatch = bunkDate.match(
    /(\d{1,2}(?::\d{2})?(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?(?:AM|PM))/i,
  );
  return timeMatch ? timeMatch[1].toUpperCase().replace(/\s+/g, "") : "";
};

export const buildBunkTransferRows = (
  courses: CourseBunkData[],
  scope: BunkTransferScope,
): BunkTransferRow[] => {
  const rows: BunkTransferRow[] = [];

  for (const course of courses) {
    const displayName = getDisplayName(course);
    for (const bunk of filterPastBunks(course.bunks)) {
      if (scope === "duty-leave" && !bunk.isDutyLeave) continue;

      const isoDate = parseDateOnlyFromBunk(bunk.date);
      if (!isoDate) continue;

      rows.push({
        courseName: displayName,
        date: isoDate,
        day: format(new Date(`${isoDate}T00:00:00`), "EEEE"),
        slot: normalizeSlotFromBunk(bunk.date, bunk.timeSlot),
        type: bunk.isDutyLeave ? "DL" : "BUNK",
      });
    }
  }

  return rows;
};

export const rowsToCsv = (rows: BunkTransferRow[]): string => {
  const header = ["Course Name", "Date", "Day", "Slot", "Type"];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [row.courseName, row.date, row.day, row.slot, row.type]
        .map((value) => escapeCsvValue(value))
        .join(","),
    );
  }

  return lines.join("\n");
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const rowsToExcelXml = (rows: BunkTransferRow[]): string => {
  const headers = ["Course Name", "Date", "Day", "Slot", "Type"];
  const headerXml = headers
    .map((header) => `<Cell><Data ss:Type=\"String\">${escapeXml(header)}</Data></Cell>`)
    .join("");

  const rowXml = rows
    .map(
      (row) =>
        `<Row>${[row.courseName, row.date, row.day, row.slot, row.type]
          .map((value) => `<Cell><Data ss:Type=\"String\">${escapeXml(value)}</Data></Cell>`)
          .join("")}</Row>`,
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="Bunks">
    <Table>
      <Row>${headerXml}</Row>
      ${rowXml}
    </Table>
  </Worksheet>
</Workbook>`;
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseRowsFromExcelXml = (input: string): string[][] => {
  const rows = Array.from(input.matchAll(/<Row>([\s\S]*?)<\/Row>/gi));
  return rows.map((rowMatch) => {
    const cellMatches = Array.from(
      rowMatch[1].matchAll(/<Data[^>]*>([\s\S]*?)<\/Data>/gi),
    );
    return cellMatches.map((cellMatch) =>
      cellMatch[1]
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&quot;", '"')
        .replaceAll("&apos;", "'")
        .trim(),
    );
  });
};

export const parseTransferRows = (input: string): BunkTransferRow[] => {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const matrix = trimmed.startsWith("<?xml")
    ? parseRowsFromExcelXml(trimmed)
    : trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => parseCsvLine(line));

  if (matrix.length < 2) return [];

  const rowsWithoutHeader = matrix.slice(1);
  const parsed: BunkTransferRow[] = [];

  for (const values of rowsWithoutHeader) {
    const [courseName = "", date = "", day = "", slot = "", type = "DL"] = values;
    if (!courseName || !date) continue;
    parsed.push({
      courseName: courseName.trim(),
      date: date.trim(),
      day: day.trim(),
      slot: slot.trim().toUpperCase().replace(/\s+/g, ""),
      type: type.trim().toUpperCase() === "BUNK" ? "BUNK" : "DL",
    });
  }

  return parsed;
};

export const normalizeSlot = (slot: string | null): string =>
  (slot ?? "").trim().toUpperCase().replace(/\s+/g, "");

export const parseBunkDateToIso = parseDateOnlyFromBunk;
