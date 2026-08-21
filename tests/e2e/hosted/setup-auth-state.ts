import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { loadEnvFromRoot } from "../../helpers/lms-session";

const DEFAULT_HOSTED_URL = "https://bunkialo.noelmcv7.workers.dev";
const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..", "..", "..");
const STATE_DIR = path.join(ROOT_DIR, "artifacts", "playwright");
const STATE_PATH = path.join(STATE_DIR, "hosted-auth.json");

loadEnvFromRoot();

const hostedUrl = process.env.WEB_RELAY_TEST_URL || DEFAULT_HOSTED_URL;
const username = process.env.LMS_TEST_USERNAME;
const password = process.env.LMS_TEST_PASSWORD;
const attendanceEmail = process.env.ATTENDANCE_TEST_EMAIL;
const attendancePassword = process.env.ATTENDANCE_TEST_PASSWORD;
const isHeaded = process.argv.includes("--headed");

const requireValue = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing ${name} in .env or the environment.`);
  return value;
};

const waitForPage = async (page: Page): Promise<void> => {
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
};

const clickStepButton = async (page: Page, label: string): Promise<void> => {
  const button = page
    .locator("[tabindex='0']")
    .filter({ hasText: label })
    .first();
  await button.click({ timeout: 15000 });
};

const main = async (): Promise<void> => {
  const lmsUsername = requireValue("LMS_TEST_USERNAME", username);
  const lmsPassword = requireValue("LMS_TEST_PASSWORD", password);
  const portalEmail = requireValue("ATTENDANCE_TEST_EMAIL", attendanceEmail);
  const portalPassword = requireValue(
    "ATTENDANCE_TEST_PASSWORD",
    attendancePassword,
  );

  await fs.mkdir(STATE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !isHeaded });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("pageerror", (error) => {
    console.error(`Hosted page error: ${error.message}`);
  });

  try {
    await page.goto(`${hostedUrl}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await waitForPage(page);

    await page.locator("#lms-username").fill(lmsUsername);
    await page.locator("#lms-password").fill(lmsPassword);
    await clickStepButton(page, "Continue");
    await page.getByText("Institute email", { exact: true }).waitFor({
      timeout: 60000,
    });

    await page.locator("#attendance-portal-username").fill(portalEmail);
    await page.locator("#attendance-portal-password").fill(portalPassword);
    await clickStepButton(page, "Finish sign in");
    await page.getByText("Dashboard", { exact: true }).first().waitFor({
      timeout: 60000,
    });

    await context.storageState({ path: STATE_PATH });
    console.log(`Saved hosted auth state to ${path.relative(ROOT_DIR, STATE_PATH)}`);
  } finally {
    await context.close();
    await browser.close();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
