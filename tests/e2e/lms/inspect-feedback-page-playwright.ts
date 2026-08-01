import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const username = process.env.LMS_TEST_USERNAME;
const password = process.env.LMS_TEST_PASSWORD;

if (!username || !password) {
  console.error("Missing LMS_TEST_USERNAME/LMS_TEST_PASSWORD");
  process.exit(1);
}

const baseUrl = "https://lmsug24.iiitkottayam.ac.in";
const feedbackUrl = `${baseUrl}/mod/feedback/view.php?id=4807`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${baseUrl}/login/index.php`, {
  waitUntil: "domcontentloaded",
});
await page.locator("form#login input[name='username']").fill(username);
await page.locator("form#login input[name='password']").fill(password);
await page
  .locator("form#login button[type='submit'], form#login input[type='submit']")
  .first()
  .click();
await page.waitForLoadState("domcontentloaded");

await page.goto(feedbackUrl, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});

const answerLink = page
  .getByRole("link", { name: /answer the questions|complete/i })
  .first();
if ((await answerLink.count()) > 0) {
  await answerLink.click({ timeout: 5000 }).catch(() => {});
  await page
    .waitForLoadState("domcontentloaded", { timeout: 15000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 7000 }).catch(() => {});
}

const info = await page.evaluate(() => {
  const items = [];
  const selectors = [
    "button",
    "input[type='submit']",
    "input[type='button']",
    "a[role='button']",
    ".singlebutton form button",
    ".singlebutton form input",
    ".btn",
  ];

  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll(selector))) {
      items.push({
        selector,
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type"),
        name: element.getAttribute("name"),
        value: element.getAttribute("value"),
        text: ((element as HTMLElement).innerText || element.textContent || "")
          .trim()
          .slice(0, 140),
      });
    }
  }

  return {
    url: location.href,
    title: document.title,
    forms: document.querySelectorAll("form").length,
    radios: document.querySelectorAll("input[type='radio'][name]").length,
    checkboxes: document.querySelectorAll("input[type='checkbox'][name]")
      .length,
    textFields: document.querySelectorAll(
      "textarea, input[type='text'], input:not([type])",
    ).length,
    buttons: items,
  };
});

console.log(JSON.stringify(info, null, 2));

await context.close();
await browser.close();
