import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { loadEnvFromRoot } from "../../helpers/lms-session";

const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";
const DEFAULT_MAX_COURSES = Number.POSITIVE_INFINITY;
const DEFAULT_MAX_FEEDBACKS_PER_COURSE = Number.POSITIVE_INFINITY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");

loadEnvFromRoot();

const username = process.env.LMS_TEST_USERNAME;
const password = process.env.LMS_TEST_PASSWORD;
const baseUrl = process.env.LMS_BASE_URL || DEFAULT_BASE_URL;

const args = process.argv.slice(2);
const shouldSubmit = args.includes("--submit");
const headless = !args.includes("--headed");

const readNumericArg = (flag: string, fallback: number): number => {
  const raw =
    args.find((arg) => arg.startsWith(`${flag}=`))?.split("=")[1] || "";
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const maxCourses = readNumericArg("--max-courses", DEFAULT_MAX_COURSES);
const maxFeedbackPerCourse = readNumericArg(
  "--max-feedback-per-course",
  DEFAULT_MAX_FEEDBACKS_PER_COURSE,
);
const onlyCourseId =
  args.find((arg) => arg.startsWith("--course-id="))?.split("=")[1] || null;

if (!username || !password) {
  console.error(
    "Missing LMS_TEST_USERNAME/LMS_TEST_PASSWORD. Set them in .env or env vars.",
  );
  process.exit(1);
}

const gotoAndSettle = async (page: Page, url: string): Promise<void> => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
};

const unique = (values: string[]): string[] => [
  ...new Set(values.filter(Boolean)),
];

const collectCourseLinks = async (
  page: Page,
  currentBaseUrl: string,
): Promise<string[]> => {
  return page.evaluate((runtimeBaseUrl) => {
    const toAbs = (href: string | null): string => {
      if (!href) return "";
      try {
        return new URL(href, runtimeBaseUrl).href;
      } catch {
        return "";
      }
    };

    return Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => toAbs(anchor.getAttribute("href")))
      .filter((href) => /\/course\/view\.php\?id=\d+/i.test(href));
  }, currentBaseUrl);
};

const collectFeedbackLinks = async (
  page: Page,
  currentBaseUrl: string,
): Promise<string[]> => {
  return page.evaluate((runtimeBaseUrl) => {
    const toAbs = (href: string | null): string => {
      if (!href) return "";
      try {
        return new URL(href, runtimeBaseUrl).href;
      } catch {
        return "";
      }
    };

    const links = Array.from(document.querySelectorAll("a[href]"));
    return links
      .map((anchor) => {
        const href = toAbs(anchor.getAttribute("href"));
        const label = (anchor.textContent || "").toLowerCase();
        return { href, label };
      })
      .filter((entry) => {
        if (!entry.href) return false;
        if (/\/mod\/feedback\/(view|complete)\.php\?id=\d+/i.test(entry.href)) {
          return true;
        }
        return /feedback/i.test(entry.label) && /\/mod\//i.test(entry.href);
      })
      .map((entry) => entry.href);
  }, currentBaseUrl);
};

const openFeedbackAttemptIfNeeded = async (page: Page): Promise<void> => {
  const startCandidates = [
    page.getByRole("link", { name: /answer the questions|complete/i }).first(),
    page
      .getByRole("button", { name: /answer the questions|complete/i })
      .first(),
    page
      .getByRole("button", { name: /complete|attempt|answer|continue/i })
      .first(),
    page
      .getByRole("link", { name: /complete|attempt|answer|continue/i })
      .first(),
    page
      .locator("a,button,input[type='submit']")
      .filter({ hasText: /complete|attempt|answer|continue/i })
      .first(),
  ];

  for (const candidate of startCandidates) {
    if ((await candidate.count()) === 0) continue;
    try {
      await candidate.click({ timeout: 2500 });
      await page
        .waitForLoadState("domcontentloaded", { timeout: 10000 })
        .catch(() => {});
      await page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => {});
      return;
    } catch {
      // Continue trying next selector.
    }
  }
};

interface FilledFeedbackFields {
  radioGroupsAnswered: number;
  checkboxGroupsAnswered: number;
  textFieldsFilled: number;
}

