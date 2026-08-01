import { chromium, type Page } from "playwright";
import { createLmsSession, loadEnvFromRoot } from "../../helpers/lms-session";

const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";
const ASSIGNMENT_IDS = [4155, 4250];

loadEnvFromRoot();

const session = createLmsSession({
  baseUrl: process.env.LMS_BASE_URL || DEFAULT_BASE_URL,
});

interface DateRow {
  label: string;
  value: string;
  dataTimestamp: string | null;
  dataTime: string | null;
  datetime: string | null;
}

interface DateRowsData {
  rows: DateRow[];
  activityDateRows: string[];
}

const normalizeText = (value: string | null | undefined): string =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const extractDateRows = async (page: Page): Promise<DateRowsData> => {
  return page.evaluate(() => {
    const normalize = (value: string | null): string =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const rows: DateRow[] = [];
    const tableRows = Array.from(
      document.querySelectorAll(
        ".submissionstatustable tr, table.generaltable tr",
      ),
    );

    for (const row of tableRows) {
      const th = row.querySelector("th");
      const td = row.querySelector("td");

      let label = "";
      let valueCell = null;
      if (th && td) {
        label = normalize(th.textContent);
        valueCell = td;
      } else {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
          label = normalize(cells[0]?.textContent);
          valueCell = cells[cells.length - 1] ?? null;
        }
      }

      if (!label || !valueCell) continue;

      const value = normalize(valueCell.textContent);
      const dataTimestampNode = valueCell.querySelector("[data-timestamp]");
      const dataTimeNode = valueCell.querySelector("[data-time]");
      const timeNode = valueCell.querySelector("time[datetime]");

      rows.push({
        label,
        value,
        dataTimestamp:
          dataTimestampNode?.getAttribute("data-timestamp") ?? null,
        dataTime: dataTimeNode?.getAttribute("data-time") ?? null,
        datetime: timeNode?.getAttribute("datetime") ?? null,
      });
    }

    const activityDateRows = Array.from(
      document.querySelectorAll("[data-region='activity-dates'] div"),
    )
      .map((node) => normalize(node.textContent))
      .filter(Boolean);

    return { rows, activityDateRows };
  });
};

const parseTimestampCandidate = (row: DateRow): number | null => {
  const fromDataTimestamp = Number.parseInt(row.dataTimestamp || "", 10);
  if (Number.isFinite(fromDataTimestamp) && fromDataTimestamp > 0) {
    return fromDataTimestamp * 1000;
  }

  const fromDataTime = Number.parseInt(row.dataTime || "", 10);
  if (Number.isFinite(fromDataTime) && fromDataTime > 0) {
    return fromDataTime;
  }

  if (row.datetime) {
    const parsed = Date.parse(row.datetime);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const parsedText = Date.parse(row.value || "");
  if (!Number.isNaN(parsedText)) return parsedText;

  return null;
};

const findOpenedTimestamp = (rows: DateRow[]): number | null => {
  const openedRow = rows.find((row) => {
    const label = normalizeText(row.label).toLowerCase().replace(/-/g, " ");
    return label.startsWith("opened") || label.startsWith("opening time");
  });
  if (!openedRow) return null;
  return parseTimestampCandidate(openedRow);
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const loggedIn = await session.login();
    if (!loggedIn) {
      throw new Error(
        "Login failed. Check LMS_TEST_USERNAME/LMS_TEST_PASSWORD.",
      );
    }

    const cookieCount = await session.getCookieCount();
    console.log(`Authenticated session with ${cookieCount} cookies`);

    for (const assignmentId of ASSIGNMENT_IDS) {
      const response = await session.fetchWithSession(
        `/mod/assign/view.php?id=${assignmentId}`,
      );
      const html = await response.text();

      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const title = normalizeText(
        await page
          .locator("h1")
          .first()
          .textContent()
          .catch(() => ""),
      );
      const data = await extractDateRows(page);

      const openedTs = findOpenedTimestamp(data.rows);

      console.log("--------------------------------------");
      console.log(`Assignment ${assignmentId}`);
      console.log(`Title: ${title || "(unknown)"}`);
      console.log(`Activity date rows: ${data.activityDateRows.length}`);
      for (const row of data.rows) {
        console.log(
          `- ${row.label} => ${row.value} | data-timestamp=${row.dataTimestamp || "-"} data-time=${row.dataTime || "-"} datetime=${row.datetime || "-"}`,
        );
      }

      if (openedTs) {
        console.log(`Opened timestamp(ms): ${openedTs}`);
        console.log(`Opened local: ${new Date(openedTs).toString()}`);
      } else {
        console.log("Opened timestamp(ms): N/A");
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
