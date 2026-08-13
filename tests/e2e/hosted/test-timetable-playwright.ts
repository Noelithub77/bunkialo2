import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const DEFAULT_HOSTED_URL = "https://bunkialo.noelmcv7.workers.dev";
const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..", "..", "..");
const STATE_PATH = path.join(
  ROOT_DIR,
  "artifacts",
  "playwright",
  "hosted-auth.json",
);

const hostedUrl = process.env.WEB_RELAY_TEST_URL || DEFAULT_HOSTED_URL;

const main = async (): Promise<void> => {
  try {
    await fs.access(STATE_PATH);
  } catch {
    throw new Error(
      "Missing hosted auth state. Run `bun run test:e2e:hosted-auth` first.",
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  try {
    await page.goto(`${hostedUrl}/timetable`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.getByText("Timetable", { exact: true }).last().waitFor({
      timeout: 30000,
    });

    const pageText = await page.locator("body").innerText();
    if (pageText.includes("Step 1 of 2")) {
      throw new Error("Hosted auth state expired; run the auth setup again.");
    }
    if (!pageText.includes("No timetable yet") && !pageText.includes("Schedule")) {
      throw new Error("Hosted timetable content was not rendered.");
    }

    console.log(`Hosted timetable rendered at ${page.url()}`);
  } finally {
    await context.close();
    await browser.close();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