const fillCurrentFeedbackForm = async (
  page: Page,
): Promise<FilledFeedbackFields> => {
  return page.evaluate(() => {
    const byName = new Map<string, HTMLInputElement[]>();
    const result: FilledFeedbackFields = {
      radioGroupsAnswered: 0,
      checkboxGroupsAnswered: 0,
      textFieldsFilled: 0,
    };

    const radios = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type='radio'][name]"),
    ).filter((el) => !el.disabled);

    for (const radio of radios) {
      const list = byName.get(radio.name) || [];
      list.push(radio);
      byName.set(radio.name, list);
    }

    for (const group of byName.values()) {
      const alreadyChecked = group.some((el) => el.checked);
      if (alreadyChecked) continue;

      const pick =
        group.find((el) => String(el.value || "").trim() === "3") ||
        group[2] ||
        group[0];
      if (!pick) continue;
      pick.click();
      pick.dispatchEvent(new Event("change", { bubbles: true }));
      result.radioGroupsAnswered += 1;
    }

    const checkboxGroups = new Map<string, HTMLInputElement[]>();
    const checkboxes = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        "input[type='checkbox'][name]",
      ),
    ).filter((el) => !el.disabled);

    for (const checkbox of checkboxes) {
      const key = checkbox.name || checkbox.id || "checkbox-group";
      const list = checkboxGroups.get(key) || [];
      list.push(checkbox);
      checkboxGroups.set(key, list);
    }

    for (const group of checkboxGroups.values()) {
      const checkedCount = group.filter((el) => el.checked).length;
      if (checkedCount >= 3) continue;
      const target = Math.min(3, group.length);
      let current = checkedCount;
      for (const checkbox of group) {
        if (current >= target) break;
        if (checkbox.checked) continue;
        checkbox.click();
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        current += 1;
      }
      if (current > checkedCount) {
        result.checkboxGroupsAnswered += 1;
      }
    }

    const textFields = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "textarea, input[type='text'], input:not([type])",
      ),
    ).filter((el) => !el.disabled && !el.readOnly);

    for (const field of textFields) {
      const current = String(field.value || "").trim();
      if (current) continue;
      field.focus();
      field.value = "_";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      field.blur();
      result.textFieldsFilled += 1;
    }

    return result;
  });
};

const clickSubmitButton = async (page: Page): Promise<boolean> => {
  const submitted = await page.evaluate(() => {
    const questionForm = Array.from(document.querySelectorAll("form")).find(
      (form) =>
        form.querySelector("input[type='radio'][name]") ||
        form.querySelector("input[type='checkbox'][name]") ||
        form.querySelector(
          "textarea[name], input[type='text'][name], input:not([type])[name]",
        ),
    );

    const submitSelectors = [
      "button[type='submit']",
      "input[type='submit']",
      "button",
      "a[role='button']",
    ];

    const scopedRoot = questionForm || document;
    const candidates = submitSelectors.flatMap((selector) =>
      Array.from(scopedRoot.querySelectorAll<HTMLElement>(selector)),
    );

    const labelFor = (node: HTMLElement): string =>
      `${node.innerText || ""} ${"value" in node && typeof node.value === "string" ? node.value : ""}`.toLowerCase();

    const preferred = candidates.find((node) => {
      const label = labelFor(node);
      return /submit your answers|submit|save changes|finish attempt/i.test(
        label,
      );
    });

    const target =
      preferred ||
      candidates.find((node) => {
        const label = labelFor(node);
        return /continue|confirm|yes/i.test(label);
      });

    if (!target) return false;
    target.click();
    return true;
  });

  if (!submitted) return false;
  await page
    .waitForLoadState("domcontentloaded", { timeout: 10000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  return true;
};

const main = async () => {
  console.log("======================================");
  console.log(" LMS FEEDBACK AUTOFILL (PLAYWRIGHT)");
  console.log("======================================");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Mode: ${shouldSubmit ? "SUBMIT" : "DRY RUN"}`);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  interface FeedbackEntry {
    courseUrl: string;
    feedbackUrl: string;
    filled: boolean;
    submitted: boolean;
    radioGroupsAnswered: number;
    checkboxGroupsAnswered: number;
    textFieldsFilled: number;
    error: string | null;
  }

  interface FeedbackReport {
    baseUrl: string;
    mode: "submit" | "dry-run";
    startedAt: string;
    finishedAt?: string;
    coursesFound: number;
    coursesVisited: number;
    feedbackFormsFound: number;
    feedbackFormsVisited: number;
    feedbackFormsSubmitted: number;
    radioGroupsAnswered: number;
    checkboxGroupsAnswered: number;
    textFieldsFilled: number;
    entries: FeedbackEntry[];
  }

  const report: FeedbackReport = {
    baseUrl,
    mode: shouldSubmit ? "submit" : "dry-run",
    startedAt: new Date().toISOString(),
    coursesFound: 0,
    coursesVisited: 0,
    feedbackFormsFound: 0,
    feedbackFormsVisited: 0,
    feedbackFormsSubmitted: 0,
    radioGroupsAnswered: 0,
    checkboxGroupsAnswered: 0,
    textFieldsFilled: 0,
    entries: [],
  };

  try {
    await gotoAndSettle(page, `${baseUrl}/login/index.php`);

    await page.locator("form#login input[name='username']").fill(username);
    await page.locator("form#login input[name='password']").fill(password);
    await page
      .locator(
        "form#login button[type='submit'], form#login input[type='submit']",
      )
      .first()
      .click();
    await page.waitForLoadState("domcontentloaded", { timeout: 20000 });

    await gotoAndSettle(page, `${baseUrl}/my/courses.php`);

    const allCourseLinks = unique(await collectCourseLinks(page, baseUrl));
    const filteredCourseLinks = onlyCourseId
      ? allCourseLinks.filter((url) => url.includes(`id=${onlyCourseId}`))
      : allCourseLinks;
    const selectedCourseLinks = filteredCourseLinks.slice(0, maxCourses);
    report.coursesFound = allCourseLinks.length;

    for (const courseUrl of selectedCourseLinks) {
      report.coursesVisited += 1;
      await gotoAndSettle(page, courseUrl);

      const feedbackLinksAll = unique(
        await collectFeedbackLinks(page, baseUrl),
      );
      const feedbackLinks = feedbackLinksAll.slice(0, maxFeedbackPerCourse);
      report.feedbackFormsFound += feedbackLinksAll.length;

      for (const feedbackUrl of feedbackLinks) {
    const entry: FeedbackEntry = {
          courseUrl,
          feedbackUrl,
          filled: false,
          submitted: false,
          radioGroupsAnswered: 0,
          checkboxGroupsAnswered: 0,
          textFieldsFilled: 0,
          error: null,
        };

        try {
          await gotoAndSettle(page, feedbackUrl);
          await openFeedbackAttemptIfNeeded(page);

          const fieldsPresent =
            (await page
              .locator(
                "input[type='radio'][name], input[type='checkbox'][name], textarea, input[type='text']",
              )
              .count()) > 0;

          if (!fieldsPresent) {
            entry.error =
              "No feedback fields found (may already be submitted or unavailable).";
            report.entries.push(entry);
            continue;
          }

          const filled = await fillCurrentFeedbackForm(page);
          entry.filled = true;
          entry.radioGroupsAnswered = filled.radioGroupsAnswered;
          entry.checkboxGroupsAnswered = filled.checkboxGroupsAnswered;
          entry.textFieldsFilled = filled.textFieldsFilled;

          report.feedbackFormsVisited += 1;
          report.radioGroupsAnswered += filled.radioGroupsAnswered;
          report.checkboxGroupsAnswered += filled.checkboxGroupsAnswered;
          report.textFieldsFilled += filled.textFieldsFilled;

          if (shouldSubmit) {
            const firstSubmit = await clickSubmitButton(page);
            if (firstSubmit) {
              await clickSubmitButton(page);
              entry.submitted = true;
              report.feedbackFormsSubmitted += 1;
            }
          }
        } catch (error) {
          entry.error = error instanceof Error ? error.message : String(error);
        }

        report.entries.push(entry);
      }
    }

    report.finishedAt = new Date().toISOString();

    const reportPath = path.join(
      ROOT_DIR,
      "artifacts",
      "feedback-autofill-report.json",
    );
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log("--------------------------------------");
    console.log(`Courses found: ${report.coursesFound}`);
    console.log(`Courses visited: ${report.coursesVisited}`);
    console.log(`Feedback forms visited: ${report.feedbackFormsVisited}`);
    console.log(`Feedback forms submitted: ${report.feedbackFormsSubmitted}`);
    console.log(`Radio groups answered with 3: ${report.radioGroupsAnswered}`);
    console.log(
      `Checkbox groups answered up to 3: ${report.checkboxGroupsAnswered}`,
    );
    console.log(`Text fields filled with _: ${report.textFieldsFilled}`);
    console.log(`Report: ${reportPath}`);
    console.log("======================================");
  } finally {
    await context.close();
    await browser.close();
  }
};

main().catch((error) => {
  console.error(
    "Fatal:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
